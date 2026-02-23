import { useState, useCallback, useEffect, useMemo } from 'react'
import { api } from '@/services/api'
import type {
  StrategyType,
  DCAParams,
  MACrossoverParams,
  CompareRequest,
  CompareResponse,
  SymbolDateRange,
  StrategyConfig,
} from '@/types/backtest'
import { DEFAULT_DCA_PARAMS, DEFAULT_MA_PARAMS } from '@/types/backtest'

export type SelectedStrategies = Set<StrategyType>

export interface UseCompareConfigReturn {
  // Symbol
  symbol: string | undefined
  setSymbol: (symbol: string | undefined) => void

  // Date range
  dateFrom: string
  dateTo: string
  setDateFrom: (date: string) => void
  setDateTo: (date: string) => void
  dateRange: SymbolDateRange | null
  dateRangeLoading: boolean

  // Capital (shared across all strategies)
  initialCapital: number
  setInitialCapital: (capital: number) => void

  // Strategy selection
  selectedStrategies: SelectedStrategies
  toggleStrategy: (strategy: StrategyType) => void

  // Per-strategy params
  dcaParams: DCAParams
  setDCAParams: (params: DCAParams) => void
  maParams: MACrossoverParams
  setMAParams: (params: MACrossoverParams) => void

  // Validation
  isValid: boolean
  validationErrors: string[]

  // Submission
  isSubmitting: boolean
  submitError: string | null
  submitResult: CompareResponse | null
  submit: () => Promise<void>
}

export function useCompareConfig(): UseCompareConfigReturn {
  // Symbol
  const [symbol, setSymbol] = useState<string | undefined>(undefined)

  // Date range
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dateRange, setDateRange] = useState<SymbolDateRange | null>(null)
  const [dateRangeLoading, setDateRangeLoading] = useState(false)

  // Capital
  const [initialCapital, setInitialCapital] = useState(10000)

  // Strategies to compare (default: select all 3)
  const [selectedStrategies, setSelectedStrategies] = useState<SelectedStrategies>(
    new Set<StrategyType>(['buy_and_hold', 'dca', 'ma_crossover'])
  )

  const toggleStrategy = useCallback((strategy: StrategyType) => {
    setSelectedStrategies((prev) => {
      const next = new Set(prev)
      if (next.has(strategy)) {
        next.delete(strategy)
      } else {
        next.add(strategy)
      }
      return next
    })
  }, [])

  // Per-strategy params
  const [dcaParams, setDCAParams] = useState<DCAParams>(DEFAULT_DCA_PARAMS)
  const [maParams, setMAParams] = useState<MACrossoverParams>(DEFAULT_MA_PARAMS)

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitResult, setSubmitResult] = useState<CompareResponse | null>(null)

  // Auto-fetch date range on symbol change
  useEffect(() => {
    if (!symbol) {
      setDateRange(null)
      setDateFrom('')
      setDateTo('')
      return
    }
    let cancelled = false
    setDateRangeLoading(true)
    api
      .getSymbolDateRange(symbol)
      .then((range) => {
        if (cancelled) return
        setDateRange(range)
        setDateFrom(range.min_date)
        setDateTo(range.max_date)
      })
      .catch(() => {
        if (cancelled) return
        setDateRange(null)
      })
      .finally(() => {
        if (!cancelled) setDateRangeLoading(false)
      })
    return () => { cancelled = true }
  }, [symbol])

  // Reset results when config changes
  useEffect(() => {
    setSubmitResult(null)
    setSubmitError(null)
  }, [symbol, dateFrom, dateTo, initialCapital, selectedStrategies, dcaParams, maParams])

  // Build ordered strategy config list (preserve insertion order via STRATEGY_ORDER)
  const STRATEGY_ORDER: StrategyType[] = ['buy_and_hold', 'dca', 'ma_crossover']
  const strategyConfigs = useMemo((): StrategyConfig[] =>
    STRATEGY_ORDER
      .filter((s) => selectedStrategies.has(s))
      .map((s): StrategyConfig => {
        if (s === 'dca') return { strategy: s, strategy_params: dcaParams }
        if (s === 'ma_crossover') return { strategy: s, strategy_params: maParams }
        return { strategy: s, strategy_params: null }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedStrategies, dcaParams, maParams]
  )

  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = []
    if (!symbol) errors.push('Select a symbol.')
    if (!dateFrom) errors.push('Set a start date.')
    if (!dateTo) errors.push('Set an end date.')
    if (dateFrom && dateTo && dateFrom >= dateTo) errors.push('Start date must be before end date.')
    if (initialCapital <= 0) errors.push('Initial capital must be greater than 0.')
    if (selectedStrategies.size < 2) errors.push('Select at least 2 strategies to compare.')
    if (selectedStrategies.has('dca') && dcaParams.amount <= 0)
      errors.push('DCA amount must be greater than 0.')
    if (selectedStrategies.has('ma_crossover') && maParams.short_window >= maParams.long_window)
      errors.push('MA short window must be less than long window.')
    return errors
  }, [symbol, dateFrom, dateTo, initialCapital, selectedStrategies, dcaParams, maParams])

  const isValid = validationErrors.length === 0

  const submit = useCallback(async () => {
    if (!isValid || !symbol) return
    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitResult(null)

    const request: CompareRequest = {
      symbol,
      date_from: dateFrom,
      date_to: dateTo,
      initial_capital: initialCapital,
      strategies: strategyConfigs,
    }

    try {
      const result = await api.compareBacktest(request)
      setSubmitResult(result)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Comparison failed')
    } finally {
      setIsSubmitting(false)
    }
  }, [isValid, symbol, dateFrom, dateTo, initialCapital, strategyConfigs])

  return {
    symbol, setSymbol,
    dateFrom, dateTo, setDateFrom, setDateTo,
    dateRange, dateRangeLoading,
    initialCapital, setInitialCapital,
    selectedStrategies, toggleStrategy,
    dcaParams, setDCAParams,
    maParams, setMAParams,
    isValid, validationErrors,
    isSubmitting, submitError, submitResult,
    submit,
  }
}
