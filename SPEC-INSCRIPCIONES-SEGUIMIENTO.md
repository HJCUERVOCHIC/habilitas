# SPEC-INSCRIPCIONES-SEGUIMIENTO.md

**Bloque 5 del rol administrador — Inscripciones, seguimiento y salvaguardas**

v1.2 · 07-ago-2026 · Política de salvaguardas revisada: bloqueo por publicación en vez de confirmación por conteo

---

## Contexto

El rol administrador cubre hoy la autoría de contenido de punta a punta. Lo que **no** cubre es la otra mitad de la operación: **las personas que están cursando**.

Consecuencias observadas:

- No hay forma de saber quién está inscrito en un curso ni por dónde va.
- El 07-ago-2026 se despublicó un curso con un estudiante inscrito. Desde su lado el curso desapareció junto con su avance aparente. No hubo pérdida de datos, pero tampoco advertencia.
- Un estudiante que agota sus intentos queda bloqueado 24 h sin manera de ayudarlo desde el panel.
- Una constancia emitida referencia un curso que puede cambiar después, dejando el artefacto legal apuntando a algo que ya no existe tal como se cursó.

Los cuatro puntos responden a la misma pregunta: **¿quién está cursando esto, y qué le pasa si lo modifico?**

### Fuera de alcance

Pagos (área K), auditoría general de cambios (área L) y gestión de cuentas admin (A7) quedan para bloques posteriores.

**G3** (validación de intensidad horaria < 160 h) y **M5** (tests de regresión legal) salen a un spec de cumplimiento aparte: son de otra naturaleza y necesitan criterios propios de cara a la validación de la Fase 3.

---

## §0.A — Auditoría (COMPLETADA)

Ejecutada el 07-ago-2026. Resultado en `INVENTARIO-ROL-ADMIN.md`. Hallazgos que modifican este spec:

| Hallazgo | Impacto |
|---|---|
| **B5** — no existe borrado duro de curso; solo `archiveCourse` (soft-delete) | Las guardas cubren **archivar**, no "eliminar curso" |
| **F7** — el bloqueo de 24 h se **calcula** (`computeAttemptWindow`), no se persiste como bandera | El desbloqueo (F8) necesita un mecanismo de anulación explícito, no basta con limpiar un flag |
| **H6** — `revokeCertificate` ya existe con botón en `CertAdminTable` | Sale del alcance futuro; estaba mal listado |
| **H8** — la exportación CSV omite deliberadamente correo y `user_id` | Precedente de minimización de datos: la §1.5 se alinea con ese criterio ya existente |
| **F5** — el sorteo usa la constante fija `10` e ignora `evaluations.questions_per_attempt` | **Defecto nuevo**: la configuración por curso es cosmética. Se incorpora al alcance |

---

## §0.B — Verificación técnica previa a la implementación

1. **Esquema de inscripciones.** Tabla, columnas, estados, marca temporal, relación con `courses` y con el usuario.

2. **Esquema de progreso.** Cómo se persiste el avance por lección; granularidad; marca de completitud y temporal. Cómo se calcula el porcentaje que ve el estudiante.

3. **Esquema de intentos.** Tabla, puntajes, marcas temporales. **Cómo opera `computeAttemptWindow`** exactamente: qué entradas usa para decidir el bloqueo y qué haría falta para anularlo sin borrar historial. Este punto determina el diseño de §1.4.

4. **Desbloqueo progresivo del estudiante.** Dónde se decide qué lección está accesible. **¿La decisión depende solo del orden actual, o considera lo ya completado?** Determina §1.7.

5. **Esquema de constancias.** Qué se guarda hoy y qué se deriva del curso en tiempo de lectura. Cómo renderiza `/verificar/[id]` y qué expone `get_certificate`.

6. **`archiveCourse`.** ¿Está restringido a borradores, o puede archivar un curso publicado con inscritos? Determina el alcance de la guarda.

7. **`evaluations.questions_per_attempt`.** Valor por defecto, rango válido, y dónde se ignora hoy la configuración (F5).

8. **Políticas RLS** sobre inscripciones, progreso, intentos y constancias: qué lee el admin, qué el estudiante, y si `createAdminClient` las evade.

9. **Rutas admin existentes** y dónde encaja naturalmente una sección de estudiantes o inscritos.

10. **Operaciones destructivas actuales.** `deleteLesson`, `deleteModule`, `reorderLesson`, `reorderModule`, `setPublished`, `archiveCourse`, y las del banco de preguntas. ¿Alguna consulta inscripciones antes de ejecutarse?

Si algún hallazgo entra en conflicto con la §1, propón el ajuste antes de continuar.

---

## §1 — Implementación

