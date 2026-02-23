import { useState } from 'react'
import { useStockPrices } from '@/hooks/useStockPrices'
import { SymbolFilter } from '@/components/data/SymbolFilter'
import { StockDataTable } from '@/components/data/StockDataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

// Convert various date formats to ISO YYYY-MM-DD
function normalizeDate(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined
  
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
  
  // DD.MM.YYYY format
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('.')
    return `${year}-${month}-${day}`
  }
  
  // DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/')
    return `${year}-${month}-${day}`
  }
  
  return dateStr
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [yearString, monthString, dayString] = value.split('-')
  const year = Number(yearString)
  const month = Number(monthString)
  const day = Number(dayString)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false
  }

  const parsedDate = new Date(`${value}T00:00:00Z`)
  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() + 1 === month &&
    parsedDate.getUTCDate() === day
  )
}

export function DataExplorerPage() {
  const {
    data,
    total,
    isLoading,
    error,
    page,
    pageSize,
    setPage,
    setFilters,
    filters,
  } = useStockPrices(100)

  const [dateFromInput, setDateFromInput] = useState(filters.date_from ?? '')
  const [dateToInput, setDateToInput] = useState(filters.date_to ?? '')
  const [dateFromError, setDateFromError] = useState<string | null>(null)
  const [dateToError, setDateToError] = useState<string | null>(null)

  const applyDateFilter = (key: 'date_from' | 'date_to', rawValue: string) => {
    setPage(0)

    if (!rawValue.trim()) {
      if (key === 'date_from') {
        setDateFromError(null)
      } else {
        setDateToError(null)
      }
      setFilters({ ...filters, [key]: undefined })
      return
    }

    const normalized = normalizeDate(rawValue)
    if (!normalized || !isValidIsoDate(normalized)) {
      if (key === 'date_from') {
        setDateFromError('Invalid date. Use YYYY-MM-DD, DD.MM.YYYY, or DD/MM/YYYY.')
      } else {
        setDateToError('Invalid date. Use YYYY-MM-DD, DD.MM.YYYY, or DD/MM/YYYY.')
      }
      return
    }

    if (key === 'date_from') {
      setDateFromError(null)
      setDateFromInput(normalized)
    } else {
      setDateToError(null)
      setDateToInput(normalized)
    }

    setFilters({ ...filters, [key]: normalized })
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-end gap-3">
        <div className="w-72">
          <label className="mb-1.5 block text-xs text-[var(--foreground-muted)]">
            Symbol
          </label>
          <SymbolFilter
            value={filters.symbol}
            onChange={(symbol) => {
              setFilters({ ...filters, symbol })
              setPage(0)
            }}
          />
        </div>
        <div className="w-40">
          <label className="mb-1.5 block text-xs text-[var(--foreground-muted)]">
            Date From
          </label>
          <Input
            type="text"
            placeholder="YYYY-MM-DD"
            value={dateFromInput}
            onChange={(e) => setDateFromInput(e.target.value)}
            onBlur={(e) => applyDateFilter('date_from', e.target.value)}
            className="font-mono-data text-xs"
          />
          {dateFromError && (
            <p className="mt-1 text-[10px] text-[var(--loss)]">{dateFromError}</p>
          )}
        </div>
        <div className="w-40">
          <label className="mb-1.5 block text-xs text-[var(--foreground-muted)]">
            Date To
          </label>
          <Input
            type="text"
            placeholder="YYYY-MM-DD"
            value={dateToInput}
            onChange={(e) => setDateToInput(e.target.value)}
            onBlur={(e) => applyDateFilter('date_to', e.target.value)}
            className="font-mono-data text-xs"
          />
          {dateToError && (
            <p className="mt-1 text-[10px] text-[var(--loss)]">{dateToError}</p>
          )}
        </div>
        <div className="ml-auto text-xs text-[var(--foreground-muted)] font-mono-data">
          {total.toLocaleString()} records
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-[var(--radius)] bg-[var(--loss-muted)] p-3 text-xs text-[var(--loss)]">
          {error}
        </div>
      )}

      {/* Table */}
      {isLoading && data.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-xs text-[var(--foreground-muted)]">
          <Loader2 size={16} className="mr-2 animate-spin" />
          Loading stock data…
        </div>
      ) : (
        <StockDataTable data={data} isLoading={isLoading} />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--foreground-muted)] font-mono-data">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              <ChevronLeft size={14} />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
            >
              Next
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
