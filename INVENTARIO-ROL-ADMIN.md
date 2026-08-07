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
| A3 | Enrutamiento por rol tras el login | ◐ |
| A4 | Guardas de ruta en `/admin` (un estudiante no accede) | ◐ |
| A5 | Guarda `ensureAdmin()` en cada server action | ✅ |
| A6 | Shell y navegación coherentes entre paneles | ◐ |
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
| B5 | Eliminar curso (solo borradores, con confirmación) | ? |
| B6 | Listado de cursos con su estado | ✅ |
| B7 | **Búsqueda y filtrado en el listado** | ? |
| B8 | **Duplicar curso como plantilla** | ✖ |

**B5.** Estaba en el alcance del Bloque 1, pero nunca se confirmó si llegó a la UI o quedó solo en el spec. Pendiente arrastrado.

**B7.** Irrelevante con 4 cursos; se vuelve necesario a partir de ~20.

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
| D3 | Campo de duración estimada (`duration_min`) | ◐ |
| D4 | Campo de transcripción | ◐ |
| D5 | **Autoguardado o aviso de cambios sin guardar** | ✖ |
| D6 | **Historial de versiones del contenido** | ✖ |

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
| F1 | Banco de 15–20 preguntas por curso | ◐ |
| F2 | Crear, editar y eliminar preguntas y opciones | ◐ |
| F3 | Marcar la respuesta correcta | ◐ |
| F4 | Configurar nota mínima de aprobación | ◐ |
| F5 | 10 preguntas aleatorias por intento | ◐ |
| F6 | Temporizador de 20 min validado en servidor | ◐ |
| F7 | Bloqueo de 24 h al agotar intentos | ◐ |
| F8 | **Desbloquear manualmente a un estudiante bloqueado** | ✖ |
| F9 | **Análisis de ítems (qué preguntas fallan todos)** | ✖ |
| F10 | **Ver los intentos de un estudiante concreto** | ✖ |

**F8 — brecha operativa real.** Un profesional que agota sus intentos queda bloqueado 24 h y **no hay forma de ayudarlo desde el panel**. Es la primera solicitud de soporte que vas a recibir.

**F9.** Sin esto no sabes si una pregunta está mal redactada o si el contenido no la cubre. Es la retroalimentación que mejora el curso.

---

## G. Publicación

| # | Requerimiento | Estado |
|---|---|---|
| G1 | Checklist de publicación con criterios verificables | ✅ |
| G2 | Dependencia de R2 para cursos con lecciones de medio | ✅ |
| G3 | Validación de intensidad horaria (< 160 h) | ◐ |
| G4 | Bloqueo de publicación si el checklist no pasa | ◐ |
| G5 | **Advertencia al despublicar un curso con inscritos** | ✖ |
| G6 | **Vista previa del curso como lo ve el estudiante** | ? |

**G5 — brecha confirmada en incidente.** El 07-ago se despublicó un curso con un estudiante inscrito; desde su lado el curso desapareció junto con su avance aparente. No hubo pérdida de datos, pero tampoco hubo advertencia.

---

## H. Constancias de finalización

| # | Requerimiento | Estado |
|---|---|---|
| H1 | Registro de constancias emitidas | ◐ |
| H2 | Página pública de verificación por código | ◐ |
| H3 | Nomenclatura "constancia de finalización" en todas las superficies | ◐ |
| H4 | Vigencia contada desde la emisión | ◐ |
| H5 | **Snapshot del curso en el momento de emitir** | ✖ |
| H6 | **Revocar o anular una constancia emitida por error** | ✖ |
| H7 | **Reemitir constancia** | ✖ |
| H8 | **Exportar el registro (CSV)** | ? |
| H9 | Generación de PDF | ✖ (diferido por decisión) |

**H5 — la brecha de mayor riesgo legal.** La constancia afirma que una persona completó un contenido con una intensidad horaria dada. Si el curso se edita después, la constancia apunta a algo que ya no existe tal como se cursó. Ante una verificación —de un empleador o de la Secretaría de Educación en la Fase 3— no podrías reconstruir qué estudió esa persona. La solución es barata: copiar título, intensidad horaria y estructura al emitir.

---

## I. Importación de contenido

| # | Requerimiento | Estado |
|---|---|---|
| I1 | Importación masiva YAML (`/admin/cursos/importar`) | ◐ |
| I2 | Validar y previsualizar sin escribir | ◐ |
| I3 | Importación transaccional; el curso nace en borrador | ◐ |
| I4 | Colisión de slug no destructiva | ◐ |
| I5 | **Exportar un curso a YAML** | ✖ |
| I6 | Carga de documento Word con estructuración asistida por IA | ✖ (diferido) |

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
| M1 | Aviso legal de educación informal en superficies de usuario | ◐ |
| M2 | Nomenclatura "constancia", nunca "certificado" | ◐ |
| M3 | Sin promesa de credencial oficial ni aptitud ocupacional | ◐ |
| M4 | Intensidad horaria por curso | ◐ |
| M5 | **Verificación automatizada del cumplimiento P0/P1** | ? |
| M6 | **Datos personales: política de acceso y retención (Ley 1581)** | ✖ |

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
