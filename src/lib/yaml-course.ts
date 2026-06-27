import YAML from 'yaml'

import { CATEGORIES, type Category } from '@/lib/categories'
import { slugify } from '@/lib/slug'

/**
 * Validador y transformador del YAML de cursos al payload que importa la BD.
 * Formato fuente: docs/Especificaciones/PROMPT-NOTEBOOKLM-CURSO-YAML.md.
 *
 * Decisiones de reconciliación con el esquema real:
 *   - umbral: YAML `nota_minima` → DB `courses.pass_score` (Bloque 3).
 *   - opciones múltiples correctas → se toma la primera; el resto queda como
 *     advertencia (el esquema es monorrespuesta).
 *   - tipo de lección: texto→text, video→video, recurso→pdf (por defecto).
 *   - URL `PENDIENTE` para video/recurso → la lección se importa sin
 *     `content_r2_key`; el medio se sube por el editor del Bloque 2.
 *   - instructor (string) y precio (string): informativos, no se persisten
 *     (instructor_id es FK UUID; price_cop es nullable).
 */

const YAML_LESSON_TYPES = ['texto', 'video', 'recurso'] as const
type YamlLessonType = (typeof YAML_LESSON_TYPES)[number]

const TIPO_TO_CONTENT_TYPE: Record<YamlLessonType, string> = {
  texto: 'text',
  video: 'video',
  recurso: 'pdf',
}

/**
 * Mapea el campo libre `area` del YAML a una de las 6 categorías del check
 * de DB. Si no matchea ni por sinónimo ni por slugify, devuelve null y el
 * validador emite un error legible.
 */
const AREA_SYNONYMS: Record<string, Category> = {
  bls: 'soporte-vital',
  acls: 'soporte-vital',
  'soporte vital': 'soporte-vital',
  'soporte vital basico': 'soporte-vital',
  'soporte-vital': 'soporte-vital',
  'procedimientos clinicos': 'procedimientos-clinicos',
  'procedimientos clínicos': 'procedimientos-clinicos',
  'procedimientos-clinicos': 'procedimientos-clinicos',
  bioseguridad: 'bioseguridad',
  iaas: 'bioseguridad',
  farmacologia: 'farmacologia',
  farmacología: 'farmacologia',
  urgencias: 'urgencias',
  emergencias: 'urgencias',
  'urgencias y emergencias': 'urgencias',
  trauma: 'urgencias',
  enfermeria: 'enfermeria',
  enfermería: 'enfermeria',
  'salud mental': 'enfermeria',
}

function mapArea(area: string): Category | null {
  const norm = area.trim().toLowerCase()
  const direct = AREA_SYNONYMS[norm]
  if (direct) return direct
  const slug = slugify(area)
  for (const cat of CATEGORIES) {
    if (slug === cat) return cat
  }
  return null
}

export interface ImportLesson {
  title: string
  content_type: string
  body_md: string | null
  duration_min: number | null
  pending_media: boolean
}

export interface ImportModule {
  title: string
  lessons: ImportLesson[]
}

export interface ImportQuestion {
  text: string
  options: string[]
  correct_option: number
  feedback_correct: string | null
  multiple_correct_warning: boolean
}

export interface ImportEvaluation {
  pass_score: number
  questions_per_attempt: number
  questions: ImportQuestion[]
}

export interface ImportPayload {
  slug: string
  title: string
  description: string | null
  category: Category
  modules: ImportModule[]
  evaluation: ImportEvaluation | null
}

export interface ValidationSuccess {
  ok: true
  payload: ImportPayload
  warnings: string[]
  summary: {
    slug: string
    title: string
    category: Category
    modulesCount: number
    lessonsCount: number
    questionsCount: number
    pendingMedia: Array<{ module: string; lesson: string; type: string }>
    multipleCorrectWarnings: number
    perModule: Array<{ title: string; lessons: number }>
  }
}

export interface ValidationFailure {
  ok: false
  errors: string[]
}

export type ValidationResult = ValidationSuccess | ValidationFailure

function strField(
  obj: Record<string, unknown>,
  key: string,
  errors: string[],
  required: boolean,
  where = '',
): string | undefined {
  const v = obj[key]
  if (v == null || v === '') {
    if (required) errors.push(`${where ? `${where}: ` : ''}falta campo obligatorio "${key}".`)
    return undefined
  }
  if (typeof v !== 'string') {
    errors.push(`${where ? `${where}: ` : ''}"${key}" debe ser texto.`)
    return undefined
  }
  return v
}

