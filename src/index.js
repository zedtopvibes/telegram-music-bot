import { handleCommand } from './commands.js';
import { sendMessage, checkSubscription, deleteMessage, answerCallbackQuery } from './utils.js';
import { searchTracks, formatTrackMessage } from './music.js';
import { searchAlbum, getTracksForAlbum, formatAlbumUI } from './albums.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("OK");

    try {
      const payload = await request.json();
      
      // --- 1. CALLBACK HANDLER (Downloads) ---
      if (payload.callback_query) {
        const callback = payload.callback_query;
        const data = callback.data;
        const chatId = callback.message.chat.id;

        if (data.startsWith("dl_")) {
          const trackId = data.replace("dl_", "");
          
          // Get track & encode URL for the CDN (The Solid Solution)
          const track = await env.DB.prepare(`
            SELECT t.title, t.r2_key, a.name as artist_name 
            FROM tracks t
            LEFT JOIN track_artists ta ON t.id = ta.track_id
            LEFT JOIN artists a ON ta.artist_id = a.id
            WHERE t.id = ? AND ta.is_primary = 1 LIMIT 1
          `).bind(trackId).first();

          if (!track) return await answerCallbackQuery(callback.id, "❌ Not found", true, env.BOT_TOKEN);

          await answerCallbackQuery(callback.id, "📥 Sending audio...", false, env.BOT_TOKEN);

          const audioUrl = `https://files.zedtopvibes.com/${encodeURIComponent(track.r2_key)}`;

          await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendAudio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              audio: audioUrl,
              title: track.title,
              performer: track.artist_name
            })
          });
        }
        return new Response("OK");
      }

      // --- 2. MESSAGE HANDLER (Search) ---
      const message = payload.message;
      if (!message || !message.text) return new Response("OK");

      const text = message.text;
      const chatId = message.chat.id;

      if (text.startsWith("/")) {
        await handleCommand(chatId, message.from.id, text, env);
      } else {
        // Search Step A: Check for Tracks
        const trackResults = await searchTracks(env.DB, text);
        
        if (trackResults.length > 0) {
          const { caption, artwork } = formatTrackMessage(trackResults[0]);
          const keyboard = { inline_keyboard: [[{ text: "⬇️ Download MP3", callback_data: `dl_${trackResults[0].id}` }]] };
          
          await sendPhoto(chatId, artwork, caption, keyboard, env.BOT_TOKEN);
        } else {
          // Search Step B: If no tracks, check for Albums
          const album = await searchAlbum(env.DB, text);
          if (album) {
            const tracks = await getTracksForAlbum(env.DB, album.id);
            const { caption, artwork, keyboard } = formatAlbumUI(album, tracks);
            
            await sendPhoto(chatId, artwork, caption, keyboard, env.BOT_TOKEN);
          } else {
            await sendMessage(chatId, "😔 Nothing found for that search.", env.BOT_TOKEN);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
    return new Response("OK");
  }
};

// Helper to keep index.js clean
async function sendPhoto(chatId, photo, caption, keyboard, token) {
  return await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photo,
      caption: caption,
      parse_mode: "HTML",
      reply_markup: keyboard
    })
  });
}
