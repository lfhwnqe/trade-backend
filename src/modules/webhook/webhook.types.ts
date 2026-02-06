export type WebhookHook = {
  hookId: string;
  userId: string;
  name?: string;
  secretHash: string;
  createdAt: string;
  revokedAt?: string;

  // one hook -> one telegram group (chat)
  chatId?: number;
  chatType?: string;
  chatTitle?: string;
  boundAt?: string;
};

export type CreateWebhookHookResult = {
  hook: Omit<WebhookHook, 'secretHash'>;
  secret: string; // only returned once
  url: string;
  bindCode: string; // only returned once (used in telegram group: /bind <bindCode>)
};
