export interface StockPrice {
  symbol: string
  security_name: string
  date: string
  open: number
  high: number
  low: number
  close: number
  adj_close: number
  volume: number
}

export interface StockPricePageResponse {
  data: StockPrice[]
  total: number
  skip: number
  limit: number
}

export interface SymbolInfo {
  symbol: string
  security_name: string
  count: number
}

export interface SymbolListResponse {
  symbols: SymbolInfo[]
}
