# SPEC-VIDEOS-YOUTUBE — Videos de YouTube en presentación de curso y lecciones

**Versión:** 1.1 · **Fecha:** 2026-11-16 · **Rama:** `feature/canal_youtube`
**Base:** `VERIFICACION-VIDEOS-YOUTUBE.md` (lectura del repo) + consultas a producción (`pg_policies`, `information_schema.columns`, `pg_constraint`).

---

## Decisiones de negocio cerradas

| # | Decisión |
|---|----------|
| N1 | Los videos de YouTube son de libre acceso. El valor de la plataforma es la evaluación, la constancia de finalización y el material adicional que no está en YouTube. |
| N2 | Las lecciones `youtube` **no** usan el umbral del 90 %. Se completan con el botón existente **"Marcar como vista"**, igual que `text`, `pdf`, `slides` e `image`. La evaluación es el filtro real. |
| N3 | Solo se aceptan videos del canal de Habilitas, validados en servidor con la YouTube Data API v3 comparando `snippet.channelId` contra `YOUTUBE_CHANNEL_ID`. |
| N4 | El video de presentación es metadato comercial: editable aunque el curso esté publicado. Coincide con el comportamiento actual de `updateCourse`, que no llama a `refuseIfPublished`. |
| N5 | El YAML soporta el video de presentación y el tipo de lección `youtube`. |
| N6 | Todo texto visible usa "constancia de finalización", nunca "certificado" ni "certificación". Las superficies públicas mantienen el disclaimer de educación informal. |
| N7 | En un curso **publicado**, el admin puede **reemplazar** el video de una lección `youtube` por otro del canal, sin despublicar. No puede quitarlo ni cambiar el tipo de la lección. Es la única excepción a la inmutabilidad y existe para reparar videos rotos. |
| N8 | Un video de presentación que falla la revisión se oculta automáticamente de las superficies públicas hasta que vuelva a pasar o se reemplace. Las lecciones con video roto siguen visibles (el estudiante conserva el Markdown y el botón "Marcar como vista") y el admin recibe la alerta. |

## Decisiones técnicas tomadas en este SPEC

| # | Decisión | Motivo |
|---|----------|--------|
| T1 | Se guarda solo el **ID del video** (11 caracteres), nunca la URL. | Evita URLs con parámetros de seguimiento y normaliza los formatos. |
| T2 | Columnas nuevas dedicadas: `courses.intro_youtube_id` y `lessons.youtube_video_id`. **No** se reutiliza `lessons.content_url`. | `content_url` está documentada como URL base de R2; mezclar semánticas genera errores. |
| T3 | Embebido desde `https://www.youtube-nocookie.com/embed/{id}`. | Reduce cookies de seguimiento antes de reproducir (Ley 1581). |
| T4 | En páginas públicas se usa un **facade**: miniatura y botón de reproducir; el iframe se carga solo al hacer clic. | Rendimiento del catálogo y cero cookies de YouTube hasta que el visitante decide reproducir. |
| T5 | Miniaturas con `<img>` nativo desde `i.ytimg.com`, no `next/image`. | `next.config.mjs` no tiene `images.remotePatterns`; no se amplía la configuración por esto. |
| T6 | La validación contra la API falla cerrada: si la API no responde o el video no cumple, no se guarda. | Garantiza N3. |
| T7 | Sin `YOUTUBE_API_KEY` o `YOUTUBE_CHANNEL_ID`, la UI degrada con el mensaje "YouTube no está configurado", siguiendo el patrón de `isR2Configured()`. | Coherencia con el resto del código y CI sin secretos. |
| T8 | El catálogo (`/certificaciones`) muestra la miniatura con el distintivo "Ver video" y enlaza al detalle; la reproducción ocurre en `/certificaciones/[slug]`. | Evita múltiples iframes en el listado. |
| T9 | `/certificaciones/[slug]` mantiene `createClient()` con cookies. | Necesita la sesión para saber si el usuario está inscrito o es admin; funciona para anónimos vía `courses_public_read`. |
| T10 | `course_structure_snapshot` **no cambia de forma**. Las lecciones `youtube` quedan registradas con `content_type: 'youtube'`. | El snapshot registra estructura, no medios. |
| T11 | No se agrega ítem nuevo al checklist de publicación; el cumplimiento del contenido del video se recuerda con texto de ayuda en el editor. | Los ítems actuales son booleanos calculados; un ítem manual requeriría estado persistido nuevo, fuera de alcance. |
| T12 | `modules_public_read` pasa a exigir `archived_at is null`, y se crea `modules_enrolled_read` para que los inscritos sigan leyendo la estructura de su curso. | Hoy los estudiantes leen módulos **solo** gracias a la política pública (no existe política para inscritos). Restringirla sin la política nueva podría romper el acceso de inscritos. |
| T13 | El monitoreo corre como Vercel Cron diario sobre `/api/cron/youtube-check`, protegido con `CRON_SECRET`, consultando la Data API en lotes de 50 IDs. | Un lote cuesta 1 unidad de cuota de las 10 000 diarias; el costo es despreciable. |
| T14 | El estado de cada video se guarda en una tabla nueva `youtube_video_checks`, solo accesible por admin y service role. | Separa el estado operativo del contenido del curso y no toca tablas inmutables. |

