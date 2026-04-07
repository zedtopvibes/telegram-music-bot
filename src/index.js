import { handleCommand } from './commands.js';
import { sendMessage, checkSubscription, deleteMessage, answerCallbackQuery } from './utils.js';
import { searchTracks, formatTrackMessage } from './music.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("OK");

    try {
      const payload = await request.json();
      
      // --- CALLBACK QUERY HANDLER (Buttons) ---
      if (payload.callback_query) {
        const callback = payload.callback_query;
        const chatId = callback.message.chat.id;
        const data = callback.data;

        // Force Join Channel Check
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

        // DOWNLOAD HANDLER
        if (data.startsWith("dl_")) {
          const trackId = data.replace("dl_", "");
          
          const track = await env.DB.prepare(`
            SELECT t.title, t.r2_key, a.name as artist_name 
            FROM tracks t
            LEFT JOIN track_artists ta ON t.id = ta.track_id
            LEFT JOIN artists a ON ta.artist_id = a.id
            WHERE t.id = ? AND ta.is_primary = 1
          `).bind(trackId).first();

          if (!track || !track.r2_key) {
            return await answerCallbackQuery(callback.id, "❌ MP3 File not found.", true, env.BOT_TOKEN);
          }

          await answerCallbackQuery(callback.id, "📥 Sending MP3...", false, env.BOT_TOKEN);

          try {
            const object = await env.AUDIO.get(track.r2_key);
            if (!object) throw new Error("File missing in R2");

            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('audio', object.body, track.r2_key);
            formData.append('title', track.title);
            formData.append('performer', track.artist_name || "ZedTopVibes");

            await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendAudio`, {
              method: 'POST',
              body: formData
            });
          } catch (err) {
            await sendMessage(chatId, "⚠️ Error retrieving file from storage.", env.BOT_TOKEN);
          }
        }
        return new Response("OK");
      }

      const message = payload.message;
      if (!message || !message.text) return new Response("OK");

      const chatId = message.chat.id;
      const userId = message.from.id;
      const text = message.text;

      // Force Sub Logic
      const settings = await env.DB.prepare("SELECT force_sub_enabled FROM bot_settings WHERE id = 1").first();
      if (settings?.force_sub_enabled === 1 && userId.toString() !== env.ADMIN_ID.toString()) {
        const isMember = await checkSubscription(userId, env.CHANNEL_USERNAME, env.BOT_TOKEN);
        if (!isMember) {
          const keyboard = {
            inline_keyboard: [
              [{ text: "Join Channel 🚀", url: `https://t.me/${env.CHANNEL_USERNAME}` }],
              [{ text: "I have Joined ✅", callback_data: "check_join" }]
            ]
          };
          return sendMessage(chatId, `⚠️ Join @${env.CHANNEL_USERNAME} to download music!`, env.BOT_TOKEN, keyboard);
        }
      }

      // COMMAND OR SEARCH
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
  }
};
