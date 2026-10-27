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


export async function handleList(chatId, listType, page, env, filterLetter = "", messageId = null) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  // 👇 VIEW 1: The Alphabet Grid
  if (filterLetter === "SHOW_ALPHABET") {
    const buttons = [];
    buttons.push([{ text: "🔢 0-9", callback_data: `filter_artists_NUM_1` }]);
    
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    let row = [];
    letters.forEach((letter, index) => {
      row.push({ text: letter, callback_data: `filter_artists_${letter}_1` });
      if (row.length === 7 || index === letters.length - 1) {
        buttons.push(row);
        row = [];
      }
    });
    
    buttons.push([{ text: "🔙 Back to List", callback_data: `page_artists_1_` }]);
    buttons.push([{ text: "❌ Close", callback_data: "delete_message" }]);
    
    const text = `🎤 <b>Browse Artists by Letter</b>\n\nSelect a letter to find your favorite artist:`;
    
    if (messageId) {
      await fetch(`${TELEGRAM_API}/editMessageText`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: text, parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } })
      });
      return { message_id: messageId };
    } else {
      const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } })
      });
      const data = await res.json();
      return { message_id: data.result?.message_id };
    }
  }

  // 👇 VIEW 2 & 3: The List (Filtered or Unfiltered)
  const ITEMS_PER_PAGE = 10;
  const offset = (page - 1) * ITEMS_PER_PAGE;
  
  let query = "";
  let countQuery = "";
  let title = "";
  let emoji = "";
  let itemNameField = "";
  let filterCondition = "";
  
  if (listType === "artists") {
    if (filterLetter && filterLetter !== "ALL") {
      if (filterLetter === "NUM") {
        filterCondition = `AND name GLOB '[0-9]*'`;
      } else {
        filterCondition = `AND name LIKE '${filterLetter}%'`;
      }
    }
    query = `SELECT id, name FROM artists WHERE deleted_at IS NULL AND status = 'published' ${filterCondition} ORDER BY name LIMIT ? OFFSET ?`;
    countQuery = `SELECT COUNT(*) as total FROM artists WHERE deleted_at IS NULL AND status = 'published' ${filterCondition}`;
    title = filterLetter ? `🎤 Artists (${filterLetter === 'NUM' ? '0-9' : filterLetter})` : "🎤 Artists";
    emoji = "🎤"; itemNameField = "name";
  } else if (listType === "albums") {
    query = `SELECT id, title FROM albums WHERE deleted_at IS NULL AND status = 'published' ORDER BY title LIMIT ? OFFSET ?`;
    countQuery = `SELECT COUNT(*) as total FROM albums WHERE deleted_at IS NULL AND status = 'published'`;
    title = "💿 Albums"; emoji = "💿"; itemNameField = "title";
  } else if (listType === "eps") {
    query = `SELECT id, title FROM eps WHERE deleted_at IS NULL AND status = 'published' ORDER BY title LIMIT ? OFFSET ?`;
    countQuery = `SELECT COUNT(*) as total FROM eps WHERE deleted_at IS NULL AND status = 'published'`;
    title = "🎵 EPs"; emoji = "🎵"; itemNameField = "title";
  } else if (listType === "playlists") {
    query = `SELECT id, name FROM playlists WHERE deleted_at IS NULL AND status = 'published' ORDER BY name LIMIT ? OFFSET ?`;
    countQuery = `SELECT COUNT(*) as total FROM playlists WHERE deleted_at IS NULL AND status = 'published'`;
    title = "📋 Playlists"; emoji = "📋"; itemNameField = "name";
  }
  
  const [items, countResult] = await Promise.all([
    env.DB.prepare(query).bind(ITEMS_PER_PAGE, offset).all(),
    env.DB.prepare(countQuery).first()
  ]);
  
  const totalItems = countResult.total;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  
  let responseText = `${title} (Page ${page}/${totalPages})\n\n`;
  
  if (items.results && items.results.length > 0) {
    items.results.forEach((item, index) => {
      responseText += `${offset + index + 1}. ${item[itemNameField]}\n`;
    });
  } else {
    responseText += `No ${listType} found.`;
  }
  
  const buttons = [];
  
  if (items.results) {
    items.results.forEach((item) => {
      buttons.push([{ text: `${emoji} ${item[itemNameField]}`, callback_data: `${listType.slice(0, -1)}_${item.id}` }]);
    });
  }
  
  const paginationRow = [];
  if (page > 1) {
    paginationRow.push({ text: "⬅️ Prev", callback_data: `page_${listType}_${page - 1}_${filterLetter}` });
  }
  paginationRow.push({ text: `${page}/${totalPages}`, callback_data: "noop" });
  if (page < totalPages) {
    paginationRow.push({ text: "Next ➡️", callback_data: `page_${listType}_${page + 1}_${filterLetter}` });
  }
  if (paginationRow.length > 1) buttons.push(paginationRow);
  
  // 👇 The A-Z Button (Only for Artists)
  const actionRow = [];
  if (listType === "artists") {
    actionRow.push({ text: "👤 A-Z Artists", callback_data: `filter_artists_SHOW_ALPHABET_1` });
  }
  actionRow.push({ text: "❌ Close", callback_data: "delete_message" });
  buttons.push(actionRow);
  
  const keyboard = { inline_keyboard: buttons };
  
  if (messageId) {
    await fetch(`${TELEGRAM_API}/editMessageText`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: responseText, reply_markup: keyboard })
    });
    return { message_id: messageId };
  } else {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: responseText, reply_markup: keyboard })
    });
    const data = await res.json();
    return { message_id: data.result?.message_id };
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
  
  if (artist.image_url && artist.image_url !== "" && artist.image_url !== "null") {
    await sendPhotoWithCaption(chatId, artist.image_url, caption, env);
  } else {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption
      })
    });
  }
  
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
  
  const artistQuery = `
    SELECT a.name FROM artists a
    LEFT JOIN albums alb ON alb.artist_id = a.id
    WHERE alb.id = ? AND a.deleted_at IS NULL AND a.status = 'published'
  `;
  const artist = await env.DB.prepare(artistQuery).bind(albumId).first();
  
  const tracksCountQuery = `
    SELECT COUNT(*) as total FROM album_tracks at
    LEFT JOIN tracks t ON at.track_id = t.id
    WHERE at.album_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
  `;
  const totalTracksResult = await env.DB.prepare(tracksCountQuery).bind(albumId).first();
  const totalTracks = totalTracksResult.total || 0;
  
  let caption = `💽 ALBUM: ${album.title}\n\n`;
  if (artist && artist.name) {
    caption += `👤 Artist: ${artist.name}\n`;
  }
  if (album.release_date) {
    caption += `📅 Release: ${album.release_date}\n`;
  }
  caption += `🎧 Total Tracks: ${totalTracks}`;
  
  if (album.cover_url && album.cover_url !== "" && album.cover_url !== "null") {
    await sendPhotoWithCaption(chatId, album.cover_url, caption, env);
  } else {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption
      })
    });
  }
  
  if (totalTracks === 0) {
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
  
  const buttons = [];
  buttons.push([{ text: "📀 Get All", callback_data: `getall_album_${albumId}` }]);
  buttons.push([{ text: "❌", callback_data: "delete_message" }]);
  
  const keyboard = { inline_keyboard: buttons };
  
  const response = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "🎵 Options:",
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
  
  const artistQuery = `
    SELECT a.name FROM artists a
    LEFT JOIN eps e ON e.artist_id = a.id
    WHERE e.id = ? AND a.deleted_at IS NULL AND a.status = 'published'
  `;
  const artist = await env.DB.prepare(artistQuery).bind(epId).first();
  
  const tracksCountQuery = `
    SELECT COUNT(*) as total FROM ep_tracks et
    LEFT JOIN tracks t ON et.track_id = t.id
    WHERE et.ep_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
  `;
  const totalTracksResult = await env.DB.prepare(tracksCountQuery).bind(epId).first();
  const totalTracks = totalTracksResult.total || 0;
  
  let caption = `🎵 EP: ${ep.title}\n\n`;
  if (artist && artist.name) {
    caption += `👤 Artist: ${artist.name}\n`;
  }
  if (ep.release_date) {
    caption += `📅 Release: ${ep.release_date}\n`;
  }
  caption += `🎧 Total Tracks: ${totalTracks}`;
  
  if (ep.cover_url && ep.cover_url !== "" && ep.cover_url !== "null") {
    await sendPhotoWithCaption(chatId, ep.cover_url, caption, env);
  } else {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption
      })
    });
  }
  
  if (totalTracks === 0) {
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
  
  const buttons = [];
  buttons.push([{ text: "📀 Get All", callback_data: `getall_ep_${epId}` }]);
  buttons.push([{ text: "❌", callback_data: "delete_message" }]);
  
  const keyboard = { inline_keyboard: buttons };
  
  const response = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "🎵 Options:",
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
  
  const tracksCountQuery = `
    SELECT COUNT(*) as total FROM playlist_tracks pt
    LEFT JOIN tracks t ON pt.track_id = t.id
    WHERE pt.playlist_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
  `;
  const totalTracksResult = await env.DB.prepare(tracksCountQuery).bind(playlistId).first();
  const totalTracks = totalTracksResult.total || 0;
  
  const caption = `📋 PLAYLIST: ${playlist.name}\n\n🎧 Total Tracks: ${totalTracks}`;
  
  if (playlist.cover_url && playlist.cover_url !== "" && playlist.cover_url !== "null") {
    await sendPhotoWithCaption(chatId, playlist.cover_url, caption, env);
  } else {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption
      })
    });
  }
  
  if (totalTracks === 0) {
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
  
  const buttons = [];
  buttons.push([{ text: "📀 Get All", callback_data: `getall_playlist_${playlistId}` }]);
  buttons.push([{ text: "❌", callback_data: "delete_message" }]);
  
  const keyboard = { inline_keyboard: buttons };
  
  const response = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "🎵 Options:",
      reply_markup: keyboard
    })
  });
  
  const responseData = await response.json();
  if (responseData.result) {
    setLastMessageId(chatId, responseData.result.message_id);
  }
}

