'use server'

import { Client } from 'pg'
import { revalidatePath } from 'next/cache'

import { getAdminUser } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  parseAndValidateYaml,
  type ImportPayload,
  type ValidationResult,
} from '@/lib/yaml-course'

async function ensureAdmin(): Promise<boolean> {
  return (await getAdminUser()) !== null
}

async function isSlugTaken(slug: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('courses')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  return Boolean(data)
}

export type PreviewResponse =
  | (Extract<ValidationResult, { ok: true }> & { slugTaken: boolean })
  | Extract<ValidationResult, { ok: false }>
  | { ok: false; errors: string[] }

/**
 * Valida el YAML sin escribir nada en la BD. Devuelve el payload normalizado
 * (con slug ya pasado por slugify), conteos para previsualizar, warnings y
 * un flag `slugTaken` cuando el slug ya está tomado en `public.courses`.
 */
export async function previewYamlCourse(text: string): Promise<PreviewResponse> {
  if (!(await ensureAdmin())) return { ok: false, errors: ['No autorizado.'] }
  if (!text.trim()) return { ok: false, errors: ['El YAML está vacío.'] }
  const result = parseAndValidateYaml(text)
  if (!result.ok) return result
  const slugTaken = await isSlugTaken(result.payload.slug)
  return { ...result, slugTaken }
}

export type ImportResponse =
  | { ok: true; slug: string }
  | { ok: false; errors: string[] }

/**
 * Importa el curso del YAML en una transacción única (BEGIN/COMMIT). Usa pg
 * directo con SUPABASE_DB_URL porque Supabase JS no expone transacciones.
 * Si el slug ya existe → rechaza sin tocar nada (Opción A del spec).
 */
export async function importYamlCourse(text: string): Promise<ImportResponse> {
  if (!(await ensureAdmin())) return { ok: false, errors: ['No autorizado.'] }

  const result = parseAndValidateYaml(text)
  if (!result.ok) return { ok: false, errors: result.errors }

  if (await isSlugTaken(result.payload.slug)) {
    return {
      ok: false,
      errors: [
        `Ya existe un curso con el slug "${result.payload.slug}". Cambia el slug en el YAML o edita el curso existente desde el panel.`,
      ],
    }
  }

  const url = process.env.SUPABASE_DB_URL
  if (!url) {
    return { ok: false, errors: ['SUPABASE_DB_URL no está configurada.'] }
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    await client.query('BEGIN')
    try {
      await insertCourse(client, result.payload)
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      return {
        ok: false,
        errors: [`Error durante la importación; se revirtió todo. Detalle: ${(e as Error).message}`],
      }
    }
  } finally {
    await client.end()
  }

  revalidatePath('/admin/cursos')
  return { ok: true, slug: result.payload.slug }
}

async function insertCourse(client: Client, payload: ImportPayload): Promise<void> {
  const passScore = payload.evaluation?.pass_score ?? 70

  const courseRes = await client.query<{ id: string }>(
    `insert into public.courses
       (slug, title, description, category, published, pass_score)
     values ($1, $2, $3, $4, false, $5)
     returning id`,
    [payload.slug, payload.title, payload.description, payload.category, passScore],
  )
  const courseRow = courseRes.rows[0]
  if (!courseRow) throw new Error('INSERT courses no devolvió fila.')
  const courseId = courseRow.id

  for (let mi = 0; mi < payload.modules.length; mi++) {
    const mod = payload.modules[mi]
    if (!mod) continue
    const modRes = await client.query<{ id: string }>(
      `insert into public.modules (course_id, title, order_index)
       values ($1, $2, $3) returning id`,
      [courseId, mod.title, mi + 1],
    )
    const modRow = modRes.rows[0]
    if (!modRow) throw new Error('INSERT modules no devolvió fila.')
    const moduleId = modRow.id

    for (let li = 0; li < mod.lessons.length; li++) {
      const lesson = mod.lessons[li]
      if (!lesson) continue
      await client.query(
        `insert into public.lessons
           (module_id, title, order_index, content_type, body_md, duration_min)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          moduleId,
          lesson.title,
          li + 1,
          lesson.content_type,
          lesson.body_md,
          lesson.duration_min,
        ],
      )
    }
  }

  if (payload.evaluation && payload.evaluation.questions.length > 0) {
    const ev = payload.evaluation
    const evRes = await client.query<{ id: string }>(
      `insert into public.evaluations (course_id, title, questions_per_attempt)
       values ($1, 'Evaluación Final', $2) returning id`,
      [courseId, ev.questions_per_attempt],
    )
    const evRow = evRes.rows[0]
    if (!evRow) throw new Error('INSERT evaluations no devolvió fila.')
    const evaluationId = evRow.id

    for (let qi = 0; qi < ev.questions.length; qi++) {
      const q = ev.questions[qi]
      if (!q) continue
      await client.query(
        `insert into public.questions
           (evaluation_id, order_index, text, options, correct_option, feedback_correct)
         values ($1, $2, $3, $4::jsonb, $5, $6)`,
        [
          evaluationId,
          qi + 1,
          q.text,
          JSON.stringify(q.options),
          q.correct_option,
          q.feedback_correct,
        ],
      )
    }
  }
}
