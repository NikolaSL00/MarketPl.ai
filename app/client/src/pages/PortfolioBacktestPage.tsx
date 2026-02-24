import { PieChart, Settings2, Loader2 } from 'lucide-react'
import { usePortfolioConfig } from '@/hooks/usePortfolioConfig'
import { PortfolioConfigPanel } from '@/components/portfolio/PortfolioConfigPanel'
import { PortfolioResults } from '@/components/portfolio/PortfolioResults'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function PortfolioBacktestPage() {
  const config = usePortfolioConfig()

  return (
    <div className="flex h-full gap-5">
      {/* Left panel — 340px config */}
      <div className="w-[340px] shrink-0 min-h-0">
        <Card className="h-full flex flex-col min-h-0">
          <CardHeader className="pb-3 shrink-0">
            <CardTitle className="flex items-center gap-2">
              <Settings2 size={14} className="text-[var(--accent)]" />
              Portfolio Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-auto">
            <PortfolioConfigPanel config={config} />
          </CardContent>
        </Card>
      </div>

      {/* Right panel — results */}
      <div className="flex-1 min-w-0 min-h-0">
        <Card className="h-full flex flex-col min-h-0">
          <CardHeader className="pb-3 shrink-0">
            <CardTitle className="flex items-center gap-2">
              <PieChart size={14} className="text-[var(--accent)]" />
              Portfolio Results
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-auto">
            {config.isSubmitting ? (
              <div className="flex h-full flex-col items-center justify-center gap-4">
                <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
                <p className="text-sm text-[var(--foreground-muted)]">Running portfolio simulation…</p>
              </div>
            ) : config.submitResult ? (
              <PortfolioResults result={config.submitResult} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center px-8">
                  <div className="rounded-full bg-[var(--accent-muted)] p-4">
                    <PieChart size={28} className="text-[var(--accent)]" />
                  </div>
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">Portfolio Backtest</h2>
                  <p className="max-w-sm text-xs text-[var(--foreground-muted)] leading-relaxed">
                    Add 2–5 symbols with target weights, choose a strategy, and click{' '}
                    <span className="font-semibold text-[var(--accent)]">Run Portfolio</span> to simulate performance.
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
