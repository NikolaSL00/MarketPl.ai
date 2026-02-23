import { useState, useEffect, useCallback } from 'react'
import { api } from '@/services/api'
import type { StockPrice } from '@/types/stock-price'

interface StockPriceFilters {
  symbol?: string
  date_from?: string
  date_to?: string
}

interface UseStockPricesReturn {
  data: StockPrice[]
  total: number
  isLoading: boolean
  error: string | null
  page: number
  pageSize: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setFilters: (filters: StockPriceFilters) => void
  filters: StockPriceFilters
  refetch: () => void
}

export function useStockPrices(initialPageSize = 100): UseStockPricesReturn {
  const [data, setData] = useState<StockPrice[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [filters, setFilters] = useState<StockPriceFilters>({})

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await api.getStockPrices({
        symbol: filters.symbol,
        date_from: filters.date_from,
        date_to: filters.date_to,
        skip: page * pageSize,
        limit: pageSize,
      })
      setData(result.data)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
      setData([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, filters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const updateFilters = useCallback((newFilters: StockPriceFilters) => {
    setFilters(newFilters)
    setPage(0) // Reset to first page on filter change
  }, [])

  return {
    data,
    total,
    isLoading,
    error,
    page,
    pageSize,
    setPage,
    setPageSize,
    setFilters: updateFilters,
    filters,
    refetch: fetchData,
  }
}
