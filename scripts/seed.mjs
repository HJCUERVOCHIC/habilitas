// Seed de desarrollo (slices 1–2). Idempotente.
// - Usuarios: instructor + profesional.
// - 4 cursos publicados (distintas categorías) con módulos, lecciones y evaluación.
// - 3 certificados del curso BLS: valid, revoked y uno vencido por fecha.
// Usa service role (omite RLS). Uso: node --env-file=.env.local scripts/seed.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

if (!url || !serviceKey) {
  console.error('✗ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function getOrCreateUser(email, profile) {
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) throw new Error(`listUsers: ${listErr.message}`)
  let user = list.users.find((u) => u.email === email)
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
    if (error) throw new Error(`createUser ${email}: ${error.message}`)
    user = data.user
  }
  const { error: upErr } = await admin.from('users').update(profile).eq('id', user.id)
  if (upErr) throw new Error(`update perfil ${email}: ${upErr.message}`)
  return user
}

async function seedCourse(def, instructorId) {
  const { modules, evaluation, ...courseFields } = def
  const { data: course, error: courseErr } = await admin
    .from('courses')
    .upsert({ ...courseFields, instructor_id: instructorId, published: true }, { onConflict: 'slug' })
    .select('id')
    .single()
  if (courseErr) throw new Error(`upsert curso ${def.slug}: ${courseErr.message}`)

  // Reset idempotente de módulos (cascade borra lecciones).
  const { error: delErr } = await admin.from('modules').delete().eq('course_id', course.id)
  if (delErr) throw new Error(`delete módulos ${def.slug}: ${delErr.message}`)

  for (let m = 0; m < modules.length; m++) {
    const mod = modules[m]
    const { data: insertedModule, error: modErr } = await admin
      .from('modules')
      .insert({ course_id: course.id, title: mod.title, order_index: m + 1 })
      .select('id')
      .single()
    if (modErr) throw new Error(`insert módulo ${def.slug}: ${modErr.message}`)

    const lessonRows = mod.lessons.map((l, i) => ({
      module_id: insertedModule.id,
      title: l.title,
      order_index: i + 1,
      content_type: l.content_type,
      duration_min: l.duration_min,
    }))
    const { error: lessonErr } = await admin.from('lessons').insert(lessonRows)
    if (lessonErr) throw new Error(`insert lecciones ${def.slug}: ${lessonErr.message}`)
  }

  const { error: evalErr } = await admin
    .from('evaluations')
    .upsert(
      { course_id: course.id, duration_min: evaluation.duration_min, title: 'Evaluación Final' },
      { onConflict: 'course_id' },
    )
  if (evalErr) throw new Error(`upsert evaluación ${def.slug}: ${evalErr.message}`)

  return course.id
}

