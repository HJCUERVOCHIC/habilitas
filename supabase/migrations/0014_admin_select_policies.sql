-- Hace simétrica la política admin_all que ya existe en public.courses sobre
-- el resto de tablas de contenido y de constancias. El service role sigue
-- bypaseando RLS (no cambia). El objetivo es que un cliente cookies-based,
-- autenticado como admin, también pueda leer/escribir todo — defensa en
-- profundidad para cuando SUPABASE_SERVICE_ROLE_KEY no esté disponible en
-- runtime (HMR de Next, deploys mal configurados).
--
-- Idempotente: drop policy if exists + create.

drop policy if exists "modules_admin_all" on public.modules;
create policy "modules_admin_all" on public.modules
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

drop policy if exists "lessons_admin_all" on public.lessons;
create policy "lessons_admin_all" on public.lessons
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

drop policy if exists "evaluations_admin_all" on public.evaluations;
create policy "evaluations_admin_all" on public.evaluations
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

drop policy if exists "questions_admin_all" on public.questions;
create policy "questions_admin_all" on public.questions
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

drop policy if exists "certificates_admin_all" on public.certificates;
create policy "certificates_admin_all" on public.certificates
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
