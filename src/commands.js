// src/commands.js
import { sendMessage } from './utils.js';

export async function handleCommand(chatId, userId, text, env) {
  const isAdmin = userId.toString() === env.ADMIN_ID.toString();

  if (text === "/start") {
    return sendMessage(chatId, "👋 Welcome to <b>ZedTopVibes</b>! Send me a song name to start.", env.BOT_TOKEN);
  }

  // Admin Toggle: Force Sub ON
  if (text === "/fs_on" && isAdmin) {
    await env.DB.prepare("UPDATE bot_settings SET force_sub_enabled = 1 WHERE id = 1").run();
    return sendMessage(chatId, "✅ <b>Force Sub:</b> ENABLED", env.BOT_TOKEN);
  }

  // Admin Toggle: Force Sub OFF
  if (text === "/fs_off" && isAdmin) {
    await env.DB.prepare("UPDATE bot_settings SET force_sub_enabled = 0 WHERE id = 1").run();
    return sendMessage(chatId, "❌ <b>Force Sub:</b> DISABLED", env.BOT_TOKEN);
  }
}
