# INVENTARIO-ROL-ADMIN.md

**Alcance funcional del rol administrador — estado actual y brechas**

v1.0 · 07-ago-2026 · Insumo para el Bloque 5

---

## Cómo leer este documento

| Marca | Significado |
|---|---|
| ✅ | **Verificado.** Observado funcionando directamente (sesión de pruebas de R2 o inspección de código). |
| ◐ | **Documentado.** Descrito en un `SPEC-*.md` y reportado como implementado, pero **no verificado** en esta revisión. |
| ✖ | **No implementado.** Confirmado ausente o nunca especificado. |
| ? | **Desconocido.** Requiere verificación contra el código antes de afirmar nada. |

> Lo marcado con ◐ y ? necesita una pasada de verificación real. Este inventario sirve para decidir el alcance, no como certificación de estado.

---

## A. Acceso y roles

| # | Requerimiento | Estado |
|---|---|---|
| A1 | Login por Magic Link | ✅ |
| A2 | Roles mutuamente excluyentes (`admin` / `student`) | ✅ |
| A3 | Enrutamiento por rol tras el login | ✅ |
| A4 | Guardas de ruta en `/admin` (un estudiante no accede) | ✅ |
| A5 | Guarda `ensureAdmin()` en cada server action | ✅ |
| A6 | Shell y navegación coherentes entre paneles | ✅ |
| A7 | **Alta y gestión de cuentas admin desde la UI** | ✖ |

**A7 — brecha.** Hoy promover a alguien a admin se hace con un `UPDATE` manual en el SQL Editor de Supabase. Existen tres cuentas admin (`@arqs.co`, `@habilitas.co`, `@chicimportusa.com`) y no hay forma de auditarlas ni gestionarlas desde la plataforma.

---

## B. Gestión de cursos

| # | Requerimiento | Estado |
|---|---|---|
| B1 | Crear curso (nace como borrador) | ✅ |
| B2 | Editar metadatos del curso | ✅ |
| B3 | Archivar y restaurar curso | ✅ |
| B4 | Publicar y despublicar | ✅ |
| B5 | Eliminar curso (solo borradores, con confirmación) | ✖ |
| B6 | Listado de cursos con su estado | ✅ |
| B7 | **Búsqueda y filtrado en el listado** | ✖ |
| B8 | **Duplicar curso como plantilla** | ✖ |

**B5.** Verificado: no existe hard-delete en UI ni en acciones (`archiveCourse` es lo único; soft-delete de borradores desde la "Zona peligrosa" del detalle). No es una brecha operativa (archivar cumple el propósito); queda registrado como cerrado en la nomenclatura del inventario.

**B7.** Verificado: `/admin/cursos/page.tsx` renderiza el listado sin input de búsqueda ni filtros. Irrelevante con 4 cursos; se vuelve necesario a partir de ~20.

---

## C. Estructura del curso

| # | Requerimiento | Estado |
|---|---|---|
| C1 | Crear, editar y eliminar módulos | ✅ |
| C2 | Reordenar módulos | ✅ |
| C3 | Crear, editar y eliminar lecciones | ✅ |
| C4 | Reordenar lecciones | ✅ |
| C5 | Tipos de lección: Texto, Video, PDF | ✅ |
| C6 | El orden persiste entre sesiones | ✅ |
| C7 | Una lección puede existir sin contenido | ✅ |
| C8 | **Mover una lección entre módulos** | ✖ |

**C8.** Hoy reordenar solo funciona dentro del mismo módulo. Reorganizar un curso obliga a borrar y recrear, con la consiguiente pérdida de contenido.

---

## D. Contenido de lecciones

| # | Requerimiento | Estado |
|---|---|---|
| D1 | Editor Markdown (`body_md`) con vista previa | ✅ |
| D2 | Guardado con confirmación visual | ✅ |
| D3 | Campo de duración estimada (`duration_min`) | ◐ parcial |
| D4 | Campo de transcripción | ✖ |
| D5 | **Autoguardado o aviso de cambios sin guardar** | ✖ |
| D6 | **Historial de versiones del contenido** | ✖ |

