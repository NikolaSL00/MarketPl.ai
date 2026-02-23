import { useState, useCallback, useEffect, useMemo } from 'react'
import { api } from '@/services/api'
import type {
  StrategyType,
  DCAParams,
  MACrossoverParams,
  StrategyParams,
  BacktestRequest,
  BacktestResponse,
  SymbolDateRange,
} from '@/types/backtest'
import { DEFAULT_DCA_PARAMS, DEFAULT_MA_PARAMS } from '@/types/backtest'

interface UseBacktestConfigReturn {
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

  // Validation
  isValid: boolean
  validationErrors: string[]

  // Submission
  isSubmitting: boolean
  submitError: string | null
  submitResult: BacktestResponse | null
  submit: () => Promise<void>
}

export function useBacktestConfig(): UseBacktestConfigReturn {
  // Symbol
  const [symbol, setSymbol] = useState<string | undefined>(undefined)

  // Date range
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dateRange, setDateRange] = useState<SymbolDateRange | null>(null)
  const [dateRangeLoading, setDateRangeLoading] = useState(false)

  // Capital
  const [initialCapital, setInitialCapital] = useState(10000)

  // Strategy
  const [strategy, setStrategy] = useState<StrategyType>('buy_and_hold')
  const [dcaParams, setDCAParams] = useState<DCAParams>(DEFAULT_DCA_PARAMS)
  const [maParams, setMAParams] = useState<MACrossoverParams>(DEFAULT_MA_PARAMS)

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitResult, setSubmitResult] = useState<BacktestResponse | null>(null)

  // Fetch date range when symbol changes
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

    return () => {
      cancelled = true
    }
  }, [symbol])

  // Build strategy params based on chosen strategy
  const currentStrategyParams = useMemo((): StrategyParams | null => {
    switch (strategy) {
      case 'buy_and_hold':
        return null
      case 'dca':
        return dcaParams
      case 'ma_crossover':
        return maParams
    }
  }, [strategy, dcaParams, maParams])

  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = []

    if (!symbol) errors.push('Select a symbol.')
    if (!dateFrom) errors.push('Set a start date.')
    if (!dateTo) errors.push('Set an end date.')
    if (dateFrom && dateTo && dateFrom >= dateTo) errors.push('Start date must be before end date.')
    if (strategy !== 'dca' && initialCapital <= 0) errors.push('Initial capital must be greater than 0.')

    if (strategy === 'dca') {
      if (dcaParams.amount <= 0) errors.push('DCA amount must be greater than 0.')
    }

    if (strategy === 'ma_crossover') {
      if (maParams.short_window >= maParams.long_window) {
        errors.push('Short window must be less than long window.')
      }
    }

    return errors
  }, [symbol, dateFrom, dateTo, initialCapital, strategy, dcaParams, maParams])

  const isValid = validationErrors.length === 0

  // Submit
  const submit = useCallback(async () => {
    if (!isValid || !symbol) return

    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitResult(null)

    const request: BacktestRequest = {
      symbol,
      date_from: dateFrom,
      date_to: dateTo,
      initial_capital: initialCapital,
      strategy,
      strategy_params: currentStrategyParams,
    }

    try {
      const result = await api.runBacktest(request)
      setSubmitResult(result)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Backtest failed')
    } finally {
      setIsSubmitting(false)
    }
  }, [isValid, symbol, dateFrom, dateTo, initialCapital, strategy, currentStrategyParams])

  return {
    symbol,
    setSymbol,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    dateRange,
    dateRangeLoading,
    initialCapital,
    setInitialCapital,
    strategy,
    setStrategy,
    dcaParams,
    setDCAParams,
    maParams,
    setMAParams,
    isValid,
    validationErrors,
    isSubmitting,
    submitError,
    submitResult,
    submit,
  }
}
