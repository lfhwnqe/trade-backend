export type WebhookHook = {
  hookId: string;
  userId: string;
  name?: string;
  // legacy auth (deprecated): secretHash is kept for backward compatibility.
  secretHash?: string;
  createdAt: string;
  revokedAt?: string;

  // TradingView-friendly trigger token (no headers needed)
  // NOTE: This token is a secret (acts like an API key) and is embedded in the URL.
  triggerToken?: string;

  // Trade-scoped: 1 trade = 1 webhook
  tradeTransactionId?: string;
  tradeShortId?: string;

  // one hook -> one telegram group (chat)
  chatId?: number;
  chatType?: string;
  chatTitle?: string;
  boundAt?: string;

  // rate limit
  lastTriggeredAt?: string;
};

export type CreateWebhookHookResult = {
  hook: Omit<WebhookHook, 'secretHash'>;
  bindCode: string; // used in telegram group: /bind <bindCode>

  // A single unique URL (no header), for TradingView
  triggerUrl: string;
};
