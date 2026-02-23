export type StrategyType = 'buy_and_hold' | 'dca' | 'ma_crossover'

export type DCAInterval = 'weekly' | 'monthly' | 'quarterly'

export interface BuyAndHoldParams {
  // No additional params
}

export interface DCAParams {
  interval: DCAInterval
  amount: number
}

export interface MACrossoverParams {
  short_window: number
  long_window: number
}

export type StrategyParams = BuyAndHoldParams | DCAParams | MACrossoverParams

export interface BacktestRequest {
  symbol: string
  date_from: string
  date_to: string
  initial_capital: number
  strategy: StrategyType
  strategy_params: StrategyParams | null
}

export interface EquityPoint {
  date: string   // YYYY-MM-DD
  value: number  // Portfolio USD value
}

export interface TradeRecord {
  date: string
  action: 'BUY' | 'SELL'
  price: number
  shares: number
  cash_after: number
  portfolio_value: number
}

export interface PerformanceMetrics {
  total_return: number        // e.g. 0.42 = 42%
  cagr: number
  sharpe_ratio: number
  max_drawdown: number        // negative, e.g. -0.32
  volatility: number
  win_rate: number | null
  profit_factor: number | null
  time_in_market: number
}

export interface BacktestResponse {
  symbol: string
  security_name?: string | null
  strategy: string
  date_from: string
  date_to: string
  initial_capital: number
  total_invested: number
  final_value: number
  equity_curve: EquityPoint[]
  metrics: PerformanceMetrics
  trades: TradeRecord[]
}

export interface SymbolDateRange {
  symbol: string
  min_date: string
  max_date: string
  data_points: number
}

export interface StrategyOption {
  type: StrategyType
  label: string
  description: string
}

export const STRATEGY_OPTIONS: StrategyOption[] = [
  {
    type: 'buy_and_hold',
    label: 'Buy & Hold',
    description: 'Deploy full capital at start. No rebalancing.',
  },
  {
    type: 'dca',
    label: 'Dollar-Cost Averaging',
    description: 'Invest a fixed amount at regular intervals.',
  },
  {
    type: 'ma_crossover',
    label: 'MA Crossover',
    description: 'Trade on golden cross / death cross signals.',
  },
]

export const DCA_INTERVAL_OPTIONS: { value: DCAInterval; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
]

export const DEFAULT_DCA_PARAMS: DCAParams = {
  interval: 'monthly',
  amount: 500,
}

export const DEFAULT_MA_PARAMS: MACrossoverParams = {
  short_window: 50,
  long_window: 200,
}

// ── Compare types ────────────────────────────────────────────────────────────

export interface StrategyConfig {
  strategy: StrategyType
  strategy_params: StrategyParams | null
}

export interface CompareRequest {
  symbol: string
  date_from: string
  date_to: string
  initial_capital: number
  strategies: StrategyConfig[]
}

export interface CompareResponse {
  symbol: string
  security_name?: string | null
  date_from: string
  date_to: string
  initial_capital: number
  results: BacktestResponse[]
}

/** Per-strategy palette used across all compare charts and tables */
export const STRATEGY_COLORS: Record<StrategyType, string> = {
  buy_and_hold: '#06b6d4',   // cyan
  dca: '#f59e0b',            // amber
  ma_crossover: '#a78bfa',   // violet
}
