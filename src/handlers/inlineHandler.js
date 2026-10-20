export async function handleInlineQuery(inlineQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  const IMAGE_CDN = "https://zedtopvibes.com";
  
  // 1. Get the raw query and convert to lowercase for easy matching
  const rawQuery = inlineQuery.query.trim().toLowerCase();
  
  let searchType = "global"; 
  let searchTerm = rawQuery;

  // 2. Foolproof Prefix Detection
  if (rawQuery.match(/^\.art\s*/)) {
    searchType = "artist";
    searchTerm = rawQuery.replace(/^\.art\s*/, "");
  } else if (rawQuery.match(/^\.al\s*/)) {
    searchType = "album";
    searchTerm = rawQuery.replace(/^\.al\s*/, "");
  } else if (rawQuery.match(/^\.pl\s*/)) {
    searchType = "playlist";
    searchTerm = rawQuery.replace(/^\.pl\s*/, "");
  } else if (rawQuery.match(/^\.ep\s*/)) {
    searchType = "ep";
    searchTerm = rawQuery.replace(/^\.ep\s*/, "");
  } else if (rawQuery.match(/^\.trk\s*/)) {
    searchType = "track";
    searchTerm = rawQuery.replace(/^\.trk\s*/, "");
  }

  // 3. If the user hasn't typed a search term yet
  if (!searchTerm) {
    let placeholder = "🔍 Type a name to search...";
    if (searchType === "artist") placeholder = "🎤 Type an artist name...";
    if (searchType === "album") placeholder = "💿 Type an album name...";
    if (searchType === "playlist") placeholder = "📋 Type a playlist name...";
    if (searchType === "ep") placeholder = "🎵 Type an EP name...";
    if (searchType === "track") placeholder = "🎵 Type a track name...";

    await fetch(`${TELEGRAM_API}/answerInlineQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inline_query_id: inlineQuery.id,
        results: [{
          type: "article",
          id: "start",
          title: placeholder,
          description: "Keep typing to see results",
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
          description: `Tap to view artist profile`,
          thumb_url: imgUrl || undefined,
          input_message_content: {
            message_text: `🎤 <b>Artist: ${artist.name}</b>\n\nClick below to see their tracks!`,
            parse_mode: "HTML"
          },
          reply_markup: {
            inline_keyboard: [[{ text: "🎵 View Tracks", callback_data: `artist_${artist.id}` }]]
          }
        });
      });
    }

    // --- ALBUMS ---
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
          description: `Tap to view album tracks`,
          thumb_url: imgUrl || undefined,
          input_message_content: {
            message_text: `💿 <b>Album: ${album.title}</b>\n\nClick below to see the tracklist!`,
            parse_mode: "HTML"
          },
          reply_markup: {
            inline_keyboard: [[{ text: "📀 View Album", callback_data: `album_${album.id}` }]]
          }
        });
      });
    }

    // --- PLAYLISTS ---
    if (searchType === "playlist" || searchType === "global") {
      const playlists = await env.DB.prepare(`
        SELECT id, name, cover_url FROM playlists WHERE name LIKE ? AND deleted_at IS NULL AND status = 'published' LIMIT 5
      `).bind(term).all();
      
      playlists.results?.forEach(pl => {
        let imgUrl = pl.cover_url;
        if (imgUrl && !imgUrl.startsWith("http")) imgUrl = `${IMAGE_CDN}${imgUrl}`;
        
        results.push({
          type: "article",
          id: `playlist_${pl.id}`,
          title: `📋 ${pl.name}`,
          description: `Tap to view playlist`,
          thumb_url: imgUrl || undefined,
          input_message_content: {
            message_text: `📋 <b>Playlist: ${pl.name}</b>\n\nClick below to see the tracks!`,
            parse_mode: "HTML"
          },
          reply_markup: {
            inline_keyboard: [[{ text: "📋 View Playlist", callback_data: `playlist_${pl.id}` }]]
          }
        });
      });
    }

    // --- EPS ---
    if (searchType === "ep" || searchType === "global") {
      const eps = await env.DB.prepare(`
        SELECT id, title, cover_url FROM eps WHERE title LIKE ? AND deleted_at IS NULL AND status = 'published' LIMIT 5
      `).bind(term).all();
      
      eps.results?.forEach(ep => {
        let imgUrl = ep.cover_url;
        if (imgUrl && !imgUrl.startsWith("http")) imgUrl = `${IMAGE_CDN}${imgUrl}`;
        
        results.push({
          type: "article",
          id: `ep_${ep.id}`,
          title: `🎵 EP: ${ep.title}`,
          description: `Tap to view EP tracks`,
          thumb_url: imgUrl || undefined,
          input_message_content: {
            message_text: `🎵 <b>EP: ${ep.title}</b>\n\nClick below to see the tracks!`,
            parse_mode: "HTML"
          },
          reply_markup: {
            inline_keyboard: [[{ text: "🎵 View EP", callback_data: `ep_${ep.id}` }]]
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
          id: `track_${track.id}`,
          title: `🎵 ${track.title}`,
          description: `Artist: ${track.artist_name || "Unknown"}`,
          thumb_url: imgUrl || undefined,
          input_message_content: {
            message_text: `🎵 <b>${track.title}</b>\n👤 ${track.artist_name || "Unknown"}\n\nClick below to download!`,
            parse_mode: "HTML"
          },
          reply_markup: {
            inline_keyboard: [[{ text: "📥 Download Track", callback_data: `track_${track.id}` }]]
          }
        });
      });
    }

    // If no results found
    if (results.length === 0) {
      results.push({
        type: "article",
        id: "no_results",
        title: "❌ No results found",
        description: `Nothing matched "${searchTerm}"`,
        input_message_content: { message_text: `❌ No results found for "${searchTerm}"` }
      });
    }

  } catch (error) {
    console.error("Inline Search Error:", error);
  }

  // Send results
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