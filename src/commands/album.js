export async function handleAlbum(chatId, albumName, env, replyToMessageId = null) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  // Search for album by name
  const albumQuery = `
    SELECT 
      id,
      title,
      description,
      release_date,
      genre,
      label,
      cover_url
    FROM albums
    WHERE title LIKE ?
      AND deleted_at IS NULL
      AND status = 'published'
    LIMIT 1
  `;
  
  const searchTerm = `%${albumName}%`;
  const albumResult = await env.DB.prepare(albumQuery).bind(searchTerm).first();
  
  if (!albumResult) {
    const requestBody = {
      chat_id: chatId,
      text: `❌ Album "${albumName}" not found.`
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
  
  // Get artist name for this album
  const artistQuery = `
    SELECT a.name FROM artists a
    LEFT JOIN albums alb ON alb.artist_id = a.id
    WHERE alb.id = ? AND a.deleted_at IS NULL AND a.status = 'published'
  `;
  const artist = await env.DB.prepare(artistQuery).bind(albumResult.id).first();
  
  const tracksCountQuery = `
    SELECT COUNT(*) as total FROM album_tracks at
    LEFT JOIN tracks t ON at.track_id = t.id
    WHERE at.album_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
  `;
  const totalTracksResult = await env.DB.prepare(tracksCountQuery).bind(albumResult.id).first();
  const totalTracks = totalTracksResult.total || 0;
  
  let responseText = `💽 ALBUM: ${albumResult.title}\n\n`;
  if (artist && artist.name) {
    responseText += `👤 Artist: ${artist.name}\n`;
  }
  if (albumResult.release_date) {
    responseText += `📅 Release: ${albumResult.release_date}\n`;
  }
  if (albumResult.genre) {
    responseText += `🎸 Genre: ${albumResult.genre}\n`;
  }
  if (albumResult.label) {
    responseText += `🏷️ Label: ${albumResult.label}\n`;
  }
  responseText += `🎧 Total Tracks: ${totalTracks}\n\n`;
  
  // Album shows only Get All button (no individual track buttons)
  const buttons = [];
  buttons.push([{ text: "📀 Get All", callback_data: `getall_album_${albumResult.id}` }]);
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