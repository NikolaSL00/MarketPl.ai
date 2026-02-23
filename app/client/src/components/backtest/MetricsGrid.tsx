import { cn } from '@/lib/utils'
import type { PerformanceMetrics } from '@/types/backtest'

interface MetricsGridProps {
  metrics: PerformanceMetrics
}

interface MetricCardProps {
  label: string
  value: string
  subtext?: string
  tone?: 'positive' | 'negative' | 'neutral' | 'warn'
}

function MetricCard({ label, value, subtext, tone = 'neutral' }: MetricCardProps) {
  const valueColor = {
    positive: 'text-emerald-400',
    negative: 'text-red-400',
    neutral: 'text-[var(--foreground)]',
    warn: 'text-amber-400',
  }[tone]

  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--foreground-muted)]">
        {label}
      </span>
      <span className={cn('font-mono text-xl font-bold tabular-nums', valueColor)}>
        {value}
      </span>
      {subtext && (
        <span className="text-[10px] text-[var(--foreground-muted)]">{subtext}</span>
      )}
    </div>
  )
}

function fmtPct(v: number, alwaysSign = false): string {
  const pct = (v * 100).toFixed(2)
  return alwaysSign && v > 0 ? `+${pct}%` : `${pct}%`
}

function fmtNum(v: number | null, decimals = 2, fallback = 'N/A'): string {
  if (v === null || v === undefined) return fallback
  return v.toFixed(decimals)
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  const returnTone = metrics.total_return >= 0 ? 'positive' : 'negative'
  const cagrTone = metrics.cagr >= 0 ? 'positive' : 'negative'
  const sharpeTone = metrics.sharpe_ratio >= 1 ? 'positive' : metrics.sharpe_ratio >= 0 ? 'neutral' : 'negative'
  const drawdownTone = metrics.max_drawdown > -0.1 ? 'neutral' : metrics.max_drawdown > -0.25 ? 'warn' : 'negative'

  return (
    <div className="space-y-2">
      {/* Primary metrics */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard
          label="Total Return"
          value={fmtPct(metrics.total_return, true)}
          tone={returnTone}
        />
        <MetricCard
          label="CAGR"
          value={fmtPct(metrics.cagr, true)}
          tone={cagrTone}
        />
        <MetricCard
          label="Sharpe Ratio"
          value={fmtNum(metrics.sharpe_ratio)}
          subtext="rf = 0"
          tone={sharpeTone}
        />
        <MetricCard
          label="Max Drawdown"
          value={fmtPct(metrics.max_drawdown)}
          tone={drawdownTone}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard
          label="Volatility"
          value={fmtPct(metrics.volatility)}
          subtext="annualised"
          tone="neutral"
        />
        <MetricCard
          label="Win Rate"
          value={metrics.win_rate !== null ? fmtPct(metrics.win_rate) : 'N/A'}
          subtext={metrics.win_rate !== null ? 'closed trades' : 'single trade'}
          tone={
            metrics.win_rate === null
              ? 'neutral'
              : metrics.win_rate >= 0.5
              ? 'positive'
              : 'negative'
          }
        />
        <MetricCard
          label="Profit Factor"
          value={fmtNum(metrics.profit_factor)}
          subtext="gross profit / loss"
          tone={
            metrics.profit_factor === null
              ? 'neutral'
              : metrics.profit_factor >= 1.5
              ? 'positive'
              : metrics.profit_factor >= 1
              ? 'warn'
              : 'negative'
          }
        />
        <MetricCard
          label="Time in Market"
          value={fmtPct(metrics.time_in_market)}
          tone="neutral"
        />
      </div>
    </div>
  )
}