## Fuera de alcance (backlog)

- Content-Security-Policy del sitio. Hoy no existe y los iframes de YouTube funcionan sin ajustes. Debe diseñarse aparte, desde cero.
- Renombrar la ruta pública `/certificaciones` (conflicto con N6; requiere redirecciones 301 y revisión SEO).
- Validación centralizada de variables de entorno.

---

## §0 Verificación previa (obligatoria antes de escribir código)

Confirma cada punto y **detente solo si algo contradice este SPEC**:

1. `git branch --show-current` devuelve `feature/canal_youtube` y el árbol está limpio, salvo `AGENTS.md` y `VERIFICACION-VIDEOS-YOUTUBE.md`.
2. Último número de migración en `supabase/migrations/`. La nueva será el siguiente (se espera `0017`).
3. El constraint en producción se llama `lessons_content_type_check` y lista `video, pdf, slides, image, text`.
4. `updateCourse` en `src/app/admin/actions.ts` sigue sin llamar a `refuseIfPublished`.
5. Cómo se asigna y cambia `content_type` de una lección (formulario de creación, edición de estructura). Identifica **todos** los lugares que listan los tipos (`LESSON_TYPES`, selects, etiquetas) además de `src/lib/lessons.ts`.
6. Forma exacta del resultado de `getLessonContent` (`src/app/curso/[slug]/actions.ts`) y de la unión discriminada `content.kind`.
7. Si `CourseStructureSnapshotModule` tipa `content_type` como unión literal o como `string`.
8. Si existe `.env.example` o equivalente donde documentar variables.
9. **Lectura de módulos por estudiantes.** Identifica todos los lugares donde un estudiante o visitante lee `modules` (reproductor `/curso/[slug]`, `/mis-cursos`, dashboard, detalle público, verificación de constancia, vista `course_progress`) y si lo hacen con el cliente de usuario, el anónimo o el admin. Reporta qué pasa hoy cuando un estudiante inscrito abre un curso **archivado**: si ya falla por `courses_public_read`, el cambio de T12 no altera su experiencia; si funciona, la política `modules_enrolled_read` es obligatoria para no romperlo.
10. Si existe `vercel.json` y si ya define `crons`. Si el proyecto ya tiene alguna ruta en `src/app/api/`.
11. Cómo envía correos `src/lib/email.ts` (función y plantilla) y a qué dirección llegarían las alertas de admin. Si no hay una dirección de admin configurada, propón usar una variable `ADMIN_ALERT_EMAIL`.

Entrega un resumen corto de §0 antes de continuar.

---

## §1 Implementación

### 1.1 Migración `00XX_youtube_videos.sql`

Aditiva, idempotente donde sea posible, en una sola transacción:

```sql
-- Video de presentación del curso
alter table public.courses
  add column if not exists intro_youtube_id text;

alter table public.courses
  add constraint courses_intro_youtube_id_format
  check (intro_youtube_id is null or intro_youtube_id ~ '^[A-Za-z0-9_-]{11}$');

-- Nuevo tipo de lección
alter table public.lessons
  drop constraint lessons_content_type_check;

alter table public.lessons
  add constraint lessons_content_type_check
  check (content_type in ('video', 'pdf', 'slides', 'image', 'text', 'youtube'));

alter table public.lessons
  add column if not exists youtube_video_id text;

alter table public.lessons
  add constraint lessons_youtube_video_id_format
  check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$');

alter table public.lessons
  add constraint lessons_youtube_id_only_for_youtube
  check (youtube_video_id is null or content_type = 'youtube');
```

