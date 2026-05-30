export const PRACTICAL_FLASHCARD_VENUE_VALUES = ['BINANCE_UM_FUTURES'] as const;
export type PracticalFlashcardVenue = (typeof PRACTICAL_FLASHCARD_VENUE_VALUES)[number];

export const PRACTICAL_FLASHCARD_BINANCE_UM_SYMBOL_VALUES = ['BTCUSDT', 'BTCUSDC', 'ETHUSDT', 'ETHUSDC'] as const;
export type PracticalFlashcardBinanceUmSymbol = (typeof PRACTICAL_FLASHCARD_BINANCE_UM_SYMBOL_VALUES)[number];

export const PRACTICAL_FLASHCARD_INTERVAL_VALUES = ['1m', '2m', '15m'] as const;
export type PracticalFlashcardInterval = (typeof PRACTICAL_FLASHCARD_INTERVAL_VALUES)[number];

export const PRACTICAL_FLASHCARD_STATUS_VALUES = ['ACTIVE', 'DISABLED'] as const;
export type PracticalFlashcardStatus = (typeof PRACTICAL_FLASHCARD_STATUS_VALUES)[number];

export const PRACTICAL_FLASHCARD_DIRECTION_VALUES = ['LONG', 'SHORT', 'NO_ENTRY'] as const;
export type PracticalFlashcardDirection = (typeof PRACTICAL_FLASHCARD_DIRECTION_VALUES)[number];

export const PRACTICAL_FLASHCARD_TRADE_DIRECTION_VALUES = ['LONG', 'SHORT'] as const;
export type PracticalFlashcardTradeDirection = (typeof PRACTICAL_FLASHCARD_TRADE_DIRECTION_VALUES)[number];

export const PRACTICAL_FLASHCARD_ATTEMPT_STATUS_VALUES = ['IN_PROGRESS', 'RESOLVED', 'ABANDONED'] as const;
export type PracticalFlashcardAttemptStatus = (typeof PRACTICAL_FLASHCARD_ATTEMPT_STATUS_VALUES)[number];

export const PRACTICAL_FLASHCARD_TRAINING_MODE_VALUES = ['DIRECT_CARD', 'RANDOM_TRAINING'] as const;
export type PracticalFlashcardTrainingMode = (typeof PRACTICAL_FLASHCARD_TRAINING_MODE_VALUES)[number];

export const PRACTICAL_FLASHCARD_EXIT_REASON_VALUES = [
  'TAKE_PROFIT',
  'STOP_LOSS',
  'MANUAL_EXIT',
  'NO_EXIT_BY_FINAL_CANDLE',
] as const;
export type PracticalFlashcardExitReason = (typeof PRACTICAL_FLASHCARD_EXIT_REASON_VALUES)[number];

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
  ownerRole?: string;
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
  targetCardOwnerUserId?: string;
  status: PracticalFlashcardAttemptStatus;
  trainingMode?: PracticalFlashcardTrainingMode;
  cardSnapshot?: {
    playbookType: string;
    tagCodes?: string[];
    symbolPairInfo: string;
    primaryInterval: PracticalFlashcardInterval;
    expectedDirection?: PracticalFlashcardDirection;
  };
  replayInterval?: PracticalFlashcardInterval;
  tradeExecutionInterval?: PracticalFlashcardInterval;
  decision?: PracticalFlashcardDirection;
  tradeOpenedCandleIndex?: number;
  tradeDirection?: PracticalFlashcardTradeDirection;
  entryPrice?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  plannedRr?: number;
  tradeClosedCandleIndex?: number;
  exitPrice?: number;
  exitReason?: PracticalFlashcardExitReason;
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
  tradeExecutionSnapshot?: {
    interval?: PracticalFlashcardInterval;
    entryCandleIndex: number;
    entryCandleOpenTime: number;
    entryPrice: number;
    exitCandleIndex?: number;
    exitCandleOpenTime?: number;
    exitPrice?: number;
    exitReason?: PracticalFlashcardExitReason;
    stopLossPrice: number;
    takeProfitPrice: number;
    tradeDirection: PracticalFlashcardTradeDirection;
  };
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

export type PracticalFlashcardAnalyticsGroup = {
  key: string;
  label: string;
  attemptCount: number;
  resolvedCount: number;
  winCount: number;
  winRate: number | null;
  avgRealizedR: number | null;
  totalRealizedR: number;
  avgPlannedRr: number | null;
};

export type PracticalFlashcardAnalysisDimensionStats = {
  key: string;
  label: string;
  reviewedCount: number;
  correctCount: number;
  wrongCount: number;
  correctRate: number | null;
};

export type PracticalFlashcardAnalyticsAttemptSample = {
  attemptId: string;
  targetCardId: string;
  resolvedAt?: string;
  symbolPairInfo?: string;
  playbookType?: string;
  tradeDirection?: PracticalFlashcardTradeDirection;
  realizedR?: number;
  isWin?: boolean;
  mistakeReasons?: string[];
  summary?: string;
};

export type PracticalFlashcardDashboardAnalytics = PracticalFlashcardRunningStats & {
  filters: {
    from?: string;
    to?: string;
    playbookType?: string;
    symbolPairInfo?: string;
  };
  analysisDimensions: PracticalFlashcardAnalysisDimensionStats[];
  playbookStats: PracticalFlashcardAnalyticsGroup[];
  symbolStats: PracticalFlashcardAnalyticsGroup[];
  cardStats: PracticalFlashcardAnalyticsGroup[];
  recentAttempts: PracticalFlashcardAnalyticsAttemptSample[];
  recentWrongAttempts: PracticalFlashcardAnalyticsAttemptSample[];
};
