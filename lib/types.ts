export type MarketDirection = 'LONG' | 'SHORT';

export interface Candle {
  t: number; // timestamp
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
}

export interface Indicators {
  emaFast: number; // e.g. 10
  emaSlow: number; // e.g. 30
  ema200: number;
  atr: number;
  rsi: number;
  relVol: number; // volume / 20-period SMA * 100
  vwap?: number;
}

export interface OrderBlockInfo {
  id: string;
  top: number;
  bottom: number;
  obVolume: number;
  obHighVolume: number;
  obLowVolume: number;
  obType: 'Bull' | 'Bear';
  startTime: number;
  breaker: boolean;
  breakTime?: number;
}

export interface SignalMetrics {
  buyerStrength: number;
  sellerStrength: number;
  rsiBuyersStrength: 'Strong' | 'Weak';
  rsiSellersStrength: 'Strong' | 'Weak';
  relVolumePct: number;
  volumeStatus: 'High Volume' | 'Normal / Low';
  orderBlockNearby: boolean;
  atrValue: number;
}

export interface QuantSignal {
  id: string;
  symbol: string;
  direction: MarketDirection;
  timeframe: string;
  entryPrice: number;
  currentPrice: number;
  slPrice: number;
  tp1Price: number;
  tp2Price: number;
  tp3Price: number;
  strengthScore: number; // 0-100
  strategyName: 'ORDER_BLOCKS_EMA' | 'VWAP_EMA' | 'HYBRID_CONFLUENCE' | 'LEO_2_1';
  timestamp: number;
  metrics: SignalMetrics;
  orderBlocks?: OrderBlockInfo[];
}

export interface PaperPosition {
  id: string;
  symbol: string;
  direction: MarketDirection;
  entryPrice: number;
  currentPrice: number;
  size: number; // Notional position value in USDT
  quantity: number; // Base asset quantity
  margin: number; // Collateral allocated in USDT
  leverage: number;
  slPrice: number;
  tp1Price: number;
  tp2Price: number;
  tp3Price: number;
  tp1Hit: boolean;
  tp2Hit: boolean;
  unrealizedPnl: number;
  roePct: number;
  liquidationPrice: number;
  openedAt: number;
  strategyOrigin: string;
  fundingAccrued: number;
}

export type OrderStatus = 'FILLED' | 'PARTIAL_TP1' | 'PARTIAL_TP2' | 'CLOSED_FULL' | 'STOPPED_OUT' | 'CANCELLED';

export interface PaperOrder {
  id: string;
  positionId?: string;
  symbol: string;
  type: 'MARKET_ENTRY' | 'TP1_PARTIAL' | 'TP2_PARTIAL' | 'TP3_FINAL' | 'SL_EXIT' | 'MANUAL_CLOSE';
  direction: MarketDirection;
  fillPrice: number;
  requestedPrice: number;
  slippagePct: number;
  size: number; // USDT
  margin: number; // USDT
  leverage: number;
  status: OrderStatus;
  executionTime: number;
  grossPnl: number;
  netPnl: number;
  fee: number; // Commission (0.02%)
  fundingPnl: number;
  notes: string;
  equityAfter: number;
}

export interface PaperAccount {
  balance: number;
  equity: number;
  initialEquity: number;
  usedMargin: number;
  freeMargin: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  mode: 'FLAT' | 'COMPOUND';
}

export interface StrategyConfig {
  activeStrategy: 'ORDER_BLOCKS_EMA' | 'VWAP_EMA' | 'HYBRID_CONFLUENCE' | 'LEO_2_1';
  // EMA Cross & Order Blocks inputs (Pine Script v6)
  fastMA: number; // 10
  slowMA: number; // 30
  atrLength: number; // 14
  atrMultiplierSL: number; // 1.5
  tp1Multiplier: number; // 0.5
  tp2Multiplier: number; // 1.0
  tp3Multiplier: number; // 1.5
  tp1Pct: number; // 33%
  tp2Pct: number; // 33%
  useRSI: boolean; // false default
  rsiLength: number; // 14
  thresholdBuy: number; // 50
  thresholdSell: number; // 50
  useVol: boolean; // false default
  useOB: boolean; // false default
  obTolerance: number; // 0.5 * ATR
  swingLength: number; // 10
  // Paper Execution settings
  autoTradeEnabled: boolean;
  minScoreToExecute: number; // e.g. 75
  defaultMargin: number; // e.g. 100 USDT
  defaultLeverage: number; // e.g. 10x
  riskPerTradePct: number; // 1%
  slippageBps: number; // 2 bps (0.02%)
  commissionRatePct: number; // 0.02%
  // Scanner & Paper Execution timeframe
  scannerTimeframe: string; // '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d'
  soundEnabled: boolean;
}

export interface BacktestResult {
  symbol: string;
  timeframe: string;
  bars: number;
  trades: PaperOrder[];
  flatEquity: number;
  compoundEquity: number;
  winRate: number;
  profitFactor: number;
  maxDrawdownPct: number;
  tp1Hits: number;
  slHits: number;
  fundingTotal: number;
  avgTradePnl: number;
}