- `courses_public_read` ya expone `intro_youtube_id` a anónimos en cursos publicados, y `lessons_enrolled_read` mantiene `youtube_video_id` solo para inscritos. Esas dos políticas no cambian.
- Actualiza `src/types/database.ts` con las columnas nuevas.

### 1.1b Migración `00XX_modules_rls_archived.sql` (hallazgo menor 1)

Migración separada de la anterior para poder revertirla de forma independiente:

```sql
-- Inscritos: leen los módulos de los cursos donde están inscritos,
-- aunque el curso esté despublicado o archivado (mismo criterio que lessons_enrolled_read)
create policy modules_enrolled_read on public.modules
  for select
  using (exists (
    select 1 from public.enrollments e
    where e.course_id = modules.course_id
      and e.user_id = auth.uid()
  ));

-- Público: solo cursos publicados y NO archivados (alineado con courses_public_read)
drop policy modules_public_read on public.modules;

create policy modules_public_read on public.modules
  for select
  using (exists (
    select 1 from public.courses c
    where c.id = modules.course_id
      and c.published = true
      and c.archived_at is null
  ));
```

- El orden importa: primero se crea la política de inscritos, después se restringe la pública, para que no exista un instante sin acceso.
- Si §0.9 muestra que hoy un estudiante **no** puede abrir un curso archivado, la política de inscritos se mantiene igual: es inocua y alinea `modules` con `lessons`.

### 1.1c Migración `00XX_youtube_video_checks.sql` (hallazgo menor 2)

```sql
create table public.youtube_video_checks (
  video_id         text primary key
                   check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  status           text not null
                   check (status in ('ok', 'not_found', 'wrong_channel',
                                     'private', 'not_embeddable', 'error')),
  first_failed_at  timestamptz,
  last_checked_at  timestamptz not null default now(),
  last_alerted_at  timestamptz
);

alter table public.youtube_video_checks enable row level security;

create policy youtube_video_checks_admin_all on public.youtube_video_checks
  for all
  using (exists (
    select 1 from public.users
    where users.id = auth.uid() and users.role = 'admin'
  ));
```

- `status = 'error'` significa que la API no respondió; **no** cuenta como video roto ni oculta nada.
- La lectura pública de "¿el video de presentación está sano?" no pasa por esta tabla (anónimos no la ven): la página pública la consulta con el cliente admin en servidor y solo expone un booleano. Ver 1.12.

### 1.2 Módulo de servidor `src/lib/youtube.ts`

Solo servidor (`import 'server-only'` si el proyecto ya lo usa; si no, no lo importes desde componentes cliente).

- `isYouTubeConfigured(): boolean` — verdadero si existen `YOUTUBE_API_KEY` y `YOUTUBE_CHANNEL_ID`.
- `parseYouTubeId(input: string): string | null` — acepta:
  - `https://www.youtube.com/watch?v=ID` (con o sin parámetros extra)
  - `https://youtu.be/ID`
  - `https://www.youtube.com/shorts/ID`
  - `https://www.youtube.com/embed/ID` y `youtube-nocookie.com/embed/ID`
  - `https://www.youtube.com/live/ID`
  - `https://m.youtube.com/...` en cualquiera de las formas anteriores
  - el ID solo, de 11 caracteres
  
  Rechaza listas de reproducción sin `v=`, canales y cualquier otro dominio.
- `verifyChannelVideo(id: string): Promise<VerifyResult>` — llama a
  `GET https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id={id}&key={KEY}`
  con timeout de 5 s. Resultado:
  - `{ ok: true, title, durationSec }` si el video existe, `snippet.channelId === YOUTUBE_CHANNEL_ID`, `status.embeddable === true` y `status.privacyStatus` es `public` o `unlisted`.
  - `{ ok: false, error }` en cualquier otro caso, con mensajes en español:
    - "El video no existe o no está disponible."
    - "El video no pertenece al canal de Habilitas."
    - "El video tiene desactivada la inserción en otros sitios. Actívala en YouTube Studio."
    - "El video es privado. Cámbialo a público o no listado."
    - "No fue posible validar el video con YouTube. Intenta de nuevo."
