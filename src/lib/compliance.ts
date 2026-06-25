/**
 * Fuente única de los textos de modalidad regulatoria.
 * Ver SPEC-CUMPLIMIENTO-P0.md §2 y CUMPLIMIENTO-DECRETO-1075.md §2, §4.
 *
 * Regla: ningún componente escribe texto legal inline; todo sale de aquí.
 * El esquema de la base (tabla certificates, columnas, RPCs) conserva sus
 * nombres internos; este módulo gobierna solo el texto visible al usuario.
 */
export const MODALIDAD = {
  etiqueta: 'Educación informal',
  norma: 'Decreto 1075 de 2015, Art. 2.6.6.8',
  artefacto: 'Constancia de finalización',
  encabezadoArtefacto: 'CONSTANCIA DE FINALIZACIÓN — Educación informal',
  avisoCorto:
    'Educación informal · No conduce a título ni a certificado de aptitud ocupacional (Decreto 1075 de 2015, Art. 2.6.6.8).',
  avisoLargo:
    'Este curso corresponde a la modalidad de educación informal conforme al artículo 2.6.6.8 del Decreto 1075 de 2015. Su objetivo es complementar, actualizar, perfeccionar o profundizar conocimientos, habilidades y prácticas. No conduce a título alguno ni a certificado de aptitud ocupacional. La constancia emitida acredita únicamente la finalización del curso y no constituye una habilitación profesional ni reconocimiento de competencias laborales.',
} as const
