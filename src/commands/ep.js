export async function handleEp(chatId, epName, env, replyToMessageId = null) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  // Search for EP by name
  const epQuery = `
    SELECT 
      id,
      title,
      description,
      release_date,
      genre,
      label,
      cover_url
    FROM eps
    WHERE title LIKE ?
      AND deleted_at IS NULL
      AND status = 'published'
    LIMIT 1
  `;
  
  const searchTerm = `%${epName}%`;
  const epResult = await env.DB.prepare(epQuery).bind(searchTerm).first();
  
  if (!epResult) {
    const requestBody = {
      chat_id: chatId,
      text: `❌ EP "${epName}" not found.`
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
  
  // Get artist name for this EP
  const artistQuery = `
    SELECT a.name FROM artists a
    LEFT JOIN eps e ON e.artist_id = a.id
    WHERE e.id = ? AND a.deleted_at IS NULL AND a.status = 'published'
  `;
  const artist = await env.DB.prepare(artistQuery).bind(epResult.id).first();
  
  const tracksCountQuery = `
    SELECT COUNT(*) as total FROM ep_tracks et
    LEFT JOIN tracks t ON et.track_id = t.id
    WHERE et.ep_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
  `;
  const totalTracksResult = await env.DB.prepare(tracksCountQuery).bind(epResult.id).first();
  const totalTracks = totalTracksResult.total || 0;
  
  let responseText = `🎵 EP: ${epResult.title}\n\n`;
  if (artist && artist.name) {
    responseText += `👤 Artist: ${artist.name}\n`;
  }
  if (epResult.release_date) {
    responseText += `📅 Release: ${epResult.release_date}\n`;
  }
  if (epResult.genre) {
    responseText += `🎸 Genre: ${epResult.genre}\n`;
  }
  if (epResult.label) {
    responseText += `🏷️ Label: ${epResult.label}\n`;
  }
  responseText += `🎧 Total Tracks: ${totalTracks}\n\n`;
  
  // EP shows only Get All button (no individual track buttons)
  const buttons = [];
  buttons.push([{ text: "📀 Get All", callback_data: `getall_ep_${epResult.id}` }]);
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