const COURSES = [
  {
    slug: 'soporte-vital-basico-bls',
    title: 'Soporte Vital Básico (BLS)',
    subtitle: 'Reanimación cardiopulmonar y manejo de la vía aérea',
    description:
      'Domina la cadena de supervivencia, la RCP de alta calidad y el uso del DEA en pacientes adultos.',
    category: 'soporte-vital',
    duration_hours: 6,
    difficulty: 'basico',
    learning_objectives: [
      'Reconocer un paro cardiorrespiratorio y activar la cadena de supervivencia.',
      'Ejecutar compresiones torácicas de alta calidad.',
      'Operar un desfibrilador externo automático (DEA).',
      'Manejar la vía aérea con dispositivos básicos.',
    ],
    professional_profile:
      'Al finalizar, el profesional aplica la cadena de supervivencia, ejecuta RCP de alta calidad y opera un DEA en escenarios de paro cardiorrespiratorio en adultos.',
    methodology:
      'Curso 100% en línea, a ritmo del estudiante. Videos demostrativos, lecturas guiadas, diapositivas y casos clínicos. Sin sesiones sincrónicas.',
    completion_rule:
      'Avanza cada lección al ≥90% en videos o marcando "Visto" en lecturas y diapositivas, y aprueba la evaluación final con ≥70%.',
    modules: [
      {
        title: 'Reconocimiento del paro cardiorrespiratorio',
        lessons: [
          { title: 'Fisiopatología del PCR', content_type: 'video', duration_min: 12 },
          { title: 'Cadena de supervivencia', content_type: 'pdf', duration_min: 8 },
        ],
      },
      {
        title: 'RCP y desfibrilación',
        lessons: [
          { title: 'Compresiones de alta calidad', content_type: 'video', duration_min: 15 },
          { title: 'Uso del DEA', content_type: 'slides', duration_min: 10 },
          { title: 'Práctica integrada', content_type: 'text', duration_min: 6 },
        ],
      },
    ],
    evaluation: { duration_min: 45 },
  },
  {
    slug: 'bioseguridad-iaas',
    title: 'Bioseguridad y prevención de IAAS',
    subtitle: 'Precauciones estándar y manejo de residuos',
    description:
      'Aplica las precauciones estándar, la higiene de manos y el manejo seguro de residuos hospitalarios.',
    category: 'bioseguridad',
    duration_hours: 4,
    difficulty: 'intermedio',
    learning_objectives: [
      'Aplicar los cinco momentos de la higiene de manos.',
      'Usar correctamente los elementos de protección personal.',
      'Clasificar y disponer residuos hospitalarios.',
      'Prevenir infecciones asociadas a la atención en salud.',
    ],
    professional_profile:
      'Al finalizar, el profesional aplica las precauciones estándar, usa adecuadamente los elementos de protección personal y dispone los residuos hospitalarios reduciendo el riesgo de IAAS.',
    methodology:
      'Curso 100% en línea, a ritmo del estudiante. Videos demostrativos, lecturas guiadas y diapositivas con ejemplos del entorno hospitalario. Sin sesiones sincrónicas.',
    completion_rule:
      'Avanza cada lección al ≥90% en videos o marcando "Visto" en lecturas y diapositivas, y aprueba la evaluación final con ≥70%.',
    modules: [
      {
        title: 'Precauciones estándar',
        lessons: [
          { title: 'Higiene de manos', content_type: 'video', duration_min: 10 },
          { title: 'Elementos de protección personal', content_type: 'pdf', duration_min: 9 },
        ],
      },
      {
        title: 'Manejo de residuos',
        lessons: [
          { title: 'Clasificación de residuos', content_type: 'slides', duration_min: 11 },
          { title: 'Disposición segura', content_type: 'text', duration_min: 7 },
        ],
      },
    ],
    evaluation: { duration_min: 40 },
  },
  {
    slug: 'urgencias-trauma-inicial',
    title: 'Manejo inicial del trauma',
    subtitle: 'Evaluación primaria ABCDE en urgencias',
    description:
      'Prioriza y estabiliza al paciente politraumatizado con un enfoque sistemático ABCDE.',
    category: 'urgencias',
    duration_hours: 8,
    difficulty: 'avanzado',
    learning_objectives: [
      'Realizar la evaluación primaria ABCDE.',
      'Controlar hemorragias exanguinantes.',
      'Inmovilizar y movilizar al paciente traumatizado.',
      'Priorizar intervenciones que salvan vidas.',
    ],
    professional_profile:
      'Al finalizar, el profesional aplica el enfoque sistemático ABCDE en el paciente politraumatizado, prioriza intervenciones críticas y reconoce signos de deterioro para activar referencia.',
    methodology:
      'Curso 100% en línea, a ritmo del estudiante. Videos demostrativos, lecturas guiadas, imágenes anatómicas y casos clínicos. Sin sesiones sincrónicas.',
    completion_rule:
      'Avanza cada lección al ≥90% en videos o marcando "Visto" en lecturas, diapositivas e imágenes, y aprueba la evaluación final con ≥70%.',
    modules: [
      {
        title: 'Evaluación primaria',
        lessons: [
          { title: 'Vía aérea y control cervical', content_type: 'video', duration_min: 14 },
          { title: 'Ventilación y circulación', content_type: 'pdf', duration_min: 12 },
        ],
      },
      {
        title: 'Intervenciones críticas',
        lessons: [
          { title: 'Control de hemorragias', content_type: 'video', duration_min: 13 },
          { title: 'Inmovilización', content_type: 'image', duration_min: 8 },
        ],
      },
    ],
    evaluation: { duration_min: 60 },
  },
  {
    slug: 'farmacologia-dosis-seguras',
    title: 'Farmacología: dosis seguras',
    subtitle: 'Cálculo de dosis y prevención de errores',
    description:
      'Calcula dosis con seguridad y aplica las barreras para prevenir errores de medicación.',
    category: 'farmacologia',
    duration_hours: 5,
    difficulty: 'intermedio',
    learning_objectives: [
      'Calcular dosis y velocidades de infusión.',
      'Aplicar los correctos de la administración de medicamentos.',
      'Identificar medicamentos de alto riesgo.',
      'Prevenir y reportar errores de medicación.',
    ],
    professional_profile:
      'Al finalizar, el profesional calcula dosis y velocidades de infusión con seguridad, identifica medicamentos de alto riesgo y aplica barreras para prevenir errores de medicación.',
    methodology:
      'Curso 100% en línea, a ritmo del estudiante. Videos demostrativos, lecturas guiadas, diapositivas y ejercicios de cálculo. Sin sesiones sincrónicas.',
    completion_rule:
      'Avanza cada lección al ≥90% en videos o marcando "Visto" en lecturas y diapositivas, y aprueba la evaluación final con ≥70%.',
    modules: [
      {
        title: 'Cálculo de dosis',
        lessons: [
          { title: 'Unidades y conversiones', content_type: 'video', duration_min: 11 },
          { title: 'Velocidad de infusión', content_type: 'pdf', duration_min: 10 },
        ],
      },
      {
        title: 'Seguridad en la administración',
        lessons: [
          { title: 'Medicamentos de alto riesgo', content_type: 'slides', duration_min: 9 },
          { title: 'Reporte de errores', content_type: 'text', duration_min: 6 },
        ],
      },
    ],
    evaluation: { duration_min: 45 },
  },
]

