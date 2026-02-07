import { BinanceFuturesFillRecord } from './binance-futures.types';
import { BinanceFuturesClosedPosition } from './binance-futures.positions';

export type FillGroup = {
  symbol: string;
  orderId: string;
  time: number;
  side: 'BUY' | 'SELL';
  positionSide?: string;

  qty: number;
  quoteQty?: number;
  vwapPrice: number;

  realizedPnl: number;
  fee: number;
  feeAsset?: string;

  tradeKeys: string[];
  fillCount: number;
};

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function groupFills(fills: BinanceFuturesFillRecord[]): FillGroup[] {
  const map = new Map<string, FillGroup>();

  for (const f of fills) {
    const symbol = String(f.symbol || '').trim();
    const orderId = String(f.orderId || '').trim();
    const time = Number(f.time);
    const side = String(f.side || '').toUpperCase();

    if (!symbol || !orderId || !Number.isFinite(time)) continue;
    if (side !== 'BUY' && side !== 'SELL') continue;

    const qty = toNum(f.qty);
    const price = toNum(f.price);
    if (!qty || !price) continue;

    const key = `${symbol}#${orderId}#${time}#${side}`;

    const g = map.get(key) || {
      symbol,
      orderId,
      time,
      side: side as 'BUY' | 'SELL',
      positionSide: f.positionSide,
      qty: 0,
      quoteQty: 0,
      vwapPrice: 0,
      realizedPnl: 0,
      fee: 0,
      feeAsset: f.commissionAsset,
      tradeKeys: [],
      fillCount: 0,
    };

    const quoteQty = f.raw?.quoteQty != null ? toNum(f.raw.quoteQty) : 0;

    // VWAP accumulate using qty
    const prevQty = g.qty;
    const nextQty = prevQty + qty;
    const prevSumPxQty = g.vwapPrice * prevQty;
    const nextSumPxQty = prevSumPxQty + price * qty;
    g.qty = nextQty;
    g.vwapPrice = nextQty > 0 ? nextSumPxQty / nextQty : price;

    g.quoteQty = (g.quoteQty || 0) + quoteQty;
    g.realizedPnl += toNum(f.realizedPnl);
    g.fee += toNum(f.commission);
    g.feeAsset = g.feeAsset || f.commissionAsset;
    if (f.tradeKey) g.tradeKeys.push(f.tradeKey);
    g.fillCount += 1;

    map.set(key, g);
  }

  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

export type BinanceFuturesOpenPosition = {
  symbol: string;
  positionSide: 'LONG' | 'SHORT';
  openTime: number;
  lastTime: number;
  openPrice: number;
  currentQty: number;
  maxOpenQty: number;
  realizedPnl: number;
  fees: number;
  feeAsset?: string;
  fillCount: number;
};

export type BuildPositionsV2Result = {
  closedPositions: BinanceFuturesClosedPosition[];
  openPositions: BinanceFuturesOpenPosition[];
  groups: number;
};

export function buildClosedPositionsV2(
  userId: string,
  fills: BinanceFuturesFillRecord[],
): BuildPositionsV2Result {
  const groups = groupFills(fills);

  type Session = {
    symbol: string;
    direction: 'LONG' | 'SHORT';
    openTime: number;
    closeTime: number;

    openQty: number;
    maxAbsQty: number;

    openSumPxQty: number;
    openSumQty: number;

    closeSumPxQty: number;
    closeSumQty: number;

    realizedPnl: number;
    fees: number;
    feeAsset?: string;
    fillCount: number;
  };

  const sessions = new Map<string, Session>(); // per symbol single session (one-way)
  const closedPositions: BinanceFuturesClosedPosition[] = [];

  const eps = 1e-12;
  const nowIso = new Date().toISOString();

  const ensureSession = (
    symbol: string,
    direction: 'LONG' | 'SHORT',
    time: number,
  ): Session => {
    const existing = sessions.get(symbol);
    if (existing) return existing;
    const s: Session = {
      symbol,
      direction,
      openTime: time,
      closeTime: time,
      openQty: 0,
      maxAbsQty: 0,
      openSumPxQty: 0,
      openSumQty: 0,
      closeSumPxQty: 0,
      closeSumQty: 0,
      realizedPnl: 0,
      fees: 0,
      feeAsset: undefined,
      fillCount: 0,
    };
    sessions.set(symbol, s);
    return s;
  };

  for (const g of groups) {
    const symbol = g.symbol;

    // In one-way mode, we derive direction by the first opening side.
    // BUY as opening => LONG, SELL as opening => SHORT.
    const current = sessions.get(symbol);
    const direction =
      current?.direction || (g.side === 'BUY' ? 'LONG' : 'SHORT');
    const s = ensureSession(symbol, direction, g.time);

    // Update close time
    s.closeTime = g.time;

    // Signed qty net for one-way
    const signedQty = g.side === 'BUY' ? g.qty : -g.qty;
    const prevQty = s.openQty;
    let nextQty = prevQty + signedQty;
    if (Math.abs(nextQty) < eps) nextQty = 0;

    // Determine if this group increases exposure or reduces (based on abs)
    const increased = Math.abs(nextQty) > Math.abs(prevQty);

    if (increased) {
      // opening/add
      s.openSumPxQty += g.vwapPrice * g.qty;
      s.openSumQty += g.qty;
    } else {
      // closing/reduce
      s.closeSumPxQty += g.vwapPrice * g.qty;
      s.closeSumQty += g.qty;
    }

    s.openQty = nextQty;
    s.maxAbsQty = Math.max(s.maxAbsQty, Math.abs(nextQty));
    s.realizedPnl += g.realizedPnl;
    s.fees += g.fee;
    s.feeAsset = s.feeAsset || g.feeAsset;
    s.fillCount += g.fillCount;

    // Close session when net returns to 0
    if (prevQty !== 0 && nextQty === 0) {
      const openPrice =
        s.openSumQty > 0 ? s.openSumPxQty / s.openSumQty : g.vwapPrice;
      const closePrice =
        s.closeSumQty > 0 ? s.closeSumPxQty / s.closeSumQty : g.vwapPrice;
      const closedQty = s.closeSumQty > 0 ? s.closeSumQty : s.maxAbsQty;

      const notional = s.maxAbsQty > 0 ? s.maxAbsQty * openPrice : 0;
      const pnlPercent = notional > 0 ? s.realizedPnl / notional : undefined;

      const positionKey = `${symbol}#${s.direction}#${s.openTime}`;

      closedPositions.push({
        userId,
        positionKey,
        symbol,
        positionSide: s.direction,
        openTime: s.openTime,
        closeTime: s.closeTime,
        openPrice,
        closePrice,
        closedQty,
        maxOpenQty: s.maxAbsQty,
        realizedPnl: s.realizedPnl,
        pnlPercent,
        fees: s.fees,
        feeAsset: s.feeAsset,
        source: 'binance-futures-fills',
        fillCount: s.fillCount,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      sessions.delete(symbol);
    }
  }

  const openPositions = Array.from(sessions.values()).map((s) => {
    const openPrice = s.openSumQty > 0 ? s.openSumPxQty / s.openSumQty : 0;

    return {
      symbol: s.symbol,
      positionSide: s.direction,
      openTime: s.openTime,
      lastTime: s.closeTime,
      openPrice,
      currentQty: Math.abs(s.openQty),
      maxOpenQty: s.maxAbsQty,
      realizedPnl: s.realizedPnl,
      fees: s.fees,
      feeAsset: s.feeAsset,
      fillCount: s.fillCount,
    };
  });

  return { closedPositions, openPositions, groups: groups.length };
}
