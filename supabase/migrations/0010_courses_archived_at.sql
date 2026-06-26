-- Bloque 1 — Gestión de cursos: estructura (SPEC-CURSOS-ESTRUCTURA.md §1).
-- Soft delete para cursos: el admin "archiva" un borrador y deja de aparecer
-- en catálogos públicos sin perder datos. Reversible nulificando archived_at.
--
-- Idempotente: add column if not exists + drop policy if exists + create.

alter table public.courses
  add column if not exists archived_at timestamptz;

-- La política pública de lectura excluye archivados. Los módulos/lecciones de
-- un curso archivado ya quedan invisibles transitivamente porque sus policies
-- de lectura referencian (select 1 from courses where published=true).
drop policy if exists "courses_public_read" on public.courses;
create policy "courses_public_read" on public.courses
  for select using (published = true and archived_at is null);
