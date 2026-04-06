// src/index.js
import { handleCommand } from './commands.js';
import { sendMessage, checkSubscription, deleteMessage } from './utils.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("OK");

    try {
      const payload = await request.json();
      
      // Handle Callback Queries (Button Clicks)
      if (payload.callback_query) {
        const callback = payload.callback_query;
        const chatId = callback.message.chat.id;
        const userId = callback.from.id;
        const messageId = callback.message.message_id;

        if (callback.data === "check_join") {
          const isMember = await checkSubscription(userId, env.CHANNEL_USERNAME, env.BOT_TOKEN);
          if (isMember) {
            await deleteMessage(chatId, messageId, env.BOT_TOKEN);
            await sendMessage(chatId, "✅ Thank you for joining! You can now send me a song name.", env.BOT_TOKEN);
          } else {
            // Optional: Send a short alert that they still haven't joined
            const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`;
            await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: callback.id, text: "❌ You still haven't joined!", show_alert: true }),
            });
          }
        }
        return new Response("OK");
      }

      // Handle Regular Messages
      const message = payload.message;
      if (!message || !message.text) return new Response("OK");

      const chatId = message.chat.id;
      const userId = message.from.id;
      const text = message.text;

      // 1. Fetch Force Sub Setting
      const settings = await env.DB.prepare("SELECT force_sub_enabled FROM bot_settings WHERE id = 1").first();
      const isForceSubOn = settings?.force_sub_enabled === 1;

      // 2. The Gatekeeper
      if (isForceSubOn && userId.toString() !== env.ADMIN_ID.toString()) {
        const isMember = await checkSubscription(userId, env.CHANNEL_USERNAME, env.BOT_TOKEN);
        
        if (!isMember) {
          const keyboard = {
            inline_keyboard: [
              [{ text: "Join Channel 🚀", url: `https://t.me/${env.CHANNEL_USERNAME}` }],
              [{ text: "I have Joined ✅", callback_data: "check_join" }]
            ]
          };
          // CRITICAL: We return here so the "Searching for..." code never runs
          return sendMessage(chatId, "⚠️ <b>Access Denied!</b>\nYou must join @"+env.CHANNEL_USERNAME+" to use this bot.", env.BOT_TOKEN, keyboard);
        }
      }

      // 3. Routing (Only runs if user passed the Gatekeeper)
      if (text.startsWith("/")) {
        await handleCommand(chatId, userId, text, env);
      } else {
        await sendMessage(chatId, `🔍 Searching for: <b>${text}</b>...`, env.BOT_TOKEN);
      }

    } catch (err) {
      console.error(err);
    }

    return new Response("OK", { status: 200 });
  }
};
