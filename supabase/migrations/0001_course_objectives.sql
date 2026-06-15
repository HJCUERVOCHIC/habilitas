-- Slice 2: objetivos de aprendizaje del curso (HABILITAS-ESPECIFICACION §5.3 RF-3.3).
-- El schema base (§7) no incluía este campo; se agrega para "Lo que certificarás".
alter table public.courses
  add column if not exists learning_objectives text[] not null default '{}';
