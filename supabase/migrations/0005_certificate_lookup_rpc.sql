-- QA hardening: reemplazar la lectura pública abierta de certificates por una
-- consulta acotada a "uno por cert_id". Antes, certs_public_verify (using true)
-- permitía enumerar TODA la tabla (nombres, profesión, puntajes). Ahora la
-- verificación pública pasa por una función security definer que devuelve solo
-- el certificado solicitado. Las políticas certs_own_read (perfil) y el acceso
-- admin por service role siguen intactos.

drop policy if exists "certs_public_verify" on public.certificates;

create or replace function public.get_certificate(p_cert_id text)
returns public.certificates
language sql
security definer
set search_path = public
as $$
  select * from public.certificates where cert_id = p_cert_id;
$$;

-- Lectura pública SOLO vía esta función (no la tabla completa).
grant execute on function public.get_certificate(text) to anon, authenticated;
