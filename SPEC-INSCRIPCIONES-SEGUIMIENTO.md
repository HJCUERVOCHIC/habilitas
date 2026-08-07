# SPEC-INSCRIPCIONES-SEGUIMIENTO.md

**Bloque 5 del rol administrador — Inscripciones, seguimiento y salvaguardas**

v1.0 · 07-ago-2026

---

## Contexto

El rol administrador cubre hoy la autoría de contenido de punta a punta: cursos, estructura, contenido, medios, evaluación, publicación y constancias. Lo que **no** cubre es la otra mitad de la operación: **las personas que están cursando**.

Consecuencias observadas:

- No hay forma de saber quién está inscrito en un curso ni por dónde va.
- El 07-ago-2026 se despublicó un curso con un estudiante inscrito. Desde su lado el curso desapareció junto con su avance aparente. No hubo pérdida de datos, pero tampoco advertencia alguna.
- Un estudiante que agota sus intentos queda bloqueado 24 h y **no existe manera de ayudarlo desde el panel**.
- Una constancia emitida referencia un curso que puede cambiar después, dejando el artefacto legal apuntando a algo que ya no existe tal como se cursó.

Los cuatro puntos responden a la misma pregunta: **¿quién está cursando esto, y qué le pasa si lo modifico?**

### Insumo

`INVENTARIO-ROL-ADMIN.md` recoge el alcance completo del rol admin con estado de implementación. Este spec toma de ahí las áreas J (inscripciones), G5 (advertencia al despublicar), H5 (snapshot en constancia), F8 (desbloqueo) y M6 (datos personales).

### Fuera de alcance

Pagos (área K), auditoría general de cambios (área L) y gestión de cuentas admin (A7) quedan para bloques posteriores. Se mencionan aquí solo cuando condicionan una decisión de diseño.

---

## §0 — Verificación previa

### §0.A — Auditoría del inventario completo

`INVENTARIO-ROL-ADMIN.md` marca con ◐ lo que está documentado pero no verificado, y con `?` lo desconocido. **Resuelve todas esas marcas contra el código real** y actualiza el archivo con el estado verdadero.

Áreas a auditar, con los puntos concretos:

- **A** Acceso y roles — A3 (enrutamiento por rol), A4 (guardas de `/admin`), A6 (coherencia de shell).
- **B** Cursos — B5 (¿existe "Eliminar curso" en la UI o solo en el spec?), B7 (búsqueda y filtrado).
- **D** Contenido — D3 (`duration_min`), D4 (transcripción).
- **F** Evaluación — **área completa**: F1 a F7. Verificar banco de preguntas, edición, nota mínima, selección aleatoria de 10, temporizador validado en servidor, bloqueo de 24 h. Es la menos verificada de todo el panel.
- **G** Publicación — G3 (intensidad horaria < 160 h), G4 (bloqueo si el checklist no pasa), G6 (vista previa como estudiante).
- **H** Constancias — H1 a H4, H8 (exportación CSV).
- **I** Importación — I1 a I4 (YAML).
- **M** Cumplimiento — M1 a M4 (avisos legales, nomenclatura, intensidad horaria), M5 (verificación automatizada P0/P1).

Reporta como tabla: área, requerimiento, estado real, y nota breve cuando difiera de lo documentado. Actualiza `INVENTARIO-ROL-ADMIN.md` con los hallazgos.

### §0.B — Verificación para la implementación

1. **Esquema de inscripciones.** Tabla, columnas, estados posibles, marca temporal, relación con `courses` y con el usuario.

2. **Esquema de progreso.** Cómo se persiste el avance por lección: tabla, granularidad, marca de completitud, marca temporal. Cómo se calcula el porcentaje que ve el estudiante.

3. **Esquema de intentos de evaluación.** Tabla, campos de puntaje, marcas temporales, y **cómo se representa el bloqueo de 24 h** (¿columna, cálculo derivado de `started_at`, tabla aparte?). Este punto es crítico para F8.

