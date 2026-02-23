import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  createChart,
  LineSeries,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts'
import type { BacktestResponse } from '@/types/backtest'
import { STRATEGY_COLORS } from '@/types/backtest'
import { STRATEGY_OPTIONS } from '@/types/backtest'

export interface MultiEquityCurveChartHandle {
  takeScreenshot: () => HTMLCanvasElement | null
}

interface MultiEquityCurveChartProps {
  results: BacktestResponse[]
}

const BG = '#0d1117'
const GRID = '#1e2530'
const TEXT = '#8b9ab1'
const CROSSHAIR = '#3b5068'

function strategyLabel(strategy: string): string {
  return STRATEGY_OPTIONS.find((s) => s.type === strategy)?.label ?? strategy
}

interface TooltipItem {
  strategy: string
  label: string
  value: number
  color: string
}

interface TooltipState {
  visible: boolean
  x: number
  y: number
  date: string
  items: TooltipItem[]
}

export const MultiEquityCurveChart = forwardRef<MultiEquityCurveChartHandle, MultiEquityCurveChartProps>(
  function MultiEquityCurveChart({ results }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const seriesRefs = useRef<Map<string, ISeriesApi<'Line', unknown>>>(new Map())
    const [isLog, setIsLog] = useState(false)
    const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, date: '', items: [] })

    useImperativeHandle(ref, () => ({
      takeScreenshot: () => chartRef.current?.takeScreenshot() ?? null,
    }))

    // Create chart once
    useEffect(() => {
      if (!containerRef.current) return

      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 300,
        layout: {
          background: { type: ColorType.Solid, color: BG },
          textColor: TEXT,
          fontFamily: "'JetBrains Mono', 'Roboto Mono', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: GRID, style: LineStyle.Dotted },
          horzLines: { color: GRID, style: LineStyle.Dotted },
        },
        crosshair: {
          vertLine: { color: CROSSHAIR, width: 1, style: LineStyle.Dashed },
          horzLine: { color: CROSSHAIR, width: 1, style: LineStyle.Dashed },
        },
        rightPriceScale: {
          borderColor: GRID,
          scaleMargins: { top: 0.08, bottom: 0.08 },
        },
        timeScale: {
          borderColor: GRID,
          timeVisible: true,
          fixLeftEdge: true,
          fixRightEdge: true,
        },
        handleScroll: true,
        handleScale: true,
      })

      chartRef.current = chart
      seriesRefs.current = new Map()

      const ro = new ResizeObserver(() => {
        if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
      })
      ro.observe(containerRef.current)

      return () => {
        ro.disconnect()
        chart.remove()
        chartRef.current = null
        seriesRefs.current = new Map()
      }
    }, [])

    // Add/update series when results change
    useEffect(() => {
      const chart = chartRef.current
      if (!chart) return

      // Remove old series not in new results
      const newKeys = new Set(results.map((r) => r.strategy))
      seriesRefs.current.forEach((series, key) => {
        if (!newKeys.has(key)) {
          chart.removeSeries(series)
          seriesRefs.current.delete(key)
        }
      })

      // Add or update series
      results.forEach((result) => {
        const color = STRATEGY_COLORS[result.strategy as keyof typeof STRATEGY_COLORS] ?? '#888'
        let series = seriesRefs.current.get(result.strategy)

        if (!series) {
          series = chart.addSeries(LineSeries, {
            color,
            lineWidth: 2,
            priceFormat: {
              type: 'custom',
              formatter: (price: number) =>
                '$' + price.toLocaleString('en-US', { maximumFractionDigits: 0 }),
              minMove: 0.01,
            },
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 5,
          })
          seriesRefs.current.set(result.strategy, series)
        }

        const data = result.equity_curve.map((p) => ({ time: p.date as string, value: p.value }))
        series.setData(data)
      })

      chart.timeScale().fitContent()
    }, [results])

    // Crosshair tooltip — subscribe after results are set
    useEffect(() => {
      const chart = chartRef.current
      if (!chart) return

      const handler = (param: Parameters<Parameters<IChartApi['subscribeCrosshairMove']>[0]>[0]) => {
        if (!containerRef.current) return
        if (!param.point || !param.time || !param.seriesData.size) {
          setTooltip((t) => ({ ...t, visible: false }))
          return
        }

        const items: TooltipItem[] = []
        seriesRefs.current.forEach((series, strategy) => {
          const sd = param.seriesData.get(series)
          if (sd && 'value' in sd) {
            items.push({
              strategy,
              label: strategyLabel(strategy),
              value: sd.value as number,
              color: STRATEGY_COLORS[strategy as keyof typeof STRATEGY_COLORS] ?? '#888',
            })
          }
        })

        if (!items.length) {
          setTooltip((t) => ({ ...t, visible: false }))
          return
        }

        const rect = containerRef.current.getBoundingClientRect()
        const x = param.point.x
        const y = param.point.y
        const tipWidth = 200
        const adjustedX = x + tipWidth + 16 > rect.width ? x - tipWidth - 8 : x + 16

        setTooltip({
          visible: true,
          x: adjustedX,
          y: Math.max(4, y - 20),
          date: typeof param.time === 'string' ? param.time : String(param.time),
          items,
        })
      }

      chart.subscribeCrosshairMove(handler)
      return () => chart.unsubscribeCrosshairMove(handler)
    }, [results])

    // Log/linear toggle
    useEffect(() => {
      chartRef.current?.priceScale('right').applyOptions({ mode: isLog ? 1 : 0 })
    }, [isLog])

    return (
      <div className="relative">
        {/* Log/Linear toggle */}
        <button
          type="button"
          onClick={() => setIsLog((v) => !v)}
          className="absolute right-2 top-2 z-10 rounded border border-[var(--border)] bg-[#0d1117] px-2 py-0.5 text-[10px] font-mono text-[var(--foreground-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          {isLog ? 'LINEAR' : 'LOG'}
        </button>

        {/* Hover tooltip */}
        {tooltip.visible && (
          <div
            className="pointer-events-none absolute z-20 rounded border border-[var(--border)] bg-[#0d1117]/95 px-3 py-2 shadow-lg min-w-[160px]"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <p className="mb-1.5 text-[10px] text-[var(--foreground-muted)] font-mono-data">{tooltip.date}</p>
            {tooltip.items.map((item) => (
              <div key={item.strategy} className="flex items-center justify-between gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-[var(--foreground-muted)]">{item.label}</span>
                </span>
                <span className="font-semibold font-mono-data" style={{ color: item.color }}>
                  ${item.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>
        )}

        <div ref={containerRef} className="w-full rounded-[var(--radius)] overflow-hidden" style={{ height: 300 }} />
      </div>
    )
  }
)
