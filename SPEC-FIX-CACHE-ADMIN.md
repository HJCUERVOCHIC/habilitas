# SPEC-FIX-CACHE-ADMIN.md

**Corrección del caché de navegación en las pantallas de administración**

v1.0 · Bloque de corrección · Prioridad alta (bloquea la autoría de contenido)

---

## Contexto

Durante la verificación de Cloudflare R2 (07-ago-2026) se detectó un defecto reproducible en las pantallas de `/admin`: **el estado mostrado no refleja las mutaciones recientes al navegar entre rutas.** Los datos se escriben correctamente en la base de datos y en R2; lo que falla es la vista.

### Casos reproducidos

**Caso A — la lección creada no aparece.**
1. En `Módulos y lecciones` de un curso, se añade una lección nueva.
2. La lección se guarda (confirmado: se puede abrir su editor y tiene contenido).
3. Al volver al listado, la lección **no aparece**.
4. `Ctrl+Shift+R` → aparece.

**Caso B — el contenido guardado se muestra vacío.**
1. Se abre una lección recién creada (sin texto ni archivo). Se cachea ese estado vacío.
2. Se guarda texto Markdown y se sube un archivo a R2. Ambos se confirman en pantalla.
3. Se navega a `← Módulos y lecciones` y se vuelve a entrar a la misma lección.
4. La lección se muestra **sin texto y sin archivo** — el estado de la primera visita.
5. `Ctrl+Shift+R` → aparece todo.

### Diagnóstico

No hay pérdida de datos en ningún caso; ambos se corrigen con recarga forzada. El sospechoso principal es el **Router Cache del cliente** (el payload RSC que Next.js guarda por ruta visitada y reutiliza en navegaciones internas y back/forward), posiblemente combinado con el Data Cache del servidor.

El mecanismo canónico para invalidar ambos tras una mutación es llamar `revalidatePath()` dentro del server action que muta. Marcar la página como dinámica **no** invalida el Router Cache del cliente, por lo que no es suficiente por sí solo.

### Severidad

No es cosmético. Un administrador que añade una lección, no la ve y vuelve a añadirla genera **duplicados** en un curso real. Y es la pantalla central de autoría de contenido, así que se choca en cada sesión de carga.

### Antecedente que NO debe romperse

`/admin/cursos/[slug]` tuvo un bug previo de 404 fantasma causado por el Data Cache, resuelto con `unstable_noStore()` + `revalidate = 0` + `fetchCache = 'force-no-store'`. **Ese tratamiento debe conservarse intacto.** Cualquier cambio que lo retire reintroduce el 404.

---

## §0 — Verificación previa (ejecutar antes de modificar nada)

Reporta de forma concisa:

1. **Inventario de server actions que mutan** bajo `src/` (crear, editar, reordenar y eliminar cursos, módulos y lecciones; guardar `body_md`; subir, reemplazar y quitar archivo de R2; publicar y despublicar curso). Lista archivo y nombre de función.

2. **¿Alguno llama `revalidatePath` o `revalidateTag`?** Si sí, indica cuáles y con qué rutas exactas.

3. **Árbol real de rutas** bajo `src/app/admin` (todos los `page.tsx`), con sus segmentos dinámicos. Necesitamos las rutas literales para invalidarlas correctamente.

4. **Directivas de caché existentes** por página (`unstable_noStore`, `export const revalidate`, `dynamic`, `fetchCache`). Confirma explícitamente que `/admin/cursos/[slug]` conserva su tratamiento anti-caché.

5. **Uso de `router.refresh()`** en componentes cliente de admin (se sabe que `LessonEditor.tsx` importa `useRouter`). Indica dónde se llama y tras qué operaciones.

6. **Rutas del estudiante que leen los mismos datos** (reproductor, catálogo, progreso). Solo reportar: sirve para decidir si necesitan invalidación cuando el admin publica o edita.

Si algún hallazgo entra en conflicto con la §1, propón el ajuste antes de continuar.

---

## §1 — Implementación

### 1. Helper compartido de invalidación

Crear una utilidad única (sugerido: `src/lib/revalidate-admin.ts`) que centralice qué rutas invalidar según el alcance de la mutación. Evita que cada action improvise su propia lista y que se olvide alguna.

Debe cubrir, como mínimo:

- **Alcance curso** — listado de cursos, detalle del curso, y la vista pública/catálogo si el curso está publicado.
- **Alcance estructura** — la página de módulos y lecciones del curso.
- **Alcance lección** — la página de edición de esa lección, más la de estructura (porque el título y el tipo se muestran en el listado).

Usar rutas literales con los valores dinámicos reales (por ejemplo `/admin/cursos/${slug}/lecciones`), no plantillas con corchetes, salvo que se use la variante con `type` de `revalidatePath`.

### 2. Cablear el helper en todos los actions que mutan

