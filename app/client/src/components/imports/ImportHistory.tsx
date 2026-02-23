import { useState, useEffect, useCallback } from 'react'
import { api } from '@/services/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Trash2, RefreshCw } from 'lucide-react'
import type { ImportRecord } from '@/types/import'

interface ImportHistoryProps {
  refreshTrigger?: number
}

const statusVariants: Record<string, 'warning' | 'default' | 'gain' | 'destructive'> = {
  pending: 'warning',
  processing: 'default',
  completed: 'gain',
  failed: 'destructive',
  deleting: 'destructive',
}

export function ImportHistory({ refreshTrigger }: ImportHistoryProps) {
  const [imports, setImports] = useState<ImportRecord[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchImports = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await api.listImports(0, 50)
      setImports(result.data)
      setTotal(result.total)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchImports()
  }, [fetchImports, refreshTrigger])

  // Auto-poll while any import is in a transient state (processing/deleting)
  useEffect(() => {
    const hasTransient = imports.some(
      (imp) => imp.status === 'processing' || imp.status === 'deleting' || imp.status === 'pending'
    )
    if (!hasTransient) return

    const interval = setInterval(fetchImports, 3000)
    return () => clearInterval(interval)
  }, [imports, fetchImports])

  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  const handleDelete = async (importId: string) => {
    if (!confirm('Delete this import and all its stock price data? This may take a while for large datasets.')) {
      return
    }
    setDeletingIds((prev) => new Set(prev).add(importId))
    try {
      await api.deleteImport(importId)
      // Refresh to show 'deleting' status
      fetchImports()
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(importId)
        return next
      })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Import History ({total})</CardTitle>
        <Button variant="ghost" size="icon" onClick={fetchImports} disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </Button>
      </CardHeader>
      <CardContent>
        {imports.length === 0 ? (
          <p className="text-sm text-[var(--foreground-muted)]">No imports yet.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--foreground-muted)]">
                  <th className="pb-2 pr-4 font-medium">Filename</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium font-mono-data text-right">Rows</th>
                  <th className="pb-2 pr-4 font-medium font-mono-data text-right">Symbols</th>
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {imports.map((imp) => (
                  <tr
                    key={imp.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="py-2 pr-4 text-[var(--foreground)]">
                      {imp.filename}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant={statusVariants[imp.status] ?? 'secondary'}>
                        {imp.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 font-mono-data text-right text-[var(--foreground)]">
                      {imp.processed_rows.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 font-mono-data text-right text-[var(--foreground)]">
                      {imp.symbols_count}
                    </td>
                    <td className="py-2 pr-4 text-[var(--foreground-muted)]">
                      {new Date(imp.uploaded_at).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      {imp.status === 'deleting' ? (
                        <span className="flex items-center gap-1 text-[10px] text-[var(--loss)]">
                          <RefreshCw size={12} className="animate-spin" />
                          Deleting…
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(imp.id)}
                          disabled={deletingIds.has(imp.id)}
                          className="h-7 w-7 text-[var(--foreground-muted)] hover:text-[var(--loss)]"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
