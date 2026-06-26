# SPEC-PUBLICACION-CONSTANCIAS.md

**Bloque 4 — Publicación y constancias** *(cierra el rol del administrador)*

## Objetivo

Dos capacidades que cierran el rol del administrador:

1. **Publicación**: un checklist de "listo para publicar" por curso y la acción que pasa el curso de **borrador → publicado**, que es lo que lo hace visible en el catálogo y matriculable. Incluye **despublicar** (reversible).
2. **Constancias (vista admin)**: el registro de **constancias de finalización** emitidas, con enlace a la página pública de verificación.

**Fuera de alcance** (son del lado del estudiante, otras etapas): el catálogo, el reproductor del curso, la mecánica de intentos y la **emisión** de constancias (la dispara la finalización del estudiante). Aquí solo se publica/despublica y se **listan** las constancias ya emitidas.

Construye sobre los Bloques 0, 1, 2 y 3.

---

## §0 — Verificación previa

Inspeccionar el esquema y el repositorio reales y reportar hallazgos. No asumir nada:

1. **Estado del curso**
   - Campo de estado y sus valores reales (borrador/publicado). ¿Existe `published_at` o equivalente?

2. **Contrato con el catálogo**
   - Cómo selecciona el catálogo (lado estudiante) los cursos a mostrar: confirmar que muestra los de estado **publicado**. *No implementar el catálogo aquí*; solo confirmar el contrato para que publicar tenga el efecto esperado.

3. **Constancias**
   - ¿Existe tabla de constancias emitidas? Columnas (estudiante, curso, fecha, identificador/slug de verificación).
   - ¿Existe ya la página pública de verificación y el estado actual de la vista "Constancias" del admin.

4. **UI / acción de publicación existente** y **RLS** para cambios de estado y lectura de constancias.

**Entregable de §0:** reporte breve. Si algo difiere de la §1, proponerlo antes de implementar.

---

## §1 — Propuesta de implementación (condicionada a §0)

> Usar el esquema que ya exista; crear solo lo que falte, de forma aditiva.

### Publicación

- **Checklist de "listo para publicar"** por curso, que verifica:
  - **Metadatos**: título y descripción presentes.
  - **Estructura**: ≥ 1 módulo y ≥ 1 lección.
  - **Contenido por lección**: lecciones de tipo `texto` con `body_md` no vacío; lecciones de tipo `video | pdf | diapositivas | imagen` con su **referencia de medio** presente. *(Dependencia: las lecciones con medio requieren R2 configurado y el archivo subido; mientras R2 esté pendiente, no pasan este check. Un curso solo de texto sí puede publicarse.)*
  - **Evaluación**: banco cumple el mínimo (≥ 15–20 preguntas y ≥ `preguntas_por_intento`) y configuración definida (`nota_minima`, `preguntas_por_intento`).
- **Acción Publicar**: habilitada **solo** si el checklist pasa por completo; cambia estado a **publicado** y registra `published_at`. El curso queda visible en catálogo y matriculable.
- **Acción Despublicar**: revierte a **borrador** y lo retira del catálogo (reversible).
- El checklist muestra **claramente qué falta** cuando no se puede publicar.

### Constancias (vista admin)

- **Listado** de constancias de finalización emitidas: estudiante, curso, fecha de emisión y **enlace a la página pública de verificación**.
- Búsqueda/filtro básico (opcional).
- Manejo limpio del **estado vacío** (aún no hay emisiones).
- **Solo lectura** en este bloque: la emisión la dispara la finalización del estudiante (otra etapa).
- Conservar el naming "**constancia de finalización**" y los disclaimers de modalidad informal.

### Restricciones de implementación

- Cambios **aditivos y reversibles** donde sea posible.
- **No** construir catálogo, reproductor ni emisión de constancias (lado estudiante).
- Pantallas bajo `/admin`, protegidas por las guardas del Bloque 0.
- No introducir regresiones en P0/P1.

---

## §2 — Criterios de aceptación

1. Cada curso muestra un **checklist de publicación** con el estado de cada requisito (metadatos, estructura, contenido por lección, evaluación).
2. **Publicar está bloqueado** hasta que todos los requisitos pasen; el checklist indica qué falta.
3. Un curso **solo de texto** completo puede publicarse aun con R2 pendiente; uno con medios sin subir **no** pasa el check de contenido.
4. Al **publicar**, el estado pasa a publicado y se registra `published_at`; el curso queda en el estado que el catálogo usa para mostrarlo y permitir matrícula.
5. **Despublicar** revierte a borrador y lo retira del catálogo.
6. La vista **Constancias** lista las emitidas (estudiante, curso, fecha, enlace de verificación) y maneja el estado vacío.
7. La **emisión** de constancias NO se implementa en este bloque.
8. Un **estudiante** no puede acceder a `/admin`.
9. El cumplimiento P0/P1 sigue intacto.

---

## §3 — Prompt de arranque (formato único)

> Lee primero `CLAUDE.md` para el contexto de stack, decisiones de producto y reglas de desarrollo. Estás trabajando en el Bloque 4 (Publicación y constancias), descrito en `SPEC-PUBLICACION-CONSTANCIAS.md`. Asume que los Bloques 0, 1, 2 y 3 ya están implementados. Este bloque cierra el rol del administrador.
>
> Primero ejecuta la verificación de la sección §0: revisa el campo de estado del curso y `published_at`, cómo selecciona el catálogo los cursos (confirma que usa el estado publicado, sin implementarlo aquí), el esquema de constancias y la página de verificación, la UI/acción de publicación existente y las políticas RLS. Reporta brevemente los hallazgos.
>
> Si los hallazgos son compatibles con la §1, continúa directamente con la implementación de la §1 cumpliendo todos los criterios de la §2, sin detenerte a pedir aprobación. Detente y consúltame solo si encuentras algo que entre en conflicto con la §1.
>
> Recuerda los límites de alcance: no construyas el catálogo, el reproductor ni la emisión de constancias (son del lado del estudiante); la vista de Constancias del admin es de solo lectura. Respeta la dependencia de R2 en el checklist de contenido.
>
> Reglas: cambios aditivos y reversibles donde sea posible, conserva el naming "constancia de finalización" y los disclaimers de modalidad informal, usa el esquema real que encuentres, y no introduzcas regresiones en P0/P1.
