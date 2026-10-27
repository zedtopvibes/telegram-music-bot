import { checkUserSubscription, sendPhotoWithCaption } from "./utils.js";
import { deletePreviousMessage, setLastMessageId } from "../../utils/userState.js";

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

export async function handleEp(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const epId = callbackQuery.data.replace("ep_", "");
  
  const subCheck = await checkUserSubscription(chatId, env);
  if (!subCheck.allowed) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id })
    });
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: subCheck.message, reply_markup: subCheck.keyboard })
    });
    return;
  }
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  await deletePreviousMessage(chatId, env);
  
  const epQuery = `SELECT title, release_date, cover_url FROM eps WHERE id = ? AND deleted_at IS NULL AND status = 'published'`;
  const ep = await env.DB.prepare(epQuery).bind(epId).first();
  
  if (!ep) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: "EP not found." })
    });
    return;
  }
  
  const artistQuery = `SELECT a.name FROM artists a LEFT JOIN eps e ON e.artist_id = a.id WHERE e.id = ?`;
  const artist = await env.DB.prepare(artistQuery).bind(epId).first();
  
  const tracksCountQuery = `SELECT COUNT(*) as total FROM ep_tracks et LEFT JOIN tracks t ON et.track_id = t.id WHERE et.ep_id = ? AND t.deleted_at IS NULL AND t.status = 'published'`;
  const totalTracksResult = await env.DB.prepare(tracksCountQuery).bind(epId).first();
  const totalTracks = totalTracksResult.total || 0;
  
  let caption = `🎵 EP: ${ep.title}\n\n`;
  if (artist && artist.name) caption += `👤 Artist: ${artist.name}\n`;
  if (ep.release_date) caption += `📅 Release: ${ep.release_date}\n`;
  caption += `🎧 Total Tracks: ${totalTracks}`;
  
  const buttons = [
    [{ text: "📀 Get All", callback_data: `getall_ep_${epId}` }],
    [{ text: "❌ Close", callback_data: "delete_message" }]
  ];
  const keyboard = { inline_keyboard: buttons };
  
  if (ep.cover_url && ep.cover_url !== "" && ep.cover_url !== "null") {
    await sendPhotoWithCaption(chatId, ep.cover_url, caption, env, keyboard);
  } else {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: caption, parse_mode: "HTML", reply_markup: keyboard })
    });
  }
}