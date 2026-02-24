import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TooltipPosition {
  top: number
  left: number
  placement: 'top' | 'bottom' | 'left' | 'right'
}

function computePosition(
  rect: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number,
): TooltipPosition {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const gap = 10

  // Prefer right of trigger, fall back to left, then bottom
  const rightFits = rect.right + gap + tooltipWidth < vw
  const leftFits = rect.left - gap - tooltipWidth > 0
  const bottomFits = rect.bottom + gap + tooltipHeight < vh
  const topFits = rect.top - gap - tooltipHeight > 0

  let placement: TooltipPosition['placement'] = 'right'
  let top = 0
  let left = 0

  if (rightFits) {
    placement = 'right'
    left = rect.right + gap
    top = rect.top + rect.height / 2 - tooltipHeight / 2
  } else if (leftFits) {
    placement = 'left'
    left = rect.left - gap - tooltipWidth
    top = rect.top + rect.height / 2 - tooltipHeight / 2
  } else if (bottomFits) {
    placement = 'bottom'
    top = rect.bottom + gap
    left = rect.left + rect.width / 2 - tooltipWidth / 2
  } else if (topFits) {
    placement = 'top'
    top = rect.top - gap - tooltipHeight
    left = rect.left + rect.width / 2 - tooltipWidth / 2
  } else {
    // Last resort: right, clamped
    placement = 'right'
    left = rect.right + gap
    top = rect.top
  }

  // Clamp to viewport with margin
  const margin = 8
  top = Math.max(margin, Math.min(top, vh - tooltipHeight - margin))
  left = Math.max(margin, Math.min(left, vw - tooltipWidth - margin))

  return { top, left, placement }
}

interface InfoTooltipProps {
  children: ReactNode   // the popover content
  /** Width of the popover in pixels (default 320) */
  width?: number
  className?: string
}

/**
 * An ⓘ trigger that shows a rich informational popover on hover.
 * Rendered via a portal so it escapes overflow:hidden parents.
 */
export function InfoTooltip({ children, width = 320, className }: InfoTooltipProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<TooltipPosition>({ top: 0, left: 0, placement: 'right' })
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setVisible(true)
  }, [])

  const hide = useCallback(() => {
    hideTimerRef.current = setTimeout(() => setVisible(false), 80)
  }, [])

  // Recompute position whenever visible toggles or children change
  useEffect(() => {
    if (!visible || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    // Use placeholder height; will refine on next frame
    const h = tooltipRef.current?.offsetHeight ?? 200
    setPos(computePosition(rect, width, h))
  }, [visible, width])

  // Refine position once tooltip is actually rendered and has a real height
  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const h = tooltipRef.current.offsetHeight
    setPos(computePosition(rect, width, h))
  }, [visible, width])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  const arrow = {
    right: 'before:absolute before:left-[-6px] before:top-1/2 before:-translate-y-1/2 before:border-y-4 before:border-r-[6px] before:border-y-transparent before:border-r-[#1a2235]',
    left: 'before:absolute before:right-[-6px] before:top-1/2 before:-translate-y-1/2 before:border-y-4 before:border-l-[6px] before:border-y-transparent before:border-l-[#1a2235]',
    bottom: 'before:absolute before:top-[-6px] before:left-1/2 before:-translate-x-1/2 before:border-x-4 before:border-b-[6px] before:border-x-transparent before:border-b-[#1a2235]',
    top: 'before:absolute before:bottom-[-6px] before:left-1/2 before:-translate-x-1/2 before:border-x-4 before:border-t-[6px] before:border-x-transparent before:border-t-[#1a2235]',
  }[pos.placement]

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        tabIndex={-1}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={cn(
          'inline-flex items-center justify-center rounded-full w-3.5 h-3.5 text-[var(--foreground-muted)] hover:text-[var(--accent)] transition-colors cursor-help focus:outline-none',
          className
        )}
        aria-label="More information"
      >
        <Info size={11} strokeWidth={2.5} />
      </button>

      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={hide}
            style={{ top: pos.top, left: pos.left, width }}
            className={cn(
              'fixed z-[9999] rounded-lg border border-[#2a3548] bg-[#1a2235] shadow-2xl',
              'animate-in fade-in-0 zoom-in-95 duration-150',
              arrow
            )}
          >
            {children}
          </div>,
          document.body
        )}
    </>
  )
}

// ── Building-block sub-components ────────────────────────────────────────────

export function TooltipHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-[#2a3548] px-4 py-3">
      <span className="text-sm font-bold text-white leading-snug">{title}</span>
      {badge && (
        <span className="shrink-0 rounded border border-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
          {badge}
        </span>
      )}
    </div>
  )
}

export function TooltipFormula({ formula }: { formula: string }) {
  return (
    <div className="mx-4 my-2.5 rounded bg-[#0d1117] px-3 py-2 font-mono text-[11px] text-[#a5f3fc] tracking-wide border border-[#1e2d3d]">
      {formula}
    </div>
  )
}

export function TooltipBody({ children }: { children: ReactNode }) {
  return <div className="space-y-2.5 px-4 pb-3 pt-1">{children}</div>
}

export function TooltipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#5c7a99] mb-0.5">
        {label}
      </span>
      <div className="text-xs text-[#b8c8dc] leading-relaxed">{children}</div>
    </div>
  )
}

export function TooltipBenchmark({ value }: { value: string }) {
  return (
    <div className="mt-2 flex items-start gap-1.5 rounded bg-[#0a1628] px-3 py-2 border border-[#1e3a5f]">
      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
      <span className="text-[11px] text-[#7ab8d4] leading-relaxed">
        <span className="font-semibold text-[#a0cce8]">Benchmark: </span>
        {value}
      </span>
    </div>
  )
}
