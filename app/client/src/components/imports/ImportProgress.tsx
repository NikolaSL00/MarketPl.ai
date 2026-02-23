import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import type { ImportRecord } from '@/types/import'

interface ImportProgressProps {
  status: ImportRecord
  isPolling: boolean
}

const statusConfig = {
  pending: { label: 'Pending', variant: 'warning' as const, icon: Loader2 },
  processing: { label: 'Processing', variant: 'default' as const, icon: Loader2 },
  completed: { label: 'Completed', variant: 'gain' as const, icon: CheckCircle2 },
  failed: { label: 'Failed', variant: 'destructive' as const, icon: XCircle },
}

// Format seconds to human-readable duration
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.round((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}

export function ImportProgress({ status, isPolling }: ImportProgressProps) {
  const config = statusConfig[status.status]
  const Icon = config.icon
  const progress = status.total_rows > 0
    ? (status.processed_rows / status.total_rows) * 100
    : 0

  // Calculate elapsed time
  const uploadedAt = new Date(status.uploaded_at)
  const now = new Date()
  const elapsedMs = now.getTime() - uploadedAt.getTime()
  const elapsedSecs = elapsedMs / 1000

  // Calculate estimated time remaining
  const rowsRemaining = status.total_rows - status.processed_rows
  const rowsPerSecond = status.processed_rows / elapsedSecs
  const estimatedRemainingSecs = rowsRemaining > 0 ? rowsRemaining / rowsPerSecond : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Icon
              size={16}
              className={
                isPolling ? 'animate-spin text-[var(--accent)]' : ''
              }
            />
            {status.filename}
          </CardTitle>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Progress value={progress} max={100} />

          <div className="flex items-center justify-between text-xs font-mono-data">
            <span className="text-[var(--foreground-muted)]">
              {status.processed_rows.toLocaleString()} / {status.total_rows.toLocaleString()} rows
            </span>
            <span className="text-[var(--foreground-muted)]">
              {progress.toFixed(1)}%
            </span>
          </div>

          {status.status === 'processing' && (
            <div className="flex gap-4 text-xs flex-wrap">
              <span className="text-[var(--foreground-muted)]">
                Elapsed: {formatDuration(elapsedSecs)}
              </span>
              {rowsPerSecond > 0 && (
                <span className="text-[var(--foreground-muted)]">
                  {Math.round(rowsPerSecond * 60)} rows/min
                </span>
              )}
              {estimatedRemainingSecs > 0 && status.total_rows > 0 && (
                <span className="text-[var(--accent)]">
                  ETA: {formatDuration(estimatedRemainingSecs)}
                </span>
              )}
            </div>
          )}

          {status.status === 'completed' && (
            <div className="mt-2 flex gap-4 flex-wrap text-xs">
              <span className="text-[var(--gain)]">
                {status.processed_rows.toLocaleString()} rows imported
              </span>
              {status.symbols_count > 0 && (
                <span className="text-[var(--accent)]">
                  {status.symbols_count} symbols
                </span>
              )}
              <span className="text-[var(--foreground-muted)]">
                Total: {formatDuration(elapsedSecs)}
              </span>
            </div>
          )}

          {status.status === 'failed' && status.error && (
            <div className="mt-2 rounded-[var(--radius)] bg-[var(--loss-muted)] p-2 text-xs text-[var(--loss)]">
              {status.error}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