### 1. Vista de inscritos por curso

Nueva pantalla accesible desde el detalle del curso en admin. Por cada inscrito:

- Nombre y correo (ver §1.5).
- Fecha de inscripción.
- Progreso: lecciones completadas sobre el total, y porcentaje.
- Última actividad registrada.
- Estado de evaluación: sin intentos · en curso · aprobado · reprobado · bloqueado.
- Constancia: emitida (con código) · revocada · no emitida.

Requisitos:

- Ordenable por progreso y por última actividad.
- Filtro por estado: activos · finalizados · sin iniciar · bloqueados.
- Contador total de inscritos visible en el detalle del curso sin entrar a la lista.
- Progreso calculado **en servidor** con una consulta agregada por curso — no N+1 por estudiante.

### 2. Ficha individual del estudiante

Desde la lista, acceso a una ficha con:

- Datos de la persona.
- Cursos inscritos con progreso de cada uno.
- Intentos de evaluación por curso: fecha, puntaje, resultado.
- Constancias emitidas, con enlace a la verificación pública.
- Estado de bloqueo con la acción de desbloqueo (§1.4).

### 3. Salvaguardas de edición

**Regla (v1.2).** Un curso **publicado** no admite modificaciones de contenido. No importa si tiene inscritos o no: si `status = publicado`, se bloquea. La revisión del contenido es responsabilidad **previa** a publicar; para modificar hay que despublicar primero. Se reemplaza el esquema anterior de "confirmación con conteo de inscritos activos" por un bloqueo duro basado únicamente en el estado de publicación.

**Definición operativa de "inscrito activo".** Se conserva —inscripción **sin constancia emitida**— porque sigue siendo útil para: la vista de inscritos, la ficha del estudiante, y el aviso contextual al despublicar. Ya no se usa como condición para permitir/exigir confirmación en operaciones de contenido.

**Bloqueadas mientras el curso esté publicado** (rechazo con mensaje claro, sin opción de confirmar):
- Crear, editar, eliminar y reordenar módulos.
- Crear, editar, eliminar y reordenar lecciones.
- Guardar el texto Markdown de una lección.
- Subir, reemplazar y quitar el archivo de una lección.
- Crear, editar, reordenar y eliminar preguntas.
- Cambiar la configuración de evaluación (nota mínima, preguntas por intento).

**Permitidas siempre:**
- **Despublicar** el curso. Es la vía para poder editar y conserva su advertencia sobre inscritos.
- **Archivar** el curso. Conserva su confirmación actual: el curso debe estar despublicado, sin constancias, y si hay inscritos activos pide confirmación explícita.

**Comportamiento de la guarda de contenido.**

El action resuelve el `courseId` del recurso involucrado y consulta `courses.published`. Si `published = true`, retorna un rechazo con el mensaje:

> "El curso está publicado. Para modificar su contenido, despublícalo primero desde el panel del curso."

No hay parámetro `confirmed`; el bloqueo es determinista. La guarda vive en el servidor porque un action puede invocarse por otras vías; **la UI complementa** deshabilitando controles y mostrando un banner en las pantallas de **módulos y lecciones** y de **evaluación**. El admin no debe poder intentarlo desde la interfaz.

**Caso especial — despublicar (G5).** El mensaje debe decir explícitamente que el curso dejará de ser visible para los inscritos y que **su progreso se conserva**. Es la confusión exacta del incidente del 07-ago.

### 4. Desbloqueo manual de estudiante (F8)

El bloqueo de 24 h se **calcula** a partir de los intentos, no se persiste. Por tanto el desbloqueo requiere un mecanismo de anulación explícito y aditivo.

**Enfoque preferido:** una marca de anulación por estudiante y curso (por ejemplo `lockout_override_until` o una fila en tabla aparte) que `computeAttemptWindow` consulte y respete. Si la §0.B revela un enfoque más natural dado el esquema real, proponerlo.

Requisitos:

- Acción disponible desde la ficha del estudiante, con confirmación.
- **Concede un intento adicional**, no restablece todos: no vacía el mecanismo de control.
- **No altera el historial de intentos previos.**
- Registra quién desbloqueó, a quién, en qué curso y cuándo. Aunque la auditoría general (área L) no exista, esta intervención manual sobre un control **sí debe dejar rastro**.

### 5. Datos personales (M6) — decisiones fijadas

Se manejan datos identificables de profesionales de la salud, bajo Ley 1581.

- **Minimización.** En listados: nombre y correo. **No** exponer documento de identidad ni RETHUS.
- **Sin exportación masiva** de listados de personas en este bloque. Se alinea con el criterio ya presente en la exportación de constancias (H8), que omite correo y `user_id`.
- **Acceso.** Todos los admin ven todo; no hay segmentación. Queda documentado como decisión consciente, no como omisión.
- **Propósito.** Acompañamiento pedagógico y soporte, no perfilado comercial.

