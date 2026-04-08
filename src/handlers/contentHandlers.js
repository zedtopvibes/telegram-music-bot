import { checkSubscription } from "../middleware/checkSubscription.js";
import { deletePreviousMessage, setLastMessageId } from "../utils/userState.js";

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;
const IMAGE_CDN = "https://zedtopvibes.com";
const AUDIO_CDN = "https://files.zedtopvibes.com";

async function checkUserSubscription(chatId, env) {
  const subCheck = await checkSubscription(chatId, env);
  if (!subCheck.allowed) {
    return { allowed: false, message: subCheck.message, keyboard: subCheck.keyboard };
  }
  return { allowed: true };
}

async function sendPhotoWithCaption(chatId, imageUrl, caption, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  
  if (!imageUrl || imageUrl === "" || imageUrl === "null") {
    return null;
  }
  
  // Ensure full URL using IMAGE_CDN
  let fullImageUrl = imageUrl;
  if (!imageUrl.startsWith("http")) {
    fullImageUrl = `${IMAGE_CDN}${imageUrl}`;
  }
  
  try {
    const response = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: fullImageUrl,
        caption: caption,
        parse_mode: "HTML"
      })
    });
    return await response.json();
  } catch (error) {
    console.error("Error sending photo:", error);
    return null;
  }
}

export async function handleArtist(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const artistId = callbackQuery.data.replace("artist_", "");
  
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
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  await deletePreviousMessage(chatId, env);
  
  const artistQuery = `
    SELECT name, image_url FROM artists 
    WHERE id = ? AND deleted_at IS NULL AND status = 'published'
  `;
  const artist = await env.DB.prepare(artistQuery).bind(artistId).first();
  
  if (!artist) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
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
  const totalTracks = tracks.results ? tracks.results.length : 0;
  
  const caption = `👤 ARTIST: ${artist.name}\n\n🎧 Total Tracks: ${totalTracks}`;
  
  // Send image + caption if available
  if (artist.image_url && artist.image_url !== "" && artist.image_url !== "null") {
    await sendPhotoWithCaption(chatId, artist.image_url, caption, env);
  } else {
    // Send text only if no image
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption
      })
    });
  }
  
  // THEN check for tracks and send buttons
  if (!tracks.results || tracks.results.length === 0) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "No tracks found for this artist."
      })
    });
    return;
  }
  
  // Send buttons
  const buttons = [];
  tracks.results.forEach((track) => {
    buttons.push([{ text: `🎵 ${track.title}`, callback_data: `track_${track.id}` }]);
  });
  buttons.push([{ text: "❌", callback_data: "delete_message" }]);
  
  const keyboard = { inline_keyboard: buttons };
  
  const response = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "🎵 Select a track:",
      reply_markup: keyboard
    })
  });
  
  const responseData = await response.json();
  if (responseData.result) {
    setLastMessageId(chatId, responseData.result.message_id);
  }
}

export async function handleAlbum(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const albumId = callbackQuery.data.replace("album_", "");
  
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
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  await deletePreviousMessage(chatId, env);
  
  const albumQuery = `
    SELECT title, release_date, cover_url FROM albums
    WHERE id = ? AND deleted_at IS NULL AND status = 'published'
  `;
  const album = await env.DB.prepare(albumQuery).bind(albumId).first();
  
  if (!album) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Album not found."
      })
    });
    return;
  }
  
  // Get artist name for this album
  const artistQuery = `
    SELECT a.name FROM artists a
    LEFT JOIN albums alb ON alb.artist_id = a.id
    WHERE alb.id = ? AND a.deleted_at IS NULL AND a.status = 'published'
  `;
  const artist = await env.DB.prepare(artistQuery).bind(albumId).first();
  
  const tracksQuery = `
    SELECT t.id, t.title, at.track_number
    FROM album_tracks at
    LEFT JOIN tracks t ON at.track_id = t.id
    WHERE at.album_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
    ORDER BY at.track_number
  `;
  
  const tracks = await env.DB.prepare(tracksQuery).bind(albumId).all();
  const totalTracks = tracks.results ? tracks.results.length : 0;
  
  let caption = `💽 ALBUM: ${album.title}\n\n`;
  if (artist && artist.name) {
    caption += `👤 Artist: ${artist.name}\n`;
  }
  if (album.release_date) {
    caption += `📅 Release: ${album.release_date}\n`;
  }
  caption += `🎧 Total Tracks: ${totalTracks}`;
  
  // Send image + caption if available
  if (album.cover_url && album.cover_url !== "" && album.cover_url !== "null") {
    await sendPhotoWithCaption(chatId, album.cover_url, caption, env);
  } else {
    // Send text only if no image
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption
      })
    });
  }
  
  // THEN check for tracks and send buttons
  if (!tracks.results || tracks.results.length === 0) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "No tracks found in this album."
      })
    });
    return;
  }
  
  // Send buttons
  const buttons = [];
  tracks.results.forEach((track) => {
    buttons.push([{ text: `🎵 ${track.title}`, callback_data: `track_${track.id}` }]);
  });
  buttons.push([{ text: "📀 Get All", callback_data: `getall_album_${albumId}` }]);
  buttons.push([{ text: "❌", callback_data: "delete_message" }]);
  
  const keyboard = { inline_keyboard: buttons };
  
  const response = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "🎵 Select a track:",
      reply_markup: keyboard
    })
  });
  
  const responseData = await response.json();
  if (responseData.result) {
    setLastMessageId(chatId, responseData.result.message_id);
  }
}

