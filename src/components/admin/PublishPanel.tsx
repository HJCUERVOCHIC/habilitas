import { PublishActions } from '@/components/admin/PublishActions'
import { getPublishChecklist, type ChecklistItem } from '@/lib/publish-checklist'
import { cn } from '@/lib/utils'

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(new Date(iso))
}

interface PublishPanelProps {
  courseId: string
  published: boolean
  publishedAt: string | null
}

/**
 * Panel de publicación (SPEC-PUBLICACION-CONSTANCIAS §1 + §2):
 *   - Estado actual (Borrador / Publicado + fecha).
 *   - Checklist de requisitos con ✓/✗ y detalle de lo que falta.
 *   - Botones: Publicar (bloqueado hasta canPublish) / Despublicar (libre).
 *
 * Server component: el checklist se computa en el servidor a cada render para
 * reflejar cambios recientes en estructura, contenido y evaluación.
 */
export async function PublishPanel({ courseId, published, publishedAt }: PublishPanelProps) {
  const checklist = await getPublishChecklist(courseId)

  return (
    <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Publicación
          </h2>
          <p className="mt-1 text-sm">
            {published ? (
              <>
                <span className="rounded-md bg-green-pale px-2 py-0.5 text-xs font-semibold text-green-ok">
                  Publicado
                </span>{' '}
                {publishedAt && (
                  <span className="text-ink-soft">desde {formatDate(publishedAt)}</span>
                )}
              </>
            ) : (
              <>
                <span className="rounded-md bg-mist px-2 py-0.5 text-xs font-semibold text-ink-soft">
                  Borrador
                </span>{' '}
                <span className="text-ink-soft">
                  {publishedAt
                    ? `· última publicación: ${formatDate(publishedAt)}`
                    : '· nunca publicado'}
                </span>
              </>
            )}
          </p>
        </div>
        <PublishActions
          courseId={courseId}
          published={published}
          canPublish={checklist.canPublish}
        />
      </header>

      <ul className="mt-4 space-y-2" aria-label="Checklist de publicación">
        {checklist.items.map((item) => (
          <ChecklistRow key={item.id} item={item} />
        ))}
      </ul>

      {!checklist.canPublish && !published && (
        <p className="mt-4 text-xs text-ink-soft">
          Completa los pasos pendientes para habilitar el botón &ldquo;Publicar&rdquo;.
        </p>
      )}
    </section>
  )
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-md border border-border p-3 text-sm',
        item.passed ? 'bg-green-pale/40' : 'bg-mist',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          item.passed ? 'bg-green-ok text-white' : 'bg-amber text-white',
        )}
      >
        {item.passed ? '✓' : '!'}
      </span>
      <div className="min-w-0">
        <p className={cn('font-medium', item.passed ? 'text-green-ok' : 'text-charcoal')}>
          {item.label}
        </p>
        {item.detail && !item.passed && (
          <p className="mt-0.5 text-xs text-ink-soft">{item.detail}</p>
        )}
      </div>
    </li>
  )
}
