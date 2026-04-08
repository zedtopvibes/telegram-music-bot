// Store last message ID for each user
const userLastMessage = new Map();

export function getLastMessageId(chatId) {
  return userLastMessage.get(chatId);
}

export function setLastMessageId(chatId, messageId) {
  userLastMessage.set(chatId, messageId);
}

export async function deletePreviousMessage(chatId, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  const lastMessageId = getLastMessageId(chatId);
  if (lastMessageId) {
    await fetch(`${TELEGRAM_API}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: lastMessageId
      })
    }).catch(() => {}); // Ignore errors if message already deleted
  }
}