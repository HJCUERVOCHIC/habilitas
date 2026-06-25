-- Sub-slice 2b (SPEC-CUMPLIMIENTO-P1 §3 R7).
-- Snapshot inmutable de la duración del curso al momento de emisión de la
-- constancia. Tipo y nombre espejan courses.duration_hours; nullable para
-- tolerar constancias legacy emitidas antes de esta migración (no se
-- rellenan retroactivamente: violaría la inmutabilidad del snapshot).
--
-- La RPC get_certificate devuelve certificates.* — esta columna queda
-- expuesta automáticamente en la verificación pública.

alter table public.certificates
  add column if not exists duration_hours numeric(4,1);
