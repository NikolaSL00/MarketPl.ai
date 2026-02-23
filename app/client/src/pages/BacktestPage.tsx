import { useState } from 'react'
import { useBacktestConfig } from '@/hooks/useBacktestConfig'
import { useCompareConfig } from '@/hooks/useCompareConfig'
import { BacktestConfigPanel } from '@/components/backtest/BacktestConfigPanel'
import { BacktestResults } from '@/components/backtest/BacktestResults'
import { CompareConfigPanel } from '@/components/backtest/CompareConfigPanel'
import { CompareResults } from '@/components/backtest/CompareResults'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, Settings2, GitCompareArrows, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type PageMode = 'single' | 'compare'

export function BacktestPage() {
  const [mode, setMode] = useState<PageMode>('single')
  const singleConfig = useBacktestConfig()
  const compareConfig = useCompareConfig()

  const ModeToggle = () => (
    <div className="flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs">
      {([
        { key: 'single', label: 'Single Run', Icon: BarChart3 },
        { key: 'compare', label: 'Compare', Icon: GitCompareArrows },
      ] as const).map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => setMode(key)}
          className={cn(
            'flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-colors cursor-pointer',
            mode === key
              ? 'bg-[var(--accent)] text-black'
              : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
          )}
        >
          <Icon size={11} />
          {label}
        </button>
      ))}
    </div>
  )

  if (mode === 'compare') {
    return (
      <div className="flex h-full gap-5">
        {/* Left panel — Compare configuration */}
        <div className="w-[340px] shrink-0 min-h-0">
          <Card className="h-full flex flex-col min-h-0">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <Settings2 size={14} className="text-[var(--accent)]" />
                  Configuration
                </CardTitle>
                <ModeToggle />
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-auto">
              <CompareConfigPanel config={compareConfig} />
            </CardContent>
          </Card>
        </div>

        {/* Right panel — Compare results */}
        <div className="flex-1 min-w-0 min-h-0">
          <Card className="h-full flex flex-col min-h-0">
            <CardHeader className="pb-3 shrink-0">
              <CardTitle className="flex items-center gap-2">
                <GitCompareArrows size={14} className="text-[var(--accent)]" />
                Comparison Results
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-auto">
              {compareConfig.isSubmitting ? (
                <div className="flex h-full flex-col items-center justify-center gap-4">
                  <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
                  <p className="text-sm text-[var(--foreground-muted)]">Running comparison…</p>
                  <div className="w-64 space-y-2 animate-pulse">
                    <div className="h-48 rounded-[var(--radius)] bg-[var(--surface)]" />
                    <div className="grid grid-cols-3 gap-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 rounded-[var(--radius)] bg-[var(--surface)]" />
                      ))}
                    </div>
                  </div>
                </div>
              ) : compareConfig.submitResult ? (
                <CompareResults result={compareConfig.submitResult} />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="flex flex-col items-center gap-3 text-center px-8">
                    <div className="rounded-full bg-[var(--accent-muted)] p-4">
                      <GitCompareArrows size={28} className="text-[var(--accent)]" />
                    </div>
                    <h2 className="text-sm font-semibold text-[var(--foreground)]">
                      Strategy Comparison
                    </h2>
                    <p className="max-w-sm text-xs text-[var(--foreground-muted)] leading-relaxed">
                      Select 2 or 3 strategies on the left and click
                      <span className="font-semibold text-[var(--accent)]"> Run Comparison </span>
                      to see an overlay chart, side-by-side metrics, and export options.
                    </p>
                    {compareConfig.submitError && (
                      <div className="mt-2 rounded-[var(--radius)] bg-[var(--surface)] border border-red-800/50 px-4 py-3 text-xs text-red-400">
                        {compareConfig.submitError}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Single-run mode
  return (
    <div className="flex h-full gap-5">
      {/* Left panel — Configuration */}
      <div className="w-[340px] shrink-0 min-h-0">
        <Card className="h-full flex flex-col min-h-0">
          <CardHeader className="pb-3 shrink-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Settings2 size={14} className="text-[var(--accent)]" />
                Configuration
              </CardTitle>
              <ModeToggle />
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-auto">
            <BacktestConfigPanel config={singleConfig} />
          </CardContent>
        </Card>
      </div>

      {/* Right panel — Results */}
      <div className="flex-1 min-w-0 min-h-0">
        <Card className="h-full flex flex-col min-h-0">
          <CardHeader className="pb-3 shrink-0">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={14} className="text-[var(--accent)]" />
              Results
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-auto">
            {singleConfig.isSubmitting ? (
              <div className="flex h-full flex-col items-center justify-center gap-4">
                <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
                <p className="text-sm text-[var(--foreground-muted)]">Running simulation…</p>
                <div className="w-64 space-y-2 animate-pulse">
                  <div className="h-48 rounded-[var(--radius)] bg-[var(--surface)]" />
                  <div className="grid grid-cols-4 gap-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-16 rounded-[var(--radius)] bg-[var(--surface)]" />
                    ))}
                  </div>
                </div>
              </div>
            ) : singleConfig.submitResult ? (
              <BacktestResults result={singleConfig.submitResult} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center px-8">
                  <div className="rounded-full bg-[var(--accent-muted)] p-4">
                    <BarChart3 size={28} className="text-[var(--accent)]" />
                  </div>
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">
                    Backtest Results
                  </h2>
                  <p className="max-w-sm text-xs text-[var(--foreground-muted)] leading-relaxed">
                    Configure your strategy in the left panel and click
                    <span className="font-semibold text-[var(--accent)]"> Run Backtest </span>
                    to simulate portfolio performance over time.
                  </p>
                  {singleConfig.submitError && (
                    <div className="mt-2 rounded-[var(--radius)] bg-[var(--surface)] border border-red-800/50 px-4 py-3 text-xs text-red-400">
                      {singleConfig.submitError}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

