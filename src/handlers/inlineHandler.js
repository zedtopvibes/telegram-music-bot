export async function handleInlineQuery(inlineQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  const IMAGE_CDN = "https://zedtopvibes.com";
  
  let rawQuery = inlineQuery.query.trim().toLowerCase();
  let searchType = "global"; 
  let searchTerm = "";

  if (rawQuery.match(/^\.art\s*/)) { searchType = "artist"; searchTerm = rawQuery.replace(/^\.art\s*/, ""); }
  else if (rawQuery.match(/^\.al\s*/)) { searchType = "album"; searchTerm = rawQuery.replace(/^\.al\s*/, ""); }
  else if (rawQuery.match(/^\.pl\s*/)) { searchType = "playlist"; searchTerm = rawQuery.replace(/^\.pl\s*/, ""); }
  else if (rawQuery.match(/^\.ep\s*/)) { searchType = "ep"; searchTerm = rawQuery.replace(/^\.ep\s*/, ""); }
  else if (rawQuery.match(/^\.trk\s*/)) { searchType = "track"; searchTerm = rawQuery.replace(/^\.trk\s*/, ""); }
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
          description: "Keep typing...",
          input_message_content: { message_text: "🎵 Please type a search term." }
        }]
      })
    });
    return;
  }

  const term = `%${searchTerm}%`;
  const results = [];

  try {
    // --- ARTISTS ---
    if (searchType === "artist" || searchType === "global") {
      const artists = await env.DB.prepare(`SELECT id, name, image_url FROM artists WHERE name LIKE ? AND deleted_at IS NULL AND status = 'published' LIMIT 5`).bind(term).all();
      artists.results?.forEach(artist => {
        let imgUrl = artist.image_url;
        if (imgUrl && !imgUrl.startsWith("http")) imgUrl = `${IMAGE_CDN}${imgUrl}`;
        
        results.push({
          type: "article",
          id: `art_${artist.id}`,
          title: `🎤 ${artist.name}`,
          description: `Tap to search for ${artist.name}`,
          thumb_url: imgUrl || undefined,
          input_message_content: {
            // 👇 THIS IS THE MAGIC: Sends the exact command into the chat
            message_text: `/artist ${artist.name}`
          }
        });
      });
    }

    // --- ALBUMS ---
    if (searchType === "album" || searchType === "global") {
      const albums = await env.DB.prepare(`SELECT id, title, cover_url FROM albums WHERE title LIKE ? AND deleted_at IS NULL AND status = 'published' LIMIT 5`).bind(term).all();
      albums.results?.forEach(album => {
        let imgUrl = album.cover_url;
        if (imgUrl && !imgUrl.startsWith("http")) imgUrl = `${IMAGE_CDN}${imgUrl}`;
        
        results.push({
          type: "article",
          id: `al_${album.id}`,
          title: `💿 ${album.title}`,
          description: `Tap to search for album`,
          thumb_url: imgUrl || undefined,
          input_message_content: {
            message_text: `/album ${album.title}`
          }
        });
      });
    }

    // --- PLAYLISTS ---
    if (searchType === "playlist" || searchType === "global") {
      const playlists = await env.DB.prepare(`SELECT id, name, cover_url FROM playlists WHERE name LIKE ? AND deleted_at IS NULL AND status = 'published' LIMIT 5`).bind(term).all();
      playlists.results?.forEach(pl => {
        let imgUrl = pl.cover_url;
        if (imgUrl && !imgUrl.startsWith("http")) imgUrl = `${IMAGE_CDN}${imgUrl}`;
        
        results.push({
          type: "article",
          id: `pl_${pl.id}`,
          title: `📋 ${pl.name}`,
          description: `Tap to search for playlist`,
          thumb_url: imgUrl || undefined,
          input_message_content: {
            message_text: `/playlist ${pl.name}`
          }
        });
      });
    }

    // --- EPS ---
    if (searchType === "ep" || searchType === "global") {
      const eps = await env.DB.prepare(`SELECT id, title, cover_url FROM eps WHERE title LIKE ? AND deleted_at IS NULL AND status = 'published' LIMIT 5`).bind(term).all();
      eps.results?.forEach(ep => {
        let imgUrl = ep.cover_url;
        if (imgUrl && !imgUrl.startsWith("http")) imgUrl = `${IMAGE_CDN}${imgUrl}`;
        
        results.push({
          type: "article",
          id: `ep_${ep.id}`,
          title: `🎵 ${ep.title}`,
          description: `Tap to search for EP`,
          thumb_url: imgUrl || undefined,
          input_message_content: {
            message_text: `/ep ${ep.title}`
          }
        });
      });
    }

    // --- TRACKS ---
    if (searchType === "track" || searchType === "global") {
      const tracks = await env.DB.prepare(`
        SELECT t.id, t.title, t.artwork_url, a.name as artist_name
        FROM tracks t
        LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
        LEFT JOIN artists a ON ta.artist_id = a.id
        WHERE t.title LIKE ? AND t.deleted_at IS NULL AND t.status = 'published' LIMIT 5
      `).bind(term).all();
      
      tracks.results?.forEach(track => {
        let imgUrl = track.artwork_url;
        if (imgUrl && !imgUrl.startsWith("http")) imgUrl = `${IMAGE_CDN}${imgUrl}`;
        
        results.push({
          type: "article",
          id: `trk_${track.id}`,
          title: `🎵 ${track.title}`,
          description: `Artist: ${track.artist_name || "Unknown"}`,
          thumb_url: imgUrl || undefined,
          input_message_content: {
            message_text: `/track ${track.title}`
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