function intField(
  obj: Record<string, unknown>,
  key: string,
  errors: string[],
  where: string,
  opts: { min?: number; max?: number; default: number },
): number {
  const v = obj[key]
  if (v == null) return opts.default
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    errors.push(`${where}: "${key}" debe ser entero.`)
    return opts.default
  }
  if (opts.min != null && v < opts.min) {
    errors.push(`${where}: "${key}" debe ser ≥ ${opts.min}.`)
  }
  if (opts.max != null && v > opts.max) {
    errors.push(`${where}: "${key}" debe ser ≤ ${opts.max}.`)
  }
  return v
}

export function parseAndValidateYaml(text: string): ValidationResult {
  let raw: unknown
  try {
    raw = YAML.parse(text)
  } catch (e) {
    return { ok: false, errors: [`YAML inválido: ${(e as Error).message}`] }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['El YAML debe ser un objeto raíz con campos del curso.'] }
  }

  const course = raw as Record<string, unknown>
  const errors: string[] = []
  const warnings: string[] = []

  const titulo = strField(course, 'titulo', errors, true)
  const area = strField(course, 'area', errors, true)
  const descripcion = strField(course, 'descripcion', errors, false)

  let category: Category | null = null
  if (area) {
    category = mapArea(area)
    if (!category) {
      errors.push(
        `Categoría no reconocida: "${area}". Usa una de: ${CATEGORIES.join(', ')} (o un sinónimo conocido).`,
      )
    }
  }

  // Slug: si viene en el YAML lo normalizamos; si no, lo derivamos del título.
  let slug: string | undefined
  const slugRaw = strField(course, 'slug', errors, false)
  if (slugRaw) slug = slugify(slugRaw)
  else if (titulo) slug = slugify(titulo)
  if (!slug) errors.push('No se pudo derivar un slug (vacío tras normalizar).')

  // Módulos
  const modulesRaw = course.modulos
  const modules: ImportModule[] = []
  const pendingMedia: ValidationSuccess['summary']['pendingMedia'] = []
  const perModule: ValidationSuccess['summary']['perModule'] = []

  if (!Array.isArray(modulesRaw) || modulesRaw.length === 0) {
    errors.push('"modulos" debe ser una lista con al menos 1 módulo.')
  } else {
    for (let mi = 0; mi < modulesRaw.length; mi++) {
      const mod = modulesRaw[mi]
      const where = `Módulo ${mi + 1}`
      if (!mod || typeof mod !== 'object' || Array.isArray(mod)) {
        errors.push(`${where}: estructura inválida.`)
        continue
      }
      const modObj = mod as Record<string, unknown>
      const modTitle = strField(modObj, 'titulo', errors, true, where)
      const lessonsRaw = modObj.lecciones
      if (!Array.isArray(lessonsRaw) || lessonsRaw.length === 0) {
        errors.push(`${where}: necesita al menos 1 lección en "lecciones".`)
        continue
      }
      const lessons: ImportLesson[] = []
      for (let li = 0; li < lessonsRaw.length; li++) {
        const lesson = lessonsRaw[li]
        const lessonWhere = `${where}, lección ${li + 1}`
        if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) {
          errors.push(`${lessonWhere}: estructura inválida.`)
          continue
        }
        const lo = lesson as Record<string, unknown>
        const lessonTitle = strField(lo, 'titulo', errors, true, lessonWhere)
        const tipoStr = strField(lo, 'tipo', errors, true, lessonWhere)?.toLowerCase()
        if (!tipoStr || !lessonTitle) continue
        if (!(YAML_LESSON_TYPES as readonly string[]).includes(tipoStr)) {
          errors.push(
            `${lessonWhere}: tipo "${tipoStr}" no soportado. Usa: ${YAML_LESSON_TYPES.join(', ')}.`,
          )
          continue
        }
        const tipo = tipoStr as YamlLessonType
        const contentType = TIPO_TO_CONTENT_TYPE[tipo]

        let body: string | null = null
        let durationMin: number | null = null
        let pendingMediaFlag = false

        if (tipo === 'texto') {
          const md = lo.contenido_md
          if (typeof md !== 'string' || !md.trim()) {
            errors.push(`${lessonWhere}: "contenido_md" obligatorio en lecciones de tipo texto.`)
          } else {
            body = md
          }
        } else {
          const urlKey = tipo === 'video' ? 'video_url' : 'archivo_url'
          const url = lo[urlKey]
          if (url == null || url === 'PENDIENTE') {
            pendingMediaFlag = true
          } else if (typeof url !== 'string') {
            errors.push(`${lessonWhere}: "${urlKey}" debe ser texto o "PENDIENTE".`)
          }
          if (tipo === 'video') {
            const dur = lo.duracion_seg
            if (typeof dur === 'number' && Number.isFinite(dur) && dur > 0) {
              durationMin = Math.max(1, Math.round(dur / 60))
            }
          }
          const md = lo.contenido_md
          if (typeof md === 'string' && md.trim()) body = md
        }

        if (pendingMediaFlag && lessonTitle && modTitle) {
          pendingMedia.push({ module: modTitle, lesson: lessonTitle, type: tipo })
        }

        lessons.push({
          title: lessonTitle.trim(),
          content_type: contentType,
          body_md: body?.trim() || null,
          duration_min: durationMin,
          pending_media: pendingMediaFlag,
        })
      }
      if (modTitle && lessons.length > 0) {
        modules.push({ title: modTitle.trim(), lessons })
        perModule.push({ title: modTitle.trim(), lessons: lessons.length })
      }
    }
  }

  // Evaluación (opcional)
  let evaluation: ImportEvaluation | null = null
  let multipleCorrectWarnings = 0
  const evRaw = course.evaluacion
  if (evRaw && typeof evRaw === 'object' && !Array.isArray(evRaw)) {
    const ev = evRaw as Record<string, unknown>
    const passScore = intField(ev, 'nota_minima', errors, 'evaluacion', {
      min: 1,
      max: 100,
      default: 70,
    })
    const questionsPerAttempt = intField(ev, 'preguntas_por_intento', errors, 'evaluacion', {
      min: 1,
      default: 10,
    })
    const banco = ev.banco
    const questions: ImportQuestion[] = []
    if (!Array.isArray(banco)) {
      if (banco != null) errors.push('evaluacion.banco debe ser una lista.')
    } else {
      for (let qi = 0; qi < banco.length; qi++) {
        const where = `evaluacion.banco[${qi + 1}]`
        const q = banco[qi]
        if (!q || typeof q !== 'object' || Array.isArray(q)) {
          errors.push(`${where}: estructura inválida.`)
          continue
        }
        const qo = q as Record<string, unknown>
        const enunciado = strField(qo, 'enunciado', errors, true, where)
        const opcionesRaw = qo.opciones
        if (!Array.isArray(opcionesRaw) || opcionesRaw.length < 2) {
          errors.push(`${where}: requiere al menos 2 opciones.`)
          continue
        }
        const opts: string[] = []
        const correctIndices: number[] = []
        for (let oi = 0; oi < opcionesRaw.length; oi++) {
          const opt = opcionesRaw[oi]
          const optWhere = `${where}.opciones[${oi + 1}]`
          if (!opt || typeof opt !== 'object' || Array.isArray(opt)) {
            errors.push(`${optWhere}: estructura inválida.`)
            continue
          }
          const oo = opt as Record<string, unknown>
          const txt = strField(oo, 'texto', errors, true, optWhere)
          if (txt) opts.push(txt.trim())
          if (oo.correcta === true) correctIndices.push(oi)
        }
        if (opts.length < 2) continue
        if (correctIndices.length === 0) {
          errors.push(`${where}: ninguna opción marcada como correcta: true.`)
          continue
        }
        if (correctIndices.length > 1) {
          multipleCorrectWarnings++
          warnings.push(
            `${where}: múltiples opciones marcadas correctas (${correctIndices.length}); se usará la primera.`,
          )
        }
        const explicacion = strField(qo, 'explicacion', errors, false, where)
        const firstCorrect = correctIndices[0]
        if (enunciado && firstCorrect !== undefined) {
          questions.push({
            text: enunciado.trim(),
            options: opts,
            correct_option: firstCorrect,
            feedback_correct: explicacion?.trim() || null,
            multiple_correct_warning: correctIndices.length > 1,
          })
        }
      }
    }
    if (questions.length > 0 && questions.length < 15) {
      warnings.push(
        `Banco con ${questions.length} preguntas; se recomienda ≥ 15 antes de publicar (checklist del Bloque 4).`,
      )
    }
    evaluation = {
      pass_score: passScore,
      questions_per_attempt: questionsPerAttempt,
      questions,
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }
  if (!titulo || !slug || !category) {
    return { ok: false, errors: ['Faltan campos obligatorios.'] }
  }

  const lessonsCount = modules.reduce((sum, m) => sum + m.lessons.length, 0)

  return {
    ok: true,
    payload: {
      slug,
      title: titulo.trim(),
      description: descripcion?.trim() || null,
      category,
      modules,
      evaluation,
    },
    warnings,
    summary: {
      slug,
      title: titulo.trim(),
      category,
      modulesCount: modules.length,
      lessonsCount,
      questionsCount: evaluation?.questions.length ?? 0,
      pendingMedia,
      multipleCorrectWarnings,
      perModule,
    },
  }
}
