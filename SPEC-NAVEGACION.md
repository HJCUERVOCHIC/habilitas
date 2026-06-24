# SPEC-NAVEGACION.md

**Fase:** 0 — Estructura de navegación / app shell (habilitador del cumplimiento)
**Proyecto:** Habilitas — Next.js + Supabase + Cloudflare R2
**Origen:** `CUMPLIMIENTO-DECRETO-1075.md`, §11.1 (Plan de ejecución)
**Tipo:** Vertical slice — entrega una navegación end-to-end, no componentes sueltos.

> **Por qué esta fase primero.** Hoy las pantallas se perciben como objetos independientes porque falta la capa que las conecta. Esta fase entrega esa capa. Además habilita el cumplimiento: el aviso de modalidad (R1), las horas en el perfil (R7) y la exportación admin (R8) necesitan un shell consistente donde vivir.

---

## 0. Principio rector (NO negociable)

**Inspeccionar el repo real antes de escribir o modificar nada.** No asumir estructura, nombres ni convenciones. Todos los nombres de rutas, archivos y componentes en este spec son **propuestas a reconciliar** con lo que exista. Si algo de este spec contradice el código real, gana el código real y se reporta la discrepancia antes de continuar.

Cambios **no destructivos**: no reescribir ni mover rutas que ya funcionan sin confirmarlo. Diffs revisables por milestone (cadencia del proyecto), no por componente.

---

## 1. Paso de descubrimiento (ejecutar y reportar antes de implementar)

Antes de tocar código, inspeccionar y resumir:

1. **Router y estructura.** ¿App Router o Pages Router? Árbol de `app/` (o `pages/`): qué rutas existen hoy (catálogo, detalle, course player, verificación, perfil, admin, landing).
2. **Layouts existentes.** Contenido de los `layout.tsx` actuales (raíz y anidados). ¿Hay ya algún layout autenticado?
3. **Autenticación.** Cómo se obtiene la sesión de Supabase en servidor y cliente; dónde está el `middleware.ts`; cómo se protegen rutas hoy.
4. **Rol admin.** Cómo se determina `role = 'admin'` (revisar el archivo tipo `require-admin.ts` y la consulta a `public.users`).
5. **Estilos y UI.** Revisar `package.json` y config: ¿Tailwind? ¿shadcn/ui u otra librería? ¿Tokens/tema definidos? **El shell debe usar el sistema de diseño existente, no introducir uno nuevo.**
6. **Punto de entrada actual.** Qué ve el usuario inmediatamente después de iniciar sesión hoy.

Entregar este resumen como salida del descubrimiento. Con base en él, ajustar el resto del spec.

---

## 2. Entregables de la Fase 0

1. **App shell (layout autenticado persistente).** Un layout que envuelve todas las rutas autenticadas y muestra siempre: navegación, identidad del usuario (nombre/email + salir) y un punto de regreso. Las rutas públicas (landing, verificación pública) quedan fuera de este shell.
2. **Componente de navegación (menú).** Ítems: Dashboard, Catálogo, Mis cursos / Mi progreso, Perfil. Ítem **Panel admin visible solo si `role = 'admin'`** (reutilizar la lógica existente, no duplicarla). Indicador de ítem activo.
3. **Ruta `/dashboard`.** Punto de entrada tras iniciar sesión. Conecta de forma evidente hacia: continuar curso en progreso, ir al catálogo, ver perfil. Es el "hilo conductor" que hoy falta.
4. **Footer global con aviso de modalidad.** Muestra el `avisoCorto` (cumple parte de R1). Texto desde fuente única, no hardcodeado en el componente — ver §3.
5. **Redirección de acceso.** Tras login → `/dashboard`. Usuario no autenticado que entra a una ruta del shell → redirigir a login.
6. **Estados.** Cargando, autenticado vs. no autenticado, enlace activo. Comportamiento responsive (ver §4).

---

## 3. Fuente única del aviso (adelanto mínimo de Fase 1)

El footer necesita el texto de modalidad. Crear ya `lib/compliance.ts` como fuente de verdad (definido en `CUMPLIMIENTO-DECRETO-1075.md` §2). Es una constante pura, sin lógica, y evita texto legal duplicado.

