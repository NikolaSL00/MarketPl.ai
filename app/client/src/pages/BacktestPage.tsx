import { useBacktestConfig } from '@/hooks/useBacktestConfig'
import { BacktestConfigPanel } from '@/components/backtest/BacktestConfigPanel'
import { BacktestResults } from '@/components/backtest/BacktestResults'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, Settings2, Loader2 } from 'lucide-react'

export function BacktestPage() {
  const config = useBacktestConfig()

  return (
    <div className="flex h-full gap-5">
      {/* Left panel — Configuration */}
      <div className="w-[340px] shrink-0 min-h-0">
        <Card className="h-full flex flex-col min-h-0">
          <CardHeader className="pb-3 shrink-0">
            <CardTitle className="flex items-center gap-2">
              <Settings2 size={14} className="text-[var(--accent)]" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-auto">
            <BacktestConfigPanel config={config} />
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
            {config.isSubmitting ? (
              /* Skeleton / loading state */
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
            ) : config.submitResult ? (
              <BacktestResults result={config.submitResult} />
            ) : (
              /* Empty state */
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
                  {config.submitError && (
                    <div className="mt-2 rounded-[var(--radius)] bg-[var(--surface)] border border-red-800/50 px-4 py-3 text-xs text-red-400">
                      {config.submitError}
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
