export async function handleSearch(chatId, query, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  // Search for artists, albums, eps, playlists
  const artistsQuery = `
    SELECT id, name, 'artist' as type
    FROM artists
    WHERE name LIKE ? AND deleted_at IS NULL AND status = 'published'
    LIMIT 5
  `;
  
  const albumsQuery = `
    SELECT id, title, 'album' as type
    FROM albums
    WHERE title LIKE ? AND deleted_at IS NULL AND status = 'published'
    LIMIT 5
  `;
  
  const epsQuery = `
    SELECT id, title, 'ep' as type
    FROM eps
    WHERE title LIKE ? AND deleted_at IS NULL AND status = 'published'
    LIMIT 5
  `;
  
  const playlistsQuery = `
    SELECT id, name, 'playlist' as type
    FROM playlists
    WHERE name LIKE ? AND deleted_at IS NULL AND status = 'published'
    LIMIT 5
  `;
  
  const searchTerm = `%${query}%`;
  
  const [artists, albums, eps, playlists] = await Promise.all([
    env.DB.prepare(artistsQuery).bind(searchTerm).all(),
    env.DB.prepare(albumsQuery).bind(searchTerm).all(),
    env.DB.prepare(epsQuery).bind(searchTerm).all(),
    env.DB.prepare(playlistsQuery).bind(searchTerm).all()
  ]);
  
  // Combine all results
  const results = [];
  
  if (artists.results) {
    artists.results.forEach(r => results.push({ id: r.id, name: r.name, type: r.type }));
  }
  if (albums.results) {
    albums.results.forEach(r => results.push({ id: r.id, name: r.title, type: r.type }));
  }
  if (eps.results) {
    eps.results.forEach(r => results.push({ id: r.id, name: r.title, type: r.type }));
  }
  if (playlists.results) {
    playlists.results.forEach(r => results.push({ id: r.id, name: r.name, type: r.type }));
  }
  
  if (results.length === 0) {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🔍 No results found for "${query}"\n\nTry a different keyword.\n\nOr use /track [keyword] to search for tracks directly.`
      })
    });
    return;
  }
  
  // Build inline keyboard buttons
  const buttons = [];
  results.forEach((item) => {
    let displayName = item.name;
    let emoji = "";
    if (item.type === "artist") emoji = "🎤";
    if (item.type === "album") emoji = "💿";
    if (item.type === "ep") emoji = "🎵";
    if (item.type === "playlist") emoji = "📋";
    
    buttons.push([{ text: `${emoji} ${displayName} (${item.type})`, callback_data: `${item.type}_${item.id}` }]);
  });
  
  const keyboard = {
    inline_keyboard: buttons
  };
  
  const responseText = `🔍 Search results for "${query}":\n\nClick on an item to see details.`;
  
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