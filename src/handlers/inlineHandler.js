export async function handleInlineQuery(inlineQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  const IMAGE_CDN = "https://zedtopvibes.com";
  
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
          title: "🔍 Type a name to search...",
          description: "Example: Kanina",
          input_message_content: { message_text: "🎵 Please type a search term." }
        }]
      })
    });
    return;
  }

  const term = `%${searchTerm}%`;
  const results = [];

  try {
    // 1. Global Search (Tracks as Audio Files - This works perfectly)
    if (searchType === "global") {
      const tracks = await env.DB.prepare(`
        SELECT t.id, t.title, t.filename, a.name as artist_name
        FROM tracks t
        LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
        LEFT JOIN artists a ON ta.artist_id = a.id
        WHERE t.title LIKE ? AND t.deleted_at IS NULL AND t.status = 'published'
        LIMIT 5
      `).bind(term).all();
      
      tracks.results?.forEach(track => {
        results.push({
          type: "audio",
          id: `track_${track.id}`,
          audio_url: `https://files.zedtopvibes.com/${encodeURIComponent(track.filename)}`,
          title: track.title,
          performer: track.artist_name || "Unknown Artist"
        });
      });
    }

    // 2. Search Artists (Returns an Article with a working button)
    if (searchType === "artist" || searchType === "global") {
      const artists = await env.DB.prepare(`
        SELECT id, name, image_url FROM artists WHERE name LIKE ? AND deleted_at IS NULL AND status = 'published' LIMIT 5
      `).bind(term).all();
      
      artists.results?.forEach(artist => {
        let imgUrl = artist.image_url;
        if (imgUrl && !imgUrl.startsWith("http")) imgUrl = `${IMAGE_CDN}${imgUrl}`;
        
        results.push({
          type: "article",
          id: `artist_${artist.id}`,
          title: `🎤 ${artist.name}`,
          description: `Click to load artist profile`,
          thumb_url: imgUrl || "https://zedtopvibes.com/api/artist-image/default.png",
          thumb_width: 200,
          thumb_height: 200,
          input_message_content: {
            message_text: `🎤 <b>Artist: ${artist.name}</b>\n\nClick below to see their tracks!`,
            parse_mode: "HTML"
          },
          reply_markup: {
            inline_keyboard: [[
              { text: "🎵 View Tracks", callback_data: `artist_${artist.id}` }
            ]]
          }
        });
      });
    }

    // 3. Search Albums (Returns an Article with a working button)
    if (searchType === "album" || searchType === "global") {
      const albums = await env.DB.prepare(`
        SELECT id, title, cover_url FROM albums WHERE title LIKE ? AND deleted_at IS NULL AND status = 'published' LIMIT 5
      `).bind(term).all();
      
      albums.results?.forEach(album => {
        let imgUrl = album.cover_url;
        if (imgUrl && !imgUrl.startsWith("http")) imgUrl = `${IMAGE_CDN}${imgUrl}`;
        
        results.push({
          type: "article",
          id: `album_${album.id}`,
          title: `💿 ${album.title}`,
          description: `Click to load album tracks`,
          thumb_url: imgUrl || "https://zedtopvibes.com/api/playlist-cover/default.png",
          thumb_width: 200,
          thumb_height: 200,
          input_message_content: {
            message_text: `💿 <b>Album: ${album.title}</b>\n\nClick below to see the tracklist!`,
            parse_mode: "HTML"
          },
          reply_markup: {
            inline_keyboard: [[
              { text: "📀 View Album", callback_data: `album_${album.id}` }
            ]]
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
      cache_time: 0
    })
  });
}