import { handleStart } from "./commands/start.js";
import { handleForceSub } from "./commands/forcesub.js";
import { handleSearch } from "./commands/search.js";
import { handleTrack } from "./commands/track.js";
import { handleArtist } from "./commands/artist.js";
import { handleAlbum } from "./commands/album.js";
import { handleEp } from "./commands/ep.js";
import { handlePlaylist } from "./commands/playlist.js";
import { handleList } from "./commands/list.js";
import { listYears, showYearContent } from "./commands/year.js";
import { showNewReleases } from "./commands/newreleases.js";
import { handleStats } from "./commands/stats.js";
import { handleCallbackQuery } from "./handlers/callbackQuery.js";
import { handleMessage } from "./handlers/messageHandler.js";
import { handleInlineQuery } from "./handlers/inlineHandler.js"; // 👈 NEW IMPORT

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

async function setupBotMenu(env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API_URL = TELEGRAM_API(BOT_TOKEN);
  
  try {
    await fetch(`${TELEGRAM_API_URL}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menu_button: { type: "commands" } })
    });
    
    await fetch(`${TELEGRAM_API_URL}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commands: [
          { command: "start", description: "🏠 Main menu" },
          { command: "profile", description: "👤 My Profile" },
          { command: "info", description: "ℹ️ About the Bot" },
          { command: "help", description: "❓ Help" }
        ]
      })
    });
  } catch (error) {
    console.error("Menu setup error:", error);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === "/setup") {
      await setupBotMenu(env);
      return new Response("Menu setup complete", { status: 200 });
    }
    
    if (request.method === "POST" && url.pathname === "/webhook") {
      try {
        const update = await request.json();
        ctx.waitUntil(handleUpdate(update, env, ctx));
        return new Response("OK", { status: 200 });
      } catch (error) {
        console.error("Webhook error:", error);
        return new Response("Error", { status: 500 });
      }
    }
    
    return new Response("Not found", { status: 404 });
  },
};

async function handleUpdate(update, env, ctx) {
  // 👈 1. Handle Inline Queries (When typing @bot ...)
  if (update.inline_query) {
    await handleInlineQuery(update.inline_query, env);
    return;
  }
  
  // 2. Handle Button Clicks
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, env, ctx);
    return;
  }
  
  // 3. Handle Text Messages
  if (update.message) {
    await handleMessage(update.message, env, ctx);
  }
}