export async function handleEp(chatId, epName, env) {
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
      label
    FROM eps
    WHERE title LIKE ?
      AND deleted_at IS NULL
      AND status = 'published'
    LIMIT 1
  `;
  
  const searchTerm = `%${epName}%`;
  const epResult = await env.DB.prepare(epQuery).bind(searchTerm).first();
  
  if (!epResult) {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `❌ EP "${epName}" not found.`
      })
    });
    return;
  }
  
  // Get tracks in this EP
  const tracksQuery = `
    SELECT 
      t.id,
      t.title,
      et.track_number
    FROM ep_tracks et
    LEFT JOIN tracks t ON et.track_id = t.id
    WHERE et.ep_id = ?
      AND t.deleted_at IS NULL
      AND t.status = 'published'
    ORDER BY et.track_number, et.disc_number
  `;
  
  const tracksResult = await env.DB.prepare(tracksQuery).bind(epResult.id).all();
  
  // Build response message
  let responseText = `🎵 EP: ${epResult.title}\n\n`;
  
  if (epResult.description) {
    responseText += `${epResult.description}\n\n`;
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
  
  responseText += `\n🎵 Tracklist:\n\n`;
  
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
  
  responseText += `\nClick a track button to play (coming soon)`;
  
  const keyboard = {
    inline_keyboard: buttons
  };
  
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: responseText,
      reply_markup: keyboard
    })
  });
}