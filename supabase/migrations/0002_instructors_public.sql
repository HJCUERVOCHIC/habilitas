-- Slice 2: exponer públicamente datos seguros del instructor para el detalle
-- del curso (HABILITAS-ESPECIFICACION §5.3 RF-3.6). La tabla users solo permite
-- leer la propia fila (RLS users_own), por lo que el catálogo anónimo no puede
-- leer al instructor. Esta vista expone SOLO id, full_name y profession de los
-- instructores, sin datos sensibles (rethus, etc.).
create or replace view public.instructors_public as
  select id, full_name, profession
  from public.users
  where role = 'instructor';

-- La vista corre con los privilegios del owner (bypass de la RLS de users) y
-- solo proyecta columnas seguras. Concedemos lectura a anónimos y autenticados.
grant select on public.instructors_public to anon, authenticated;
