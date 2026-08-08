# SPEC-ESTUDIANTES-CLASIFICACION.md

**Bloque 6 del rol administrador — Índice de estudiantes, clasificación de cursos y búsqueda**

v1.0 · 07-ago-2026

---

## Contexto

El Bloque 5 entregó la vista de inscritos **por curso** y la ficha individual del estudiante. Falta la entrada natural a esa ficha: un **índice de todos los estudiantes** con los cursos que han tomado o están tomando. Hoy solo se llega a una ficha entrando primero a un curso concreto, lo que impide responder preguntas como *"¿qué ha hecho esta persona que me escribió a soporte?"*.

En paralelo, el catálogo público ya filtra por **categoría** y muestra **nivel** (verificado el 07-ago: pestañas "Todas / Procedimientos clínicos / Enfermería", etiquetas por curso y "10 h · Básico"). Pero no hay ninguna pantalla de administración para crear o editar categorías, ni para asignar categoría y nivel a un curso. Esos datos probablemente entraron por el importador YAML.

Y el listado de cursos en admin es plano, sin búsqueda ni filtros (B7 del inventario), lo que se vuelve inmanejable a partir de ~20 cursos.

Los tres son **superficies de lectura y administración sobre datos que en buena parte ya existen**. No es funcionalidad nueva de dominio.

### Advertencia legal sobre la taxonomía

Una de las categorías actuales se llama **"Enfermería"** — nombra una profesión, no un tema. Bajo educación informal (Decreto 1075, Art. 2.6.6.8) no se puede prometer aptitud ocupacional, y una taxonomía por profesión admite esa lectura. Las etiquetas deben describir el **contenido** ("cuidados paliativos", "salud mental", "procedimientos clínicos"), no la credencial ni el gremio destinatario.

Corregirlo ahora es barato; después estará en cursos publicados e inmutables.

---

## §0 — Verificación previa

1. **Esquema de clasificación.** ¿Existe una tabla `categories` o la categoría es una columna de texto en `courses`? ¿El nivel es enum, texto libre o entero? Reporta columnas y tipos reales.

2. **Origen de los datos actuales.** ¿Cómo llegaron categoría y nivel a los dos cursos existentes: por el importador YAML, por migración, o a mano? Revisa el esquema YAML del importador.

3. **Cómo filtra el catálogo público.** Dónde se resuelven las pestañas de `/certificaciones` y de dónde salen las etiquetas de cada tarjeta.

4. **Formulario de curso en admin.** Qué campos edita hoy (crear y editar), y si contempla categoría, nivel o `duration_min`.

5. **Ficha de estudiante.** Estructura de `/admin/estudiantes/[userId]` y qué helpers de `enrollments-admin.ts` usa. El índice debe reutilizarlos, no duplicar consultas.

6. **Consulta agregada viable.** Confirma que se puede obtener, para todos los estudiantes en una sola consulta agregada: número de inscripciones, número de cursos completados, número de constancias vigentes y última actividad. Sin N+1.

7. **`duration_min` de lección.** La auditoría (D3) reportó que se muestra en el listado pero **no hay input** en `ModulesManager` ni en `LessonEditor`. Confirma dónde se muestra y si algún flujo lo escribe.

8. **Navegación admin.** Dónde vive el enlace "Nuevo curso" del Panel y a dónde apunta hoy.

9. **Políticas RLS** sobre `users` y `enrollments` para el índice de estudiantes: qué lee el admin y si `createAdminClient` las evade.

Si algún hallazgo entra en conflicto con la §1, propón el ajuste antes de continuar.

---

## §1 — Implementación

### 1. Índice de estudiantes (`/admin/estudiantes`)

Nueva pantalla, enlazada desde la navegación principal del panel.

Por cada persona:

- Nombre y correo.
- Profesión y ciudad, si están declaradas.
- Número de cursos en los que está inscrita.
- Número de cursos completados (progreso al 100%).
- Número de constancias vigentes.
- Última actividad registrada.

