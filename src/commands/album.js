export async function handleAlbum(chatId, albumName, env) {
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
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `❌ Album "${albumName}" not found.`
      })
    });
    return;
  }
  
  // Get tracks in this album
  const tracksQuery = `
    SELECT 
      t.id,
      t.title,
      t.duration,
      at.track_number
    FROM album_tracks at
    LEFT JOIN tracks t ON at.track_id = t.id
    WHERE at.album_id = ?
      AND t.deleted_at IS NULL
      AND t.status = 'published'
    ORDER BY at.track_number, at.disc_number
  `;
  
  const tracksResult = await env.DB.prepare(tracksQuery).bind(albumResult.id).all();
  
  // Build response message
  let responseText = `💿 ALBUM: ${albumResult.title}\n\n`;
  
  if (albumResult.description) {
    responseText += `${albumResult.description}\n\n`;
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
  
  responseText += `\n🎵 Tracklist:\n`;
  
  if (tracksResult.results && tracksResult.results.length > 0) {
    tracksResult.results.forEach((track, index) => {
      const number = index + 1;
      responseText += `${number}. ${track.title}\n`;
    });
  } else {
    responseText += `No tracks found.`;
  }
  
  responseText += `\n\nSend /play [number] to play a track (coming soon)`;
  
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: responseText
    })
  });
}