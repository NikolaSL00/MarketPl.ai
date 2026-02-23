import { useCallback, useState } from 'react'
import { Upload, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileDropZoneProps {
  onFileSelected: (file: File) => void
  isUploading: boolean
}

export function FileDropZone({ onFileSelected, isUploading }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file && file.name.toLowerCase().endsWith('.csv')) {
        onFileSelected(file)
      }
    },
    [onFileSelected]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        onFileSelected(file)
      }
      // Reset input so the same file can be selected again
      e.target.value = ''
    },
    [onFileSelected]
  )

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-[var(--radius)] border-2 border-dashed p-8 transition-colors",
        isDragging
          ? "border-[var(--accent)] bg-[var(--accent-muted)]"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-hover)]",
        isUploading && "pointer-events-none opacity-60"
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full",
          isDragging ? "bg-[var(--accent-muted)]" : "bg-[var(--surface-active)]"
        )}
      >
        {isDragging ? (
          <FileText size={24} className="text-[var(--accent)]" />
        ) : (
          <Upload size={24} className="text-[var(--foreground-muted)]" />
        )}
      </div>

      <div className="text-center">
        <p className="text-sm text-[var(--foreground)]">
          {isDragging ? 'Drop your CSV file here' : 'Drag & drop a CSV file here'}
        </p>
        <p className="mt-1 text-xs text-[var(--foreground-muted)]">
          or click to browse — no file size limit
        </p>
      </div>

      <label className="mt-2 cursor-pointer rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--background)] transition-colors hover:bg-[var(--accent)]/90">
        Select File
        <input
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          className="hidden"
          disabled={isUploading}
        />
      </label>
    </div>
  )
}