- `parseIsoDuration(iso: string): number` — convierte `PT1H2M3S` a segundos.
- `verifyChannelVideos(ids: string[]): Promise<Map<string, VideoStatus>>` — versión por lotes para el monitoreo: hasta 50 IDs por llamada, mismas reglas que `verifyChannelVideo`, devuelve un `status` de los definidos en 1.1c. Un ID que no vuelve en `items` es `not_found`. Un fallo de red o HTTP marca **todos** los IDs del lote como `error`.
- La API key nunca llega al cliente ni a los logs.

### 1.3 Componentes de reproducción

- `src/components/youtube/YouTubeEmbed.tsx` — iframe `https://www.youtube-nocookie.com/embed/{id}?rel=0`, contenedor 16:9 responsivo, `title` accesible, `allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"`, `referrerPolicy="strict-origin-when-cross-origin"`, `loading="lazy"`.
- `src/components/youtube/YouTubeFacade.tsx` (cliente) — miniatura `https://i.ytimg.com/vi/{id}/hqdefault.jpg` con `<img>` nativo y botón de reproducir accesible por teclado; al activarlo renderiza `YouTubeEmbed` con `autoplay=1`.

### 1.4 Video de presentación — admin

- Formulario de edición del curso: campo "Video de presentación (YouTube)" que acepta URL o ID, con texto de ayuda: *"Debe ser un video del canal de Habilitas, público o no listado, con inserción permitida. Verifica que el video hable de 'constancia de finalización' y no de 'certificado'."*
- Server action (en `updateCourse` o una action dedicada `setCourseIntroVideo`): `parseYouTubeId` → `verifyChannelVideo` → guarda `intro_youtube_id`. Campo vacío = quitar video (`null`).
- Permitido con curso publicado (N4). Llama `revalidateCourse(slug)`.
- Vista previa con `YouTubeEmbed` tras guardar.
- Sin configuración: campo deshabilitado con "YouTube no está configurado".

### 1.5 Video de presentación — superficies públicas

- `/certificaciones/[slug]`: si `intro_youtube_id` existe, muestra `YouTubeFacade` en la cabecera del detalle. El disclaimer de educación informal sigue visible en la página.
- `/certificaciones`: agrega `intro_youtube_id` al `select` explícito; la tarjeta muestra la miniatura con el distintivo "Ver video" y enlaza al detalle (T8). Tarjetas sin video conservan su diseño actual.

### 1.6 Lección `youtube` — admin

- Agrega `'youtube'` a `LESSON_TYPES` y a todo lugar identificado en §0.5, con la etiqueta "Video de YouTube".
- `LessonEditor`: si `content_type === 'youtube'`, en lugar de `MediaSection` renderiza `YouTubeSection`:
  - Campo URL o ID, botón "Validar y guardar", vista previa con `YouTubeEmbed`, botón "Quitar video".
  - Mismo texto de ayuda de cumplimiento que 1.4.
  - `BodyEditor` (`body_md`) sigue disponible para el material adicional de la lección.
  - Con curso publicado respeta `PublishedLockBanner` y deshabilita todo excepto el reemplazo del video (ver N7 más abajo).
- Server actions nuevas en `src/app/admin/lessons/actions.ts`:
  - `setLessonYouTube(lessonId, input)`: `refuseIfPublishedByLesson` (salvo la excepción de reemplazo N7) → verifica que la lección sea `youtube` → `parseYouTubeId` → `verifyChannelVideo` → guarda `youtube_video_id`; si `duration_min` es null, lo llena con `ceil(durationSec / 60)` → `revalidateLesson(slug, lessonId)`.
  - `clearLessonYouTube(lessonId)`: `refuseIfPublishedByLesson` → `youtube_video_id = null` → `revalidateLesson`.
