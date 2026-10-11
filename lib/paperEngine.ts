import { MarketDirection, PaperAccount, PaperOrder, PaperPosition, QuantSignal, StrategyConfig } from './types';

const ACCOUNT_KEY = 'perp_paper_account_v3';
const POSITIONS_KEY = 'perp_paper_positions_v3';
const ORDERS_KEY = 'perp_paper_orders_v3';

export const DEFAULT_INITIAL_EQUITY = 10000;

export class PaperTradingEngine {
  private account: PaperAccount;
  private positions: PaperPosition[] = [];
  private orders: PaperOrder[] = [];
  private listeners: Array<() => void> = [];
  private orderFillCallbacks: Array<(order: PaperOrder) => void> = [];

  constructor() {
    this.account = this.loadAccount();
    this.positions = this.loadPositions();
    this.orders = this.loadOrders();
    this.recalculateAccountEquity();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public onOrderFill(callback: (order: PaperOrder) => void): () => void {
    this.orderFillCallbacks.push(callback);
    return () => {
      this.orderFillCallbacks = this.orderFillCallbacks.filter(c => c !== callback);
    };
  }

  private notify() {
    this.save();
    for (const l of this.listeners) {
      try { l(); } catch (e) { console.error(e); }
    }
  }

  private notifyOrderFill(order: PaperOrder) {
    for (const c of this.orderFillCallbacks) {
      try { c(order); } catch (e) { console.error(e); }
    }
  }

  private loadAccount(): PaperAccount {
    try {
      const stored = localStorage.getItem(ACCOUNT_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return {
      balance: DEFAULT_INITIAL_EQUITY,
      equity: DEFAULT_INITIAL_EQUITY,
      initialEquity: DEFAULT_INITIAL_EQUITY,
      usedMargin: 0,
      freeMargin: DEFAULT_INITIAL_EQUITY,
      realizedPnl: 0,
      unrealizedPnl: 0,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      profitFactor: 0,
      mode: 'FLAT'
    };
  }

  private loadPositions(): PaperPosition[] {
    try {
      const stored = localStorage.getItem(POSITIONS_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  }

  private loadOrders(): PaperOrder[] {
    try {
      const stored = localStorage.getItem(ORDERS_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  }

  private save() {
    try {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(this.account));
      localStorage.setItem(POSITIONS_KEY, JSON.stringify(this.positions));
      localStorage.setItem(ORDERS_KEY, JSON.stringify(this.orders.slice(0, 300))); // keep latest 300 orders
    } catch (e) {}
  }

  public getAccount(): PaperAccount {
    return { ...this.account };
  }

  public getPositions(): PaperPosition[] {
    return [...this.positions];
  }

  public getOrders(): PaperOrder[] {
    return [...this.orders];
  }

  public resetAccount(startingCapital: number = DEFAULT_INITIAL_EQUITY) {
    this.account = {
      balance: startingCapital,
      equity: startingCapital,
      initialEquity: startingCapital,
      usedMargin: 0,
      freeMargin: startingCapital,
      realizedPnl: 0,
      unrealizedPnl: 0,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      profitFactor: 0,
      mode: 'FLAT'
    };
    this.positions = [];
    this.orders = [];
    this.notify();
  }

  public setMode(mode: 'FLAT' | 'COMPOUND') {
    this.account.mode = mode;
    this.notify();
  }

  /**
   * Executes and Fills a simulated paper order
   */
  public openPosition(
    symbol: string,
    direction: MarketDirection,
    price: number,
    marginAmount: number,
    leverage: number,
    slPrice: number,
    tp1Price: number,
    tp2Price: number,
    tp3Price: number,
    reason: string = 'MANUAL'
  ): PaperOrder | null {
    // Check available free margin
    if (this.account.freeMargin < marginAmount || marginAmount <= 0) {
      return null;
    }

    const slippagePct = 0.0002; // 2 bps (0.02%) simulated slippage
    const isLong = direction === 'LONG';
    const fillPrice = isLong ? price * (1 + slippagePct) : price * (1 - slippagePct);
    const notionalSize = marginAmount * leverage;
    const quantity = notionalSize / fillPrice;

    // Commission: 0.02% maker/taker
    const fee = notionalSize * 0.0002;

    this.account.balance -= fee;
    this.account.usedMargin += marginAmount;
    this.account.freeMargin = this.account.balance - this.account.usedMargin;

    // Liquidation price calculation (approximate for isolated margin)
    const liqDistance = (fillPrice * (1 / leverage)) * 0.95;
    const liquidationPrice = isLong ? Math.max(0, fillPrice - liqDistance) : fillPrice + liqDistance;

    const positionId = `POS-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const newPosition: PaperPosition = {
      id: positionId,
      symbol,
      direction,
      entryPrice: fillPrice,
      currentPrice: fillPrice,
      size: notionalSize,
      quantity,
      margin: marginAmount,
      leverage,
      slPrice,
      tp1Price,
      tp2Price,
      tp3Price,
      tp1Hit: false,
      tp2Hit: false,
      unrealizedPnl: 0,
      roePct: 0,
      liquidationPrice,
      openedAt: Date.now(),
      strategyOrigin: reason,
      fundingAccrued: 0
    };

    const orderId = `ORD-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const order: PaperOrder = {
      id: orderId,
      positionId,
      symbol,
      type: 'MARKET_ENTRY',
      direction,
      fillPrice,
      requestedPrice: price,
      slippagePct: slippagePct * 100,
      size: notionalSize,
      margin: marginAmount,
      leverage,
      status: 'FILLED',
      executionTime: Date.now(),
      grossPnl: 0,
      netPnl: -fee,
      fee,
      fundingPnl: 0,
      notes: `Filled ${direction} @ ${fillPrice.toFixed(4)} · ${leverage}x isolated margin`,
      equityAfter: this.account.equity - fee
    };

    this.positions.unshift(newPosition);
    this.orders.unshift(order);

    this.recalculateAccountEquity();
    this.notify();
    this.notifyOrderFill(order);

    return order;
  }

  /**
   * Evaluates open positions against incoming market price / candle tick
   * Automatically executes TP1, TP2, TP3 partial scale-outs, and Stop-Loss fills!
   */
  public updatePositionsWithTick(
    symbol: string,
    currentPrice: number,
    highPrice: number,
    lowPrice: number,
    fundingRate: number = 0
  ) {
    let changed = false;
    const positionsToRemove: string[] = [];

    for (const pos of this.positions) {
      if (pos.symbol !== symbol) continue;

      pos.currentPrice = currentPrice;
      const isLong = pos.direction === 'LONG';

      // Accrue small funding fee every tick if applicable
      const hoursSinceOpen = (Date.now() - pos.openedAt) / 3600000;
      pos.fundingAccrued = -pos.size * fundingRate * (hoursSinceOpen / 8) * (isLong ? 1 : -1);

      // Unrealized PnL calculation
      const priceDeltaPct = isLong
        ? (currentPrice - pos.entryPrice) / pos.entryPrice
        : (pos.entryPrice - currentPrice) / pos.entryPrice;

      pos.unrealizedPnl = (pos.size * priceDeltaPct) + pos.fundingAccrued;
      pos.roePct = (pos.unrealizedPnl / pos.margin) * 100;
      changed = true;

      // 1. Check Stop Loss trigger
      const hitSL = isLong ? lowPrice <= pos.slPrice : highPrice >= pos.slPrice;
      if (hitSL) {
        this.executeStopLoss(pos, pos.slPrice);
        positionsToRemove.push(pos.id);
        continue;
      }

      // 2. Check TP1 trigger (scale out 33%)
      const hitTP1 = isLong ? highPrice >= pos.tp1Price : lowPrice <= pos.tp1Price;
      if (hitTP1 && !pos.tp1Hit) {
        this.executePartialTP(pos, 1, pos.tp1Price);
        pos.tp1Hit = true;
        // Trail stop to breakeven after TP1 hit to guarantee profit preservation
        pos.slPrice = pos.entryPrice;
        changed = true;
      }

      // 3. Check TP2 trigger (scale out 33%)
      const hitTP2 = isLong ? highPrice >= pos.tp2Price : lowPrice <= pos.tp2Price;
      if (hitTP2 && !pos.tp2Hit) {
        this.executePartialTP(pos, 2, pos.tp2Price);
        pos.tp2Hit = true;
        changed = true;
      }

      // 4. Check TP3 trigger (final 34% close)
      const hitTP3 = isLong ? highPrice >= pos.tp3Price : lowPrice <= pos.tp3Price;
      if (hitTP3) {
        this.executeFinalTP(pos, pos.tp3Price);
        positionsToRemove.push(pos.id);
        continue;
      }
    }

    if (positionsToRemove.length > 0) {
      this.positions = this.positions.filter(p => !positionsToRemove.includes(p.id));
      changed = true;
    }

    if (changed) {
      this.recalculateAccountEquity();
      this.notify();
    }
  }

  private executePartialTP(pos: PaperPosition, tpNum: 1 | 2, exitPrice: number) {
    const isLong = pos.direction === 'LONG';
    const portionFraction = 0.33; // 33%
    const closedSize = pos.size * portionFraction;
    const closedMargin = pos.margin * portionFraction;

    const movePct = isLong
      ? (exitPrice - pos.entryPrice) / pos.entryPrice
      : (pos.entryPrice - exitPrice) / pos.entryPrice;

    const gross = closedSize * movePct;
    const fee = closedSize * 0.0002;
    const net = gross - fee;

    // Release margin and add net profit to balance
    this.account.balance += (closedMargin + net);
    this.account.usedMargin -= closedMargin;
    this.account.realizedPnl += net;

    // Reduce position size and margin remaining
    pos.size -= closedSize;
    pos.margin -= closedMargin;

    const orderId = `ORD-TP${tpNum}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const order: PaperOrder = {
      id: orderId,
      positionId: pos.id,
      symbol: pos.symbol,
      type: tpNum === 1 ? 'TP1_PARTIAL' : 'TP2_PARTIAL',
      direction: isLong ? 'SHORT' : 'LONG', // Exit direction
      fillPrice: exitPrice,
      requestedPrice: exitPrice,
      slippagePct: 0,
      size: closedSize,
      margin: closedMargin,
      leverage: pos.leverage,
      status: tpNum === 1 ? 'PARTIAL_TP1' : 'PARTIAL_TP2',
      executionTime: Date.now(),
      grossPnl: gross,
      netPnl: net,
      fee,
      fundingPnl: 0,
      notes: `Hit Take-Profit ${tpNum} · Scaled out 33% @ ${exitPrice.toFixed(4)} (+${(movePct * 100).toFixed(2)}%)`,
      equityAfter: this.account.balance
    };

    this.orders.unshift(order);
    this.notifyOrderFill(order);
  }

  private executeFinalTP(pos: PaperPosition, exitPrice: number) {
    const isLong = pos.direction === 'LONG';
    const movePct = isLong
      ? (exitPrice - pos.entryPrice) / pos.entryPrice
      : (pos.entryPrice - exitPrice) / pos.entryPrice;

    const gross = pos.size * movePct;
    const fee = pos.size * 0.0002;
    const net = gross + pos.fundingAccrued - fee;

    this.account.balance += (pos.margin + net);
    this.account.usedMargin -= pos.margin;
    this.account.realizedPnl += net;

    const orderId = `ORD-TP3-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const order: PaperOrder = {
      id: orderId,
      positionId: pos.id,
      symbol: pos.symbol,
      type: 'TP3_FINAL',
      direction: isLong ? 'SHORT' : 'LONG',
      fillPrice: exitPrice,
      requestedPrice: exitPrice,
      slippagePct: 0,
      size: pos.size,
      margin: pos.margin,
      leverage: pos.leverage,
      status: 'CLOSED_FULL',
      executionTime: Date.now(),
      grossPnl: gross,
      netPnl: net,
      fee,
      fundingPnl: pos.fundingAccrued,
      notes: `Hit Take-Profit 3 Target! Fully closed @ ${exitPrice.toFixed(4)} (+${(movePct * 100).toFixed(2)}%)`,
      equityAfter: this.account.balance
    };

    this.orders.unshift(order);
    this.notifyOrderFill(order);
  }

  private executeStopLoss(pos: PaperPosition, exitPrice: number) {
    const isLong = pos.direction === 'LONG';
    const movePct = isLong
      ? (exitPrice - pos.entryPrice) / pos.entryPrice
      : (pos.entryPrice - exitPrice) / pos.entryPrice;

    const gross = pos.size * movePct;
    const fee = pos.size * 0.0002;
    const net = gross + pos.fundingAccrued - fee;

    this.account.balance += Math.max(0, pos.margin + net);
    this.account.usedMargin -= pos.margin;
    this.account.realizedPnl += net;

    const orderId = `ORD-SL-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const order: PaperOrder = {
      id: orderId,
      positionId: pos.id,
      symbol: pos.symbol,
      type: 'SL_EXIT',
      direction: isLong ? 'SHORT' : 'LONG',
      fillPrice: exitPrice,
      requestedPrice: exitPrice,
      slippagePct: 0,
      size: pos.size,
      margin: pos.margin,
      leverage: pos.leverage,
      status: 'STOPPED_OUT',
      executionTime: Date.now(),
      grossPnl: gross,
      netPnl: net,
      fee,
      fundingPnl: pos.fundingAccrued,
      notes: `Stop-Loss triggered @ ${exitPrice.toFixed(4)} (${(movePct * 100).toFixed(2)}%)`,
      equityAfter: this.account.balance
    };

    this.orders.unshift(order);
    this.notifyOrderFill(order);
  }

  public manualClose(positionId: string, currentPrice: number) {
    const pos = this.positions.find(p => p.id === positionId);
    if (!pos) return;

    const isLong = pos.direction === 'LONG';
    const movePct = isLong
      ? (currentPrice - pos.entryPrice) / pos.entryPrice
      : (pos.entryPrice - currentPrice) / pos.entryPrice;

    const gross = pos.size * movePct;
    const fee = pos.size * 0.0002;
    const net = gross + pos.fundingAccrued - fee;

    this.account.balance += Math.max(0, pos.margin + net);
    this.account.usedMargin -= pos.margin;
    this.account.realizedPnl += net;

    this.positions = this.positions.filter(p => p.id !== positionId);

    const orderId = `ORD-MC-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const order: PaperOrder = {
      id: orderId,
      positionId: pos.id,
      symbol: pos.symbol,
      type: 'MANUAL_CLOSE',
      direction: isLong ? 'SHORT' : 'LONG',
      fillPrice: currentPrice,
      requestedPrice: currentPrice,
      slippagePct: 0,
      size: pos.size,
      margin: pos.margin,
      leverage: pos.leverage,
      status: 'CLOSED_FULL',
      executionTime: Date.now(),
      grossPnl: gross,
      netPnl: net,
      fee,
      fundingPnl: pos.fundingAccrued,
      notes: `Manual Market Exit @ ${currentPrice.toFixed(4)} (${net >= 0 ? '+' : ''}$${net.toFixed(2)})`,
      equityAfter: this.account.balance
    };

    this.orders.unshift(order);
    this.recalculateAccountEquity();
    this.notify();
    this.notifyOrderFill(order);
  }

  /**
   * Called by the live scanner to auto-fill paper orders when high-conviction signals trigger
   */
  public handleSignalAutoTrade(signal: QuantSignal, config: StrategyConfig): boolean {
    if (!config.autoTradeEnabled) return false;
    if (signal.strengthScore < config.minScoreToExecute) return false;

    // Check if we already have an active position in this symbol
    const alreadyOpen = this.positions.some(p => p.symbol === signal.symbol);
    if (alreadyOpen) return false;

    let margin = config.defaultMargin;
    if (this.account.mode === 'COMPOUND') {
      margin = Math.max(50, this.account.equity * 0.05); // 5% compounding
    }

    if (this.account.freeMargin < margin) return false;

    const order = this.openPosition(
      signal.symbol,
      signal.direction,
      signal.entryPrice,
      margin,
      config.defaultLeverage,
      signal.slPrice,
      signal.tp1Price,
      signal.tp2Price,
      signal.tp3Price,
      `AUTO_${signal.strategyName}`
    );

    return !!order;
  }

  private recalculateAccountEquity() {
    let unpnl = 0;
    let usedMargin = 0;

    for (const pos of this.positions) {
      unpnl += pos.unrealizedPnl;
      usedMargin += pos.margin;
    }

    this.account.unrealizedPnl = unpnl;
    this.account.usedMargin = usedMargin;
    this.account.freeMargin = Math.max(0, this.account.balance - usedMargin);
    this.account.equity = this.account.balance + unpnl;

    // Win rate stats
    const closedOrders = this.orders.filter(o => o.type !== 'MARKET_ENTRY');
    const wins = closedOrders.filter(o => o.netPnl > 0).length;
    const losses = closedOrders.filter(o => o.netPnl <= 0).length;
    const total = closedOrders.length;

    this.account.totalTrades = total;
    this.account.wins = wins;
    this.account.losses = losses;
    this.account.winRate = total > 0 ? (wins / total) * 100 : 0;

    const winSum = closedOrders.filter(o => o.netPnl > 0).reduce((a, b) => a + b.netPnl, 0);
    const lossSum = Math.abs(closedOrders.filter(o => o.netPnl < 0).reduce((a, b) => a + b.netPnl, 0));
    this.account.profitFactor = lossSum > 0 ? winSum / lossSum : (winSum > 0 ? 99 : 0);
  }

  /**
   * Export all filled paper trades as CSV
   */
  public exportCsvLedger(): string {
    const headers = [
      'order_id',
      'execution_time_utc',
      'symbol',
      'type',
      'direction',
      'fill_price',
      'size_usdt',
      'margin_usdt',
      'leverage',
      'status',
      'gross_pnl',
      'fee_usdt',
      'funding_pnl',
      'net_pnl',
      'equity_after',
      'notes'
    ];

    const rows = this.orders.map(o => [
      o.id,
      new Date(o.executionTime).toISOString(),
      o.symbol,
      o.type,
      o.direction,
      o.fillPrice.toFixed(4),
      o.size.toFixed(2),
      o.margin.toFixed(2),
      `${o.leverage}x`,
      o.status,
      o.grossPnl.toFixed(2),
      o.fee.toFixed(4),
      o.fundingPnl.toFixed(4),
      o.netPnl.toFixed(2),
      o.equityAfter.toFixed(2),
      `"${o.notes.replaceAll('"', '""')}"`
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

// Global Singleton Instance
export const paperEngine = new PaperTradingEngine();
