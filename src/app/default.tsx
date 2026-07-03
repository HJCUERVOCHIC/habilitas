// Fallback nulo del root del App Router. Requerido para que el borboteo de
// notFound() desde segmentos anidados no dispare "No default component was
// found for a parallel route" en dev. Los sublevels (admin/, admin/cursos/,
// admin/cursos/[slug]/…) tienen su propio default; sin este, la raíz queda
// sin fallback y Next emite el warning en la consola del navegador.
export default function Default() {
  return null
}
