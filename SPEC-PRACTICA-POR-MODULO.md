# SPEC-PRACTICA-POR-MODULO.md

**Evaluaciones formativas por módulo**

v1.0 · 07-ago-2026

---

## Contexto

Hoy cada curso tiene **una** evaluación: la final, con 20 minutos, 3 intentos, bloqueo de 24 h al agotarlos, sin retroalimentación durante el intento, y que dispara la emisión de la constancia al aprobarse.

Se requiere añadir **práctica por módulo**: al terminar los contenidos de un módulo, el estudiante puede autoevaluarse. La evaluación final se conserva exactamente como está.

### Naturaleza de la práctica

Es **formativa**, no sumativa. Su propósito es el aprendizaje por evocación, no calificar:

- No condiciona el avance ni desbloquea nada.
- No aporta al porcentaje de progreso del curso.
- No influye en la constancia ni en su snapshot.
- Sin límite de intentos, sin temporizador, sin bloqueo.
- **Con** retroalimentación inmediata por pregunta — es lo que la hace formativa.

### Origen de las preguntas

**Un banco único por curso, etiquetado por módulo.** La evaluación final sigue sorteando de todo el banco; la práctica de un módulo sortea solo lo etiquetado con ese módulo. La misma pregunta sirve para ambos usos, así que el costo de autoría es etiquetar, no escribir.

### Opcionalidad emergente

No hay interruptor de "activar práctica". Un módulo ofrece práctica **si tiene al menos 3 preguntas etiquetadas**; si no, la entrada simplemente no aparece. La opcionalidad viene del contenido, no de configuración adicional.

---

## §0 — Verificación previa

1. **Esquema de `questions`.** Columnas, FK a `evaluations`, cómo se guardan las opciones y `correct_option`. ¿Existe ya alguna columna de agrupación o etiqueta?

2. **Esquema de `eval_attempts`.** Columnas, FK, y **cómo exactamente `computeAttemptWindow` cuenta intentos** para decidir el bloqueo de 24 h. Este punto es crítico: ver §1.2.

3. **`startAttempt` y `submitAttempt`** en `src/app/curso/[slug]/eval-actions.ts`: flujo completo, qué viaja al cliente y qué no. La auditoría confirmó que `correct_option` nunca llega al navegador durante un intento — necesitamos saber cómo se garantiza.

4. **Reproductor del estudiante.** Estructura de `CoursePlayer`, `LessonSidebar` y `CourseTopbar`. Dónde encajaría naturalmente la entrada a la práctica de un módulo.

5. **Desbloqueo progresivo.** Cómo decide `isLessonAccessible` qué está accesible, tras el cambio del Bloque 5 que lo hizo irreversible.

6. **Checklist de publicación.** Qué valida hoy sobre el banco de preguntas y si habría que ajustarlo.

7. **Editor del banco (`EvaluationManager`).** Estructura del formulario de pregunta, para añadir el selector de módulo.

8. **Importador YAML.** Esquema actual de preguntas, para añadir el campo de etiqueta.

Si algún hallazgo entra en conflicto con la §1, propón el ajuste antes de continuar.

---

## §1 — Implementación

### 1. Etiqueta de módulo en las preguntas

Añadir a `questions` una columna `module_id` **nullable**, con FK a `modules`.

- `null` significa "sin etiquetar": la pregunta solo entra en la evaluación final.
- Validar en el action que el módulo pertenezca **al mismo curso** que la evaluación de esa pregunta. Una pregunta etiquetada con el módulo de otro curso es un dato inconsistente que hay que impedir en escritura, no detectar después.
- El selector aparece en el editor de pregunta de `EvaluationManager`, alimentado por los módulos del curso.
- Etiquetar es editar el banco, así que queda **bloqueado en cursos publicados**, coherente con la política del Bloque 5.

La evaluación final **no cambia**: sigue sorteando de todo el banco, etiquetado o no.

### 2. Tabla propia para los intentos de práctica

Crear `practice_attempts`, separada de `eval_attempts`.

**Por qué separada y no una columna discriminadora:** `computeAttemptWindow` cuenta filas de `eval_attempts` para decidir el bloqueo de 24 h de la evaluación final. Si los intentos de práctica cayeran en esa tabla, bastaría con que una sola consulta olvidara filtrar por el discriminador para que **practicar bloqueara la evaluación final** — un fallo silencioso, del tipo que este proyecto ya ha sufrido varias veces. Una tabla aparte hace ese error imposible por construcción.

Columnas mínimas: `user_id`, `course_id`, `module_id`, `started_at`, `finished_at`, `total_questions`, `correct_count`.

No se guardan las respuestas individuales en esta versión. El propósito del registro es saber **qué módulos cuestan** —insumo del análisis de ítems, brecha F9 del inventario— no auditar a la persona.

RLS: el estudiante lee y escribe lo suyo; el admin lee todo.

### 3. Flujo de la práctica

Ruta nueva: `/curso/[slug]/practica/[moduleId]`.