**D3.** Verificado: la columna existe en `lessons` y se **muestra** en el listado de módulos (`" · {duration_min}m"`), pero **no hay input** para editarla ni en `ModulesManager` ni en `LessonEditor`. Solo se puede cargar vía import YAML o SQL directo. Es una brecha de edición, no de dato.

**D4.** Verificado: la columna `lessons.transcript` existe, `createLesson` la persiste como cadena vacía y **ninguna superficie de UI la edita ni la muestra**. En la práctica, transcripciones no se están capturando.

**D5.** Salir del editor con texto sin guardar lo pierde sin advertencia.

---

## E. Medios (Cloudflare R2)

| # | Requerimiento | Estado |
|---|---|---|
| E1 | Subida por URL PUT prefirmada | ✅ |
| E2 | Vista previa con URL GET firmada (1 h) | ✅ |
| E3 | Reemplazar archivo (borra el anterior) | ✅ |
| E4 | Quitar archivo (elimina el objeto en R2) | ✅ |
| E5 | Validación de tipo MIME por tipo de lección | ✅ |
| E6 | Límite de tamaño diferenciado (500 MB video · 50 MB PDF) | ✅ |
| E7 | Degradación limpia si R2 no está configurado | ✅ |
| E8 | **Renovación de la firma durante reproducción larga** | ✖ |
| E9 | **Limpieza de objetos huérfanos al borrar lección o curso** | ✖ |
| E10 | **Biblioteca de medios reutilizable entre lecciones** | ✖ |

**E8.** La firma dura una hora. Una lección de video larga vista con pausas puede vencer a mitad de reproducción.

**E9.** El reemplazo y el "quitar archivo" sí limpian (verificado). Pero borrar la **lección** o el **curso** deja los objetos en R2 sin referencia. Como la clave es `lessons/{lessonId}/…`, la limpieza por prefijo sería trivial de implementar.

---

## F. Evaluación

| # | Requerimiento | Estado |
|---|---|---|
| F1 | Banco de 15–20 preguntas por curso | ✅ |
| F2 | Crear, editar y eliminar preguntas y opciones | ✅ |
| F3 | Marcar la respuesta correcta | ✅ |
| F4 | Configurar nota mínima de aprobación | ✅ |
| F5 | 10 preguntas aleatorias por intento | ✅ con caveat |
| F6 | Temporizador de 20 min validado en servidor | ✅ |
| F7 | Bloqueo de 24 h al agotar intentos | ✅ |
| F8 | **Desbloquear manualmente a un estudiante bloqueado** | ✖ |
| F9 | **Análisis de ítems (qué preguntas fallan todos)** | ✖ |
| F10 | **Ver los intentos de un estudiante concreto** | ✖ |

**F1.** Verificado: `EvaluationManager` muestra `BankSummary` con umbral `RECOMMENDED_MIN_BANK = 15`; el checklist de publicación exige `bank ≥ max(15, questions_per_attempt)`.

**F2.** Verificado: `createQuestion`, `updateQuestion`, `deleteQuestion`, `reorderQuestion` en `src/app/admin/actions.ts`. Opciones dinámicas (mínimo 2, sin tope) desde `QuestionForm`.

**F3.** Verificado: radio de "opción correcta" en el form; `correct_option` persiste en `questions`. **Nunca viaja al cliente durante un intento** (proyección explícita en `loadQuestionsForClient` que solo pide `id, text, context, options, order_index`).

**F4.** Verificado: `ConfigPanel` + `setEvaluationConfig` guardan `courses.pass_score` (0–100 validado en servidor).

