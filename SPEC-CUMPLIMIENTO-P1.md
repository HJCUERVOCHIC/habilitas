# SPEC-CUMPLIMIENTO-P1.md

**Fase:** 2 — Cumplimiento P1 (dentro de los vertical slices)
**Proyecto:** Habilitas — Next.js + Supabase + Cloudflare R2
**Origen:** `CUMPLIMIENTO-DECRETO-1075.md` (§3 R4–R9, §5 esquema, §6, §8) · Fases 0 y 1 ya implementadas
**Requisitos:** R4, R5, R6, R7, R8, R9.
**Estructura:** sub-slices ordenados (2a→2d), cada uno revisable por milestone de forma independiente.

> **Nota de scope.** Estas son las mejoras de transparencia que el decreto no exige en educación informal pero que se adoptan voluntariamente para *demostrar* seriedad (Art. 2.6.4.8 como referencia). No bloquean lanzamiento (eso era P0/Fase 1); elevan la calidad y defensa del cumplimiento.

---

## 0. Principio rector

Inspeccionar el código y el **esquema real** antes de modificar. Nombres de tablas (`courses`, `certificates`, `instructors`, `users`) son **propuestas a reconciliar**. SQL **idempotente** (re-ejecutable sin daño). Cambios no destructivos. Revisión por milestone: **no avanzar al siguiente sub-slice sin aprobar el anterior**.

---

## 1. Paso de descubrimiento (ejecutar y reportar antes de implementar)

1. **Esquema real.** Estructura de las tablas de cursos, certificados/constancias, usuarios e instructores (si existe). Columnas actuales, tipos y relaciones.
2. **Seed / contenido.** Cómo se cargan los cursos hoy (formato YAML + script de validación Node). Qué campos soporta el YAML actualmente. (Las columnas nuevas de R4 obligan a extender el formato y el seed.)
3. **Verificación post-Fase 1.** Qué muestra y qué campos tiene hoy la página de verificación (para no duplicar en R9).
4. **Artefacto.** Cómo se genera la constancia y qué datos incluye (para R7).
5. **Perfil y admin.** Rutas/componentes del perfil de usuario y del panel admin (para R7 y R8).

Entregar inventario y esperar visto bueno.

---

## 2. Migración de esquema (idempotente — reconciliar nombres reales)

Base en `CUMPLIMIENTO-DECRETO-1075.md` §5. Aplicar lo que falte; no recrear lo existente.

```sql
-- Metadatos del curso (R4, R5)
alter table public.courses add column if not exists duracion_horas    integer;
alter table public.courses add column if not exists objetivos         text;
alter table public.courses add column if not exists perfil_egreso     text;
alter table public.courses add column if not exists metodologia       text;
alter table public.courses add column if not exists nota_minima       integer;   -- p.ej. 70
alter table public.courses add column if not exists intentos_maximos  integer;   -- null = ilimitado
alter table public.courses add column if not exists regla_completitud text;      -- p.ej. "Video ≥ 90% + aprobar evaluación"

-- Formadores (R6)
create table if not exists public.instructors (
  id uuid primary key default gen_random_uuid(),
  nombre text not null, credencial text, trayectoria text,
  created_at timestamptz not null default now()
);
alter table public.courses add column if not exists instructor_id uuid references public.instructors(id);

-- Constancias / verificación (R7, R9)
alter table public.certificates add column if not exists verification_id text;
alter table public.certificates add column if not exists horas           integer;   -- copia inmutable al emitir
alter table public.certificates add column if not exists estado          text not null default 'valida' check (estado in ('valida','revocada'));
alter table public.certificates add column if not exists emitida_en      timestamptz not null default now();
alter table public.certificates add column if not exists revocada_en     timestamptz;
create unique index if not exists certificates_verification_id_key on public.certificates (verification_id);
```

RLS de verificación pública: exponer solo nombre, curso, horas, fecha, estado, modalidad (no `user_id`/correo). No datos personales en query strings.

---

## 3. Sub-slices

### Sub-slice 2a — Metadatos de curso + formador + reglas de evaluación (R4, R5, R6)
- Render en detalle de curso: duración en **horas**, objetivos, perfil de egreso, contenidos, metodología (R4).
- Sección visible "¿Cómo apruebo este curso?" antes de matricular: nota mínima, intentos, regla de completitud (video ≥ 90%), cómo se obtiene la constancia (R5). Coherente con feedback híbrido: se publican las **reglas**, no las respuestas.
- Perfil del formador en el detalle: nombre, credencial, trayectoria (R6).
- **Extender el YAML de cursos y su script de validación** para llevar estos campos; actualizar el seed del curso de duelo de forma idempotente.

### Sub-slice 2b — Horas en la constancia + acumulado (R7)
- Al emitir, copiar `duracion_horas` del curso a `certificates.horas` (copia inmutable).
- Mostrar "Duración: N horas" en el artefacto.
- Perfil del usuario: suma de horas de cursos finalizados.

### Sub-slice 2c — Exportación para inspección (R8)
- Panel admin: exportar (CSV) historial de constancias emitidas con `verification_id`, usuario, curso, horas, fecha, estado.
- Definir política de retención (documentarla, aunque sea breve).

### Sub-slice 2d — Endurecimiento anti-fraude de verificación (R9)
- `verification_id` único y no secuencial; fecha de emisión; estado **válida/revocada** en la página de verificación.
- Acción de **revocar** una constancia desde admin (set `estado='revocada'`, `revocada_en=now()`).
- Constancia revocada se muestra como "Revocada" en la verificación pública.

---

## 4. Criterios de aceptación (cierre del checklist P1, §8 del doc)

- [ ] R4 — Duración (horas), objetivos, perfil de egreso, contenidos y metodología publicados desde columnas propias.
- [ ] R5 — Reglas de evaluación/promoción visibles antes de matricular.
- [ ] R6 — Perfil del formador visible en el detalle.
- [ ] R7 — Horas en la constancia + acumulado en el perfil.
- [ ] R8 — Exportación de historial de constancias desde admin.
- [ ] R9 — ID único, fecha y estado (válida/revocada) en verificación; revocación desde admin.

---

## 5. Fuera de alcance

- RETHUS (PT-1) y mecanismo de acceso por correo (PT-2). Diferidos.
- **Fase 3 — Validación legal:** los textos de `lib/compliance.ts` (§4 del doc) deben ser revisados por abogado / Secretaría de Educación, y confirmarse la calificación como educación informal. Es el último ítem del gate de lanzamiento y **no es trabajo de software**.

---

## 6. Prompt de arranque para Claude Code

> Vamos a implementar la Fase 2 (Cumplimiento P1) descrita en `SPEC-CUMPLIMIENTO-P1.md`, por sub-slices y en orden (2a→2d). **No modifiques código ni esquema todavía.** Primero ejecuta el Paso de descubrimiento (§1): muéstrame el esquema real de cursos, constancias, usuarios e instructores; cómo se cargan los cursos por YAML y qué campos soporta; y qué tiene hoy la página de verificación tras la Fase 1. Con base en eso, reconcilia la migración del §2 con los nombres reales y propónme el plan del **sub-slice 2a** (metadatos de curso + formador + reglas de evaluación), incluyendo cómo extender el YAML y el seed de forma idempotente. Espera mi visto bueno antes de implementar. No avances a 2b hasta que apruebe 2a.
