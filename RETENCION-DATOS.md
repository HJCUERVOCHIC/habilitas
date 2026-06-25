# Política de retención de datos — Habilitas

**Estado:** borrador técnico (Fase 2 · sub-slice 2c). Cubre R8 de `CUMPLIMIENTO-DECRETO-1075.md`. Pendiente de revisión legal antes del lanzamiento.

Esta política describe cuánto tiempo se conservan los datos personales y de actividad en la plataforma, y bajo qué criterios se eliminan o anonimizan. Aplica a Habilitas Colombia y se complementa con la política de privacidad pública (a redactar).

## 1. Datos cubiertos

| Categoría | Tablas / fuente | Sensibilidad |
|---|---|---|
| Cuenta de usuario | `public.users`, `auth.users` | Personal (correo, nombre, profesión, ciudad) |
| Constancias emitidas | `public.certificates` | Snapshot inmutable (nombre, profesión, instructor, puntaje, fechas) |
| Intentos de evaluación | `public.eval_attempts` | Personal vinculable (respuestas, puntaje) |
| Progreso de lecciones | `public.lesson_progress` | Personal vinculable (posición de video, tiempos) |
| Inscripciones | `public.enrollments` | Personal vinculable |
| Logs de aplicación / auditoría | logs de Vercel y Supabase | Operacional |
| Archivos de curso | Cloudflare R2 | No personales (contenido instruccional) |

## 2. Plazos de retención

| Categoría | Plazo | Razón |
|---|---|---|
| **Cuenta de usuario activa** | Mientras la cuenta exista | El usuario controla sus datos vía `/perfil`. |
| **Cuenta eliminada a solicitud** | Eliminación inmediata de `public.users` y `auth.users`; los snapshots en `certificates` se anonimizan (nombre del profesional → "Profesional retirado"). | Equilibrio entre derecho al olvido y verificación pública de constancias previamente emitidas. |
| **Constancias emitidas** | Indefinida | La verificación pública por `cert_id` y QR debe seguir funcionando. Una constancia revocada permanece consultable como tal (estado `revoked`). |
| **Intentos de evaluación** | 5 años desde el intento | Trazabilidad de aprobación; útil para auditorías o disputas. Posterior al plazo se eliminan en bloque. |
| **Progreso de lecciones** | Mientras la cuenta esté activa + 2 años | Suficiente para que el usuario retome cursos pausados y para informes agregados. |
| **Inscripciones** | Mientras la cuenta esté activa + 2 años | Igual razón que progreso. |
| **Logs de aplicación / auditoría** | 1 año | Suficiente para investigación de incidentes y soporte. |
| **Snapshot del profesional en constancia** | Inmutable | Forma parte del documento de educación informal; no se reescribe aunque el perfil cambie. |

## 3. Operaciones

- **Eliminación a solicitud**: el usuario escribe a `soporte@habilitas.co` desde su cuenta o desde el correo asociado. El equipo responde en ≤ 10 días hábiles ejecutando los pasos descritos arriba.
- **Anonimización de constancias**: tarea manual hasta sub-slice posterior. Se reemplaza `professional_name` por `"Profesional retirado"` y se nulifica `professional_profession` en las filas de `certificates` del usuario eliminado. `cert_id` y resto del snapshot (curso, instructor, fechas, score) se conservan.
- **Purga periódica**: trimestral. Eliminar `eval_attempts` y `lesson_progress` que excedan su plazo. La purga se documenta como tarea operativa hasta automatizarse.
- **Exportación para inspección**: ver `/admin/certificados/export` (CSV con `cert_id`, usuario, curso, horas, puntaje, fechas y estado — sin `user_id` ni correo).

## 4. Excepciones legales

La plataforma puede conservar datos más allá de los plazos definidos cuando:
- Exista una obligación legal vigente (ej. requerimiento de autoridad competente).
- Esté en curso una disputa o investigación.
- El usuario haya consentido expresamente a una retención extendida (ej. estudios longitudinales).

## 5. Cambios a esta política

Cualquier modificación queda registrada en el historial git de este archivo y se comunica a los usuarios con cuenta activa con al menos 30 días de anticipación.
