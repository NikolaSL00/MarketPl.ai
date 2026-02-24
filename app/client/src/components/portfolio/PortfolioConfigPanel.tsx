import { Play, Loader2 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { StrategySelector } from '@/components/backtest/StrategySelector'
import { StrategyParamsForm } from '@/components/backtest/StrategyParamsForm'
import { PortfolioHoldingsEditor } from './PortfolioHoldingsEditor'
import type { usePortfolioConfig } from '@/hooks/usePortfolioConfig'

interface PortfolioConfigPanelProps {
  config: ReturnType<typeof usePortfolioConfig>
}

export function PortfolioConfigPanel({ config }: PortfolioConfigPanelProps) {
  const {
    holdings,
    addHolding,
    removeHolding,
    updateHoldingSymbol,
    updateHoldingWeight,
    distributeEvenly,
    weightSum,
    dateRangeLoading,
    intersectionRange,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
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
    rebalance,
    setRebalance,
    rebalanceInterval,
    setRebalanceInterval,
    isValid,
    isSubmitting,
    validationErrors,
    submit,
  } = config

  const isDCA = strategy === 'dca'

  return (
    <div className="space-y-5">
      {/* 1. Holdings */}
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
          Holdings
        </p>
        <PortfolioHoldingsEditor
          holdings={holdings}
          onAddHolding={addHolding}
          onRemoveHolding={removeHolding}
          onSymbolChange={updateHoldingSymbol}
          onWeightChange={updateHoldingWeight}
          onDistributeEvenly={distributeEvenly}
          weightSum={weightSum}
          dateRangeLoading={dateRangeLoading}
          intersectionRange={intersectionRange}
        />
      </section>

      <Separator />

      {/* 2. Time Range */}
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
          Time Range
        </p>
        {intersectionRange === null && !dateRangeLoading ? (
          <p className="text-xs text-[var(--foreground-muted)] italic">
            Select symbols to compute date range
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-[var(--foreground-muted)]">From</label>
              <Input
                type="date"
                value={dateFrom}
                min={intersectionRange?.min}
                max={intersectionRange?.max}
                disabled={intersectionRange === null}
                onChange={(e) => setDateFrom(e.target.value)}
                className="font-mono-data tabular-nums text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[var(--foreground-muted)]">To</label>
              <Input
                type="date"
                value={dateTo}
                min={intersectionRange?.min}
                max={intersectionRange?.max}
                disabled={intersectionRange === null}
                onChange={(e) => setDateTo(e.target.value)}
                className="font-mono-data tabular-nums text-xs"
              />
            </div>
          </div>
        )}
      </section>

      <Separator />

      {/* 3. Initial Capital */}
      <section className={`space-y-2 transition-opacity ${isDCA ? 'opacity-40' : ''}`}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
            Initial Capital
          </p>
          {isDCA && (
            <span className="text-xs text-[var(--foreground-muted)] italic">
              — not used for DCA
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-[var(--foreground-muted)]">$</span>
          <Input
            type="number"
            min={0}
            step={1000}
            value={initialCapital}
            onChange={(e) => setInitialCapital(Number(e.target.value))}
            disabled={isDCA}
            className="font-mono-data tabular-nums"
          />
        </div>
      </section>

      <Separator />

      {/* 4. Strategy */}
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
          Strategy
        </p>
        <StrategySelector value={strategy} onChange={setStrategy} />
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

      {/* 5. Rebalancing */}
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
          Rebalancing
        </p>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rebalance}
            onChange={(e) => setRebalance(e.target.checked)}
            className="accent-[var(--accent)] w-4 h-4"
          />
          <span className="text-sm text-[var(--foreground)]">Rebalance periodically</span>
        </label>
        {rebalance && (
          <div className="flex gap-3 pl-6">
            {(['monthly', 'quarterly'] as const).map((interval) => (
              <label key={interval} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="rebalanceInterval"
                  value={interval}
                  checked={rebalanceInterval === interval}
                  onChange={() => setRebalanceInterval(interval)}
                  className="accent-[var(--accent)]"
                />
                <span className="text-sm text-[var(--foreground)] capitalize">{interval}</span>
              </label>
            ))}
          </div>
        )}
      </section>

      {/* 6. Validation errors */}
      {validationErrors.length > 0 && (
        <ul className="space-y-1">
          {validationErrors.map((err, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--loss)]">
              <span className="mt-0.5 shrink-0">•</span>
              {err}
            </li>
          ))}
        </ul>
      )}

      {/* 7. Run button */}
      <Button
        type="button"
        onClick={() => void submit()}
        disabled={!isValid || isSubmitting}
        className="w-full flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Running…
          </>
        ) : (
          <>
            <Play size={14} />
            Run Portfolio
          </>
        )}
      </Button>
    </div>
  )
}
