# Habilitas — Guía de navegación (para casos de prueba)

Esta guía explica **cómo funciona la plataforma de cara al usuario** y **cómo se llega a cada pantalla**. Está pensada para diseñar casos de prueba de navegación. No entra en temas técnicos ni de arquitectura.

> En desarrollo, la plataforma corre en `http://localhost:3000`. Las rutas de abajo se anteponen con esa dirección.

---

## 1. Quién usa la plataforma

| Tipo de usuario | ¿Necesita iniciar sesión? | Qué puede hacer |
|---|---|---|
| **Visitante** | No | Ver la landing y el catálogo, abrir el detalle de un curso, verificar un certificado por su enlace. |
| **Profesional (estudiante)** | Sí (Magic Link) | Inscribirse a cursos, ver el contenido, rendir la evaluación, obtener y ver sus certificados, editar su perfil. |
| **Administrador** | Sí + rol admin | Todo lo del estudiante, más el panel `/admin`: crear/editar cursos, módulos, lecciones, preguntas, publicar y revocar certificados. |
| **Empleador / verificador** | No | Solo abre el enlace o el QR de un certificado para validarlo. No tiene cuenta. |

**Cómo se inicia sesión:** no hay contraseñas. Se ingresa el correo en `/ingresar`, llega un **enlace mágico** al email, y al hacer clic en ese enlace queda la sesión iniciada.

---

## 2. Niveles de acceso (clave para las pruebas)

Cada página tiene un nivel de acceso. Si no se cumple, la plataforma **redirige** (esto es lo que conviene probar):

| Situación | Qué debe pasar |
|---|---|
| Visitante (sin sesión) entra a `/perfil`, `/curso/...` o `/admin` | Redirige a **`/ingresar`** (y al iniciar sesión vuelve a la página que intentaba). |
| Usuario con sesión, **no inscrito**, entra a `/curso/[slug]` | Redirige al **detalle del curso** (`/certificaciones/[slug]`) para que se inscriba. |
| Usuario con sesión pero **sin rol admin** entra a `/admin` | Redirige a la **landing** (`/`). |
| Se abre el detalle de un curso que **no existe** | Página **404**. |
| Se verifica un `cert_id` que **no existe** | Pantalla amable **"Certificado no encontrado"** (no es un error). |

---

## 3. Mapa de páginas

| Pantalla | Ruta | Acceso | Cómo se llega |
|---|---|---|---|
| Landing (inicio) | `/` | Público | URL raíz. |
| Catálogo | `/certificaciones` | Público | CTA "Ver certificaciones" en la landing, o enlace "Certificaciones" en la barra superior. |
| Detalle de curso | `/certificaciones/[slug]` | Público | Clic en una tarjeta del catálogo. |
| Ingreso | `/ingresar` | Público | Enlace "Ingresar" en la barra superior, o al intentar entrar a una página protegida. |
| Reproductor del curso | `/curso/[slug]` | Sesión + inscripción | Botón "Comenzar curso" del detalle, o "Continuar" desde el perfil. |
| Evaluación | (ventana sobre el curso) | Sesión + módulos completos | Botón "Comenzar evaluación" en la barra del curso. |
| Verificación pública | `/verificar/[id]` | Público | Búsqueda "Verificar un certificado" en la landing, enlace/QR del certificado, o "Ver" desde el perfil. |
| Perfil | `/perfil` | Sesión | Destino al iniciar sesión, o enlace "← Mis cursos" en la barra del curso. |
| Panel admin | `/admin` | Sesión + rol admin | Se entra escribiendo la URL (no hay enlace público). |

---

## 4. Recorrido pantalla por pantalla

### 4.1 Landing — `/`
**Para qué:** presentar la plataforma y dirigir a la acción.
**Cómo llegar:** abrir la dirección raíz.
**Qué hay y a dónde lleva:**
- Botón **"Ver certificaciones"** → catálogo (`/certificaciones`).
- Campo **"Verificar un certificado"**: se escribe un `cert_id` (ej. `HAB-2026-0001`) y lleva a su página de verificación.
- Sección "Cómo funciona" (4 pasos, informativa).
- Banner para instituciones con botón **"Contáctanos"** (abre el correo).
- Barra superior: **"Certificaciones"** y **"Ingresar"**.
- Footer: enlaces a "Certificaciones" e "Ingresar".

