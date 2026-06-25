-- Sub-slice 2a (SPEC-CUMPLIMIENTO-P1 §3 R4–R6).
-- Idempotente: re-ejecutable sin daño. No recrea columnas/vistas existentes.
--
-- Reconciliación con la migración propuesta en el spec:
--   - duracion_horas, objetivos, nota_minima, intentos_maximos → ya existen
--     como duration_hours, learning_objectives, pass_score, max_attempts
--     (migraciones 0000 y 0001). NO se duplican.
--   - El instructor vive en public.users con role='instructor' (modelo real);
--     extendemos esa fila y la vista pública en lugar de crear una tabla
--     separada que rompería la FK courses.instructor_id.

-- R4 — Metadatos de curso (perfil de egreso + metodología).
alter table public.courses
  add column if not exists professional_profile text;
alter table public.courses
  add column if not exists methodology text;

-- R5 — Regla de completitud (cómo aprobar el curso).
alter table public.courses
  add column if not exists completion_rule text;

-- R6 — Datos del formador. Las dos columnas son nullable y solo el
-- instructor las llena; los estudiantes mantienen estos campos vacíos.
alter table public.users
  add column if not exists credential text;
alter table public.users
  add column if not exists bio text;

-- Ampliar la vista pública para exponer credencial y trayectoria SIN tocar
-- datos sensibles (correo, rethus, etc.). La vista corre con privilegios del
-- owner (bypass de RLS users_own) y proyecta solo columnas seguras.
create or replace view public.instructors_public as
  select id, full_name, profession, credential, bio
  from public.users
  where role = 'instructor';

grant select on public.instructors_public to anon, authenticated;