### 6. Snapshot en la constancia (H5)

Al emitir, **copiar al propio registro** los datos que la sustentan, en lugar de derivarlos del curso en lectura:

- Título del curso al momento de emitir.
- Intensidad horaria.
- Estructura: módulos y lecciones con sus títulos.
- Nota mínima de aprobación y puntaje obtenido.
- Fecha de emisión y vigencia.

La página pública de verificación debe renderizar **desde el snapshot**, no desde el curso vivo.

**Constancias ya emitidas.** Rellenar con el estado actual del curso, marcando esos registros como reconstruidos (`snapshot_origen: 'retroactivo'` o equivalente). No se puede afirmar que reflejen el contenido del momento de emisión, y eso debe vivir en el dato.

**Constancias revocadas.** `revokeCertificate` ya existe; el snapshot debe conservarse también en ellas, para que la verificación pública pueda explicar qué se revocó.

### 7. Desbloqueo progresivo irreversible

**Una lección ya completada por un estudiante nunca debe volver a quedar bloqueada**, sin importar cómo se reordene el curso después.

Si la §0.B revela que el desbloqueo depende solo del orden actual, ajustarlo para que considere lo ya completado. Esto elimina por diseño el riesgo que motivaba tratar el reordenamiento como destructivo, en lugar de mitigarlo con fricción para el administrador.

### 8. Corrección: preguntas por intento (F5)

El sorteo de preguntas usa la constante fija `10` e ignora `evaluations.questions_per_attempt`. La configuración por curso se guarda y no surte efecto — un fallo silencioso que afecta la integridad de la evaluación.

Corregir para que el número de preguntas sorteadas provenga de la configuración del curso, con la constante actual como valor por defecto. Validar que el valor configurado no supere el tamaño del banco disponible.

### Restricciones

- Cambios aditivos y reversibles. Migraciones de esquema **solo aditivas** (columnas nuevas; nunca borrado ni renombrado).
- Toda mutación nueva invalida rutas con los helpers de `src/lib/revalidate-admin.ts`, conforme a la regla de `CLAUDE.md`.
- Para lookups de un solo valor, selects de columnas directas encadenados, **no** recursos embebidos de PostgREST (ver la nota de `CLAUDE.md` sobre fallos silenciosos de forma).
- No tocar `src/lib/r2.ts`.
- No retirar el tratamiento anti-caché de `/admin/cursos/[slug]`.
- No introducir regresiones en P0/P1 ni en la nomenclatura "constancia de finalización".

---

## §2 — Criterios de aceptación

**Vista de inscritos**
1. Desde el detalle de un curso se accede a la lista de inscritos.
2. Cada fila muestra progreso, última actividad, estado de evaluación y estado de constancia.
3. La lista se ordena por progreso y se filtra por estado.
4. El detalle del curso muestra el total de inscritos.
5. El progreso se calcula en servidor sin consultas N+1.

**Ficha del estudiante**
6. Desde la lista se accede a la ficha individual.
7. La ficha muestra cursos, progreso, intentos y constancias de esa persona.

**Salvaguardas (v1.2)**
8. Con el curso **publicado**, todas las mutaciones de contenido (crear/editar/eliminar/reordenar módulos y lecciones; guardar texto Markdown; subir/reemplazar/quitar archivo; crear/editar/reordenar/eliminar preguntas; cambiar configuración de evaluación) **son rechazadas** por el servidor con un mensaje claro que indica que hay que despublicar primero. No hay opción de confirmar.
9. Con el curso **publicado**, la UI de módulos, lecciones y evaluación aparece con controles deshabilitados y un banner explicando por qué. El admin no puede intentar la mutación desde la interfaz.
10. Con el curso **en borrador**, las mismas mutaciones de contenido se ejecutan sin pedir confirmación y sin condicionantes por conteo de inscritos.
11. **Despublicar** el curso está permitido siempre; con inscritos activos advierte explícitamente que dejará de ser visible y que **el progreso se conserva**.
12. **Archivar** el curso está permitido siempre bajo sus condiciones actuales (borrador, sin constancias); con inscritos activos exige confirmación explícita.
13. La guarda de publicación opera en el servidor: invocar el action de contenido con el curso publicado no ejecuta la operación, sin importar la ruta de invocación.
14. Los helpers `countActiveEnrollments` y demás en `src/lib/enrollments-admin.ts` se conservan: siguen usándose por la vista de inscritos, la ficha del estudiante y el aviso al despublicar.

