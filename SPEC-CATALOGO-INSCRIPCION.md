# SPEC-CATALOGO-INSCRIPCION

**Bloque E1 — Catálogo e inscripción (fundación del rol estudiante)**

Primer bloque del rol `student`. El estudiante (o un visitante) ve los cursos
**publicados**, entra al detalle de un curso, y —autenticado— se inscribe con un botón
explícito. Es la base del frente: sin inscripción no hay contenido que consumir en los
bloques siguientes.

Ver `PLAN-ROL-ESTUDIANTE.md` para el mapa completo y las decisiones bloqueadas.

---

## §0 — Verificación previa (NO modificar todavía)

Inspeccionar el repo y el esquema reales y reportar hallazgos. No asumir nada de lo
siguiente; confirmarlo en código y base de datos. Si algo entra en conflicto con la §1,
pausar y reportar antes de implementar.

### 0.1 Scaffolding de estudiante existente
1. ¿Qué rutas/páginas del lado del estudiante ya existen? (dashboard del estudiante,
   catálogo, detalle público de curso). Lista el árbol relevante bajo `app/`.
2. Del Bloque 0: cómo enruta por rol el inicio de sesión y a dónde aterriza un `student`
   tras el Magic Link. Confirma el/los valores reales de `role` en `public.users`
   (`'student'` vs `'estudiante'`, etc.).
3. ¿El catálogo ya existe en alguna forma? El spec del Bloque 4 pedía "confirmar que el
   catálogo usa el estado publicado sin implementarlo"; verifica si quedó algún esbozo.

### 0.2 Esquema de datos
4. Tabla de cursos: nombre real de la columna de **estado** y el valor que marca
   publicado (`estado='publicado'` vs `status='published'`), y `published_at`. Campos de
   presentación disponibles para las tarjetas y el detalle (título, subtítulo,
   descripción, objetivos, categoría, dificultad, horas). Confirma que el detalle va por
   **slug**.
5. Tabla de **inscripciones** (`enrollments` o equivalente): ¿existe? Si existe, sus
   columnas (user_id, course_id, created_at, estado) y si hay restricción **UNIQUE
   (user_id, course_id)**. Si NO existe, este bloque la crea.
6. Relación curso → módulos → lecciones (para el temario del detalle, solo lectura).

### 0.3 Acceso a datos y RLS
7. Qué **cliente** usa el lado del estudiante para leer (debe ser el cliente
   autenticado por sesión, con RLS activa; NO el service role). Compáralo con lo que
   usa el admin.
8. Políticas **RLS** actuales sobre la tabla de cursos: ¿un usuario no-admin puede leer
   cursos publicados? ¿los borradores quedan ocultos para el estudiante? Pega las
   políticas de SELECT.
9. Políticas RLS sobre la tabla de inscripciones (si existe): ¿puede un estudiante
   INSERT su propia inscripción y SELECT solo las suyas?
10. Util central `slugify` (para consistencia de las rutas por slug).

---

## §1 — Propuesta de implementación

### 1.1 Catálogo
- Página de catálogo (confirmar ruta real en §0; p. ej. `/cursos`) accesible a
  **visitantes y estudiantes**.
- Lista solo cursos **publicados** (usando el campo/valor real confirmado en §0.4),
  como tarjetas: título, categoría, subtítulo/resumen, y distintivo **"Gratis durante
  el lanzamiento"**.
- **Disclaimer de educación informal** visible (usar el footer/componente global si ya
  existe).
- Estado vacío claro cuando no hay cursos publicados.

### 1.2 Detalle del curso (óptica del estudiante)
- Ruta por **slug**, distinta de la de edición del admin (`/cursos/[slug]`, no
  `/admin/cursos/[slug]`).
- Muestra: descripción, objetivos, **temario** de módulos y lecciones en **solo
  lectura** (títulos, tipo y duración; sin acceso al contenido todavía), categoría,
  dificultad, horas, y el disclaimer.
- Botón de acción según estado del usuario:
  - **Visitante no autenticado** → "Inscribirme" que lleva al inicio de sesión (Magic
    Link) y regresa al detalle.
  - **Estudiante no inscrito** → "Inscribirme" (dispara la acción de inscripción).
  - **Estudiante ya inscrito** → "Continuar curso" que enlaza a la ruta del reproductor.
    *(El reproductor es del Bloque E2; hasta implementarlo, esa ruta puede no existir
    aún — el criterio de aceptación de E1 valida el cambio de estado del botón y el
    registro de inscripción, no el reproductor.)*

### 1.3 Acción de inscripción (server action)
- Requiere **estudiante autenticado**. Un admin no se inscribe (roles excluyentes).
- Crea el registro en la tabla de inscripciones para el usuario actual + curso.
- **Idempotente**: si ya está inscrito, no duplica (apoyarse en UNIQUE (user_id,
  course_id); ante conflicto, tratar como "ya inscrito", no como error).
- Solo permite inscribirse a cursos **publicados**.
- Tras inscribir, el detalle refleja el estado "inscrito" (botón → "Continuar curso").

