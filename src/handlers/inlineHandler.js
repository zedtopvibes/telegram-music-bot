export async function handleInlineQuery(inlineQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  const AUDIO_CDN = "https://files.zedtopvibes.com";
  
  let rawQuery = inlineQuery.query.trim();
  let searchType = "global"; 
  let searchTerm = "";

  if (rawQuery.startsWith(".art ")) { searchType = "artist"; searchTerm = rawQuery.replace(".art ", "").trim(); }
  else if (rawQuery.startsWith(".al ")) { searchType = "album"; searchTerm = rawQuery.replace(".al ", "").trim(); }
  else if (rawQuery.startsWith(".pl ")) { searchType = "playlist"; searchTerm = rawQuery.replace(".pl ", "").trim(); }
  else if (rawQuery.startsWith(".ep ")) { searchType = "ep"; searchTerm = rawQuery.replace(".ep ", "").trim(); }
  else if (rawQuery.startsWith(".yr ")) { searchType = "year"; searchTerm = rawQuery.replace(".yr ", "").trim(); }
  else { searchTerm = rawQuery; }

  if (!searchTerm) {
    await fetch(`${TELEGRAM_API}/answerInlineQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inline_query_id: inlineQuery.id,
        results: [{
          type: "article",
          id: "start",
          title: searchType === "global" ? "🔍 Type a song or artist..." : `🔍 Type a ${searchType} name...`,
          description: "Keep typing to see results",
          input_message_content: { message_text: "🎵 Please type a search term to find music." }
        }]
      })
    });
    return;
  }

  const term = `%${searchTerm}%`;
  const results = [];

  try {
    // 1. Global Search (Tracks - Audio Files)
    if (searchType === "global") {
      const tracks = await env.DB.prepare(`
        SELECT t.id, t.title, t.filename, a.name as artist_name
        FROM tracks t
        LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
        LEFT JOIN artists a ON ta.artist_id = a.id
        WHERE t.title LIKE ? AND t.deleted_at IS NULL AND t.status = 'published'
        LIMIT 10
      `).bind(term).all();
      
      tracks.results?.forEach(track => {
        results.push({
          type: "audio",
          id: `track_${track.id}`,
          audio_url: `${AUDIO_CDN}/${encodeURIComponent(track.filename)}`,
          title: track.title,
          performer: track.artist_name || "Unknown Artist",
          caption: `🎧 ${track.title} - ${track.artist_name || "Unknown Artist"}`
        });
      });
    }

    // 2. Search by Year (Audio Files)
    if (searchType === "year") {
      const tracks = await env.DB.prepare(`
        SELECT t.id, t.title, t.filename, a.name as artist_name
        FROM tracks t
        LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
        LEFT JOIN artists a ON ta.artist_id = a.id
        WHERE strftime('%Y', t.release_date) = ? AND t.deleted_at IS NULL AND t.status = 'published'
        LIMIT 10
      `).bind(searchTerm).all();
      
      tracks.results?.forEach(track => {
        results.push({
          type: "audio",
          id: `track_${track.id}`,
          audio_url: `${AUDIO_CDN}/${encodeURIComponent(track.filename)}`,
          title: track.title,
          performer: track.artist_name || "Unknown Artist",
          caption: `🎧 ${track.title} - ${track.artist_name || "Unknown Artist"} (${searchTerm})`
        });
      });
    }

    // 3. Search Artists (Text Card with inline prompt to search their name)
    if (searchType === "global" || searchType === "artist") {
      const artists = await env.DB.prepare(`SELECT id, name FROM artists WHERE name LIKE ? AND deleted_at IS NULL AND status = 'published' LIMIT 5`).bind(term).all();
      artists.results?.forEach(artist => {
        results.push({
          type: "article",
          id: `artist_${artist.id}`,
          title: `🎤 Artist: ${artist.name}`,
          description: `Search tracks by ${artist.name}`,
          input_message_content: {
            message_text: `🎤 <b>Artist: ${artist.name}</b>\n\nType this in the chat to see their tracks: <code>@zedtopvibesbot ${artist.name}</code>`,
            parse_mode: "HTML"
          }
        });
      });
    }

  } catch (error) {
    console.error("Inline Search Error:", error);
  }

  await fetch(`${TELEGRAM_API}/answerInlineQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inline_query_id: inlineQuery.id,
      results: results,
      cache_time: 300 
    })
  });
}