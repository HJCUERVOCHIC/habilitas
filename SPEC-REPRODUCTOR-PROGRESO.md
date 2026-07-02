# SPEC-REPRODUCTOR-PROGRESO

**Bloque E2 — Reproductor y progreso (rol estudiante)**

Segundo bloque del rol `student`. El estudiante **inscrito** recorre un curso: navega el
temario, consume lecciones (Markdown en línea, video, y otros recursos), y el sistema
registra su progreso. La navegación es con **desbloqueo progresivo**: para abrir una
lección debe haber completado la anterior.

Ver `PLAN-ROL-ESTUDIANTE.md` para el mapa completo. Depende del Bloque E1 (catálogo e
inscripción) ya implementado.

**Nota de consistencia:** el desbloqueo progresivo aplica al **contenido de lecciones**.
La **evaluación es de acceso directo** (decisión 2 del plan): completar las lecciones
**no** es requisito para evaluarse. La evaluación es del Bloque E3 y queda fuera de este
bloque.

---

## §0 — Verificación previa (NO modificar todavía)

Inspeccionar repo y esquema reales y reportar. No asumir; si algo contradice la §1,
pausar y reportar.

### 0.1 Punto de entrada y scaffolding
1. En E1, el botón **"Continuar curso"** enlaza a una ruta de reproductor. Confirma la
   ruta exacta que E1 espera para construir el reproductor ahí.
2. ¿Existe algún componente de reproductor o de renderizado de lección reutilizable?
   ¿Cómo renderiza el admin el `body_md` (qué componente/librería de Markdown)? Reutilizar
   el mismo renderizador.

### 0.2 Esquema de datos
3. Tabla de lecciones: nombre real de la columna del cuerpo (`body_md`/`contenido_md`),
   los **tipos** válidos (p. ej. `texto`/`video`/`recurso` o `text`/`video`/`pdf`/`slides`/
   `image`), duración, `order_index`, y el campo de **URL de medio** con su convención
   `PENDIENTE`.
4. Tabla de módulos: `order_index` para ordenar el temario.
5. Tabla de **progreso** (`lesson_progress` o equivalente): ¿existe? Columnas (user_id,
   lesson_id, completed/completed_at) y si tiene **UNIQUE (user_id, lesson_id)**. Si NO
   existe, este bloque la crea.
6. Cómo verificar que el estudiante actual está **inscrito** en el curso (la tabla de
   inscripciones de E1).

### 0.3 Medios (R2) y acceso
7. ¿Existe ya lógica de **URLs prefirmadas** de R2 (del Bloque 2 del admin) reutilizable
   para servir video/PDF/diapositivas/imágenes? ¿Está R2 configurado (env vars
   presentes) o sigue pendiente? Confirma el estado de degradación elegante cuando R2 no
   está configurado o la URL es `PENDIENTE`.
8. Qué cliente usa el estudiante para leer contenido (autenticado con RLS, no service
   role).
9. Políticas **RLS**: ¿un estudiante inscrito puede leer módulos y lecciones de un curso
   **publicado** en el que está **inscrito**? ¿el progreso es visible/escribible solo por
   su dueño? Pega las políticas relevantes.

---

## §1 — Propuesta de implementación

### 1.1 Reproductor y acceso
- Construir el reproductor en la ruta confirmada en §0.1.
- **Acceso restringido:** solo estudiante autenticado **inscrito** en un curso
  **publicado**. Si no está inscrito → redirigir al detalle del curso (para inscribirse).
  Si no está autenticado → Magic Link y regresar.
- Layout: **temario** (módulos → lecciones, ordenados por `order_index`) como navegación
  lateral, y el área principal que renderiza la lección actual.

### 1.2 Desbloqueo progresivo
- La **primera** lección del curso está abierta. Cada lección siguiente se **desbloquea**
  cuando la anterior queda **completada**.
- Las lecciones bloqueadas se muestran con estado de bloqueo (candado), no navegables.
- Las completadas se marcan como tal (check) en el temario.

### 1.3 Renderizado y completado por tipo de lección
- **Texto / Markdown:** renderizar `body_md` con el mismo renderizador del admin.
  Completado = botón **"Marcar como completada"** (manual).
- **Video:** reproducir vía URL prefirmada de R2. Completado **automático** al alcanzar
  **≥90%** de reproducción (el umbral se valida del lado servidor/registro, no solo en el
  cliente).
- **Otros recursos (PDF / diapositivas / imagen):** mostrar/enlazar vía R2. Completado =
  botón "Marcar como completada" (manual).
- **Degradación elegante de medios:** si R2 no está configurado o la URL es `PENDIENTE`,
  la lección de medio muestra un estado claro de "contenido no disponible" y **permite
  marcado manual** para no bloquear la progresión durante la fase previa a R2.
  *(Nota: el curso de prueba "Manejo del Duelo" es todo lecciones de Texto, así que E2 se
  puede probar completo sin R2.)*

### 1.4 Progreso
- Registrar el completado en la tabla de progreso por **usuario + lección**, idempotente
  (UNIQUE user_id+lesson_id; recompletar no duplica ni falla).