**F5 — caveat.** Verificado: `drawRandomIds` (Fisher-Yates) en `startAttempt` sortea. **Pero** el número usado es la constante fija `QUESTIONS_PER_ATTEMPT = 10` de `src/lib/evaluation.ts`, no la columna `evaluations.questions_per_attempt` que el admin puede editar. El `ConfigPanel` sí guarda el valor, y el checklist lo respeta como cota mínima del banco, pero el sorteo real siempre son 10. **La configuración por curso es cosmética hoy** — decisión heredada, documentada en el propio `evaluation.ts`. Riesgo: si un admin sube `questions_per_attempt` a 15 esperando ese sorteo, seguirá recibiendo 10 sin aviso.

**F6.** Verificado: `started_at` es fuente de verdad; `isAttemptExpired` (con margen de 15 s) valida en el servidor; envío tardío ignora el payload y solo cuenta lo previamente auto-guardado (`sanitizeAnswers`). El cronómetro del cliente es solo visual (D7).

**F7.** Verificado: `computeAttemptWindow` con `BLOCK_SEC = 24 h`; `startAttempt` rechaza con reason `blocked` si la ventana está agotada; el estado se recalcula después de cada submit.

**F8 — brecha operativa real.** Un profesional que agota sus intentos queda bloqueado 24 h y **no hay forma de ayudarlo desde el panel**. Es la primera solicitud de soporte que vas a recibir.

**F9.** Sin esto no sabes si una pregunta está mal redactada o si el contenido no la cubre. Es la retroalimentación que mejora el curso.

---

## G. Publicación

| # | Requerimiento | Estado |
|---|---|---|
| G1 | Checklist de publicación con criterios verificables | ✅ |
| G2 | Dependencia de R2 para cursos con lecciones de medio | ✅ |
| G3 | Validación de intensidad horaria (< 160 h) | ✖ |
| G4 | Bloqueo de publicación si el checklist no pasa | ✅ |
| G5 | **Advertencia al despublicar un curso con inscritos** | ✖ |
| G6 | **Vista previa del curso como lo ve el estudiante** | ✖ |

**G3.** Verificado: ni `getPublishChecklist` ni `CourseForm` validan `duration_hours < 160`. El `NumberField "Horas"` no impone `min`/`max`. Se puede publicar un curso con 500 h.

**G4.** Verificado: `setPublished` invoca `getPublishChecklist(courseId)` y devuelve error con detalle de lo que falta; `<PublishActions>` deshabilita el botón "Publicar" cuando `canPublish=false`.

**G5 — brecha confirmada en incidente.** El 07-ago se despublicó un curso con un estudiante inscrito; desde su lado el curso desapareció junto con su avance aparente. No hubo pérdida de datos, pero tampoco hubo advertencia.

**G6.** Verificado: no existe ruta ni botón "ver como estudiante". El admin no está inscrito y `/curso/[slug]` exige inscripción, así que hoy no puede recorrer el curso desde su rol. Los únicos previews son de Markdown (dentro del editor) y de YAML (importador).

---

## H. Constancias de finalización

| # | Requerimiento | Estado |
|---|---|---|
| H1 | Registro de constancias emitidas | ✅ |
| H2 | Página pública de verificación por código | ✅ |
| H3 | Nomenclatura "constancia de finalización" en todas las superficies | ✅ |
| H4 | Vigencia contada desde la emisión | ✅ |
| H5 | **Snapshot del curso en el momento de emitir** | ✖ |
| H6 | **Revocar o anular una constancia emitida por error** | ✅ |
| H7 | **Reemitir constancia** | ✖ |
| H8 | **Exportar el registro (CSV)** | ✅ |
| H9 | Generación de PDF | ✖ (diferido por decisión) |

**H1.** Verificado: tabla `certificates` + `/admin/certificados` + emisión automática al aprobar (`emitCertificate`), idempotente por `(user_id, course_id)` y por `eval_attempt_id`.

**H2.** Verificado: `/verificar/[id]` en SSR con `force-dynamic` y `revalidate=0`; lectura vía RPC `get_certificate` (security definer) para no exponer la tabla completa.