4. **Esquema de constancias.** Columnas actuales, qué se guarda hoy y qué se deriva del curso en tiempo de lectura. Cómo se genera el código de verificación. Cómo renderiza la página pública.

5. **Políticas RLS** sobre esas cuatro tablas: qué puede leer el rol admin, qué el estudiante, y si el cliente admin (`createAdminClient`) las evade.

6. **Rutas admin existentes** y dónde encajaría naturalmente una sección de estudiantes o inscritos.

7. **Operaciones destructivas actuales.** Lista los server actions que borran o alteran estructura (`deleteLesson`, `deleteModule`, `reorderLesson`, `reorderModule`, `setPublished`, eliminación de curso si existe, y los del banco de preguntas). Indica si alguno consulta inscripciones antes de ejecutarse.

Si algún hallazgo entra en conflicto con la §1, propón el ajuste antes de continuar.

---

## §1 — Implementación

### 1. Vista de inscritos por curso

Nueva pantalla accesible desde el detalle del curso en admin.

Por cada inscrito, mostrar:

- Identificación de la persona (ver §1.5 sobre qué datos exactamente).
- Fecha de inscripción.
- Progreso: lecciones completadas sobre el total, y porcentaje.
- Última actividad registrada.
- Estado de evaluación: sin intentos · en curso · aprobado · reprobado · bloqueado.
- Constancia: emitida (con su código) o no.

Requisitos de la vista:

- **Ordenable** al menos por progreso y por última actividad.
- **Filtro por estado**: activos, finalizados, sin iniciar, bloqueados.
- **Contador total** de inscritos visible en el detalle del curso, sin entrar a la lista.
- Cálculo del progreso **en el servidor**, con una sola consulta agregada por curso — no N+1 por estudiante.

### 2. Ficha individual del estudiante

Desde la lista de inscritos, acceso a una ficha con:

- Datos de la persona.
- Cursos en los que está inscrito, con progreso de cada uno.
- Intentos de evaluación por curso: fecha, puntaje, resultado.
- Constancias emitidas, con enlace a la verificación pública.
- Estado de bloqueo, si aplica, con la acción de desbloqueo (§1.4).

### 3. Salvaguardas de edición

**Definición operativa de "inscrito activo":** una inscripción **sin constancia emitida**. Quien ya terminó queda protegido por el snapshot (§1.6); quien está en curso, por estas guardas. Los dos mecanismos se reparten el problema y no se solapan.

**Clasificación de operaciones:**

*Seguras — no requieren guarda:*
- Editar el texto Markdown de una lección.
- Editar título, descripción o metadatos del curso.
- Añadir un módulo o una lección **al final**.
- Subir o reemplazar el archivo de una lección existente.

*Destructivas — requieren confirmación explícita cuando hay inscritos activos:*
- Eliminar una lección o un módulo.
- Reordenar módulos o lecciones.
- Cambiar el tipo de una lección.
- Modificar el banco de preguntas o la nota mínima.
- Despublicar el curso.
- Eliminar el curso.

**Comportamiento de la guarda:**

Antes de ejecutar una operación destructiva, el action consulta cuántos inscritos activos tiene el curso. Si hay al menos uno, **no ejecuta**: devuelve un resultado que la UI traduce en un diálogo de confirmación indicando el número de estudiantes afectados y qué implica el cambio.

La confirmación se pasa como parámetro explícito al reintentar (por ejemplo `{ confirmed: true }`). **No** se resuelve solo en el cliente: la guarda vive en el servidor, porque un action puede invocarse fuera de la UI.

**Caso especial — despublicar (G5).** El mensaje debe decir explícitamente que el curso dejará de ser visible para los inscritos y que su progreso se conserva. Es la confusión exacta que generó el incidente del 07-ago.

**Caso especial — banco de preguntas.** Si hay estudiantes con intentos en curso, la advertencia debe señalar que la evaluación dejará de ser comparable entre quienes la presentaron antes y después.

