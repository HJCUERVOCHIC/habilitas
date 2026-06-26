-- Bloque 3 — Evaluación: banco de preguntas (SPEC-EVALUACION-BANCO §1).
-- Mueve el número de preguntas por intento de una constante en código
-- (QUESTIONS_PER_ATTEMPT = 10) a un campo configurable por curso. La nota
-- mínima ya vive en courses.pass_score; no se duplica.
--
-- Idempotente: add column if not exists; check no destructivo.

alter table public.evaluations
  add column if not exists questions_per_attempt integer not null default 10;

-- El número debe ser ≥ 1 (no tiene sentido sortear cero preguntas).
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'evaluations_questions_per_attempt_positive'
  ) then
    alter table public.evaluations
      add constraint evaluations_questions_per_attempt_positive
      check (questions_per_attempt >= 1);
  end if;
end$$;
