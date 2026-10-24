import { handleStart } from "../commands/start.js";
import { handleForceSub } from "../commands/forcesub.js";
import { handleSearch } from "../commands/search.js";
import { handleList } from "./contentHandlers.js";
import { handleTrack } from "../commands/track.js";
import { handleArtist } from "../commands/artist.js";
import { handleAlbum } from "../commands/album.js";
import { handleEp } from "../commands/ep.js";
import { handlePlaylist } from "../commands/playlist.js";
import { handleStats } from "../commands/stats.js";
import { handleInfo } from "../commands/info.js";
import { handleProfile } from "../commands/profile.js"; 
import { trackUser } from "../utils/userTracker.js"; 
import { checkSubscription } from "../middleware/checkSubscription.js";
import { deleteSearchPrompt, deletePreviousMessage, setLastMessageId } from "../utils/userState.js";

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

export async function handleMessage(message, env, ctx) {
  // Track user silently first
  await trackUser(message.from, ctx, env);

  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = message.chat.id;
  const text = message.text || "";
  const firstName = message.chat.first_name || "User";
  const messageId = message.message_id;
  
  // Admin bypasses force sub for /forcesub and /stats
  if (text.startsWith("/forcesub")) {
    await handleForceSub(text, chatId, env);
    return;
  }
  
  if (text === "/stats") {
    await handleStats(chatId, env, messageId);
    return;
  }
  
  // 🛑 FORCE SUB CHECK FOR EVERYONE ELSE
  const subCheck = await checkSubscription(chatId, env, messageId);
  
  if (!subCheck.allowed) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: subCheck.message,
        reply_to_message_id: subCheck.reply_to_message_id, 
        reply_markup: subCheck.keyboard
      })
    });
    return;
  }
  
  // --- BELOW THIS LINE, USER IS VERIFIED AND SUBBED ---

  if (text === "/profile") {
    // 👇 Pass null so it sends a NEW message (no editing the user's text)
    await handleProfile(chatId, env, null, "main");
  }
  else if (text === "/info" || text === "/about") {
    await handleInfo(chatId, env, messageId);
  }
  else if (text === "/start") {
    await handleStart(chatId, firstName, env, messageId);
  }
  else if (text.startsWith("/track")) {
    const trackQuery = text.replace("/track", "").trim();
    if (trackQuery) {
      await handleTrack(chatId, trackQuery, env, messageId);
    } else {
      await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Usage: /track [song name or artist]\nExample: /track Kanina",
          reply_to_message_id: messageId
        })
      });
    }
  }
  else if (text.startsWith("/artist")) {
    const artistName = text.replace("/artist", "").trim();
    if (artistName) {
      await handleArtist(chatId, artistName, env, messageId);
    } else {
      await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Usage: /artist [artist name]\nExample: /artist Kanina",
          reply_to_message_id: messageId
        })
      });
    }
  }
  else if (text.startsWith("/album")) {
    const albumName = text.replace("/album", "").trim();
    if (albumName) {
      await handleAlbum(chatId, albumName, env, messageId);
    } else {
      await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Usage: /album [album name]\nExample: /album Thriller",
          reply_to_message_id: messageId
        })
      });
    }
  }
  else if (text.startsWith("/ep")) {
    const epName = text.replace("/ep", "").trim();
    if (epName) {
      await handleEp(chatId, epName, env, messageId);
    } else {
      await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Usage: /ep [ep name]\nExample: /ep Love Songs",
          reply_to_message_id: messageId
        })
      });
    }
  }
  else if (text.startsWith("/playlist")) {
    const playlistName = text.replace("/playlist", "").trim();
    if (playlistName) {
      await handlePlaylist(chatId, playlistName, env, messageId);
    } else {
      await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Usage: /playlist [playlist name]\nExample: /playlist Top Hits",
          reply_to_message_id: messageId
        })
      });
    }
  }

else if (text === "/browse") {
  const result = await handleList(chatId, "artists", 1, env);
  if (result && result.message_id) {
    setLastMessageId(chatId, result.message_id);
  }
}


  else if (text && !text.startsWith("/")) {
    await deleteSearchPrompt(chatId, env);
    await deletePreviousMessage(chatId, env);
    
    const result = await handleSearch(chatId, text, env, messageId);
    if (result && result.message_id) {
      setLastMessageId(chatId, result.message_id);
    }
  }
  else if (text.startsWith("/")) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Command not recognized. Try /start, /profile, /info, /track, /artist, /album, /ep, or /playlist",
        reply_to_message_id: messageId
      })
    });
  }
} 