// Banco de preguntas para la evaluación de BLS (~14 → cada intento sortea N=10).
const BLS_QUESTIONS = [
  {
    text: '¿Cuál es la frecuencia de compresiones torácicas recomendada en RCP de adultos?',
    context: 'Paciente adulto en paro cardiorrespiratorio, sin pulso.',
    options: ['60–80 por minuto', '80–100 por minuto', '100–120 por minuto', '120–140 por minuto'],
    correct_option: 2,
    feedback_correct: 'Correcto: 100–120 compresiones por minuto.',
    feedback_wrong: 'Repasa la frecuencia de compresiones de alta calidad.',
  },
  {
    text: '¿Cuál es la profundidad de compresión adecuada en un adulto?',
    context: null,
    options: ['1–2 cm', '2–3 cm', '5–6 cm', '7–8 cm'],
    correct_option: 2,
    feedback_correct: 'Correcto: al menos 5 cm y no más de 6 cm.',
    feedback_wrong: 'Repasa la profundidad de compresión en adultos.',
  },
  {
    text: '¿Cuál es la relación compresiones:ventilaciones con un solo reanimador en adultos?',
    context: null,
    options: ['15:2', '30:2', '5:1', '10:2'],
    correct_option: 1,
    feedback_correct: 'Correcto: 30 compresiones por 2 ventilaciones.',
    feedback_wrong: 'Repasa la relación compresiones:ventilaciones.',
  },
  {
    text: 'Al encontrar a una persona inconsciente, ¿cuál es el primer paso?',
    context: null,
    options: [
      'Iniciar compresiones de inmediato',
      'Verificar la seguridad de la escena y la respuesta',
      'Administrar dos ventilaciones',
      'Buscar el DEA',
    ],
    correct_option: 1,
    feedback_correct: 'Correcto: seguridad de la escena y comprobar respuesta.',
    feedback_wrong: 'Repasa la secuencia inicial de evaluación.',
  },
  {
    text: '¿Qué significa la sigla DEA?',
    context: null,
    options: [
      'Dispositivo de Emergencia Asistida',
      'Desfibrilador Externo Automático',
      'Detección Eléctrica Automática',
      'Dispositivo Externo de Aire',
    ],
    correct_option: 1,
    feedback_correct: 'Correcto: Desfibrilador Externo Automático.',
    feedback_wrong: 'Repasa qué es el DEA.',
  },
  {
    text: '¿Cada cuánto se deben alternar los reanimadores para evitar la fatiga?',
    context: null,
    options: ['Cada 30 segundos', 'Cada 2 minutos', 'Cada 5 minutos', 'No es necesario alternar'],
    correct_option: 1,
    feedback_correct: 'Correcto: cada 2 minutos (o 5 ciclos).',
    feedback_wrong: 'Repasa el cambio de reanimador.',
  },
  {
    text: 'Durante la RCP, ¿qué se debe permitir entre compresiones?',
    context: null,
    options: [
      'Apoyarse sobre el tórax',
      'La reexpansión completa del tórax',
      'Pausas largas frecuentes',
      'Reducir la profundidad',
    ],
    correct_option: 1,
    feedback_correct: 'Correcto: permitir la reexpansión completa del tórax.',
    feedback_wrong: 'Repasa la técnica de compresión de alta calidad.',
  },
  {
    text: '¿Cuál es el componente inicial de la cadena de supervivencia extrahospitalaria?',
    context: null,
    options: [
      'Desfibrilación',
      'Activación del sistema de emergencias',
      'Cuidados posparo',
      'Soporte vital avanzado',
    ],
    correct_option: 1,
    feedback_correct: 'Correcto: reconocimiento y activación del SEM.',
    feedback_wrong: 'Repasa la cadena de supervivencia.',
  },
  {
    text: 'Al usar un DEA, ¿qué se debe hacer al momento de analizar el ritmo?',
    context: null,
    options: [
      'Continuar las compresiones',
      'No tocar al paciente',
      'Administrar ventilaciones',
      'Retirar los parches',
    ],
    correct_option: 1,
    feedback_correct: 'Correcto: nadie debe tocar al paciente durante el análisis.',
    feedback_wrong: 'Repasa el uso seguro del DEA.',
  },
  {
    text: '¿Cuánto debe durar la verificación del pulso antes de iniciar RCP?',
    context: null,
    options: ['No más de 10 segundos', 'Al menos 30 segundos', '1 minuto', 'No se verifica'],
    correct_option: 0,
    feedback_correct: 'Correcto: no más de 10 segundos.',
    feedback_wrong: 'Repasa la verificación del pulso.',
  },
  {
    text: 'Si el DEA indica "no se recomienda descarga", ¿qué se debe hacer?',
    context: null,
    options: [
      'Apagar el DEA',
      'Reanudar compresiones de inmediato',
      'Esperar 2 minutos sin hacer nada',
      'Retirar al paciente',
    ],
    correct_option: 1,
    feedback_correct: 'Correcto: reanudar RCP de inmediato.',
    feedback_wrong: 'Repasa el algoritmo del DEA.',
  },
  {
    text: '¿Qué proporción del tiempo de RCP se busca mantener en compresiones (fracción de compresión)?',
    context: null,
    options: ['Al menos 60%', 'Cerca del 30%', 'Menos del 50%', 'No importa'],
    correct_option: 0,
    feedback_correct: 'Correcto: una fracción de compresión alta (≥60%).',
    feedback_wrong: 'Repasa la importancia de minimizar interrupciones.',
  },
  {
    text: 'En un adulto, las ventilaciones de rescate deben durar aproximadamente:',
    context: null,
    options: ['1 segundo cada una', '5 segundos cada una', '10 segundos cada una', 'No se usan'],
    correct_option: 0,
    feedback_correct: 'Correcto: alrededor de 1 segundo por ventilación.',
    feedback_wrong: 'Repasa la técnica de ventilación.',
  },
  {
    text: '¿Cuál es el objetivo principal de las compresiones torácicas?',
    context: null,
    options: [
      'Reiniciar el corazón',
      'Mantener flujo sanguíneo a órganos vitales',
      'Abrir la vía aérea',
      'Reducir el dolor',
    ],
    correct_option: 1,
    feedback_correct: 'Correcto: mantener perfusión a cerebro y corazón.',
    feedback_wrong: 'Repasa el objetivo de las compresiones.',
  },
]