### 1.4 Esquema y RLS
- Si la tabla de inscripciones no existe, crearla con: `user_id` (FK a users),
  `course_id` (FK a courses), `created_at`, y **UNIQUE (user_id, course_id)**.
- RLS:
  - Cursos: SELECT permitido para leer **publicados** a estudiantes/visitantes; los
    borradores permanecen ocultos para no-admin.
  - Inscripciones: el estudiante puede **INSERT** su propia inscripción y **SELECT**
    solo las suyas. Nadie ve inscripciones ajenas.

### 1.5 Fuera del alcance (bloques siguientes)
Reproductor y consumo de lecciones, progreso, evaluación y constancia. En E1 el temario
es solo lectura y no se accede al contenido de ninguna lección.

---

## §2 — Criterios de aceptación

1. El catálogo lista **solo** cursos publicados; un borrador no aparece nunca en el
   catálogo del estudiante/visitante.
2. El catálogo muestra el distintivo "Gratis durante el lanzamiento" y el disclaimer de
   educación informal; hay estado vacío cuando no hay publicados.
3. El detalle por slug muestra descripción, objetivos y temario (módulos/lecciones) en
   solo lectura, sin acceso al contenido.
4. Un visitante no autenticado que pulsa "Inscribirme" es llevado al Magic Link y, tras
   entrar, regresa al detalle.
5. Un estudiante autenticado y no inscrito puede inscribirse; se crea exactamente **una**
   fila de inscripción.
6. Inscribirse de nuevo en el mismo curso **no** crea una segunda fila (idempotente) ni
   arroja error al usuario.
7. Tras inscribirse, el botón pasa a "Continuar curso".
8. Un administrador no puede inscribirse (roles excluyentes); no se rompe la app si lo
   intenta.
9. RLS verificada: un estudiante no puede leer cursos en borrador ni inscripciones de
   otros usuarios (probar con dos cuentas de estudiante distintas).
10. type-check + lint + test (+ build con placeholders) pasan en local (exit 0) antes de
    pushear; CI en verde. Cambios no destructivos.

---

## §3 — Prompt de arranque (verificar + implementar en una pasada)

> Lee primero `CLAUDE.md`, `PLAN-ROL-ESTUDIANTE.md` y este archivo
> `SPEC-CATALOGO-INSCRIPCION.md`. Vamos a implementar el **Bloque E1 — Catálogo e
> inscripción** del rol estudiante de Habilitas.
>
> Trabaja en una sola pasada: **verifica primero** (§0) y luego implementa (§1),
> pausando solo si encuentras algo que contradiga el spec.
>
> **Verifica (sin asumir) y reporta brevemente:**
> 1. Scaffolding de estudiante existente (rutas bajo `app/`), enrutamiento por rol del
>    Bloque 0 y valor real de `role` para estudiante; si ya hay algún esbozo de catálogo.
> 2. Esquema: columna/valor real de estado publicado en cursos y `published_at`; campos
>    de presentación; que el detalle va por slug; si existe la tabla de inscripciones y
>    su UNIQUE (user_id, course_id); la cadena curso→módulos→lecciones.
> 3. Qué cliente usa el estudiante para leer (debe ser el autenticado con RLS, no
>    service role); políticas RLS de SELECT en cursos (publicados visibles, borradores
>    ocultos para no-admin) y en inscripciones; la util `slugify`.
>
> **Implementa:**
> 1. Catálogo (ruta real confirmada) accesible a visitantes y estudiantes: solo cursos
>    publicados, como tarjetas con "Gratis durante el lanzamiento" y el disclaimer de
>    educación informal; estado vacío incluido.
> 2. Detalle por slug (óptica del estudiante, distinta de `/admin/cursos/[slug]`):
>    descripción, objetivos, temario de módulos/lecciones en solo lectura, y el botón:
>    "Inscribirme" (visitante → Magic Link y regresa; estudiante no inscrito → inscribe)
>    o "Continuar curso" (ya inscrito) enlazando a la ruta del reproductor (del E2; puede
>    no existir aún).
> 3. Server action de inscripción: estudiante autenticado, solo cursos publicados, crea
>    la inscripción de forma **idempotente** (UNIQUE user_id+course_id; conflicto = "ya
>    inscrito", no error); un admin no se inscribe.
> 4. Si la tabla de inscripciones no existe, créala con UNIQUE (user_id, course_id) y las
>    RLS: estudiante INSERT/SELECT solo lo suyo. Ajusta RLS de cursos para que
>    publicados sean visibles a no-admin y los borradores queden ocultos.
>
> **No** construyas reproductor, progreso, evaluación ni constancia (bloques
> siguientes); el temario es solo lectura.
>
> Verifica al final los criterios de la §2, en especial la RLS con dos cuentas de
> estudiante distintas. Antes de pushear, corre en local type-check + lint + test (+
> build con placeholders) y confirma exit 0 en todos; no pushees con el CI en rojo.
> Cambios no destructivos; respalda antes de cualquier operación destructiva.