- **Acceso:** disponible si el módulo tiene al menos 3 preguntas etiquetadas y sus lecciones son accesibles para ese estudiante. Sin condición adicional.
- **Sorteo:** hasta 10 preguntas al azar del subconjunto etiquetado; si hay menos, se usan todas.
- **Sin temporizador.**
- **Retroalimentación inmediata:** el estudiante responde una pregunta, el servidor evalúa y devuelve si acertó y cuál era la correcta, **y solo entonces** avanza a la siguiente.
- **Al terminar:** resumen con aciertos sobre total y opción de repetir. Sin nota, sin aprobado ni reprobado.
- **Intentos ilimitados.** Sin bloqueo, sin ventana móvil, sin `attempt_unlocks`.

**Restricción de seguridad crítica:** `correct_option` **no puede viajar al cliente por adelantado**. El banco es compartido con la evaluación final; enviar el set completo con respuestas permitiría leer en la pestaña de red las respuestas del examen. La evaluación se hace pregunta a pregunta, en el servidor, y solo se revela la correcta de la que ya se respondió.

### 4. Entrada en el reproductor

En la barra lateral del curso, al final de cada módulo que califique, una entrada **"Practicar"** distinguible visualmente de las lecciones.

- No lleva marca de completitud: la práctica no se "termina".
- **No cuenta para el porcentaje de progreso.** El progreso sigue siendo lecciones completadas. Si la práctica lo inflara, la afirmación "completó el curso" de la constancia se volvería ambigua.
- La entrada a la evaluación final permanece donde está, en el topbar, sin cambios.

### 5. Visibilidad para el admin

En la pantalla de evaluación del curso, mostrar por módulo cuántas preguntas tiene etiquetadas y si alcanza el umbral de 3. Es lo que permite al autor ver de un vistazo qué módulos ofrecen práctica y cuáles no.

No se construye análisis de ítems en este bloque; solo se persiste el dato que lo hará posible.

### 6. Importador YAML

Añadir un campo opcional de módulo en las preguntas del esquema YAML, resuelto por título o por índice de módulo. Los cursos importados nacen con la práctica lista en vez de requerir etiquetado manual posterior.

Actualizar `PROMPT-NOTEBOOKLM-CURSO-YAML.md` en consecuencia.

### Restricciones

- Cambios aditivos y reversibles. Migraciones de esquema **solo aditivas**.
- **No modificar el comportamiento de la evaluación final** en ningún aspecto: temporizador, intentos, bloqueo, sorteo, emisión de constancia y snapshot quedan exactamente como están.
- Toda mutación nueva invalida rutas con los helpers de `src/lib/revalidate-admin.ts` y debe pasar el test guardián.
- Para lookups de un solo valor, selects de columnas directas encadenados, **no** embeds de PostgREST.
- No tocar `src/lib/r2.ts` ni el tratamiento anti-caché de `/admin/cursos/[slug]`.
- No introducir regresiones en P0/P1 ni en la nomenclatura "constancia de finalización".

---

## §2 — Criterios de aceptación

**Etiquetado**
1. El editor de pregunta permite asignar un módulo del curso, o dejarla sin etiquetar.
2. Se rechaza etiquetar con un módulo de otro curso.
3. Etiquetar queda bloqueado si el curso está publicado.
4. La pantalla de evaluación muestra el conteo de preguntas etiquetadas por módulo.

**Acceso a la práctica**
5. Un módulo con 3 o más preguntas etiquetadas muestra "Practicar" en la barra lateral.
6. Un módulo con menos de 3 no la muestra.
7. La práctica es accesible sin haber completado las lecciones del módulo.

**Ejecución**
8. Se sortean hasta 10 preguntas del subconjunto del módulo.
9. No hay temporizador.
10. Tras responder cada pregunta se muestra si fue correcta y cuál era la respuesta.
11. `correct_option` **no** está presente en la respuesta de red antes de que el estudiante conteste esa pregunta.
12. Al terminar se muestra aciertos sobre total, sin aprobado ni reprobado.
13. Se puede repetir de inmediato, sin límite.

**Aislamiento respecto a la final**
14. Practicar **no** consume intentos de la evaluación final.
15. Practicar **no** dispara el bloqueo de 24 h.
16. Practicar **no** modifica el porcentaje de progreso del curso.
17. Practicar **no** emite ni altera constancias.
18. La evaluación final conserva su comportamiento: 20 min, 3 intentos, sorteo del banco completo, sin retroalimentación durante el intento.

**Persistencia**
19. Cada práctica registra fecha, módulo, total y aciertos.
20. Un estudiante no puede leer los intentos de práctica de otro.

**Importación**
21. El importador YAML acepta la etiqueta de módulo en las preguntas.
22. Un YAML sin etiquetas sigue importando correctamente.

**Transversales**
23. Las rutas nuevas no son accesibles por un admin ni por un anónimo.
24. Los cuatro gates locales en verde: `type-check`, `lint`, `test`, `build`.

---

## §3 — Prompt de arranque