export async function handleEp(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const epId = callbackQuery.data.replace("ep_", "");
  
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
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  await deletePreviousMessage(chatId, env);
  
  const epQuery = `
    SELECT title, release_date, cover_url FROM eps
    WHERE id = ? AND deleted_at IS NULL AND status = 'published'
  `;
  const ep = await env.DB.prepare(epQuery).bind(epId).first();
  
  if (!ep) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "EP not found."
      })
    });
    return;
  }
  
  // Get artist name for this EP
  const artistQuery = `
    SELECT a.name FROM artists a
    LEFT JOIN eps e ON e.artist_id = a.id
    WHERE e.id = ? AND a.deleted_at IS NULL AND a.status = 'published'
  `;
  const artist = await env.DB.prepare(artistQuery).bind(epId).first();
  
  const tracksQuery = `
    SELECT t.id, t.title, et.track_number
    FROM ep_tracks et
    LEFT JOIN tracks t ON et.track_id = t.id
    WHERE et.ep_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
    ORDER BY et.track_number
  `;
  
  const tracks = await env.DB.prepare(tracksQuery).bind(epId).all();
  const totalTracks = tracks.results ? tracks.results.length : 0;
  
  let caption = `🎵 EP: ${ep.title}\n\n`;
  if (artist && artist.name) {
    caption += `👤 Artist: ${artist.name}\n`;
  }
  if (ep.release_date) {
    caption += `📅 Release: ${ep.release_date}\n`;
  }
  caption += `🎧 Total Tracks: ${totalTracks}`;
  
  // Send image + caption if available
  if (ep.cover_url && ep.cover_url !== "" && ep.cover_url !== "null") {
    await sendPhotoWithCaption(chatId, ep.cover_url, caption, env);
  } else {
    // Send text only if no image
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption
      })
    });
  }
  
  // THEN check for tracks and send buttons
  if (!tracks.results || tracks.results.length === 0) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "No tracks found in this EP."
      })
    });
    return;
  }
  
  // Send buttons
  const buttons = [];
  tracks.results.forEach((track) => {
    buttons.push([{ text: `🎵 ${track.title}`, callback_data: `track_${track.id}` }]);
  });
  buttons.push([{ text: "📀 Get All", callback_data: `getall_ep_${epId}` }]);
  buttons.push([{ text: "❌", callback_data: "delete_message" }]);
  
  const keyboard = { inline_keyboard: buttons };
  
  const response = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "🎵 Select a track:",
      reply_markup: keyboard
    })
  });
  
  const responseData = await response.json();
  if (responseData.result) {
    setLastMessageId(chatId, responseData.result.message_id);
  }
}

