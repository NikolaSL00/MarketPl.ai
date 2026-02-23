export interface ImportRecord {
  id: string
  filename: string
  uploaded_at: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  total_rows: number
  processed_rows: number
  symbols_count: number
  error?: string
}

export interface ImportListResponse {
  data: ImportRecord[]
  total: number
}

export type ImportStatusResponse = ImportRecord
