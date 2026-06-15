-- QA: garantizar a nivel de DB que un intento aprobado emite UN solo certificado
-- (§6.4 idempotencia). El índice único permite múltiples NULL (certs sin intento)
-- pero impide dos certificados para el mismo eval_attempt_id.
create unique index if not exists certificates_eval_attempt_unique
  on public.certificates (eval_attempt_id)
  where eval_attempt_id is not null;
