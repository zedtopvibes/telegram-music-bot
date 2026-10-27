import { checkUserSubscription } from "./utils.js";
const IMAGE_CDN = "https://zedtopvibes.com";
const AUDIO_CDN = "https://files.zedtopvibes.com";
const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

export async function handleGetAllAlbum(callbackQuery, env, ctx) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const albumId = callbackQuery.data.replace("getall_album_", "");
  
  const subCheck = await checkUserSubscription(chatId, env);
  if (!subCheck.allowed) return;
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  const albumQuery = `SELECT title, cover_url FROM albums WHERE id = ? AND deleted_at IS NULL AND status = 'published'`;
  const album = await env.DB.prepare(albumQuery).bind(albumId).first();
  
  const tracksQuery = `
    SELECT t.id, t.title, t.filename, a.name as artist_name
    FROM album_tracks at
    LEFT JOIN tracks t ON at.track_id = t.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
    LEFT JOIN artists a ON ta.artist_id = a.id
    WHERE at.album_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
    ORDER BY at.track_number
  `;
  const tracks = await env.DB.prepare(tracksQuery).bind(albumId).all();
  
  if (!tracks.results || tracks.results.length === 0) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "No tracks found in this album." }) });
    return;
  }
  
  const totalTracks = tracks.results.length;
  const albumTitle = album ? album.title : "Album";
  
  const statusMsg = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: `📀 Sending album "${albumTitle}": 0/${totalTracks}` }) });
  const statusData = await statusMsg.json();
  const statusMessageId = statusData.result.message_id;
  
  for (let i = 0; i < totalTracks; i++) {
    const track = tracks.results[i];
    const audioUrl = `${AUDIO_CDN}/${encodeURIComponent(track.filename)}`;
    const artistName = track.artist_name || "Unknown Artist";
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendAudio`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, audio: audioUrl, title: track.title, performer: artistName, caption: `🎧 ${track.title} - ${artistName}` }) });
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/editMessageText`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: statusMessageId, text: `📀 Sending album "${albumTitle}": ${i+1}/${totalTracks}` }) });
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: statusMessageId }) }).catch(() => {});
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: `✅ Done! All ${totalTracks} tracks from "${albumTitle}" sent.` }) });
  
  const trackIds = tracks.results.map(t => t.id);
  const placeholders = trackIds.map(() => '?').join(',');
  const artistLinks = await env.DB.prepare(`SELECT DISTINCT artist_id FROM track_artists WHERE track_id IN (${placeholders})`).bind(...trackIds).all();
  const artistIds = artistLinks.results ? artistLinks.results.map(r => r.artist_id) : [];
  
  const updates = [
    env.DB.prepare("UPDATE albums SET bot_downloads = bot_downloads + 1 WHERE id = ?").bind(albumId),
    env.DB.prepare(`UPDATE bot_users SET user_total_downloads = user_total_downloads + ${totalTracks} WHERE user_id = ?`).bind(chatId)
  ];
  trackIds.forEach(id => updates.push(env.DB.prepare("UPDATE tracks SET bot_downloads = bot_downloads + 1 WHERE id = ?").bind(id)));
  artistIds.forEach(id => updates.push(env.DB.prepare("UPDATE artists SET bot_total_downloads = bot_total_downloads + 1 WHERE id = ?").bind(id)));
  ctx.waitUntil(env.DB.batch(updates));
}

