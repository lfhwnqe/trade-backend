export const TRADINGVIEW_TRAINING_RECORD_RESULT_VALUES = ['WIN', 'LOSS', 'BREAKEVEN'] as const;
export type TradingViewTrainingRecordResult = (typeof TRADINGVIEW_TRAINING_RECORD_RESULT_VALUES)[number];

export const TRADINGVIEW_TRAINING_RECORD_STATUS_VALUES = ['ACTIVE', 'DELETED'] as const;
export type TradingViewTrainingRecordStatus = (typeof TRADINGVIEW_TRAINING_RECORD_STATUS_VALUES)[number];

export const TRADINGVIEW_TRAINING_RECORD_IMAGE_SCOPE_VALUES = ['training-image'] as const;
export type TradingViewTrainingRecordImageScope = (typeof TRADINGVIEW_TRAINING_RECORD_IMAGE_SCOPE_VALUES)[number];

export const TRADINGVIEW_TRAINING_RECORD_SORT_BY_VALUES = ['CREATED_AT', 'UPDATED_AT'] as const;
export type TradingViewTrainingRecordSortBy = (typeof TRADINGVIEW_TRAINING_RECORD_SORT_BY_VALUES)[number];

export const TRADINGVIEW_TRAINING_RECORD_SORT_ORDER_VALUES = ['asc', 'desc'] as const;
export type TradingViewTrainingRecordSortOrder = (typeof TRADINGVIEW_TRAINING_RECORD_SORT_ORDER_VALUES)[number];

export interface TradingViewTrainingRecordPlaybookItem {
  code: string;
  label: string;
  color?: string;
  status?: string;
}

export interface TradingViewTrainingRecord {
  id: string;
  userId: string;
  cardId: string;
  recordId: string;
  entityType: 'TRADINGVIEW_TRAINING_RECORD';
  symbolPair?: string;
  imageUrl: string;
  imageKey?: string;
  tradeResult: TradingViewTrainingRecordResult;
  playbookType: string;
  playbookItem?: TradingViewTrainingRecordPlaybookItem;
  entryConfidenceRating: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  reviewCandleTime?: string;
  trainingTime?: string;
  status: TradingViewTrainingRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TradingViewTrainingRecordAnalyticsSummary {
  totalCount: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  decisiveCount: number;
  winRate: number | null;
  avgEntryConfidenceRating: number | null;
}
