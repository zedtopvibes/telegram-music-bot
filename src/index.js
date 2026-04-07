import { sendMessage, sendPhoto, answerCallbackQuery } from './utils.js';
import { searchTracks, formatTrackMessage } from './music.js';
import { searchArtist, getArtistTracks, formatArtistUI } from './artists.js';

export default {
  async fetch(request, env) {
    // Only handle POST requests from Telegram Webhooks
    if (request.method !== "POST") return new Response("OK");

    try {
      const payload = await request.json();

      // --- 1. CALLBACK QUERY HANDLER (Download Buttons) ---
      if (payload.callback_query) {
        const cb = payload.callback_query;
        
        if (cb.data.startsWith("dl_")) {
          const trackId = cb.data.replace("dl_", "");
          
          // Get track details and primary artist name
          const track = await env.DB.prepare(`
            SELECT t.title, t.r2_key, a.name as artist 
            FROM tracks t 
            LEFT JOIN track_artists ta ON t.id = ta.track_id 
            LEFT JOIN artists a ON ta.artist_id = a.id 
            WHERE t.id = ? LIMIT 1
          `).bind(trackId).first();

          if (!track) {
            return await answerCallbackQuery(cb.id, "❌ Track not found", true, env.BOT_TOKEN);
          }

          await answerCallbackQuery(cb.id, "📥 Preparing your download...", false, env.BOT_TOKEN);
          
          // Construct the R2 Public URL for the audio file
          const audioUrl = `https://files.zedtopvibes.com/${encodeURIComponent(track.r2_key)}`;

          // Send the MP3 file directly to the user
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

      // --- 2. MESSAGE HANDLER (Text Search) ---
      const msg = payload.message;
      if (!msg || !msg.text) return new Response("OK");
      
      const query = msg.text.trim();
      
      // Ignore Telegram commands
      if (query.startsWith("/")) return new Response("OK");

      // STEP A: Search for an Artist first
      const artistResult = await searchArtist(env.DB, query);

      if (artistResult) {
        const tracks = await getArtistTracks(env.DB, artistResult.id);
        const { caption, artwork, keyboard } = formatArtistUI(artistResult, tracks);
        
        try {
          // Attempt to send the Artist Profile with their image via your Proxy
          await sendPhoto(msg.chat.id, artwork, caption, keyboard, env.BOT_TOKEN);
        } catch (e) {
          // Fallback to text if the image proxy fails or image is missing
          await sendMessage(msg.chat.id, caption, env.BOT_TOKEN, keyboard);
        }

      } else {
        // STEP B: Fallback to Track search if no Artist is found
        const trackResults = await searchTracks(env.DB, query);
        
        if (trackResults.length > 0) {
          const track = trackResults[0];
          const { caption, artwork } = formatTrackMessage(track);
          const keyboard = {
            inline_keyboard: [[{ 
              text: "⬇️ Download MP3", 
              callback_data: `dl_${track.id}` 
            }]]
          };

          // Send individual track with its artwork
          await sendPhoto(msg.chat.id, artwork, caption, keyboard, env.BOT_TOKEN);
        } else {
          // STEP C: No Artist or Track found
          await sendMessage(
            msg.chat.id, 
            `😔 Sorry, I couldn't find any results for "${query}". Try another name!`, 
            env.BOT_TOKEN
          );
        }
      }

    } catch (err) {
      console.error("Worker Global Error:", err);
    }

    return new Response("OK");
  }
};
