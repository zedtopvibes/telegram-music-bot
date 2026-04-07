import { handleStart } from "../commands/start.js";
import { handleForceSub } from "../commands/forcesub.js";
import { handleSearch } from "../commands/search.js";
import { handleTrack } from "../commands/track.js";
import { handleArtist } from "../commands/artist.js";
import { handleAlbum } from "../commands/album.js";
import { handleEp } from "../commands/ep.js";
import { handlePlaylist } from "../commands/playlist.js";
import { checkSubscription } from "../middleware/checkSubscription.js";

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

export async function handleMessage(message, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = message.chat.id;
  const text = message.text || "";
  const firstName = message.chat.first_name || "User";
  
  // Skip force sub check for /forcesub commands (admin only)
  if (text.startsWith("/forcesub")) {
    await handleForceSub(text, chatId, env);
    return;
  }
  
  // Check subscription for all other commands
  const subCheck = await checkSubscription(chatId, env);
  
  if (!subCheck.allowed) {
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
  
  // Handle /start command
  if (text === "/start") {
    await handleStart(chatId, firstName, env);
  }
  // Handle /track command
  else if (text.startsWith("/track")) {
    const trackQuery = text.replace("/track", "").trim();
    if (trackQuery) {
      await handleTrack(chatId, trackQuery, env);
    } else {
      await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Usage: /track [song name or artist]\nExample: /track Kanina"
        })
      });
    }
  }
  // Handle /artist command
  else if (text.startsWith("/artist")) {
    const artistName = text.replace("/artist", "").trim();
    if (artistName) {
      await handleArtist(chatId, artistName, env);
    } else {
      await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Usage: /artist [artist name]\nExample: /artist Kanina"
        })
      });
    }
  }
  // Handle /album command
  else if (text.startsWith("/album")) {
    const albumName = text.replace("/album", "").trim();
    if (albumName) {
      await handleAlbum(chatId, albumName, env);
    } else {
      await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Usage: /album [album name]\nExample: /album Thriller"
        })
      });
    }
  }
  // Handle /ep command
  else if (text.startsWith("/ep")) {
    const epName = text.replace("/ep", "").trim();
    if (epName) {
      await handleEp(chatId, epName, env);
    } else {
      await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Usage: /ep [ep name]\nExample: /ep Love Songs"
        })
      });
    }
  }
  // Handle /playlist command
  else if (text.startsWith("/playlist")) {
    const playlistName = text.replace("/playlist", "").trim();
    if (playlistName) {
      await handlePlaylist(chatId, playlistName, env);
    } else {
      await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Usage: /playlist [playlist name]\nExample: /playlist Top Hits"
        })
      });
    }
  }
  // Handle search - any text that doesn't start with /
  else if (text && !text.startsWith("/")) {
    await handleSearch(chatId, text, env);
  }
  // Handle unknown commands
  else if (text.startsWith("/")) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Command not recognized. Try /start, /track, /artist, /album, /ep, or /playlist"
      })
    });
  }
}