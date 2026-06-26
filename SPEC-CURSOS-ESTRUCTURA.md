# SPEC-CURSOS-ESTRUCTURA.md

**Bloque 1 — Gestión de cursos: estructura**

## Objetivo

Permitir que el administrador cree cursos y organice su estructura: módulos y, dentro de cada módulo, lecciones. El curso **nace como borrador**.

Este bloque cubre **solo la estructura**: metadatos del curso, jerarquía módulos → lecciones, orden y tipo de lección. El contenido y los medios de cada lección llegan en el **Bloque 2** (Contenido de lecciones); la evaluación en el **Bloque 3**; la publicación en el **Bloque 4**. Construye sobre el shell y las guardas del administrador del **Bloque 0** (`SPEC-ROLES-ACCESO.md`).

---

## §0 — Verificación previa (NO modificar todavía)

Antes de proponer o escribir cualquier cambio, inspeccionar el repositorio y el esquema reales y reportar hallazgos. No asumir nada:

1. **Esquema de cursos / módulos / lecciones**
   - Tabla de cursos: columnas, y el campo de estado de publicación con sus valores reales. El panel del admin muestra "4 borradores", así que la tabla y un estado ya existen: confirmar el nombre exacto del campo y los valores posibles.
   - ¿Existen ya tablas de **módulos** y **lecciones**? Si existen: columnas, relaciones (claves foráneas hacia el curso/módulo), mecanismo de **orden** (`orden`/`position`/`sort_order`?), y si hay un campo de **tipo de lección**.
   - Relación completa curso → módulos → lecciones.

2. **Rutas y UI del admin existentes**
   - Qué hacen hoy el botón **"Nuevo curso"** y la pantalla **"Gestionar cursos"**.
   - Si existe ya alguna pantalla de edición de curso, módulos o lecciones, aunque sea parcial.

3. **RLS / permisos**
   - Políticas de escritura (insert/update/delete) sobre cursos/módulos/lecciones para el rol administrador.

**Entregable de §0:** reporte breve de hallazgos. Si algo difiere de la §1, ajustar la propuesta antes de implementar y dejar constancia del ajuste.

---

## §1 — Propuesta de implementación (condicionada a §0)

> Usar las tablas y campos que ya existan; crear únicamente lo que falte, de forma aditiva.

### Datos

- **Curso** (metadatos mínimos): título, descripción y, opcional, un resumen corto para el catálogo. Estado = **borrador** por defecto. No tocar la lógica de publicación en este bloque.
- **Módulo**: pertenece a un curso; título, orden y, opcional, descripción breve.
- **Lección**: pertenece a un módulo; título, orden y **tipo de lección**. Tipo = enum `{ texto, video, pdf, diapositivas, imagen }`. Una lección **puede existir sin contenido** todavía.

### UI del administrador (dentro del shell del Bloque 0)

- **Listado de cursos** (reutilizar "Gestionar cursos"): ver cursos con su estado y entrar a editarlos.
- **Crear curso** ("Nuevo curso"): formulario de metadatos; al guardar, el curso nace como borrador y se abre su edición.
- **Editar curso**: editar metadatos y gestionar la estructura.
- **Módulos** dentro del curso: agregar, editar, reordenar y eliminar.
- **Lecciones** dentro de un módulo: agregar, editar, reordenar y eliminar; definir título y tipo.
- **Orden** explícito y persistente para módulos y lecciones, reflejado igual al volver a abrir.
- **Eliminar curso**: permitido solo para borradores y con confirmación. Preferir archivar / borrado lógico sobre el borrado físico donde el esquema lo permita.

### Restricciones de implementación

- Cambios **aditivos y reversibles** donde sea posible.
- Todas las pantallas viven bajo `/admin` y quedan protegidas por las guardas del Bloque 0 (un estudiante no accede).
- No introducir regresiones en el cumplimiento P0/P1.

---

## §2 — Criterios de aceptación

1. El admin puede crear un curso que nace como **borrador** y editar sus metadatos.
2. El admin puede agregar, editar, reordenar y eliminar **módulos** dentro de un curso.
3. El admin puede agregar, editar, reordenar y eliminar **lecciones** dentro de un módulo, con título y tipo.
4. El orden de módulos y lecciones se **persiste** y se refleja igual al reabrir el curso.
5. Una lección puede existir **sin contenido** (el contenido es el Bloque 2).
6. Un **estudiante** no puede acceder a estas pantallas.
7. **Eliminar curso** solo está disponible para borradores y pide confirmación.
8. El cumplimiento P0/P1 sigue intacto.

---

## §3 — Prompt de arranque

> Lee primero `CLAUDE.md` para el contexto de stack, decisiones de producto y reglas de desarrollo. Estás trabajando en el Bloque 1 (Gestión de cursos: estructura), descrito en `SPEC-CURSOS-ESTRUCTURA.md`. Asume que el Bloque 0 (`SPEC-ROLES-ACCESO.md`) ya está implementado: el shell y las guardas del administrador existen.
>
> Antes de modificar nada, ejecuta la verificación de la sección §0: inspecciona el esquema de cursos, módulos y lecciones (columnas, relaciones, campo de estado, mecanismo de orden, tipo de lección), las rutas y UI de admin existentes ("Nuevo curso", "Gestionar cursos") y las políticas RLS de escritura. Reporta tus hallazgos de forma concisa y, si algo difiere de la §1, propón el ajuste antes de continuar. No implementes todavía: espera mi visto bueno al reporte.
>
> Tras mi aprobación, implementa la §1 cumpliendo todos los criterios de la §2. Aplica cambios aditivos y reversibles donde sea posible, usa las tablas/campos reales que encuentres y no introduzcas regresiones en P0/P1.
