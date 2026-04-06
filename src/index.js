import { handleCommand } from './commands.js';
import { sendMessage, checkSubscription, deleteMessage, answerCallbackQuery } from './utils.js';
import { searchTracks, formatTrackMessage } from './music.js';

export default {
  async fetch(request, env) {
    // 1. Only allow POST requests (Standard for Telegram Webhooks)
    if (request.method !== "POST") {
      return new Response("ZedTopVibes Bot is Online", { status: 200 });
    }

    try {
      const payload = await request.json();
      
      /**
       * SECTION A: CALLBACK QUERIES (Button Clicks)
       * Handles "I have Joined" verification
       */
      if (payload.callback_query) {
        const callback = payload.callback_query;
        const chatId = callback.message.chat.id;
        const userId = callback.from.id;
        const messageId = callback.message.message_id;

        if (callback.data === "check_join") {
          const isMember = await checkSubscription(userId, env.CHANNEL_USERNAME, env.BOT_TOKEN);
          
          if (isMember) {
            // Clean up the "Access Denied" message and welcome the user
            await deleteMessage(chatId, messageId, env.BOT_TOKEN);
            await answerCallbackQuery(callback.id, "✅ Access Granted!", false, env.BOT_TOKEN);
            await sendMessage(chatId, "Welcome back! You can now search for any song on <b>ZedTopVibes</b>.", env.BOT_TOKEN);
          } else {
            // Show a popup alert that they still need to join
            await answerCallbackQuery(callback.id, "❌ You still haven't joined the channel!", true, env.BOT_TOKEN);
          }
        }
        
        // Logic for 'dl_ID' (Download) will go here in the next phase
        return new Response("OK");
      }

      /**
       * SECTION B: MESSAGE HANDLING
       */
      const message = payload.message;
      if (!message || !message.text) return new Response("OK");

      const chatId = message.chat.id;
      const userId = message.from.id;
      const text = message.text;
      const isAdmin = userId.toString() === env.ADMIN_ID.toString();

      // 1. Fetch "Force Sub" setting from your D1 Table (id=1)
      const settings = await env.DB.prepare("SELECT force_sub_enabled FROM bot_settings WHERE id = 1").first();
      const isForceSubOn = settings?.force_sub_enabled === 1;

      // 2. THE GATEKEEPER: Check Subscription
      // We skip this if the feature is OFF or if the user is the ADMIN
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

      /**
       * SECTION C: ROUTING (Commands vs Search)
       */
      if (text.startsWith("/")) {
        // Handle Admin Toggles (/fs_on, /fs_off) and /start
        await handleCommand(chatId, userId, text, env);
      } else {
        // Handle Music Search using your site's database
        const results = await searchTracks(env.DB, text);

        if (results.length === 0) {
          await sendMessage(chatId, "😔 Sorry, I couldn't find that track in the <b>ZedTopVibes</b> library.", env.BOT_TOKEN);
        } else {
          // Take the top result from the search
          const track = results[0];
          const { caption, artwork } = formatTrackMessage(track);

          // Send the result as a Photo with the "Download" button
          const photoUrl = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendPhoto`;
          await fetch(photoUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              photo: artwork,
              caption: caption,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "⬇️ Download MP3", callback_data: `dl_${track.id}` }]
                ]
              }
            }),
          });
        }
      }

    } catch (err) {
      // Errors will appear in your Cloudflare Worker "Logs" tab
      console.error("Bot Error:", err);
    }

    return new Response("OK", { status: 200 });
  },
};
