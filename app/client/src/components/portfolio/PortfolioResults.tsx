import { useEffect, useRef } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { createChart, LineSeries, ColorType, LineStyle } from 'lightweight-charts'
import { MetricsGrid } from '@/components/backtest/MetricsGrid'
import { PortfolioHoldingBreakdownTable } from './PortfolioHoldingBreakdownTable'
import { PORTFOLIO_HOLDING_COLORS } from '@/types/backtest'
import type { PortfolioBacktestResponse } from '@/types/backtest'

interface PortfolioResultsProps {
  result: PortfolioBacktestResponse
}

function PortfolioMultiChart({ result }: { result: PortfolioBacktestResponse }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 300,
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#8b9ab1',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1e2530', style: LineStyle.Dotted },
        horzLines: { color: '#1e2530', style: LineStyle.Dotted },
      },
      rightPriceScale: { borderColor: '#1e2530' },
      timeScale: { borderColor: '#1e2530', timeVisible: true },
    })

    // Portfolio total — thick white/accent line
    const portfolioSeries = chart.addSeries(LineSeries, {
      color: '#e2e8f0',
      lineWidth: 2,
      title: 'Portfolio',
    })
    portfolioSeries.setData(
      result.portfolio_equity_curve.map((p) => ({ time: p.date as `${number}-${number}-${number}`, value: p.value }))
    )

    // Per-holding lines — thin, colored
    result.holdings.forEach((h, i) => {
      const series = chart.addSeries(LineSeries, {
        color: PORTFOLIO_HOLDING_COLORS[i % PORTFOLIO_HOLDING_COLORS.length],
        lineWidth: 1,
        title: h.symbol,
      })
      series.setData(
        h.equity_curve.map((p) => ({ time: p.date as `${number}-${number}-${number}`, value: p.value }))
      )
    })

    chart.timeScale().fitContent()

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [result])

  return <div ref={containerRef} className="w-full" />
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function PortfolioResults({ result }: PortfolioResultsProps) {
  const totalReturn = result.portfolio_metrics.total_return
  const isGain = totalReturn >= 0
  const returnStr = `${isGain ? '+' : ''}${(totalReturn * 100).toFixed(2)}%`

  const strategyLabel = result.strategy
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="space-y-6">
      {/* 1. Header summary */}
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
        {/* Strategy + date range + rebalance badge */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--accent)] bg-[var(--accent-muted)] px-2 py-0.5 rounded-[var(--radius)]">
            {strategyLabel}
          </span>
          <span className="text-xs text-[var(--foreground-muted)] font-mono-data tabular-nums">
            {result.date_from} → {result.date_to}
          </span>
          {result.rebalance && result.rebalance_interval && (
            <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-[var(--radius)] capitalize">
              Rebalanced {result.rebalance_interval}
            </span>
          )}
        </div>

        {/* Key numbers */}
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-muted)]">
              Capital Deployed
            </p>
            <p className="font-mono-data tabular-nums text-sm font-semibold text-[var(--foreground)]">
              {fmt(result.portfolio_total_invested)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-muted)]">
              Final Value
            </p>
            <p
              className="font-mono-data tabular-nums text-sm font-semibold"
              style={{ color: isGain ? 'var(--gain)' : 'var(--loss)' }}
            >
              {fmt(result.portfolio_final_value)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-muted)]">
              Total Return
            </p>
            <div
              className="flex items-center gap-1 font-mono-data tabular-nums text-sm font-semibold"
              style={{ color: isGain ? 'var(--gain)' : 'var(--loss)' }}
            >
              {isGain ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {returnStr}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Equity curve chart */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
          Equity Curve
        </p>
        <div className="rounded-[var(--radius)] overflow-hidden border border-[var(--border)]">
          <PortfolioMultiChart result={result} />
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 rounded-full inline-block bg-[#e2e8f0]" />
            <span className="text-xs text-[var(--foreground-muted)]">Portfolio</span>
          </div>
          {result.holdings.map((h, i) => (
            <div key={h.symbol} className="flex items-center gap-1.5">
              <span
                className="w-4 h-0.5 rounded-full inline-block"
                style={{ backgroundColor: PORTFOLIO_HOLDING_COLORS[i % PORTFOLIO_HOLDING_COLORS.length] }}
              />
              <span className="text-xs text-[var(--foreground-muted)]">{h.symbol}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Portfolio metrics */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
          Portfolio Metrics
        </p>
        <MetricsGrid
          metrics={result.portfolio_metrics}
          finalValue={result.portfolio_final_value}
          totalInvested={result.portfolio_total_invested}
        />
      </div>

      {/* 4. Holdings breakdown */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
          Holdings Breakdown
        </p>
        <PortfolioHoldingBreakdownTable
          holdings={result.holdings}
          initialCapital={result.initial_capital}
        />
      </div>
    </div>
  )
}
