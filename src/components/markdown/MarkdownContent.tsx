import ReactMarkdown from 'react-markdown'

import { cn } from '@/lib/utils'

interface MarkdownContentProps {
  source: string
  className?: string
}

/**
 * Render de Markdown con estilos prose del proyecto. Se usa tanto en el
 * visor del estudiante como en la vista previa del editor admin para que
 * coincidan (SPEC-CONTENIDO-LECCIONES §1, CA-1).
 */
export function MarkdownContent({ source, className }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        'space-y-3 text-ink-main [&_h1]:font-display [&_h1]:text-2xl [&_h2]:mt-4 [&_h2]:font-semibold [&_a]:text-teal [&_li]:ml-5 [&_li]:list-disc',
        className,
      )}
    >
      <ReactMarkdown>{source}</ReactMarkdown>
    </div>
  )
}
