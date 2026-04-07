import { handleStart } from "./commands/start.js";
import { handleForceSub } from "./commands/forcesub.js";
import { checkSubscription } from "./middleware/checkSubscription.js";

export default {
  async fetch(request, env, ctx) {
    if (request.method === "POST" && new URL(request.url).pathname === "/webhook") {
      try {
        const update = await request.json();
        ctx.waitUntil(handleUpdate(update, env));
        return new Response("OK", { status: 200 });
      } catch (error) {
        console.error("Webhook error:", error);
        return new Response("Error", { status: 500 });
      }
    }
    
    return new Response("Not found", { status: 404 });
  },
};

async function handleUpdate(update, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  // Handle callback queries (Done button)
  if (update.callback_query) {
    const chatId = update.callback_query.message.chat.id;
    const data = update.callback_query.data;
    const messageId = update.callback_query.message.message_id;
    
    if (data === "check_subscription") {
      // Acknowledge callback
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: update.callback_query.id })
      });
      
      // Re-check subscription
      const subCheck = await checkSubscription(chatId, env);
      
      if (subCheck.allowed) {
        // Edit original message to confirm success
        await fetch(`${TELEGRAM_API}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: "✅ Thank you for joining! You can now use the bot."
          })
        });
      } else {
        // Keep the same message, user still not joined
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: update.callback_query.id,
            text: "You haven't joined the channel yet. Please join first.",
            show_alert: true
          })
        });
      }
    }
    return;
  }
  
  // Handle messages
  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text || "";
    const firstName = update.message.chat.first_name || "User";
    
    // Skip force sub check for /forcesub commands (admin only)
    if (text.startsWith("/forcesub")) {
      await handleForceSub(text, chatId, env);
      return;
    }
    
    // Check subscription for all other commands
    const subCheck = await checkSubscription(chatId, env);
    
    if (!subCheck.allowed) {
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: subCheck.message,
          reply_markup: subCheck.keyboard
        })
      });
      return;
    }
    
    // Handle /start command
    if (text === "/start") {
      await handleStart(chatId, firstName, env);
    } else if (text && !text.startsWith("/")) {
      // Future search feature
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `You said: ${text}`
        })
      });
    } else if (text.startsWith("/")) {
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Command not recognized. Try /start"
        })
      });
    }
  }
}