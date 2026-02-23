import { SymbolFilter } from '@/components/data/SymbolFilter'
import { StrategyParamsForm } from '@/components/backtest/StrategyParamsForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Loader2, GitCompareArrows } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STRATEGY_OPTIONS, STRATEGY_COLORS, type StrategyType } from '@/types/backtest'
import type { UseCompareConfigReturn } from '@/hooks/useCompareConfig'

interface CompareConfigPanelProps {
  config: UseCompareConfigReturn
}

export function CompareConfigPanel({ config }: CompareConfigPanelProps) {
  const {
    symbol, setSymbol,
    dateFrom, dateTo, setDateFrom, setDateTo,
    dateRange, dateRangeLoading,
    initialCapital, setInitialCapital,
    selectedStrategies, toggleStrategy,
    dcaParams, setDCAParams,
    maParams, setMAParams,
    isValid, validationErrors,
    isSubmitting, submitError,
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
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--foreground)]">
          Initial Capital
          <span className="ml-2 text-xs font-normal normal-case tracking-normal text-[var(--foreground-muted)]">
            — used as-is for B&H and MA; DCA invests a fixed amount per period
          </span>
        </h3>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--foreground-muted)]">$</span>
          <Input
            type="number"
            min={1}
            step={1000}
            value={initialCapital}
            onChange={(e) => setInitialCapital(Number(e.target.value))}
            className="pl-8 font-mono-data text-sm"
            placeholder="10000"
          />
        </div>
      </section>

      <Separator />

      {/* Strategies to compare */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--foreground)]">
          Strategies
          <span className="ml-2 text-xs font-normal normal-case tracking-normal text-[var(--foreground-muted)]">— select 2 or 3</span>
        </h3>
        <div className="space-y-2">
          {STRATEGY_OPTIONS.map((option) => {
            const active = selectedStrategies.has(option.type)
            const color = STRATEGY_COLORS[option.type]
            return (
              <div key={option.type}>
                {/* Strategy checkbox card */}
                <button
                  type="button"
                  onClick={() => toggleStrategy(option.type)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-[var(--radius)] border px-3 py-3 text-left transition-colors cursor-pointer box-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent-muted)]'
                      : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)]'
                  )}
                >
                  {/* Color swatch + checkbox */}
                  <span
                    className={cn(
                      'mt-0.5 h-4 w-4 flex-shrink-0 rounded-sm border-2 flex items-center justify-center transition-colors',
                      active ? 'border-[var(--accent)]' : 'border-[var(--border)]'
                    )}
                    style={active ? { backgroundColor: color, borderColor: color } : {}}
                  >
                    {active && (
                      <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-black">
                        <path d="M1 4l3 3 5-6" stroke="black" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <div className="min-w-0">
                    <span
                      className="block text-sm font-semibold"
                      style={active ? { color } : undefined}
                    >
                      {option.label}
                    </span>
                    <span className="block text-xs text-[var(--foreground-muted)] leading-relaxed">
                      {option.description}
                    </span>
                  </div>
                </button>

                {/* Strategy-specific params shown when selected */}
                {active && (option.type === 'dca' || option.type === 'ma_crossover') && (
                  <div className="ml-7 mt-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3">
                    <StrategyParamsForm
                      strategy={option.type as StrategyType}
                      dateFrom={dateFrom}
                      dateTo={dateTo}
                      dcaParams={dcaParams}
                      maParams={maParams}
                      onDCAChange={setDCAParams}
                      onMAChange={setMAParams}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <Separator />

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <ul className="space-y-1">
          {validationErrors.map((e) => (
            <li key={e} className="text-xs text-[var(--loss)]">• {e}</li>
          ))}
        </ul>
      )}

      {/* Submit error */}
      {submitError && (
        <div className="rounded-[var(--radius)] bg-[var(--loss-muted)] px-3 py-2 text-xs text-[var(--loss)]">
          {submitError}
        </div>
      )}

      <Button onClick={submit} disabled={!isValid || isSubmitting} className="w-full">
        {isSubmitting ? (
          <><Loader2 size={14} className="animate-spin" /> Running…</>
        ) : (
          <><GitCompareArrows size={14} /> Run Comparison</>
        )}
      </Button>
    </div>
  )
}