### 4.2 Catálogo — `/certificaciones`
**Para qué:** ver los cursos disponibles.
**Cómo llegar:** desde la landing o la barra superior.
**Qué hay:**
- Grilla de tarjetas (solo cursos publicados). Cada tarjeta muestra categoría (con color), título, descripción, duración, dificultad y el sello "Gratis durante el lanzamiento".
- **Filtro por categoría** ("Todas" + las categorías existentes) y un **contador** de resultados.
- Botón **"Ver detalle →"** en cada tarjeta → detalle del curso.

**Para probar:** que el filtro muestre solo la categoría elegida; que el contador cambie; que cada tarjeta abra el curso correcto.

### 4.3 Detalle del curso — `/certificaciones/[slug]`
**Para qué:** conocer el curso y empezarlo.
**Cómo llegar:** clic en una tarjeta del catálogo.
**Qué hay:**
- Encabezado con categoría, título, subtítulo y datos (horas, módulos, evaluación, vigencia).
- "Lo que certificarás", "Contenido del curso" (módulos con nº de clases) y "Evaluación y certificación" (puntaje mínimo, intentos, duración).
- **Tarjeta lateral** con el botón **"Comenzar curso"** e información del instructor y contacto.

**Botón "Comenzar curso":**
- Si **no hay sesión** → lleva a `/ingresar`; tras iniciar sesión, vuelve al detalle.
- Si **hay sesión** → inscribe (una sola vez) y lleva al reproductor (`/curso/[slug]`).

### 4.4 Ingreso — `/ingresar`
**Para qué:** iniciar sesión sin contraseña.
**Cómo llegar:** enlace "Ingresar", o automáticamente al intentar entrar a una página protegida.
**Cómo se usa:**
1. Escribir el correo y "Enviar enlace de acceso".
2. Aparece el mensaje "Revisa tu correo".
3. Abrir el enlace del email **en el mismo navegador** → queda la sesión iniciada y la plataforma lleva a la página de destino (por defecto, el perfil).

**Para probar:** que al pedir el enlace muestre la confirmación; que el enlace inicie sesión; que, si veníamos de una página protegida, nos devuelva a ella.

### 4.5 Reproductor del curso — `/curso/[slug]`
**Para qué:** estudiar el curso.
**Cómo llegar:** "Comenzar curso" (detalle) o "Continuar" (perfil). Requiere sesión **e inscripción**.
**Qué hay:**
- **Barra superior del curso:** título, **barra de progreso (%)**, botón **"Comenzar evaluación"** (bloqueado al inicio) y enlace **"← Mis cursos"** (→ perfil).
- **Visor de la lección** (centro): muestra el contenido según su tipo (video, PDF, imagen, texto).
- **Temario** (lateral): módulos y lecciones. Cada módulo muestra su estado: **completado (✓)**, **en progreso** o **bloqueado (🔒)**.

**Reglas de navegación a probar:**
- Las lecciones de un **módulo bloqueado no se pueden abrir** (no son clickeables).
- Marcar las lecciones como vistas (o ver el video al ≥90%) **desbloquea el siguiente módulo sin recargar** y sube el progreso.
- Al completar **todos los módulos**, el botón **"Comenzar evaluación" se activa**.

> Nota de prueba: mientras Cloudflare R2 no esté configurado, el visor muestra "contenido pendiente"; igual se puede usar "Marcar como vista" para avanzar y probar el desbloqueo.

### 4.6 Evaluación (ventana sobre el curso)
**Para qué:** rendir el examen final y obtener el certificado.
**Cómo llegar:** botón "Comenzar evaluación" de la barra del curso (solo cuando todos los módulos están completos).
**Cómo funciona:**
1. **Pantalla de inicio:** muestra duración, nº de preguntas, puntaje mínimo e intentos disponibles. Botón "Comenzar evaluación".
2. **Preguntas:** se sortean al azar; se navega con los **números (dots)**, se elige una opción por pregunta, y corre un **temporizador**. Botón "Enviar".
3. **Resultado:** anillo con el puntaje y veredicto.
   - **Aprobado:** botón **"Obtener certificado"** (emite el certificado y lleva a su página de verificación) + revisión de respuestas.
   - **No aprobado:** lista de **temas a reforzar** (sin mostrar la respuesta correcta) y botón **"Reintentar"** mientras queden intentos.

**Para probar:** que al agotar los intentos no se pueda reintentar; que al aprobar lleve a `/verificar/[id]`; que el temporizador, al llegar a cero, envíe automáticamente.

