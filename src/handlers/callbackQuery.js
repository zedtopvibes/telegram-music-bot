import { handleList } from "../commands/list.js";
import { listYears, showYearContent } from "../commands/year.js";
import { showNewReleases } from "../commands/newreleases.js";
import { handleSubscriptionCheck } from "./subscriptionHandler.js";
import { handleArtist, handleAlbum, handleEp, handlePlaylist, handleTrack, handleGetAllAlbum, handleGetAllEp, handleGetAllPlaylist } from "./contentHandlers.js";
import { deletePreviousMessage, setLastMessageId, deleteSearchPrompt, setSearchPromptId } from "../utils/userState.js";
import { checkSubscription } from "../middleware/checkSubscription.js";
import { storeDeepLink, generateDeepLink } from "../utils/deepLinks.js";

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;
const IMAGE_CDN = "https://zedtopvibes.com";

async function checkUserSubscription(chatId, env) {
  const subCheck = await checkSubscription(chatId, env);
  if (!subCheck.allowed) {
    return { allowed: false, message: subCheck.message, keyboard: subCheck.keyboard };
  }
  return { allowed: true };
}

export async function handleCallbackQuery(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const BOT_USERNAME = env.BOT_USERNAME;
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const messageId = callbackQuery.message.message_id;
  const chatType = callbackQuery.message.chat.type;
  const isGroup = chatType === 'group' || chatType === 'supergroup';
  
  // Handle subscription check button (no force sub check needed - it IS the check)
  if (data === "check_subscription") {
    await handleSubscriptionCheck(callbackQuery, env);
    return;
  }
  
  // Handle Delete Message button (no force sub check needed - just cleanup)
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
  
  // Handle noop (do nothing) - no force sub check needed
  if (data === "noop") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    return;
  }
  
  // For private chats, check subscription
  if (!isGroup) {
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
  }
  
  // Handle Search button
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
  
  // Handle Help button
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
    
    const responseData = await response.json();
    if (responseData.result) {
      setLastMessageId(chatId, responseData.result.message_id);
    }
    return;
  }
  
  // Handle New Releases button
  if (data === "new_releases") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    await deletePreviousMessage(chatId, env);
    
    const result = await showNewReleases(chatId, 1, env);
    if (result && result.message_id) {
      setLastMessageId(chatId, result.message_id);
    }
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
    
    await deletePreviousMessage(chatId, env);
    
    const result = await showNewReleases(chatId, page, env);
    if (result && result.message_id) {
      setLastMessageId(chatId, result.message_id);
    }
    return;
  }
  
  // Handle Browse Years button
  if (data === "browse_years") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    await deletePreviousMessage(chatId, env);
    
    const result = await listYears(chatId, 1, env);
    if (result && result.message_id) {
      setLastMessageId(chatId, result.message_id);
    }
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
    
    await deletePreviousMessage(chatId, env);
    
    const result = await listYears(chatId, page, env);
    if (result && result.message_id) {
      setLastMessageId(chatId, result.message_id);
    }
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
    
    await deletePreviousMessage(chatId, env);
    
    const result = await showYearContent(chatId, year, page, env);
    if (result && result.message_id) {
      setLastMessageId(chatId, result.message_id);
    }
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
    
    await deletePreviousMessage(chatId, env);
    
    const result = await showYearContent(chatId, year, page, env);
    if (result && result.message_id) {
      setLastMessageId(chatId, result.message_id);
    }
    return;
  }
  
  // Handle List buttons
  if (data === "list_artists") {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    await deletePreviousMessage(chatId, env);
    
    const result = await handleList(chatId, "artists", 1, env);
    if (result && result.message_id) {
      setLastMessageId(chatId, result.message_id);
    }
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
    if (result && result.message_id) {
      setLastMessageId(chatId, result.message_id);
    }
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
    if (result && result.message_id) {
      setLastMessageId(chatId, result.message_id);
    }
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
    if (result && result.message_id) {
      setLastMessageId(chatId, result.message_id);
    }
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
    
    await deletePreviousMessage(chatId, env);
    
    const result = await handleList(chatId, listType, page, env);
    if (result && result.message_id) {
      setLastMessageId(chatId, result.message_id);
    }
    return;
  }
  
  // Handle track button click
  if (data.startsWith("track_")) {
    const trackId = data.replace("track_", "");
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    if (isGroup) {
      // First, get track details for artwork
      const trackQuery = `
        SELECT t.title, t.filename, t.artwork_url, a.name as artist_name
        FROM tracks t
        LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
        LEFT JOIN artists a ON ta.artist_id = a.id
        WHERE t.id = ? AND t.deleted_at IS NULL AND t.status = 'published'
      `;
      
      const track = await env.DB.prepare(trackQuery).bind(trackId).first();
      
      if (track && track.artwork_url && track.artwork_url !== "" && track.artwork_url !== "null") {
        // Send artwork in group
        let artworkUrl = track.artwork_url;
        if (!artworkUrl.startsWith("http")) {
          artworkUrl = `${IMAGE_CDN}${artworkUrl}`;
        }
        
        const artistName = track.artist_name || "Unknown Artist";
        const caption = `🎧 ${track.title} - ${artistName}`;
        
        await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            photo: artworkUrl,
            caption: caption,
            reply_to_message_id: callbackQuery.message.message_id
          })
        });
      }
      
      // Generate deep link button
      const requestId = `track_${trackId}_${Date.now()}_${chatId}`;
      const username = callbackQuery.from.username || callbackQuery.from.first_name;
      
      storeDeepLink(requestId, callbackQuery.from.id, { type: 'track', id: trackId });
      const deepLink = generateDeepLink(BOT_USERNAME, requestId);
      
      const keyboard = {
        inline_keyboard: [
          [{ text: "🎵 Get Track", url: deepLink }]
        ]
      };
      
      await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🎵 @${username}, click below to receive your track:`,
          reply_markup: keyboard,
          reply_to_message_id: callbackQuery.message.message_id
        })
      });
    } else {
      // Private chat: send audio directly
      const fakeCallback = {
        id: callbackQuery.id,
        data: `track_${trackId}`,
        message: { chat: { id: chatId } }
      };
      await handleTrack(fakeCallback, env);
    }
    return;
  }
  
  // Handle Get All button for Album
  if (data.startsWith("getall_album_")) {
    const albumId = data.replace("getall_album_", "");
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    // Delete the "🎵 Select a track:" message that contains the track buttons and Get All button
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    }).catch(() => {});
    
    if (isGroup) {
      const requestId = `getall_album_${albumId}_${Date.now()}_${chatId}`;
      const username = callbackQuery.from.username || callbackQuery.from.first_name;
      
      storeDeepLink(requestId, callbackQuery.from.id, { type: 'getall_album', id: albumId });
      const deepLink = generateDeepLink(BOT_USERNAME, requestId);
      
      const keyboard = {
        inline_keyboard: [
          [{ text: "📀 Get All Tracks", url: deepLink }]
        ]
      };
      
      await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📀 @${username}, click below to receive all tracks from this album:`,
          reply_markup: keyboard
        })
      });
    } else {
      await handleGetAllAlbum(callbackQuery, env);
    }
    return;
  }
  
  // Handle Get All button for EP
  if (data.startsWith("getall_ep_")) {
    const epId = data.replace("getall_ep_", "");
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    // Delete the "🎵 Select a track:" message that contains the track buttons and Get All button
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    }).catch(() => {});
    
    if (isGroup) {
      const requestId = `getall_ep_${epId}_${Date.now()}_${chatId}`;
      const username = callbackQuery.from.username || callbackQuery.from.first_name;
      
      storeDeepLink(requestId, callbackQuery.from.id, { type: 'getall_ep', id: epId });
      const deepLink = generateDeepLink(BOT_USERNAME, requestId);
      
      const keyboard = {
        inline_keyboard: [
          [{ text: "🎵 Get All Tracks", url: deepLink }]
        ]
      };
      
      await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🎵 @${username}, click below to receive all tracks from this EP:`,
          reply_markup: keyboard
        })
      });
    } else {
      await handleGetAllEp(callbackQuery, env);
    }
    return;
  }
  
  // Handle Get All button for Playlist
  if (data.startsWith("getall_playlist_")) {
    const playlistId = data.replace("getall_playlist_", "");
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    
    // Delete the "🎵 Select a track:" message that contains the track buttons and Get All button
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    }).catch(() => {});
    
    if (isGroup) {
      const requestId = `getall_playlist_${playlistId}_${Date.now()}_${chatId}`;
      const username = callbackQuery.from.username || callbackQuery.from.first_name;
      
      storeDeepLink(requestId, callbackQuery.from.id, { type: 'getall_playlist', id: playlistId });
      const deepLink = generateDeepLink(BOT_USERNAME, requestId);
      
      const keyboard = {
        inline_keyboard: [
          [{ text: "📋 Get All Tracks", url: deepLink }]
        ]
      };
      
      await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📋 @${username}, click below to receive all tracks from this playlist:`,
          reply_markup: keyboard
        })
      });
    } else {
      await handleGetAllPlaylist(callbackQuery, env);
    }
    return;
  }
  
  // Handle content buttons (artist_, album_, ep_, playlist_)
  await handleContentButtons(callbackQuery, env, isGroup);
}

async function handleContentButtons(callbackQuery, env, isGroup) {
  const data = callbackQuery.data;
  
  if (data.startsWith("artist_")) {
    await handleArtist(callbackQuery, env);
  } else if (data.startsWith("album_")) {
    await handleAlbum(callbackQuery, env);
  } else if (data.startsWith("ep_")) {
    await handleEp(callbackQuery, env);
  } else if (data.startsWith("playlist_")) {
    await handlePlaylist(callbackQuery, env);
  }
}