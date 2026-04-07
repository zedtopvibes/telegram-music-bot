export async function handlePlaylist(chatId, playlistName, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  // Search for playlist by name
  const playlistQuery = `
    SELECT 
      id,
      name,
      description
    FROM playlists
    WHERE name LIKE ?
      AND deleted_at IS NULL
      AND status = 'published'
    LIMIT 1
  `;
  
  const searchTerm = `%${playlistName}%`;
  const playlistResult = await env.DB.prepare(playlistQuery).bind(searchTerm).first();
  
  if (!playlistResult) {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `❌ Playlist "${playlistName}" not found.`
      })
    });
    return;
  }
  
  // Get tracks in this playlist
  const tracksQuery = `
    SELECT 
      t.id,
      t.title,
      pt.position
    FROM playlist_tracks pt
    LEFT JOIN tracks t ON pt.track_id = t.id
    WHERE pt.playlist_id = ?
      AND t.deleted_at IS NULL
      AND t.status = 'published'
    ORDER BY pt.position
  `;
  
  const tracksResult = await env.DB.prepare(tracksQuery).bind(playlistResult.id).all();
  
  // Build response message
  let responseText = `📋 PLAYLIST: ${playlistResult.name}\n\n`;
  
  if (playlistResult.description) {
    responseText += `${playlistResult.description}\n\n`;
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