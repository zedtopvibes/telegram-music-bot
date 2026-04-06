import { handleCommand } from './commands.js';
import { sendMessage, checkSubscription, deleteMessage, answerCallbackQuery } from './utils.js';
import { searchTracks, formatTrackMessage } from './music.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("OK");

    try {
      const payload = await request.json();
      
      // Handle Button Clicks (Force Sub Check)
      if (payload.callback_query) {
        const callback = payload.callback_query;
        if (callback.data === "check_join") {
          const isMember = await checkSubscription(callback.from.id, env.CHANNEL_USERNAME, env.BOT_TOKEN);
          if (isMember) {
            await deleteMessage(callback.message.chat.id, callback.message.message_id, env.BOT_TOKEN);
            await answerCallbackQuery(callback.id, "✅ Access Granted!", false, env.BOT_TOKEN);
            await sendMessage(callback.message.chat.id, "Welcome! You can now search for music.", env.BOT_TOKEN);
          } else {
            await answerCallbackQuery(callback.id, "❌ Join the channel first!", true, env.BOT_TOKEN);
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

      // 1. Check Force Sub Setting
      const settings = await env.DB.prepare("SELECT force_sub_enabled FROM bot_settings WHERE id = 1").first();
      const isForceSubOn = settings?.force_sub_enabled === 1;

      // 2. The Gatekeeper
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

      // 3. Command vs Search Logic
      if (text.startsWith("/")) {
        await handleCommand(chatId, userId, text, env);
      } else {
        // MUSIC SEARCH START
        const results = await searchTracks(env.DB, text);

        if (results.length === 0) {
          await sendMessage(chatId, "😔 Sorry, I couldn't find that track in the <b>ZedTopVibes</b> library.", env.BOT_TOKEN);
        } else {
          const track = results[0];
          const caption = formatTrackMessage(track);
          const keyboard = {
            inline_keyboard: [[{ text: "⬇️ Download MP3", callback_data: `dl_${track.id}` }]]
          };

          // Send as TEXT only to avoid image errors
          await sendMessage(chatId, caption, env.BOT_TOKEN, keyboard);
        }
        // MUSIC SEARCH END
      }

    } catch (err) {
      console.error("Bot Error:", err);
    }

    return new Response("OK", { status: 200 });
  },
};
