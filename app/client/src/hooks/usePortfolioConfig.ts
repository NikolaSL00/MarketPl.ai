import { useState, useCallback, useEffect, useMemo } from 'react'
import { api } from '@/services/api'
import type {
  StrategyType,
  DCAParams,
  MACrossoverParams,
  RSIParams,
  BollingerBandsParams,
  StrategyParams,
  PortfolioHolding,
  PortfolioBacktestRequest,
  PortfolioBacktestResponse,
  RebalanceInterval,
  SymbolDateRange,
} from '@/types/backtest'
import {
  DEFAULT_DCA_PARAMS,
  DEFAULT_MA_PARAMS,
  DEFAULT_RSI_PARAMS,
  DEFAULT_BB_PARAMS,
} from '@/types/backtest'

export interface UsePortfolioConfigReturn {
  // Holdings
  holdings: PortfolioHolding[]
  addHolding: () => void
  removeHolding: (index: number) => void
  updateHoldingSymbol: (index: number, symbol: string) => void
  updateHoldingWeight: (index: number, weight: number) => void
  distributeEvenly: () => void
  weightSum: number

  // Date range (intersection of all symbols)
  dateFrom: string
  dateTo: string
  setDateFrom: (date: string) => void
  setDateTo: (date: string) => void
  intersectionRange: { min: string; max: string } | null
  dateRangeLoading: boolean

  // Capital
  initialCapital: number
  setInitialCapital: (capital: number) => void

  // Strategy
  strategy: StrategyType
  setStrategy: (strategy: StrategyType) => void
  dcaParams: DCAParams
  setDCAParams: (params: DCAParams) => void
  maParams: MACrossoverParams
  setMAParams: (params: MACrossoverParams) => void
  rsiParams: RSIParams
  setRSIParams: (params: RSIParams) => void
  bbParams: BollingerBandsParams
  setBBParams: (params: BollingerBandsParams) => void

  // Rebalancing
  rebalance: boolean
  setRebalance: (v: boolean) => void
  rebalanceInterval: RebalanceInterval
  setRebalanceInterval: (v: RebalanceInterval) => void

  // Validation
  isValid: boolean
  validationErrors: string[]

  // Submission
  isSubmitting: boolean
  submitError: string | null
  submitResult: PortfolioBacktestResponse | null
  submit: () => Promise<void>
}

