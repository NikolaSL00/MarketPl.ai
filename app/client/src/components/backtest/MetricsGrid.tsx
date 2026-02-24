import { cn } from '@/lib/utils'
import type { PerformanceMetrics } from '@/types/backtest'
import { MetricTooltip } from '@/components/ui/GlossaryTooltip'

interface MetricsGridProps {
  metrics: PerformanceMetrics
  finalValue: number
  totalInvested: number
}

interface MetricCardProps {
  label: string
  value: string
  subtext?: string
  tone?: 'positive' | 'negative' | 'neutral' | 'warn'
  metricKey?: string
}

function MetricCard({ label, value, subtext, tone = 'neutral', metricKey }: MetricCardProps) {
  const valueColor = {
    positive: 'text-emerald-400',
    negative: 'text-red-400',
    neutral: 'text-[var(--foreground)]',
    warn: 'text-amber-400',
  }[tone]

  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--foreground-muted)]">
          {label}
        </span>
        {metricKey && <MetricTooltip metricKey={metricKey} />}
      </div>
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

function fmtUSD(v: number): string {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtNum(v: number | null, decimals = 2, fallback = 'N/A'): string {
  if (v === null || v === undefined) return fallback
  return v.toFixed(decimals)
}

export function MetricsGrid({ metrics, finalValue, totalInvested }: MetricsGridProps) {
  const returnTone = metrics.total_return >= 0 ? 'positive' : 'negative'
  const cagrTone = metrics.cagr >= 0 ? 'positive' : 'negative'
  const sharpeTone = metrics.sharpe_ratio >= 1 ? 'positive' : metrics.sharpe_ratio >= 0 ? 'neutral' : 'negative'
  const drawdownTone = metrics.max_drawdown > -0.1 ? 'neutral' : metrics.max_drawdown > -0.25 ? 'warn' : 'negative'

  const pnl = finalValue - totalInvested
  const pnlTone: 'positive' | 'negative' = pnl >= 0 ? 'positive' : 'negative'

  return (
    <div className="space-y-2">
      {/* Portfolio value summary */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Final Portfolio Value"
          value={fmtUSD(finalValue)}
          subtext={`P&L: ${pnl >= 0 ? '+' : ''}${fmtUSD(pnl)}`}
          tone={pnlTone}
          metricKey="final_value"
        />
        <MetricCard
          label="Capital Invested"
          value={fmtUSD(totalInvested)}
          subtext="total deployed"
          tone="neutral"
          metricKey="total_invested"
        />
      </div>

      {/* Primary metrics */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard
          label="Total Return"
          value={fmtPct(metrics.total_return, true)}
          tone={returnTone}
          metricKey="total_return"
        />
        <MetricCard
          label="CAGR"
          value={fmtPct(metrics.cagr, true)}
          tone={cagrTone}
          metricKey="cagr"
        />
        <MetricCard
          label="Sharpe Ratio"
          value={fmtNum(metrics.sharpe_ratio)}
          subtext="rf = 0"
          tone={sharpeTone}
          metricKey="sharpe_ratio"
        />
        <MetricCard
          label="Max Drawdown"
          value={fmtPct(metrics.max_drawdown)}
          tone={drawdownTone}
          metricKey="max_drawdown"
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard
          label="Volatility"
          value={fmtPct(metrics.volatility)}
          subtext="annualised"
          tone="neutral"
          metricKey="volatility"
        />
        <MetricCard
          label="Calmar Ratio"
          value={fmtNum(metrics.calmar_ratio)}
          subtext="CAGR / |drawdown|"
          tone={metrics.calmar_ratio >= 0.5 ? 'positive' : metrics.calmar_ratio >= 0.2 ? 'warn' : 'negative'}
          metricKey="calmar_ratio"
        />
        <MetricCard
          label="Time in Market"
          value={fmtPct(metrics.time_in_market)}
          tone="neutral"
          metricKey="time_in_market"
        />
        <MetricCard
          label="Recovery"
          value={metrics.recovery_days !== null ? `${metrics.recovery_days}d` : 'Ongoing'}
          subtext="days from trough"
          tone={metrics.recovery_days === null ? 'warn' : metrics.recovery_days < 365 ? 'positive' : 'neutral'}
          metricKey="recovery_days"
        />
      </div>

      {/* Tertiary metrics */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard
          label="Best Year"
          value={metrics.best_year !== null ? fmtPct(metrics.best_year, true) : 'N/A'}
          tone={metrics.best_year !== null && metrics.best_year >= 0 ? 'positive' : 'neutral'}
          metricKey="best_year"
        />
        <MetricCard
          label="Worst Year"
          value={metrics.worst_year !== null ? fmtPct(metrics.worst_year, true) : 'N/A'}
          tone={metrics.worst_year !== null ? (metrics.worst_year >= 0 ? 'positive' : 'negative') : 'neutral'}
          metricKey="worst_year"
        />
        <MetricCard
          label="Win Rate"
          value={metrics.win_rate !== null ? fmtPct(metrics.win_rate) : 'N/A'}
          subtext={metrics.win_rate !== null ? 'closed trades' : 'single trade'}
          tone={metrics.win_rate === null ? 'neutral' : metrics.win_rate >= 0.5 ? 'positive' : 'negative'}
          metricKey="win_rate"
        />
        <MetricCard
          label="Profit Factor"
          value={fmtNum(metrics.profit_factor)}
          subtext="gross profit / loss"
          tone={
            metrics.profit_factor === null ? 'neutral'
              : metrics.profit_factor >= 1.5 ? 'positive'
              : metrics.profit_factor >= 1 ? 'warn'
              : 'negative'
          }
          metricKey="profit_factor"
        />
      </div>
    </div>
  )
}
