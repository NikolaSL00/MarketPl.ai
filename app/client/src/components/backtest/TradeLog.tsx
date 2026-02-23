import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TradeRecord } from '@/types/backtest'

interface TradeLogProps {
  trades: TradeRecord[]
}

const ROW_HEIGHT = 36
const MAX_VISIBLE = 8

export function TradeLog({ trades }: TradeLogProps) {
  const [open, setOpen] = useState(false)
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: trades.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  })

  if (!trades.length) {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-xs text-[var(--foreground-muted)]">
        No trades recorded for this strategy.
      </div>
    )
  }

  const visibleHeight = Math.min(trades.length, MAX_VISIBLE) * ROW_HEIGHT

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-[var(--surface-hover)] transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown size={12} className="text-[var(--foreground-muted)]" />
          ) : (
            <ChevronRight size={12} className="text-[var(--foreground-muted)]" />
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]">
            Trade Log
          </span>
        </div>
        <span className="text-[10px] font-mono text-[var(--foreground-muted)]">
          {trades.length} trade{trades.length !== 1 ? 's' : ''}
        </span>
      </button>

      {open && (
        <>
          {/* Column headers */}
          <div className="grid grid-cols-[90px_52px_80px_80px_1fr] gap-x-2 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
            {['Date', 'Action', 'Price', 'Shares', 'Value'].map((h) => (
              <span
                key={h}
                className="text-[10px] font-semibold uppercase tracking-widest text-[var(--foreground-muted)]"
              >
                {h}
              </span>
            ))}
          </div>

          {/* Virtualised rows */}
          <div
            ref={parentRef}
            className="overflow-auto border-t border-[var(--border)]"
            style={{ height: visibleHeight }}
          >
            <div
              style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}
            >
              {rowVirtualizer.getVirtualItems().map((vRow) => {
                const t = trades[vRow.index]
                const isBuy = t.action === 'BUY'
                return (
                  <div
                    key={vRow.key}
                    data-index={vRow.index}
                    ref={rowVirtualizer.measureElement}
                    className={cn(
                      'absolute inset-x-0 grid grid-cols-[90px_52px_80px_80px_1fr] gap-x-2 px-3 items-center',
                      vRow.index % 2 === 0
                        ? 'bg-transparent'
                        : 'bg-[var(--surface-hover)]'
                    )}
                    style={{
                      top: vRow.start,
                      height: ROW_HEIGHT,
                    }}
                  >
                    <span className="font-mono text-[11px] text-[var(--foreground-muted)]">
                      {t.date}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold',
                        isBuy
                          ? 'bg-emerald-400/15 text-emerald-400'
                          : 'bg-red-400/15 text-red-400'
                      )}
                    >
                      {t.action}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-[var(--foreground)]">
                      ${t.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-[var(--foreground-muted)]">
                      {t.shares.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-[var(--foreground)]">
                      ${t.portfolio_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
