# SPEC-ROLES-ACCESO.md

**Bloque 0 — Roles y acceso (fundación del rol administrador)**

## Objetivo

Implementar un modelo de **rol único por persona**: cada usuario es *estudiante* **o** *administrador*, nunca ambos a la vez. El inicio de sesión enruta según el rol, cada rol tiene su propia área completa e independiente, y no existen puentes entre áreas. Esto cierra la desconexión actual entre el dashboard del estudiante y el panel de administración, y elimina el enlace "Panel admin" del menú del estudiante.

Este bloque es la base sobre la que se construyen los bloques 1 a 5 del rol administrador.

---

## §0 — Verificación previa (NO modificar todavía)

Antes de proponer o escribir cualquier cambio, inspeccionar el repositorio real y reportar los hallazgos. No asumir nada de lo siguiente; confirmarlo en el código y el esquema:

1. **Esquema de usuarios y rol**
   - Tabla `public.users`: estructura de la columna `role` y los valores que existen hoy en los datos (¿`'admin'`?, ¿`'estudiante'`/`'student'`?, ¿`NULL`?).
   - Trigger `on_auth_user_created`: qué valor de `role` asigna a los registros nuevos, y si cubre o no las cuentas creadas antes de su existencia.

2. **Flujo de autenticación (Magic Link)**
   - Dónde termina el flujo del Magic Link (ruta de callback) y a qué ruta redirige hoy tras un login exitoso.
   - Si existe ya alguna lógica de redirección condicional.

3. **Shells / layouts**
   - Componente(s) del shell del estudiante (menú claro: Dashboard / Catálogo / Mis cursos / Perfil) y dónde se define ese menú.
   - Componente(s) del shell del admin (menú oscuro: Cursos / Constancias / Salir del panel) y dónde se define.
   - Dónde se renderiza el enlace **"Panel admin"** dentro del menú del estudiante.
   - Qué hace exactamente hoy el botón **"Salir del panel"** (¿logout?, ¿navega a una ruta?).

4. **Guardas de ruta**
   - Cómo se protege hoy `/admin` (middleware, layout server-side, verificación de `role`, RLS, etc.).
   - Cómo se protegen las rutas autenticadas del estudiante.

**Entregable de §0:** un reporte breve de hallazgos. Si algo difiere de lo descrito en la §1, ajustar la propuesta antes de implementar y dejar constancia del ajuste.

---

## §1 — Propuesta de implementación (condicionada a §0)

> Usar los nombres de rol que ya existan en el esquema. Donde abajo se escribe `administrador`/`estudiante`, sustituir por los valores reales confirmados en §0.

### Modelo de rol

- Cada usuario tiene **exactamente un** rol: `administrador` o `estudiante`.
- Registros nuevos se crean como `estudiante` por defecto (vía el trigger `on_auth_user_created`). Si el trigger no garantiza esto, corregirlo de forma aditiva.
- El rol `administrador` se asigna manualmente en la base de datos por ahora (una pantalla de gestión de administradores queda fuera de este bloque).

### Enrutamiento por rol tras login

- Implementar en el punto donde hoy termina el Magic Link / login:
  - `role = administrador` → redirige a `/admin`.
  - `role = estudiante` → redirige a `/dashboard`.

### Guardas de ruta (separación estricta)

- Un `estudiante` que intente entrar a cualquier ruta de `/admin` → redirige a `/dashboard`.
- Un `administrador` que intente entrar a rutas del área de estudiante (`/dashboard`, `/catalogo`, `/mis-cursos`, `/perfil`, etc.) → redirige a `/admin`.
- Resultado: desde una sola cuenta nunca se pueden ver ambas áreas.

### Menú del estudiante

- **Eliminar** el enlace "Panel admin". El menú queda: Dashboard, Catálogo, Mis cursos, Perfil + Cerrar sesión.

### Shell del administrador (coherencia y autosuficiencia)

- Header con el mismo lenguaje visual del producto (no una app aparte).
- Mostrar el rol de forma explícita junto al nombre del usuario (p. ej. una insignia "Administrador").
- **Reemplazar "Salir del panel" por "Cerrar sesión".** No hay área de estudiante a la que "volver", así que el único egreso del admin es cerrar sesión.
- Menú del admin: Panel, Cursos, Constancias.

### QA del lado estudiante

- Como el admin ya no ve el área de estudiante, la experiencia del alumno se prueba con una **cuenta de estudiante separada** (otro correo con Magic Link). La vista previa de contenido dentro del panel se aborda en el Bloque 3 (Contenido de lecciones).

### Restricciones de implementación

- Cambios **aditivos y reversibles** donde sea posible.
- No introducir regresiones en el cumplimiento P0/P1 ya implementado (footer legal, naming de "constancias de finalización", disclosures de modalidad informal).

---

## §2 — Criterios de aceptación

1. Un usuario con rol `administrador`, al iniciar sesión, llega a `/admin` y **nunca** ve el menú ni las rutas del estudiante.
2. Un usuario con rol `estudiante`, al iniciar sesión, llega a `/dashboard`, **no** ve el enlace "Panel admin" y, si intenta abrir `/admin`, es redirigido a `/dashboard`.
3. Un `administrador` que intente abrir una ruta de estudiante es redirigido a `/admin`.
4. El shell del admin tiene header coherente, muestra el rol de forma visible y ofrece "Cerrar sesión" (ya no existe un "Salir del panel" sin destino claro).
5. Los registros nuevos quedan con rol `estudiante` por defecto.
6. No es posible, desde una sola cuenta, estar en ambas áreas a la vez.
7. El cumplimiento P0/P1 sigue intacto en ambas áreas.

---

## §3 — Prompt de arranque

> Lee primero `CLAUDE.md` para el contexto de stack, decisiones de producto y reglas de desarrollo del proyecto. Estás trabajando en el Bloque 0 (Roles y acceso) del rol administrador, descrito en `SPEC-ROLES-ACCESO.md`.
>
> Antes de modificar nada, ejecuta la verificación de la sección §0: inspecciona el esquema de `public.users` y el trigger `on_auth_user_created`, el flujo del Magic Link y su redirección actual, los shells del estudiante y del admin (incluido dónde se renderiza "Panel admin" y qué hace "Salir del panel"), y las guardas de ruta de `/admin`. Reporta tus hallazgos de forma concisa y, si algo difiere de lo asumido en la §1, propón el ajuste antes de continuar.
>
> Tras mi visto bueno al reporte, implementa la §1 cumpliendo todos los criterios de la §2. Aplica cambios aditivos y reversibles donde sea posible, y no introduzcas regresiones en el cumplimiento P0/P1. Usa los nombres de rol reales que encuentres en el esquema.
