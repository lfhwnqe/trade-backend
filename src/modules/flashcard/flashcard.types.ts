export const FLASHCARD_DIRECTION_VALUES = ['LONG', 'SHORT', 'NO_TRADE'] as const;
export type FlashcardDirection = (typeof FLASHCARD_DIRECTION_VALUES)[number];
export type FlashcardAction = FlashcardDirection;

export const FLASHCARD_BEHAVIOR_TYPE_VALUES = [
  'ZONE_REJECTION',
  'ZONE_FAKE_BREAK',
  'STRONG_BREAKOUT_CLOSE',
  'BREAKOUT_RETEST_CONTINUATION',
  'HH_LL_RECLAIM_CONTINUATION',
  'SECOND_TEST_CONFIRMATION',
  'ZONE_CHOP_NO_EDGE',
  'REJECTION',
  'FAKE_BREAK_RECLAIM',
  'BREAK_ACCEPTANCE',
  'BREAK_RETEST',
  'CHOP',
  'SECOND_CONFIRMATION',
] as const;
export type FlashcardBehaviorType =
  (typeof FLASHCARD_BEHAVIOR_TYPE_VALUES)[number];

export const FLASHCARD_INVALIDATION_TYPE_VALUES = [
  'REJECTION_EXTREME_BROKEN',
  'FALSE_BREAK_SIDE_REACCEPTED',
  'BREAKOUT_BACK_IN_ZONE',
  'RETEST_FLIP_FAILED',
  'HH_LL_CONFIRMATION_FAILED',
  'MICRO_STRUCTURE_BROKEN',
  'NO_EXPANSION_AFTER_TRIGGER',
  'ZONE_DWELL_FAILURE',
  'ZONE_OUTSIDE',
  'WICK_EXTREME',
  'MICRO_STRUCTURE',
  'REENTER_ZONE',
  'NONE',
] as const;
export type FlashcardInvalidationType =
  (typeof FLASHCARD_INVALIDATION_TYPE_VALUES)[number];

export const FLASHCARD_SYSTEM_OUTCOME_TYPE_VALUES = [
  'SYSTEM_WIN',
  'SYSTEM_LOSS_NORMAL',
] as const;
export type FlashcardSystemOutcomeType =
  (typeof FLASHCARD_SYSTEM_OUTCOME_TYPE_VALUES)[number];

export const FLASHCARD_IMAGE_SCOPE_VALUES = ['question', 'answer'] as const;
export type FlashcardImageScope = (typeof FLASHCARD_IMAGE_SCOPE_VALUES)[number];

export const FLASHCARD_SOURCE_VALUES = [
  'ALL',
  'WRONG_BOOK',
  'FAVORITES',
] as const;
export type FlashcardSource = (typeof FLASHCARD_SOURCE_VALUES)[number];

export const FLASHCARD_CARD_SORT_BY_VALUES = [
  'CREATED_AT',
  'QUALITY_SCORE_AVG',
  'SIMULATION_RESOLVED_COUNT',
  'SIMULATION_AVG_RR',
] as const;
export type FlashcardCardSortBy = (typeof FLASHCARD_CARD_SORT_BY_VALUES)[number];

export const FLASHCARD_CARD_SORT_ORDER_VALUES = ['asc', 'desc'] as const;
export type FlashcardCardSortOrder =
  (typeof FLASHCARD_CARD_SORT_ORDER_VALUES)[number];

export interface FlashcardCard {
  id: string;
  userId: string;
  cardId: string;
  entityType?: 'CARD';
  questionImageUrl: string;
  answerImageUrl: string;
  expectedAction?: FlashcardAction;
  behaviorType?: FlashcardBehaviorType;
  invalidationType?: FlashcardInvalidationType;
  systemOutcomeType?: FlashcardSystemOutcomeType;
  earlyExitTag?: boolean;
  earlyExitReason?: string;
  earlyExitImageUrls?: string[];
  direction?: FlashcardDirection;
  marketTimeInfo?: string;
  symbolPairInfo?: string;
  notes?: string;
  simulationAttemptCount?: number;
  simulationResolvedCount?: number;
  simulationSuccessCount?: number;
  simulationFailureCount?: number;
  simulationSuccessRate?: number;
  simulationAvgRr?: number;
  qualityScoreAvg?: number;
  qualityScoreCount?: number;
  lastSimulationAt?: string;
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

export interface FlashcardSimulationSessionItem {
  userId: string;
  cardId: string; // simulation-session#{sessionId}
  entityType: 'SIMULATION_SESSION';
  simulationSessionId: string;
  mode?: 'STANDARD' | 'ATTEMPT_REPLAY';
  source: 'ALL' | 'FILTERED' | 'ATTEMPT_REPLAY';
  count: number;
  totalCards: number;
  completedAttemptCount?: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  cardIds: string[];
  startedAt: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardSimulationAttemptItem {
  userId: string;
  cardId: string; // simulation-attempt#{sessionId}#{attemptId}
  entityType: 'SIMULATION_ATTEMPT';
  attemptId: string;
  simulationSessionId: string;
  targetCardId: string;
  status: 'ENTRY_SAVED' | 'RESOLVED';
  questionImageUrlSnapshot?: string;
  answerImageUrlSnapshot?: string;
  revealProgress: number;
  replaySourceAttemptId?: string;
  entryLineYPercent: number;
  stopLossLineYPercent: number;
  takeProfitLineYPercent: number;
  rrValue: number;
  entryDirection: 'LONG' | 'SHORT';
  entryReason: string;
  result?: 'SUCCESS' | 'FAILURE';
  failureReason?: string;
  cardQualityScore?: 1 | 2 | 3 | 4 | 5;
  entrySavedAt: string;
  resolvedAt?: string;
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

export interface FlashcardDrillAnalyticsWindow {
  sampleSize: number;
  averageScore: number;
  bestScore: number;
  lowestScore: number;
  deltaFromPrevious: number | null;
}

export interface FlashcardDrillAnalyticsTrendPoint {
  sessionId: string;
  score: number;
  accuracy: number;
  startedAt: string;
  endedAt?: string;
}

export interface FlashcardDrillAnalyticsDimensionStat {
  key: string;
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
  wrongRate: number;
}

export const FLASHCARD_COLLECTION_STATE_VALUES = [
  'NO_NEW_CARDS',
  'LIGHT_COLLECTION',
  'ACTIVE_COLLECTION',
  'HEAVY_COLLECTION',
  'FOCUSED_COLLECTION',
  'SCATTERED_COLLECTION',
  'COLLECTION_PAUSED',
] as const;
export type FlashcardCollectionState =
  (typeof FLASHCARD_COLLECTION_STATE_VALUES)[number];

export interface FlashcardCollectionDistributionItem {
  value: string;
  count: number;
}
