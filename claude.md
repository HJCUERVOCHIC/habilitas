# CLAUDE.md — Proyecto Habilitas

## Qué es
Plataforma de certificación de habilidades clínicas para profesionales de la salud en Colombia.
MVP (objetivo: 2 semanas): **cursos → evaluación → certificado verificable**. **Sin pasarela de pagos en el MVP.**

## Fuentes de verdad — LEER ANTES DE CUALQUIER TRABAJO
1. `HABILITAS-ESPECIFICACION-FUNCIONAL.md` — qué hace la plataforma y bajo qué reglas: requisitos por pantalla, criterios de aceptación, reglas de negocio, decisiones de producto y plan de construcción por slices.
2. `HABILITAS-STACK.md` — fuente de verdad técnica: stack, render por ruta, estructura de carpetas, schema de DB + RLS, capa de contenido y certificados.
3. `habilitas-setup-README.md` — setup del design system y estructura de componentes.

Ante conflicto: en lo **funcional** manda la especificación; en lo **técnico** manda el stack. No improvisar fuera de estos documentos sin avisar primero.

## Stack (resumen; detalle en HABILITAS-STACK.md)
Next.js 14 App Router · TypeScript estricto · Tailwind + design system propio · shadcn/ui · Supabase (Auth Magic Link, Postgres con RLS, Edge Functions) · Cloudflare R2 · Resend · Vercel.

## Reglas de desarrollo (HABILITAS-STACK.md §4)
- TypeScript estricto: sin `any`, sin `as unknown`.
- RLS en cada tabla: un usuario solo ve sus datos.
- Contenido siempre por URL firmada; nunca exponer URLs directas de R2 al cliente.
- Un solo `btn-primary` visible por sección o formulario.
- Gradiente teal SOLO en `cert-doc-header`; en el resto, color sólido.
- PPTX → PDF al subir; nunca servir PowerPoint al estudiante.
- `/verificar/[id]` en SSR (`force-dynamic`): el estado del certificado debe ser tiempo real.
- Magic Link, sin contraseñas.

## Decisiones de producto — CONTRATO (HABILITAS-ESPECIFICACION-FUNCIONAL.md §8)
- **D1** — Evaluación: sin feedback por pregunta durante el intento calificado. Al enviar: aprobado puede revisar respuestas con explicaciones; reprobado solo ve temas a reforzar (nunca la respuesta literal) y reintenta con un nuevo sorteo.
- **D2** — Acceso gratuito de lanzamiento: precio visible etiquetado "Gratis durante el lanzamiento", inscripción gratuita, CTA "Comenzar curso". Pasarela en Fase 2.
- **D3** — "Lección completada": video al ≥90% de reproducción (`last_position`); pdf/slides/imagen/texto con botón "Marcar como vista".
- **D4** — Banco de ~15–20 preguntas por curso; cada intento saca N al azar (N configurable, default 10).
- **D5** — Sin PDF descargable en el MVP; el artefacto compartible es la página de verificación en vivo (QR + URL). PDF en Fase 2.
- **D6** — RETHUS autodeclarado; nunca afirmar "verificado".
- **D7** — Temporizador validado en servidor (`started_at`); el cronómetro de cliente es solo visual.

Limitación conocida (fuera del MVP): la evaluación es en línea, no supervisada, y no verifica la identidad del evaluado.

## Cómo construimos
- Por **slices verticales** (datos → backend → UI), no componente por componente. El orden está en §10 de la especificación.
- Cada slice debe **autoverificarse** antes de entregar: tests, type-check y el proyecto corriendo localmente.
- Al cerrar un slice, cumplir sus **criterios de aceptación (CA)** de la especificación y reportar cómo verificarlo.
- Antes de escribir código en un slice, exponer el plan y esperar confirmación.

## Estado actual
Arrancando el **slice 0**: esqueleto Next.js + design system + schema Supabase con RLS + Magic Link.