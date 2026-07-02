export const PLAYBOOK_TEMPLATE_STATUS_VALUES = ['ACTIVE', 'DISABLED'] as const;
export type PlaybookTemplateStatus = (typeof PLAYBOOK_TEMPLATE_STATUS_VALUES)[number];

export const PLAYBOOK_TEMPLATE_STATUS_FILTER_VALUES = ['ACTIVE', 'DISABLED', 'ALL'] as const;
export type PlaybookTemplateStatusFilter = (typeof PLAYBOOK_TEMPLATE_STATUS_FILTER_VALUES)[number];

export const PLAYBOOK_TEMPLATE_IMAGE_SCOPE_VALUES = ['analysis', 'in-progress', 'completed-trend'] as const;
export type PlaybookTemplateImageScope = (typeof PLAYBOOK_TEMPLATE_IMAGE_SCOPE_VALUES)[number];

export const PLAYBOOK_TEMPLATE_SORT_BY_VALUES = ['CREATED_AT', 'UPDATED_AT', 'SORT_ORDER'] as const;
export type PlaybookTemplateSortBy = (typeof PLAYBOOK_TEMPLATE_SORT_BY_VALUES)[number];

export const PLAYBOOK_TEMPLATE_SORT_ORDER_VALUES = ['asc', 'desc'] as const;
export type PlaybookTemplateSortOrder = (typeof PLAYBOOK_TEMPLATE_SORT_ORDER_VALUES)[number];

export interface PlaybookTemplatePlaybookItem {
  code: string;
  label: string;
  color?: string;
  status?: string;
}

export interface PlaybookTemplate {
  id: string;
  userId: string;
  cardId: string;
  templateId: string;
  entityType: 'PLAYBOOK_TEMPLATE';
  playbookType: string;
  playbookItem?: PlaybookTemplatePlaybookItem;
  title: string;
  analysisImageUrl: string;
  analysisImageKey?: string;
  inProgressImageUrl: string;
  inProgressImageKey?: string;
  completedTrendImageUrl: string;
  completedTrendImageKey?: string;
  notes?: string;
  sortOrder?: number;
  status: PlaybookTemplateStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PlaybookTemplateCountItem {
  playbookType: string;
  playbookItem?: PlaybookTemplatePlaybookItem;
  totalCount: number;
  activeCount: number;
  disabledCount: number;
  limit: number;
}