- Cambio de tipo de una lección: si deja de ser `youtube`, pon `youtube_video_id = null` en la misma operación (si no, el constraint `lessons_youtube_id_only_for_youtube` falla). Si pasa **a** `youtube` desde un tipo R2, aplica el mismo tratamiento que hoy tiene el cambio entre tipos R2 respecto al objeto existente.
- La rama `youtube` del editor **sí** permite "Validar y guardar" con el curso publicado, como reemplazo (N7): `setLessonYouTube` omite `refuseIfPublishedByLesson` **solo** cuando la lección ya tiene `youtube_video_id` y el nuevo valor pasa la validación. "Quitar video" y el cambio de tipo siguen bloqueados con el curso publicado. El banner del editor muestra: *"Curso publicado: solo puedes reemplazar el video por otro del canal de Habilitas."*
- Tras un reemplazo, borra la fila de `youtube_video_checks` del ID anterior si ya no lo usa ningún curso ni lección, y registra el ID nuevo como `ok`.

### 1.7 Lección `youtube` — estudiante

- `getLessonContent`: para `youtube` devuelve `{ ok: true, kind: 'youtube', videoId }` tras las mismas validaciones de inscripción y `isLessonAccessible`. Si no hay `youtube_video_id`, devuelve el mismo estado `unavailable` que un video sin archivo.
- `LessonViewer`: rama `content.kind === 'youtube'` → `YouTubeEmbed`. `showManualButton` queda en `true` para este tipo (ya lo cumple, porque `playableVideo` es falso; confírmalo con un test).
- `markLessonComplete` acepta lecciones `youtube`. `saveVideoProgress` no se invoca para ellas.
- El desbloqueo progresivo no cambia.

### 1.8 Checklist de publicación

En `src/lib/publish-checklist.ts`, ramifica el filtro de contenido:

```ts
const missingContent = lessonList.filter((l) => {
  if (l.content_type === 'text') return !l.body_md || !l.body_md.trim()
  if (l.content_type === 'youtube') return !l.youtube_video_id
  return !l.content_r2_key
})
```

Incluye `youtube_video_id` en el `select` que alimenta el checklist.

### 1.9 Importación YAML

En `src/lib/yaml-course.ts` y `src/app/admin/cursos/importar/actions.ts`:

- Tipo de lección nuevo `youtube` → `content_type: 'youtube'`, con campo `youtube_url`.
- Campo opcional de curso `video_presentacion_url`.
- Validación en el paso de validar o previsualizar:
  - Valor ausente o `"PENDIENTE"` → se importa sin ID (bandera de pendiente, como `video` y `recurso`).
  - Valor presente → `parseYouTubeId`; si no parsea, error de validación con la ruta del campo.
  - Si YouTube está configurado, `verifyChannelVideo` por cada ID; los errores se reportan en la previsualización y bloquean la confirmación.
- El importador persiste `youtube_video_id` e `intro_youtube_id` (a diferencia de R2, aquí sí hay dato que guardar).
- Actualiza `docs/Especificaciones/PROMPT-NOTEBOOKLM-CURSO-YAML.md` con el tipo `youtube`, `youtube_url`, `video_presentacion_url`, un ejemplo y la regla de que deben ser videos del canal de Habilitas.

### 1.10 Variables de entorno

- `YOUTUBE_API_KEY` y `YOUTUBE_CHANNEL_ID`, solo servidor (sin prefijo `NEXT_PUBLIC_`).
- Documéntalas en `.env.example` (o donde indique §0.8) y en la documentación de configuración existente.
- El build de CI debe pasar sin ellas.

Adicionales para el monitoreo:

- `CRON_SECRET`: solo servidor. Vercel lo envía automáticamente como `Authorization: Bearer` en las invocaciones del cron cuando la variable existe en el proyecto.
- `ADMIN_ALERT_EMAIL` si §0.11 lo requiere.
- Ambas documentadas junto a las de YouTube; el build de CI pasa sin ellas.

### 1.11 Monitoreo de videos (hallazgo menor 2)

**Ruta** `src/app/api/cron/youtube-check/route.ts` (GET):

1. Rechaza con 401 si `Authorization` no es `Bearer ${CRON_SECRET}`.
2. Si YouTube no está configurado, responde 200 con `{ skipped: true }`.
3. Con el cliente admin, reúne los IDs **distintos** de `courses.intro_youtube_id` y `lessons.youtube_video_id` en cursos publicados y no archivados.
4. Llama `verifyChannelVideos` en lotes de 50.
5. `upsert` en `youtube_video_checks` por ID:
   - `ok` → `first_failed_at = null`.
   - fallo real (`not_found`, `wrong_channel`, `private`, `not_embeddable`) → conserva `first_failed_at` si ya existía; si no, lo pone en `now()`.
   - `error` → solo actualiza `last_checked_at`; no toca `first_failed_at` ni dispara alertas.
