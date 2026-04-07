import { handleStart } from "./commands/start.js";
import { handleForceSub } from "./commands/forcesub.js";
import { handleSearch } from "./commands/search.js";
import { handleTrack } from "./commands/track.js";
import { handleArtist } from "./commands/artist.js";
import { handleAlbum } from "./commands/album.js";
import { handleEp } from "./commands/ep.js";
import { handlePlaylist } from "./commands/playlist.js";
import { checkSubscription } from "./middleware/checkSubscription.js";

const CDN_URL = "https://files.zedtopvibes.com";

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
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  // Handle callback queries (button clicks)
  if (update.callback_query) {
    const chatId = update.callback_query.message.chat.id;
    const data = update.callback_query.data;
    const messageId = update.callback_query.message.message_id;
    
    // Handle subscription check button
    if (data === "check_subscription") {
      const subCheck = await checkSubscription(chatId, env);
      
      if (subCheck.allowed) {
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: update.callback_query.id })
        });
        
        await fetch(`${TELEGRAM_API}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: "✅ Thank you for joining! You can now use the bot."
          })
        });
      } else {
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: update.callback_query.id,
            text: "❌ You haven't joined the channel yet. Please join first!",
            show_alert: true
          })
        });
      }
      return;
    }
    
    // Handle artist button click
    if (data.startsWith("artist_")) {
      const artistId = data.replace("artist_", "");
      
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: update.callback_query.id })
      });
      
      const artistQuery = `
        SELECT name, bio, country FROM artists 
        WHERE id = ? AND deleted_at IS NULL AND status = 'published'
      `;
      const artist = await env.DB.prepare(artistQuery).bind(artistId).first();
      
      if (!artist) {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "Artist not found."
          })
        });
        return;
      }
      
      const tracksQuery = `
        SELECT t.id, t.title
        FROM tracks t
        LEFT JOIN track_artists ta ON t.id = ta.track_id
        WHERE ta.artist_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
        GROUP BY t.id
        ORDER BY t.title
        LIMIT 20
      `;
      
      const tracks = await env.DB.prepare(tracksQuery).bind(artistId).all();
      
      let responseText = `🎤 ${artist.name}\n\n`;
      if (artist.bio) responseText += `${artist.bio}\n\n`;
      if (artist.country) responseText += `📍 Country: ${artist.country}\n\n`;
      responseText += `🎵 Tracks:\n\n`;
      
      const buttons = [];
      
      if (tracks.results && tracks.results.length > 0) {
        tracks.results.forEach((track, index) => {
          const number = index + 1;
          responseText += `${number}. ${track.title}\n`;
          buttons.push([{ text: `🎵 ${track.title}`, callback_data: `track_${track.id}` }]);
        });
      } else {
        responseText += `No tracks found.`;
      }
      
      const keyboard = { inline_keyboard: buttons };
      
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          reply_markup: keyboard
        })
      });
      return;
    }
    
    // Handle album button click
    if (data.startsWith("album_")) {
      const albumId = data.replace("album_", "");
      
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: update.callback_query.id })
      });
      
      const albumQuery = `
        SELECT title, description, release_date, genre, label
        FROM albums
        WHERE id = ? AND deleted_at IS NULL AND status = 'published'
      `;
      const album = await env.DB.prepare(albumQuery).bind(albumId).first();
      
      if (!album) {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "Album not found."
          })
        });
        return;
      }
      
      const tracksQuery = `
        SELECT t.id, t.title, at.track_number
        FROM album_tracks at
        LEFT JOIN tracks t ON at.track_id = t.id
        WHERE at.album_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
        ORDER BY at.track_number
      `;
      
      const tracks = await env.DB.prepare(tracksQuery).bind(albumId).all();
      
      let responseText = `💿 ALBUM: ${album.title}\n\n`;
      if (album.description) responseText += `${album.description}\n\n`;
      if (album.release_date) responseText += `📅 Release: ${album.release_date}\n`;
      if (album.genre) responseText += `🎸 Genre: ${album.genre}\n`;
      if (album.label) responseText += `🏷️ Label: ${album.label}\n\n`;
      responseText += `🎵 Tracklist:\n\n`;
      
      const buttons = [];
      
      if (tracks.results && tracks.results.length > 0) {
        tracks.results.forEach((track, index) => {
          const number = index + 1;
          responseText += `${number}. ${track.title}\n`;
          buttons.push([{ text: `🎵 ${track.title}`, callback_data: `track_${track.id}` }]);
        });
        // Add Get All button
        buttons.push([{ text: "📀 Get All", callback_data: `getall_album_${albumId}` }]);
      } else {
        responseText += `No tracks found.`;
      }
      
      const keyboard = { inline_keyboard: buttons };
      
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          reply_markup: keyboard
        })
      });
      return;
    }
    
    // Handle EP button click
    if (data.startsWith("ep_")) {
      const epId = data.replace("ep_", "");
      
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: update.callback_query.id })
      });
      
      const epQuery = `
        SELECT title, description, release_date, genre, label
        FROM eps
        WHERE id = ? AND deleted_at IS NULL AND status = 'published'
      `;
      const ep = await env.DB.prepare(epQuery).bind(epId).first();
      
      if (!ep) {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "EP not found."
          })
        });
        return;
      }
      
      const tracksQuery = `
        SELECT t.id, t.title, et.track_number
        FROM ep_tracks et
        LEFT JOIN tracks t ON et.track_id = t.id
        WHERE et.ep_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
        ORDER BY et.track_number
      `;
      
      const tracks = await env.DB.prepare(tracksQuery).bind(epId).all();
      
      let responseText = `🎵 EP: ${ep.title}\n\n`;
      if (ep.description) responseText += `${ep.description}\n\n`;
      if (ep.release_date) responseText += `📅 Release: ${ep.release_date}\n`;
      if (ep.genre) responseText += `🎸 Genre: ${ep.genre}\n`;
      if (ep.label) responseText += `🏷️ Label: ${ep.label}\n\n`;
      responseText += `🎵 Tracklist:\n\n`;
      
      const buttons = [];
      
      if (tracks.results && tracks.results.length > 0) {
        tracks.results.forEach((track, index) => {
          const number = index + 1;
          responseText += `${number}. ${track.title}\n`;
          buttons.push([{ text: `🎵 ${track.title}`, callback_data: `track_${track.id}` }]);
        });
        // Add Get All button
        buttons.push([{ text: "📀 Get All", callback_data: `getall_ep_${epId}` }]);
      } else {
        responseText += `No tracks found.`;
      }
      
      const keyboard = { inline_keyboard: buttons };
      
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          reply_markup: keyboard
        })
      });
      return;
    }
    
    // Handle Playlist button click
    if (data.startsWith("playlist_")) {
      const playlistId = data.replace("playlist_", "");
      
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: update.callback_query.id })
      });
      
      const playlistQuery = `
        SELECT name, description
        FROM playlists
        WHERE id = ? AND deleted_at IS NULL AND status = 'published'
      `;
      const playlist = await env.DB.prepare(playlistQuery).bind(playlistId).first();
      
      if (!playlist) {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "Playlist not found."
          })
        });
        return;
      }
      
      const tracksQuery = `
        SELECT t.id, t.title, pt.position
        FROM playlist_tracks pt
        LEFT JOIN tracks t ON pt.track_id = t.id
        WHERE pt.playlist_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
        ORDER BY pt.position
      `;
      
      const tracks = await env.DB.prepare(tracksQuery).bind(playlistId).all();
      
      let responseText = `📋 PLAYLIST: ${playlist.name}\n\n`;
      if (playlist.description) responseText += `${playlist.description}\n\n`;
      responseText += `🎵 Tracks:\n\n`;
      
      const buttons = [];
      
      if (tracks.results && tracks.results.length > 0) {
        tracks.results.forEach((track, index) => {
          const number = index + 1;
          responseText += `${number}. ${track.title}\n`;
          buttons.push([{ text: `🎵 ${track.title}`, callback_data: `track_${track.id}` }]);
        });
        // Add Get All button
        buttons.push([{ text: "📀 Get All", callback_data: `getall_playlist_${playlistId}` }]);
      } else {
        responseText += `No tracks found.`;
      }
      
      const keyboard = { inline_keyboard: buttons };
      
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          reply_markup: keyboard
        })
      });
      return;
    }
    
    // Handle Get All button for Album
    if (data.startsWith("getall_album_")) {
      const albumId = data.replace("getall_album_", "");
      
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: update.callback_query.id })
      });
      
      const tracksQuery = `
        SELECT t.id, t.title, t.filename, a.name as artist_name
        FROM album_tracks at
        LEFT JOIN tracks t ON at.track_id = t.id
        LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
        LEFT JOIN artists a ON ta.artist_id = a.id
        WHERE at.album_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
        ORDER BY at.track_number
      `;
      
      const tracks = await env.DB.prepare(tracksQuery).bind(albumId).all();
      
      if (!tracks.results || tracks.results.length === 0) {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "No tracks found in this album."
          })
        });
        return;
      }
      
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📀 Sending ${tracks.results.length} tracks from this album...`
        })
      });
      
      for (const track of tracks.results) {
        const audioUrl = `${CDN_URL}/${encodeURIComponent(track.filename)}`;
        const artistName = track.artist_name || "Unknown Artist";
        
        await fetch(`${TELEGRAM_API}/sendAudio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            audio: audioUrl,
            title: track.title,
            performer: artistName,
            caption: `🎵 ${track.title}\n🎤 ${artistName}`
          })
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return;
    }
    
    // Handle Get All button for EP
    if (data.startsWith("getall_ep_")) {
      const epId = data.replace("getall_ep_", "");
      
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: update.callback_query.id })
      });
      
      const tracksQuery = `
        SELECT t.id, t.title, t.filename, a.name as artist_name
        FROM ep_tracks et
        LEFT JOIN tracks t ON et.track_id = t.id
        LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
        LEFT JOIN artists a ON ta.artist_id = a.id
        WHERE et.ep_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
        ORDER BY et.track_number
      `;
      
      const tracks = await env.DB.prepare(tracksQuery).bind(epId).all();
      
      if (!tracks.results || tracks.results.length === 0) {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "No tracks found in this EP."
          })
        });
        return;
      }
      
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🎵 Sending ${tracks.results.length} tracks from this EP...`
        })
      });
      
      for (const track of tracks.results) {
        const audioUrl = `${CDN_URL}/${encodeURIComponent(track.filename)}`;
        const artistName = track.artist_name || "Unknown Artist";
        
        await fetch(`${TELEGRAM_API}/sendAudio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            audio: audioUrl,
            title: track.title,
            performer: artistName,
            caption: `🎵 ${track.title}\n🎤 ${artistName}`
          })
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return;
    }
    
    // Handle Get All button for Playlist
    if (data.startsWith("getall_playlist_")) {
      const playlistId = data.replace("getall_playlist_", "");
      
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: update.callback_query.id })
      });
      
      const tracksQuery = `
        SELECT t.id, t.title, t.filename, a.name as artist_name
        FROM playlist_tracks pt
        LEFT JOIN tracks t ON pt.track_id = t.id
        LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
        LEFT JOIN artists a ON ta.artist_id = a.id
        WHERE pt.playlist_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
        ORDER BY pt.position
      `;
      
      const tracks = await env.DB.prepare(tracksQuery).bind(playlistId).all();
      
      if (!tracks.results || tracks.results.length === 0) {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "No tracks found in this playlist."
          })
        });
        return;
      }
      
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📋 Sending ${tracks.results.length} tracks from this playlist...`
        })
      });
      
      for (const track of tracks.results) {
        const audioUrl = `${CDN_URL}/${encodeURIComponent(track.filename)}`;
        const artistName = track.artist_name || "Unknown Artist";
        
        await fetch(`${TELEGRAM_API}/sendAudio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            audio: audioUrl,
            title: track.title,
            performer: artistName,
            caption: `🎵 ${track.title}\n🎤 ${artistName}`
          })
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return;
    }
    
    // Handle track button click - Send audio from CDN
    if (data.startsWith("track_")) {
      const trackId = data.replace("track_", "");
      
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: update.callback_query.id })
      });
      
      const trackQuery = `
        SELECT t.title, t.filename, a.name as artist_name
        FROM tracks t
        LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
        LEFT JOIN artists a ON ta.artist_id = a.id
        WHERE t.id = ? AND t.deleted_at IS NULL AND t.status = 'published'
      `;
      
      const track = await env.DB.prepare(trackQuery).bind(trackId).first();
      
      if (!track) {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "❌ Track not found."
          })
        });
        return;
      }
      
      const audioUrl = `${CDN_URL}/${encodeURIComponent(track.filename)}`;
      const artistName = track.artist_name || "Unknown Artist";
      
      await fetch(`${TELEGRAM_API}/sendAudio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          audio: audioUrl,
          title: track.title,
          performer: artistName,
          caption: `🎵 ${track.title}\n🎤 ${artistName}`
        })
      });
      
      return;
    }
    
    return;
  }
  
  // Handle messages
  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text || "";
    const firstName = update.message.chat.first_name || "User";
    
    // Skip force sub check for /forcesub commands (admin only)
    if (text.startsWith("/forcesub")) {
      await handleForceSub(text, chatId, env);
      return;
    }
    
    // Check subscription for all other commands
    const subCheck = await checkSubscription(chatId, env);
    
    if (!subCheck.allowed) {
      await fetch(`${TELEGRAM_API}/sendMessage`, {
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
        await fetch(`${TELEGRAM_API}/sendMessage`, {
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
        await fetch(`${TELEGRAM_API}/sendMessage`, {
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
        await fetch(`${TELEGRAM_API}/sendMessage`, {
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
        await fetch(`${TELEGRAM_API}/sendMessage`, {
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
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "Usage: /playlist [playlist name]\nExample: /playlist Top Hits"
          })
        });
      }
    }
    // Handle search - any text that doesn't start with / (returns content listing with buttons)
    else if (text && !text.startsWith("/")) {
      await handleSearch(chatId, text, env);
    }
    // Handle unknown commands
    else if (text.startsWith("/")) {
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Command not recognized. Try /start, /track, /artist, /album, /ep, or /playlist"
        })
      });
    }
  }
}