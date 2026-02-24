import { SymbolFilter } from '@/components/data/SymbolFilter'
import { StrategySelector } from '@/components/backtest/StrategySelector'
import { StrategyParamsForm } from '@/components/backtest/StrategyParamsForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Loader2, Play } from 'lucide-react'
import type { useBacktestConfig } from '@/hooks/useBacktestConfig'

type BacktestConfig = ReturnType<typeof useBacktestConfig>

interface BacktestConfigPanelProps {
  config: BacktestConfig
}

export function BacktestConfigPanel({ config }: BacktestConfigPanelProps) {
  const {
    symbol,
    setSymbol,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    dateRange,
    dateRangeLoading,
    initialCapital,
    setInitialCapital,
    strategy,
    setStrategy,
    dcaParams,
    setDCAParams,
    maParams,
    setMAParams,
    rsiParams,
    setRSIParams,
    bbParams,
    setBBParams,
    isValid,
    isSubmitting,
    submitError,
    submit,
  } = config

  return (
    <div className="space-y-5">
      {/* Symbol */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--foreground)]">
          Symbol
        </h3>
        <SymbolFilter value={symbol} onChange={setSymbol} />
        {dateRange && !dateRangeLoading && (
          <p className="mt-2 text-xs text-[var(--foreground-muted)] font-mono-data">
            {dateRange.data_points.toLocaleString()} data points &middot; {dateRange.min_date} to {dateRange.max_date}
          </p>
        )}
        {dateRangeLoading && (
          <p className="mt-2 text-xs text-[var(--foreground-muted)] flex items-center gap-1.5">
            <Loader2 size={10} className="animate-spin" /> Loading date range…
          </p>
        )}
      </section>

      <Separator />

      {/* Date Range */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--foreground)]">
          Time Range
        </h3>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="mb-1.5 block text-xs text-[var(--foreground-muted)]">From</label>
            <Input
              type="date"
              value={dateFrom}
              min={dateRange?.min_date}
              max={dateTo || dateRange?.max_date}
              onChange={(e) => setDateFrom(e.target.value)}
              disabled={!symbol}
              className="font-mono-data text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--foreground-muted)]">To</label>
            <Input
              type="date"
              value={dateTo}
              min={dateFrom || dateRange?.min_date}
              max={dateRange?.max_date}
              onChange={(e) => setDateTo(e.target.value)}
              disabled={!symbol}
              className="font-mono-data text-sm"
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* Initial Capital */}
      <section className={strategy === 'dca' ? 'opacity-40 pointer-events-none select-none' : ''}>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--foreground)]">
          Initial Capital
          {strategy === 'dca' && (
            <span className="ml-2 text-xs font-normal normal-case tracking-normal text-[var(--foreground-muted)]">
              — not used for DCA
            </span>
          )}
        </h3>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--foreground-muted)]">
            $
          </span>
          <Input
            type="number"
            min={1}
            step={1000}
            value={initialCapital}
            onChange={(e) => setInitialCapital(Number(e.target.value))}
            className="pl-8 font-mono-data text-sm"
            placeholder="10000"
            disabled={strategy === 'dca'}
            tabIndex={strategy === 'dca' ? -1 : undefined}
          />
        </div>
      </section>

      <Separator />

      {/* Strategy */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--foreground)]">
          Strategy
        </h3>
        <StrategySelector value={strategy} onChange={setStrategy} />
      </section>

      <Separator />

      {/* Strategy Parameters */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--foreground)]">
          Parameters
        </h3>
        <StrategyParamsForm
          strategy={strategy}
          dateFrom={dateFrom}
          dateTo={dateTo}
          dcaParams={dcaParams}
          maParams={maParams}
          rsiParams={rsiParams}
          bbParams={bbParams}
          onDCAChange={setDCAParams}
          onMAChange={setMAParams}
          onRSIChange={setRSIParams}
          onBBChange={setBBParams}
        />
      </section>

      <Separator />

      {/* Submit */}
      {submitError && (
        <div className="rounded-[var(--radius)] bg-[var(--loss-muted)] px-3 py-2 text-xs text-[var(--loss)]">
          {submitError}
        </div>
      )}

      <Button
        onClick={submit}
        disabled={!isValid || isSubmitting}
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Running…
          </>
        ) : (
          <>
            <Play size={14} />
            Run Backtest
          </>
        )}
      </Button>
    </div>
  )
}