export async function handleGetAllEp(callbackQuery, env, ctx) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const epId = callbackQuery.data.replace("getall_ep_", "");
  
  const subCheck = await checkUserSubscription(chatId, env);
  if (!subCheck.allowed) return;
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  const epQuery = `SELECT title, cover_url FROM eps WHERE id = ? AND deleted_at IS NULL AND status = 'published'`;
  const ep = await env.DB.prepare(epQuery).bind(epId).first();
  
  const tracksQuery = `
    SELECT t.id, t.title, t.filename, a.name as artist_name
    FROM ep_tracks et
    LEFT JOIN tracks t ON et.track_id = t.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
    LEFT JOIN artists a ON ta.artist_id = a.id
    WHERE et.ep_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
    ORDER BY et.track_number
  `;
  const tracks = await env.DB.prepare(tracksQuery).bind(epId).all();
  
  if (!tracks.results || tracks.results.length === 0) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "No tracks found in this EP." }) });
    return;
  }
  
  const totalTracks = tracks.results.length;
  const epTitle = ep ? ep.title : "EP";
  
  const statusMsg = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: `🎵 Sending EP "${epTitle}": 0/${totalTracks}` }) });
  const statusData = await statusMsg.json();
  const statusMessageId = statusData.result.message_id;
  
  for (let i = 0; i < totalTracks; i++) {
    const track = tracks.results[i];
    const audioUrl = `${AUDIO_CDN}/${encodeURIComponent(track.filename)}`;
    const artistName = track.artist_name || "Unknown Artist";
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendAudio`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, audio: audioUrl, title: track.title, performer: artistName, caption: `🎧 ${track.title} - ${artistName}` }) });
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/editMessageText`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: statusMessageId, text: `🎵 Sending EP "${epTitle}": ${i+1}/${totalTracks}` }) });
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: statusMessageId }) }).catch(() => {});
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: `✅ Done! All ${totalTracks} tracks from "${epTitle}" sent.` }) });
  
  const trackIds = tracks.results.map(t => t.id);
  const placeholders = trackIds.map(() => '?').join(',');
  const artistLinks = await env.DB.prepare(`SELECT DISTINCT artist_id FROM track_artists WHERE track_id IN (${placeholders})`).bind(...trackIds).all();
  const artistIds = artistLinks.results ? artistLinks.results.map(r => r.artist_id) : [];
  
  const updates = [
    env.DB.prepare("UPDATE eps SET bot_downloads = bot_downloads + 1 WHERE id = ?").bind(epId),
    env.DB.prepare(`UPDATE bot_users SET user_total_downloads = user_total_downloads + ${totalTracks} WHERE user_id = ?`).bind(chatId)
  ];
  trackIds.forEach(id => updates.push(env.DB.prepare("UPDATE tracks SET bot_downloads = bot_downloads + 1 WHERE id = ?").bind(id)));
  artistIds.forEach(id => updates.push(env.DB.prepare("UPDATE artists SET bot_total_downloads = bot_total_downloads + 1 WHERE id = ?").bind(id)));
  ctx.waitUntil(env.DB.batch(updates));
}

export async function handleGetAllPlaylist(callbackQuery, env, ctx) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const playlistId = callbackQuery.data.replace("getall_playlist_", "");
  
  const subCheck = await checkUserSubscription(chatId, env);
  if (!subCheck.allowed) return;
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  const playlistQuery = `SELECT name, cover_url FROM playlists WHERE id = ? AND deleted_at IS NULL AND status = 'published'`;
  const playlist = await env.DB.prepare(playlistQuery).bind(playlistId).first();
  
  const tracksQuery = `
    SELECT t.id, t.title, t.filename, a.name as artist_name
    FROM playlist_tracks pt
    LEFT JOIN tracks t ON pt.track_id = t.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
    LEFT JOIN artists a ON ta.artist_id = a.id
    WHERE pt.playlist_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
    ORDER BY pt.position
  `;
  const tracks = await env.DB.prepare(tracksQuery).bind(playlistId).all();
  
  if (!tracks.results || tracks.results.length === 0) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "No tracks found in this playlist." }) });
    return;
  }
  
  const totalTracks = tracks.results.length;
  const playlistName = playlist ? playlist.name : "Playlist";
  
  const statusMsg = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: `📋 Sending playlist "${playlistName}": 0/${totalTracks}` }) });
  const statusData = await statusMsg.json();
  const statusMessageId = statusData.result.message_id;
  
  for (let i = 0; i < totalTracks; i++) {
    const track = tracks.results[i];
    const audioUrl = `${AUDIO_CDN}/${encodeURIComponent(track.filename)}`;
    const artistName = track.artist_name || "Unknown Artist";
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendAudio`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, audio: audioUrl, title: track.title, performer: artistName, caption: `🎧 ${track.title} - ${artistName}` }) });
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/editMessageText`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: statusMessageId, text: `📋 Sending playlist "${playlistName}": ${i+1}/${totalTracks}` }) });
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: statusMessageId }) }).catch(() => {});
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: `✅ Done! All ${totalTracks} tracks from "${playlistName}" sent.` }) });
  
  const trackIds = tracks.results.map(t => t.id);
  const placeholders = trackIds.map(() => '?').join(',');
  const artistLinks = await env.DB.prepare(`SELECT DISTINCT artist_id FROM track_artists WHERE track_id IN (${placeholders})`).bind(...trackIds).all();
  const artistIds = artistLinks.results ? artistLinks.results.map(r => r.artist_id) : [];
  
  const updates = [
    env.DB.prepare("UPDATE playlists SET bot_downloads = bot_downloads + 1 WHERE id = ?").bind(playlistId),
    env.DB.prepare(`UPDATE bot_users SET user_total_downloads = user_total_downloads + ${totalTracks} WHERE user_id = ?`).bind(chatId)
  ];
  trackIds.forEach(id => updates.push(env.DB.prepare("UPDATE tracks SET bot_downloads = bot_downloads + 1 WHERE id = ?").bind(id)));
  artistIds.forEach(id => updates.push(env.DB.prepare("UPDATE artists SET bot_total_downloads = bot_total_downloads + 1 WHERE id = ?").bind(id)));
  ctx.waitUntil(env.DB.batch(updates));
}