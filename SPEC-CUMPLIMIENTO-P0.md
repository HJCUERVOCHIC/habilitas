# SPEC-CUMPLIMIENTO-P0.md

**Fase:** 1 — Cumplimiento P0 (bloquea lanzamiento)
**Proyecto:** Habilitas — Next.js + Supabase + Cloudflare R2
**Origen:** `CUMPLIMIENTO-DECRETO-1075.md` (§2, §4, §8) y `SPEC-NAVEGACION.md` (Fase 0 ya implementada)
**Tipo:** Vertical slice — deja la plataforma alineada con la modalidad de educación informal en todas las superficies visibles.
**Requisitos:** R1, R2, R3.

> **Por qué estas tres primero.** Son las que cierran el riesgo regulatorio más alto (etiquetado y nomenclatura) y son baratas: texto + etiquetas + un par de campos. Con el shell de Fase 0 ya existente, los avisos tienen dónde vivir.

---

## 0. Principio rector (igual que Fase 0)

Inspeccionar el código real antes de modificar. Nombres de archivos/rutas en este spec son **propuestas a reconciliar**. Cambios no destructivos. Revisión por milestone, no por componente.

---

## 1. Paso de descubrimiento (ejecutar y reportar antes de implementar)

1. **Cierre de Fase 0.** Confirmar que el shell cumple: redirección a `/dashboard` tras login, nav consistente, ítem admin solo para `role='admin'`, footer con aviso en todas las rutas del shell. Reportar cualquier criterio sin cumplir.
2. **`lib/compliance.ts`.** ¿Existe (creado en Fase 0)? ¿Qué campos tiene hoy? (Fase 0 solo requería `avisoCorto`.)
3. **Nomenclatura actual.** Buscar TODAS las ocurrencias de "certificado" / "certificate" / "certificación" en **texto visible al usuario**: componentes, archivos de strings/i18n, plantillas del artefacto, página de verificación, catálogo, detalle. Listarlas con su ubicación.
4. **Artefacto de finalización.** ¿Cómo se genera hoy la "constancia/certificado"? (PDF server-side, render HTML, imagen, etc.) ¿Dónde está la plantilla? ¿Qué datos incluye?
5. **Página de verificación.** Ruta, si es pública, qué datos expone hoy y cómo (vista/RPC). Confirmar que no expone `user_id`/correo.
6. **Catálogo y detalle.** Rutas y componentes de tarjeta de catálogo y de detalle de curso (donde irá el aviso).

Entregar este inventario y esperar visto bueno antes de implementar.

---

## 2. Extender la fuente única — `lib/compliance.ts`

Si Fase 0 lo creó con solo `avisoCorto`, **extenderlo** (no duplicar) con los textos canónicos de `CUMPLIMIENTO-DECRETO-1075.md` §4. Si no existe, crearlo completo.

```ts
// lib/compliance.ts — fuente de verdad de textos legales (CUMPLIMIENTO-DECRETO-1075.md §2, §4)
export const MODALIDAD = {
  etiqueta: "Educación informal",
  norma: "Decreto 1075 de 2015, Art. 2.6.6.8",
  artefacto: "Constancia de finalización", // título del documento; NUNCA "certificado"
  avisoCorto:
    "Educación informal · No conduce a título ni a certificado de aptitud ocupacional (Decreto 1075 de 2015, Art. 2.6.6.8).",
  avisoLargo:
    "Este curso corresponde a la modalidad de educación informal conforme al artículo 2.6.6.8 del Decreto 1075 de 2015. Su objetivo es complementar, actualizar, perfeccionar o profundizar conocimientos, habilidades y prácticas. No conduce a título alguno ni a certificado de aptitud ocupacional. La constancia emitida acredita únicamente la finalización del curso y no constituye una habilitación profesional ni reconocimiento de competencias laborales.",
  encabezadoArtefacto: "CONSTANCIA DE FINALIZACIÓN — Educación informal",
} as const;
```

Regla: ningún texto legal se escribe inline en componentes; todo sale de `MODALIDAD`.

---

## 3. Requisitos

### R1 — Aviso de modalidad en cada superficie · Art. 2.6.6.8, 2.6.6.1
Mostrar el aviso de modalidad en: tarjeta de catálogo, detalle de curso, artefacto de finalización, página de verificación y footer (footer ya hecho en Fase 0).
- Tarjeta de catálogo y footer → `avisoCorto`.
- Detalle de curso, artefacto y verificación → `avisoLargo`.
- Visible y legible (no oculto en tooltip), sin requerir scroll crítico.

### R2 — Renombrar "certificado" → "constancia" en texto visible · Art. 2.6.2.2, 2.6.4.3
Todo texto de cara al usuario que diga "certificado/certificación" pasa a "constancia". El título del documento emitido es `MODALIDAD.encabezadoArtefacto`.
- El **código interno** puede conservar nombres como `certificate`/`certificates` para no romper el esquema; solo se cambia el **texto renderizado**.
- Única excepción permitida: cuando se usa para **negar** ("no conduce a certificado de aptitud ocupacional", que ya viene en los avisos).

### R3 — Página de verificación con aviso y naturaleza del servicio · Art. 2.6.6.8, 2.3.7.4.5
La página pública de verificación muestra `avisoLargo` y deja inequívoco que la constancia acredita finalización de un curso de educación informal, no una habilitación profesional.
- Mantener el contrato de datos de `CUMPLIMIENTO-DECRETO-1075.md` §6 (nombre, curso, fecha, ID, estado, modalidad). No exponer correo ni identificadores internos. (RETHUS no se recolecta — PT-1.)

---

## 4. Criterios de aceptación (gate P0 — del §8 del doc de cumplimiento)

- [ ] R1 — Aviso de modalidad visible en catálogo, detalle, artefacto, verificación y footer.
- [ ] R2 — Búsqueda de "certificado/certificación" en texto renderizado → 0 ocurrencias dirigidas al usuario, salvo las de negación dentro de los avisos. Artefacto titulado "Constancia de finalización".
- [ ] R3 — La página de verificación muestra el `avisoLargo` y la naturaleza del servicio.
- [ ] Todos los textos legales salen de `lib/compliance.ts` (cero texto legal inline en componentes).
- [ ] La verificación pública no expone correo ni identificadores internos.

---

## 5. Fuera de alcance de la Fase 1 (disciplina de scope → Fase 2 / P1)

- R4 metadatos del curso (horas, objetivos, perfil de egreso, contenidos, metodología).
- R5 criterios de evaluación/promoción públicos.
- R6 perfil del formador.
- R7 horas en la constancia y acumulado.
- R8 exportación admin.
- R9 endurecimiento anti-fraude (ID único, estado válida/revocada) — salvo lo mínimo que ya tenga la verificación.
- RETHUS (PT-1) y mecanismo de acceso por correo (PT-2).

---

## 6. Prompt de arranque para Claude Code

> Vamos a implementar la Fase 1 (Cumplimiento P0) descrita en `SPEC-CUMPLIMIENTO-P0.md`. **No modifiques código todavía.** Primero ejecuta el Paso de descubrimiento (§1): confirma el cierre de la Fase 0, dime si existe `lib/compliance.ts` y qué campos tiene, y entrégame el inventario completo de ocurrencias de "certificado/certificación" en texto visible, cómo se genera el artefacto de finalización y qué expone hoy la página de verificación. Con base en eso, propónme el plan reconciliado con el código real y espera mi visto bueno antes de implementar. Trabaja de forma no destructiva; conserva los nombres internos del esquema y cambia solo el texto visible.
