export const DICTIONARY_BIZ_TYPE_VALUES = [
  'TRADE',
  'FLASHCARD',
  'SIMULATION',
  'COMMON',
] as const;
export type DictionaryBizType = (typeof DICTIONARY_BIZ_TYPE_VALUES)[number];

export const DICTIONARY_SELECTION_MODE_VALUES = ['SINGLE', 'MULTIPLE'] as const;
export type DictionarySelectionMode =
  (typeof DICTIONARY_SELECTION_MODE_VALUES)[number];

export const DICTIONARY_STATUS_VALUES = ['ACTIVE', 'DISABLED'] as const;
export type DictionaryStatus = (typeof DICTIONARY_STATUS_VALUES)[number];

export interface DictionaryCategoryItem {
  userId: string;
  categoryId: string;
  code: string;
  name: string;
  description?: string;
  bizType: DictionaryBizType;
  selectionMode: DictionarySelectionMode;
  status: DictionaryStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DictionaryEntryItem {
  userId: string;
  itemId: string;
  categoryCode: string;
  categoryLookupKey: string;
  code: string;
  label: string;
  alias?: string[];
  description?: string;
  color?: string;
  status: DictionaryStatus;
  sortOrder: number;
  isSystem?: boolean;
  usageCount?: number;
  createdAt: string;
  updatedAt: string;
}
