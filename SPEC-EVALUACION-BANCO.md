# SPEC-EVALUACION-BANCO.md

**Bloque 3 — Evaluación: banco de preguntas**

## Objetivo

Permitir que el administrador construya y gestione, para cada curso, el **banco de preguntas** y la **configuración de la evaluación**:

- Crear, editar y eliminar preguntas con sus opciones, marcando la(s) correcta(s).
- Agregar, opcional, una **explicación** por pregunta (pensada para la revisión que ve el estudiante **solo tras aprobar**).
- Configurar **cuántas preguntas se sortean por intento** y la **nota mínima de aprobación**.

El curso permanece en **borrador**. La publicación es el **Bloque 4**.

**Fuera de alcance de este bloque** (es del reproductor del estudiante, otra etapa): el sorteo de preguntas en cada intento, el temporizador, la ausencia de retroalimentación durante el intento, la revisión posterior y los reintentos con preguntas distintas. Aquí solo se **autoriza y almacena** el banco y su configuración.

Construye sobre los Bloques 0, 1 y 2.

---

## §0 — Verificación previa

Inspeccionar el esquema y el repositorio reales y reportar hallazgos. No asumir nada:

1. **Esquema de evaluación**
   - ¿Existen tablas de **preguntas** y **opciones**? Si existen: columnas, relación con el curso, y cómo se marca la opción correcta.
   - ¿Existe **configuración de evaluación** a nivel de curso (número de preguntas por intento, nota mínima)? ¿En la tabla de cursos o en una tabla aparte? ¿Qué falta?

2. **UI de admin existente**
   - ¿Hay alguna pantalla de evaluación o de preguntas en el panel, aunque sea parcial?

3. **RLS / permisos**
   - Políticas de escritura sobre preguntas/opciones/configuración para el rol administrador.

**Entregable de §0:** reporte breve. Si algo difiere de la §1, proponerlo antes de implementar.

---

## §1 — Propuesta de implementación (condicionada a §0)

> Usar el esquema que ya exista; crear solo lo que falte, de forma aditiva.

### Datos

- **Pregunta**: pertenece a un curso; enunciado; explicación opcional (para la revisión post-aprobación).
- **Opción**: pertenece a una pregunta; texto; marca de correcta. Regla: cada pregunta exige **≥ 2 opciones** y **≥ 1 correcta**.
- **Configuración de evaluación del curso**:
  - `preguntas_por_intento` (por defecto **10**).
  - `nota_minima` de aprobación (configurable; valor por defecto razonable, p. ej. **70%**, a confirmar).

### UI del administrador (dentro de la edición del curso, en el shell del Bloque 0)

- Sección **"Evaluación"** del curso con la lista de preguntas del banco.
- **Crear / editar / eliminar** pregunta: enunciado, opciones (agregar/quitar, marcar la correcta) y explicación opcional.
- **Configuración**: editar `preguntas_por_intento` y `nota_minima`.
- **Indicador de validez del banco**: mostrar si el banco cumple el mínimo para poder publicar más adelante — al menos **15–20 preguntas** y, como mínimo, tantas como `preguntas_por_intento`.

### Restricciones de implementación

- **No** implementar la lógica de intentos del estudiante (queda fuera de alcance, ver arriba).
- Cambios **aditivos y reversibles** donde sea posible.
- Pantallas bajo `/admin`, protegidas por las guardas del Bloque 0.
- El curso permanece en **borrador**.
- No introducir regresiones en P0/P1.

---

## §2 — Criterios de aceptación

1. El admin puede **crear, editar y eliminar** preguntas del banco de un curso, cada una con enunciado y opciones.
2. El admin puede **marcar la(s) opción(es) correcta(s)**; el sistema **valida** ≥ 2 opciones y ≥ 1 correcta por pregunta.
3. El admin puede agregar una **explicación opcional** por pregunta.
4. El admin puede configurar **`preguntas_por_intento`** y **`nota_minima`**.
5. La UI **indica** si el banco cumple el mínimo para publicación (≥ 15–20 preguntas y ≥ `preguntas_por_intento`).
6. La lógica de **intentos del estudiante NO** se implementa en este bloque.
7. Un **estudiante** no puede acceder a estas pantallas.
8. El cumplimiento P0/P1 sigue intacto.

---

## §3 — Prompt de arranque (formato único)

> Lee primero `CLAUDE.md` para el contexto de stack, decisiones de producto y reglas de desarrollo. Estás trabajando en el Bloque 3 (Evaluación: banco de preguntas), descrito en `SPEC-EVALUACION-BANCO.md`. Asume que los Bloques 0, 1 y 2 ya están implementados.
>
> Primero ejecuta la verificación de la sección §0: revisa el esquema de preguntas, opciones y configuración de evaluación (relación con el curso, cómo se marca la correcta, dónde vive la configuración), la UI de evaluación existente y las políticas RLS. Reporta brevemente los hallazgos.
>
> Si los hallazgos son compatibles con la §1, continúa directamente con la implementación de la §1 cumpliendo todos los criterios de la §2, sin detenerte a pedir aprobación. Detente y consúltame solo si encuentras algo que entre en conflicto con la §1.
>
> Recuerda el límite de alcance: **no** implementes la mecánica de intentos del estudiante (sorteo, temporizador, revisión, reintentos); este bloque solo gestiona y almacena el banco y su configuración.
>
> Reglas: cambios aditivos y reversibles donde sea posible, usa el esquema real que encuentres, y no introduzcas regresiones en P0/P1.
