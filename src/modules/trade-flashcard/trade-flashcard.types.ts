export const TRADE_FLASHCARD_TYPE_VALUES = ['REAL_TRADE', 'SIM_TRADE'] as const;
export type TradeFlashcardType = (typeof TRADE_FLASHCARD_TYPE_VALUES)[number];

export const TRADE_FLASHCARD_LIFECYCLE_STATUS_VALUES = ['IN_PROGRESS', 'COMPLETED'] as const;
export type TradeFlashcardLifecycleStatus = (typeof TRADE_FLASHCARD_LIFECYCLE_STATUS_VALUES)[number];

export const TRADE_FLASHCARD_PROCESS_RESULT_VALUES = ['SUCCESS', 'FAIL'] as const;
export type TradeFlashcardProcessResult = (typeof TRADE_FLASHCARD_PROCESS_RESULT_VALUES)[number];

export const TRADE_FLASHCARD_IMAGE_SCOPE_VALUES = [
  'pre-entry',
  'entry',
  'final-trend',
  'post-entry',
  'progress',
] as const;
export type TradeFlashcardImageScope = (typeof TRADE_FLASHCARD_IMAGE_SCOPE_VALUES)[number];

export const TRADE_FLASHCARD_CARD_SORT_BY_VALUES = ['CREATED_AT', 'UPDATED_AT'] as const;
export type TradeFlashcardCardSortBy = (typeof TRADE_FLASHCARD_CARD_SORT_BY_VALUES)[number];

export const TRADE_FLASHCARD_CARD_SORT_ORDER_VALUES = ['asc', 'desc'] as const;
export type TradeFlashcardCardSortOrder = (typeof TRADE_FLASHCARD_CARD_SORT_ORDER_VALUES)[number];

export interface TradeFlashcardPlaybookCondition {
  playbookType: string;
  condition: string;
}

export interface TradeFlashcardCard {
  id: string;
  userId: string;
  cardId: string;
  entityType: 'TRADE_FLASHCARD';
  tradeFlashcardType: TradeFlashcardType;
  lifecycleStatus: TradeFlashcardLifecycleStatus;
  processResult?: TradeFlashcardProcessResult;
  isSystemAligned?: boolean;
  preEntryImageUrl: string;
  preEntryImageUrls?: string[];
  entryImageUrls?: string[];
  entryTimeInfo?: string;
  finalTrendImageUrl?: string;
  postEntryImageUrl?: string;
  progressImageUrls?: string[];
  marketTimeInfo?: string;
  symbolPairInfo?: string;
  playbookType?: string;
  marketStructure?: string;
  possiblePlaybookTypes?: string[];
  playbookConditions?: TradeFlashcardPlaybookCondition[];
  firstSignal?: string;
  secondSignalConfirmation?: string;
  stopLossSetting?: string;
  notes?: string;
  summary?: string;
  convertedToFlashcardAt?: string;
  convertedFlashcardId?: string;
  convertedToPracticalFlashcardAt?: string;
  convertedPracticalFlashcardId?: string;
  tagCodes?: string[];
  tagItems?: Array<{ code: string; label: string; color?: string; status?: string }>;
  createdAt: string;
  updatedAt: string;
}
