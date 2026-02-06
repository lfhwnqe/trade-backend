export type ApiTokenScope = 'trade:read' | 'trade:write' | 'trade:delete';

export type ApiTokenRecord = {
  tokenId: string;
  tokenHash: string;
  userId: string;
  name?: string;
  scopes: ApiTokenScope[];
  createdAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
};

export type ApiTokenPublic = Omit<ApiTokenRecord, 'tokenHash'>;