> Lee primero `CLAUDE.md` para el contexto de stack, decisiones de producto y reglas de desarrollo. Vas a implementar las evaluaciones formativas por módulo, descritas en `SPEC-PRACTICA-POR-MODULO.md`.
>
> Antes de modificar nada, ejecuta la verificación de la §0: esquema de `questions` y `eval_attempts`; cómo cuenta intentos `computeAttemptWindow` para el bloqueo de 24 h; el flujo de `startAttempt` y `submitAttempt` y qué viaja al cliente; la estructura del reproductor y dónde encajaría la entrada a la práctica; cómo decide `isLessonAccessible` la accesibilidad; qué valida el checklist de publicación sobre el banco; la estructura del editor de preguntas; y el esquema YAML de preguntas del importador. Reporta los hallazgos de forma concisa.
>
> Si son compatibles con la §1, implementa directamente cumpliendo todos los criterios de la §2, sin pedir aprobación intermedia. Detente y consúltame solo si encuentras algo que entre en conflicto con la §1 — en particular, si el aislamiento entre práctica y evaluación final no pudiera garantizarse con el esquema real.
>
> Regla innegociable: **la evaluación final no cambia en nada**. Temporizador, intentos, bloqueo de 24 h, sorteo, emisión de constancia y snapshot quedan exactamente como están. La práctica es un camino paralelo y aislado.
>
> Reglas: cambios aditivos y reversibles; migraciones de esquema solo aditivas; toda mutación nueva invalida rutas con los helpers de `src/lib/revalidate-admin.ts` y debe pasar el test guardián; para lookups de un solo valor usa selects de columnas directas encadenados, no embeds de PostgREST; no toques `src/lib/r2.ts`; no retires el tratamiento anti-caché de `/admin/cursos/[slug]`; no introduzcas regresiones en P0/P1 ni en la nomenclatura "constancia de finalización". Al terminar, corre `type-check`, `lint`, `test` y `build` y confirma que los cuatro salen en verde.

---

## §4 — Decisiones de producto (fijadas)

1. **Formativas.** No condicionan avance, no puntúan, no afectan la constancia.
2. **Opcionalidad emergente.** Sin interruptor: un módulo con 3 o más preguntas etiquetadas ofrece práctica.
3. **Banco único etiquetado.** La final sortea de todo; la práctica, del subconjunto del módulo.
4. **Sin temporizador y con retroalimentación inmediata.** Es lo contrario de la final, y es lo que la vuelve formativa.
5. **Intentos ilimitados, sin bloqueo.** El bloqueo de 24 h es exclusivo de la final.
6. **Tabla `practice_attempts` separada**, para que un olvido de filtro no pueda contaminar el conteo de intentos de la final.
7. **Umbral de 3 preguntas.** Por debajo, la práctica no aporta y podría desorientar.
8. **No cuenta para el progreso del curso**, para no volver ambigua la afirmación de finalización de la constancia.

### Riesgo aceptado

Con banco compartido, práctica ilimitada y retroalimentación, un estudiante persistente puede llegar a memorizar buena parte del banco y con ello facilitarse la evaluación final.

Se acepta conscientemente: el propósito es el aprendizaje, la constancia acredita únicamente finalización —no competencia ni aptitud ocupacional, conforme al Decreto 1075— y la alternativa (bancos separados) multiplicaría el costo de autoría sin beneficio proporcional.

Si en el futuro se quisiera cerrar, la vía sería reservar un subconjunto del banco excluido de la práctica.

---

## §5 — Verificación manual

Con dev server limpio y sin recargas forzadas:

1. En un curso en borrador, etiquetar 3 preguntas con el módulo 1 y dejar el resto sin etiquetar.
2. Comprobar que la pantalla de evaluación muestra el conteo por módulo.
3. Publicar el curso y confirmar que el selector de módulo queda bloqueado.
4. Como estudiante, ver "Practicar" en el módulo 1 y **no** en los demás.
5. Iniciar la práctica: sin temporizador, con feedback tras cada respuesta.
6. Con F12 en Network, confirmar que la respuesta correcta **no** llega antes de contestar.
7. Terminar y repetir de inmediato: debe permitirlo.
8. Verificar que el porcentaje de progreso del curso **no** cambió.
9. Ir a la evaluación final: debe seguir mostrando **3 de 3** intentos disponibles.
10. Presentar la final y confirmar 20 minutos, sorteo del banco completo y sin feedback durante el intento.
11. Como admin, confirmar en la ficha del estudiante que la práctica no aparece como intento de evaluación.
12. Importar un YAML con etiquetas de módulo y confirmar que la práctica queda lista.

El paso 9 es el más importante: prueba que practicar no consume intentos de la evaluación final.

---

## §6 — Impacto en el flujo de autoría

Los cursos existentes **no requieren nada**: sin etiquetas, no hay práctica, y todo sigue igual. La adopción es incremental, curso por curso.

Para cursos nuevos conviene actualizar `PROMPT-NOTEBOOKLM-CURSO-YAML.md` para que las preguntas nazcan etiquetadas con su módulo. Es el cambio de mayor retorno: sin él, cada curso exigirá etiquetar a mano en el panel.

Vale la pena que el prompt pida una distribución mínima —por ejemplo 3 o 4 preguntas por módulo más algunas transversales sin etiquetar— para que la práctica quede cubierta desde la importación.
