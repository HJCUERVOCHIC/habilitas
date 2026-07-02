# SPEC-EVALUACION

**Bloque E3 — Evaluación (rol estudiante)**

Tercer bloque del rol `student`. El estudiante **inscrito** rinde la evaluación final del
curso: un intento con 10 preguntas al azar del banco, con temporizador, calificación en
servidor y control de intentos. Al aprobar queda registrado el resultado que habilitará
la constancia (E4).

Ver `PLAN-ROL-ESTUDIANTE.md`. Depende de E1 (inscripción) y E2 (reproductor). El acceso a
la evaluación es **directo** (decisión 2): **no** requiere haber completado las lecciones.

**Reglas bloqueadas de este bloque:**
- 10 preguntas al azar del banco (15–20 por curso).
- **Temporizador: 20 minutos** por intento (fijo). Validado en **servidor** (`started_at`);
  el conteo del cliente es solo visual.
- **Sin feedback por pregunta** durante el intento.
- Calificación contra el **puntaje mínimo** del curso.
- **Intentos** por curso (campo existente). Al agotarlos sin aprobar → **bloqueo de 24
  horas** (fijo) antes de poder reintentar.
- **Revisión completa solo tras aprobar**; los reintentos usan **preguntas distintas**.

**Principio de seguridad (no negociable):** las respuestas correctas **nunca** viajan al
cliente durante el intento. La calificación es **100% server-side**.

---

## §0 — Verificación previa (NO modificar todavía)

Inspeccionar repo y esquema reales y reportar. No asumir; si algo contradice la §1,
pausar y reportar.

### 0.1 Punto de entrada
1. Desde dónde accede el estudiante a la evaluación (detalle del curso, reproductor).
   Confirma la ruta existente o la que hay que crear. Recordar: acceso **directo**, no
   gated por progreso de lecciones.

### 0.2 Esquema de datos
2. Banco de preguntas: nombre real de las tablas de **preguntas** y **opciones**,
   estructura de opciones y cómo se marca la **correcta**. Cuántas preguntas tiene hoy el
   curso "Manejo del Duelo" (necesita ≥10 para un intento; si el banco está vacío,
   reportarlo — el curso de duelo pudo importarse sin banco).
3. Curso: nombres reales de **puntaje mínimo** e **intentos** (los campos vistos como
   "Puntaje mín. %" e "Intentos"). Confirmar que 20 min y 24 h serán **constantes fijas**
   (no campos por curso).
4. Tabla de **intentos** (`attempts`/`evaluation_attempts` o equivalente): ¿existe? Qué
   guarda (user_id, course_id, started_at, submitted_at, score, passed, y el **set de
   preguntas** y **respuestas** del intento para la revisión). Si NO existe, este bloque
   la crea.
5. Cómo verificar que el estudiante está **inscrito** (tabla de E1).

### 0.3 Acceso y RLS
6. Qué cliente usa el estudiante (autenticado con RLS). Confirmar que existe un camino de
   ejecución en **servidor** (server action / route handler) para iniciar y calificar el
   intento sin exponer respuestas al cliente.
7. Políticas RLS: el estudiante solo puede leer/crear **sus propios** intentos; las
   respuestas correctas no deben ser legibles por el cliente. Pega las políticas
   relevantes de preguntas/opciones/intentos.

---

## §1 — Propuesta de implementación

### 1.1 Entrada y pantalla previa
- Entrada a la evaluación para estudiante **inscrito** (acceso directo). No inscrito →
  detalle; no autenticado → Magic Link.
- Pantalla previa con las **reglas**: 10 preguntas, 20 minutos, puntaje mínimo del curso,
  **intentos restantes**, y aviso de "sin feedback durante el intento". Botón **"Iniciar
  intento"**.
- Si los intentos están agotados y el bloqueo de 24 h sigue activo: mostrar el estado de
  bloqueo con **cuándo podrá reintentar** (fecha/hora), sin permitir iniciar.

