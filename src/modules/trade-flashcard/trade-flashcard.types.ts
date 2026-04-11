export const TRADE_FLASHCARD_TYPE_VALUES = ['REAL_TRADE', 'SIM_TRADE'] as const;
export type TradeFlashcardType = (typeof TRADE_FLASHCARD_TYPE_VALUES)[number];

export const TRADE_FLASHCARD_STATUS_VALUES = [
  'PRE_ENTRY',
  'IN_PROGRESS',
  'POST_ENTRY',
  'COMPLETED',
] as const;
export type TradeFlashcardStatus = (typeof TRADE_FLASHCARD_STATUS_VALUES)[number];

export const TRADE_FLASHCARD_IMAGE_SCOPE_VALUES = [
  'pre-entry',
  'post-entry',
  'progress',
] as const;
export type TradeFlashcardImageScope = (typeof TRADE_FLASHCARD_IMAGE_SCOPE_VALUES)[number];

export const TRADE_FLASHCARD_CARD_SORT_BY_VALUES = ['CREATED_AT', 'UPDATED_AT'] as const;
export type TradeFlashcardCardSortBy = (typeof TRADE_FLASHCARD_CARD_SORT_BY_VALUES)[number];

export const TRADE_FLASHCARD_CARD_SORT_ORDER_VALUES = ['asc', 'desc'] as const;
export type TradeFlashcardCardSortOrder = (typeof TRADE_FLASHCARD_CARD_SORT_ORDER_VALUES)[number];

export interface TradeFlashcardCard {
  id: string;
  userId: string;
  cardId: string;
  entityType: 'TRADE_FLASHCARD';
  tradeFlashcardType: TradeFlashcardType;
  status: TradeFlashcardStatus;
  preEntryImageUrl: string;
  postEntryImageUrl?: string;
  progressImageUrls?: string[];
  marketTimeInfo?: string;
  symbolPairInfo?: string;
  playbookType?: string;
  notes?: string;
  tagCodes?: string[];
  tagItems?: Array<{ code: string; label: string; color?: string; status?: string }>;
  createdAt: string;
  updatedAt: string;
}
