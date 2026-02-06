export type WebhookHook = {
  hookId: string;
  userId: string;
  name?: string;
  secretHash: string;
  createdAt: string;
  revokedAt?: string;
};

export type CreateWebhookHookResult = {
  hook: Omit<WebhookHook, 'secretHash'>;
  secret: string; // only returned once
  url: string;
};
