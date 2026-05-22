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
