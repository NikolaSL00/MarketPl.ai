export type StrategyType = 'buy_and_hold' | 'dca' | 'ma_crossover' | 'rsi' | 'bollinger_bands'

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

export interface RSIParams {
  rsi_period: number
  oversold: number
  overbought: number
}

export interface BollingerBandsParams {
  bb_window: number
  bb_std: number
}

export type StrategyParams = BuyAndHoldParams | DCAParams | MACrossoverParams | RSIParams | BollingerBandsParams

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
  calmar_ratio: number        // CAGR / |max_drawdown|
  best_year: number | null    // highest single-year return
  worst_year: number | null   // lowest single-year return
  recovery_days: number | null // days from trough to full recovery
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
  {
    type: 'rsi',
    label: 'RSI Mean Reversion',
    description: 'Buy oversold (RSI < 30), sell overbought (RSI > 70).',
  },
  {
    type: 'bollinger_bands',
    label: 'Bollinger Bands',
    description: 'Buy below lower band, sell above upper band.',
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

export const DEFAULT_RSI_PARAMS: RSIParams = {
  rsi_period: 14,
  oversold: 30,
  overbought: 70,
}

export const DEFAULT_BB_PARAMS: BollingerBandsParams = {
  bb_window: 20,
  bb_std: 2.0,
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
  buy_and_hold: '#06b6d4',    // cyan
  dca: '#f59e0b',             // amber
  ma_crossover: '#a78bfa',    // violet
  rsi: '#10b981',             // emerald
  bollinger_bands: '#f43f5e', // rose
}

// ── Portfolio types ──────────────────────────────────────────────────────────

export type RebalanceInterval = 'monthly' | 'quarterly'

export interface PortfolioHolding {
  symbol: string
  weight: number  // 0.0–1.0 fraction
}

export interface PortfolioBacktestRequest {
  holdings: PortfolioHolding[]
  date_from: string
  date_to: string
  initial_capital: number
  strategy: StrategyType
  strategy_params: StrategyParams | null
  rebalance: boolean
  rebalance_interval: RebalanceInterval | null
}

export interface PortfolioHoldingResult {
  symbol: string
  security_name?: string | null
  weight: number
  allocated_capital: number
  final_value: number
  total_invested: number
  equity_curve: EquityPoint[]
  metrics: PerformanceMetrics
}

export interface PortfolioBacktestResponse {
  date_from: string
  date_to: string
  initial_capital: number
  strategy: string
  rebalance: boolean
  rebalance_interval: RebalanceInterval | null
  portfolio_equity_curve: EquityPoint[]
  portfolio_metrics: PerformanceMetrics
  portfolio_final_value: number
  portfolio_total_invested: number
  holdings: PortfolioHoldingResult[]
}

/** 5-color palette for portfolio holdings charts */
export const PORTFOLIO_HOLDING_COLORS: string[] = [
  '#06b6d4',  // cyan
  '#f59e0b',  // amber
  '#a78bfa',  // violet
  '#10b981',  // emerald
  '#f43f5e',  // rose
]
