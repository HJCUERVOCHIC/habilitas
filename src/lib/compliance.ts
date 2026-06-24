/**
 * Fuente única de los textos de modalidad regulatoria.
 * Ver SPEC-NAVEGACION.md §3 y CUMPLIMIENTO-DECRETO-1075.md §2.
 *
 * Cualquier UI que muestre el aviso (footer, catálogo, detalle, artefacto,
 * verificación pública) debe leer de aquí; nunca duplicar el texto legal.
 */
export const MODALIDAD = {
  etiqueta: 'Educación informal',
  norma: 'Decreto 1075 de 2015, Art. 2.6.6.8',
  avisoCorto:
    'Educación informal · No conduce a título ni a certificado de aptitud ocupacional (Decreto 1075 de 2015, Art. 2.6.6.8).',
} as const
