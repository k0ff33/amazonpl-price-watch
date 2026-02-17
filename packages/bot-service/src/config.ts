function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),
  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
  adminChatId: Number(required('TELEGRAM_ADMIN_CHAT_ID')),
  amazonAssociateTag: required('AMAZON_ASSOCIATE_TAG'),
};