**H3.** Verificado: `MODALIDAD.artefacto = "Constancia de finalización"` es fuente única; las superficies visibles la usan. La palabra "Certificado" solo aparece en identificadores técnicos (tabla `certificates`, ruta `/admin/certificados`, componentes `Cert*`), no en texto al usuario.

**H4.** Verificado: `certificateExpiresAt(issued_at, cert_validity_days)` computa la vigencia; `expires_at` se guarda con la constancia.

**H6 — hallazgo inesperado.** El inventario lo marcaba como ✖. Verificado: existe `revokeCertificate(certId, reason)` en `actions.ts` (persiste `status='revoked'`, `revoked_at`, `revoke_reason`), el botón "Revocar" está en `CertAdminTable`, y la CSV lo exporta. Está completo. Corregido en la tabla.

**H8.** Verificado: `/admin/certificados/export/route.ts` con guard `isAdmin`, BOM UTF-8, 12 columnas, sin correo/user_id.

**H5 — la brecha de mayor riesgo legal.** La constancia afirma que una persona completó un contenido con una intensidad horaria dada. Si el curso se edita después, la constancia apunta a algo que ya no existe tal como se cursó. Ante una verificación —de un empleador o de la Secretaría de Educación en la Fase 3— no podrías reconstruir qué estudió esa persona. La solución es barata: copiar título, intensidad horaria y estructura al emitir.

---

## I. Importación de contenido

| # | Requerimiento | Estado |
|---|---|---|
| I1 | Importación masiva YAML (`/admin/cursos/importar`) | ✅ |
| I2 | Validar y previsualizar sin escribir | ✅ |
| I3 | Importación transaccional; el curso nace en borrador | ✅ |
| I4 | Colisión de slug no destructiva | ✅ |
| I5 | **Exportar un curso a YAML** | ✖ |
| I6 | Carga de documento Word con estructuración asistida por IA | ✖ (diferido) |

**I1–I4.** Verificado: `YamlImporter` + `previewYamlCourse` (no escribe; señala `slugTaken`) + `importYamlCourse` (transacción `pg` con `BEGIN`/`COMMIT`/`ROLLBACK`; `published:false`; rechaza sin tocar nada si el slug está tomado). Tests e2e en `src/tests/e2e/yaml-import.test.ts`.

**I5.** Sin exportación no hay respaldo del contenido fuera de la base de datos, ni forma de mover un curso entre entornos.

---

## J. Estudiantes e inscripciones — **ÁREA COMPLETA SIN IMPLEMENTAR**

| # | Requerimiento | Estado |
|---|---|---|
| J1 | Ver quién está inscrito en un curso | ✖ |
| J2 | Ver el avance de cada inscrito (lecciones completadas, %) | ✖ |
| J3 | Ver estado de evaluación por estudiante | ✖ |
| J4 | Listado global de estudiantes | ✖ |
| J5 | Ficha individual de un estudiante | ✖ |
| J6 | Inscribir o dar de baja manualmente | ✖ |
| J7 | Identificar inscritos inactivos o atascados | ✖ |
| J8 | Contacto con inscritos (correo, aviso) | ✖ |
| J9 | Métricas de cohorte (tasa de finalización, tiempo medio) | ✖ |

**Los datos ya existen.** Hay inscripciones, progreso por lección, intentos de evaluación y registro de constancias persistidos. Lo que falta no es instrumentación nueva sino **vistas de lectura que agreguen lo que ya está en la base**. Eso reduce sustancialmente el esfuerzo.

**Por qué es vital para el negocio.** El modelo depende de renovación en ciclos de contratación anual. Saber quién quedó a medias no es una métrica de vanidad: es la señal comercial que dispara el seguimiento.

---

## K. Pagos — **ÁREA SIN DEFINIR**

| # | Requerimiento | Estado |
|---|---|---|
| K1 | Registro de pagos por curso | ✖ |
| K2 | Estado de pago de una inscripción | ✖ |
| K3 | Configurar precio por curso | ? |
| K4 | Marcar el primer curso como gratuito | ? |
| K5 | Conciliación y reportes de ingresos | ✖ |
| K6 | Reembolsos | ✖ |

