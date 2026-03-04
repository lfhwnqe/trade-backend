export const FLASHCARD_DIRECTION_VALUES = ['LONG', 'SHORT', 'NO_TRADE'] as const;
export type FlashcardDirection = (typeof FLASHCARD_DIRECTION_VALUES)[number];

export const FLASHCARD_CONTEXT_VALUES = ['TREND', 'RANGE', 'REVERSAL'] as const;
export type FlashcardContext = (typeof FLASHCARD_CONTEXT_VALUES)[number];

export const FLASHCARD_ORDER_FLOW_FEATURE_VALUES = [
  'CVD_ABSORPTION_DIVERGENCE',
  'FOOTPRINT_IMBALANCE_CLUSTER',
  'NO_CLEAR_ANOMALY',
  'SWEEP',
] as const;
export type FlashcardOrderFlowFeature =
  (typeof FLASHCARD_ORDER_FLOW_FEATURE_VALUES)[number];

export const FLASHCARD_RESULT_VALUES = ['WIN', 'LOSS', 'BREAK_EVEN'] as const;
export type FlashcardResult = (typeof FLASHCARD_RESULT_VALUES)[number];

export const FLASHCARD_IMAGE_SCOPE_VALUES = ['question', 'answer'] as const;
export type FlashcardImageScope = (typeof FLASHCARD_IMAGE_SCOPE_VALUES)[number];

export interface FlashcardCard {
  id: string;
  userId: string;
  cardId: string;
  questionImageUrl: string;
  answerImageUrl: string;
  direction: FlashcardDirection;
  context: FlashcardContext;
  orderFlowFeature: FlashcardOrderFlowFeature;
  result: FlashcardResult;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
