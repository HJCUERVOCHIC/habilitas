/**
 * Serialización mínima a CSV (RFC 4180).
 * No dependencia externa; uso interno por el endpoint admin de exportación.
 *
 * - Separador: coma.
 * - Newline entre filas: CRLF.
 * - Quoting: solo cuando el valor contiene `"`, `,`, CR o LF; las comillas
 *   internas se escapan duplicándolas.
 * - `null` y `undefined` se serializan como cadena vacía.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/["\r\n,]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const lines: string[] = []
  lines.push(headers.map(escapeCsvField).join(','))
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(','))
  }
  return lines.join('\r\n')
}
