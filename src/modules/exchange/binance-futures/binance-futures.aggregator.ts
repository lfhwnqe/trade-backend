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
    // In hedge mode, this is fixed. In one-way mode, it will be determined when session opens.
    side: 'LONG' | 'SHORT' | null;
    // first seen fill time (used when position started before current window)
    firstTime: number | null;
    openTime: number | null;
    closeTime: number | null;

    // position qty (signed). For hedge mode it is magnitude of that side.
    // For one-way mode: BUY -> +qty, SELL -> -qty.
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

  const getHedgeKey = (symbol: string, side: 'LONG' | 'SHORT') =>
    `${symbol}#${side}`;
  const getOneWayKey = (symbol: string) => `${symbol}#ONEWAY`;

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

    const rawSide = String(f.side || '').toUpperCase();
    if (rawSide !== 'BUY' && rawSide !== 'SELL') {
      ignoredFills += 1;
      continue;
    }

    // Determine mode
    const ps = String(f.positionSide || '').toUpperCase();
    const isHedgeMode = ps === 'LONG' || ps === 'SHORT';

    let stateKey: string;
    if (isHedgeMode) {
      stateKey = getHedgeKey(symbol, ps as 'LONG' | 'SHORT');
    } else {
      // One-way mode: positionSide may be BOTH/empty. Must net BUY/SELL within same bucket.
      stateKey = getOneWayKey(symbol);
    }

    const st: State = byKey.get(stateKey) || {
      symbol,
      side: isHedgeMode ? (ps as 'LONG' | 'SHORT') : null,
      firstTime: null,
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

    if (st.firstTime === null) {
      st.firstTime = time;
    }

    // delta qty
    // - Hedge mode: qty tracked for that positionSide bucket
    // - One-way mode: BUY => +qty, SELL => -qty (netted)
    let delta = 0;
    if (isHedgeMode) {
      const side = ps as 'LONG' | 'SHORT';
      // for LONG, BUY increases, SELL decreases; for SHORT, SELL increases, BUY decreases
      if (side === 'LONG') {
        delta = rawSide === 'SELL' ? -qty : qty;
      } else {
        delta = rawSide === 'BUY' ? -qty : qty;
      }
    } else {
      delta = rawSide === 'BUY' ? qty : -qty;
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

      // one-way mode: decide direction by sign
      if (!isHedgeMode) {
        st.side = nextQty > 0 ? 'LONG' : 'SHORT';
      }
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
    if (prevQty !== 0 && nextQty === 0) {
      // If the position started before our current window, openTime may be null.
      // In that case we still emit a closed position using firstTime as an approximation.
      const openTime = st.openTime ?? st.firstTime;
      if (!openTime) {
        // can't determine open time at all
        byKey.set(stateKey, st);
        continue;
      }

      st.closeTime = time;

      const openPrice =
        st.openSumQty > 0 ? st.openSumPxQty / st.openSumQty : price;
      const closePrice =
        st.closeSumQty > 0 ? st.closeSumPxQty / st.closeSumQty : price;
      const closedQty = st.closeSumQty > 0 ? st.closeSumQty : st.maxAbsQty;

      const notional = st.maxAbsQty > 0 ? st.maxAbsQty * openPrice : 0;
      const pnlPercent = notional > 0 ? st.realizedPnl / notional : undefined;

      const nowIso = new Date().toISOString();
      const finalSide = st.side || (st.openQty >= 0 ? 'LONG' : 'SHORT');
      const positionKey = `${symbol}#${finalSide}#${openTime}`;

      positions.push({
        userId,
        positionKey,
        symbol,
        positionSide: finalSide,
        openTime,
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
