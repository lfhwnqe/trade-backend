import { buildClosedPositionsV2 } from '../binance-futures.aggregator.v2';
import type { BinanceFuturesFillRecord } from '../binance-futures.types';

function fill(
  partial: Partial<BinanceFuturesFillRecord>,
): BinanceFuturesFillRecord {
  return {
    userId: 'u',
    tradeId: String(partial.tradeId || '1'),
    symbol: partial.symbol || 'BTCUSDC',
    time: partial.time || 0,
    side: partial.side,
    positionSide: partial.positionSide,
    price: partial.price,
    qty: partial.qty,
    realizedPnl: partial.realizedPnl,
    commission: partial.commission,
    commissionAsset: partial.commissionAsset,
    orderId: partial.orderId,
    raw: partial.raw || {},
    importedAt: partial.importedAt || new Date().toISOString(),
    tradeKey: partial.tradeKey,
  };
}

describe('binance-futures aggregator v2', () => {
  it('should aggregate split fills into 1 closed position (example)', () => {
    const tOpen = 1770215269749;
    const tClose = 1770217332859;

    const fills: BinanceFuturesFillRecord[] = [
      // open SELL (split)
      fill({
        tradeId: '371379222',
        tradeKey: 'BTCUSDC#371379222',
        symbol: 'BTCUSDC',
        orderId: '43761077675',
        time: tOpen,
        side: 'SELL',
        positionSide: 'BOTH',
        price: '75194.4',
        qty: '0.089',
        realizedPnl: '0',
        commission: '2.67692064',
        commissionAsset: 'USDC',
      }),
      fill({
        tradeId: '371379223',
        tradeKey: 'BTCUSDC#371379223',
        symbol: 'BTCUSDC',
        orderId: '43761077675',
        time: tOpen,
        side: 'SELL',
        positionSide: 'BOTH',
        price: '75194.4',
        qty: '0.043',
        realizedPnl: '0',
        commission: '1.29334368',
        commissionAsset: 'USDC',
      }),

      // close BUY (split)
      fill({
        tradeId: '371484321',
        tradeKey: 'BTCUSDC#371484321',
        symbol: 'BTCUSDC',
        orderId: '43766655567',
        time: tClose,
        side: 'BUY',
        positionSide: 'BOTH',
        price: '73890.1',
        qty: '0.093',
        realizedPnl: '121.29990000',
        commission: '2.74871172',
        commissionAsset: 'USDC',
      }),
      fill({
        tradeId: '371484322',
        tradeKey: 'BTCUSDC#371484322',
        symbol: 'BTCUSDC',
        orderId: '43766655567',
        time: tClose,
        side: 'BUY',
        positionSide: 'BOTH',
        price: '73894.4',
        qty: '0.039',
        realizedPnl: '50.70000000',
        commission: '1.15275264',
        commissionAsset: 'USDC',
      }),
    ];

    const { closedPositions, openPositions } = buildClosedPositionsV2(
      'u',
      fills,
    );
    expect(openPositions.length).toBe(0);
    expect(closedPositions.length).toBe(1);

    const p = closedPositions[0];
    expect(p.symbol).toBe('BTCUSDC');
    expect(p.positionSide).toBe('SHORT');
    expect(p.openTime).toBe(tOpen);
    expect(p.closeTime).toBe(tClose);
    expect(p.maxOpenQty).toBeGreaterThan(0.13 - 1e-9);
    expect(p.closedQty).toBeGreaterThan(0.13 - 1e-9);
    expect(p.realizedPnl).toBeCloseTo(171.9999, 6);
    expect(p.openPrice).toBeCloseTo(75194.4, 6);
    expect(p.closePrice).toBeGreaterThan(73890);
    expect(p.closePrice).toBeLessThan(73900);
  });
});
