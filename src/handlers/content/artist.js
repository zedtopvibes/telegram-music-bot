import { checkUserSubscription, sendPhotoWithCaption } from "./utils.js";
import { deletePreviousMessage, setLastMessageId } from "../../utils/userState.js";

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;
const IMAGE_CDN = "https://zedtopvibes.com";

// 👇 1. VIEW ARTIST PROFILE
export async function handleArtist(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const artistId = callbackQuery.data.replace("artist_", "");
  
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
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  const artistQuery = `SELECT id, name, image_url, created_at FROM artists WHERE id = ? AND deleted_at IS NULL AND status = 'published'`;
  const artist = await env.DB.prepare(artistQuery).bind(artistId).first();
  
  if (!artist) return;
  
  const tracksQuery = `SELECT COUNT(*) as total FROM tracks t LEFT JOIN track_artists ta ON t.id = ta.track_id WHERE ta.artist_id = ? AND t.deleted_at IS NULL AND t.status = 'published'`;
  const tracksResult = await env.DB.prepare(tracksQuery).bind(artistId).first();
  const totalTracks = tracksResult.total || 0;
  const addedDate = artist.created_at ? artist.created_at.split(" ")[0] : "Unknown";
  
  const caption = `👤 <b>Artist:</b> ${artist.name}\n💿 <b>Songs:</b> ${totalTracks}\n🗓️ <b>Joined:</b> ${addedDate}`;
  
  // 👇 UPDATED BUTTONS: Follow replaced with Appears On
  const buttons = [
    [
      { text: "💿 Albums", callback_data: `artist_albums_${artistId}` },
      { text: "🎵 Songs", callback_data: `artist_songs_${artistId}` }
    ],
    [
      { text: "🔗 Related", callback_data: `artist_related_${artistId}` },
      { text: "🎤 Features", callback_data: `artist_appears_${artistId}` }
    ],
    [{ text: "❌ Close", callback_data: "delete_message" }]
  ];
  const keyboard = { inline_keyboard: buttons };
  
  if (artist.image_url && artist.image_url !== "" && artist.image_url !== "null") {
    await sendPhotoWithCaption(chatId, artist.image_url, caption, env, keyboard);
  } else {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: caption, parse_mode: "HTML", reply_markup: keyboard })
    });
  }
}

// 👇 2. VIEW ARTIST SONGS (Edits the caption under the photo)
export async function handleArtistSongsView(chatId, messageId, artistId, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API_URL = TELEGRAM_API(BOT_TOKEN);
  
  try {
    const artistQuery = `SELECT name FROM artists WHERE id = ?`;
    const artist = await env.DB.prepare(artistQuery).bind(artistId).first();
    
    // 👇 UPDATED QUERY: Getting Artist name + Featured names + Song title
    const tracksQuery = `
      SELECT 
        t.id, 
        t.title,
        (SELECT a.name FROM track_artists ta JOIN artists a ON ta.artist_id = a.id WHERE ta.track_id = t.id AND ta.is_primary = 1 LIMIT 1) as main_artist,
        (SELECT GROUP_CONCAT(a.name, ', ') FROM track_artists ta JOIN artists a ON ta.artist_id = a.id WHERE ta.track_id = t.id AND ta.is_primary = 0) as featured_artists
      FROM tracks t
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      WHERE ta.artist_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
      GROUP BY t.id ORDER BY t.title LIMIT 20
    `;
    const tracks = await env.DB.prepare(tracksQuery).bind(artistId).all();
    
    let caption = `🎵 <b>${artist.name} - Songs</b>\n━━━━━━━━━━━━━━━━━━\n\n`;
    const buttons = [];
    
    if (tracks.results && tracks.results.length > 0) {
      tracks.results.forEach((track) => {
        const mainArtist = track.main_artist || artist.name;
        const feat = track.featured_artists ? ` feat. ${track.featured_artists}` : "";
        // Format: 🎤 Artist feat. Feature - Title
        buttons.push([{ text: `🎤 ${mainArtist}${feat} - ${track.title}`, callback_data: `track_${track.id}` }]);
      });
    } else {
      caption += `No songs found.`;
    }
    
    buttons.push([{ text: "🔙 Back to Artist", callback_data: `artist_${artistId}` }]);
    buttons.push([{ text: "❌ Close", callback_data: "delete_message" }]);

    await fetch(`${TELEGRAM_API_URL}/editMessageCaption`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, caption: caption, parse_mode: "HTML" })
    });
    
    await fetch(`${TELEGRAM_API_URL}/editMessageReplyMarkup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: buttons } })
    });
    
  } catch (error) {
    console.error("Songs View Error:", error);
  }
}

// 👇 3. VIEW ARTIST ALBUMS
export async function handleArtistAlbumsView(chatId, messageId, artistId, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API_URL = TELEGRAM_API(BOT_TOKEN);
  
  try {
    const artistQuery = `SELECT name FROM artists WHERE id = ?`;
    const artist = await env.DB.prepare(artistQuery).bind(artistId).first();
    
    const albumsQuery = `SELECT id, title FROM albums WHERE artist_id = ? AND deleted_at IS NULL AND status = 'published' ORDER BY title LIMIT 20`;
    const albums = await env.DB.prepare(albumsQuery).bind(artistId).all();
    
    let caption = `💿 <b>${artist.name} - Albums</b>\n━━━━━━━━━━━━━━━━━━\n\n`;
    const buttons = [];
    
    if (albums.results && albums.results.length > 0) {
      let row = [];
      albums.results.forEach((album, index) => {
        row.push({ text: `${album.title}`, callback_data: `album_${album.id}` });
        if (row.length === 2 || index === albums.results.length - 1) {
          buttons.push(row);
          row = [];
        }
      });
    } else {
      caption += `No albums found.`;
    }
    
    buttons.push([{ text: "🔙 Back to Artist", callback_data: `artist_${artistId}` }]);
    buttons.push([{ text: "❌ Close", callback_data: "delete_message" }]);

    await fetch(`${TELEGRAM_API_URL}/editMessageCaption`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, caption: caption, parse_mode: "HTML" })
    });
    
    await fetch(`${TELEGRAM_API_URL}/editMessageReplyMarkup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: buttons } })
    });
    
  } catch (error) {
    console.error("Albums View Error:", error);
  }
}

