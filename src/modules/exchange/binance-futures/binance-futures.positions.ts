export type BinanceFuturesClosedPosition = {
  userId: string;
  positionKey: string; // SYMBOL#SIDE#openTimeMs

  symbol: string;
  positionSide: 'LONG' | 'SHORT';

  openTime: number;
  closeTime: number;

  openPrice: number; // VWAP of opens
  closePrice: number; // VWAP of closes

  closedQty: number; // qty closed (base asset)
  maxOpenQty: number; // max abs position during session

  realizedPnl: number;
  pnlPercent?: number; // estimated

  fees?: number;
  feeAsset?: string;

  source: 'binance-futures-fills';
  fillCount: number;

  createdAt: string;
  updatedAt: string;
};

export type PositionBuildResult = {
  positions: BinanceFuturesClosedPosition[];
  ignoredFills: number;
};
