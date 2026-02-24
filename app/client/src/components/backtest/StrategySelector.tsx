import { STRATEGY_OPTIONS, type StrategyType } from '@/types/backtest'
import { cn } from '@/lib/utils'
import { StrategyTooltip } from '@/components/ui/GlossaryTooltip'

interface StrategySelectorProps {
  value: StrategyType
  onChange: (strategy: StrategyType) => void
}

export function StrategySelector({ value, onChange }: StrategySelectorProps) {
  return (
    <div className="space-y-2">
      {STRATEGY_OPTIONS.map((option) => {
        const isActive = value === option.type
        return (
          <button
            key={option.type}
            type="button"
            onClick={() => onChange(option.type)}
            className={cn(
              'flex w-full min-w-0 flex-col gap-1 rounded-[var(--radius)] border px-3 py-3 text-left transition-colors cursor-pointer box-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
              isActive
                ? 'border-[var(--accent)] bg-[var(--accent-muted)]'
                : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)]'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'text-sm font-semibold',
                  isActive ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'
                )}
              >
                {option.label}
              </span>
              <span onClick={(e) => e.stopPropagation()}>
                <StrategyTooltip strategyKey={option.type} />
              </span>
            </div>
            <span className="text-xs text-[var(--foreground-muted)] leading-relaxed">
              {option.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}
