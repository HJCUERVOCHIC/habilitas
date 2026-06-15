import type { Tables } from '@/types/database'

/** Estado del certificado calculado en runtime (HABILITAS-ESPECIFICACION §6.5). */
export type CertStatus = 'valid' | 'expired' | 'revoked'

/** Fila de la tabla certificates (snapshot al momento de emisión). */
export type Certificate = Tables<'certificates'>

/** Datos del curso necesarios para mostrar la "habilidad" certificada. */
export type CertCourse = Pick<Tables<'courses'>, 'title' | 'category'>
