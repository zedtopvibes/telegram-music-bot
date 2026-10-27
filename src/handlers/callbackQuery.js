import { handleList } from "../contentHandlers.js"; // 👈 Keep this for the A-Z List
import { handleArtist } from "./content/artist.js";
import { handleAlbum } from "./content/album.js";
import { handleEp } from "./content/ep.js";
import { handlePlaylist } from "./content/playlist.js";
import { handleTrack } from "./content/track.js";
import { handleGetAllAlbum, handleGetAllEp, handleGetAllPlaylist } from "./content/getAll.js";
import { listYears, showYearContent } from "../commands/year.js";
import { showNewReleases } from "../commands/newreleases.js";
import { handleSubscriptionCheck } from "./subscriptionHandler.js";
import { deletePreviousMessage, setLastMessageId, deleteSearchPrompt, setSearchPromptId } from "../utils/userState.js";
import { checkSubscription } from "../middleware/checkSubscription.js";
import { trackUser } from "../utils/userTracker.js"; 
import { handleProfile } from "../commands/profile.js"; 

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

async function checkUserSubscription(chatId, env) {
  const subCheck = await checkSubscription(chatId, env);
  if (!subCheck.allowed) {
    return { allowed: false, message: subCheck.message, keyboard: subCheck.keyboard };
  }
  return { allowed: true };
}

