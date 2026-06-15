-- Slice 4: fijar el sorteo de preguntas de cada intento (D4) para poder puntuar
-- con integridad en el servidor. El schema base no guardaba qué preguntas se
-- sortearon; sin esto no se puede calcular el puntaje del intento de forma fiable.
alter table public.eval_attempts
  add column if not exists question_ids uuid[] not null default '{}';