Requisitos:

- **Búsqueda** por nombre o correo, con coincidencia parcial e insensible a mayúsculas y acentos.
- **Ordenable** por última actividad y por número de inscripciones.
- Cada fila enlaza a la ficha existente `/admin/estudiantes/[userId]`.
- Agregados calculados **en servidor con una consulta agregada**, no N+1 por estudiante.
- Paginación o límite razonable: la lista crece con el negocio.
- **Sin exportación.** Ver §1.5.

### 2. Administración de categorías

CRUD de categorías desde el panel:

- Crear, renombrar y eliminar categorías.
- **No** se puede eliminar una categoría con cursos asignados: el action lo rechaza indicando cuántos cursos la usan y sugiriendo reasignarlos primero.
- Orden de presentación configurable, o alfabético si se prefiere no añadir complejidad.

Si la §0 revela que la categoría es hoy una columna de texto libre en `courses`, la migración debe crear la tabla `categories`, poblarla con los valores distintos existentes, y añadir la clave foránea — todo aditivo, conservando la columna original hasta confirmar la migración de datos.

### 3. Clasificación desde el formulario de curso

En crear y editar curso:

- **Categoría**: selector alimentado por la tabla de categorías.
- **Nivel**: conjunto fijo — básico, intermedio, avanzado. No administrable; son tres y no cambian.
- **Intensidad horaria**: ya existe y se muestra en la constancia; verificar que sea editable.

Los cursos existentes sin clasificar deben quedar en un estado válido: categoría nullable o una categoría "Sin clasificar" creada por la migración.

**Recordatorio:** estos campos son metadatos comerciales, no contenido. La política de inmutabilidad del Bloque 5 bloquea contenido de cursos publicados; **decidir explícitamente** si categoría y nivel entran en ese bloqueo. Propuesta: no bloquearlos, porque no alteran lo que el estudiante estudia (ver §4.4).

### 4. Búsqueda y filtros en el listado de cursos (B7)

En `/admin/cursos`:

- Búsqueda por título.
- Filtro por estado: borrador · publicado · archivado.
- Filtro por categoría y por nivel.
- Los filtros se combinan.

### 5. Datos personales en el índice (Ley 1581)

El índice de estudiantes reúne en una sola pantalla a todos los profesionales registrados. Decisiones fijadas:

- **Minimización.** Nombre, correo, profesión y ciudad. **No** exponer documento de identidad ni número RETHUS.
- **Sin exportación masiva.** Coherente con el criterio ya presente en la exportación de constancias (H8), que omite correo y `user_id`.
- **Sin acciones destructivas** desde el índice. No se elimina ni edita al estudiante desde aquí.
- **Propósito:** acompañamiento pedagógico y soporte, no perfilado comercial.

### 6. Campo de duración por lección (D3)

Añadir input de `duration_min` en el editor de lección. Hoy el valor se muestra pero no se puede establecer, lo que deja el dato congelado en lo que trajera la importación.

Sujeto a la política de inmutabilidad: bloqueado si el curso está publicado.

### 7. Corrección de navegación menor

El botón **"Nuevo curso"** del Panel lleva hoy directamente al formulario. Debe llevar a `/admin/cursos` (el listado); el botón **dentro** del listado sigue abriendo el formulario.

### Restricciones

- Cambios aditivos y reversibles. Migraciones de esquema **solo aditivas** (columnas y tablas nuevas; nunca borrado ni renombrado de columnas existentes).
- Toda mutación nueva invalida rutas con los helpers de `src/lib/revalidate-admin.ts`, y debe quedar cubierta por el test guardián de rutas.
- Para lookups de un solo valor, selects de columnas directas encadenados, **no** recursos embebidos de PostgREST.
- No tocar `src/lib/r2.ts`.
- No retirar el tratamiento anti-caché de `/admin/cursos/[slug]`.
- No introducir regresiones en P0/P1 ni en la nomenclatura "constancia de finalización".
- Respetar la exclusividad de roles: ninguna pantalla nueva accesible por un estudiante.

