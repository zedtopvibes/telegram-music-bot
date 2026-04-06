// src/index.js
import { handleCommand } from './commands.js';
import { sendMessage, checkSubscription } from './utils.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("OK");

    try {
      const payload = await request.json();
      const message = payload.message || payload.callback_query?.message;
      if (!message) return new Response("OK");

      const chatId = message.chat.id;
      const userId = payload.message?.from.id || payload.callback_query?.from.id;
      const text = message.text;

      // 1. Fetch Force Sub Setting from D1
      const settings = await env.DB.prepare("SELECT force_sub_enabled FROM bot_settings WHERE id = 1").first();
      const isForceSubOn = settings?.force_sub_enabled === 1;

      // 2. Check Subscription if enabled (and user is not admin)
      if (isForceSubOn && userId.toString() !== env.ADMIN_ID.toString()) {
        const isMember = await checkSubscription(userId, env.CHANNEL_USERNAME, env.BOT_TOKEN);
        
        if (!isMember) {
          const keyboard = {
            inline_keyboard: [
              [{ text: "Join Channel 🚀", url: `https://t.me/${env.CHANNEL_USERNAME}` }],
              [{ text: "I have Joined ✅", callback_data: "check_join" }]
            ]
          };
          return sendMessage(chatId, "⚠️ <b>Access Denied!</b>\nYou must join our channel to use this bot.", env.BOT_TOKEN, keyboard);
        }
      }

      // 3. Route to Commands or Music Search
      if (text && text.startsWith("/")) {
        await handleCommand(chatId, userId, text, env);
      } else if (text) {
        // This is where music search logic will go later
        await sendMessage(chatId, `🔍 Searching for: <b>${text}</b>...`, env.BOT_TOKEN);
      }

    } catch (err) {
      console.error(err);
    }

    return new Response("OK", { status: 200 });
  }
};