### 1.2 Iniciar intento (servidor)
- Server action crea la fila de intento con `started_at` = ahora, y **sortea 10
  preguntas** del banco del curso.
- Entrega al cliente las 10 preguntas y sus opciones **sin** marcar la correcta.
- Guarda el set de preguntas sorteadas asociado al intento (para calificar y para la
  revisión posterior).

### 1.3 Durante el intento
- El cliente muestra un **contador visual** derivado de `started_at + 20 min`.
- **Sin feedback por pregunta.** El estudiante responde y puede navegar entre preguntas.
- Si el estudiante recarga o vuelve: si el intento sigue **abierto y dentro del tiempo**,
  se **reanuda**; si el tiempo ya expiró, el servidor lo cierra y califica lo respondido.

### 1.4 Enviar y calificar (servidor)
- Al enviar (o al expirar el tiempo → **auto-envío**), el servidor:
  - Verifica que el tiempo transcurrido no exceda los 20 min (el servidor es la fuente de
    verdad; lo enviado fuera de tiempo no cuenta).
  - **Califica** comparando contra las respuestas correctas en servidor; calcula el
    puntaje y lo compara con el **puntaje mínimo**.
  - Registra `submitted_at`, `score`, `passed` y las respuestas del estudiante.

### 1.5 Resultado
- **Aprobado:** mensaje de aprobación + **revisión completa** (preguntas, respuesta del
  estudiante, respuesta correcta y explicación si existe). El registro del intento
  aprobado es lo que habilitará la **constancia (E4)**; la emisión de la constancia es de
  E4, no de este bloque.
- **Reprobado con intentos restantes:** puntaje + intentos restantes + **"Reintentar"**
  (nuevo intento con **preguntas distintas**). **Sin** revisión.
- **Reprobado sin intentos restantes:** puntaje + **bloqueo de 24 h** con la fecha/hora a
  partir de la cual podrá reintentar. **Sin** revisión.

### 1.6 Intentos y bloqueo
- Respetar el número de **intentos** del curso. Al agotarlos sin aprobar, fijar bloqueo de
  **24 h** desde el último intento. Transcurrido el bloqueo, se **reinicia la ventana de
  intentos** (el estudiante vuelve a disponer de sus intentos). *(Interpretación asumida;
  ajustar si se prefiere otro modelo.)*
- Un intento **aprobado** cierra la evaluación: no se sigue reintentando.

### 1.7 Esquema, constantes y RLS
- Constantes fijas: temporizador **20 min**, bloqueo **24 h**, **10** preguntas por
  intento. (No campos por curso.)
- Si la tabla de intentos no existe, crearla con lo necesario para calificar y revisar
  (set de preguntas + respuestas del estudiante + score + passed + tiempos) y RLS:
  estudiante **INSERT/SELECT solo lo suyo**.
- Garantizar que preguntas/opciones se sirvan al cliente **sin** la marca de correcta;
  las respuestas correctas solo se leen en servidor al calificar.

### 1.8 Fuera del alcance
- Emisión de **constancia** y su verificación (E4). Este bloque solo deja registrado el
  intento aprobado.

---

## §2 — Criterios de aceptación

1. Un estudiante inscrito accede a la evaluación **sin** haber completado lecciones
   (acceso directo); no inscrito → detalle; no autenticado → Magic Link.
2. Al iniciar, se sortean **10** preguntas del banco; el cliente **no** recibe cuáles son
   las correctas (verificable en el payload de red).
3. El contador visual arranca en 20 min; al expirar, el servidor **auto-envía** y
   califica lo respondido; lo enviado fuera de tiempo no cuenta.
4. La calificación ocurre en servidor y se compara con el puntaje mínimo del curso.
5. No hay feedback por pregunta durante el intento.
6. Aprobar muestra la **revisión completa**; reprobar **no** muestra revisión.
7. Reprobar con intentos restantes permite **reintentar** con **preguntas distintas**.
8. Agotar los intentos sin aprobar activa el **bloqueo de 24 h** e indica cuándo podrá
   reintentar; no se puede iniciar durante el bloqueo.
