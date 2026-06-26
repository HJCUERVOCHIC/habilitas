-- Bloque 0 — Roles y acceso (SPEC-ROLES-ACCESO.md §1).
-- Retira el rol `instructor` del modelo. La plataforma queda con dos roles:
-- `student` (default del trigger on_auth_user_created) y `admin` (asignado
-- manualmente con npm run admin:grant).
--
-- La data del usuario que hoy es instructor se conserva (credential, bio,
-- nombre, profesión, courses.instructor_id). Solo cambia su rol a student.
-- La noción de "instructor de un curso" pasa a ser atributo de contenido
-- (referenciado por courses.instructor_id), no un rol del sistema.
--
-- Idempotente: el update no afecta filas ya migradas; drop constraint if
-- exists + add constraint vuelve a crearlo en cada corrida; create or
-- replace view sobrescribe.

update public.users set role = 'student' where role = 'instructor';

alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role in ('student', 'admin'));

-- Antes la vista filtraba por role='instructor'. Ahora proyecta a quienes
-- estén referenciados como instructor de algún curso publicado o no.
-- Mantiene los mismos campos seguros (sin correo ni rethus) y los grants.
create or replace view public.instructors_public as
  select u.id, u.full_name, u.profession, u.credential, u.bio
  from public.users u
  where u.id in (
    select instructor_id from public.courses where instructor_id is not null
  );

grant select on public.instructors_public to anon, authenticated;
