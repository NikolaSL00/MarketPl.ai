import { useState, useCallback } from 'react'
import { api } from '@/services/api'

interface UseFileUploadReturn {
  upload: (file: File) => Promise<void>
  isUploading: boolean
  importId: string | null
  error: string | null
  reset: () => void
}

export function useFileUpload(): UseFileUploadReturn {
  const [isUploading, setIsUploading] = useState(false)
  const [importId, setImportId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(async (file: File) => {
    setIsUploading(true)
    setError(null)
    setImportId(null)

    try {
      const result = await api.uploadFile(file)
      setImportId(result.import_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setIsUploading(false)
    setImportId(null)
    setError(null)
  }, [])

  return { upload, isUploading, importId, error, reset }
}