**Brecha estructural.** El modelo de negocio es "primer curso gratis, luego pago por curso", pero no hay evidencia de ninguna integración de pagos ni de gestión administrativa asociada. Esto no es un detalle del rol admin: **bloquea la monetización completa** y probablemente merece su propio bloque, no un rincón del Bloque 5.

---

## L. Auditoría y trazabilidad — **SIN IMPLEMENTAR**

| # | Requerimiento | Estado |
|---|---|---|
| L1 | Registro de quién modificó qué y cuándo | ✖ |
| L2 | Historial de publicación y despublicación | ✖ |
| L3 | Trazabilidad de emisión de constancias | ? |
| L4 | Registro de accesos administrativos | ✖ |

**Por qué importa ahora.** Hay tres cuentas admin. El incidente del 07-ago se pudo reconstruir solo porque lo hiciste tú y lo recordabas. Con un segundo administrador operando, un cambio inesperado sería imposible de rastrear. Y para la validación legal de la Fase 3, poder demostrar quién modificó un curso y cuándo es un argumento fuerte.

---

## M. Cumplimiento normativo (Decreto 1075)

| # | Requerimiento | Estado |
|---|---|---|
| M1 | Aviso legal de educación informal en superficies de usuario | ✅ |
| M2 | Nomenclatura "constancia", nunca "certificado" | ✅ |
| M3 | Sin promesa de credencial oficial ni aptitud ocupacional | ✅ |
| M4 | Intensidad horaria por curso | ✅ mostrar / ✖ validar |
| M5 | **Verificación automatizada del cumplimiento P0/P1** | ✖ |
| M6 | **Datos personales: política de acceso y retención (Ley 1581)** | ✖ |

**M1.** Verificado: `<ComplianceNotice>` (texto único desde `MODALIDAD.avisoLargo`) se monta en detalle de curso, catálogo, importador, verificación pública y documento de constancia. `ComplianceFooter` cubre el shell del estudiante.

**M2.** Verificado: `MODALIDAD.artefacto = "Constancia de finalización"`. La palabra "Certificado" solo aparece en identificadores técnicos (paths, tablas, tipos), nunca en texto visible al usuario.

**M3.** Verificado: `MODALIDAD.avisoLargo` afirma explícitamente que no conduce a título ni a certificado de aptitud ocupacional. Sin CTA que sugiera lo contrario.

**M4.** Verificado: `duration_hours` se guarda en `courses`, se copia a `certificates.duration_hours` y se muestra en el documento. **No hay validación de rango**; ver G3 — se puede publicar un curso con `duration_hours=500`.

**M5.** Verificado: los tests actuales cubren RLS (`rls-*`), evaluación server-side, idempotencia de emisión, y validación YAML. **Ninguno prueba compliance visible**: presencia de MODALIDAD en las páginas obligadas, ausencia de "certificado" en superficies públicas, encabezado del artefacto, vigencia calculada. Es una brecha porque una regresión en textos legales no rompe ninguna prueba hoy.

**M6.** En cuanto exista la vista de inscripciones (área J), se manejarán datos identificables de profesionales de la salud. Conviene definir **antes de construirla** qué se muestra, quién accede y qué queda auditado — es más barato que rehacer la pantalla después.

---

## N. Resumen de brechas por prioridad

### Críticas — bloquean operación o crean riesgo
1. **J1–J3** · Ver inscritos y su avance
2. **G5 + guardas de edición** · Impedir cambios destructivos en cursos con inscritos
3. **H5** · Snapshot del curso en la constancia
4. **F8** · Desbloquear a un estudiante que agotó intentos
5. **K1–K6** · Pagos (bloquea el modelo de negocio completo)