---

## §2 — Criterios de aceptación

**Índice de estudiantes**
1. `/admin/estudiantes` lista a todas las personas con rol estudiante.
2. Cada fila muestra cursos inscritos, completados, constancias vigentes y última actividad.
3. La búsqueda por nombre o correo funciona con coincidencia parcial e insensible a mayúsculas y acentos.
4. La lista se ordena por última actividad y por número de inscripciones.
5. Cada fila enlaza a la ficha individual correspondiente.
6. Los agregados se calculan en servidor sin consultas N+1.
7. No hay opción de exportar ni de eliminar desde el índice.
8. No se muestra documento de identidad ni número RETHUS.

**Categorías**
9. Se puede crear, renombrar y eliminar una categoría desde el panel.
10. Eliminar una categoría con cursos asignados se rechaza indicando cuántos la usan.
11. Los cursos existentes conservan su clasificación tras la migración.

**Clasificación de cursos**
12. El formulario de curso permite asignar categoría y nivel.
13. El nivel se elige de un conjunto fijo de tres valores.
14. Un curso sin categoría queda en estado válido y no rompe el catálogo público.
15. El catálogo público sigue filtrando correctamente tras los cambios.

**Búsqueda en el listado de cursos**
16. La búsqueda por título filtra el listado.
17. Los filtros por estado, categoría y nivel funcionan y se combinan.

**Duración de lección**
18. El editor de lección permite establecer `duration_min`.
19. El campo queda bloqueado si el curso está publicado.

**Navegación**
20. "Nuevo curso" en el Panel lleva a `/admin/cursos`.

**Transversales**
21. Un estudiante no accede a ninguna pantalla nueva.
22. Las mutaciones nuevas invalidan sus rutas y pasan el test guardián.
23. Los cuatro gates locales en verde: `type-check`, `lint`, `test`, `build`.

---

## §3 — Prompt de arranque

> Lee primero `CLAUDE.md` para el contexto de stack, decisiones de producto y reglas de desarrollo. Vas a implementar el Bloque 6 del rol administrador, descrito en `SPEC-ESTUDIANTES-CLASIFICACION.md`, con `INVENTARIO-ROL-ADMIN.md` como referencia del estado actual.
>
> Antes de modificar nada, ejecuta la verificación de la §0: determina si la clasificación de cursos vive en una tabla `categories` o en columnas de texto; de dónde salieron los datos de los dos cursos existentes; cómo filtra hoy el catálogo público; qué campos edita el formulario de curso; la estructura de `/admin/estudiantes/[userId]` y los helpers de `enrollments-admin.ts` que reutilizarás; si es viable una consulta agregada sin N+1 para el índice; dónde se muestra y quién escribe `duration_min`; a dónde apunta el botón "Nuevo curso"; y las políticas RLS sobre `users` y `enrollments`. Reporta los hallazgos de forma concisa.
>
> Si son compatibles con la §1, implementa directamente cumpliendo todos los criterios de la §2, sin pedir aprobación intermedia. Detente y consúltame solo si encuentras algo que entre en conflicto con la §1 — en particular, si la clasificación actual exigiera una migración no aditiva, o si el índice de estudiantes no pudiera resolverse sin N+1 dado el esquema real.
>
> Reglas: cambios aditivos y reversibles; migraciones de esquema solo aditivas; toda mutación nueva invalida rutas con los helpers de `src/lib/revalidate-admin.ts` y debe pasar el test guardián de rutas; para lookups de un solo valor usa selects de columnas directas encadenados, no embeds de PostgREST; no toques `src/lib/r2.ts`; no retires el tratamiento anti-caché de `/admin/cursos/[slug]`; no introduzcas regresiones en P0/P1 ni en la nomenclatura "constancia de finalización". Al terminar, corre `type-check`, `lint`, `test` y `build` y confirma que los cuatro salen en verde.

