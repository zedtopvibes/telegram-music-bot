export async function handleSearch(chatId, query, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  // Search tracks by title or artist name (any artist, not just primary)
  const searchQuery = `
    SELECT 
      t.id,
      t.title,
      t.slug,
      a.name as artist_name,
      a.slug as artist_slug
    FROM tracks t
    LEFT JOIN track_artists ta ON t.id = ta.track_id
    LEFT JOIN artists a ON ta.artist_id = a.id
    WHERE (t.title LIKE ? OR a.name LIKE ?)
      AND t.deleted_at IS NULL
      AND t.status = 'published'
    GROUP BY t.id
    ORDER BY t.plays DESC
    LIMIT 10
  `;
  
  const searchTerm = `%${query}%`;
  const results = await env.DB.prepare(searchQuery)
    .bind(searchTerm, searchTerm)
    .all();
  
  if (!results.results || results.results.length === 0) {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🔍 No results found for "${query}"\n\nTry a different keyword.`
      })
    });
    return;
  }
  
  // Build response message
  let responseText = `🔍 Search results for "${query}":\n\n`;
  
  results.results.forEach((track, index) => {
    const number = index + 1;
    const artistDisplay = track.artist_name || "Unknown Artist";
    responseText += `${number}. 🎵 ${track.title} - ${artistDisplay}\n`;
  });
  
  responseText += `\nSend /play [number] to play a track (coming soon)`;
  
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: responseText
    })
  });
}