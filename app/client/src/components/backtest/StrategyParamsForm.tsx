import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  DCA_INTERVAL_OPTIONS,
  type DCAInterval,
  type DCAParams,
  type MACrossoverParams,
  type RSIParams,
  type BollingerBandsParams,
  type StrategyType,
} from '@/types/backtest'

interface StrategyParamsFormProps {
  strategy: StrategyType
  dateFrom: string
  dateTo: string
  dcaParams: DCAParams
  maParams: MACrossoverParams
  rsiParams: RSIParams
  bbParams: BollingerBandsParams
  onDCAChange: (params: DCAParams) => void
  onMAChange: (params: MACrossoverParams) => void
  onRSIChange: (params: RSIParams) => void
  onBBChange: (params: BollingerBandsParams) => void
}

export function StrategyParamsForm({
  strategy,
  dateFrom,
  dateTo,
  dcaParams,
  maParams,
  rsiParams,
  bbParams,
  onDCAChange,
  onMAChange,
  onRSIChange,
  onBBChange,
}: StrategyParamsFormProps) {
  const parseISODateUTC = (iso: string) => {
    if (!iso) return null
    const dt = new Date(`${iso}T00:00:00Z`)
    return Number.isNaN(dt.getTime()) ? null : dt
  }

  const daysBetweenUTC = (from: Date, to: Date) =>
    Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))

  const addMonthsUTC = (d: Date, monthsToAdd: number) => {
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth()
    const day = d.getUTCDate()

    const targetMonthIndex = m + monthsToAdd
    const targetYear = y + Math.floor(targetMonthIndex / 12)
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12

    // Clamp day-of-month to last day of target month
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
    const clampedDay = Math.min(day, lastDay)
    return new Date(Date.UTC(targetYear, targetMonth, clampedDay))
  }

  const diffInMonthsApprox = (from: Date, to: Date) => {
    let wholeMonths =
      (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
      (to.getUTCMonth() - from.getUTCMonth())

    let anchor = addMonthsUTC(from, wholeMonths)
    if (anchor.getTime() > to.getTime()) {
      wholeMonths -= 1
      anchor = addMonthsUTC(from, wholeMonths)
    }
    const next = addMonthsUTC(from, wholeMonths + 1)
    const denom = next.getTime() - anchor.getTime()
    const frac = denom > 0 ? (to.getTime() - anchor.getTime()) / denom : 0
    return wholeMonths + Math.max(0, Math.min(1, frac))
  }

  const countSchedule = (from: Date, to: Date, interval: DCAInterval) => {
    if (from.getTime() > to.getTime()) return 0

    if (interval === 'weekly') {
      const diffDays = daysBetweenUTC(from, to)
      return 1 + Math.floor(diffDays / 7)
    }

    const stepMonths = interval === 'monthly' ? 1 : 3
    let count = 0
    let cursor = from
    while (cursor.getTime() <= to.getTime() && count < 100000) {
      count += 1
      cursor = addMonthsUTC(cursor, stepMonths)
    }
    return count
  }

  const formatUSD = (v: number) =>
    '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 })

  if (strategy === 'buy_and_hold') {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Full capital is deployed at the start date. No further trades or rebalancing occur.
        </p>
      </div>
    )
  }

  if (strategy === 'dca') {
    const from = parseISODateUTC(dateFrom)
    const to = parseISODateUTC(dateTo)

    const hasValidRange = Boolean(from && to && from.getTime() < to.getTime())

    const diffDays = hasValidRange ? daysBetweenUTC(from!, to!) : 0
    const approxMonths = hasValidRange ? diffInMonthsApprox(from!, to!) : 0
    const scheduledBuys = hasValidRange ? countSchedule(from!, to!, dcaParams.interval) : 0

    const estimatedBuys = hasValidRange ? scheduledBuys : 0
    const estimatedInvested = estimatedBuys * dcaParams.amount

    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm text-[var(--foreground-muted)]">
            Investment Interval
          </label>
          <Select
            value={dcaParams.interval}
            onChange={(e) =>
              onDCAChange({ ...dcaParams, interval: e.target.value as DCAInterval })
            }
          >
            {DCA_INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-[var(--foreground-muted)]">
            Amount per Period ($)
          </label>
          <Input
            type="number"
            min={1}
            step={100}
            value={dcaParams.amount}
            onChange={(e) =>
              onDCAChange({ ...dcaParams, amount: Number(e.target.value) })
            }
            className="font-mono-data text-sm"
            placeholder="500"
          />
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          {!hasValidRange ? (
            <p className="text-xs text-[var(--foreground-muted)]">
              Set a valid date range to see an estimate.
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-[var(--foreground-muted)]">
                Period: <span className="font-mono tabular-nums text-[var(--foreground)]">~{approxMonths.toFixed(1)}</span> months
                <span className="text-[var(--border)]"> · </span>
                <span className="font-mono tabular-nums text-[var(--foreground)]">{diffDays}</span> days
              </p>
              <p className="text-xs text-[var(--foreground-muted)]">
                Scheduled purchases: <span className="font-mono tabular-nums text-[var(--foreground)]">{estimatedBuys}</span>
                <span className="ml-1 text-[var(--foreground-muted)]">({dcaParams.interval})</span>
              </p>
              <p className="text-xs text-[var(--foreground-muted)]">
                Total invested: <span className="font-mono tabular-nums text-[var(--foreground)]">{formatUSD(estimatedInvested)}</span>
                <span className="ml-1 text-[var(--foreground-muted)]">({estimatedBuys} × {formatUSD(dcaParams.amount)})</span>
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (strategy === 'ma_crossover') {
    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm text-[var(--foreground-muted)]">
            Short Window (days)
          </label>
          <Input
            type="number"
            min={5}
            max={200}
            value={maParams.short_window}
            onChange={(e) =>
              onMAChange({ ...maParams, short_window: Number(e.target.value) })
            }
            className="font-mono-data text-sm"
            placeholder="50"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-[var(--foreground-muted)]">
            Long Window (days)
          </label>
          <Input
            type="number"
            min={20}
            max={500}
            value={maParams.long_window}
            onChange={(e) =>
              onMAChange({ ...maParams, long_window: Number(e.target.value) })
            }
            className="font-mono-data text-sm"
            placeholder="200"
          />
        </div>
        {maParams.short_window >= maParams.long_window && (
          <p className="text-[10px] text-[var(--loss)]">
            Short window must be less than long window.
          </p>
        )}
      </div>
    )
  }

  if (strategy === 'rsi') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1.5 block text-sm text-[var(--foreground-muted)]">
              RSI Period
            </label>
            <Input
              type="number"
              min={2}
              max={50}
              value={rsiParams.rsi_period}
              onChange={(e) =>
                onRSIChange({ ...rsiParams, rsi_period: Number(e.target.value) })
              }
              className="font-mono-data text-sm"
              placeholder="14"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-[var(--foreground-muted)]">
              Oversold (&lt;)
            </label>
            <Input
              type="number"
              min={1}
              max={49}
              value={rsiParams.oversold}
              onChange={(e) =>
                onRSIChange({ ...rsiParams, oversold: Number(e.target.value) })
              }
              className="font-mono-data text-sm"
              placeholder="30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-[var(--foreground-muted)]">
              Overbought (&gt;)
            </label>
            <Input
              type="number"
              min={51}
              max={99}
              value={rsiParams.overbought}
              onChange={(e) =>
                onRSIChange({ ...rsiParams, overbought: Number(e.target.value) })
              }
              className="font-mono-data text-sm"
              placeholder="70"
            />
          </div>
        </div>
        {rsiParams.oversold >= rsiParams.overbought && (
          <p className="text-[10px] text-[var(--loss)]">
            Oversold must be below overbought.
          </p>
        )}
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <p className="text-xs text-[var(--foreground-muted)]">
            Signal: RSI({rsiParams.rsi_period}) &lt;&nbsp;
            <span className="font-mono tabular-nums text-[var(--gain)]">{rsiParams.oversold}</span>
            &nbsp;→ BUY&nbsp;·&nbsp;RSI &gt;&nbsp;
            <span className="font-mono tabular-nums text-[var(--loss)]">{rsiParams.overbought}</span>
            &nbsp;→ SELL
          </p>
        </div>
      </div>
    )
  }

  if (strategy === 'bollinger_bands') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm text-[var(--foreground-muted)]">
              Window (days)
            </label>
            <Input
              type="number"
              min={5}
              max={200}
              value={bbParams.bb_window}
              onChange={(e) =>
                onBBChange({ ...bbParams, bb_window: Number(e.target.value) })
              }
              className="font-mono-data text-sm"
              placeholder="20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-[var(--foreground-muted)]">
              Std Dev (σ)
            </label>
            <Input
              type="number"
              min={0.5}
              max={5}
              step={0.5}
              value={bbParams.bb_std}
              onChange={(e) =>
                onBBChange({ ...bbParams, bb_std: Number(e.target.value) })
              }
              className="font-mono-data text-sm"
              placeholder="2.0"
            />
          </div>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <p className="text-xs text-[var(--foreground-muted)]">
            Bands: SMA(<span className="font-mono tabular-nums text-[var(--foreground)]">{bbParams.bb_window}</span>)
            &nbsp;±&nbsp;
            <span className="font-mono tabular-nums text-[var(--foreground)]">{bbParams.bb_std}</span>σ
            &nbsp;·&nbsp;close &lt; lower → BUY&nbsp;·&nbsp;close &gt; upper → SELL
          </p>
        </div>
      </div>
    )
  }

  return null
}
