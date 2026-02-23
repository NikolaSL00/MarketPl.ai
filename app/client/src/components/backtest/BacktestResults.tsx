import { EquityCurveChart } from './EquityCurveChart'
import { MetricsGrid } from './MetricsGrid'
import { TradeLog } from './TradeLog'
import { Separator } from '@/components/ui/separator'
import { STRATEGY_OPTIONS } from '@/types/backtest'
import type { BacktestResponse } from '@/types/backtest'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface BacktestResultsProps {
  result: BacktestResponse
}

export function BacktestResults({ result }: BacktestResultsProps) {
  const strategyLabel =
    STRATEGY_OPTIONS.find((s) => s.type === result.strategy)?.label ?? result.strategy

  const isDCA = result.strategy === 'dca'
  const returnBase = isDCA ? result.total_invested : result.initial_capital
  const returnPct = ((result.final_value - returnBase) / returnBase) * 100
  const isPositive = returnPct >= 0

  return (
    <div className="flex flex-col gap-5 h-full overflow-auto">
      {/* Summary header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-[var(--foreground)]">
              {result.symbol}
            </span>
            <span className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
              {strategyLabel}
            </span>
          </div>
          {result.security_name && (
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">
              {result.security_name}
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-[var(--foreground-muted)] font-mono">
            {result.date_from} → {result.date_to}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--foreground-muted)] font-mono">
            {isDCA
              ? <>Total invested: <span className="text-[var(--foreground)]">${result.total_invested.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></>
              : <>Initial: <span className="text-[var(--foreground)]">${result.initial_capital.toLocaleString('en-US')}</span></>}
          </p>
        </div>

        {/* Final value highlight */}
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <div className="flex items-center gap-1.5">
            {isPositive ? (
              <TrendingUp size={14} className="text-emerald-400" />
            ) : (
              <TrendingDown size={14} className="text-red-400" />
            )}
            <span
              className={`font-mono text-xl font-bold tabular-nums ${
                isPositive ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              ${result.final_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <span
            className={`font-mono text-xs tabular-nums ${
              isPositive ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {isPositive ? '+' : ''}{returnPct.toFixed(2)}%
          </span>
        </div>
      </div>

      <Separator />

      {/* Equity Curve */}
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--foreground-muted)]">
          Portfolio Value Over Time
        </h3>
        <EquityCurveChart data={result.equity_curve} initialCapital={result.initial_capital} />
      </section>

      <Separator />

      {/* Performance Metrics */}
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--foreground-muted)]">
          Performance &amp; Risk Metrics
        </h3>
        <MetricsGrid metrics={result.metrics} />
      </section>

      <Separator />

      {/* Trade Log */}
      <section>
        <TradeLog trades={result.trades} />
      </section>
    </div>
  )
}
