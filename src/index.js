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
import { handleGetAllAlbum, handleGetAllEp, handleGetAllPlaylist, handleTrack as handleTrackDirect } from "./handlers/contentHandlers.js";
import { getDeepLink } from "./utils/deepLinks.js";
import { checkSubscription } from "./middleware/checkSubscription.js";

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

// ==========================================
// BOT SETUP (Menu Button + Commands)
// ==========================================

async function setupBotMenu(env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API_URL = TELEGRAM_API(BOT_TOKEN);
  
  try {
    await fetch(`${TELEGRAM_API_URL}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: { type: "commands" }
      })
    });
    
    await fetch(`${TELEGRAM_API_URL}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commands: [
          { command: "start", description: "🏠 Main menu" },
          { command: "profile", description: "👤 My Profile" },
          { command: "help", description: "❓ Help" }
        ]
      })
    });
    
    console.log("Bot menu setup complete");
  } catch (error) {
    console.error("Menu setup error:", error);
  }
}

// ==========================================
// MAIN WORKER
// ==========================================

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
    
    if (request.method === "GET" && url.pathname === "/health") {
      return new Response("Bot is running!", { status: 200 });
    }
    
    return new Response("Not found", { status: 404 });
  },
};

// ==========================================
// UPDATE HANDLER
// ==========================================

async function handleUpdate(update, env, ctx) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API_URL = TELEGRAM_API(BOT_TOKEN);
  
  // Handle callback queries (button clicks)
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, env, ctx);
    return;
  }
  
  // Handle messages
  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text || "";
    const chatType = update.message.chat.type;
    const isGroup = chatType === 'group' || chatType === 'supergroup';
    
    // Handle deep link start parameter
    if (text.startsWith("/start ")) {
      const requestId = text.replace("/start ", "").trim();
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
      
      // Check if user is the requester
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
              body: JSON.stringify({
                chat_id: chatId,
                message_id: alertData.result.message_id
              })
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
      
      // Process the request based on type with subscription check
      if (request.trackData.type === 'track') {
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
          data: `track_${request.trackData.id}`,
          message: { chat: { id: chatId } }
        };
        await handleTrackDirect(fakeCallback, env, ctx);
        
      } else if (request.trackData.type === 'getall_album') {
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
          data: `getall_album_${request.trackData.id}`,
          message: { chat: { id: chatId } }
        };
        await handleGetAllAlbum(fakeCallback, env, ctx);
        
      } else if (request.trackData.type === 'getall_ep') {
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
          data: `getall_ep_${request.trackData.id}`,
          message: { chat: { id: chatId } }
        };
        await handleGetAllEp(fakeCallback, env, ctx);
        
      } else if (request.trackData.type === 'getall_playlist') {
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
          data: `getall_playlist_${request.trackData.id}`,
          message: { chat: { id: chatId } }
        };
        await handleGetAllPlaylist(fakeCallback, env, ctx);
      }
      
      return;
    }
    
    // Handle regular messages
    await handleMessage(update.message, env, ctx);
  }
}