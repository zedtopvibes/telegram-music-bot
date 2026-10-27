import { checkUserSubscription, sendPhotoWithCaption } from "./utils.js";
const IMAGE_CDN = "https://zedtopvibes.com";
const AUDIO_CDN = "https://files.zedtopvibes.com";
const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

export async function handleTrack(callbackQuery, env, ctx) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const trackId = callbackQuery.data.replace("track_", "");
  
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
  
  const trackQuery = `
    SELECT t.title, t.filename, t.artwork_url, a.name as artist_name
    FROM tracks t
    LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
    LEFT JOIN artists a ON ta.artist_id = a.id
    WHERE t.id = ? AND t.deleted_at IS NULL AND t.status = 'published'
  `;
  const track = await env.DB.prepare(trackQuery).bind(trackId).first();
  
  if (!track) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: "❌ Track not found." })
    });
    return;
  }
  
  const audioUrl = `${AUDIO_CDN}/${encodeURIComponent(track.filename)}`;
  const artistName = track.artist_name || "Unknown Artist";
  const caption = `🎧 ${track.title} - ${artistName}`;
  
  if (track.artwork_url && track.artwork_url !== "" && track.artwork_url !== "null") {
    let artworkUrl = track.artwork_url;
    if (!artworkUrl.startsWith("http")) artworkUrl = `${IMAGE_CDN}${artworkUrl}`;
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendPhoto`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, photo: artworkUrl, caption: caption })
    });
  }
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendAudio`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, audio: audioUrl, title: track.title, performer: artistName, caption: caption })
  });
  
  const artistLinks = await env.DB.prepare("SELECT DISTINCT artist_id FROM track_artists WHERE track_id = ?").bind(trackId).all();
  const artistIds = artistLinks.results ? artistLinks.results.map(r => r.artist_id) : [];
  
  const updates = [
    env.DB.prepare("UPDATE tracks SET bot_downloads = bot_downloads + 1 WHERE id = ?").bind(trackId),
    env.DB.prepare("UPDATE bot_users SET user_total_downloads = user_total_downloads + 1 WHERE user_id = ?").bind(chatId)
  ];
  
  artistIds.forEach(id => {
    updates.push(env.DB.prepare("UPDATE artists SET bot_total_downloads = bot_total_downloads + 1 WHERE id = ?").bind(id));
  });
  
  ctx.waitUntil(env.DB.batch(updates));
}