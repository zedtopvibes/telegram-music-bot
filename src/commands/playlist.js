export async function handlePlaylist(chatId, playlistName, env, replyToMessageId = null) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  // Search for playlist by name
  const playlistQuery = `
    SELECT 
      id,
      name,
      description,
      cover_url
    FROM playlists
    WHERE name LIKE ?
      AND deleted_at IS NULL
      AND status = 'published'
    LIMIT 1
  `;
  
  const searchTerm = `%${playlistName}%`;
  const playlistResult = await env.DB.prepare(playlistQuery).bind(searchTerm).first();
  
  if (!playlistResult) {
    const requestBody = {
      chat_id: chatId,
      text: `❌ Playlist "${playlistName}" not found.`
    };
    if (replyToMessageId) {
      requestBody.reply_to_message_id = replyToMessageId;
    }
    
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    return;
  }
  
  const tracksCountQuery = `
    SELECT COUNT(*) as total FROM playlist_tracks pt
    LEFT JOIN tracks t ON pt.track_id = t.id
    WHERE pt.playlist_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
  `;
  const totalTracksResult = await env.DB.prepare(tracksCountQuery).bind(playlistResult.id).first();
  const totalTracks = totalTracksResult.total || 0;
  
  let responseText = `📋 PLAYLIST: ${playlistResult.name}\n\n`;
  if (playlistResult.description) {
    responseText += `${playlistResult.description}\n\n`;
  }
  responseText += `🎧 Total Tracks: ${totalTracks}\n\n`;
  
  // Playlist shows only Get All button (no individual track buttons)
  const buttons = [];
  buttons.push([{ text: "📀 Get All", callback_data: `getall_playlist_${playlistResult.id}` }]);
  buttons.push([{ text: "❌", callback_data: "delete_message" }]);
  
  const keyboard = { inline_keyboard: buttons };
  
  const requestBody = {
    chat_id: chatId,
    text: responseText,
    reply_markup: keyboard
  };
  
  if (replyToMessageId) {
    requestBody.reply_to_message_id = replyToMessageId;
  }
  
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });
}