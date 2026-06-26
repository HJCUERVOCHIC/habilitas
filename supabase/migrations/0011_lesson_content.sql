-- Bloque 2 — Contenido de lecciones (SPEC-CONTENIDO-LECCIONES §1).
-- Añade el cuerpo Markdown (body_md) opcional para toda lección y la
-- metadata de medios en R2 (nombre original, MIME, tamaño). Las lecciones
-- legacy de tipo text que guardaban su markdown en `transcript` reciben un
-- backfill conservador a body_md para no perder contenido.
--
-- Idempotente: add column if not exists; update no-op cuando body_md ya
-- esté seteado.

alter table public.lessons add column if not exists body_md text;
alter table public.lessons add column if not exists content_original_name text;
alter table public.lessons add column if not exists content_mime_type text;
alter table public.lessons add column if not exists content_size_bytes bigint;

-- Backfill conservador: solo lecciones de texto cuyo transcript no esté vacío
-- y que aún no tengan body_md. Otros tipos conservan transcript como estaba.
update public.lessons
   set body_md = transcript
 where body_md is null
   and content_type = 'text'
   and transcript is not null
   and length(trim(transcript)) > 0;