### 4. Desbloqueo manual de estudiante (F8)

Desde la ficha del estudiante, acción para levantar el bloqueo de 24 h por intentos agotados.

- Requiere confirmación.
- Registra quién desbloqueó, a quién y cuándo. Aunque la auditoría general (área L) no esté implementada, **esta operación concreta sí debe dejar rastro** — es una intervención manual sobre un mecanismo de control.
- No altera el historial de intentos previos: solo permite uno nuevo.

### 5. Datos personales (M6) — decisiones a fijar

Se manejan datos identificables de profesionales de la salud, bajo Ley 1581. Fijar en la implementación:

- **Minimización.** Mostrar solo lo necesario para prestar el servicio: nombre y correo en el contexto del curso. No exponer documento de identidad ni RETHUS en listados.
- **Sin exportación masiva en este bloque.** La descarga de listados de personas queda fuera de alcance hasta definir controles.
- **Acceso.** Todos los admin ven todo; no hay segmentación. Debe quedar documentado como decisión consciente, no como omisión.
- **Propósito.** Las vistas existen para acompañamiento pedagógico y soporte, no para perfilado comercial.

### 6. Snapshot en la constancia (H5)

Al emitir una constancia, **copiar al propio registro** los datos que la sustentan, en lugar de derivarlos del curso en tiempo de lectura:

- Título del curso al momento de la emisión.
- Intensidad horaria.
- Estructura: módulos y lecciones con sus títulos.
- Nota mínima de aprobación y puntaje obtenido.
- Fecha de emisión y vigencia.

La **página pública de verificación debe renderizar desde el snapshot**, no desde el curso vivo. Es lo que hace la constancia auditable con independencia de lo que ocurra después con el contenido.

**Constancias ya emitidas.** Rellenar el snapshot con el estado actual del curso, marcando esos registros como reconstruidos (`snapshot_origen: 'retroactivo'` o equivalente). No se puede afirmar que reflejen el contenido exacto del momento de emisión, y eso debe ser explícito en el dato, no un supuesto.

### Restricciones

- Cambios aditivos y reversibles. Migraciones de esquema solo aditivas (columnas nuevas, nunca borrado ni renombrado).
- Toda mutación nueva debe invalidar rutas con los helpers de `src/lib/revalidate-admin.ts`, conforme a la regla de `CLAUDE.md`.
- Para lookups de un solo valor, usar selects de columnas directas encadenados, no recursos embebidos de PostgREST (ver la nota de `CLAUDE.md` sobre fallos silenciosos de forma).
- No tocar `src/lib/r2.ts`.
- No retirar el tratamiento anti-caché de `/admin/cursos/[slug]`.
- No introducir regresiones en el cumplimiento P0/P1 ni en la nomenclatura "constancia de finalización".

---

## §2 — Criterios de aceptación

**Vista de inscritos**
1. Desde el detalle de un curso se accede a la lista de inscritos.
2. Cada fila muestra progreso, última actividad, estado de evaluación y estado de constancia.
3. La lista se puede ordenar por progreso y filtrar por estado.
4. El detalle del curso muestra el número total de inscritos.
5. El progreso se calcula en servidor sin consultas N+1.

**Ficha del estudiante**
6. Desde la lista se accede a la ficha individual.
7. La ficha muestra cursos, progreso, intentos y constancias de esa persona.

**Salvaguardas**
8. Eliminar una lección o módulo en un curso con inscritos activos exige confirmación que indica cuántos se afectan.
9. Despublicar un curso con inscritos activos advierte que dejará de ser visible y que el progreso se conserva.
10. Modificar el banco de preguntas con intentos en curso advierte sobre la comparabilidad.
11. Las operaciones seguras (editar texto, añadir lección al final, reemplazar archivo) **no** piden confirmación.
12. La guarda opera en el servidor: invocar el action sin la confirmación explícita no ejecuta la operación.

