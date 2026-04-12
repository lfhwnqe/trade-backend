export const MISTAKE_SOURCE_TYPE_VALUES = [
  'FLASHCARD_SIMULATION',
  'TRADE_FLASHCARD',
] as const;
export type MistakeSourceType = (typeof MISTAKE_SOURCE_TYPE_VALUES)[number];

export const MISTAKE_DOMAIN_VALUES = [
  'RECOGNITION',
  'TRIGGER_TIMING',
  'RISK_FRAMEWORK',
  'CONTEXT_FILTER',
  'EXECUTION',
] as const;
export type MistakeDomain = (typeof MISTAKE_DOMAIN_VALUES)[number];

export const MISTAKE_REVIEW_STATUS_VALUES = [
  'NEW',
  'CLASSIFIED',
  'IN_TRAINING',
  'IMPROVED',
  'ARCHIVED',
] as const;
export type MistakeReviewStatus = (typeof MISTAKE_REVIEW_STATUS_VALUES)[number];

export interface MistakeRecordItem {
  userId: string;
  mistakeRecordId: string;
  sourceType: MistakeSourceType;
  sourceId: string;
  simulationAttemptId?: string;
  tradeFlashcardId?: string;
  cardId?: string;
  playbookType?: string;
  tagCodes?: string[];
  primaryMistakeCode: string;
  mistakeCodes: string[];
  mistakeDomain: MistakeDomain;
  note?: string;
  correctionNote?: string;
  reviewStatus: MistakeReviewStatus;
  createdAt: string;
  updatedAt: string;
}
