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

  // 👇 ADDING THE NEW BUTTONS HERE
  buttons.push([
    { text: "Related", callback_data: `artist_related_${artistResult.id}` },
    { text: "Follow", callback_data: `artist_follow_${artistResult.id}` }
  ]);
  buttons.push([
    { text: "Albums", callback_data: `artist_albums_${artistResult.id}` },
    { text: "Songs", callback_data: `artist_songs_${artistResult.id}` }
  ]);
  // 👆 END OF NEW BUTTONS
  
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
  
  // 👇 ADDING THE SENTENCE CASE CLOSE BUTTON HERE
  buttons.push([{ text: "Close", callback_data: "delete_message" }]);
  
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