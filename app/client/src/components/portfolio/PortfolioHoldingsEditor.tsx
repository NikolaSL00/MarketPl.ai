import { Loader2, Plus, LayoutGrid, X } from 'lucide-react'
import { SymbolFilter } from '@/components/data/SymbolFilter'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { PortfolioHolding } from '@/types/backtest'

interface PortfolioHoldingsEditorProps {
  holdings: PortfolioHolding[]
  onAddHolding: () => void
  onRemoveHolding: (index: number) => void
  onSymbolChange: (index: number, symbol: string) => void
  onWeightChange: (index: number, weight: number) => void
  onDistributeEvenly: () => void
  weightSum: number
  dateRangeLoading: boolean
  intersectionRange: { min: string; max: string } | null
}

export function PortfolioHoldingsEditor({
  holdings,
  onAddHolding,
  onRemoveHolding,
  onSymbolChange,
  onWeightChange,
  onDistributeEvenly,
  weightSum,
  dateRangeLoading,
  intersectionRange,
}: PortfolioHoldingsEditorProps) {
  const weightPct = Math.round(weightSum * 100)
  const isWeightOk = Math.abs(weightSum - 1.0) <= 0.01
  const allFilled = holdings.every((h) => h.symbol.trim() !== '')

  return (
    <div className="space-y-3">
      {/* Holding rows */}
      <div className="space-y-2">
        {holdings.map((holding, i) => (
          <div key={i} className="flex items-center gap-2">
            {/* Symbol selector */}
            <div className="flex-1 min-w-0">
              <SymbolFilter
                value={holding.symbol || undefined}
                onChange={(s) => onSymbolChange(i, s ?? '')}
              />
            </div>

            {/* Weight input */}
            <div className="flex items-center gap-1 shrink-0">
              <Input
                type="number"
                min={1}
                max={99}
                step={1}
                value={Math.round(holding.weight * 100)}
                onChange={(e) => onWeightChange(i, Number(e.target.value) / 100)}
                className="w-16 text-center font-mono-data tabular-nums"
              />
              <span className="text-xs text-[var(--foreground-muted)]">%</span>
            </div>

            {/* Remove */}
            <button
              type="button"
              onClick={() => onRemoveHolding(i)}
              disabled={holdings.length <= 2}
              className="shrink-0 flex items-center justify-center w-7 h-7 rounded-[var(--radius)] text-[var(--foreground-muted)] hover:text-[var(--loss)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              aria-label="Remove holding"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Weight sum bar */}
      <div className="space-y-1">
        <div className="h-1.5 w-full rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(weightPct, 100)}%`,
              backgroundColor: isWeightOk ? 'var(--gain)' : '#f59e0b',
            }}
          />
        </div>
        <p
          className="text-xs font-mono-data tabular-nums"
          style={{ color: isWeightOk ? 'var(--gain)' : 'var(--loss)' }}
        >
          Total: {weightPct}%
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddHolding}
          disabled={holdings.length >= 5}
          className="flex items-center gap-1.5"
        >
          <Plus size={13} />
          Add Symbol
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDistributeEvenly}
          className="flex items-center gap-1.5"
        >
          <LayoutGrid size={13} />
          Distribute Evenly
        </Button>
      </div>

      {/* Date range status */}
      {dateRangeLoading && (
        <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
          <Loader2 size={12} className="animate-spin" />
          Computing overlap…
        </div>
      )}

      {!dateRangeLoading && intersectionRange && (
        <p className="text-xs text-[var(--foreground-muted)]">
          Overlap:{' '}
          <span className="font-mono-data tabular-nums text-[var(--foreground)]">
            {intersectionRange.min}
          </span>{' '}
          →{' '}
          <span className="font-mono-data tabular-nums text-[var(--foreground)]">
            {intersectionRange.max}
          </span>
        </p>
      )}

      {!dateRangeLoading && !intersectionRange && allFilled && (
        <p className="text-xs text-amber-400">
          No overlapping date range found. Try different symbols.
        </p>
      )}
    </div>
  )
}