6. Si hay videos con fallo real y `last_alerted_at` nulo o de hace más de 24 h, envía **un** correo resumen vía `src/lib/email.ts` a la dirección definida en §0.11, con curso, lección (o "video de presentación"), estado y enlace al editor. Actualiza `last_alerted_at`.
7. Llama `revalidateCourse(slug)` para cada curso cuyo video de presentación cambió de estado, para que 1.12 se refleje en las páginas públicas.
8. Responde con un resumen `{ checked, ok, failed, errors }`. Sin datos personales en la respuesta ni en logs.

**Programación** en `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/youtube-check", "schedule": "0 11 * * *" }
  ]
}
```

`0 11 * * *` en UTC equivale a las 6:00 a. m. en Colombia. Si `vercel.json` ya existe, agrega la entrada sin borrar lo existente.

**Revisión manual:** botón "Revisar videos ahora" en el panel admin que llama a una server action con la misma lógica (sin depender del cron ni de `CRON_SECRET`), protegida por rol admin.

**Panel admin:** banner en `/admin` cuando existan filas con fallo real, con la lista de cursos y lecciones afectados, el estado traducido a español y enlace directo al editor correspondiente. Textos de estado:

| status | Texto |
|--------|-------|
| `not_found` | "El video fue eliminado o no existe." |
| `wrong_channel` | "El video ya no pertenece al canal de Habilitas." |
| `private` | "El video fue cambiado a privado." |
| `not_embeddable` | "El video tiene desactivada la inserción en otros sitios." |

### 1.12 Comportamiento público ante videos rotos

- `/certificaciones` y `/certificaciones/[slug]` consultan, con el cliente admin en servidor, si `intro_youtube_id` tiene fila en `youtube_video_checks` con fallo real. Si la tiene, no renderizan el facade ni el distintivo "Ver video" (N8). El ID nunca se marca como roto por `status = 'error'`.
- La consulta se hace en una sola llamada por página (`in(video_id, [...])` en el listado), no una por tarjeta.
- Lecciones `youtube` con video roto: el estudiante ve el embed (YouTube mostrará su propio error), el Markdown y el botón "Marcar como vista". No se oculta la lección para no romper el desbloqueo progresivo.

### 1.13 Tests (Vitest)

- `parseYouTubeId`: todos los formatos válidos de 1.2 y casos inválidos (playlist sin `v`, canal, otro dominio, ID de 10 o 12 caracteres, cadena vacía).
- `verifyChannelVideo` con `fetch` simulado: éxito, otro canal, privado, no embebible, inexistente, timeout, error HTTP.
- `parseIsoDuration`: `PT45S`, `PT3M`, `PT1H2M3S`.
- Checklist: lección `youtube` con y sin ID.
- YAML: lección `youtube` válida, `PENDIENTE`, URL inválida, `video_presentacion_url`.
- `LessonViewer` o lógica equivalente: lección `youtube` muestra el botón manual.
- `verifyChannelVideos`: lote mixto (ok, otro canal, ausente en `items`), fallo HTTP marca todo el lote como `error`, división correcta en lotes de 50.
- Cron: 401 sin secreto o con secreto incorrecto; `skipped` sin configuración; `first_failed_at` se conserva entre ejecuciones; `error` no alerta; no reenvía alerta antes de 24 h.
- `setLessonYouTube` con curso publicado: permite reemplazo válido; rechaza quitar, rechaza reemplazo con video de otro canal, rechaza si la lección no tenía video.
- Páginas públicas: video de presentación con fallo real no se renderiza; con `error` sí.
- `revalidate-admin.test.ts` sigue en verde. Las rutas `api/` no son páginas y no se agregan a `REVALIDATE_TARGETS`.

---

## §2 Criterios de aceptación

