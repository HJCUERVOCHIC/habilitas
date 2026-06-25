-- Sub-slice 2d (SPEC-CUMPLIMIENTO-P1 §3 R9).
-- Token opaco para verificación pública, no enumerable. El cert_id legible
-- (HAB-YYYY-NNNN) se conserva para soporte y artefacto; las URLs públicas
-- usan verification_id en emisiones nuevas.
--
-- Backfill conservador: constancias legacy comparten valor con cert_id; sus
-- URLs y QRs ya emitidos siguen funcionando vía el lookup ampliado del RPC.

alter table public.certificates
  add column if not exists verification_id text;

update public.certificates
   set verification_id = cert_id
 where verification_id is null;

create unique index if not exists certificates_verification_id_key
  on public.certificates (verification_id);

-- RPC ampliado: acepta verification_id (nuevo) o cert_id (legacy).
-- Mantiene security definer y la firma para no romper el cliente.
-- En la práctica los espacios de valores no colisionan (UUID v4 vs HAB-...),
-- pero ordenar por issued_at desc es defensa en profundidad.
create or replace function public.get_certificate(p_cert_id text)
returns public.certificates
language sql
security definer
set search_path = public
as $$
  select * from public.certificates
   where verification_id = p_cert_id
      or cert_id = p_cert_id
   order by issued_at desc
   limit 1;
$$;
