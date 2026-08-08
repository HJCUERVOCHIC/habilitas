-- Evaluaciones formativas por módulo (SPEC-PRACTICA-POR-MODULO.md).
-- Estrictamente aditiva: columna nueva en `questions`, tabla nueva
-- `practice_attempts`, políticas RLS. La evaluación final NO cambia en nada.
--
-- Idempotente: `if not exists`, `drop policy if exists` + `create`.

-- ============================================================
-- 1) Etiqueta de módulo en las preguntas (§1.1)
-- ============================================================
-- `module_id` nullable: `null` significa "sin etiquetar" y solo entra en la
-- evaluación final. La FK garantiza integridad; la validación de "mismo
-- curso" (una pregunta no puede etiquetarse con un módulo de otro curso)
-- vive en el server action (SPEC-PRACTICA-POR-MODULO §1.1) porque una
-- constraint SQL cross-tabla que compare `questions.evaluation.course_id`
-- vs `modules.course_id` es innecesariamente compleja.
--
-- `on delete set null`: si se elimina el módulo, la pregunta pasa a "sin
-- etiquetar" — sigue viva en la evaluación final. Coherente con la política
-- de inmutabilidad del Bloque 5 (etiquetar es editar el banco), pero robusto
-- ante deletes en cursos en borrador.
alter table public.questions
  add column if not exists module_id uuid
    references public.modules(id) on delete set null;

create index if not exists questions_module_id_idx
  on public.questions(module_id);

-- ============================================================
-- 2) Tabla `practice_attempts` — separada de `eval_attempts` (§1.2)
-- ============================================================
-- Diseño clave: NO discriminador dentro de `eval_attempts`. La razón está en
-- la spec §1.2: `computeAttemptWindow` cuenta filas de `eval_attempts` para
-- decidir el bloqueo de 24 h de la evaluación final. Con una tabla aparte,
-- un olvido de filtro es imposible por construcción — no puede contaminar
-- el conteo de intentos de la final.
--
-- Sin respuestas individuales por ahora (§1.2): el registro sirve al
-- análisis de ítems futuro (F9 del inventario), no a la auditoría de la
-- persona.
create table if not exists public.practice_attempts (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references public.users(id) on delete cascade not null,
  course_id       uuid references public.courses(id) on delete cascade not null,
  module_id       uuid references public.modules(id) on delete cascade not null,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  total_questions integer not null default 0,
  correct_count   integer not null default 0
);

create index if not exists practice_attempts_user_course_module
  on public.practice_attempts(user_id, course_id, module_id, started_at);

alter table public.practice_attempts enable row level security;

-- El estudiante lee y escribe lo suyo (§1.2 + §2 CA-20).
drop policy if exists "practice_attempts_own" on public.practice_attempts;
create policy "practice_attempts_own" on public.practice_attempts
  for all using (auth.uid() = user_id);

-- El admin lee todo — para reportes agregados a futuro. El service role
-- bypasea igual; esta política es defensa en profundidad.
drop policy if exists "practice_attempts_admin_read" on public.practice_attempts;
create policy "practice_attempts_admin_read" on public.practice_attempts
  for select using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
