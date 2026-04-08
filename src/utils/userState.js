// Store last message ID for each user
const userLastMessage = new Map();
// Store search prompt message ID for each user
const userSearchPrompt = new Map();

export function getLastMessageId(chatId) {
  return userLastMessage.get(chatId);
}

export function setLastMessageId(chatId, messageId) {
  userLastMessage.set(chatId, messageId);
}

export function getSearchPromptId(chatId) {
  return userSearchPrompt.get(chatId);
}

export function setSearchPromptId(chatId, messageId) {
  userSearchPrompt.set(chatId, messageId);
}

export async function deleteSearchPrompt(chatId, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  const searchPromptId = getSearchPromptId(chatId);
  if (searchPromptId) {
    await fetch(`${TELEGRAM_API}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: searchPromptId
      })
    }).catch(() => {});
    userSearchPrompt.delete(chatId);
  }
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