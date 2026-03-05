export const FLASHCARD_DIRECTION_VALUES = ['LONG', 'SHORT', 'NO_TRADE'] as const;
export type FlashcardDirection = (typeof FLASHCARD_DIRECTION_VALUES)[number];
export type FlashcardAction = FlashcardDirection;

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

export const FLASHCARD_SOURCE_VALUES = [
  'ALL',
  'WRONG_BOOK',
  'FAVORITES',
] as const;
export type FlashcardSource = (typeof FLASHCARD_SOURCE_VALUES)[number];

export interface FlashcardCard {
  id: string;
  userId: string;
  cardId: string;
  entityType?: 'CARD';
  questionImageUrl: string;
  answerImageUrl: string;
  expectedAction?: FlashcardAction;
  direction: FlashcardDirection;
  context: FlashcardContext;
  orderFlowFeature: FlashcardOrderFlowFeature;
  result: FlashcardResult;
  marketTimeInfo?: string;
  symbolPairInfo?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardDrillSessionItem {
  userId: string;
  cardId: string; // session#{sessionId}
  entityType: 'SESSION';
  sessionId: string;
  source: FlashcardSource;
  total: number;
  answered: number;
  correct: number;
  wrong: number;
  score: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  cardIds: string[];
  startedAt: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardDrillAttemptItem {
  userId: string;
  cardId: string; // attempt#{sessionId}#{cardId}
  entityType: 'ATTEMPT';
  sessionId: string;
  targetCardId: string;
  userAction: FlashcardAction;
  expectedAction: FlashcardAction;
  isCorrect: boolean;
  isFavorite: boolean;
  noteSnapshot?: string;
  answeredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardWrongBookItem {
  userId: string;
  cardId: string; // wrong#{targetCardId}
  entityType: 'WRONG_BOOK';
  targetCardId: string;
  lastSessionId: string;
  lastAnsweredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardFavoriteItem {
  userId: string;
  cardId: string; // favorite#{targetCardId}
  entityType: 'FAVORITE';
  targetCardId: string;
  createdAt: string;
  updatedAt: string;
}
