# SPEC-IMPORTACION-CURSOS-YAML

Importación de cursos completos desde un archivo YAML en el panel de administrador.
Crea un curso con sus módulos, lecciones y (si el esquema lo soporta) banco de
preguntas, en una sola operación. **No reemplaza el formulario manual**: este se
conserva tal cual, tanto para crear cursos a mano como para corregir un curso después
de importarlo.

---

## §0 — Verificación (hacer primero, sin asumir)

Inspeccionar el repo real y confirmar cada punto antes de implementar. Si algo aquí
contradice el código, **pausar y reportar** antes de continuar.

### 0.1 Validador y formato YAML existentes
- Localizar el validador de YAML ya construido y el script que arma el curso de duelo
  (en conversaciones previas vivían como `construir-curso.mjs` / un validador en Node).
  Confirmar: ¿dónde está, qué exporta, y qué reglas valida?
- Localizar el YAML del curso de duelo ya convertido (`curso-manejo-del-duelo.yaml`)
  para usarlo como caso de prueba real.
- Confirmar los **nombres de campo reales** del formato contra el esquema de la BD.
  Puntos que ya quedaron marcados como dudosos y hay que resolver aquí:
  - Umbral de aprobación: ¿`nota_minima` o `umbral_aprobacion`? (usar el que exista en
    la tabla).
  - Estructura exacta de las opciones en el banco de preguntas.
  - El campo `rethus_instructor` debe estar **ausente** (RETHUS está diferido).

### 0.2 Esquema de base de datos
- Confirmar nombres y columnas de las tablas: cursos, módulos, lecciones y banco de
  preguntas (nombres reales, no asumidos).
- Confirmar las **relaciones de clave foránea** y el orden de inserción correcto
  (curso → módulos → lecciones → preguntas).
- Confirmar la columna del cuerpo de la lección (en conversaciones previas fue
  `body_md` / `contenido_md` — usar el nombre real) y los tipos de lección válidos
  (`texto`, `video`, `recurso`…).
- Confirmar el tipo y la restricción de unicidad de la columna `slug` en la tabla de
  cursos.

### 0.3 Cliente admin e infraestructura existente
- Localizar el **cliente admin de Supabase** que el panel ya usa para insertar
  (el server action de "Nuevo curso"). La importación debe reutilizar ese mismo
  cliente, no crear uno nuevo.
- Confirmar la estructura de rutas bajo `app/admin/cursos/` (¿la ruta dinámica es
  `[id]` o `[slug]`?), para que el redirect tras importar apunte a una página que
  exista.

### 0.4 Normalización de slug (cruce con el fix de slug)
- Confirmar si ya existe una util central `slugify(text)` (la del arreglo del bug de
  slug con espacios). **Si existe, reutilizarla.** Si todavía no está mergeada, crear
  la misma función y dejar que ambos flujos (formulario manual e importación) usen
  exactamente la misma.

---

## §1 — Propuesta de implementación

### 1.1 Punto de entrada en la UI
- En la lista de cursos (`/admin/cursos`), agregar un botón **"Importar YAML"** junto
  al botón **"Nuevo curso"** existente. No tocar "Nuevo curso".
- Nueva página `/admin/cursos/importar` con:
  - Un campo para **subir un archivo** `.yaml`/`.yml` **o pegar** el contenido en un
    textarea.
  - Botón **"Validar y previsualizar"** → no escribe en la BD.
  - Disclaimer de educación informal visible en la página (como en toda superficie del
    admin).

### 1.2 Paso de validación + previsualización (sin escribir en BD)
La acción de validar:
1. Parsea el YAML.
2. Corre **las mismas validaciones que el validador ya existente** (§0.1).
3. Calcula el slug final con `slugify` (§0.4) y lo muestra normalizado.
4. Devuelve un **resumen para previsualizar**, sin insertar nada:
   - Título, categoría, horas, umbral, intentos, vigencia.
   - Slug final que quedará.
   - Conteo de módulos y de lecciones (y, por módulo, sus lecciones).
   - Conteo de preguntas del banco (si viene).
   - **Errores de validación** listados de forma legible (qué campo, qué módulo/lección).
   - **Advertencia de colisión de slug**: si ya existe un curso con ese slug, avisarlo
     de forma destacada (ver 1.4).
   - Lecciones de tipo `video`/`recurso` cuyas URLs estén en `PENDIENTE`: listarlas
     como aviso (se importan igual; quedan pendientes de completar).

Solo si la validación pasa, se habilita el botón **"Confirmar e importar"**.

### 1.3 Importación (escribe en BD)
La acción de confirmar:
1. Re-valida en el servidor (no confiar en el cliente).
2. Inserta en el orden de FK correcto usando el **cliente admin existente**, dentro de
   una **transacción** (todo o nada).
3. El curso se crea en estado **borrador** (igual que el formulario manual; la
   publicación sigue pasando por el checklist del Bloque 4).
4. Redirige a la página de detalle/edición del curso recién creado, usando la **misma
   clave** (`id` o `slug`) que esa página usa para consultar (§0.3), para no caer en un
   404.

### 1.4 Colisión de slug — DECISIÓN PENDIENTE (Hector elige)
Cuando el slug del YAML ya corresponde a un curso existente, hay dos comportamientos
posibles y tienen implicaciones distintas para tus correcciones manuales:

- **Opción A — Solo crear (recomendada para MVP, no destructiva).**
  Si el slug ya existe, **rechazar la importación** con un mensaje claro
  ("Ya existe un curso con este slug; cambia el slug en el YAML o edita el curso
  existente desde el panel"). Nunca sobrescribe. Protege cualquier corrección manual.

- **Opción B — Actualizar existente (idempotente, riesgosa).**
  Reimportar actualiza el curso existente. **Problema:** sobrescribiría las
  correcciones que hayas hecho a mano en ese curso. Si se elige esta vía, debe pedir
  una confirmación explícita extra que advierta "esto reemplazará el contenido actual,
  incluidas ediciones manuales", y nunca debe correr sin esa confirmación.

> **Por defecto este spec asume la Opción A.** Si prefieres B, decláralo y ajusto el
> spec. No mezclar ambas sin decisión explícita.

### 1.5 Medios (R2)
- Las lecciones `video`/`recurso` con URL en `PENDIENTE` se importan tal cual; R2 **no**
  es requisito para importar.
- Recordatorio (no es trabajo de este bloque): el checklist de publicación (Bloque 4)
  seguirá exigiendo medios reales y R2 configurado antes de publicar un curso con
  lecciones de medios.

---

## §2 — Criterios de aceptación

1. Existe `/admin/cursos/importar`, accesible solo para admin, con disclaimer de
   educación informal.
2. El botón "Importar YAML" aparece junto a "Nuevo curso" en `/admin/cursos`; el
   formulario manual sigue funcionando exactamente igual que antes.
3. Validar/previsualizar **no escribe en la BD** y muestra: slug normalizado, conteos
   de módulos/lecciones/preguntas, errores legibles y advertencia de colisión de slug.
4. El curso de duelo (`curso-manejo-del-duelo.yaml`) se importa correctamente: 8
   módulos y 23 lecciones, contenido Markdown intacto, en estado borrador.
5. La importación corre en una transacción: si algo falla a mitad, **no queda nada a
   medias** en la BD.
6. El slug se guarda **normalizado** (minúsculas, sin tildes, espacios → guiones), con
   la misma `slugify` que el formulario manual.
7. Tras importar, el redirect lleva a la página de edición del curso **sin 404**.
8. Comportamiento de colisión de slug = el de la Opción elegida en §1.4 (por defecto A).
9. Las lecciones `video`/`recurso` con URL `PENDIENTE` se importan y quedan listadas
   como pendientes; no bloquean la importación.
10. Cambios no destructivos: no se toca ningún curso ya existente ni el formulario
    manual.

---

## §3 — Prompt de arranque (verificar + implementar en una pasada)

> Vamos a construir la importación de cursos por YAML para el panel de administrador de
> Habilitas, **sin eliminar ni modificar el formulario manual de "Nuevo curso"** (este
> se conserva para crear a mano y para corregir cursos después de importarlos).
>
> Trabaja en una sola pasada: **verifica primero** y luego implementa, pausando solo si
> encuentras algo que contradiga este spec.
>
> **Verifica (sin asumir):**
> 1. El validador de YAML y el script de construcción ya existentes, y el YAML del
>    curso de duelo (`curso-manejo-del-duelo.yaml`) para usarlo como caso de prueba.
> 2. Los nombres de campo reales del formato contra el esquema: umbral de aprobación
>    (`nota_minima` vs `umbral_aprobacion`), estructura de opciones del banco de
>    preguntas, y ausencia de `rethus_instructor`.
> 3. El esquema y las FK de las tablas de cursos, módulos, lecciones y banco de
>    preguntas; el nombre real de la columna del cuerpo de la lección y los tipos de
>    lección válidos; tipo y unicidad de `slug`.
> 4. El cliente admin de Supabase que el panel ya usa para insertar (reutilízalo).
> 5. La ruta dinámica bajo `app/admin/cursos/` (`[id]` vs `[slug]`), para que el
>    redirect tras importar no caiga en 404.
> 6. Si ya existe una util central `slugify(text)` (del arreglo del bug de slug);
>    reutilízala. Si no, créala y haz que el formulario manual y la importación usen la
>    misma.
>
> **Implementa:**
> 1. Botón "Importar YAML" junto a "Nuevo curso" en `/admin/cursos` (no tocar el
>    formulario manual).
> 2. Página `/admin/cursos/importar` con subir archivo o pegar YAML, disclaimer de
>    educación informal, y un paso de **validar/previsualizar que no escribe en la BD**:
>    parsea, corre las validaciones del validador existente, calcula el slug
>    normalizado, y muestra resumen (conteos de módulos/lecciones/preguntas), errores
>    legibles, advertencia de colisión de slug, y lecciones con URL `PENDIENTE`.
> 3. Acción de confirmar: re-valida en servidor, inserta curso + módulos + lecciones
>    (+ banco si el esquema lo soporta) en el orden de FK correcto, **dentro de una
>    transacción**, con el cliente admin existente; el curso queda en **borrador**.
> 4. Tras importar, redirige a la edición del curso usando la misma clave que esa
>    página consulta (sin 404).
> 5. **Colisión de slug — Opción A (no destructiva):** si el slug ya existe, rechaza la
>    importación con un mensaje claro y no sobrescribe nada.
> 6. Las lecciones `video`/`recurso` con URL `PENDIENTE` se importan igual; R2 no es
>    requisito para importar.
>
> Prueba con el YAML del curso de duelo: debe quedar con 8 módulos y 23 lecciones, en
> borrador, con el Markdown intacto y sin 404 en el redirect. Cambios no destructivos.