**Desbloqueo**
15. Un estudiante bloqueado se desbloquea desde su ficha, con confirmación.
16. El desbloqueo concede un intento adicional, no restablece todos.
17. Queda registrado con autor, destinatario, curso y fecha.
18. El historial de intentos previos no se altera.

**Snapshot**
19. Una constancia nueva guarda título, intensidad horaria, estructura, nota mínima y puntaje.
20. `/verificar/[id]` renderiza desde el snapshot.
21. Modificar el curso después de emitir **no** altera lo que muestra la constancia.
22. Las constancias previas quedan con snapshot reconstruido y marcadas como tales.
23. Las constancias revocadas conservan su snapshot.

**Desbloqueo progresivo**
24. Una lección completada sigue accesible tras reordenar el curso.

**Preguntas por intento**
25. Un curso configurado con N preguntas por intento sortea N, no 10.
26. Configurar un N mayor que el banco disponible se rechaza con mensaje claro.

**Transversales**
27. Un estudiante no accede a ninguna pantalla nueva.
28. Las mutaciones nuevas invalidan sus rutas correctamente.
29. Los cuatro gates locales en verde: `type-check`, `lint`, `test`, `build`.

---

## §3 — Prompt de arranque (Fase 2)

> Lee primero `CLAUDE.md` para el contexto de stack, decisiones de producto y reglas de desarrollo. Continúas con el Bloque 5 del rol administrador, descrito en `SPEC-INSCRIPCIONES-SEGUIMIENTO.md` **v1.1**, ya ajustado con los hallazgos de tu auditoría. La Fase 1 (§0.A) está completada y revisada.
>
> Ejecuta la §0.B: inspecciona los esquemas de inscripciones, progreso, intentos y constancias; **cómo opera `computeAttemptWindow`** y qué haría falta para anular un bloqueo sin borrar historial; **dónde se decide qué lección está accesible** para el estudiante y si considera lo ya completado; si `archiveCourse` está restringido a borradores; dónde se ignora `evaluations.questions_per_attempt`; las políticas RLS; las rutas admin existentes; y qué operaciones destructivas consultan hoy las inscripciones. Reporta los hallazgos de forma concisa.
>
> Si son compatibles con la §1, implementa directamente cumpliendo todos los criterios de la §2, sin pedir aprobación intermedia. Detente y consúltame solo si encuentras algo que entre en conflicto con la §1 — en particular, si el progreso o el bloqueo no se persisten de forma que permita lo descrito, o si el snapshot de constancias exigiera una migración no aditiva.
>
> Reglas: cambios aditivos y reversibles; migraciones de esquema solo aditivas; toda mutación nueva invalida rutas con los helpers de `src/lib/revalidate-admin.ts`; para lookups de un solo valor usa selects de columnas directas encadenados, no embeds de PostgREST; no toques `src/lib/r2.ts`; no retires el tratamiento anti-caché de `/admin/cursos/[slug]`; no introduzcas regresiones en P0/P1 ni en la nomenclatura "constancia de finalización". Al terminar, corre `type-check`, `lint`, `test` y `build` y confirma que los cuatro salen en verde.

---

## §4 — Decisiones de producto (FIJADAS)

1. **Datos en el listado:** nombre y correo. Sin documento de identidad ni RETHUS.
2. **"Inscrito activo":** inscripción sin constancia emitida.
3. **Desbloqueo:** concede un intento adicional, no restablece todos.
4. **Reordenar:** avisa sin bloquear. El riesgo se elimina en §1.7 haciendo irreversible el desbloqueo progresivo, no con fricción para el administrador.
5. **Progreso de una lección eliminada:** se conserva la fila histórica y se excluye del cálculo de porcentaje.

---

## §5 — Verificación manual tras la implementación

Con dev server limpio y sin recargas forzadas:

1. Inscribir a `hjcuervo@gmail.com` en un curso de pruebas y completar una lección.
2. Como admin, abrir la lista de inscritos: debe aparecer con su progreso.
3. Ordenar por progreso y filtrar por estado.
4. Abrir la ficha del estudiante y verificar cursos, intentos y constancias.
5. Intentar eliminar una lección del curso: debe pedir confirmación con el conteo.
6. Reordenar una lección: debe avisar sin exigir segundo paso.
7. Verificar que la lección ya completada sigue accesible para el estudiante tras reordenar.
8. Despublicar el curso: debe advertir que el progreso se conserva.
9. Agotar intentos con el estudiante, desbloquearlo desde el panel, y confirmar que puede intentar de nuevo.
10. Emitir una constancia, editar el título del curso, y confirmar que la verificación pública sigue mostrando el título original.
