import { useEffect, useRef, useState } from 'react'
import { createChart, AreaSeries, ColorType, LineStyle, type IChartApi, type ISeriesApi } from 'lightweight-charts'
import type { EquityPoint } from '@/types/backtest'

interface EquityCurveChartProps {
  data: EquityPoint[]
  initialCapital: number
}

interface TooltipState {
  visible: boolean
  x: number
  y: number
  date: string
  value: number
}

const CHART_COLORS = {
  background: '#0d1117',
  grid: '#1e2530',
  text: '#8b9ab1',
  crosshair: '#3b5068',
  lineUp: '#06b6d4',
  fillTop: 'rgba(6,182,212,0.18)',
  fillBottom: 'rgba(6,182,212,0.00)',
}

export function EquityCurveChart({ data, initialCapital }: EquityCurveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area', unknown> | null>(null)
  const [isLog, setIsLog] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, date: '', value: 0 })

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 280,
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.background },
        textColor: CHART_COLORS.text,
        fontFamily: "'JetBrains Mono', 'Roboto Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid, style: LineStyle.Dotted },
        horzLines: { color: CHART_COLORS.grid, style: LineStyle.Dotted },
      },
      crosshair: {
        vertLine: { color: CHART_COLORS.crosshair, width: 1, style: LineStyle.Dashed },
        horzLine: { color: CHART_COLORS.crosshair, width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.grid,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: CHART_COLORS.grid,
        timeVisible: true,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: true,
      handleScale: true,
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor: CHART_COLORS.lineUp,
      topColor: CHART_COLORS.fillTop,
      bottomColor: CHART_COLORS.fillBottom,
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

    chartRef.current = chart
    seriesRef.current = series

    // Baseline (initial capital) reference line
    series.createPriceLine({
      price: initialCapital,
      color: 'rgba(139,154,177,0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: 'Initial Capital',
    })

    // Crosshair tooltip
    chart.subscribeCrosshairMove((param) => {
      if (!containerRef.current) return
      if (!param.point || !param.time || !param.seriesData.size) {
        setTooltip((t) => ({ ...t, visible: false }))
        return
      }
      const seriesValue = param.seriesData.get(series)
      if (!seriesValue || !('value' in seriesValue)) {
        setTooltip((t) => ({ ...t, visible: false }))
        return
      }
      const rect = containerRef.current.getBoundingClientRect()
      const x = param.point.x
      const y = param.point.y
      // Keep tooltip inside the container (flip left if too close to right edge)
      const tipWidth = 180
      const adjustedX = x + tipWidth + 16 > rect.width ? x - tipWidth - 8 : x + 16
      setTooltip({
        visible: true,
        x: adjustedX,
        y: Math.max(4, y - 40),
        date: typeof param.time === 'string' ? param.time : String(param.time),
        value: seriesValue.value as number,
      })
    })

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [initialCapital])

  // Push data whenever it changes
  useEffect(() => {
    if (!seriesRef.current || !data.length) return
    const chartData = data.map((p) => ({ time: p.date as string, value: p.value }))
    seriesRef.current.setData(chartData)
    chartRef.current?.timeScale().fitContent()
  }, [data])

  // Toggle log/linear scale
  useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.priceScale('right').applyOptions({ mode: isLog ? 1 : 0 })
  }, [isLog])

  return (
    <div className="relative">
      {/* Log/Linear toggle */}
      <button
        type="button"
        onClick={() => setIsLog((v) => !v)}
        className="absolute right-2 top-2 z-10 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-mono text-[var(--foreground-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
      >
        {isLog ? 'LINEAR' : 'LOG'}
      </button>

      {/* Hover tooltip */}
      {tooltip.visible && (
        <div
          className="pointer-events-none absolute z-20 rounded border border-[var(--border)] bg-[#0d1117]/95 px-3 py-2 shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="text-[10px] text-[var(--foreground-muted)] font-mono-data mb-0.5">{tooltip.date}</p>
          <p className="text-sm font-semibold text-[var(--accent)] font-mono-data">
            {tooltip.value < 0 ? '-' : ''}$
            {Math.abs(tooltip.value).toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
        </div>
      )}

      <div ref={containerRef} className="w-full rounded-[var(--radius)] overflow-hidden" style={{ height: 280 }} />
    </div>
  )
}
