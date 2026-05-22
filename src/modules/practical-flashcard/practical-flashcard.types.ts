export const PRACTICAL_FLASHCARD_VENUE_VALUES = ['BINANCE_UM_FUTURES'] as const;
export type PracticalFlashcardVenue = (typeof PRACTICAL_FLASHCARD_VENUE_VALUES)[number];

export const PRACTICAL_FLASHCARD_BINANCE_UM_SYMBOL_VALUES = ['BTCUSDT', 'BTCUSDC', 'ETHUSDT', 'ETHUSDC'] as const;
export type PracticalFlashcardBinanceUmSymbol = (typeof PRACTICAL_FLASHCARD_BINANCE_UM_SYMBOL_VALUES)[number];

export const PRACTICAL_FLASHCARD_INTERVAL_VALUES = ['15m'] as const;
export type PracticalFlashcardInterval = (typeof PRACTICAL_FLASHCARD_INTERVAL_VALUES)[number];

export const PRACTICAL_FLASHCARD_STATUS_VALUES = ['ACTIVE', 'DISABLED'] as const;
export type PracticalFlashcardStatus = (typeof PRACTICAL_FLASHCARD_STATUS_VALUES)[number];

export const PRACTICAL_FLASHCARD_DIRECTION_VALUES = ['LONG', 'SHORT', 'NO_ENTRY'] as const;
export type PracticalFlashcardDirection = (typeof PRACTICAL_FLASHCARD_DIRECTION_VALUES)[number];

export const PRACTICAL_FLASHCARD_TRADE_DIRECTION_VALUES = ['LONG', 'SHORT'] as const;
export type PracticalFlashcardTradeDirection = (typeof PRACTICAL_FLASHCARD_TRADE_DIRECTION_VALUES)[number];

export const PRACTICAL_FLASHCARD_ATTEMPT_STATUS_VALUES = ['IN_PROGRESS', 'RESOLVED', 'ABANDONED'] as const;
export type PracticalFlashcardAttemptStatus = (typeof PRACTICAL_FLASHCARD_ATTEMPT_STATUS_VALUES)[number];

export type PracticalFlashcardCandle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export interface PracticalFlashcardCard {
  id: string;
  userId: string;
  cardId: string;
  entityType: 'PRACTICAL_FLASHCARD';
  status: PracticalFlashcardStatus;
  venue: PracticalFlashcardVenue;
  symbolPairInfo: string;
  primaryInterval: PracticalFlashcardInterval;
  timeZone?: string;
  entryTimeInfo: string;
  exitTimeInfo: string;
  snapshotStartTime: string;
  snapshotEndTime: string;
  candles: PracticalFlashcardCandle[];
  initialVisibleCandleIndex: number;
  resultCandleIndex?: number;
  expectedDirection?: PracticalFlashcardDirection;
  standardEntryPrice?: number;
  standardStopLossPrice?: number;
  standardTakeProfitPrice?: number;
  playbookType: string;
  tagCodes?: string[];
  tagItems?: Array<{ code: string; label: string; color?: string; status?: string }>;
  orderFlowImageUrls?: string[];
  orderFlowRemark?: string;
  notes?: string;
  summary?: string;
  sourceTradeFlashcardId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PracticalFlashcardAttempt {
  id: string;
  userId: string;
  cardId: string;
  entityType: 'PRACTICAL_FLASHCARD_ATTEMPT';
  attemptId: string;
  targetCardId: string;
  status: PracticalFlashcardAttemptStatus;
  decision?: PracticalFlashcardDirection;
  tradeOpenedCandleIndex?: number;
  tradeDirection?: PracticalFlashcardTradeDirection;
  entryPrice?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  plannedRr?: number;
  preTradeMarketStructureAnalysis?: string;
  preTradePriceActionAnalysis?: string;
  preTradeOrderFlowAnalysis?: string;
  realizedR?: number;
  isWin?: boolean;
  maxFavorableR?: number;
  maxAdverseR?: number;
  finalCandleIndex?: number;
  currentCandleIndex?: number;
  drawingSnapshot?: unknown;
  usedOrderFlowReveal?: boolean;
  orderFlowRevealEvents?: Array<{ imageUrl: string; candleIndex: number; revealedAt: string }>;
  marketStructureAnalysisCorrect?: boolean;
  priceActionAnalysisCorrect?: boolean;
  orderFlowAnalysisCorrect?: boolean;
  orderFlowAnalysisUsed?: boolean;
  riskRewardSetupCorrect?: boolean;
  mistakeReasons?: string[];
  notes?: string;
  summary?: string;
  startedAt: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type PracticalFlashcardRunningStats = {
  attemptCount: number;
  resolvedCount: number;
  winRate: number | null;
  avgRealizedR: number | null;
  totalRealizedR: number;
  avgPlannedRr: number | null;
  orderFlowRevealRate: number | null;
};
