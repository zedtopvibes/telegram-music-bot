import { checkUserSubscription, sendPhotoWithCaption } from "./utils.js";
import { deletePreviousMessage, setLastMessageId } from "../../utils/userState.js";

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

export async function handleAlbum(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const albumId = callbackQuery.data.replace("album_", "");
  
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
  
  const albumQuery = `SELECT title, release_date, cover_url FROM albums WHERE id = ? AND deleted_at IS NULL AND status = 'published'`;
  const album = await env.DB.prepare(albumQuery).bind(albumId).first();
  
  if (!album) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: "Album not found." })
    });
    return;
  }
  
  const artistQuery = `SELECT a.name FROM artists a LEFT JOIN albums alb ON alb.artist_id = a.id WHERE alb.id = ?`;
  const artist = await env.DB.prepare(artistQuery).bind(albumId).first();
  
  const tracksCountQuery = `SELECT COUNT(*) as total FROM album_tracks at LEFT JOIN tracks t ON at.track_id = t.id WHERE at.album_id = ? AND t.deleted_at IS NULL AND t.status = 'published'`;
  const totalTracksResult = await env.DB.prepare(tracksCountQuery).bind(albumId).first();
  const totalTracks = totalTracksResult.total || 0;
  
  let caption = `💽 ALBUM: ${album.title}\n\n`;
  if (artist && artist.name) caption += `👤 Artist: ${artist.name}\n`;
  if (album.release_date) caption += `📅 Release: ${album.release_date}\n`;
  caption += `🎧 Total Tracks: ${totalTracks}`;
  
  const buttons = [
    [{ text: "📀 Get All", callback_data: `getall_album_${albumId}` }],
    [{ text: "❌ Close", callback_data: "delete_message" }]
  ];
  const keyboard = { inline_keyboard: buttons };
  
  if (album.cover_url && album.cover_url !== "" && album.cover_url !== "null") {
    await sendPhotoWithCaption(chatId, album.cover_url, caption, env, keyboard);
  } else {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: caption, parse_mode: "HTML", reply_markup: keyboard })
    });
  }
}