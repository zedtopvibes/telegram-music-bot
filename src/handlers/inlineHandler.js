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
          description: "Example: Yo Maps",
          input_message_content: { message_text: "🎵 Please type a search term." }
        }]
      })
    });
    return;
  }

  const term = `%${searchTerm}%`;
  const results = [];

  try {
    // 1. Search Artists (Returns Photo Card)
    if (searchType === "artist" || searchType === "global") {
      const artists = await env.DB.prepare(`
        SELECT id, name, image_url FROM artists WHERE name LIKE ? AND deleted_at IS NULL AND status = 'published' LIMIT 5
      `).bind(term).all();
      
      artists.results?.forEach(artist => {
        let imgUrl = artist.image_url;
        if (imgUrl && !imgUrl.startsWith("http")) imgUrl = `${IMAGE_CDN}${imgUrl}`;
        
        results.push({
          type: "photo",
          id: `artist_${artist.id}`,
          photo_url: imgUrl || "https://zedtopvibes.com/api/artist-image/default.png",
          thumbnail_url: imgUrl || "https://zedtopvibes.com/api/artist-image/default.png",
          title: `🎤 ${artist.name}`,
          description: `View all tracks by ${artist.name}`,
          caption: `🎤 <b>Artist: ${artist.name}</b>\n\nClick below to see their music!`,
          parse_mode: "HTML",
          // 👇 THESE ARE THE BUTTONS THAT SHOW UP AFTER THEY TAP THE PHOTO
          reply_markup: {
            inline_keyboard: [[
              { text: `🎵 View ${artist.name}'s Tracks`, callback_data: `artist_${artist.id}` }
            ]]
          }
        });
      });
    }

    // 2. Search Albums (Returns Photo Card)
    if (searchType === "album" || searchType === "global") {
      const albums = await env.DB.prepare(`
        SELECT id, title, cover_url FROM albums WHERE title LIKE ? AND deleted_at IS NULL AND status = 'published' LIMIT 5
      `).bind(term).all();
      
      albums.results?.forEach(album => {
        let imgUrl = album.cover_url;
        if (imgUrl && !imgUrl.startsWith("http")) imgUrl = `${IMAGE_CDN}${imgUrl}`;
        
        results.push({
          type: "photo",
          id: `album_${album.id}`,
          photo_url: imgUrl || "https://zedtopvibes.com/api/playlist-cover/default.png",
          thumbnail_url: imgUrl || "https://zedtopvibes.com/api/playlist-cover/default.png",
          title: `💿 ${album.title}`,
          description: `View all tracks in this album`,
          caption: `💿 <b>Album: ${album.title}</b>\n\nClick below to see the tracklist!`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[
              { text: `📀 View Album`, callback_data: `album_${album.id}` }
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