const DAY = 86_400_000
const now = Date.now()
const iso = (ms) => new Date(ms).toISOString()

try {
  const instructor = await getOrCreateUser('instructor.demo@habilitas.co', {
    full_name: 'Dra. Carolina Restrepo',
    profession: 'Médica especialista en medicina de urgencias',
    role: 'student',
    credential:
      'MD · Especialización en Medicina de Urgencias, Universidad CES (2014). Registro médico vigente.',
    bio:
      'Doce años de experiencia clínica en servicios de urgencias y formación de personal sanitario en BLS y ACLS. Instructora certificada AHA.',
  })

  const holder = await getOrCreateUser('profesional.demo@habilitas.co', {
    full_name: 'Juan David Martínez Rojas',
    profession: 'Enfermero profesional',
    role: 'student',
  })

  const courseIds = {}
  for (const def of COURSES) {
    courseIds[def.slug] = await seedCourse(def, instructor.id)
  }

  // Banco de preguntas para la evaluación de BLS (idempotente: reset + insert).
  const { data: blsEval, error: evalErr } = await admin
    .from('evaluations')
    .select('id')
    .eq('course_id', courseIds['soporte-vital-basico-bls'])
    .single()
  if (evalErr) throw new Error(`evaluación BLS: ${evalErr.message}`)

  await admin.from('questions').delete().eq('evaluation_id', blsEval.id)
  const questionRows = BLS_QUESTIONS.map((q, i) => ({
    evaluation_id: blsEval.id,
    order_index: i + 1,
    text: q.text,
    context: q.context,
    options: q.options,
    correct_option: q.correct_option,
    feedback_correct: q.feedback_correct,
    feedback_wrong: q.feedback_wrong,
  }))
  const { error: qErr } = await admin.from('questions').insert(questionRows)
  if (qErr) throw new Error(`insert preguntas: ${qErr.message}`)

  // Certificados de prueba (curso BLS) para el slice 1.
  const snapshot = {
    user_id: holder.id,
    course_id: courseIds['soporte-vital-basico-bls'],
    professional_name: 'Juan David Martínez Rojas',
    professional_profession: 'Enfermero profesional',
    instructor_name: 'Dra. Carolina Restrepo',
    instructor_role: 'Médica especialista en medicina de urgencias',
  }
  const certs = [
    { ...snapshot, cert_id: 'HAB-2026-9001', score: 92, status: 'valid', issued_at: iso(now - 30 * DAY), expires_at: iso(now + 335 * DAY) },
    { ...snapshot, cert_id: 'HAB-2026-9002', score: 88, status: 'revoked', issued_at: iso(now - 60 * DAY), expires_at: iso(now + 305 * DAY), revoked_at: iso(now - 2 * DAY), revoke_reason: 'Revocado a solicitud de la institución emisora.' },
    { ...snapshot, cert_id: 'HAB-2026-9003', score: 75, status: 'valid', issued_at: iso(now - 400 * DAY), expires_at: iso(now - 35 * DAY) },
  ].map((c) => ({ ...c, verify_url: `${siteUrl}/verificar/${c.cert_id}` }))

  const { error: certErr } = await admin
    .from('certificates')
    .upsert(certs, { onConflict: 'cert_id' })
  if (certErr) throw new Error(`upsert certificados: ${certErr.message}`)

  console.log('✓ Seed aplicado.')
  console.log(`  Cursos: ${COURSES.map((c) => c.slug).join(', ')}`)
  console.log('  Certificados: HAB-2026-9001 (valid), 9002 (revoked), 9003 (expired).')
} catch (error) {
  console.error('✗', error.message)
  process.exitCode = 1
}
