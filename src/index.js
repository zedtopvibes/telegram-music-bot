import { handleStart } from "./commands/start.js";
import { handleForceSub } from "./commands/forcesub.js";
import { handleSearch } from "./commands/search.js";
import { handleArtist } from "./commands/artist.js";
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
      // Re-check subscription
      const subCheck = await checkSubscription(chatId, env);
      
      if (subCheck.allowed) {
        // Acknowledge callback first
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: update.callback_query.id })
        });
        
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
        // User still not joined - show popup alert
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: update.callback_query.id,
            text: "❌ You haven't joined the channel yet. Please join first!",
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
    } 
    // Handle /artist command
    else if (text.startsWith("/artist")) {
      const artistName = text.replace("/artist", "").trim();
      if (artistName) {
        await handleArtist(chatId, artistName, env);
      } else {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "Usage: /artist [artist name]\nExample: /artist Kanina"
          })
        });
      }
    }
    // Handle search (any text that doesn't start with /)
    else if (text && !text.startsWith("/")) {
      await handleSearch(chatId, text, env);
    } 
    // Handle unknown commands
    else if (text.startsWith("/")) {
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