9. Un intento aprobado cierra la evaluación (no más reintentos) y queda registrado para la
   constancia (E4).
10. RLS verificada con dos cuentas de estudiante: una no ve los intentos de la otra.
11. type-check + lint + test (+ build con placeholders) pasan en local (exit 0); CI en
    verde. Cambios no destructivos.

---

## §3 — Prompt de arranque (verificar + implementar en una pasada)

> Lee primero `CLAUDE.md`, `PLAN-ROL-ESTUDIANTE.md` y este archivo `SPEC-EVALUACION.md`.
> Vamos a implementar el **Bloque E3 — Evaluación** del rol estudiante de Habilitas.
> Depende de E1 y E2 (ya implementados). Acceso a la evaluación **directo** (no gated por
> progreso de lecciones).
>
> Reglas fijas: 10 preguntas al azar del banco, temporizador de **20 min** validado en
> **servidor** (`started_at`; cliente solo visual), sin feedback por pregunta, puntaje
> mínimo del curso, intentos del curso, y **bloqueo de 24 h** al agotarlos. Revisión solo
> tras aprobar; reintentos con preguntas distintas. **Principio no negociable: las
> respuestas correctas nunca llegan al cliente; la calificación es server-side.**
>
> Trabaja en una sola pasada: **verifica primero** (§0) y luego implementa (§1), pausando
> solo si algo contradice el spec.
>
> **Verifica (sin asumir) y reporta:**
> 1. Ruta de entrada a la evaluación (existente o a crear).
> 2. Tablas de preguntas/opciones y cómo se marca la correcta; cuántas preguntas tiene el
>    banco del curso "Manejo del Duelo" (¿≥10? ¿vacío?). Nombres reales de puntaje mínimo e
>    intentos en el curso. Si existe tabla de intentos y qué guarda; cómo verificar
>    inscripción.
> 3. Que existe un camino de ejecución en servidor para iniciar/calificar sin exponer
>    respuestas; políticas RLS de preguntas/opciones/intentos.
>
> **Implementa:**
> 1. Pantalla previa con reglas (10 preguntas, 20 min, puntaje mínimo, intentos
>    restantes, sin feedback) y "Iniciar intento"; si hay bloqueo de 24 h activo, mostrar
>    cuándo podrá reintentar y no permitir iniciar.
> 2. Iniciar intento en servidor: crea el intento con `started_at`, sortea 10 preguntas,
>    entrega opciones **sin** la correcta, guarda el set sorteado.
> 3. Durante: contador visual (started_at+20min), sin feedback; reanudar si vuelve dentro
>    del tiempo, cerrar/calificar si expiró.
> 4. Enviar/expirar → servidor verifica tiempo, califica contra respuestas correctas,
>    compara con puntaje mínimo, registra score/passed/tiempos/respuestas.
> 5. Resultado: aprobado → revisión completa (deja el intento aprobado registrado para la
>    constancia de E4, sin emitirla aquí); reprobado con intentos → reintentar con
>    preguntas distintas, sin revisión; reprobado sin intentos → bloqueo 24 h con
>    fecha/hora de reintento, sin revisión. Aprobar cierra la evaluación.
> 6. Constantes fijas (20 min / 24 h / 10 preguntas). Si falta la tabla de intentos,
>    créala con lo necesario para calificar y revisar, con RLS (estudiante solo lo suyo).
>    Servir preguntas/opciones sin la marca de correcta.
>
> **No** emitas constancia ni su verificación (E4).
>
> Verifica los criterios de la §2, en especial que el cliente no reciba las respuestas
> correctas (revisar payload), la validación de tiempo en servidor, y la RLS con dos
> cuentas de estudiante. Antes de pushear, corre en local type-check + lint + test (+
> build con placeholders) y confirma exit 0 en todos; no pushees con el CI en rojo.
> Cambios no destructivos; respalda antes de cualquier operación destructiva.
