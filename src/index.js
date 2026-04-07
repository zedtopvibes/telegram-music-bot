import { sendMessage, sendPhoto, answerCallbackQuery } from './utils.js';
import { searchTracks, formatTrackMessage } from './music.js';
import { searchAlbum, getTracksForAlbum, formatAlbumUI } from './albums.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("OK");

    try {
      const payload = await request.json();

      // --- 1. DOWNLOAD HANDLER (Same as before) ---
      if (payload.callback_query) {
        const cb = payload.callback_query;
        if (cb.data.startsWith("dl_")) {
          const trackId = cb.data.replace("dl_", "");
          const track = await env.DB.prepare(`
            SELECT t.title, t.r2_key, a.name as artist 
            FROM tracks t 
            LEFT JOIN track_artists ta ON t.id = ta.track_id 
            LEFT JOIN artists a ON ta.artist_id = a.id 
            WHERE t.id = ? LIMIT 1
          `).bind(trackId).first();

          if (!track) return await answerCallbackQuery(cb.id, "❌ Error", true, env.BOT_TOKEN);
          
          await answerCallbackQuery(cb.id, "📥 Sending...", false, env.BOT_TOKEN);
          const url = `https://files.zedtopvibes.com/${encodeURIComponent(track.r2_key)}`;

          await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendAudio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: cb.message.chat.id,
              audio: url,
              title: track.title,
              performer: track.artist
            })
          });
        }
        return new Response("OK");
      }

      // --- 2. SEARCH HANDLER ---
      const msg = payload.message;
      if (!msg || !msg.text) return new Response("OK");
      const query = msg.text.trim();

      // Parallel Search
      const [trackResults, albumResult] = await Promise.all([
        searchTracks(env.DB, query),
        searchAlbum(env.DB, query)
      ]);

      // PRIORITY LOGIC
      if (albumResult) {
        // ALBUMS = TEXT ONLY (Clean list)
        const tracks = await getTracksForAlbum(env.DB, albumResult.id);
        const { caption, keyboard } = formatAlbumUI(albumResult, tracks);
        await sendMessage(msg.chat.id, caption, env.BOT_TOKEN, keyboard);
      } 
      else if (trackResults.length > 0) {
        // TRACKS = WITH IMAGES 🖼️
        const track = trackResults[0];
        const { caption, artwork } = formatTrackMessage(track);
        const keyboard = { inline_keyboard: [[{ text: "⬇️ Download MP3", callback_data: `dl_${track.id}` }]] };
        
        await sendPhoto(msg.chat.id, artwork, caption, keyboard, env.BOT_TOKEN);
      } 
      else {
        await sendMessage(msg.chat.id, `😔 No results for "${query}".`, env.BOT_TOKEN);
      }

    } catch (err) {
      console.error(err);
    }
    return new Response("OK");
  }
};
