import type { ImportStatusResponse, ImportListResponse } from '@/types/import'
import type { StockPricePageResponse, SymbolListResponse } from '@/types/stock-price'
import type { BacktestRequest, BacktestResponse, CompareRequest, CompareResponse, SymbolDateRange } from '@/types/backtest'

const API_BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  return response.json()
}

export const api = {
  // Imports
  uploadFile: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${API_BASE}/imports/upload`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }))
      throw new Error(error.detail || 'Upload failed')
    }
    return response.json() as Promise<{ import_id: string; status: string }>
  },

  getImportStatus: (importId: string) =>
    request<ImportStatusResponse>(`/imports/${importId}/status`),

  listImports: (skip = 0, limit = 20) =>
    request<ImportListResponse>(`/imports?skip=${skip}&limit=${limit}`),

  deleteImport: (importId: string) =>
    request<{ deleted: boolean }>(`/imports/${importId}`, { method: 'DELETE' }),

  // Stock Prices
  getStockPrices: (params: {
    symbol?: string
    date_from?: string
    date_to?: string
    skip?: number
    limit?: number
  }) => {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value))
    })
    return request<StockPricePageResponse>(`/stock-prices?${searchParams}`)
  },

  getSymbols: () => request<SymbolListResponse>('/stock-prices/symbols'),

  // Backtest
  getSymbolDateRange: (symbol: string) =>
    request<SymbolDateRange>(`/backtest/symbols/${encodeURIComponent(symbol)}/date-range`),

  runBacktest: (payload: BacktestRequest) =>
    request<BacktestResponse>('/backtest', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  compareBacktest: (payload: CompareRequest) =>
    request<CompareResponse>('/backtest/compare', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}
