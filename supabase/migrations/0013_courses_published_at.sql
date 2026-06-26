-- Bloque 4 — Publicación (SPEC-PUBLICACION-CONSTANCIAS §1).
-- Marca de tiempo de la última publicación. Se setea desde setPublished al
-- pasar a publicado y se preserva al despublicar (queda como histórico). Si
-- el curso se republica, se actualiza al nuevo now().
--
-- Idempotente: add column if not exists; backfill solo donde aún es null.

alter table public.courses
  add column if not exists published_at timestamptz;

-- Backfill conservador: los cursos hoy publicados quedan con published_at =
-- updated_at (la mejor aproximación al momento de publicación que tenemos).
update public.courses
   set published_at = updated_at
 where published = true and published_at is null;