1. La migración aplica sin errores sobre la base actual y las filas existentes cumplen los constraints nuevos.
2. Un admin puede agregar, cambiar y quitar el video de presentación de un curso **publicado** sin despublicarlo.
3. Un visitante sin sesión ve el video de presentación en `/certificaciones/[slug]`; el iframe solo carga al hacer clic, desde `youtube-nocookie.com`.
4. Las tarjetas de `/certificaciones` con video muestran miniatura y "Ver video"; las demás no cambian.
5. Pegar un video de otro canal, privado o con inserción desactivada produce el mensaje correspondiente y no guarda nada.
6. Los formatos `watch?v=`, `youtu.be/`, `shorts/`, `embed/`, `live/` y el ID solo se guardan como el mismo ID de 11 caracteres.
7. Un admin puede crear una lección `youtube` en un curso en borrador, validar el video, verlo en vista previa y agregar Markdown complementario.
8. Con el curso publicado, la lección `youtube` no permite quitar el video ni cambiar de tipo, pero sí reemplazar el video por otro válido del canal.
9. Un curso con una lección `youtube` sin video no pasa el checklist; con video, sí.
10. Un estudiante inscrito reproduce la lección `youtube`, la completa con "Marcar como vista" y se desbloquea la siguiente.
11. Un usuario no inscrito no obtiene `youtube_video_id` de ninguna lección (RLS sin cambios).
12. Un YAML con lecciones `youtube`, `PENDIENTE` y `video_presentacion_url` se valida, previsualiza e importa correctamente; un ID de otro canal bloquea la confirmación.
13. Sin `YOUTUBE_API_KEY` o `YOUTUBE_CHANNEL_ID`, el admin ve "YouTube no está configurado" y el resto de la plataforma funciona igual.
14. Ningún texto nuevo dice "certificado" ni "certificación".
15. Las constancias emitidas tras el cambio registran las lecciones `youtube` en el snapshot con `content_type: 'youtube'`.
16. Un visitante anónimo no puede leer módulos de un curso archivado; un estudiante inscrito conserva el acceso que tenía antes del cambio (verificado según §0.9).
17. El cron rechaza invocaciones sin `CRON_SECRET` válido y, con él, actualiza `youtube_video_checks` para todos los videos de cursos publicados y no archivados.
18. Al privatizar en YouTube un video de presentación, tras la siguiente revisión (cron o manual) el video desaparece del catálogo y del detalle público, el panel admin muestra la alerta y llega un solo correo resumen.
19. Al reemplazar el video roto por uno válido, la alerta desaparece y el video vuelve a mostrarse en las páginas públicas.
20. Una caída de la API de YouTube no oculta videos ni genera alertas.
21. `type-check`, `lint`, `test` y `build` con variables placeholder terminan en exit 0 en local antes del push.

---

## §3 Prompt de arranque

Pega este texto en Claude Code (PowerShell), en la raíz del repo, en la rama `feature/canal_youtube`:

```text
Vas a implementar SPEC-VIDEOS-YOUTUBE.md, que está en la raíz del repo. Léelo completo
junto con CLAUDE.md y VERIFICACION-VIDEOS-YOUTUBE.md antes de tocar código.

Orden de trabajo:
1. Ejecuta la §0 completa y entrégame un resumen corto. Detente SOLO si algo contradice
   el SPEC; en ese caso explica la contradicción y propón cómo resolverla.
2. Implementa la §1 en este orden: 1.1, 1.1b y 1.1c migraciones y tipos → 1.2 módulo
   youtube.ts con sus tests → 1.3 componentes → 1.4 y 1.5 video de presentación →
   1.6 y 1.7 lección youtube → 1.8 checklist → 1.9 YAML → 1.10 variables de entorno →
   1.11 monitoreo → 1.12 comportamiento público → 1.13 tests restantes.
3. No apliques las migraciones contra producción. Déjalas listas en supabase/migrations/,
   dime en qué orden aplicarlas y cómo revertir 1.1b si algo falla.
4. Al terminar, corre type-check, lint, test y build (con variables placeholder) y
   confirma exit 0 en los cuatro.
5. Recorre la §2 y marca cada criterio como verificado por test, verificado manualmente
   (dime cómo probarlo) o pendiente.

Reglas:
- Verifica antes de modificar; nunca asumas estructura.
- Todo texto visible usa "constancia de finalización", nunca "certificado".
- No modifiques AGENTS.md ni VERIFICACION-VIDEOS-YOUTUBE.md.
- No hagas push. Haz commits atómicos por bloque de la §1 con mensajes descriptivos.
```
