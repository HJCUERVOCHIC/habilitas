-- Bloque 5 — Inscripciones, seguimiento y salvaguardas
-- (SPEC-INSCRIPCIONES-SEGUIMIENTO.md v1.1).
--
-- Estrictamente aditiva: nuevas tablas, columnas, políticas y un backfill de
-- snapshot para las constancias existentes. No se renombra ni se borra nada.
-- Idempotente: `if not exists`, `drop policy if exists` + `create`.

-- ============================================================
-- 1) attempt_unlocks — auditoría de desbloqueo manual (F8)
-- ============================================================
-- Cada fila representa **un intento adicional** concedido por un admin al
-- estudiante para una evaluación específica. `computeAttemptWindow` cuenta las
-- filas dentro de la ventana móvil de 24 h y las suma al `maxAttempts`
-- efectivo. Así el desbloqueo:
--   - no toca el historial de intentos previos (SPEC §1.4),
--   - deja rastro auditable (quién, a quién, cuándo, opcionalmente por qué),
--   - concede un intento — no restablece todos (§4.3).
create table if not exists public.attempt_unlocks (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references public.users(id) on delete cascade not null,
  evaluation_id uuid references public.evaluations(id) on delete cascade not null,
  granted_by    uuid references public.users(id) on delete set null,
  granted_at    timestamptz not null default now(),
  note          text
);

create index if not exists attempt_unlocks_user_eval_time
  on public.attempt_unlocks(user_id, evaluation_id, granted_at);

alter table public.attempt_unlocks enable row level security;

-- El estudiante lee sus propios unlocks (para que el cálculo de ventana
-- desde el cookies client también los vea).
drop policy if exists "attempt_unlocks_own_read" on public.attempt_unlocks;
create policy "attempt_unlocks_own_read" on public.attempt_unlocks
  for select using (auth.uid() = user_id);

-- Admin cookies-based: acceso total. El service role bypasea RLS de todas
-- formas, esta política es defensa en profundidad para HMR/deploys donde
-- SUPABASE_SERVICE_ROLE_KEY no esté disponible.
drop policy if exists "attempt_unlocks_admin_all" on public.attempt_unlocks;
create policy "attempt_unlocks_admin_all" on public.attempt_unlocks
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- 2) Snapshot del curso en la constancia (H5)
-- ============================================================
-- La constancia debe ser auditable con independencia de cambios posteriores en
-- el curso. Copiamos al propio registro el título, la nota mínima y la
-- estructura (módulos + lecciones con sus títulos y tipos) al momento de
-- emitir. La duración ya se guardaba (columna `duration_hours`, migración
-- 0007). La página pública `/verificar/[id]` renderiza desde el snapshot.
--
-- `snapshot_origin` distingue emisiones nuevas (`live`) de constancias legacy
-- rellenadas por el backfill de más abajo (`retroactive`): éstas se sabe que
-- se reconstruyeron con el estado actual, no con el del momento real de
-- emisión, y esa distinción vive en el dato.
alter table public.certificates
  add column if not exists course_title_snapshot text;
alter table public.certificates
  add column if not exists course_pass_score_snapshot integer;
alter table public.certificates
  add column if not exists course_structure_snapshot jsonb;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'certificates'
       and column_name = 'snapshot_origin'
  ) then
    alter table public.certificates
      add column snapshot_origin text default 'live'
        check (snapshot_origin in ('live', 'retroactive'));
  end if;
end$$;

-- ============================================================
-- 3) admin_all en tablas de personas
-- ============================================================
-- Las políticas base son `enrollments_own`, `progress_own`, `attempts_own` —
-- pensadas para el estudiante. Un admin cookies-based no las lee. Agregamos
-- admin_all como en modules/lessons/evaluations/questions/certificates
-- (migración 0014).
drop policy if exists "enrollments_admin_all" on public.enrollments;
create policy "enrollments_admin_all" on public.enrollments
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

drop policy if exists "lesson_progress_admin_all" on public.lesson_progress;
create policy "lesson_progress_admin_all" on public.lesson_progress
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

drop policy if exists "eval_attempts_admin_all" on public.eval_attempts;
create policy "eval_attempts_admin_all" on public.eval_attempts
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- 4) Backfill retroactivo del snapshot
-- ============================================================
-- Constancias existentes se rellenan con el estado actual del curso y quedan
-- marcadas como `retroactive`. Se pobla también para las revocadas: la
-- verificación pública sigue mostrando qué se acredita/revocó.
update public.certificates c
   set course_title_snapshot = co.title,
       course_pass_score_snapshot = co.pass_score,
       course_structure_snapshot = coalesce(
         (
           select jsonb_agg(
                    jsonb_build_object(
                      'title', m.title,
                      'lessons', coalesce(
                        (
                          select jsonb_agg(
                                   jsonb_build_object(
                                     'title', l.title,
                                     'content_type', l.content_type
                                   )
                                   order by l.order_index
                                 )
                            from public.lessons l
                           where l.module_id = m.id
                        ),
                        '[]'::jsonb
                      )
                    )
                    order by m.order_index
                  )
             from public.modules m
            where m.course_id = co.id
         ),
         '[]'::jsonb
       ),
       snapshot_origin = 'retroactive'
  from public.courses co
 where c.course_id = co.id
   and c.course_title_snapshot is null;