export async function handleTrack(callbackQuery, env, ctx) {
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
  
  const artistLinks = await env.DB.prepare(
    "SELECT DISTINCT artist_id FROM track_artists WHERE track_id = ?"
  ).bind(trackId).all();
  
  const artistIds = artistLinks.results ? artistLinks.results.map(r => r.artist_id) : [];
  
  const updates = [
    env.DB.prepare("UPDATE tracks SET bot_downloads = bot_downloads + 1 WHERE id = ?").bind(trackId),
    env.DB.prepare("UPDATE bot_users SET user_total_downloads = user_total_downloads + 1 WHERE user_id = ?").bind(chatId)
  ];
  
  artistIds.forEach(id => {
    updates.push(
      env.DB.prepare("UPDATE artists SET bot_total_downloads = bot_total_downloads + 1 WHERE id = ?").bind(id)
    );
  });
  
  ctx.waitUntil(env.DB.batch(updates));
}

export async function handleGetAllAlbum(callbackQuery, env, ctx) {
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
  
  const trackIds = tracks.results.map(t => t.id);
  
  const placeholders = trackIds.map(() => '?').join(',');
  const artistLinks = await env.DB.prepare(
    `SELECT DISTINCT artist_id FROM track_artists WHERE track_id IN (${placeholders})`
  ).bind(...trackIds).all();
  
  const artistIds = artistLinks.results ? artistLinks.results.map(r => r.artist_id) : [];
  
  const updates = [
    env.DB.prepare("UPDATE albums SET bot_downloads = bot_downloads + 1 WHERE id = ?").bind(albumId),
    // 👇 FIX: Add totalTracks to user profile
    env.DB.prepare(`UPDATE bot_users SET user_total_downloads = user_total_downloads + ${totalTracks} WHERE user_id = ?`).bind(chatId)
  ];
  
  trackIds.forEach(id => {
    updates.push(
      env.DB.prepare("UPDATE tracks SET bot_downloads = bot_downloads + 1 WHERE id = ?").bind(id)
    );
  });
  
  artistIds.forEach(id => {
    updates.push(
      env.DB.prepare("UPDATE artists SET bot_total_downloads = bot_total_downloads + 1 WHERE id = ?").bind(id)
    );
  });
  
  ctx.waitUntil(env.DB.batch(updates));
}

