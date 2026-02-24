import { PORTFOLIO_HOLDING_COLORS } from '@/types/backtest'
import type { PortfolioHoldingResult } from '@/types/backtest'

interface PortfolioHoldingBreakdownTableProps {
  holdings: PortfolioHoldingResult[]
  initialCapital: number
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function pct(n: number, sign = true) {
  const val = (n * 100).toFixed(2)
  return sign && n > 0 ? `+${val}%` : `${val}%`
}

function color(n: number) {
  if (n > 0) return 'var(--gain)'
  if (n < 0) return 'var(--loss)'
  return 'var(--foreground-muted)'
}

export function PortfolioHoldingBreakdownTable({
  holdings,
  initialCapital,
}: PortfolioHoldingBreakdownTableProps) {
  const best = holdings.reduce(
    (best, h, i) => (h.final_value > (holdings[best]?.final_value ?? -Infinity) ? i : best),
    0
  )

  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
            <th className="px-3 py-2 text-left font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
              Symbol
            </th>
            <th className="px-3 py-2 text-right font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
              Weight
            </th>
            <th className="px-3 py-2 text-right font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
              Allocated
            </th>
            <th className="px-3 py-2 text-right font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
              Final Value
            </th>
            <th className="px-3 py-2 text-right font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
              Return
            </th>
            <th className="px-3 py-2 text-right font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
              CAGR
            </th>
            <th className="px-3 py-2 text-right font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
              Max DD
            </th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, i) => {
            const holdingColor = PORTFOLIO_HOLDING_COLORS[i % PORTFOLIO_HOLDING_COLORS.length]
            const gain = h.final_value - h.allocated_capital
            const isBest = i === best

            return (
              <tr
                key={h.symbol}
                className="border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--surface-hover)]"
                style={isBest ? { backgroundColor: `${holdingColor}10` } : undefined}
              >
                {/* Symbol */}
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: holdingColor }}
                    />
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">{h.symbol}</p>
                      {h.security_name && (
                        <p className="text-[10px] text-[var(--foreground-muted)] leading-tight">
                          {h.security_name}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Weight */}
                <td className="px-3 py-2.5 text-right font-mono-data tabular-nums text-[var(--foreground)]">
                  {(h.weight * 100).toFixed(1)}%
                </td>

                {/* Allocated */}
                <td className="px-3 py-2.5 text-right font-mono-data tabular-nums text-[var(--foreground-muted)]">
                  {fmt(h.allocated_capital)}
                </td>

                {/* Final Value */}
                <td
                  className="px-3 py-2.5 text-right font-mono-data tabular-nums font-semibold"
                  style={{ color: color(gain) }}
                >
                  {fmt(h.final_value)}
                </td>

                {/* Return */}
                <td
                  className="px-3 py-2.5 text-right font-mono-data tabular-nums"
                  style={{ color: color(h.metrics.total_return) }}
                >
                  {pct(h.metrics.total_return)}
                </td>

                {/* CAGR */}
                <td
                  className="px-3 py-2.5 text-right font-mono-data tabular-nums"
                  style={{ color: color(h.metrics.cagr) }}
                >
                  {pct(h.metrics.cagr)}
                </td>

                {/* Max Drawdown */}
                <td
                  className="px-3 py-2.5 text-right font-mono-data tabular-nums"
                  style={{ color: 'var(--loss)' }}
                >
                  {pct(h.metrics.max_drawdown, false)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
