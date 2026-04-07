import { sendMessage, sendPhoto, answerCallbackQuery } from './utils.js';
import { searchTracks, formatTrackMessage } from './music.js';
import { searchArtist, getArtistTracks, formatArtistUI } from './artists.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("OK");

    try {
      const payload = await request.json();

      // --- CALLBACK HANDLER (Downloads) ---
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

          if (!track) return await answerCallbackQuery(cb.id, "❌ Not found", true, env.BOT_TOKEN);
          await answerCallbackQuery(cb.id, "📥 Sending MP3...", false, env.BOT_TOKEN);
          
          const audioUrl = `https://files.zedtopvibes.com/${encodeURIComponent(track.r2_key)}`;

          await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendAudio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: cb.message.chat.id,
              audio: audioUrl,
              title: track.title,
              performer: track.artist || "ZedTopVibes"
            })
          });
        }
        return new Response("OK");
      }

      // --- MESSAGE HANDLER (Search) ---
      const msg = payload.message;
      if (!msg || !msg.text) return new Response("OK");
      const query = msg.text.trim();
      if (query.startsWith("/")) return new Response("OK");

      // 1. Search for ARTIST
      const artistResult = await searchArtist(env.DB, query);

      if (artistResult) {
        const tracks = await getArtistTracks(env.DB, artistResult.id);
        const { text, keyboard } = formatArtistUI(artistResult, tracks);
        await sendMessage(msg.chat.id, text, env.BOT_TOKEN, keyboard);

      } else {
        // 2. Fallback to TRACK search
        const trackResults = await searchTracks(env.DB, query);
        
        if (trackResults.length > 0) {
          const track = trackResults[0];
          const { caption, artwork } = formatTrackMessage(track);
          const keyboard = {
            inline_keyboard: [[{ text: "⬇️ Download MP3", callback_data: `dl_${track.id}` }]]
          };
          await sendPhoto(msg.chat.id, artwork, caption, keyboard, env.BOT_TOKEN);
        } else {
          await sendMessage(msg.chat.id, `😔 No artist or track found for "${query}".`, env.BOT_TOKEN);
        }
      }

    } catch (err) {
      console.error("Worker Error:", err);
    }
    return new Response("OK");
  }
};
