import { checkSubscription } from "../middleware/checkSubscription.js";
import { handleStart } from "../commands/start.js"; // 👈 Import handleStart

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

export async function handleSubscriptionCheck(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const firstName = callbackQuery.from.first_name || "User";
  
  const subCheck = await checkSubscription(chatId, env);
  
  if (subCheck.allowed) {
    // 1. Answer the callback to stop the loading spinner
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    // 2. Delete the old "Please join" message to keep the chat clean
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    }).catch(() => {});
    
    // 3. Automatically trigger the Start Menu!
    await handleStart(chatId, firstName, env);
    
  } else {
    // User hasn't joined yet
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