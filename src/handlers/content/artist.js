import { checkUserSubscription, sendPhotoWithCaption } from "./utils.js";
import { deletePreviousMessage, setLastMessageId } from "../../utils/userState.js";

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

export async function handleArtist(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const artistId = callbackQuery.data.replace("artist_", "");
  
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
  
  const artistQuery = `SELECT id, name, image_url, created_at FROM artists WHERE id = ? AND deleted_at IS NULL AND status = 'published'`;
  const artist = await env.DB.prepare(artistQuery).bind(artistId).first();
  
  if (!artist) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: "Artist not found." })
    });
    return;
  }
  
  const tracksQuery = `
    SELECT COUNT(*) as total FROM tracks t
    LEFT JOIN track_artists ta ON t.id = ta.track_id
    WHERE ta.artist_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
  `;
  const tracksResult = await env.DB.prepare(tracksQuery).bind(artistId).first();
  const totalTracks = tracksResult.total || 0;
  const addedDate = artist.created_at ? artist.created_at.split(" ")[0] : "Unknown";
  
  const caption = `👤 <b>Artist:</b> ${artist.name}\n💿 <b>Songs:</b> ${totalTracks}\n🗓️ <b>Joined:</b> ${addedDate}`;
  
  const buttons = [
    [
      { text: "💿 Albums", callback_data: `artist_albums_${artistId}` },
      { text: "🎵 Songs", callback_data: `artist_songs_${artistId}` }
    ],
    [
      { text: "🔗 Related", callback_data: `artist_related_${artistId}` },
      { text: "➕ Follow", callback_data: `artist_follow_${artistId}` }
    ],
    [{ text: "❌ Close", callback_data: "delete_message" }]
  ];

  const keyboard = { inline_keyboard: buttons };
  
  if (artist.image_url && artist.image_url !== "" && artist.image_url !== "null") {
    await sendPhotoWithCaption(chatId, artist.image_url, caption, env, keyboard);
  } else {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: caption, parse_mode: "HTML", reply_markup: keyboard })
    });
  }
}