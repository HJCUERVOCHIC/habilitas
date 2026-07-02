// Fallback nulo para el segmento (Next parallel-route warning en dev).
// Se necesita default.tsx en cada carpeta con page.tsx bajo un dynamic
// segment para que el borboteo de notFound() no dispare "No default
// component was found for a parallel route".
export default function Default() {
  return null
}