export async function handleCallbackQuery(callbackQuery, env, ctx) {
  // Track user silently
  await trackUser(callbackQuery.from, ctx, env);

  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const messageId = callbackQuery.message.message_id;
  
  // 🪲 DEBUG: See if we receive the click
if (data.startsWith("filter_artists_")) {
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      callback_query_id: callbackQuery.id,
      text: "Debug: Button clicked!",
      show_alert: true
    })
  });
  // Don't return yet, let the code continue to see if it crashes
}
  
  
  // 1. Basic Buttons
  if (data === "check_subscription") {
    await handleSubscriptionCheck(callbackQuery, env);
    return;
  }
  
  if (data === "delete_message") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    }).catch(() => {});
    return;
  }
  
  if (data === "noop") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    return;
  }
  
  // 2. Force Subscription Check
  const subCheck = await checkUserSubscription(chatId, env);
  if (!subCheck.allowed) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: subCheck.message, reply_markup: subCheck.keyboard })
    });
    return;
  }
  
  // 3. Search & Profile
  if (data === "search") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await deleteSearchPrompt(chatId, env);
    const response = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: "🔍 Send me a song name, artist, album, EP, or playlist name to search." })
    });
    const responseData = await response.json();
    if (responseData.result) setSearchPromptId(chatId, responseData.result.message_id);
    return;
  }
  
  if (data === "profile") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await handleProfile(chatId, env, messageId, "main"); 
    return;
  }

  if (data.startsWith("profile_")) {
    const view = data.replace("profile_", ""); 
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await handleProfile(chatId, env, messageId, view);
    return;
  }
  
  // 4. Help & New Releases & Years
  if (data === "help") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await deletePreviousMessage(chatId, env);
    const response = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: `❓ Help Guide\n\n/track [name]\n/artist [name]\n/album [name]\n/ep [name]\n/playlist [name]\n\nOr type any name to search!` })
    });
    const responseData = await response.json();
    if (responseData.result) setLastMessageId(chatId, responseData.result.message_id);
    return;
  }
  
  if (data === "new_releases") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await deletePreviousMessage(chatId, env);
    const result = await showNewReleases(chatId, 1, env);
    if (result && result.message_id) setLastMessageId(chatId, result.message_id);
    return;
  }
  
  if (data.startsWith("page_new_")) {
    const page = parseInt(data.replace("page_new_", ""));
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await deletePreviousMessage(chatId, env);
    const result = await showNewReleases(chatId, page, env);
    if (result && result.message_id) setLastMessageId(chatId, result.message_id);
    return;
  }
  
  if (data === "browse_years") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await deletePreviousMessage(chatId, env);
    const result = await listYears(chatId, 1, env);
    if (result && result.message_id) setLastMessageId(chatId, result.message_id);
    return;
  }
  
  if (data.startsWith("page_years_")) {
    const page = parseInt(data.replace("page_years_", ""));
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await deletePreviousMessage(chatId, env);
    const result = await listYears(chatId, page, env);
    if (result && result.message_id) setLastMessageId(chatId, result.message_id);
    return;
  }
  
  if (data.startsWith("year_content_")) {
    const parts = data.split("_");
    const year = parts[2];
    const page = parseInt(parts[3]);
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await deletePreviousMessage(chatId, env);
    const result = await showYearContent(chatId, year, page, env);
    if (result && result.message_id) setLastMessageId(chatId, result.message_id);
    return;
  }
  
  if (data.startsWith("page_year_")) {
    const parts = data.split("_");
    const year = parts[2];
    const page = parseInt(parts[3]);
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await deletePreviousMessage(chatId, env);
    const result = await showYearContent(chatId, year, page, env);
    if (result && result.message_id) setLastMessageId(chatId, result.message_id);
    return;
  }
  
  // 5. Main Lists (Artists, Albums, etc.)
  if (data === "list_artists") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    const result = await handleList(chatId, "artists", 1, env, "", null);
    if (result && result.message_id) setLastMessageId(chatId, result.message_id);
    return;
  }
  
  if (data === "list_albums") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    const result = await handleList(chatId, "albums", 1, env, "", null);
    if (result && result.message_id) setLastMessageId(chatId, result.message_id);
    return;
  }
  
  if (data === "list_eps") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    const result = await handleList(chatId, "eps", 1, env, "", null);
    if (result && result.message_id) setLastMessageId(chatId, result.message_id);
    return;
  }
  
  if (data === "list_playlists") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    const result = await handleList(chatId, "playlists", 1, env, "", null);
    if (result && result.message_id) setLastMessageId(chatId, result.message_id);
    return;
  }

  // 👇 6. A-Z FILTER ROUTING (Must be here, before Pagination!)
  if (data.startsWith("filter_artists_")) {
    const parts = data.split("_");
    const letter = parts[2]; // "SHOW_ALPHABET", "A", "B", "NUM", "ALL"
    const page = parseInt(parts[3]) || 1;
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    // We pass messageId so it EDITS the message instead of sending a new one
    const result = await handleList(chatId, "artists", page, env, letter, messageId);
    if (result && result.message_id) {
      setLastMessageId(chatId, result.message_id);
    }
    return;
  }
  
  // 7. Pagination (For lists and years)
  if (data.startsWith("page_")) {
    const parts = data.split("_");
    const listType = parts[1];
    const page = parseInt(parts[2]);
    const filterLetter = parts[3] || ""; 
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    const result = await handleList(chatId, listType, page, env, filterLetter, messageId);
    if (result && result.message_id) {
      setLastMessageId(chatId, result.message_id);
    }
    return;
  }

  // 8. Content Buttons (Artist, Album, EP, Playlist, Track, Get All)
  if (data.startsWith("track_")) { await handleTrack(callbackQuery, env, ctx); return; }
  if (data.startsWith("artist_")) { await handleArtist(callbackQuery, env); return; }
  if (data.startsWith("album_")) { await handleAlbum(callbackQuery, env); return; }
  if (data.startsWith("ep_")) { await handleEp(callbackQuery, env); return; }
  if (data.startsWith("playlist_")) { await handlePlaylist(callbackQuery, env); return; }
  if (data.startsWith("getall_album_")) { await handleGetAllAlbum(callbackQuery, env, ctx); return; }
  if (data.startsWith("getall_ep_")) { await handleGetAllEp(callbackQuery, env, ctx); return; }
  if (data.startsWith("getall_playlist_")) { await handleGetAllPlaylist(callbackQuery, env, ctx); return; }
}