export function usePortfolioConfig(): UsePortfolioConfigReturn {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([
    { symbol: '', weight: 0.5 },
    { symbol: '', weight: 0.5 },
  ])

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [intersectionRange, setIntersectionRange] = useState<{ min: string; max: string } | null>(null)
  const [dateRangeLoading, setDateRangeLoading] = useState(false)

  const [initialCapital, setInitialCapital] = useState(10000)

  const [strategy, setStrategy] = useState<StrategyType>('buy_and_hold')
  const [dcaParams, setDCAParams] = useState<DCAParams>(DEFAULT_DCA_PARAMS)
  const [maParams, setMAParams] = useState<MACrossoverParams>(DEFAULT_MA_PARAMS)
  const [rsiParams, setRSIParams] = useState<RSIParams>(DEFAULT_RSI_PARAMS)
  const [bbParams, setBBParams] = useState<BollingerBandsParams>(DEFAULT_BB_PARAMS)

  const [rebalance, setRebalance] = useState(false)
  const [rebalanceInterval, setRebalanceInterval] = useState<RebalanceInterval>('monthly')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitResult, setSubmitResult] = useState<PortfolioBacktestResponse | null>(null)

  // Holdings management
  const addHolding = useCallback(() => {
    setHoldings((prev) => {
      if (prev.length >= 5) return prev
      const newWeight = parseFloat((1 / (prev.length + 1)).toFixed(4))
      const existing = prev.map((h) => ({ ...h, weight: newWeight }))
      return [...existing, { symbol: '', weight: newWeight }]
    })
  }, [])

  const removeHolding = useCallback((index: number) => {
    setHoldings((prev) => {
      if (prev.length <= 2) return prev
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const updateHoldingSymbol = useCallback((index: number, symbol: string) => {
    setHoldings((prev) => prev.map((h, i) => i === index ? { ...h, symbol } : h))
  }, [])

  const updateHoldingWeight = useCallback((index: number, weight: number) => {
    setHoldings((prev) => prev.map((h, i) => i === index ? { ...h, weight } : h))
  }, [])

  const distributeEvenly = useCallback(() => {
    setHoldings((prev) => {
      const w = parseFloat((1 / prev.length).toFixed(4))
      return prev.map((h, i) => ({
        ...h,
        weight: i === prev.length - 1
          ? parseFloat((1 - w * (prev.length - 1)).toFixed(4))
          : w,
      }))
    })
  }, [])

  const weightSum = useMemo(
    () => parseFloat(holdings.reduce((s, h) => s + h.weight, 0).toFixed(4)),
    [holdings]
  )

  // Auto-fetch date intersection when symbols change
  const resolvedSymbols = useMemo(
    () => holdings.map((h) => h.symbol.trim().toUpperCase()).filter(Boolean),
    [holdings]
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (resolvedSymbols.length === 0) {
      setIntersectionRange(null)
      return
    }
    let cancelled = false
    setDateRangeLoading(true)

    Promise.all(resolvedSymbols.map((sym) => api.getSymbolDateRange(sym).catch(() => null)))
      .then((ranges) => {
        if (cancelled) return
        const valid = ranges.filter((r): r is SymbolDateRange => r !== null)
        if (valid.length !== resolvedSymbols.length) {
          setIntersectionRange(null)
          setDateRangeLoading(false)
          return
        }
        // Intersection: max of min_dates, min of max_dates
        const minDate = valid.reduce((acc, r) => r.min_date > acc ? r.min_date : acc, valid[0].min_date)
        const maxDate = valid.reduce((acc, r) => r.max_date < acc ? r.max_date : acc, valid[0].max_date)
        if (minDate >= maxDate) {
          setIntersectionRange(null)
        } else {
          setIntersectionRange({ min: minDate, max: maxDate })
          setDateFrom(minDate)
          setDateTo(maxDate)
        }
        setDateRangeLoading(false)
      })
      .catch(() => {
        if (!cancelled) setDateRangeLoading(false)
      })

    return () => { cancelled = true }
  }, [resolvedSymbols.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  // Reset result when inputs change
  useEffect(() => {
    setSubmitResult(null)
    setSubmitError(null)
  }, [holdings, dateFrom, dateTo, initialCapital, strategy, rebalance, rebalanceInterval,
      dcaParams, maParams, rsiParams, bbParams])

  // Build strategy params for submission
  const currentStrategyParams = useMemo((): StrategyParams | null => {
    switch (strategy) {
      case 'dca': return dcaParams
      case 'ma_crossover': return maParams
      case 'rsi': return rsiParams
      case 'bollinger_bands': return bbParams
      default: return null
    }
  }, [strategy, dcaParams, maParams, rsiParams, bbParams])

  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = []
    const filledHoldings = holdings.filter((h) => h.symbol.trim())
    if (filledHoldings.length < 2) errors.push('Add at least 2 symbols.')
    if (holdings.some((h) => !h.symbol.trim())) errors.push('All holding symbols must be filled.')
    const symbols = holdings.map((h) => h.symbol.trim().toUpperCase())
    if (new Set(symbols).size !== symbols.length && symbols.every(Boolean)) errors.push('Duplicate symbols are not allowed.')
    if (Math.abs(weightSum - 1.0) > 0.01) errors.push(`Weights must sum to 100% (currently ${(weightSum * 100).toFixed(1)}%).`)
    if (!dateFrom) errors.push('Set a start date.')
    if (!dateTo) errors.push('Set an end date.')
    if (dateFrom && dateTo && dateFrom >= dateTo) errors.push('Start date must be before end date.')
    if (initialCapital <= 0) errors.push('Initial capital must be greater than 0.')
    if (rebalance && !rebalanceInterval) errors.push('Select a rebalance interval.')
    if (strategy === 'ma_crossover' && maParams.short_window >= maParams.long_window)
      errors.push('MA short window must be less than long window.')
    if (strategy === 'rsi' && rsiParams.oversold >= rsiParams.overbought)
      errors.push('RSI oversold must be below overbought threshold.')
    return errors
  }, [holdings, weightSum, dateFrom, dateTo, initialCapital, strategy, rebalance, rebalanceInterval,
      maParams, rsiParams])

  const isValid = validationErrors.length === 0

  const submit = useCallback(async () => {
    if (!isValid) return
    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitResult(null)

    const payload: PortfolioBacktestRequest = {
      holdings: holdings.map((h) => ({ symbol: h.symbol.trim().toUpperCase(), weight: h.weight })),
      date_from: dateFrom,
      date_to: dateTo,
      initial_capital: initialCapital,
      strategy,
      strategy_params: currentStrategyParams,
      rebalance,
      rebalance_interval: rebalance ? rebalanceInterval : null,
    }

    try {
      const result = await api.runPortfolioBacktest(payload)
      setSubmitResult(result)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Portfolio backtest failed')
    } finally {
      setIsSubmitting(false)
    }
  }, [isValid, holdings, dateFrom, dateTo, initialCapital, strategy, currentStrategyParams,
      rebalance, rebalanceInterval])

  return {
    holdings,
    addHolding,
    removeHolding,
    updateHoldingSymbol,
    updateHoldingWeight,
    distributeEvenly,
    weightSum,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    intersectionRange,
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
    rebalance,
    setRebalance,
    rebalanceInterval,
    setRebalanceInterval,
    isValid,
    validationErrors,
    isSubmitting,
    submitError,
    submitResult,
    submit,
  }
}
