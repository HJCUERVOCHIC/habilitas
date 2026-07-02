# SPEC-CONSTANCIA-PERFIL

**Bloque E4 — Constancia y perfil (rol estudiante)**

Bloque final del rol `student`. Al **aprobar** la evaluación, se emite la **constancia de
finalización**; existe una **página de verificación pública** compartible, y el
estudiante cuenta con su **panel** (cursos inscritos, progreso y constancias). Con este
bloque queda completo el rol de estudiante y el MVP.

Ver `PLAN-ROL-ESTUDIANTE.md`. Depende de E1–E3 (ya implementados).

**Reglas y convenciones de este bloque:**
- Naming: **"constancia de finalización"**, nunca "certificado".
- **Vigencia desde la emisión** (decisión 3): vence en `emisión + días de vigencia del
  curso`.
- **Disclaimer de educación informal** visible en la constancia y en la verificación.
- **PDF descargable diferido** (fuera de alcance): la página de verificación pública es
  el artefacto compartible del MVP.

**Principio de seguridad/privacidad:** la verificación es pública y **revela el nombre del
titular y el curso** (es la naturaleza de una credencial que el titular decide
compartir). Por eso: búsqueda **solo por código único e inadivinable**, **sin** listado ni
enumeración de constancias, y el resto de datos del estudiante no se expone.

---

## §0 — Verificación previa (NO modificar todavía)

Inspeccionar repo y esquema reales y reportar. No asumir; si algo contradice la §1,
pausar y reportar.

### 0.1 Origen del aprobado y datos
1. Cómo dejó E3 registrado un intento **aprobado** (tabla de intentos, campo `passed`).
   Confirmar cómo detectar de forma fiable que un estudiante aprobó un curso.
2. De dónde sale el **nombre del titular** para la constancia (`public.users` / auth;
   en el admin se ve "HECTOR JAVIER CUERVO R…", así que hay un campo de nombre).
3. Nombre real del campo de **vigencia** en el curso (días) y su valor por defecto.

### 0.2 Esquema de la constancia
4. ¿Existe una tabla de **constancias**? Columnas (user_id, course_id, **código** de
   verificación, `issued_at`, `expires_at`, snapshot de datos como nombre y título del
   curso). ¿UNIQUE (user_id, course_id)? Si NO existe, este bloque la crea.
5. Si existe, cómo se genera el código (debe ser **inadivinable**: UUID o token
   aleatorio, no secuencial).

### 0.3 Rutas, panel y acceso
6. Scaffolding del **panel del estudiante** existente (de E1+): qué muestra hoy y dónde
   vive.
7. Patrón de rutas **públicas** (sin login) en la app, para ubicar la página de
   verificación. Confirmar cómo leer una constancia por código sin autenticación:
   política RLS de SELECT limitada a búsqueda por código, o route handler en servidor.
8. Políticas RLS: el estudiante ve **solo sus** constancias; la verificación pública
   permite leer **una** constancia por su código, sin listar las demás.

---

## §1 — Propuesta de implementación

### 1.1 Emisión de la constancia
- Al **aprobar** (resultado de E3), emitir la constancia de forma **idempotente**: una
  sola por `(user_id, course_id)`. Si ya existe, reutilizarla (no duplicar, no
  re-emitir con nueva fecha).
- Datos: nombre del titular, título del curso, categoría, horas, **fecha de emisión**,
  **fecha de vencimiento** = emisión + días de vigencia del curso, código de
  verificación **inadivinable**, y el disclaimer.
- Guardar un **snapshot** de los datos clave (nombre, título del curso) en la fila de la
  constancia, para que la verificación sea estable aunque el curso cambie después.
- Si hay aprobados registrados por E3 **antes** de existir E4 (sin constancia asociada),
  emitir la constancia al primer acceso (backfill perezoso).

### 1.2 Vista de la constancia (estudiante autenticado)
- Página que muestra la constancia con todos sus datos, el disclaimer, el **código** y el
  **enlace a la verificación pública** (compartible). Wording "constancia de
  finalización".

### 1.3 Verificación pública (sin login)
- Ruta pública (confirmar patrón en §0.7), p. ej. `/verificar/[codigo]`.
- Busca **una** constancia por su código. Muestra: nombre del titular, curso, fecha de
  emisión, fecha de vencimiento, **estado** (vigente / vencida según la fecha actual), y
  el disclaimer.
- Código inexistente → estado claro de "no encontrada". **Sin** listado ni forma de
  enumerar constancias.

### 1.4 Panel del estudiante
- Ampliar el panel para mostrar: **cursos inscritos** con su **progreso** (del E2), y las
  **constancias obtenidas** con enlace a su vista/verificación.

