// Main entry point for Cloudflare Worker
import { handleStart } from "./commands/start.js";

export default {
  async fetch(request, env, ctx) {
    // Handle webhook verification for Telegram
    if (request.method === "POST" && new URL(request.url).pathname === "/webhook") {
      try {
        const update = await request.json();
        
        // Process the update in background (don't wait for response)
        ctx.waitUntil(handleUpdate(update, env));
        
        return new Response("OK", { status: 200 });
      } catch (error) {
        console.error("Webhook error:", error);
        return new Response("Error", { status: 500 });
      }
    }
    
    // Health check endpoint
    if (request.method === "GET" && new URL(request.url).pathname === "/health") {
      return new Response("Bot is running!", { status: 200 });
    }
    
    return new Response("Not found", { status: 404 });
  },
};

async function handleUpdate(update, env) {
  try {
    // Handle message updates
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || "";
      const firstName = update.message.chat.first_name || "User";
      
      // Handle /start command
      if (text === "/start") {
        await handleStart(chatId, firstName, env);
      }
      // Handle text search (non-command messages)
      else if (text && !text.startsWith("/")) {
        // We'll implement search later
        await handleTextSearch(chatId, text, env);
      }
      // Unknown command
      else if (text.startsWith("/")) {
        await sendMessage(chatId, env, "❌ Command not recognized. Try /start");
      }
    }
    
    // Handle callback queries (button presses)
    if (update.callback_query) {
      const chatId = update.callback_query.message.chat.id;
      const data = update.callback_query.data;
      
      // Acknowledge callback
      await answerCallbackQuery(update.callback_query.id, env);
      
      // Handle different button actions
      switch(data) {
        case "search":
          await sendMessage(chatId, env, "🔍 Send me a song name, artist, or genre to search!");
          break;
        case "trending":
          await sendMessage(chatId, env, "🔥 Trending tracks feature coming soon!");
          break;
        case "artists":
          await sendMessage(chatId, env, "🎤 Artists list coming soon!");
          break;
        case "albums":
          await sendMessage(chatId, env, "📀 Albums list coming soon!");
          break;
        case "about":
          await sendMessage(chatId, env, "ℹ️ ZedTopVibes Bot\n\nStream Zambian music directly on Telegram.\n\nVersion: 0.1.0 (Test Mode)");
          break;
        default:
          await sendMessage(chatId, env, "Coming soon!");
      }
    }
    
  } catch (error) {
    console.error("Error handling update:", error);
  }
}

// Helper: Send message
async function sendMessage(chatId, env, text, replyMarkup = null) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
  };
  
  if (replyMarkup) {
    body.reply_markup = JSON.stringify(replyMarkup);
  }
  
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  
  return response.json();
}

// Helper: Answer callback query
async function answerCallbackQuery(callbackQueryId, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });
}

// Placeholder for text search (will implement later)
async function handleTextSearch(chatId, query, env) {
  await sendMessage(chatId, env, `🔍 Searching for "${query}"...\n\nSearch feature coming soon!`);
}