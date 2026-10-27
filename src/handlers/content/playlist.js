import { checkUserSubscription, sendPhotoWithCaption } from "./utils.js";
import { deletePreviousMessage, setLastMessageId } from "../../utils/userState.js";

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

export async function handlePlaylist(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const playlistId = callbackQuery.data.replace("playlist_", "");
  
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
  
  const playlistQuery = `SELECT name, cover_url FROM playlists WHERE id = ? AND deleted_at IS NULL AND status = 'published'`;
  const playlist = await env.DB.prepare(playlistQuery).bind(playlistId).first();
  
  if (!playlist) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: "Playlist not found." })
    });
    return;
  }
  
  const tracksCountQuery = `SELECT COUNT(*) as total FROM playlist_tracks pt LEFT JOIN tracks t ON pt.track_id = t.id WHERE pt.playlist_id = ? AND t.deleted_at IS NULL AND t.status = 'published'`;
  const totalTracksResult = await env.DB.prepare(tracksCountQuery).bind(playlistId).first();
  const totalTracks = totalTracksResult.total || 0;
  
  const caption = `📋 PLAYLIST: ${playlist.name}\n\n🎧 Total Tracks: ${totalTracks}`;
  
  const buttons = [
    [{ text: "📀 Get All", callback_data: `getall_playlist_${playlistId}` }],
    [{ text: "❌ Close", callback_data: "delete_message" }]
  ];
  const keyboard = { inline_keyboard: buttons };
  
  if (playlist.cover_url && playlist.cover_url !== "" && playlist.cover_url !== "null") {
    await sendPhotoWithCaption(chatId, playlist.cover_url, caption, env, keyboard);
  } else {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: caption, parse_mode: "HTML", reply_markup: keyboard })
    });
  }
}