---

## §4 — Decisiones de producto (fijadas)

1. **Categorías administrables, niveles fijos.** Las categorías crecen con el catálogo temático y necesitan CRUD; los niveles son tres y no cambian.
2. **Una categoría por curso.** El catálogo muestra una etiqueta por tarjeta. Múltiples categorías complicarían el filtro sin beneficio claro con el volumen actual.
3. **Sin exportación del índice de estudiantes.** Alineado con el criterio de H8.
4. **Categoría y nivel NO se bloquean en cursos publicados.** Son metadatos de descubrimiento, no contenido: cambiarlos no altera lo que el estudiante estudia. La intensidad horaria **sí** se bloquea, porque aparece en la constancia.
5. **Taxonomía por tema, no por profesión.** Renombrar "Enfermería" por una etiqueta de contenido antes de que haya más cursos publicados.

---

## §5 — Verificación manual

Con dev server limpio y sin recargas forzadas:

1. Abrir `/admin/estudiantes`: deben aparecer los estudiantes registrados con sus agregados.
2. Buscar por nombre parcial y por correo parcial.
3. Ordenar por última actividad.
4. Entrar a una ficha desde el índice y volver.
5. Crear una categoría nueva desde el panel.
6. Intentar eliminar una categoría con cursos asignados: debe rechazarse con el conteo.
7. Asignar categoría y nivel a un curso en borrador desde el formulario.
8. Comprobar en `/certificaciones` que el filtro público refleja el cambio.
9. Buscar un curso por título en `/admin/cursos` y combinar filtros de estado y categoría.
10. Establecer `duration_min` en una lección de un curso en borrador; verificar que queda bloqueado al publicar.
11. Pulsar "Nuevo curso" en el Panel: debe llevar al listado.
12. Entrar como estudiante e intentar `/admin/estudiantes`: debe rechazar.

---

## §6 — Pendientes NO incluidos en este bloque

Se dejan fuera deliberadamente, con su destino:

**Spec de cumplimiento (siguiente prioridad)**
- **G3** — validación de rango de intensidad horaria (< 160 h). Hoy ni el checklist ni el formulario la validan.
- **M5** — tests de regresión legal. Hoy se podría eliminar el `<ComplianceNotice>` o cambiar "constancia" por "certificado" y CI seguiría en verde.
- **Campo "Instructor validador"** vacío en la constancia: decidir si se firma con un responsable identificable o si el campo desaparece.

De cara a la validación de la Fase 3, este spec pesa más que cualquier funcionalidad nueva.

**Bloque de pagos (área K)**
Registro de pagos, estado de pago por inscripción, precios, conciliación y reembolsos. Dominio propio, con integración externa y consideraciones fiscales colombianas. Bloquea la monetización completa.

**Bloque de auditoría y operación (área L, A7, E9, H7)**
- Registro de quién modificó qué y cuándo.
- Gestión de cuentas admin desde la UI (hoy es un `UPDATE` manual en SQL).
- Limpieza de objetos huérfanos en R2 al borrar lección o curso.
- Reemisión de constancias.

**Calidad de vida (por goteo)**
- **C8** mover lección entre módulos · **D4** transcripción de lección · **D5** aviso de cambios sin guardar · **F9** análisis de ítems · **I5** exportar curso a YAML.

**Configuración de infraestructura (fuera de código)**
- SMTP propio de Resend en Supabase Auth: hoy los Magic Links pueden usar el servicio integrado, con límites bajos y entrega diferida.
- Origen apex en el CORS de R2, cuando se limpie el Website Builder de GoDaddy.
- Revisar las tres cuentas admin y las cuentas de dominios ajenos mezcladas con los datos.