// 👇 4. VIEW ARTIST APPEARS ON (New Feature)
export async function handleArtistAppearsOnView(chatId, messageId, artistId, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API_URL = TELEGRAM_API(BOT_TOKEN);
  
  try {
    const artistQuery = `SELECT name FROM artists WHERE id = ?`;
    const artist = await env.DB.prepare(artistQuery).bind(artistId).first();
    
    // Query to find tracks where this artist is a FEATURE (is_primary = 0)
    const tracksQuery = `
      SELECT 
        t.id, 
        t.title,
        (SELECT a.name FROM track_artists ta JOIN artists a ON ta.artist_id = a.id WHERE ta.track_id = t.id AND ta.is_primary = 1 LIMIT 1) as main_artist
      FROM tracks t
      JOIN track_artists ta ON t.id = ta.track_id
      WHERE ta.artist_id = ? AND ta.is_primary = 0 AND t.deleted_at IS NULL AND t.status = 'published'
      ORDER BY t.title LIMIT 20
    `;
    const tracks = await env.DB.prepare(tracksQuery).bind(artistId).all();
    
    let caption = `🎤 <b>${artist.name} - Appears On</b>\n━━━━━━━━━━━━━━━━━━\n\n`;
    const buttons = [];
    
    if (tracks.results && tracks.results.length > 0) {
      tracks.results.forEach((track) => {
        const mainArtist = track.main_artist || "Unknown Artist";
        // Format: 🎤 Main Artist feat. This Artist - Title
        buttons.push([{ text: `🎤 ${mainArtist} feat. ${artist.name} - ${track.title}`, callback_data: `track_${track.id}` }]);
      });
    } else {
      caption += `No featured appearances found.`;
    }
    
    buttons.push([{ text: "🔙 Back to Artist", callback_data: `artist_${artistId}` }]);
    buttons.push([{ text: "❌ Close", callback_data: "delete_message" }]);

    await fetch(`${TELEGRAM_API_URL}/editMessageCaption`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, caption: caption, parse_mode: "HTML" })
    });
    
    await fetch(`${TELEGRAM_API_URL}/editMessageReplyMarkup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: buttons } })
    });
    
  } catch (error) {
    console.error("Appears On View Error:", error);
  }
}



// 👇 5. VIEW ARTIST RELATED (Smart Match by Genre + Gender)
export async function handleArtistRelatedView(chatId, messageId, artistId, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API_URL = TELEGRAM_API(BOT_TOKEN);
  
  try {
    // 1. Get the current artist's details
    const artistQuery = `SELECT name, genre, gender FROM artists WHERE id = ?`;
    const artist = await env.DB.prepare(artistQuery).bind(artistId).first();
    
    if (!artist) return;
    
    // 2. Try to find related artists (Same Genre + Same Gender)
    let relatedQuery = `
      SELECT id, name FROM artists 
      WHERE genre = ? AND gender = ? AND id != ? AND deleted_at IS NULL AND status = 'published'
      LIMIT 6
    `;
    let related = await env.DB.prepare(relatedQuery).bind(artist.genre, artist.gender, artistId).all();
    
    // 3. Fallback: If no strict matches, just find same Genre (any gender)
    if (!related.results || related.results.length === 0) {
      relatedQuery = `
        SELECT id, name FROM artists 
        WHERE genre = ? AND id != ? AND deleted_at IS NULL AND status = 'published'
        LIMIT 6
      `;
      related = await env.DB.prepare(relatedQuery).bind(artist.genre, artistId).all();
    }

    // 4. Last Resort: If still empty, just show random Zambian artists
    if (!related.results || related.results.length === 0) {
      relatedQuery = `
        SELECT id, name FROM artists 
        WHERE id != ? AND deleted_at IS NULL AND status = 'published'
        LIMIT 6
      `;
      related = await env.DB.prepare(relatedQuery).bind(artistId).all();
    }
    
    let caption = `🔗 <b>Artists Related to ${artist.name}</b>\n━━━━━━━━━━━━━━━━━━\n\n`;
    const buttons = [];
    
    if (related.results && related.results.length > 0) {
      let row = [];
      related.results.forEach((rel, index) => {
        row.push({ text: `🎤 ${rel.name}`, callback_data: `artist_${rel.id}` });
        if (row.length === 2 || index === related.results.length - 1) {
          buttons.push(row);
          row = [];
        }
      });
    } else {
      caption += `No related artists found.`;
    }
    
    buttons.push([{ text: "🔙 Back to Artist", callback_data: `artist_${artistId}` }]);
    buttons.push([{ text: "❌ Close", callback_data: "delete_message" }]);

    // Edit the photo caption and buttons
    await fetch(`${TELEGRAM_API_URL}/editMessageCaption`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, caption: caption, parse_mode: "HTML" })
    });
    
    await fetch(`${TELEGRAM_API_URL}/editMessageReplyMarkup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: buttons } })
    });
    
  } catch (error) {
    console.error("Related View Error:", error);
  }
}