### 1.5 Fuera del alcance
- **PDF** descargable de la constancia (diferido). El artefacto compartible es la página
  de verificación pública.

---

## §2 — Criterios de aceptación

1. Aprobar un curso emite **una** constancia; volver a aprobar / reingresar **no** crea
   una segunda (idempotente por user+course).
2. La constancia usa el wording "constancia de finalización" (nunca "certificado") y
   muestra el disclaimer de educación informal.
3. La **fecha de vencimiento** = fecha de emisión + días de vigencia del curso (vigencia
   desde la emisión).
4. La vista de la constancia (estudiante) muestra el código y el enlace de verificación.
5. La **página de verificación es pública** (sin login) y, con un código válido, muestra
   titular, curso, emisión, vencimiento y estado vigente/vencida.
6. El **código es inadivinable** (UUID/token aleatorio); no hay forma de listar ni
   enumerar constancias desde la ruta pública; un código inexistente muestra "no
   encontrada".
7. Una constancia con fecha de vencimiento pasada se muestra como **vencida** en la
   verificación.
8. El panel del estudiante muestra cursos inscritos con progreso y las constancias
   obtenidas con su enlace.
9. RLS verificada con dos cuentas de estudiante: una no ve las constancias de la otra por
   vías autenticadas; la verificación pública solo devuelve la constancia del código
   consultado.
10. type-check + lint + test (+ build con placeholders) pasan en local (exit 0); CI en
    verde. Cambios no destructivos.

---

## §3 — Prompt de arranque (verificar + implementar en una pasada)

> Lee primero `CLAUDE.md`, `PLAN-ROL-ESTUDIANTE.md` y este archivo
> `SPEC-CONSTANCIA-PERFIL.md`. Vamos a implementar el **Bloque E4 — Constancia y perfil**
> del rol estudiante de Habilitas. Es el bloque final del rol; depende de E1–E3 (ya
> implementados).
>
> Convenciones: "constancia de finalización" (nunca "certificado"); **vigencia desde la
> emisión** (vence en emisión + días de vigencia del curso); disclaimer de educación
> informal visible; **PDF diferido** (la verificación pública es el artefacto
> compartible). Seguridad: la verificación es pública y revela nombre del titular y curso;
> búsqueda **solo por código inadivinable**, sin listado ni enumeración.
>
> Trabaja en una sola pasada: **verifica primero** (§0) y luego implementa (§1), pausando
> solo si algo contradice el spec.
>
> **Verifica (sin asumir) y reporta:**
> 1. Cómo dejó E3 registrado un intento aprobado y cómo detectar que un estudiante aprobó;
>    de dónde sale el nombre del titular; nombre y default del campo de vigencia del curso.
> 2. Si existe tabla de constancias y sus columnas (código, issued_at, expires_at,
>    snapshot), UNIQUE (user_id, course_id) y cómo se genera el código.
> 3. Scaffolding del panel del estudiante; patrón de rutas públicas y cómo leer una
>    constancia por código sin login (RLS por código o route handler); políticas RLS de
>    constancias.
>
> **Implementa:**
> 1. Emisión idempotente al aprobar (una por user+course; reutiliza si existe), con
>    nombre, curso, categoría, horas, emisión, vencimiento = emisión + vigencia, código
>    inadivinable, disclaimer, y snapshot de datos clave. Backfill perezoso para aprobados
>    de E3 previos sin constancia.
> 2. Vista de la constancia (estudiante) con código y enlace de verificación.
> 3. Página de verificación pública (sin login) que busca una constancia por código y
>    muestra titular, curso, emisión, vencimiento y estado vigente/vencida; código
>    inexistente → "no encontrada"; sin listado ni enumeración.
> 4. Ampliar el panel del estudiante: cursos inscritos con progreso (E2) y constancias
>    obtenidas con enlace.
> 5. Si falta la tabla de constancias, créala con código inadivinable, UNIQUE
>    (user_id, course_id) y RLS: estudiante SELECT solo lo suyo; verificación pública
>    limitada a búsqueda por código.
>
> **No** implementes el PDF descargable (diferido).
>
> Verifica los criterios de la §2, en especial la emisión idempotente, la vigencia desde
> la emisión, el código inadivinable sin enumeración, y la RLS con dos cuentas de
> estudiante. Antes de pushear, corre en local type-check + lint + test (+ build con
> placeholders) y confirma exit 0 en todos; no pushees con el CI en rojo. Cambios no
> destructivos; respalda antes de cualquier operación destructiva.