```ts
// lib/compliance.ts (constante compartida; ver CUMPLIMIENTO-DECRETO-1075.md §2 y §4)
export const MODALIDAD = {
  etiqueta: "Educación informal",
  norma: "Decreto 1075 de 2015, Art. 2.6.6.8",
  avisoCorto:
    "Educación informal · No conduce a título ni a certificado de aptitud ocupacional (Decreto 1075 de 2015, Art. 2.6.6.8).",
} as const;
```

El resto de R1 (aviso en catálogo, detalle, artefacto, verificación) es Fase 1 y **no** entra en esta fase.

---

## 4. Estructura y diseño propuestos (a reconciliar)

**Organización de rutas (App Router).** Propuesta usando *route groups* para separar lo público de lo autenticado:

```
app/
  (public)/         → landing, verificación pública (sin shell)
  (app)/            → layout autenticado = APP SHELL
    layout.tsx      → shell: nav + topbar + footer
    dashboard/
    catalogo/
    mis-cursos/
    perfil/
    admin/          → protegido por role=admin
```

Si las rutas ya existen con otra organización, **adaptarse** a ella moviendo lo mínimo y de forma no destructiva; reportar antes de mover.

**Decisión de diseño a confirmar (default propuesto):** navegación lateral (sidebar) en escritorio que colapsa a menú superior con hamburguesa en móvil. Es el patrón más natural para una app con dashboard. Si Hector prefiere menú superior fijo, es un cambio menor. **Confirmar antes de pulir estilos.**

Snippet ilustrativo (NO autoritativo — ajustar a convenciones reales del repo):

```tsx
// app/(app)/layout.tsx — ILUSTRATIVO
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // obtener sesión y role con el mecanismo YA existente del repo
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        <SideNav /* isAdmin desde la lógica existente */ />
        <main className="flex-1">{children}</main>
      </div>
      <ComplianceFooter /* usa MODALIDAD.avisoCorto */ />
    </div>
  );
}
```

---

## 5. Criterios de aceptación (end-to-end)

- [ ] Tras iniciar sesión, el usuario aterriza en `/dashboard`.
- [ ] La navegación (menú + identidad + salir) es visible y consistente en todas las rutas autenticadas.
- [ ] Desde el dashboard se llega en un clic a catálogo, mis cursos y perfil.
- [ ] El ítem "Panel admin" aparece solo para `role = 'admin'` y no para usuarios normales.
- [ ] El footer con el `avisoCorto` aparece en todas las páginas del shell.
- [ ] Un usuario no autenticado que entra a una ruta del shell es redirigido a login.
- [ ] Responsive: la navegación funciona en escritorio y móvil.
- [ ] **Prueba de percepción:** navegando, se siente como una sola aplicación, no como páginas sueltas.

---

## 6. Fuera de alcance de la Fase 0 (disciplina de scope)

- R2–R9 del decreto (renombrado a "constancia", metadatos de curso, criterios de evaluación públicos, perfil de formador, horas en constancia, exportación admin, anti-fraude). → Fases 1 y 2.
- RETHUS. → diferido (PT-1).
- Cambiar el mecanismo de acceso por correo. → diferido (PT-2); **reevaluar después** de esta fase, no durante.
- Contenido de cursos (curso duelo) y carga de datos.

---

## 7. Prompt de arranque para Claude Code

> Vamos a implementar la Fase 0 (app shell / navegación) descrita en `SPEC-NAVEGACION.md`. **No escribas ni modifiques código todavía.** Primero ejecuta el Paso de descubrimiento (§1) y muéstrame un resumen del estado real del repo: estructura de `app/`, layouts existentes, cómo se obtiene la sesión de Supabase, cómo se determina `role=admin`, y qué librería de estilos se usa. Con base en ese resumen, propónme el plan de implementación reconciliado con el código real (rutas a crear/mover, componentes, y la decisión sidebar vs. topbar) y espera mi visto bueno antes de implementar. Trabaja de forma no destructiva sobre las rutas que ya funcionan.
