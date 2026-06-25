/**
 * Envío de email vía Resend (HABILITAS-STACK.md §9). Con fallback: si
 * RESEND_API_KEY / RESEND_FROM_EMAIL no están configurados, no envía y reporta
 * sent:false (la emisión del certificado no debe fallar por el email).
 */
interface CertificateEmailParams {
  to: string
  professionalName: string
  courseTitle: string
  score: number
  expiresAt: string
  certId: string
  verifyUrl: string
}

export async function sendCertificateEmail(
  params: CertificateEmailParams,
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) {
    console.log(`[email] Resend no configurado; se omite el envío de ${params.certId}.`)
    return { sent: false }
  }

  const expires = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(
    new Date(params.expiresAt),
  )
  const html = `
    <h2>Tu constancia Habilitas está lista</h2>
    <p>Hola ${params.professionalName},</p>
    <p>Aprobaste <strong>${params.courseTitle}</strong> con un puntaje de ${params.score}%.</p>
    <p>Tu constancia <strong>${params.certId}</strong> es válida hasta el ${expires}.</p>
    <p><a href="${params.verifyUrl}">Ver mi constancia</a></p>
    <p>Comparte este enlace con tu empleador para verificación inmediata.</p>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: `Tu constancia Habilitas está lista — ${params.courseTitle}`,
        html,
      }),
    })
    if (!res.ok) {
      console.error('[email] Resend respondió', res.status, await res.text())
      return { sent: false }
    }
    return { sent: true }
  } catch (error) {
    console.error('[email] Error enviando con Resend:', error)
    return { sent: false }
  }
}
