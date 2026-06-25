import type { Metadata } from 'next'
import { DM_Sans, DM_Serif_Display } from 'next/font/google'
import './globals.css'

// DM Sans — UI / body / botones / labels (HABILITAS-STACK.md §6)
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

// DM Serif Display — display / headings / precios / nombres en certificados
const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-dm-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Habilitas — Educación clínica con constancia verificable',
  description:
    'Estudia, demuestra tu dominio y obtén una constancia con URL pública verificable.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es-CO">
      <body className={`${dmSans.variable} ${dmSerif.variable} font-sans`}>{children}</body>
    </html>
  )
}
