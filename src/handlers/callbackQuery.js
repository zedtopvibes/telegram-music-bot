import { handleList } from "../commands/list.js";
import { listYears, showYearContent } from "../commands/year.js";
import { showNewReleases } from "../commands/newreleases.js";
import { handleSubscriptionCheck } from "./subscriptionHandler.js";
import { handleArtist, handleAlbum, handleEp, handlePlaylist, handleTrack, handleGetAllAlbum, handleGetAllEp, handleGetAllPlaylist } from "./contentHandlers.js";
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
  await trackUser(callbackQuery.from, ctx, env);

  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const messageId = callbackQuery.message.message_id;
  
  if (data === "check_subscription") {
    await handleSubscriptionCheck(callbackQuery, env);
    return;
  }
  
  if (data === "delete_message") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    }).catch(() => {});
    return;
  }
  
  if (data === "noop") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    return;
  }
  
  const subCheck = await checkUserSubscription(chatId, env);
  if (!subCheck.allowed) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
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
  
  if (data === "search") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await deleteSearchPrompt(chatId, env);
    const response = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "🔍 Send me a song name, artist, album, EP, or playlist name to search."
      })
    });
    const responseData = await response.json();
    if (responseData.result) {
      setSearchPromptId(chatId, responseData.result.message_id);
    }
    return;
  }
  
  if (data === "profile") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await handleProfile(chatId, env, messageId, "main"); 
    return;
  }

  if (data.startsWith("profile_")) {
    const view = data.replace("profile_", ""); 
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await handleProfile(chatId, env, messageId, view);
    return;
  }
  
  if (data === "help") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await deletePreviousMessage(chatId, env);
    const response = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `❓ Help Guide\n\nAvailable Commands:\n/track [name] - Search for tracks\n/artist [name] - View artist profile\n/album [name] - View album\n/ep [name] - View EP\n/playlist [name] - View playlist\n\nOr simply type any artist or song name to search!`
      })
    });
    const responseData = await response.json();
    if (responseData.result) setLastMessageId(chatId, responseData.result.message_id);
    return;
  }
  
  if (data === "new_releases") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await deletePreviousMessage(chatId, env);
    const result = await showNewReleases(chatId, page, env);
    if (result && result.message_id) setLastMessageId(chatId, result.message_id);
    return;
  }
  
  if (data === "browse_years") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await deletePreviousMessage(chatId, env);
    const result = await showYearContent(chatId, year, page, env);
    if (result && result.message_id) setLastMessageId(chatId, result.message_id);
    return;
  }
  
  if (data === "list_artists") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await deletePreviousMessage(chatId, env);
    const result = await handleList(chatId, "artists", 1, env);
    if (result && result.message_id) setLastMessageId(chatId, result.message_id);
    return;
  }
  
  if (data === "list_albums") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await deletePreviousMessage(chatId, env);
    const result = await handleList(chatId, "albums", 1, env);
    if (result && result.message_id) setLastMessageId(chatId, result.message_id);
    return;
  }
  
  if (data === "list_eps") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await deletePreviousMessage(chatId, env);
    const result = await handleList(chatId, "eps", 1, env);
    if (result && result.message_id) setLastMessageId(chatId, result.message_id);
    return;
  }
  
  if (data === "list_playlists") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await deletePreviousMessage(chatId, env);
    const result = await handleList(chatId, "playlists", 1, env);
    if (result && result.message_id) setLastMessageId(chatId, result.message_id);
    return;
  }
  
  if (data.startsWith("page_")) {
    const parts = data.split("_");
    const listType = parts[1];
    const page = parseInt(parts[2]);
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await deletePreviousMessage(chatId, env);
    const result = await handleList(chatId, listType, page, env);
    if (result && result.message_id) setLastMessageId(chatId, result.message_id);
    return;
  }
  
  // CONTENT BUTTONS (Direct download in private chat)
  if (data.startsWith("track_")) {
    await handleTrack(callbackQuery, env, ctx);
    return;
  }
  
  if (data.startsWith("artist_")) {
    await handleArtist(callbackQuery, env);
    return;
  }
  
  if (data.startsWith("album_")) {
    await handleAlbum(callbackQuery, env);
    return;
  }
  
  if (data.startsWith("ep_")) {
    await handleEp(callbackQuery, env);
    return;
  }
  
  if (data.startsWith("playlist_")) {
    await handlePlaylist(callbackQuery, env);
    return;
  }
  
  if (data.startsWith("getall_album_")) {
    await handleGetAllAlbum(callbackQuery, env, ctx);
    return;
  }
  
  if (data.startsWith("getall_ep_")) {
    await handleGetAllEp(callbackQuery, env, ctx);
    return;
  }
  
  if (data.startsWith("getall_playlist_")) {
    await handleGetAllPlaylist(callbackQuery, env, ctx);
    return;
  }
}