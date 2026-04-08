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
import { handleCallbackQuery } from "./handlers/callbackQuery.js";
import { handleMessage } from "./handlers/messageHandler.js";
import { handleGetAllAlbum, handleGetAllEp, handleGetAllPlaylist, handleTrack as handleTrackDirect } from "./handlers/contentHandlers.js";
import { getDeepLink } from "./utils/deepLinks.js";

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

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
  const TELEGRAM_API_URL = TELEGRAM_API(BOT_TOKEN);
  
  // Handle callback queries (button clicks)
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, env);
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
        await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `⚠️ This request belongs to another user. Please make your own request using /track or search.`
          })
        });
        return;
      }
      
      // Process the request based on type
      if (request.trackData.type === 'track') {
        const fakeCallback = {
          id: Date.now().toString(),
          data: `track_${request.trackData.id}`,
          message: { chat: { id: chatId } }
        };
        await handleTrackDirect(fakeCallback, env);
      } else if (request.trackData.type === 'getall_album') {
        const fakeCallback = {
          id: Date.now().toString(),
          data: `getall_album_${request.trackData.id}`,
          message: { chat: { id: chatId } }
        };
        await handleGetAllAlbum(fakeCallback, env);
      } else if (request.trackData.type === 'getall_ep') {
        const fakeCallback = {
          id: Date.now().toString(),
          data: `getall_ep_${request.trackData.id}`,
          message: { chat: { id: chatId } }
        };
        await handleGetAllEp(fakeCallback, env);
      } else if (request.trackData.type === 'getall_playlist') {
        const fakeCallback = {
          id: Date.now().toString(),
          data: `getall_playlist_${request.trackData.id}`,
          message: { chat: { id: chatId } }
        };
        await handleGetAllPlaylist(fakeCallback, env);
      }
      
      return;
    }
    
    // Handle regular messages
    await handleMessage(update.message, env);
  }
}