### 4.7 Verificación pública — `/verificar/[id]`
**Para qué:** que cualquiera valide un certificado.
**Cómo llegar:** búsqueda en la landing, enlace/QR del certificado, o "Ver" desde el perfil.
**Qué hay:**
- **Banner de estado:** Válido (verde), Vencido (ámbar) o Revocado (rojo).
- **Documento del certificado:** nombre del profesional, habilidad, fechas, puntaje, instructor, y un **QR + enlace** de verificación.
- Botones "Copiar enlace" y "Ver certificaciones".

**Para probar:** los tres estados (válido / vencido / revocado); un `cert_id` inexistente → "Certificado no encontrado".

### 4.8 Perfil — `/perfil`
**Para qué:** gestionar datos y ver cursos/certificados propios.
**Cómo llegar:** es el destino tras iniciar sesión, o desde "← Mis cursos" en la barra del curso. Requiere sesión.
**Qué hay:**
- **Datos personales** editables (nombre, profesión, ciudad, RETHUS, avatar) y botón "Guardar cambios".
- **Mis cursos:** cada uno con su barra de progreso y "Continuar →" (→ reproductor).
- **Mis certificados:** tarjeta por certificado con su estado y "Ver →" (→ verificación).
- **Cerrar sesión** (arriba a la derecha).

**Para probar:** que solo se vean los cursos y certificados propios; que guardar los datos persista.

### 4.9 Panel de administración — `/admin`
**Para qué:** gestionar el contenido y los certificados. Requiere sesión **y rol admin**.
**Cómo llegar:** escribiendo la URL `/admin` (no hay enlace público).
**Páginas del panel** (barra superior del panel: "Cursos" y "Certificados"):
- **`/admin`** — Tablero: conteo de publicados/borradores y accesos rápidos.
- **`/admin/cursos`** — Lista de todos los cursos; cada uno con **Publicar/Despublicar** y enlace para editar.
- **`/admin/cursos/nuevo`** — Crear un curso.
- **`/admin/cursos/[slug]`** — Editar el curso; enlaces a **Módulos** y **Evaluación**; botón de publicar.
- **`/admin/cursos/[slug]/modulos`** — Crear/eliminar módulos y lecciones.
- **`/admin/cursos/[slug]/evaluacion`** — Crear la evaluación y el banco de preguntas.
- **`/admin/certificados`** — Lista de certificados emitidos; botón **"Revocar"** (pide una razón).

**Reglas a probar:**
- Un curso **no se puede publicar** si no tiene evaluación con al menos una pregunta (muestra mensaje).
- Al **revocar** un certificado, su página `/verificar/[id]` pasa a "Revocado" de inmediato.
- Un usuario sin rol admin que entra a `/admin` es **redirigido fuera**.

---

## 5. Recorridos completos sugeridos (casos de prueba end-to-end)

**A. Profesional, de principio a fin**
1. Landing → "Ver certificaciones" → abrir un curso.
2. "Comenzar curso" → iniciar sesión (Magic Link) → vuelve al curso ya inscrito.
3. Completar las lecciones de cada módulo → verificar que se desbloquea el siguiente.
4. Con todo completo → "Comenzar evaluación" → responder → aprobar.
5. "Obtener certificado" → llega a la página de verificación.
6. Ir al perfil → ver el curso completado y el certificado.

**B. Empleador verifica**
1. Recibir/abrir un enlace `/verificar/[id]` (o escribir el `cert_id` en la landing).
2. Ver el estado y los datos del certificado.
3. Probar también un `cert_id` inexistente → "Certificado no encontrado".

**C. Administrador publica y revoca**
1. Entrar a `/admin` (con rol admin).
2. Crear un curso → agregar módulos/lecciones → crear evaluación con preguntas → publicar.
3. Verificar que aparece en el catálogo público.
4. En "Certificados", revocar uno y comprobar que su verificación muestra "Revocado".

---

## 6. Notas para quien prueba

- **Magic Link:** el correo se envía al email ingresado; abrir el enlace en el **mismo navegador**. Si el envío falla por límite de correos, esperar un rato o pedir un enlace nuevo.
- **Contenido de lecciones:** mientras no esté configurado el almacenamiento (R2), el visor muestra "pendiente"; el resto de la navegación funciona igual.
- **Datos de ejemplo:** hay cursos y certificados de prueba sembrados (ej. `HAB-2026-9001` válido, `HAB-2026-9002` revocado, `HAB-2026-9003` vencido) para probar verificación.
- **Redirecciones:** son parte del comportamiento esperado; conviene incluirlas como casos de prueba (ver sección 2).
