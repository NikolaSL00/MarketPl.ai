import { useState, useEffect, useCallback } from 'react'
import { api } from '@/services/api'
import type { ImportRecord } from '@/types/import'

interface UseImportStatusReturn {
  status: ImportRecord | null
  isPolling: boolean
  error: string | null
}

export function useImportStatus(importId: string | null): UseImportStatusReturn {
  const [status, setStatus] = useState<ImportRecord | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const poll = useCallback(async (id: string) => {
    try {
      const result = await api.getImportStatus(id)
      // If the import was deleted externally, clear it
      if (result.status === 'deleting') {
        setStatus(null)
        return 'deleting'
      }
      setStatus(result)
      return result.status
    } catch (err) {
      // 404 = import was deleted; clear status so Current Import disappears
      setStatus(null)
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
      return 'failed'
    }
  }, [])

  useEffect(() => {
    if (!importId) {
      setStatus(null)
      setIsPolling(false)
      return
    }

    setIsPolling(true)
    let cancelled = false

    const run = async () => {
      while (!cancelled) {
        const currentStatus = await poll(importId)
        if (cancelled) break
        if (currentStatus === 'completed' || currentStatus === 'failed' || currentStatus === 'deleting') {
          setIsPolling(false)
          break
        }
        // Wait 1 second between polls
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [importId, poll])

  return { status, isPolling, error }
}
