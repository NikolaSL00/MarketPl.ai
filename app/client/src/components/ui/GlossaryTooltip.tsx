import {
  InfoTooltip,
  TooltipHeader,
  TooltipFormula,
  TooltipBody,
  TooltipRow,
  TooltipBenchmark,
} from '@/components/ui/InfoTooltip'
import { METRIC_GLOSSARY, STRATEGY_GLOSSARY } from '@/lib/glossary'
import { TrendingUp, ArrowRightLeft, Repeat2, Activity, BarChart2 } from 'lucide-react'

const STRATEGY_ICONS = {
  buy_and_hold: TrendingUp,
  dca: Repeat2,
  ma_crossover: ArrowRightLeft,
  rsi: Activity,
  bollinger_bands: BarChart2,
}

/** Tooltip for a performance metric — uses key from METRIC_GLOSSARY */
export function MetricTooltip({ metricKey }: { metricKey: string }) {
  const entry = METRIC_GLOSSARY[metricKey]
  if (!entry) return null

  return (
    <InfoTooltip width={340}>
      <TooltipHeader title={entry.title} />
      {entry.formula && <TooltipFormula formula={entry.formula} />}
      <TooltipBody>
        <TooltipRow label="What it measures">{entry.description}</TooltipRow>
        <TooltipRow label="How to read it">{entry.interpretation}</TooltipRow>
        {entry.benchmark && <TooltipBenchmark value={entry.benchmark} />}
        {entry.source && (
          <p className="text-[10px] text-[#4a6070] mt-1">Source: {entry.source}</p>
        )}
      </TooltipBody>
    </InfoTooltip>
  )
}

/** Tooltip for a strategy card — uses key from STRATEGY_GLOSSARY */
export function StrategyTooltip({ strategyKey }: { strategyKey: string }) {
  const entry = STRATEGY_GLOSSARY[strategyKey]
  if (!entry) return null

  const Icon = STRATEGY_ICONS[strategyKey as keyof typeof STRATEGY_ICONS]

  return (
    <InfoTooltip width={360}>
      <TooltipHeader title={entry.title} badge={entry.tagline} />
      <TooltipBody>
        <TooltipRow label="How it works">{entry.howItWorks}</TooltipRow>
        {entry.signal && (
          <TooltipRow label="Signal">
            <span className="font-mono text-[11px] text-[#a5f3fc]">{entry.signal}</span>
          </TooltipRow>
        )}
        <TooltipRow label="Parameters">{entry.parameters}</TooltipRow>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="rounded bg-[#0d1f1a] border border-[#1a3d2e] px-2.5 py-2">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#2d7a5a] mb-1">
              Best For
            </span>
            <span className="text-[11px] text-[#7adaaa] leading-relaxed">{entry.bestFor}</span>
          </div>
          <div className="rounded bg-[#1f0d0d] border border-[#3d1a1a] px-2.5 py-2">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#7a2d2d] mb-1">
              Weakness
            </span>
            <span className="text-[11px] text-[#da7a7a] leading-relaxed">{entry.weakness}</span>
          </div>
        </div>
      </TooltipBody>
    </InfoTooltip>
  )
}
