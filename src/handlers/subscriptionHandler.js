import { checkSubscription } from "../middleware/checkSubscription.js";
import { handleStart } from "../commands/start.js";

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

export async function handleSubscriptionCheck(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const firstName = callbackQuery.from.first_name || "User";
  
  const subCheck = await checkSubscription(chatId, env);
  
  if (subCheck.allowed) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    // 👇 GET THE ORIGINAL MESSAGE ID TO CREATE THE QUOTE BLOCK
    let replyId = null;
    if (callbackQuery.message.reply_to_message) {
      // If the "Please join" message was a reply to the /start command
      replyId = callbackQuery.message.reply_to_message.message_id;
    } else {
      // Fallback: If it wasn't a reply, we just reply to the message the button is attached to
      replyId = messageId; 
    }

    // Delete the "Please join" message
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    }).catch(() => {});
    
    // Trigger Start Menu AND Reply to the original message
    await handleStart(chatId, firstName, env, replyId);
    
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