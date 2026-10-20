export async function handleInlineQuery(inlineQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  const BOT_USERNAME = env.BOT_USERNAME || "zedtopvibesbot";
  
  let rawQuery = inlineQuery.query.trim();
  let searchType = "global"; // global, artist, album, ep, playlist
  let searchTerm = "";

  // 1. Detect the prefix
  if (rawQuery.startsWith(".art ")) {
    searchType = "artist";
    searchTerm = rawQuery.replace(".art ", "").trim();
  } else if (rawQuery.startsWith(".al ")) {
    searchType = "album";
    searchTerm = rawQuery.replace(".al ", "").trim();
  } else if (rawQuery.startsWith(".ep ")) {
    searchType = "ep";
    searchTerm = rawQuery.replace(".ep ", "").trim();
  } else if (rawQuery.startsWith(".pl ")) {
    searchType = "playlist";
    searchTerm = rawQuery.replace(".pl ", "").trim();
  } else {
    searchTerm = rawQuery;
  }

  // If the user just typed "@bot " or "@bot .art " without a search term
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
          input_message_content: {
            message_text: "🎵 Please type a search term to find music."
          }
        }]
      })
    });
    return;
  }

  const term = `%${searchTerm}%`;
  const results = [];

  try {
    // 2. Fetch based on the search type
    if (searchType === "global" || searchType === "artist") {
      const artists = await env.DB.prepare(`
        SELECT id, name FROM artists 
        WHERE name LIKE ? AND deleted_at IS NULL AND status = 'published'
        LIMIT 5
      `).bind(term).all();

      artists.results?.forEach(artist => {
        results.push({
          type: "article",
          id: `artist_${artist.id}`,
          title: `🎤 Artist: ${artist.name}`,
          description: `View all tracks by ${artist.name}`,
          input_message_content: {
            message_text: `🎤 <b>Artist: ${artist.name}</b>\n\nOpen the bot to listen to their music!`,
            parse_mode: "HTML"
          },
          // 👇 FIXED: reply_markup is now at the top level of the result object
          reply_markup: {
            inline_keyboard: [[
              { text: "👤 View Artist in PM", url: `https://t.me/${BOT_USERNAME}?start=inline_artist_${artist.id}` }
            ]]
          }
        });
      });
    }

    if (searchType === "global" || searchType === "album") {
      const albums = await env.DB.prepare(`
        SELECT id, title FROM albums 
        WHERE title LIKE ? AND deleted_at IS NULL AND status = 'published'
        LIMIT 5
      `).bind(term).all();

      albums.results?.forEach(album => {
        results.push({
          type: "article",
          id: `album_${album.id}`,
          title: `💿 Album: ${album.title}`,
          description: `View all tracks in this album`,
          input_message_content: {
            message_text: `💿 <b>Album: ${album.title}</b>\n\nOpen the bot to download the full album!`,
            parse_mode: "HTML"
          },
          reply_markup: {
            inline_keyboard: [[
              { text: "💿 View Album in PM", url: `https://t.me/${BOT_USERNAME}?start=inline_album_${album.id}` }
            ]]
          }
        });
      });
    }

    if (searchType === "global" || searchType === "ep") {
      const eps = await env.DB.prepare(`
        SELECT id, title FROM eps 
        WHERE title LIKE ? AND deleted_at IS NULL AND status = 'published'
        LIMIT 5
      `).bind(term).all();

      eps.results?.forEach(ep => {
        results.push({
          type: "article",
          id: `ep_${ep.id}`,
          title: `🎵 EP: ${ep.title}`,
          description: `View all tracks in this EP`,
          input_message_content: {
            message_text: `🎵 <b>EP: ${ep.title}</b>\n\nOpen the bot to download the EP!`,
            parse_mode: "HTML"
          },
          reply_markup: {
            inline_keyboard: [[
              { text: "🎵 View EP in PM", url: `https://t.me/${BOT_USERNAME}?start=inline_ep_${ep.id}` }
            ]]
          }
        });
      });
    }

    if (searchType === "global" || searchType === "playlist") {
      const playlists = await env.DB.prepare(`
        SELECT id, name FROM playlists 
        WHERE name LIKE ? AND deleted_at IS NULL AND status = 'published'
        LIMIT 5
      `).bind(term).all();

      playlists.results?.forEach(pl => {
        results.push({
          type: "article",
          id: `playlist_${pl.id}`,
          title: `📋 Playlist: ${pl.name}`,
          description: `View all tracks in this playlist`,
          input_message_content: {
            message_text: `📋 <b>Playlist: ${pl.name}</b>\n\nOpen the bot to download the playlist!`,
            parse_mode: "HTML"
          },
          reply_markup: {
            inline_keyboard: [[
              { text: "📋 View Playlist in PM", url: `https://t.me/${BOT_USERNAME}?start=inline_playlist_${pl.id}` }
            ]]
          }
        });
      });
    }

    // Global search also includes Tracks
    if (searchType === "global") {
      const tracks = await env.DB.prepare(`
        SELECT t.id, t.title, a.name as artist_name
        FROM tracks t
        LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
        LEFT JOIN artists a ON ta.artist_id = a.id
        WHERE t.title LIKE ? AND t.deleted_at IS NULL AND t.status = 'published'
        LIMIT 5
      `).bind(term).all();

      tracks.results?.forEach(track => {
        results.push({
          type: "article",
          id: `track_${track.id}`,
          title: `🎵 ${track.title}`,
          description: `Artist: ${track.artist_name || "Unknown"}`,
          input_message_content: {
            message_text: `🎵 <b>${track.title}</b>\n👤 ${track.artist_name || "Unknown"}\n\nClick the button below to download this track!`,
            parse_mode: "HTML"
          },
          reply_markup: {
            inline_keyboard: [[
              { text: "📥 Get Track in PM", url: `https://t.me/${BOT_USERNAME}?start=inline_track_${track.id}` }
            ]]
          }
        });
      });
    }

  } catch (error) {
    console.error("Inline Search Error:", error);
  }

  // Send results back to Telegram
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