export async function handlePlaylist(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const playlistId = callbackQuery.data.replace("playlist_", "");
  
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
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  await deletePreviousMessage(chatId, env);
  
  const playlistQuery = `
    SELECT name, cover_url FROM playlists
    WHERE id = ? AND deleted_at IS NULL AND status = 'published'
  `;
  const playlist = await env.DB.prepare(playlistQuery).bind(playlistId).first();
  
  if (!playlist) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
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
    SELECT t.id, t.title, a.name as artist_name
    FROM playlist_tracks pt
    LEFT JOIN tracks t ON pt.track_id = t.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
    LEFT JOIN artists a ON ta.artist_id = a.id
    WHERE pt.playlist_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
    ORDER BY pt.position
  `;
  
  const tracks = await env.DB.prepare(tracksQuery).bind(playlistId).all();
  const totalTracks = tracks.results ? tracks.results.length : 0;
  
  const caption = `📋 PLAYLIST: ${playlist.name}\n\n🎧 Total Tracks: ${totalTracks}`;
  
  // Send image + caption if available
  if (playlist.cover_url && playlist.cover_url !== "" && playlist.cover_url !== "null") {
    await sendPhotoWithCaption(chatId, playlist.cover_url, caption, env);
  } else {
    // Send text only if no image
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption
      })
    });
  }
  
  // THEN check for tracks and send buttons
  if (!tracks.results || tracks.results.length === 0) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "No tracks found in this playlist."
      })
    });
    return;
  }
  
  // Send buttons
  const buttons = [];
  tracks.results.forEach((track) => {
    const displayText = track.artist_name ? `${track.title} - ${track.artist_name}` : track.title;
    buttons.push([{ text: `🎵 ${displayText.substring(0, 50)}`, callback_data: `track_${track.id}` }]);
  });
  buttons.push([{ text: "📀 Get All", callback_data: `getall_playlist_${playlistId}` }]);
  buttons.push([{ text: "❌", callback_data: "delete_message" }]);
  
  const keyboard = { inline_keyboard: buttons };
  
  const response = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "🎵 Select a track:",
      reply_markup: keyboard
    })
  });
  
  const responseData = await response.json();
  if (responseData.result) {
    setLastMessageId(chatId, responseData.result.message_id);
  }
}

export async function handleTrack(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const trackId = callbackQuery.data.replace("track_", "");
  
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
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  const trackQuery = `
    SELECT t.title, t.filename, t.artwork_url, a.name as artist_name
    FROM tracks t
    LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
    LEFT JOIN artists a ON ta.artist_id = a.id
    WHERE t.id = ? AND t.deleted_at IS NULL AND t.status = 'published'
  `;
  
  const track = await env.DB.prepare(trackQuery).bind(trackId).first();
  
  if (!track) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "❌ Track not found."
      })
    });
    return;
  }
  
  const audioUrl = `${AUDIO_CDN}/${encodeURIComponent(track.filename)}`;
  const artistName = track.artist_name || "Unknown Artist";
  const caption = `🎧 ${track.title} - ${artistName}`;
  
  // Send artwork for single track (premium feel)
  if (track.artwork_url && track.artwork_url !== "" && track.artwork_url !== "null") {
    let artworkUrl = track.artwork_url;
    if (!artworkUrl.startsWith("http")) {
      artworkUrl = `${IMAGE_CDN}${artworkUrl}`;
    }
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: artworkUrl,
        caption: caption
      })
    });
  }
  
  // Send audio
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendAudio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      audio: audioUrl,
      title: track.title,
      performer: artistName,
      caption: caption
    })
  });
}

export async function handleGetAllAlbum(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const albumId = callbackQuery.data.replace("getall_album_", "");
  
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
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  const albumQuery = `
    SELECT title, cover_url FROM albums WHERE id = ? AND deleted_at IS NULL AND status = 'published'
  `;
  const album = await env.DB.prepare(albumQuery).bind(albumId).first();
  
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
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "No tracks found in this album."
      })
    });
    return;
  }
  
  const totalTracks = tracks.results.length;
  const albumTitle = album ? album.title : "Album";
  
  // Send album cover ONCE (not per track)
  if (album && album.cover_url && album.cover_url !== "" && album.cover_url !== "null") {
    let coverUrl = album.cover_url;
    if (!coverUrl.startsWith("http")) {
      coverUrl = `${IMAGE_CDN}${coverUrl}`;
    }
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: coverUrl,
        caption: `📀 Sending album "${albumTitle}"...`
      })
    });
  }
  
  const statusMsg = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `📀 Sending album "${albumTitle}": 0/${totalTracks}`
    })
  });
  const statusData = await statusMsg.json();
  const statusMessageId = statusData.result.message_id;
  
  // Send ONLY audio files (no artwork per track)
  for (let i = 0; i < totalTracks; i++) {
    const track = tracks.results[i];
    const audioUrl = `${AUDIO_CDN}/${encodeURIComponent(track.filename)}`;
    const artistName = track.artist_name || "Unknown Artist";
    const caption = `🎧 ${track.title} - ${artistName}`;
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendAudio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        audio: audioUrl,
        title: track.title,
        performer: artistName,
        caption: caption
      })
    });
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: statusMessageId,
        text: `📀 Sending album "${albumTitle}": ${i+1}/${totalTracks}`
      })
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: statusMessageId
    })
  }).catch(() => {});
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `✅ Done! All ${totalTracks} tracks from "${albumTitle}" sent.`
    })
  });
}

export async function handleGetAllEp(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const epId = callbackQuery.data.replace("getall_ep_", "");
  
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
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  const epQuery = `
    SELECT title, cover_url FROM eps WHERE id = ? AND deleted_at IS NULL AND status = 'published'
  `;
  const ep = await env.DB.prepare(epQuery).bind(epId).first();
  
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
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "No tracks found in this EP."
      })
    });
    return;
  }
  
  const totalTracks = tracks.results.length;
  const epTitle = ep ? ep.title : "EP";
  
  // Send EP cover ONCE (not per track)
  if (ep && ep.cover_url && ep.cover_url !== "" && ep.cover_url !== "null") {
    let coverUrl = ep.cover_url;
    if (!coverUrl.startsWith("http")) {
      coverUrl = `${IMAGE_CDN}${coverUrl}`;
    }
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: coverUrl,
        caption: `🎵 Sending EP "${epTitle}"...`
      })
    });
  }
  
  const statusMsg = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `🎵 Sending EP "${epTitle}": 0/${totalTracks}`
    })
  });
  const statusData = await statusMsg.json();
  const statusMessageId = statusData.result.message_id;
  
  // Send ONLY audio files (no artwork per track)
  for (let i = 0; i < totalTracks; i++) {
    const track = tracks.results[i];
    const audioUrl = `${AUDIO_CDN}/${encodeURIComponent(track.filename)}`;
    const artistName = track.artist_name || "Unknown Artist";
    const caption = `🎧 ${track.title} - ${artistName}`;
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendAudio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        audio: audioUrl,
        title: track.title,
        performer: artistName,
        caption: caption
      })
    });
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: statusMessageId,
        text: `🎵 Sending EP "${epTitle}": ${i+1}/${totalTracks}`
      })
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: statusMessageId
    })
  }).catch(() => {});
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `✅ Done! All ${totalTracks} tracks from "${epTitle}" sent.`
    })
  });
}

export async function handleGetAllPlaylist(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const playlistId = callbackQuery.data.replace("getall_playlist_", "");
  
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
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  const playlistQuery = `
    SELECT name, cover_url FROM playlists WHERE id = ? AND deleted_at IS NULL AND status = 'published'
  `;
  const playlist = await env.DB.prepare(playlistQuery).bind(playlistId).first();
  
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
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "No tracks found in this playlist."
      })
    });
    return;
  }
  
  const totalTracks = tracks.results.length;
  const playlistName = playlist ? playlist.name : "Playlist";
  
  // Send playlist cover ONCE (not per track)
  if (playlist && playlist.cover_url && playlist.cover_url !== "" && playlist.cover_url !== "null") {
    let coverUrl = playlist.cover_url;
    if (!coverUrl.startsWith("http")) {
      coverUrl = `${IMAGE_CDN}${coverUrl}`;
    }
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: coverUrl,
        caption: `📋 Sending playlist "${playlistName}"...`
      })
    });
  }
  
  const statusMsg = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `📋 Sending playlist "${playlistName}": 0/${totalTracks}`
    })
  });
  const statusData = await statusMsg.json();
  const statusMessageId = statusData.result.message_id;
  
  // Send ONLY audio files (no artwork per track)
  for (let i = 0; i < totalTracks; i++) {
    const track = tracks.results[i];
    const audioUrl = `${AUDIO_CDN}/${encodeURIComponent(track.filename)}`;
    const artistName = track.artist_name || "Unknown Artist";
    const caption = `🎧 ${track.title} - ${artistName}`;
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendAudio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        audio: audioUrl,
        title: track.title,
        performer: artistName,
        caption: caption
      })
    });
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: statusMessageId,
        text: `📋 Sending playlist "${playlistName}": ${i+1}/${totalTracks}`
      })
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: statusMessageId
    })
  }).catch(() => {});
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `✅ Done! All ${totalTracks} tracks from "${playlistName}" sent.`
    })
  });
}