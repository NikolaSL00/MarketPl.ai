import type { BacktestResponse, PerformanceMetrics } from '@/types/backtest'
import { STRATEGY_OPTIONS, STRATEGY_COLORS } from '@/types/backtest'
import { cn } from '@/lib/utils'
import { MetricTooltip } from '@/components/ui/GlossaryTooltip'

interface MetricsCompareTableProps {
  results: BacktestResponse[]
}

interface MetricRow {
  key: keyof PerformanceMetrics
  label: string
  format: (v: number | null) => string
  higherIsBetter: boolean
}

const METRIC_ROWS: MetricRow[] = [
  {
    key: 'total_return',
    label: 'Total Return',
    format: (v) => v === null ? '—' : `${(v * 100).toFixed(2)}%`,
    higherIsBetter: true,
  },
  {
    key: 'cagr',
    label: 'CAGR',
    format: (v) => v === null ? '—' : `${(v * 100).toFixed(2)}%`,
    higherIsBetter: true,
  },
  {
    key: 'sharpe_ratio',
    label: 'Sharpe Ratio',
    format: (v) => v === null ? '—' : v.toFixed(3),
    higherIsBetter: true,
  },
  {
    key: 'calmar_ratio',
    label: 'Calmar Ratio',
    format: (v) => v === null ? '—' : v.toFixed(3),
    higherIsBetter: true,
  },
  {
    key: 'max_drawdown',
    label: 'Max Drawdown',
    format: (v) => v === null ? '—' : `${(v * 100).toFixed(2)}%`,
    higherIsBetter: false,
  },
  {
    key: 'volatility',
    label: 'Volatility',
    format: (v) => v === null ? '—' : `${(v * 100).toFixed(2)}%`,
    higherIsBetter: false,
  },
  {
    key: 'best_year',
    label: 'Best Year',
    format: (v) => v === null ? '—' : `${(v * 100).toFixed(2)}%`,
    higherIsBetter: true,
  },
  {
    key: 'worst_year',
    label: 'Worst Year',
    format: (v) => v === null ? '—' : `${(v * 100).toFixed(2)}%`,
    higherIsBetter: false,
  },
  {
    key: 'recovery_days',
    label: 'Recovery Days',
    format: (v) => v === null ? 'Ongoing' : `${v}d`,
    higherIsBetter: false,
  },
  {
    key: 'time_in_market',
    label: 'Time in Market',
    format: (v) => v === null ? '—' : `${(v * 100).toFixed(1)}%`,
    higherIsBetter: true,
  },
]

function strategyLabel(strategy: string): string {
  return STRATEGY_OPTIONS.find((s) => s.type === strategy)?.label ?? strategy
}

export function MetricsCompareTable({ results }: MetricsCompareTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="pb-2 pr-4 text-left font-semibold uppercase tracking-wider text-[var(--foreground-muted)] w-36">
              Metric
            </th>
            {results.map((r) => {
              const color = STRATEGY_COLORS[r.strategy as keyof typeof STRATEGY_COLORS] ?? '#888'
              return (
                <th key={r.strategy} className="pb-2 px-3 text-right font-semibold">
                  <span style={{ color }}>{strategyLabel(r.strategy)}</span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {/* Response-level rows: Final Value and Total Invested */}
          {[{
            label: 'Final Value',
            key: 'final_value' as const,
            get: (r: BacktestResponse) => r.final_value,
            format: (v: number) => '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 }),
            higherIsBetter: true,
          }, {
            label: 'Total Invested',
            key: 'total_invested' as const,
            get: (r: BacktestResponse) => r.total_invested,
            format: (v: number) => '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 }),
            higherIsBetter: false,
          }].map((row, rowIdx) => {
            const values = results.map((r) => row.get(r))
            const best = row.higherIsBetter ? Math.max(...values) : Math.min(...values)
            const worst = row.higherIsBetter ? Math.min(...values) : Math.max(...values)
            return (
              <tr
                key={row.key}
                className={cn(
                  'border-b border-[var(--border)]/50',
                  rowIdx % 2 === 0 ? 'bg-[var(--surface)]/30' : ''
                )}
              >
                <td className="py-2 pr-4 text-left text-[var(--foreground-muted)]">
                  <span className="inline-flex items-center gap-1">
                    {row.label}
                    <MetricTooltip metricKey={row.key} />
                  </span>
                </td>
                {results.map((r) => {
                  const val = row.get(r)
                  const isBest = val === best && values.length > 1
                  const isWorst = val === worst && values.length > 1 && worst !== best
                  return (
                    <td
                      key={r.strategy}
                      className={cn(
                        'py-2 px-3 text-right font-mono-data tabular-nums',
                        isBest && 'font-semibold',
                        isWorst && 'opacity-60'
                      )}
                      style={isBest ? { color: STRATEGY_COLORS[r.strategy as keyof typeof STRATEGY_COLORS] ?? '#888' } : undefined}
                    >
                      {row.format(val)}
                      {isBest && values.length > 1 && (
                        <span className="ml-1 text-[9px] opacity-60">▲</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}

          {/* Separator row */}
          <tr><td colSpan={results.length + 1} className="py-1"><div className="border-t border-[var(--border)]"/></td></tr>

          {METRIC_ROWS.map((row, rowIdx) => {
            // Collect numeric values for comparison
            const values: (number | null)[] = results.map((r) => {
              const v = r.metrics[row.key]
              return typeof v === 'number' ? v : null
            })
            const numericValues = values.filter((v): v is number => v !== null)
            const best = numericValues.length > 0
              ? (row.higherIsBetter ? Math.max(...numericValues) : Math.min(...numericValues))
              : null
            const worst = numericValues.length > 0
              ? (row.higherIsBetter ? Math.min(...numericValues) : Math.max(...numericValues))
              : null

            return (
              <tr
                key={row.key}
                className={cn(
                  'border-b border-[var(--border)]/50',
                  rowIdx % 2 === 0 ? 'bg-[var(--surface)]/30' : ''
                )}
              >
                <td className="py-2 pr-4 text-left text-[var(--foreground-muted)]">
                  <span className="inline-flex items-center gap-1">
                    {row.label}
                    <MetricTooltip metricKey={row.key} />
                  </span>
                </td>
                {results.map((r, colIdx) => {
                  const val = r.metrics[row.key]
                  const num = typeof val === 'number' ? val : null
                  const isBest = num !== null && best !== null && num === best && numericValues.length > 1
                  const isWorst = num !== null && worst !== null && num === worst && numericValues.length > 1 && worst !== best
                  return (
                    <td
                      key={r.strategy}
                      className={cn(
                        'py-2 px-3 text-right font-mono-data tabular-nums',
                        isBest && 'font-semibold',
                        isWorst && 'opacity-60'
                      )}
                      style={isBest ? { color: STRATEGY_COLORS[r.strategy as keyof typeof STRATEGY_COLORS] ?? '#888' } : undefined}
                    >
                      {row.format(num)}
                      {isBest && numericValues.length > 1 && (
                        <span className="ml-1 text-[9px] opacity-60">▲</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
