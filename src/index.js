import { handleCommand } from './commands.js';
import { sendMessage, checkSubscription, deleteMessage, answerCallbackQuery } from './utils.js';
import { searchTracks, formatTrackMessage } from './music.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("OK");

    try {
      const payload = await request.json();
      
      // --- CALLBACK QUERY HANDLER ---
      if (payload.callback_query) {
        const callback = payload.callback_query;
        const chatId = callback.message.chat.id;
        const data = callback.data;

        // Force Join Check
        if (data === "check_join") {
          const isMember = await checkSubscription(callback.from.id, env.CHANNEL_USERNAME, env.BOT_TOKEN);
          if (isMember) {
            await deleteMessage(chatId, callback.message.message_id, env.BOT_TOKEN);
            await answerCallbackQuery(callback.id, "✅ Access Granted!", false, env.BOT_TOKEN);
            await sendMessage(chatId, "Welcome! Search for music by title or artist.", env.BOT_TOKEN);
          } else {
            await answerCallbackQuery(callback.id, "❌ Please join the channel first!", true, env.BOT_TOKEN);
          }
        }

        // DOWNLOAD HANDLER (The Solid Solution)
        if (data.startsWith("dl_")) {
          const trackId = data.replace("dl_", "");
          
          const track = await env.DB.prepare(`
            SELECT t.title, t.r2_key, a.name as artist_name 
            FROM tracks t
            LEFT JOIN track_artists ta ON t.id = ta.track_id
            LEFT JOIN artists a ON ta.artist_id = a.id
            WHERE t.id = ? AND ta.is_primary = 1
            LIMIT 1
          `).bind(trackId).first();

          if (!track || !track.r2_key) {
            return await answerCallbackQuery(callback.id, "❌ Song not found.", true, env.BOT_TOKEN);
          }

          await answerCallbackQuery(callback.id, "📥 Preparing audio...", false, env.BOT_TOKEN);

          // Build the Encoded URL
          const cdnBase = "https://files.zedtopvibes.com";
          const safeFilename = encodeURIComponent(track.r2_key);
          const audioUrl = `${cdnBase}/${safeFilename}`;

          try {
            // Send to Telegram using the URL method
            const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendAudio`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                audio: audioUrl,
                title: track.title,
                performer: track.artist_name || "ZedTopVibes"
              })
            });

            const result = await response.json();
            if (!result.ok) {
              await sendMessage(chatId, `⚠️ Telegram error: ${result.description}`, env.BOT_TOKEN);
            }
          } catch (err) {
            await sendMessage(chatId, "❌ Connection to music server failed.", env.BOT_TOKEN);
          }
        }
        return new Response("OK");
      }

      const message = payload.message;
      if (!message || !message.text) return new Response("OK");

      const chatId = message.chat.id;
      const userId = message.from.id;
      const text = message.text;

      // Command or Search Logic
      if (text.startsWith("/")) {
        await handleCommand(chatId, userId, text, env);
      } else {
        const results = await searchTracks(env.DB, text);
        if (results.length === 0) {
          await sendMessage(chatId, "😔 No results found.", env.BOT_TOKEN);
        } else {
          const track = results[0];
          const { caption, artwork } = formatTrackMessage(track);
          const keyboard = {
            inline_keyboard: [[{ text: "⬇️ Download MP3", callback_data: `dl_${track.id}` }]]
          };

          // Try sending Photo, fallback to Text
          const photoRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              photo: artwork,
              caption: caption,
              parse_mode: "HTML",
              reply_markup: keyboard
            })
          });

          if (!(await photoRes.json()).ok) {
            await sendMessage(chatId, caption, env.BOT_TOKEN, keyboard);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
    return new Response("OK");
  },
};