**Desbloqueo**
13. Un estudiante bloqueado puede ser desbloqueado desde su ficha, con confirmación.
14. El desbloqueo queda registrado con autor, destinatario y fecha.
15. El historial de intentos previos no se altera.

**Snapshot**
16. Una constancia nueva guarda título, intensidad horaria, estructura, nota mínima y puntaje.
17. La página pública de verificación renderiza desde el snapshot.
18. Modificar el curso después de emitir **no** altera lo que muestra la constancia.
19. Las constancias previas quedan con snapshot reconstruido y marcadas como tales.

**Transversales**
20. Un estudiante no accede a ninguna de las pantallas nuevas.
21. Las mutaciones nuevas invalidan sus rutas correctamente.
22. `INVENTARIO-ROL-ADMIN.md` queda actualizado con el resultado de la auditoría §0.A.
23. Los cuatro gates locales en verde: `type-check`, `lint`, `test`, `build`.

---

## §3 — Prompt de arranque

> Lee primero `CLAUDE.md` para el contexto de stack, decisiones de producto y reglas de desarrollo. Estás trabajando en el Bloque 5 del rol administrador, descrito en `SPEC-INSCRIPCIONES-SEGUIMIENTO.md`, con `INVENTARIO-ROL-ADMIN.md` como insumo.
>
> Este bloque tiene dos fases y quiero que **te detengas entre ellas**.
>
> **Fase 1 — Auditoría (§0.A).** Resuelve contra el código real todas las marcas ◐ y `?` de `INVENTARIO-ROL-ADMIN.md`, con especial atención al área F (evaluación), que es la menos verificada. Reporta como tabla: área, requerimiento, estado real y nota cuando difiera de lo documentado. Actualiza el archivo del inventario con los hallazgos. **Detente aquí y espera mi revisión.**
>
> **Fase 2 — Verificación técnica e implementación.** Tras mi visto bueno, ejecuta la §0.B: inspecciona los esquemas de inscripciones, progreso, intentos y constancias; cómo se representa el bloqueo de 24 h; las políticas RLS; las rutas admin existentes; y qué operaciones destructivas consultan hoy las inscripciones. Si los hallazgos son compatibles con la §1, implementa directamente cumpliendo todos los criterios de la §2, sin pedir aprobación intermedia.
>
> Detente y consúltame solo si encuentras algo que entre en conflicto con la §1 — en particular, si el progreso o el bloqueo no se persisten de forma que permita las vistas descritas, o si el snapshot de constancias exigiera una migración no aditiva.
>
> Reglas: cambios aditivos y reversibles; migraciones de esquema solo aditivas; toda mutación nueva debe invalidar rutas con los helpers de `src/lib/revalidate-admin.ts`; para lookups de un solo valor usa selects de columnas directas encadenados, no embeds de PostgREST; no toques `src/lib/r2.ts`; no retires el tratamiento anti-caché de `/admin/cursos/[slug]`; no introduzcas regresiones en P0/P1 ni en la nomenclatura "constancia de finalización". Al terminar, corre `type-check`, `lint`, `test` y `build` y confirma que los cuatro salen en verde.

---

## §4 — Decisiones de producto a confirmar

Estas no las puede resolver la implementación. Confirmar antes o durante la Fase 2:

1. **¿Qué datos de la persona se muestran en el listado?** Propuesta: nombre y correo. Sin documento de identidad ni RETHUS.
2. **¿"Inscrito activo" = inscripción sin constancia?** Propuesta: sí. Alternativa: incluir también a quien tiene constancia pero sigue con acceso.
3. **¿El desbloqueo restablece todos los intentos o concede uno solo?** Propuesta: uno solo, para no vaciar el mecanismo de control.
4. **¿Reordenar cuenta como destructivo?** Propuesta: sí, porque el desbloqueo progresivo depende del orden y puede rebloquear contenido ya alcanzado.
5. **¿Qué pasa con el progreso de una lección eliminada?** Propuesta: conservar la fila histórica y excluirla del cálculo de porcentaje, para no inflar ni desinflar el avance retroactivamente.
