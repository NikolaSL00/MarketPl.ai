import { useState, useCallback, useEffect } from 'react'
import { FileDropZone } from '@/components/imports/FileDropZone'
import { ImportProgress } from '@/components/imports/ImportProgress'
import { ImportHistory } from '@/components/imports/ImportHistory'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useImportStatus } from '@/hooks/useImportStatus'

export function ImportPage() {
  const { upload, isUploading, importId, error: uploadError, reset } = useFileUpload()
  const { status, isPolling } = useImportStatus(importId)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleFileSelected = useCallback(
    async (file: File) => {
      reset()
      await upload(file)
    },
    [upload, reset]
  )

  // Trigger history refresh when import completes
  const isComplete = status?.status === 'completed' || status?.status === 'failed'
  useEffect(() => {
    if (isComplete) {
      setRefreshKey((k) => k + 1)
    }
  }, [isComplete])

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Upload Zone */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">
          Upload CSV
        </h2>
        <FileDropZone onFileSelected={handleFileSelected} isUploading={isUploading} />
        {uploadError && (
          <p className="mt-2 text-xs text-[var(--loss)]">{uploadError}</p>
        )}
      </div>

      {/* Active Import Progress */}
      {status && (
        <div>
          <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">
            Current Import
          </h2>
          <ImportProgress status={status} isPolling={isPolling} />
        </div>
      )}

      {/* Import History */}
      <div>
        <ImportHistory refreshTrigger={refreshKey} />
      </div>
    </div>
  )
}