export async function handleGetAllEp(callbackQuery, env, ctx) {
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
  
  const trackIds = tracks.results.map(t => t.id);
  
  const placeholders = trackIds.map(() => '?').join(',');
  const artistLinks = await env.DB.prepare(
    `SELECT DISTINCT artist_id FROM track_artists WHERE track_id IN (${placeholders})`
  ).bind(...trackIds).all();
  
  const artistIds = artistLinks.results ? artistLinks.results.map(r => r.artist_id) : [];
  
  const updates = [
    env.DB.prepare("UPDATE eps SET bot_downloads = bot_downloads + 1 WHERE id = ?").bind(epId),
    // 👇 FIX: Add totalTracks to user profile
    env.DB.prepare(`UPDATE bot_users SET user_total_downloads = user_total_downloads + ${totalTracks} WHERE user_id = ?`).bind(chatId)
  ];
  
  trackIds.forEach(id => {
    updates.push(
      env.DB.prepare("UPDATE tracks SET bot_downloads = bot_downloads + 1 WHERE id = ?").bind(id)
    );
  });
  
  artistIds.forEach(id => {
    updates.push(
      env.DB.prepare("UPDATE artists SET bot_total_downloads = bot_total_downloads + 1 WHERE id = ?").bind(id)
    );
  });
  
  ctx.waitUntil(env.DB.batch(updates));
}

export async function handleGetAllPlaylist(callbackQuery, env, ctx) {
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
  
  const trackIds = tracks.results.map(t => t.id);
  
  const placeholders = trackIds.map(() => '?').join(',');
  const artistLinks = await env.DB.prepare(
    `SELECT DISTINCT artist_id FROM track_artists WHERE track_id IN (${placeholders})`
  ).bind(...trackIds).all();
  
  const artistIds = artistLinks.results ? artistLinks.results.map(r => r.artist_id) : [];
  
  const updates = [
    env.DB.prepare("UPDATE playlists SET bot_downloads = bot_downloads + 1 WHERE id = ?").bind(playlistId),
    // 👇 FIX: Add totalTracks to user profile
    env.DB.prepare(`UPDATE bot_users SET user_total_downloads = user_total_downloads + ${totalTracks} WHERE user_id = ?`).bind(chatId)
  ];
  
  trackIds.forEach(id => {
    updates.push(
      env.DB.prepare("UPDATE tracks SET bot_downloads = bot_downloads + 1 WHERE id = ?").bind(id)
    );
  });
  
  artistIds.forEach(id => {
    updates.push(
      env.DB.prepare("UPDATE artists SET bot_total_downloads = bot_total_downloads + 1 WHERE id = ?").bind(id)
    );
  });
  
  ctx.waitUntil(env.DB.batch(updates));
}