- Al completar una lección, se desbloquea la siguiente y el temario refleja el avance.
- Botón "Siguiente lección" para avanzar.

### 1.5 Esquema y RLS
- Si la tabla de progreso no existe, crearla con UNIQUE (user_id, lesson_id) y RLS:
  el estudiante **INSERT/UPDATE/SELECT solo su propio** progreso.
- RLS de contenido: un estudiante solo puede leer módulos/lecciones de cursos
  **publicados** en los que está **inscrito**.

### 1.6 Fuera del alcance (bloques siguientes)
- **Evaluación** (E3) y **constancia** (E4). El reproductor **no** construye la entrada a
  la evaluación en este bloque; recordar que, cuando se construya, la evaluación será de
  acceso directo (no gated por completar lecciones).

---

## §2 — Criterios de aceptación

1. Solo un estudiante **inscrito** accede al reproductor de un curso publicado; un no
   inscrito es redirigido al detalle; un no autenticado va al Magic Link.
2. El temario lista módulos y lecciones en el orden correcto, con estados de
   bloqueado / actual / completado.
3. La primera lección está abierta; las siguientes permanecen bloqueadas hasta completar
   la anterior (desbloqueo progresivo).
4. Una lección de **texto** se renderiza como Markdown y se completa con "Marcar como
   completada".
5. Una lección de **video** (con R2 disponible) se completa automáticamente al alcanzar
   ≥90% de reproducción.
6. Con R2 no configurado o URL `PENDIENTE`, la lección de medio muestra "contenido no
   disponible" y permite marcado manual; la progresión no se bloquea.
7. Completar una lección registra **una** fila de progreso; recompletar no duplica.
8. El curso "Manejo del Duelo" (todo Texto) se puede recorrer completo de inicio a fin,
   desbloqueando lección por lección.
9. RLS verificada con dos cuentas de estudiante distintas: una no ve el progreso de la
   otra, y un estudiante no inscrito no puede leer el contenido del curso.
10. type-check + lint + test (+ build con placeholders) pasan en local (exit 0); CI en
    verde. Cambios no destructivos.

---

## §3 — Prompt de arranque (verificar + implementar en una pasada)

> Lee primero `CLAUDE.md`, `PLAN-ROL-ESTUDIANTE.md` y este archivo
> `SPEC-REPRODUCTOR-PROGRESO.md`. Vamos a implementar el **Bloque E2 — Reproductor y
> progreso** del rol estudiante de Habilitas. Depende del E1 (ya implementado).
>
> Trabaja en una sola pasada: **verifica primero** (§0) y luego implementa (§1), pausando
> solo si encuentras algo que contradiga el spec.
>
> **Verifica (sin asumir) y reporta brevemente:**
> 1. La ruta de reproductor que el botón "Continuar curso" de E1 espera; y el
>    componente/librería con que el admin renderiza `body_md` (reutilizarlo).
> 2. Esquema: columna del cuerpo de lección, tipos válidos, `order_index` de módulos y
>    lecciones, campo de URL de medio y convención `PENDIENTE`; si existe la tabla de
>    progreso y su UNIQUE (user_id, lesson_id); cómo verificar que el estudiante está
>    inscrito (tabla de E1).
> 3. Si hay lógica de URLs prefirmadas de R2 reutilizable y si R2 está configurado o
>    pendiente; qué cliente usa el estudiante para leer (autenticado con RLS); políticas
>    RLS de módulos/lecciones (inscrito + publicado) y de progreso (solo dueño).
>
> **Implementa:**
> 1. Reproductor en la ruta confirmada, con acceso solo para estudiante autenticado e
>    **inscrito** en curso publicado (no inscrito → detalle; no autenticado → Magic Link).
>    Layout con temario (módulos→lecciones por order_index) y área de lección actual.
> 2. **Desbloqueo progresivo:** primera lección abierta; cada siguiente se desbloquea al
>    completar la anterior; bloqueadas con candado, completadas con check.
> 3. Renderizado y completado por tipo: texto/Markdown → "Marcar como completada"
>    (manual); video → completado automático al ≥90% de reproducción (validado en
>    registro/servidor); otros recursos → manual. Degradación elegante si R2 no
>    configurado o URL `PENDIENTE`: "contenido no disponible" + marcado manual para no
>    bloquear progresión.
> 4. Registrar progreso por usuario+lección, idempotente (UNIQUE user_id+lesson_id). Si la
>    tabla de progreso no existe, créala con esa UNIQUE y RLS (dueño INSERT/UPDATE/SELECT).
>    Ajusta RLS de contenido: leer módulos/lecciones solo de cursos publicados donde el
>    estudiante está inscrito.
>
> **No** construyas evaluación ni constancia (E3/E4), ni la entrada a la evaluación.
>
> Verifica los criterios de la §2, en especial el recorrido completo del curso "Manejo
> del Duelo" (todo Texto) y la RLS con dos cuentas de estudiante distintas. Antes de
> pushear, corre en local type-check + lint + test (+ build con placeholders) y confirma
> exit 0 en todos; no pushees con el CI en rojo. Cambios no destructivos; respalda antes
> de cualquier operación destructiva.
