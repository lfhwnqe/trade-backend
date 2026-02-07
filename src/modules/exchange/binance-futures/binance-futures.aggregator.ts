import { BinanceFuturesFillRecord } from './binance-futures.types';
import {
  BinanceFuturesClosedPosition,
  PositionBuildResult,
} from './binance-futures.positions';

function vwapSumAdd(
  sumPxQty: number,
  sumQty: number,
  price: number,
  qty: number,
) {
  return {
    sumPxQty: sumPxQty + price * qty,
    sumQty: sumQty + qty,
  };
}

export function buildClosedPositionsFromFills(
  userId: string,
  fills: BinanceFuturesFillRecord[],
): PositionBuildResult {
  // Expect fills sorted ascending by time
  const positions: BinanceFuturesClosedPosition[] = [];
  let ignoredFills = 0;

  type State = {
    symbol: string;
    side: 'LONG' | 'SHORT';
    openTime: number | null;
    closeTime: number | null;

    // position qty (signed positive means open exposure)
    openQty: number;
    maxAbsQty: number;

    // open/close VWAP components
    openSumPxQty: number;
    openSumQty: number;
    closeSumPxQty: number;
    closeSumQty: number;

    realizedPnl: number;
    fees: number;
    feeAsset?: string;
    fillCount: number;
  };

  const byKey = new Map<string, State>();

  const getKey = (symbol: string, side: 'LONG' | 'SHORT') =>
    `${symbol}#${side}`;

  for (const f of fills) {
    const symbol = String(f.symbol || '').trim();
    const time = Number(f.time);
    const price = Number(f.price);
    const qty = Number(f.qty);
    const realized = Number(f.realizedPnl ?? 0);
    const fee = Number(f.commission ?? 0);

    if (
      !symbol ||
      !Number.isFinite(time) ||
      !Number.isFinite(price) ||
      !Number.isFinite(qty)
    ) {
      ignoredFills += 1;
      continue;
    }

    // Determine position side
    const ps = String(f.positionSide || '').toUpperCase();
    let side: 'LONG' | 'SHORT' | null = null;

    if (ps === 'LONG' || ps === 'SHORT') {
      side = ps as any;
    } else {
      // Fallback for one-way mode: infer by side BUY/SELL
      const s = String(f.side || '').toUpperCase();
      if (s === 'BUY') side = 'LONG';
      else if (s === 'SELL') side = 'SHORT';
    }

    if (!side) {
      ignoredFills += 1;
      continue;
    }

    const stateKey = getKey(symbol, side);
    const st: State = byKey.get(stateKey) || {
      symbol,
      side,
      openTime: null,
      closeTime: null,
      openQty: 0,
      maxAbsQty: 0,
      openSumPxQty: 0,
      openSumQty: 0,
      closeSumPxQty: 0,
      closeSumQty: 0,
      realizedPnl: 0,
      fees: 0,
      feeAsset: f.commissionAsset,
      fillCount: 0,
    };

    // qty sign: for LONG, BUY increases, SELL decreases; for SHORT, SELL increases, BUY decreases
    const rawSide = String(f.side || '').toUpperCase();
    let delta = 0;
    if (side === 'LONG') {
      delta = rawSide === 'SELL' ? -qty : qty;
    } else {
      delta = rawSide === 'BUY' ? -qty : qty;
    }

    const prevQty = st.openQty;
    const nextQty = prevQty + delta;

    // session open
    if (prevQty === 0 && nextQty !== 0) {
      st.openTime = time;
      st.openSumPxQty = 0;
      st.openSumQty = 0;
      st.closeSumPxQty = 0;
      st.closeSumQty = 0;
      st.realizedPnl = 0;
      st.fees = 0;
      st.fillCount = 0;
      st.maxAbsQty = 0;
      st.feeAsset = f.commissionAsset;
    }

    // classify this fill as open/add or close/reduce based on whether it increases abs exposure
    const increased = Math.abs(nextQty) > Math.abs(prevQty);
    if (increased) {
      const add = vwapSumAdd(st.openSumPxQty, st.openSumQty, price, qty);
      st.openSumPxQty = add.sumPxQty;
      st.openSumQty = add.sumQty;
    } else {
      const add = vwapSumAdd(st.closeSumPxQty, st.closeSumQty, price, qty);
      st.closeSumPxQty = add.sumPxQty;
      st.closeSumQty = add.sumQty;
    }

    st.openQty = nextQty;
    st.maxAbsQty = Math.max(st.maxAbsQty, Math.abs(nextQty));
    st.realizedPnl += Number.isFinite(realized) ? realized : 0;
    st.fees += Number.isFinite(fee) ? fee : 0;
    st.fillCount += 1;

    // session close
    if (prevQty !== 0 && nextQty === 0 && st.openTime) {
      st.closeTime = time;

      const openPrice =
        st.openSumQty > 0 ? st.openSumPxQty / st.openSumQty : price;
      const closePrice =
        st.closeSumQty > 0 ? st.closeSumPxQty / st.closeSumQty : price;
      const closedQty = st.closeSumQty > 0 ? st.closeSumQty : st.maxAbsQty;

      const notional = st.maxAbsQty > 0 ? st.maxAbsQty * openPrice : 0;
      const pnlPercent = notional > 0 ? st.realizedPnl / notional : undefined;

      const nowIso = new Date().toISOString();
      const positionKey = `${symbol}#${side}#${st.openTime}`;

      positions.push({
        userId,
        positionKey,
        symbol,
        positionSide: side,
        openTime: st.openTime,
        closeTime: st.closeTime,
        openPrice,
        closePrice,
        closedQty,
        maxOpenQty: st.maxAbsQty,
        realizedPnl: st.realizedPnl,
        pnlPercent,
        fees: st.fees,
        feeAsset: st.feeAsset,
        source: 'binance-futures-fills',
        fillCount: st.fillCount,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      // reset state for next session
      st.openTime = null;
      st.closeTime = null;
      st.openQty = 0;
      st.maxAbsQty = 0;
      st.openSumPxQty = 0;
      st.openSumQty = 0;
      st.closeSumPxQty = 0;
      st.closeSumQty = 0;
      st.realizedPnl = 0;
      st.fees = 0;
      st.fillCount = 0;
    }

    byKey.set(stateKey, st);
  }

  return { positions, ignoredFills };
}
