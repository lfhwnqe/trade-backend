export const IMAGE_RECOGNITION_FLASHCARD_STATUS_VALUES = ['ACTIVE', 'DISABLED'] as const;
export type ImageRecognitionFlashcardStatus = (typeof IMAGE_RECOGNITION_FLASHCARD_STATUS_VALUES)[number];

export const IMAGE_RECOGNITION_FLASHCARD_SAMPLE_RESULT_VALUES = ['SUCCESS', 'FAIL'] as const;
export type ImageRecognitionFlashcardSampleResult = (typeof IMAGE_RECOGNITION_FLASHCARD_SAMPLE_RESULT_VALUES)[number];

export const IMAGE_RECOGNITION_FLASHCARD_STATUS_FILTER_VALUES = ['ACTIVE', 'DISABLED', 'ALL'] as const;
export type ImageRecognitionFlashcardStatusFilter = (typeof IMAGE_RECOGNITION_FLASHCARD_STATUS_FILTER_VALUES)[number];

export const IMAGE_RECOGNITION_FLASHCARD_IMAGE_SCOPE_VALUES = ['card-image'] as const;
export type ImageRecognitionFlashcardImageScope = (typeof IMAGE_RECOGNITION_FLASHCARD_IMAGE_SCOPE_VALUES)[number];

export const IMAGE_RECOGNITION_FLASHCARD_CARD_SORT_BY_VALUES = ['CREATED_AT', 'UPDATED_AT'] as const;
export type ImageRecognitionFlashcardCardSortBy = (typeof IMAGE_RECOGNITION_FLASHCARD_CARD_SORT_BY_VALUES)[number];

export const IMAGE_RECOGNITION_FLASHCARD_CARD_SORT_ORDER_VALUES = ['asc', 'desc'] as const;
export type ImageRecognitionFlashcardCardSortOrder = (typeof IMAGE_RECOGNITION_FLASHCARD_CARD_SORT_ORDER_VALUES)[number];

export interface ImageRecognitionFlashcardCard {
  id: string;
  userId: string;
  cardId: string;
  entityType: 'IMAGE_RECOGNITION_FLASHCARD';
  imageUrl: string;
  imageKey?: string;
  playbookType: string;
  playbookItem?: { code: string; label: string; color?: string; status?: string };
  sampleResult?: ImageRecognitionFlashcardSampleResult;
  notes?: string;
  status: ImageRecognitionFlashcardStatus;
  ownerRole?: string;
  createdAt: string;
  updatedAt: string;
}