### Altas — deuda que crece con el uso
6. **L1–L2** · Auditoría de cambios
7. **E9** · Limpieza de medios huérfanos
8. **H6–H7** · Revocar y reemitir constancias
9. **M6** · Política de datos personales

### Medias — calidad de vida
10. **C8** · Mover lección entre módulos
11. **D5** · Aviso de cambios sin guardar
12. **F9** · Análisis de ítems
13. **I5** · Exportar curso a YAML
14. **A7** · Gestión de admins desde la UI
15. **B7** · Búsqueda en el listado de cursos

### Pendientes menores arrastrados
16. Botón "Nuevo curso" del Panel debe ir a `/admin/cursos`, no al formulario
17. Confirmar si **B5** (eliminar curso) llegó a la UI
18. Limpiar lecciones de prueba y el título con "xxxxx" en Manejo del Duelo

---

## O. Propuesta de alcance para el Bloque 5

Recomiendo **no** meter todo lo crítico en un solo bloque. Los pagos son un dominio aparte, con integración externa y consideraciones fiscales.

**Bloque 5 — Inscripciones, seguimiento y salvaguardas:** J1–J3, J5, G5, guardas de edición estructural, H5, F8, y la definición de M6.

Es coherente porque los siete puntos giran alrededor de la misma pregunta —*¿quién está cursando esto y qué le pasa si lo modifico?*— y comparten las mismas consultas de base de datos.

**Bloque 6 — Pagos y monetización:** toda el área K. Merece su propia investigación (pasarela, facturación en Colombia, conciliación).

**Bloque 7 — Auditoría y operación:** L1–L4, A7, E9, H6–H7.

Lo medio se atiende por goteo entre bloques.

---

## P. Hallazgos de la auditoría §0.A (07-ago-2026)

Resumen de las marcas ◐ y `?` resueltas contra el código real. Cambios respecto al inventario previo:

**Confirmadas y promovidas a ✅:** A3, A4, A6 (enrutamiento por rol y guardas), F1–F4, F6, F7 (banco, correcta oculta, config, timer server, bloqueo 24 h), G4 (bloqueo publicación por checklist), H1–H4, H8 (registro, verificación, nomenclatura, vigencia, CSV), I1–I4 (import YAML), M1–M3 (aviso legal, nomenclatura, sin promesas).

**Corregidas a ✖ o parcial:**
- **B5** (era `?`) → ✖: no existe hard-delete; sólo `archiveCourse`.
- **B7** (era `?`) → ✖: sin búsqueda ni filtros en el listado.
- **D3** (era ◐) → ◐ parcial: `duration_min` se muestra pero **no hay UI** para editarlo (solo import/SQL).
- **D4** (era ◐) → ✖: `transcript` existe en el esquema pero **ninguna UI lo edita ni muestra**; `createLesson` fija `''`.
- **G3** (era ◐) → ✖: no se valida `duration_hours < 160` en ninguna capa.
- **G6** (era `?`) → ✖: sin ruta "ver como estudiante". Los previews existentes son solo para Markdown y YAML.
- **M5** (era `?`) → ✖: los tests no cubren compliance visible; una regresión en `MODALIDAD` no rompe nada.

**Corregida al alza:** **H6** (era ✖) → ✅. `revokeCertificate` existe en `actions.ts` y `CertAdminTable` expone el botón "Revocar". La brecha crítica del listado del bloque N (H6–H7) queda reducida a H7 (reemitir).

**Caveat F5.** `startAttempt` sortea con la constante fija `QUESTIONS_PER_ATTEMPT = 10`, ignorando `evaluations.questions_per_attempt`. La UI del admin permite editar el valor y el checklist lo respeta como cota del banco, pero **el sorteo real siempre son 10 preguntas**. Es deuda documentada en `src/lib/evaluation.ts`; conviene registrarla como brecha explícita antes de F5 desaparecer del radar.

**Sin cambio:** todo lo ✅ previo se mantiene; todas las brechas ✖ del listado N que no aparecen arriba siguen igual.