Llamarlo **al final de cada operación exitosa**, antes del `return`. No invalidar cuando la operación falla o devuelve `{ ok: false }`.

Cubrir sin excepción: crear/editar/eliminar curso, publicar y despublicar, crear/editar/reordenar/eliminar módulo, crear/editar/reordenar/eliminar lección, guardar `body_md`, y subir/reemplazar/quitar archivo de R2.

### 3. No retirar el tratamiento anti-caché de `/admin/cursos/[slug]`

Se conserva tal cual. Si la §0 revela que otras páginas de admin lo necesitan, proponerlo antes de aplicarlo — la invalidación por action es la solución preferida; las directivas por página son el último recurso.

### 4. Conservar los `router.refresh()` existentes

Son complementarios, no redundantes: refrescan la ruta actual de inmediato. No eliminarlos salvo que se demuestre que causan doble petición.

### 5. Regla persistente en `CLAUDE.md`

Añadir, en la sección de reglas de desarrollo:

> **Invalidación tras mutar.** Todo server action que modifique datos debe invalidar las rutas afectadas con `revalidatePath()` antes de retornar. Marcar una página como dinámica no invalida el Router Cache del cliente. Ante un síntoma de "el cambio no aparece hasta recargar", revisar primero la invalidación del action, no la lógica de lectura.

### Restricciones

- Cambios aditivos y reversibles.
- No modificar la lógica de negocio ni el esquema.
- No introducir regresiones en el cumplimiento P0/P1.
- No tocar `src/lib/r2.ts` — su funcionamiento está verificado de punta a punta.

---

## §2 — Criterios de aceptación

1. **Caso A resuelto:** crear una lección y volver al listado la muestra **sin recarga forzada**.
2. **Caso B resuelto:** guardar texto y subir archivo, navegar fuera y volver a entrar muestra ambos **sin recarga forzada**.
3. Editar el **título o el tipo** de una lección se refleja de inmediato en el listado.
4. **Reordenar** módulos y lecciones persiste y se refleja al volver.
5. **Eliminar** una lección o módulo la retira del listado sin recarga.
6. **Quitar o reemplazar archivo** actualiza la sección de medio sin recarga.
7. **Publicar o despublicar** un curso se refleja en el listado de cursos.
8. **Sin regresión del 404 fantasma:** entrar a `/admin/cursos/[slug]`, navegar a otra ruta y volver sigue resolviendo correctamente.
9. La regla queda escrita en `CLAUDE.md`.
10. Los cuatro gates locales en verde: `type-check`, `lint`, `test`, `build`.

---

## §3 — Prompt de arranque

> Lee primero `CLAUDE.md` para el contexto de stack, decisiones de producto y reglas de desarrollo. Vas a corregir un defecto de caché en las pantallas de administración, descrito en `SPEC-FIX-CACHE-ADMIN.md`.
>
> Antes de modificar nada, ejecuta la verificación de la sección §0: inventaria los server actions que mutan datos de cursos, módulos y lecciones; revisa si alguno llama `revalidatePath` o `revalidateTag` y con qué rutas; mapea el árbol real de rutas bajo `src/app/admin`; lista las directivas de caché por página confirmando que `/admin/cursos/[slug]` conserva su tratamiento anti-caché; y localiza los `router.refresh()` en componentes cliente. Reporta los hallazgos de forma concisa.
>
> Si los hallazgos son compatibles con la §1, continúa directamente con la implementación cumpliendo todos los criterios de la §2, sin detenerte a pedir aprobación. Detente y consúltame solo si encuentras algo que entre en conflicto con la §1 — en particular, si la invalidación por action resultara insuficiente y hiciera falta cambiar directivas de renderizado en páginas existentes.
>
> Reglas: cambios aditivos y reversibles, no toques `src/lib/r2.ts` (su funcionamiento está verificado), no retires el tratamiento anti-caché de `/admin/cursos/[slug]` (evita un 404 fantasma conocido), y no introduzcas regresiones en P0/P1. Al terminar, corre `type-check`, `lint`, `test` y `build` y confirma que los cuatro salen en verde.

---

## Anexo — Cómo verificar manualmente

Con el dev server arrancado limpio (`Remove-Item -Recurse -Force .next; npm run dev`) y **sin usar `Ctrl+Shift+R` en ningún momento**:

1. Abrir un curso en borrador → `Módulos y lecciones`.
2. Añadir una lección de tipo video → debe aparecer en el listado.
3. Abrir su `Contenido` → guardar texto Markdown → subir un archivo.
4. Volver con `← Módulos y lecciones` → volver a entrar a la lección → texto y archivo deben estar.
5. Editar el título desde el listado → debe reflejarse.
6. Reordenar la lección → debe persistir al volver.
7. Quitar el archivo → la sección de medio debe quedar vacía.
8. Eliminar la lección → debe desaparecer del listado.
9. Navegar a `/admin/cursos` y volver al curso → sin 404.
