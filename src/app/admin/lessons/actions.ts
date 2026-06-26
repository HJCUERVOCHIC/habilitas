'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'

import { getAdminUser } from '@/lib/require-admin'
import {
  deleteR2Object,
  getSignedLessonUrl,
  getSignedUploadUrl,
  isR2Configured,
} from '@/lib/r2'
import { createAdminClient } from '@/lib/supabase/admin'

type Result = { ok: boolean; error?: string }

async function ensureAdmin(): Promise<boolean> {
  return (await getAdminUser()) !== null
}

// SPEC-CONTENIDO-LECCIONES §2 CA-5 — validación por tipo y tamaño.
// CLAUDE.md: "PPTX → PDF al subir; nunca servir PowerPoint al estudiante" →
// slides solo acepta PDF en el upload.
const MAX_MB = { video: 500, pdf: 50, slides: 50, image: 10 } as const
const ACCEPT: Record<string, readonly string[]> = {
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  pdf: ['application/pdf'],
  slides: ['application/pdf'],
  image: ['image/jpeg', 'image/png', 'image/webp'],
}

function maxBytesFor(contentType: string): number | null {
  const mb = MAX_MB[contentType as keyof typeof MAX_MB]
  return mb ? mb * 1024 * 1024 : null
}

function isMimeAllowed(contentType: string, mime: string): boolean {
  return (ACCEPT[contentType] ?? []).includes(mime)
}

function sanitizeFilename(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : ''
  const safeBase = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
  return `${safeBase || 'archivo'}${ext}`
}

export async function updateLessonBody(
  lessonId: string,
  bodyMd: string,
): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  // Cadena vacía → null para que el viewer muestre el placeholder consistente.
  const value = bodyMd.trim() === '' ? null : bodyMd
  const { error } = await admin.from('lessons').update({ body_md: value }).eq('id', lessonId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/**
 * Prepara un upload directo a R2: valida, calcula la key y devuelve la URL
 * PUT prefirmada. NO persiste todavía; eso lo hace confirmLessonUpload tras
 * subir el archivo.
 */
export async function prepareLessonUpload(input: {
  lessonId: string
  filename: string
  mimeType: string
  sizeBytes: number
}): Promise<
  | { ok: true; uploadUrl: string; key: string; contentType: string }
  | { ok: false; error: string }
> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  if (!isR2Configured()) {
    return { ok: false, error: 'Cloudflare R2 no está configurado.' }
  }
  const admin = createAdminClient()
  const { data: lesson } = await admin
    .from('lessons')
    .select('id, content_type')
    .eq('id', input.lessonId)
    .maybeSingle()
  if (!lesson) return { ok: false, error: 'Lección no encontrada.' }
  if (lesson.content_type === 'text') {
    return { ok: false, error: 'Las lecciones de texto no llevan archivo.' }
  }

  if (!isMimeAllowed(lesson.content_type, input.mimeType)) {
    const accepted = (ACCEPT[lesson.content_type] ?? []).join(', ')
    return {
      ok: false,
      error: `Tipo de archivo no permitido para ${lesson.content_type}. Acepta: ${accepted}.`,
    }
  }
  const max = maxBytesFor(lesson.content_type)
  if (max && input.sizeBytes > max) {
    return {
      ok: false,
      error: `El archivo supera el máximo permitido (${MAX_MB[lesson.content_type as keyof typeof MAX_MB]} MB).`,
    }
  }
  if (input.sizeBytes <= 0) {
    return { ok: false, error: 'El archivo está vacío.' }
  }

  const key = `lessons/${input.lessonId}/${randomUUID()}-${sanitizeFilename(input.filename)}`
  const uploadUrl = await getSignedUploadUrl(key, input.mimeType, 900)
  if (!uploadUrl) return { ok: false, error: 'No se pudo firmar la URL de subida.' }
  return { ok: true, uploadUrl, key, contentType: input.mimeType }
}

/**
 * Persiste la referencia al objeto subido. Si la lección tenía contenido
 * previo, intenta borrar el objeto huérfano de R2 (no bloqueante).
 */
export async function confirmLessonUpload(input: {
  lessonId: string
  key: string
  originalName: string
  mimeType: string
  sizeBytes: number
}): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  const { data: previous } = await admin
    .from('lessons')
    .select('content_r2_key')
    .eq('id', input.lessonId)
    .maybeSingle()

  const { error } = await admin
    .from('lessons')
    .update({
      content_r2_key: input.key,
      content_original_name: input.originalName,
      content_mime_type: input.mimeType,
      content_size_bytes: input.sizeBytes,
    })
    .eq('id', input.lessonId)
  if (error) return { ok: false, error: error.message }

  if (previous?.content_r2_key && previous.content_r2_key !== input.key) {
    // Borrado de huérfano: best-effort, ignoramos fallos.
    await deleteR2Object(previous.content_r2_key)
  }
  revalidatePath('/admin/cursos')
  return { ok: true }
}

/**
 * Quita el medio de una lección (nulifica la referencia + borra el objeto en
 * R2 si está accesible).
 */
export async function clearLessonContent(lessonId: string): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  const { data: previous } = await admin
    .from('lessons')
    .select('content_r2_key')
    .eq('id', lessonId)
    .maybeSingle()

  const { error } = await admin
    .from('lessons')
    .update({
      content_r2_key: null,
      content_original_name: null,
      content_mime_type: null,
      content_size_bytes: null,
    })
    .eq('id', lessonId)
  if (error) return { ok: false, error: error.message }

  if (previous?.content_r2_key) {
    await deleteR2Object(previous.content_r2_key)
  }
  return { ok: true }
}

/**
 * URL firmada GET de vida corta para previsualizar el medio en el editor
 * admin. Reaprovecha la función ya disponible.
 */
export async function getLessonPreviewUrl(
  lessonId: string,
): Promise<{ ok: true; url: string } | { ok: false; reason: 'unauthorized' | 'r2' | 'empty' }> {
  if (!(await ensureAdmin())) return { ok: false, reason: 'unauthorized' }
  const admin = createAdminClient()
  const { data } = await admin
    .from('lessons')
    .select('content_r2_key, content_type')
    .eq('id', lessonId)
    .maybeSingle()
  if (!data?.content_r2_key) return { ok: false, reason: 'empty' }
  const expires = data.content_type === 'video' ? 3600 : 900
  const url = await getSignedLessonUrl(data.content_r2_key, expires)
  if (!url) return { ok: false, reason: 'r2' }
  return { ok: true, url }
}
