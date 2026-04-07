import { checkSubscription } from "../middleware/checkSubscription.js";

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

export async function handleSubscriptionCheck(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  
  const subCheck = await checkSubscription(chatId, env);
  
  if (subCheck.allowed) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: "✅ Thank you for joining! You can now use the bot."
      })
    });
  } else {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQuery.id,
        text: "❌ You haven't joined the channel yet. Please join first!",
        show_alert: true
      })
    });
  }
}