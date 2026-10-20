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
import { handleInlineQuery } from "./handlers/inlineHandler.js"; 
import { handleGetAllAlbum, handleGetAllEp, handleGetAllPlaylist, handleTrack as handleTrackDirect } from "./handlers/contentHandlers.js";
import { getDeepLink } from "./utils/deepLinks.js";
import { checkSubscription } from "./middleware/checkSubscription.js";

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
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API_URL = TELEGRAM_API(BOT_TOKEN);
  
  // 1. Handle Inline Queries (When typing @bot ...)
  if (update.inline_query) {
    await handleInlineQuery(update.inline_query, env);
    return;
  }
  
  // 2. Handle Button Clicks
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, env, ctx);
    return;
  }
  
  // 3. Handle Messages
  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text || "";
    
    if (text.startsWith("/start ")) {
      const requestId = text.replace("/start ", "").trim();
      
      // --- INLINE DEEP LINKS (New) ---
      if (requestId.startsWith("inline_")) {
        const parts = requestId.split("_");
        const type = parts[1]; // track, artist, album, etc.
        const id = parts[2];   // The ID

        const fakeCallback = { 
          id: Date.now().toString(), 
          data: `${type}_${id}`, 
          from: update.message.from,
          message: { chat: { id: chatId } } 
        };

        if (type === "track") {
          await handleTrackDirect(fakeCallback, env, ctx);
        } else if (type === "artist") {
          await handleArtist(fakeCallback, env);
        } else if (type === "album") {
          await handleAlbum(fakeCallback, env);
        } else if (type === "ep") {
          await handleEp(fakeCallback, env);
        } else if (type === "playlist") {
          await handlePlaylist(fakeCallback, env);
        }
        return;
      }

      // --- GROUP DEEP LINKS (Old working logic) ---
      const request = getDeepLink(requestId);
      
      if (!request) {
        await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "❌ This link has expired or is invalid. Please make a new request."
          })
        });
        return;
      }
      
      const isGroup = update.message.chat.type === 'group' || update.message.chat.type === 'supergroup';

      if (request.userId !== chatId) {
        if (isGroup) {
          const alertMsg = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `⚠️ This request belongs to another user. Please make your own request using /track or search.`,
              reply_to_message_id: update.message.message_id
            })
          });
          const alertData = await alertMsg.json();
          
          setTimeout(async () => {
            await fetch(`${TELEGRAM_API_URL}/deleteMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, message_id: alertData.result.message_id })
            }).catch(() => {});
          }, 5000);
        } else {
          await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `⚠️ This request belongs to another user. Please make your own request using /track or search.`
            })
          });
        }
        return;
      }
      
      const subCheck = await checkSubscription(chatId, env);
      if (!subCheck.allowed) {
        await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
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
      
      const fakeCallback = { 
        id: Date.now().toString(), 
        from: update.message.from,
        message: { chat: { id: chatId } } 
      };

      if (request.trackData.type === 'track') {
        fakeCallback.data = `track_${request.trackData.id}`;
        await handleTrackDirect(fakeCallback, env, ctx);
      } else if (request.trackData.type === 'getall_album') {
        fakeCallback.data = `getall_album_${request.trackData.id}`;
        await handleGetAllAlbum(fakeCallback, env, ctx);
      } else if (request.trackData.type === 'getall_ep') {
        fakeCallback.data = `getall_ep_${request.trackData.id}`;
        await handleGetAllEp(fakeCallback, env, ctx);
      } else if (request.trackData.type === 'getall_playlist') {
        fakeCallback.data = `getall_playlist_${request.trackData.id}`;
        await handleGetAllPlaylist(fakeCallback, env, ctx);
      }
      
      return;
    }
    
    // Normal messages (not deep links)
    await handleMessage(update.message, env, ctx);
  }
}