// Defensa contra el warning de Next.js "No default component was found for a
// parallel route" en algunos transitorios de dev: provee un fallback nulo
// para cualquier slot paralelo (incluso si hoy no existe ninguno bajo /admin).
export default function Default() {
  return null
}
