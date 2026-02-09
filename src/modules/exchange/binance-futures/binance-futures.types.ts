export type BinanceFuturesApiKeyRecord = {
  userId: string;
  apiKey: string;
  secretEnc: string;
  /**
   * Default leverage used for ROI estimate.
   * Note: Binance UI ROI is based on margin; without margin history we approximate ROI as notionalPnl% * leverage.
   */
  defaultLeverage?: number;
  createdAt: string;
  updatedAt: string;
};

export type BinanceFuturesFillRecord = {
  userId: string;
  // trade id from Binance (number) but store as string for DynamoDB
  tradeId: string;
  symbol: string;
  time: number;

  // DynamoDB sort key, format: SYMBOL#tradeId
  tradeKey?: string;

  // normalized fields (best-effort)
  side?: string;
  positionSide?: string;
  price?: string;
  qty?: string;
  realizedPnl?: string;
  commission?: string;
  commissionAsset?: string;
  orderId?: string;

  // raw payload for forward-compat
  raw: any;

  importedAt: string;
};
