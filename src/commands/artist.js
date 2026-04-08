export async function handleArtist(chatId, artistName, env, replyToMessageId = null) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  // Search for artist by name
  const artistQuery = `
    SELECT 
      id,
      name,
      bio,
      country,
      image_url
    FROM artists
    WHERE name LIKE ?
      AND deleted_at IS NULL
      AND status = 'published'
    LIMIT 1
  `;
  
  const searchTerm = `%${artistName}%`;
  const artistResult = await env.DB.prepare(artistQuery).bind(searchTerm).first();
  
  if (!artistResult) {
    const requestBody = {
      chat_id: chatId,
      text: `❌ Artist "${artistName}" not found.`
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
  
  // Get tracks by this artist
  const tracksQuery = `
    SELECT 
      t.id,
      t.title,
      t.slug
    FROM tracks t
    LEFT JOIN track_artists ta ON t.id = ta.track_id
    WHERE ta.artist_id = ?
      AND t.deleted_at IS NULL
      AND t.status = 'published'
    GROUP BY t.id
    ORDER BY t.title
    LIMIT 20
  `;
  
  const tracksResult = await env.DB.prepare(tracksQuery).bind(artistResult.id).all();
  
  // Build response message
  let responseText = `🎤 ${artistResult.name}\n\n`;
  
  if (artistResult.bio) {
    responseText += `${artistResult.bio}\n\n`;
  }
  
  if (artistResult.country) {
    responseText += `📍 Country: ${artistResult.country}\n\n`;
  }
  
  responseText += `🎵 Tracks:\n\n`;
  
  // Build inline keyboard buttons for tracks
  const buttons = [];
  
  if (tracksResult.results && tracksResult.results.length > 0) {
    tracksResult.results.forEach((track, index) => {
      const number = index + 1;
      responseText += `${number}. ${track.title}\n`;
      buttons.push([{ text: `🎵 ${track.title}`, callback_data: `track_${track.id}` }]);
    });
  } else {
    responseText += `No tracks found.`;
  }
  
  responseText += `\nClick a track button to receive the audio.`;
  
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