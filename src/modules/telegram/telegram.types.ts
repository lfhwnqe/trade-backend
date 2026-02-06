export type TelegramBinding = {
  userId: string;
  chatId: number;
  telegramUserId?: number;
  telegramUsername?: string;
  createdAt: string;
  updatedAt: string;
};

export type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    date?: number;
    chat?: { id: number; type?: string; title?: string; username?: string };
    from?: { id: number; is_bot?: boolean; username?: string };
    text?: string;
  };
};
