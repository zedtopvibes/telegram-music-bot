import { handleList } from "../commands/list.js";
import { listYears, showYearContent } from "../commands/year.js";
import { showNewReleases } from "../commands/newreleases.js";
import { handleSubscriptionCheck } from "./subscriptionHandler.js";
import { handleArtist, handleAlbum, handleEp, handlePlaylist, handleTrack, handleGetAllAlbum, handleGetAllEp, handleGetAllPlaylist } from "./contentHandlers.js";

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

export async function handleCallbackQuery(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const messageId = callbackQuery.message.message_id;
  
  // Handle subscription check button
  if (data === "check_subscription") {
    await handleSubscriptionCheck(callbackQuery, env);
    return;
  }
  
  // Handle Delete Message button
  if (data === "delete_message") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    }).catch(() => {});
    return;
  }
  
  // Handle noop (do nothing)
  if (data === "noop") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    return;
  }
  
  // Handle Search button
  if (data === "search") {
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
        text: "🔍 Send me a song name, artist, album, EP, or playlist name to search."
      })
    });
    return;
  }
  
  // Handle Help button
  if (data === "help") {
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
        text: `❓ Help Guide

Available Commands:
/track [name] - Search for tracks
/artist [name] - View artist profile
/album [name] - View album
/ep [name] - View EP
/playlist [name] - View playlist

Or simply type any artist or song name to search!

Click buttons below to browse all content.

Need more help? Contact @ZedTopVibes`
      })
    });
    return;
  }
  
  // Handle New Releases button
  if (data === "new_releases") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await showNewReleases(chatId, 1, env);
    return;
  }
  
  // Handle New Releases pagination
  if (data.startsWith("page_new_")) {
    const page = parseInt(data.replace("page_new_", ""));
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    }).catch(() => {});
    
    await showNewReleases(chatId, page, env);
    return;
  }
  
  // Handle Browse Years button
  if (data === "browse_years") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await listYears(chatId, 1, env);
    return;
  }
  
  // Handle Year pagination
  if (data.startsWith("page_years_")) {
    const page = parseInt(data.replace("page_years_", ""));
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    }).catch(() => {});
    
    await listYears(chatId, page, env);
    return;
  }
  
  // Handle Year Content selection
  if (data.startsWith("year_content_")) {
    const parts = data.split("_");
    const year = parts[2];
    const page = parseInt(parts[3]);
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    }).catch(() => {});
    
    await showYearContent(chatId, year, page, env);
    return;
  }
  
  // Handle Year Content pagination
  if (data.startsWith("page_year_")) {
    const parts = data.split("_");
    const year = parts[2];
    const page = parseInt(parts[3]);
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    }).catch(() => {});
    
    await showYearContent(chatId, year, page, env);
    return;
  }
  
  // Handle List buttons
  if (data === "list_artists") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await handleList(chatId, "artists", 1, env);
    return;
  }
  
  if (data === "list_albums") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await handleList(chatId, "albums", 1, env);
    return;
  }
  
  if (data === "list_eps") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await handleList(chatId, "eps", 1, env);
    return;
  }
  
  if (data === "list_playlists") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await handleList(chatId, "playlists", 1, env);
    return;
  }
  
  // Handle Pagination for lists
  if (data.startsWith("page_")) {
    const parts = data.split("_");
    const listType = parts[1];
    const page = parseInt(parts[2]);
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    }).catch(() => {});
    
    await handleList(chatId, listType, page, env);
    return;
  }
  
  // Handle content buttons (artist_, album_, ep_, playlist_, track_, getall_)
  await handleContentButtons(callbackQuery, env);
}

async function handleContentButtons(callbackQuery, env) {
  const data = callbackQuery.data;
  
  if (data.startsWith("artist_")) {
    await handleArtist(callbackQuery, env);
  } else if (data.startsWith("album_")) {
    await handleAlbum(callbackQuery, env);
  } else if (data.startsWith("ep_")) {
    await handleEp(callbackQuery, env);
  } else if (data.startsWith("playlist_")) {
    await handlePlaylist(callbackQuery, env);
  } else if (data.startsWith("track_")) {
    await handleTrack(callbackQuery, env);
  } else if (data.startsWith("getall_album_")) {
    await handleGetAllAlbum(callbackQuery, env);
  } else if (data.startsWith("getall_ep_")) {
    await handleGetAllEp(callbackQuery, env);
  } else if (data.startsWith("getall_playlist_")) {
    await handleGetAllPlaylist(callbackQuery, env);
  }
}