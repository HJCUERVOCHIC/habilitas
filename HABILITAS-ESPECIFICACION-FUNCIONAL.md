# Habilitas — Especificación Funcional v1.1

> **Fuente de verdad funcional del proyecto.** Define *qué* hace la plataforma y *bajo qué reglas*. Es complementario, no sustituto, de `HABILITAS-STACK.md` (que define el *cómo* técnico) y del design system. Ante un conflicto entre este documento y el mockup, manda este documento; ante un conflicto técnico, manda el stack.

**Producto:** Plataforma de certificación de habilidades clínicas para profesionales de la salud en Colombia.
**Estado:** MVP · Objetivo de lanzamiento: 2 semanas.
**Núcleo del MVP:** Cursos → evaluación → certificado verificable. **Sin pasarela de pagos en el MVP.**

**Cambios v1.1:** se confirmaron las siete decisiones de producto (ver sección 8) y se integraron en los requisitos y reglas de negocio.

---

## Cómo usar este documento

1. Cada pantalla tiene **requisitos funcionales** y **criterios de aceptación** (lo que debe ser cierto para darla por terminada). Esos criterios son el contrato de cada slice de construcción.
2. La sección [8. Decisiones tomadas](#8-decisiones-tomadas) registra las siete decisiones de producto ya confirmadas (v1.1). Son el contrato que cada slice debe respetar.
3. La sección [10. Plan de construcción](#10-plan-de-construcción-por-slices-verticales) ordena el trabajo en slices verticales, no en componentes sueltos. Con las decisiones cerradas, ningún slice está bloqueado.

---

## 1. Visión y alcance

### 1.1 Qué es
Habilitas permite a un profesional de la salud **estudiar** una habilidad clínica, **demostrar** su dominio en una evaluación y obtener un **certificado con URL pública verificable** que cualquier empleador puede validar en segundos, sin trámites.

### 1.2 Los tres problemas que resuelve
- **Profesional:** acreditar una competencia clínica de forma rápida y demostrable ante empleadores.
- **Empleador (IPS, clínica, hospital):** verificar una credencial en tiempo real sin llamar a nadie.
- **Equipo Habilitas:** publicar y gestionar contenido y certificados con un equipo pequeño (2–5 personas).

### 1.3 Dentro del alcance del MVP
- Catálogo de certificaciones y página de detalle.
- Inscripción a un curso (gratuita en el MVP — D2).
- Reproductor de curso con módulos, lecciones de varios tipos y desbloqueo progresivo.
- Evaluación final con banco de preguntas, temporizador y puntaje.
- Emisión automática de certificado al aprobar + email.
- Página pública de verificación con estados válido / vencido / revocado.
- Dashboard del profesional (sus cursos y certificados).
- Panel de administración mínimo (crear curso, módulos, lecciones, evaluación; ver y revocar certificados).
- Autenticación por Magic Link.

### 1.4 Fuera del alcance del MVP
Detallado en [sección 9](#9-fuera-de-alcance-del-mvp). En resumen: pasarela de pagos, generación del PDF descargable del certificado, verificación real contra RETHUS, panel para empleadores, app móvil, multi-idioma.

---

## 2. Actores y roles

| Actor | Autenticado | Rol en DB | Qué puede hacer |
|---|---|---|---|
| **Visitante** | No | — | Ver landing, catálogo y detalle. Verificar un certificado por URL. |
| **Profesional (estudiante)** | Sí | `student` | Inscribirse, ver contenido de cursos inscritos, rendir evaluaciones, obtener y ver sus certificados, gestionar su perfil. |
| **Instructor** | Sí | `instructor` | (MVP) Aparece como validador en certificados. Sin panel propio en el MVP — lo gestiona el admin. |
| **Administrador** | Sí | `admin` | Todo lo del estudiante + panel `/admin`: crear/editar cursos, módulos, lecciones, evaluaciones; publicar; ver y revocar certificados. |
| **Empleador / verificador** | No | — | Accede a `/verificar/[id]` (normalmente vía QR o enlace). No tiene cuenta ni panel en el MVP. |

> El "empleador" no es un usuario del sistema en el MVP: es un visitante anónimo que llega a una URL de verificación. No requiere login. Esto es deliberado — la fricción cero es la propuesta de valor.

---

## 3. Entidades de dominio (glosario)

- **Certificación / Curso:** unidad comprable y certificable (ej. "Soporte Vital Básico"). En la DB es `courses`. Tiene categoría, dificultad, duración, instructor, vigencia del certificado (`cert_validity_days`), puntaje mínimo (`pass_score`) e intentos máximos (`max_attempts`).
- **Módulo:** agrupación ordenada de lecciones dentro de un curso (`modules.order_index`).
- **Lección:** unidad de contenido (`lessons`). Tipo: `video`, `pdf`, `slides`, `image`, `text`.
- **Inscripción (enrollment):** vínculo usuario↔curso que da acceso al contenido.
- **Progreso de lección:** registro por usuario y lección (`lesson_progress.completed`).
- **Evaluación:** examen final único por curso (`evaluations`, relación 1:1 con `courses`).
- **Pregunta:** ítem del banco (`questions`): enunciado, contexto clínico opcional, opciones, opción correcta, feedback.
- **Intento (attempt):** registro de un envío de evaluación (`eval_attempts`): puntaje, aprobado/no, respuestas, tiempo.
- **Certificado:** credencial emitida al aprobar (`certificates`): `cert_id` único (`HAB-YYYY-NNNN`), estado, snapshot de datos, fechas de emisión y vencimiento.
- **Estado del certificado:** `valid` | `expired` | `revoked`. `expired` se calcula en runtime comparando `expires_at` con `now()`; no se persiste.

---

## 4. Recorridos de usuario

### 4.1 Profesional — del descubrimiento al certificado
1. Llega a la **landing** o al **catálogo**.
2. Filtra por categoría y abre el **detalle** de una certificación.
3. Pulsa "Comenzar curso". Si no tiene sesión, recibe **Magic Link** por email e inicia sesión.
4. Queda **inscrito** y entra al **reproductor del curso**.
5. Completa las lecciones del módulo 1 → se desbloquea el módulo 2 → … → al completar todos los módulos se habilita la **evaluación final**.
6. Rinde la **evaluación** (temporizada). Si saca ≥ `pass_score`, **aprueba**.
7. Al aprobar, se **emite el certificado** automáticamente y recibe un **email** con su `cert_id` y URL.
8. Ve su certificado en `/verificar/[id]` y en su **perfil**; copia el enlace para compartirlo.

### 4.2 Empleador — verificación
1. Recibe un enlace o escanea un QR → abre `/verificar/[id]`.
2. Ve de inmediato el **estado** (válido / vencido / revocado) y el **documento del certificado** con nombre, profesión, habilidad, fechas, puntaje e instructor validador.
3. Puede copiar el enlace. (La descarga de PDF es Fase 2 — D5.)

### 4.3 Administrador — publicación de contenido
1. Entra a `/admin` (ruta protegida por rol).
2. Crea un **curso** (título, categoría, dificultad, instructor, vigencia, puntaje mínimo, intentos).
3. Crea **módulos** y, dentro de cada uno, **lecciones**, subiendo archivos directo a R2 (URL prefirmada).
4. Crea la **evaluación** y carga el **banco de preguntas** (~15–20 por curso — D4).
5. **Publica** el curso (`published = true`) → aparece en el catálogo.
6. En `/admin/certificados` ve los emitidos y puede **revocar** uno (con razón).

---

## 5. Requisitos funcionales por pantalla

> Convención: **RF** = requisito funcional. **CA** = criterio de aceptación.

### 5.1 Landing — `/` (SSG)
- **RF-1.1** Hero con propuesta de valor, CTA primario "Ver certificaciones" (→ `/certificaciones`) y secundario "Verificar un certificado".
- **RF-1.2** Sección "Cómo funciona" (4 pasos: elegir, estudiar, evaluar, compartir).
- **RF-1.3** Banner para instituciones con CTA de contacto.
- **RF-1.4** Prueba social (conteo de profesionales certificados). En el MVP puede ser un valor estático configurable; no debe afirmar cifras falsas verificables.

**CA:** la página renderiza estáticamente, sin auth; todos los CTA navegan correctamente; carga bajo 2 s en conexión media.

### 5.2 Catálogo — `/certificaciones` (ISR, revalida 1h)
- **RF-2.1** Grilla de tarjetas de certificación; cada tarjeta muestra categoría (con color semántico), título, descripción corta, duración, nº de evaluaciones, dificultad (indicador de 3 puntos) y precio.
- **RF-2.2** Barra de filtros por categoría. "Todas" activo por defecto. El filtro es client-side sobre el conjunto cargado.
- **RF-2.3** Contador de certificaciones disponibles.
- **RF-2.4** Tarjeta enlaza al detalle por `slug`.
- **RF-2.5** Buscador por texto (usa `pg_trgm`). *Si se difiere, marcar como post-MVP.*

**CA:** solo aparecen cursos con `published = true`; el color de la barra de acento y del botón corresponde a la categoría (regla del design system); filtrar por una categoría muestra solo sus cursos.

> **Nota MVP (D2 = B):** el precio se muestra etiquetado **"Gratis durante el lanzamiento"**; el flujo de obtención es gratuito y el CTA dice "Comenzar curso".

### 5.3 Detalle de certificación — `/certificaciones/[slug]` (ISR, revalida 1h)
- **RF-3.1** Encabezado con categoría, título, subtítulo y stats (horas, nº de módulos, evaluación, vigencia).
- **RF-3.2** "Purchase card" con precio, lista de inclusiones y CTA. **Variante MVP (D2 = B):** precio etiquetado "Gratis durante el lanzamiento", CTA "Comenzar curso", sin el sello de "pago seguro".
- **RF-3.3** "Lo que certificarás" (objetivos de aprendizaje).
- **RF-3.4** "Contenido del curso": lista de módulos con nº de clases y duración.
- **RF-3.5** Bloque "Evaluación y certificación": puntaje mínimo, intentos, duración.
- **RF-3.6** Sidebar: instructor, dónde es reconocido, contacto.
- **RF-3.7** CTA "Comenzar curso": si no hay sesión → flujo Magic Link; si hay sesión → crea `enrollment` y redirige a `/curso/[slug]`.

**CA:** el CTA crea exactamente una inscripción (idempotente: si ya está inscrito, redirige sin duplicar — la tabla tiene `unique(user_id, course_id)`); los datos provienen del curso real, no hardcoded.

### 5.4 Reproductor del curso — `/curso/[slug]` (CSR, requiere auth + inscripción)
- **RF-4.1** Topbar del curso: título, barra de progreso (clases completadas / total y %), acceso a evaluación, "Obtener certificado".
- **RF-4.2** Visor de lección que renderiza según `content_type`:
  - `video` → reproductor `<video>` con controles; guarda `last_position`.
  - `pdf` / `slides` → visor PDF (iframe o PDF.js).
  - `image` → imagen con zoom.
  - `text` → render de Markdown desde la DB.
  - **Todo contenido se sirve por URL firmada** (nunca URL directa de R2).
- **RF-4.3** Sidebar con temario agrupado por módulos. Cada módulo muestra estado: **completado** (✓, todas sus lecciones hechas), **en progreso**, o **bloqueado** (🔒).
- **RF-4.4** **Desbloqueo progresivo:** el módulo N solo es accesible si todas las lecciones del módulo N−1 tienen `completed = true` para ese usuario. Calculado en runtime (sin tabla de "desbloqueado").
- **RF-4.5** Marcar lección como completada actualiza `lesson_progress` y el % de progreso.
- **RF-4.6** La **evaluación final** se habilita solo cuando todos los módulos están completos; antes muestra "Completa los módulos para desbloquear".

**CA:** un usuario no inscrito que abre la ruta es redirigido (sin ver contenido); las lecciones de módulos bloqueados no son accesibles ni por URL directa; completar la última lección de un módulo desbloquea el siguiente sin recargar; al completar todos los módulos, el botón de evaluación se activa.

> **Nota (D3 = B):** "lección completada" = video al alcanzar **≥90%** de reproducción (vía `last_position`); pdf / slides / imagen / texto se completan con un botón explícito **"Marcar como vista"**.

### 5.5 Evaluación — modal sobre `/curso/[slug]`
- **RF-5.1** Cabecera con metadatos: duración (min), nº de preguntas, puntaje mínimo, intentos disponibles.
- **RF-5.2** Navegación entre preguntas (dots numerados con estado: actual / respondida / sin responder).
- **RF-5.3** Cada pregunta: número, contexto clínico opcional, enunciado, opciones (A–D), selección única.
- **RF-5.4** Temporizador con cuenta regresiva (visual); el límite se valida en servidor (D7). Al agotarse, se **envía automáticamente** el intento con lo respondido.
- **RF-5.5** Cada intento toma **N preguntas al azar** (default N=10) del banco del curso (D4). Al enviar: calcular puntaje = (correctas / total) × 100; `passed = score ≥ pass_score`; persistir `eval_attempts` (puntaje, respuestas, tiempo, nº de intento).
- **RF-5.6** Pantalla de resultados: anillo con puntaje, veredicto (aprobado / no aprobado), desglose (correctas, incorrectas, tiempo).
- **RF-5.7** Si **aprueba**: CTA "Obtener certificado" → dispara emisión (ver 6.4) → lleva a `/verificar/[id]`. Puede revisar respuestas con explicaciones (ya aprobó — D1).
- **RF-5.8** Si **no aprueba**: ve solo los **temas a reforzar** (no la respuesta literal — D1) y puede "Reintentar" mientras le queden intentos; el reintento trae un nuevo sorteo de preguntas.
- **RF-5.9** Control de intentos: si agotó `max_attempts`, no puede reiniciar; mostrar mensaje y ruta de renovación/contacto.

**CA:** el puntaje persistido coincide con el mostrado; un usuario no puede iniciar un intento N+1 si ya usó `max_attempts`; el temporizador agotado fuerza envío validado en servidor; aprobar emite **exactamente un** certificado por intento aprobado; durante el intento calificado no se revela ninguna respuesta correcta.

> **Integridad (D1 = C, D4 = B, D7 = A):** sin feedback por pregunta durante el intento calificado; al enviar, el aprobado revisa respuestas y el reprobado solo ve temas a reforzar; cada intento saca N al azar de un banco de ~15–20; el límite de tiempo se valida en servidor con `started_at`.

### 5.6 Verificación pública — `/verificar/[id]` (SSR, `force-dynamic`)
- **RF-6.1** Renderizado en servidor en cada visita: el estado debe ser **tiempo real**.
- **RF-6.2** Banner de estado según runtime:
  - `revoked` → banner rojo "Revocado".
  - `expires_at ≤ now()` → banner ámbar "Vencido".
  - en otro caso → banner verde "Válido y vigente".
- **RF-6.3** Documento del certificado: header con gradiente teal (**único lugar permitido del gradiente**), logo, `cert_id`; cuerpo con nombre del profesional, descripción, campos (habilidad, profesión, fechas, puntaje, instructor validador); footer con QR + URL de verificación.
- **RF-6.4** Acciones: copiar enlace, enlace al catálogo. (Descarga de PDF diferida a Fase 2 — D5; el botón se oculta en el MVP.)
- **RF-6.5** Si el `cert_id` no existe → pantalla "Certificado no encontrado" (no error 500).

**CA:** abrir la URL de un certificado revocado muestra estado revocado aunque hace un minuto fuera válido (sin caché); un `cert_id` inexistente muestra el estado "no encontrado"; los datos mostrados son el **snapshot** guardado en `certificates`, no joins que puedan cambiar con el tiempo (el nombre/profesión/instructor del certificado reflejan el momento de emisión).

### 5.7 Perfil / dashboard del profesional — `/perfil` (CSR, requiere auth)
*(No existe en el mockup; especificado aquí.)*
- **RF-7.1** Datos del profesional editables: nombre, profesión, ciudad, RETHUS, avatar. El número RETHUS es **autodeclarado** y no se afirma como "verificado" en ningún lugar (D6 = A).
- **RF-7.2** Lista de **cursos inscritos** con su progreso (usa la vista `course_progress`); enlace para continuar.
- **RF-7.3** Lista de **certificados** del usuario (tarjeta horizontal) con estado y enlace a su verificación.
- **RF-7.4** Acción de cerrar sesión.

**CA:** un usuario solo ve sus propios cursos y certificados (garantizado por RLS); editar el perfil persiste y se refleja en futuros certificados emitidos (no en los ya emitidos, que son snapshot).

### 5.8 Panel de administración — `/admin/*` (CSR, rol `admin`)
*(No existe en el mockup; alcance mínimo para el MVP.)*
- **RF-8.1** Dashboard: cursos publicados vs borradores.
- **RF-8.2** CRUD de cursos (`/admin/cursos`, `/admin/cursos/nuevo`, `/admin/cursos/[slug]`).
- **RF-8.3** Gestión de módulos y lecciones (`/admin/cursos/[slug]/modulos`): crear, ordenar, subir archivo a R2 vía PUT prefirmado, definir `content_type`.
- **RF-8.4** Creación de evaluación y banco de preguntas (enunciado, contexto, opciones, correcta, feedback). Recomendado ~15–20 preguntas por curso (D4).
- **RF-8.5** Publicar / despublicar curso.
- **RF-8.6** `/admin/certificados`: listar emitidos, ver detalle, **revocar** (con `revoke_reason`, set `revoked_at`).

**CA:** una ruta `/admin` abierta por un usuario sin rol `admin` es bloqueada (no solo oculta en UI — verificada en servidor); revocar un certificado se refleja inmediatamente en su página pública; un curso sin evaluación no puede publicarse.

### 5.9 Autenticación — Magic Link (Supabase Auth)
- **RF-9.1** Ingreso por email: el usuario recibe un Magic Link / OTP; sin contraseñas.
- **RF-9.2** En el primer ingreso se crea/completa el registro en `public.users` (al menos `full_name`).
- **RF-9.3** Middleware protege rutas autenticadas (`/curso`, `/perfil`, `/admin`).

**CA:** un enlace caducado o reutilizado no concede sesión; tras autenticarse, el usuario vuelve a la acción que intentaba (ej. inscribirse al curso que disparó el login).

---

## 6. Reglas de negocio

### 6.1 Inscripción
Un usuario puede inscribirse a un curso publicado una sola vez (`unique(user_id, course_id)`). En el MVP la inscripción es gratuita (D2).

### 6.2 Desbloqueo de módulos
Módulo N accesible ⟺ todas las lecciones de los módulos 1..N−1 tienen `completed = true` para el usuario. El módulo 1 siempre está disponible al inscribirse. Se evalúa en runtime (Edge Function `check-module-unlock` o cálculo equivalente en servidor). El criterio de "completada" sigue D3 (video ≥90%; resto, botón manual).

### 6.3 Evaluación: puntaje, aprobación e intentos
- Cada intento toma N preguntas al azar (default N=10) de un banco de ~15–20 por curso (D4).
- `score = round(correctas / total × 100)`.
- `passed = score ≥ courses.pass_score` (default 70).
- **Sin feedback por pregunta durante el intento** (D1). Tras enviar: aprobado → revisión con respuestas y explicaciones; reprobado → solo temas a reforzar, sin respuesta literal.
- El límite de tiempo se registra y valida en servidor con `started_at` (D7); el cronómetro de cliente es solo visual. Tiempo agotado → envío automático.
- Cada envío crea un `eval_attempts` con `attempt_number` incremental.
- El usuario tiene hasta `courses.max_attempts` (default 3) intentos.
- Al aprobar, no se permiten más intentos para ese curso (salvo renovación tras vencimiento — 6.6).

### 6.4 Emisión del certificado
Disparada cuando un `eval_attempts.passed = true`. Edge Function `emit-certificate`:
1. Genera `cert_id` con `generate_cert_id()` → `HAB-YYYY-NNNN`.
2. Calcula `expires_at = issued_at + cert_validity_days`.
3. Guarda **snapshot**: nombre y profesión del profesional, nombre y rol del instructor.
4. Inserta en `certificates` con `status = 'valid'` y `verify_url`.
5. (Fase 2) genera el PDF y lo sube a R2.
6. Envía email vía Resend con `cert_id` y URL.

Regla de idempotencia: un mismo intento aprobado no debe emitir dos certificados.

### 6.5 Estados del certificado
| Estado | Condición | UI |
|---|---|---|
| `valid` | `status='valid'` y `expires_at > now()` | Banner verde ✓ |
| `expired` | `expires_at ≤ now()` (runtime) | Banner ámbar ⚠ |
| `revoked` | `status='revoked'` | Banner rojo ✗ |

Solo un `admin` puede revocar, desde `/admin/certificados`, registrando `revoke_reason` y `revoked_at`.

### 6.6 Renovación
Cuando un certificado vence, el profesional puede volver al curso y rendir de nuevo la evaluación. Al aprobar se emite un **nuevo** certificado (nuevo `cert_id`, nueva `expires_at`). El anterior conserva su registro con estado `expired` — **nunca se elimina** (trazabilidad).

### 6.7 Contenido y seguridad de acceso
- Toda lección se sirve por **URL firmada** con expiración corta (≈1h video, ≈15min documentos).
- Las presentaciones `.pptx` se convierten a PDF al subirse; el estudiante nunca recibe PowerPoint.
- Solo usuarios **inscritos** pueden leer lecciones (RLS `lessons_enrolled_read`).

---

## 7. Requisitos no funcionales

- **Seguridad / RLS:** cada tabla con RLS; un usuario solo accede a sus datos. Los certificados son de **lectura pública por `cert_id`** (necesario para verificación) pero el resto de datos del usuario no. La protección de rol admin se valida en servidor, no solo en UI.
- **Render por ruta:** según `HABILITAS-STACK.md` §2 (SSG landing, ISR catálogo/detalle, SSR verificación, CSR curso/perfil/admin). `/verificar/[id]` debe ser `force-dynamic`.
- **TypeScript estricto:** sin `any`, tipos generados desde la DB.
- **Accesibilidad:** componentes base sobre shadcn/ui (foco, roles ARIA, contraste). El visor de evaluación debe ser navegable por teclado.
- **Rendimiento:** landing y catálogo bajo 2 s; el contenido pesado (video) por CDN de R2.
- **Localización:** español de Colombia; moneda COP; fechas en formato local.
- **Privacidad de datos de salud:** los datos de profesionales (RETHUS, profesión) son sensibles; no exponerlos fuera del snapshot del certificado público y del propio usuario.
- **Confiabilidad de la emisión:** la emisión de certificado y el envío de email no deben fallar silenciosamente; registrar y permitir reintento desde admin si el email no se entrega.

---

## 8. Decisiones tomadas

Las siete decisiones de producto quedaron confirmadas (v1.1). Este es el contrato; los slices las implementan tal cual.

| # | Decisión | Resolución |
|---|---|---|
| **D1** | Modo de feedback de la evaluación | **Híbrido.** Sin feedback por pregunta durante el intento calificado. Al enviar: aprobado → revisión con respuestas y explicaciones; reprobado → solo temas a reforzar (sin respuesta literal), y el reintento trae un nuevo sorteo de preguntas. |
| **D2** | Pago en el MVP | **Acceso gratuito de lanzamiento.** Precio visible etiquetado "Gratis durante el lanzamiento"; inscripción gratuita; CTA "Comenzar curso"; variante de purchase card para el MVP. Pasarela en Fase 2. |
| **D3** | Definición de "lección completada" | **Por tipo.** Video al ≥90% de reproducción (`last_position`); pdf / slides / imagen / texto con botón "Marcar como vista". |
| **D4** | Banco de preguntas | **Banco con sorteo.** ~15–20 preguntas por curso; cada intento saca N al azar (N configurable, default 10). |
| **D5** | PDF del certificado | **Diferido.** El artefacto compartible es la página de verificación en vivo (QR + URL). Botón de descarga oculto en el MVP; generación de PDF en Fase 2. |
| **D6** | Verificación RETHUS | **Autodeclarado.** El número RETHUS no se afirma como "verificado" en ningún lugar. Verificación real (manual o integrada) queda fuera del MVP. |
| **D7** | Temporizador | **Validado en servidor.** `started_at` registrado en servidor; el cronómetro de cliente es solo visual; tiempo agotado fuerza el envío. |

**Limitación conocida (no es tarea del MVP):** la evaluación es en línea, no supervisada y de opción múltiple; la identidad del evaluado no se verifica. Es el hueco de integridad más relevante que queda abierto y el lugar natural para invertir cuando se quiera dar más peso al certificado.

---

## 9. Fuera de alcance del MVP

- Pasarela de pagos y facturación.
- Generación del PDF del certificado (se entrega la URL de verificación).
- Verificación automática contra RETHUS u otras fuentes oficiales.
- Panel y cuentas para empleadores (verifican como anónimos por URL).
- Foro/comentarios del curso (el mockup muestra un hilo de preguntas — diferir o dejar estático).
- Múltiples evaluaciones por curso (el schema asume 1:1 curso↔evaluación).
- App móvil nativa, multi-idioma, analítica avanzada.

---

## 10. Plan de construcción por slices verticales

Orden propuesto. Cada slice se construye de punta a punta (datos → backend → UI), se autoverifica y se revisa en su criterio de aceptación antes de pasar al siguiente. **Las siete decisiones (sección 8) ya están confirmadas, así que ningún slice está bloqueado.**

| # | Slice | Entrega | Decisiones que aplica |
|---|---|---|---|
| 0 | **Esqueleto + DB + Auth** | Proyecto Next.js con el design system aplicado, schema y RLS aplicados en Supabase, Magic Link funcionando, middleware de rutas. | — |
| 1 | **Verificación pública** | `/verificar/[id]` SSR con los 3 estados, leyendo de `certificates` (sembrar datos de prueba). *Es la pantalla más crítica y la más independiente.* | D6 |
| 2 | **Catálogo + Detalle** | `/certificaciones` y `/certificaciones/[slug]` desde datos reales; inscripción. | D2 |
| 3 | **Reproductor de curso** | `/curso/[slug]`: visor por `content_type`, temario, desbloqueo progresivo, progreso, URLs firmadas. | D3 |
| 4 | **Evaluación + emisión** | Modal de evaluación, sorteo del banco, scoring, intentos, Edge Function `emit-certificate`, email Resend. | D1, D4, D7 |
| 5 | **Perfil** | `/perfil`: datos, cursos inscritos, certificados. | D6 |
| 6 | **Admin mínimo** | `/admin`: CRUD curso/módulos/lecciones, banco de preguntas, publicar, revocar. | D4 |
| 7 | **Landing** | `/`: hero, cómo funciona, banner instituciones. | — |

> El orden pone primero lo que da valor verificable con menos dependencias (verificación), y deja la landing al final porque es la que menos lógica tiene. La emisión de certificado (slice 4) es el corazón del producto.

---

*Fin de la especificación funcional v1.1. Las siete decisiones de producto están confirmadas (sección 8); el siguiente paso es construir el slice 0 (esqueleto + DB + auth) y el slice 1 (verificación pública).*
