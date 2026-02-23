import { useRef } from 'react'
import { Download, FileJson, FileText, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { CompareResponse } from '@/types/backtest'
import { STRATEGY_OPTIONS, STRATEGY_COLORS } from '@/types/backtest'
import {
  MultiEquityCurveChart,
  type MultiEquityCurveChartHandle,
} from '@/components/backtest/MultiEquityCurveChart'
import { MetricsCompareTable } from '@/components/backtest/MetricsCompareTable'
import { TradeLog } from '@/components/backtest/TradeLog'

interface CompareResultsProps {
  result: CompareResponse
}

function strategyLabel(strategy: string): string {
  return STRATEGY_OPTIONS.find((s) => s.type === strategy)?.label ?? strategy
}

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtPct(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${(n * 100).toFixed(2)}%`
}

// ── Export helpers ────────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportJSON(result: CompareResponse) {
  const filename = `compare_${result.symbol}_${result.date_from}_${result.date_to}.json`
  downloadBlob(JSON.stringify(result, null, 2), filename, 'application/json')
}

function exportCSV(result: CompareResponse) {
  const strategies = result.results.map((r) => r.strategy)
  const lines: string[] = []

  // -- Metadata block --
  lines.push('# COMPARISON METADATA')
  lines.push(`Symbol,${result.symbol}`)
  lines.push(`Security Name,${result.security_name ?? ''}`)
  lines.push(`Date From,${result.date_from}`)
  lines.push(`Date To,${result.date_to}`)
  lines.push(`Initial Capital,${result.initial_capital}`)
  lines.push('')

  // -- Summary block --
  lines.push('# SUMMARY')
  lines.push(['Metric', ...strategies.map(strategyLabel)].join(','))
  lines.push(['Final Value', ...result.results.map((r) => r.final_value)].join(','))
  lines.push(['Total Invested', ...result.results.map((r) => r.total_invested)].join(','))
  lines.push(['Total Return', ...result.results.map((r) => (r.metrics.total_return * 100).toFixed(4) + '%')].join(','))
  lines.push(['CAGR', ...result.results.map((r) => (r.metrics.cagr * 100).toFixed(4) + '%')].join(','))
  lines.push(['Sharpe Ratio', ...result.results.map((r) => r.metrics.sharpe_ratio.toFixed(6))].join(','))
  lines.push(['Max Drawdown', ...result.results.map((r) => (r.metrics.max_drawdown * 100).toFixed(4) + '%')].join(','))
  lines.push(['Volatility', ...result.results.map((r) => (r.metrics.volatility * 100).toFixed(4) + '%')].join(','))
  lines.push(['Win Rate', ...result.results.map((r) => r.metrics.win_rate !== null ? (r.metrics.win_rate * 100).toFixed(2) + '%' : '')].join(','))
  lines.push(['Profit Factor', ...result.results.map((r) => r.metrics.profit_factor?.toFixed(4) ?? '')].join(','))
  lines.push(['Time in Market', ...result.results.map((r) => (r.metrics.time_in_market * 100).toFixed(2) + '%')].join(','))
  lines.push('')

  // -- Equity curve block --
  lines.push('# EQUITY CURVE')
  lines.push(['Date', ...strategies.map(strategyLabel)].join(','))
  // Align all curves by date (use first result's dates as index)
  const dateMap = new Map<string, Map<string, number>>()
  result.results.forEach((r) => {
    r.equity_curve.forEach((pt) => {
      if (!dateMap.has(pt.date)) dateMap.set(pt.date, new Map())
      dateMap.get(pt.date)!.set(r.strategy, pt.value)
    })
  })
  Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, vals]) => {
    lines.push([date, ...strategies.map((s) => vals.get(s)?.toFixed(2) ?? '')].join(','))
  })
  lines.push('')

  // -- Trades per strategy --
  result.results.forEach((r) => {
    lines.push(`# TRADES — ${strategyLabel(r.strategy)}`)
    lines.push('Date,Action,Price,Shares,Cash After,Portfolio Value')
    r.trades.forEach((t) => {
      lines.push([t.date, t.action, t.price.toFixed(4), t.shares.toFixed(6), t.cash_after.toFixed(2), t.portfolio_value.toFixed(2)].join(','))
    })
    lines.push('')
  })

  const filename = `compare_${result.symbol}_${result.date_from}_${result.date_to}.csv`
  downloadBlob(lines.join('\n'), filename, 'text/csv')
}

function exportPNG(canvas: HTMLCanvasElement | null, result: CompareResponse) {
  if (!canvas) return
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compare_${result.symbol}_${result.date_from}_${result.date_to}.png`
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CompareResults({ result }: CompareResultsProps) {
  const chartRef = useRef<MultiEquityCurveChartHandle>(null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold tracking-tight text-[var(--foreground)]">{result.symbol}</span>
            {result.security_name && (
              <span className="text-xs text-[var(--foreground-muted)]">{result.security_name}</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-[var(--foreground-muted)] font-mono-data">
            {result.date_from} → {result.date_to} &middot; Initial capital: {fmt(result.initial_capital)}
          </p>
          {/* Strategy badges */}
          <div className="mt-2 flex flex-wrap gap-2">
            {result.results.map((r) => {
              const color = STRATEGY_COLORS[r.strategy as keyof typeof STRATEGY_COLORS] ?? '#888'
              const returnBase = r.strategy === 'dca' ? r.total_invested : r.initial_capital
              const ret = (r.final_value - returnBase) / returnBase
              return (
                <div key={r.strategy} className="flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs font-semibold" style={{ color }}>{strategyLabel(r.strategy)}</span>
                  <span className="text-xs font-mono-data text-[var(--foreground-muted)]">{fmt(r.final_value)}</span>
                  <span className="text-xs font-mono-data" style={{ color: ret >= 0 ? '#10b981' : '#ef4444' }}>
                    {fmtPct(ret)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Export toolbar */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-[var(--foreground-muted)] mr-1 flex items-center gap-1">
            <Download size={11} /> Export
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => exportCSV(result)}
            title="Download CSV"
          >
            <FileText size={12} /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => exportJSON(result)}
            title="Download JSON"
          >
            <FileJson size={12} /> JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => exportPNG(chartRef.current?.takeScreenshot() ?? null, result)}
            title="Download chart as PNG"
          >
            <Image size={12} /> PNG
          </Button>
        </div>
      </div>

      <Separator />

      {/* Equity curve */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
          Portfolio Value Over Time
        </p>
        <MultiEquityCurveChart ref={chartRef} results={result.results} />
      </div>

      <Separator />

      {/* Metrics table */}
      <div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
          Performance Metrics
        </p>
        <MetricsCompareTable results={result.results} />
      </div>

      <Separator />

      {/* Per-strategy trade logs */}
      <div className="space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
          Trade Logs
        </p>
        {result.results.map((r) => {
          const color = STRATEGY_COLORS[r.strategy as keyof typeof STRATEGY_COLORS] ?? '#888'
          return (
            <div key={r.strategy}>
              <p className="mb-1 text-xs font-semibold" style={{ color }}>
                {strategyLabel(r.strategy)}
              </p>
              <TradeLog trades={r.trades} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
