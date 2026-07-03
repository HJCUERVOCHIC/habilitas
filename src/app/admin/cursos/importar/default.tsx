// Fallback nulo del segmento (evita el warning "No default component was
// found for a parallel route" cuando notFound() borbotea por este nivel).
export default function Default() {
  return null
}
