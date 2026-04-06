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

        if (callback.data === "check_join") {
          const isMember = await checkSubscription(callback.from.id, env.CHANNEL_USERNAME, env.BOT_TOKEN);
          if (isMember) {
            await deleteMessage(chatId, callback.message.message_id, env.BOT_TOKEN);
            await answerCallbackQuery(callback.id, "✅ Access Granted!", false, env.BOT_TOKEN);
            await sendMessage(chatId, "Welcome! You can now search for music by title or artist.", env.BOT_TOKEN);
          } else {
            await answerCallbackQuery(callback.id, "❌ Please join the channel first!", true, env.BOT_TOKEN);
          }
        }
        return new Response("OK");
      }

      const message = payload.message;
      if (!message || !message.text) return new Response("OK");

      const chatId = message.chat.id;
      const userId = message.from.id;
      const text = message.text;
      const isAdmin = userId.toString() === env.ADMIN_ID.toString();

      // --- 1. SETTINGS & FORCE SUB CHECK ---
      const settings = await env.DB.prepare("SELECT force_sub_enabled FROM bot_settings WHERE id = 1").first();
      const isForceSubOn = settings?.force_sub_enabled === 1;

      if (isForceSubOn && !isAdmin) {
        const isMember = await checkSubscription(userId, env.CHANNEL_USERNAME, env.BOT_TOKEN);
        if (!isMember) {
          const keyboard = {
            inline_keyboard: [
              [{ text: "Join Channel 🚀", url: `https://t.me/${env.CHANNEL_USERNAME}` }],
              [{ text: "I have Joined ✅", callback_data: "check_join" }]
            ]
          };
          return sendMessage(chatId, `⚠️ <b>Access Denied!</b>\nYou must join @${env.CHANNEL_USERNAME} to use this bot.`, env.BOT_TOKEN, keyboard);
        }
      }

      // --- 2. COMMAND vs SEARCH LOGIC ---
      if (text.startsWith("/")) {
        await handleCommand(chatId, userId, text, env);
      } else {
        // MUSIC SEARCH
        const results = await searchTracks(env.DB, text);

        if (results.length === 0) {
          await sendMessage(chatId, "😔 Sorry, I couldn't find that track in the <b>ZedTopVibes</b> library.", env.BOT_TOKEN);
        } else {
          const track = results[0];
          const { caption, artwork } = formatTrackMessage(track);
          const keyboard = {
            inline_keyboard: [[{ text: "⬇️ Download MP3", callback_data: `dl_${track.id}` }]]
          };

          try {
            // Attempt to send as Photo
            const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendPhoto`, {
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

            const resData = await response.json();
            // If the Photo URL is invalid, fall back to simple text
            if (!resData.ok) {
              await sendMessage(chatId, caption, env.BOT_TOKEN, keyboard);
            }
          } catch (e) {
            await sendMessage(chatId, caption, env.BOT_TOKEN, keyboard);
          }
        }
      }

    } catch (err) {
      console.error("Critical Bot Error:", err);
    }

    return new Response("OK", { status: 200 });
  },
};
