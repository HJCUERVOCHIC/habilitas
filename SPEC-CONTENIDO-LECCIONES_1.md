# SPEC-CONTENIDO-LECCIONES.md

**Bloque 2 — Contenido de lecciones**

## Objetivo

Permitir que el administrador llene el contenido de cada lección creada en el Bloque 1:

- **Texto** → editor de Markdown (`body_md`) almacenado en la base de datos y renderizado en línea.
- **Video, PDF, diapositivas, imagen** → carga del archivo a Cloudflare R2 mediante URL prefirmada, sirviendo el medio con URLs prefirmadas de vida corta.

El curso permanece en **borrador**. La evaluación es el **Bloque 3** y la publicación el **Bloque 4**. Construye sobre la estructura del **Bloque 1** (`SPEC-CURSOS-ESTRUCTURA.md`) y el shell/guardas del **Bloque 0**.

---

## §0 — Verificación previa (NO modificar todavía)

Inspeccionar el repositorio, el esquema y la configuración reales, y reportar hallazgos. No asumir nada:

1. **Esquema de lecciones**
   - ¿Existe un campo `body_md` (o equivalente) en la tabla de lecciones?
   - ¿Existe ya un campo o tabla de **referencia a medios en R2** (object key, nombre original, content-type, tamaño)? ¿Qué falta?

2. **Integración con R2**
   - ¿Existen utilidades para generar **URLs prefirmadas**? Confirmar si hoy cubren solo **descarga (GET)** o también **subida (PUT)**.
   - ¿Están presentes las variables de entorno de R2 (bucket, endpoint, credenciales)? Confirmar **presencia**, no valores.

3. **Renderizado de Markdown**
   - ¿Hay ya una librería de Markdown en el proyecto para renderizar `body_md`? ¿Cómo y dónde se renderiza hoy, si existe?

4. **UI de edición de lección**
   - Estado de la pantalla de edición de lección que dejó el Bloque 1.

5. **RLS / políticas**
   - Políticas de escritura sobre lecciones y, si aplica, sobre el almacenamiento.

**Entregable de §0:** reporte breve. Si algo difiere de la §1 —en especial si la subida PUT prefirmada **no** está cableada—, proponer el ajuste antes de implementar.

---

## §1 — Propuesta de implementación (condicionada a §0)

> Usar el esquema y las utilidades que ya existan; crear solo lo que falte, de forma aditiva.

### Modelo de contenido

- `body_md` (Markdown) **opcional en toda lección**, almacenado en la base de datos.
- Lecciones de tipo `video | pdf | diapositivas | imagen`: **referencia a objeto R2** (object key + metadatos: nombre original, content-type, tamaño).

### Editor en el admin

- **Editor de Markdown** para `body_md` con **vista previa** que coincide con el render del estudiante.
- Para tipos con medio: **control de carga de archivo** con validación de tipo y tamaño según el tipo de lección; mostrar el archivo actual y permitir **reemplazar** o **quitar**.
- **Vista previa de la lección** tal como se renderizará (texto + medio), sin que el admin cambie de rol.

### Flujo de subida prefirmada

1. El cliente solicita al servidor una **URL PUT prefirmada**. La generación ocurre **del lado del servidor**; las credenciales de R2 **nunca llegan al cliente**.
2. El cliente sube el archivo **directo a R2** con esa URL.
3. Al confirmarse, se **persiste el object key** y los metadatos en la lección.

### Visualización del medio

- El servidor genera **URLs GET prefirmadas de vida corta**, bajo demanda, para previsualizar/reproducir el medio.

### Restricciones de implementación

- Cambios **aditivos y reversibles** donde sea posible.
- URLs prefirmadas de **vida limitada**; **sin secretos en el cliente**.
- Pantallas bajo `/admin`, protegidas por las guardas del Bloque 0.
- El curso permanece en **borrador**.
- No introducir regresiones en P0/P1.

---

## §2 — Criterios de aceptación

1. El admin puede editar `body_md` de una lección y ver una **vista previa** que coincide con el render del estudiante.
2. El admin puede **subir** un archivo (video/PDF/diapositivas/imagen) a R2 para el tipo de lección que corresponda, y la referencia queda **persistida**.
3. El admin puede **reemplazar** o **quitar** el medio de una lección.
4. La subida ocurre **directo a R2 vía URL PUT prefirmada**; ninguna credencial de R2 llega al cliente.
5. El tipo y el tamaño del archivo se **validan** según el tipo de lección.
6. El medio se previsualiza mediante **URL GET prefirmada de vida corta**.
7. Una lección puede guardarse con su contenido; el curso sigue en **borrador**.
8. Un **estudiante** no puede acceder a estas pantallas.
9. El cumplimiento P0/P1 sigue intacto.

---

## §3 — Prompt de arranque

> Lee primero `CLAUDE.md` para el contexto de stack, decisiones de producto y reglas de desarrollo. Estás trabajando en el Bloque 2 (Contenido de lecciones), descrito en `SPEC-CONTENIDO-LECCIONES.md`. Asume que los Bloques 0 y 1 ya están implementados: existen el shell/guardas del administrador y la estructura de cursos, módulos y lecciones.
>
> Antes de modificar nada, ejecuta la verificación de la sección §0: revisa el esquema de lecciones (campo `body_md`, referencia a medios en R2), la integración con R2 (si las URLs prefirmadas cubren solo descarga o también subida, y si las variables de entorno de R2 están presentes), la librería de Markdown disponible y el estado de la UI de edición de lección. Reporta tus hallazgos de forma concisa y, si algo difiere de la §1 —sobre todo si la subida PUT prefirmada no está cableada—, propón el ajuste antes de continuar. No implementes todavía: espera mi visto bueno al reporte.
>
> Tras mi aprobación, implementa la §1 cumpliendo todos los criterios de la §2. Aplica cambios aditivos y reversibles donde sea posible, nunca expongas credenciales de R2 al cliente, usa el esquema y las utilidades reales que encuentres, y no introduzcas regresiones en P0/P1.
