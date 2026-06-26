import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Cliente de Cloudflare R2 y URLs firmadas (HABILITAS-STACK.md §8).
 * El frontend nunca recibe URLs directas de R2; siempre URLs firmadas con
 * expiración corta. Si las variables R2_* no están configuradas, las funciones
 * devuelven null (el admin y el viewer del estudiante degradan limpio).
 */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME,
  )
}

let client: S3Client | null = null

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  }
  return client
}

/**
 * URL firmada GET para una lección. expiresInSeconds: ~3600 (1h) para video,
 * ~900 (15min) para documentos. Devuelve null si R2 no está configurado.
 */
export async function getSignedLessonUrl(
  r2Key: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!isR2Configured()) return null
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: r2Key }),
    { expiresIn: expiresInSeconds },
  )
}

/**
 * URL firmada PUT para subir un objeto a R2 (SPEC-CONTENIDO-LECCIONES §1).
 * El cliente sube con `fetch(url, { method: 'PUT', body: file, headers:
 * { 'Content-Type': contentType } })` — el Content-Type del PUT debe coincidir
 * con el firmado, sino la firma se rechaza. Devuelve null si R2 no está
 * configurado.
 */
export async function getSignedUploadUrl(
  r2Key: string,
  contentType: string,
  expiresInSeconds = 900,
): Promise<string | null> {
  if (!isR2Configured()) return null
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: r2Key,
      ContentType: contentType,
    }),
    { expiresIn: expiresInSeconds },
  )
}

/**
 * Elimina un objeto de R2. Idempotente: si no existe, R2 responde 204.
 * Devuelve false si R2 no está configurado o si la llamada falla.
 */
export async function deleteR2Object(r2Key: string): Promise<boolean> {
  if (!isR2Configured()) return false
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: r2Key }),
    )
    return true
  } catch (error) {
    console.error('[r2] deleteObject falló:', error)
    return false
  }
}
