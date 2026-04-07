export async function showNewReleases(chatId, page, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  const ITEMS_PER_PAGE = 10;
  const offset = (page - 1) * ITEMS_PER_PAGE;
  
  // Get albums from last 30 days
  const albumsQuery = `
    SELECT id, title, 'album' as type, release_date, NULL as artist_name
    FROM albums
    WHERE release_date >= date('now', '-30 days')
      AND deleted_at IS NULL 
      AND status = 'published'
    ORDER BY release_date DESC
  `;
  
  // Get EPs from last 30 days
  const epsQuery = `
    SELECT id, title, 'ep' as type, release_date, NULL as artist_name
    FROM eps
    WHERE release_date >= date('now', '-30 days')
      AND deleted_at IS NULL 
      AND status = 'published'
    ORDER BY release_date DESC
  `;
  
  // Get tracks not in albums or EPs (singles) from last 30 days
  const tracksQuery = `
    SELECT t.id, t.title, 'track' as type, t.release_date, a.name as artist_name
    FROM tracks t
    LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
    LEFT JOIN artists a ON ta.artist_id = a.id
    WHERE t.release_date >= date('now', '-30 days')
      AND t.deleted_at IS NULL 
      AND t.status = 'published'
      AND t.id NOT IN (SELECT track_id FROM album_tracks)
      AND t.id NOT IN (SELECT track_id FROM ep_tracks)
    ORDER BY t.release_date DESC
    LIMIT ? OFFSET ?
  `;
  
  const countQuery = `
    SELECT COUNT(*) as total FROM (
      SELECT id FROM albums WHERE release_date >= date('now', '-30 days') AND deleted_at IS NULL AND status = 'published'
      UNION ALL
      SELECT id FROM eps WHERE release_date >= date('now', '-30 days') AND deleted_at IS NULL AND status = 'published'
      UNION ALL
      SELECT t.id FROM tracks t
      WHERE t.release_date >= date('now', '-30 days')
        AND t.deleted_at IS NULL 
        AND t.status = 'published'
        AND t.id NOT IN (SELECT track_id FROM album_tracks)
        AND t.id NOT IN (SELECT track_id FROM ep_tracks)
    )
  `;
  
  const [albums, eps, tracks, countResult] = await Promise.all([
    env.DB.prepare(albumsQuery).all(),
    env.DB.prepare(epsQuery).all(),
    env.DB.prepare(tracksQuery).bind(ITEMS_PER_PAGE, offset).all(),
    env.DB.prepare(countQuery).first()
  ]);
  
  // Combine all items
  const allItems = [];
  
  if (albums.results) {
    albums.results.forEach(album => {
      allItems.push({ id: album.id, title: album.title, type: 'album', release_date: album.release_date, artist_name: null });
    });
  }
  
  if (eps.results) {
    eps.results.forEach(ep => {
      allItems.push({ id: ep.id, title: ep.title, type: 'ep', release_date: ep.release_date, artist_name: null });
    });
  }
  
  if (tracks.results) {
    tracks.results.forEach(track => {
      const displayTitle = track.artist_name ? `${track.title} - ${track.artist_name}` : track.title;
      allItems.push({ id: track.id, title: displayTitle, type: 'track', release_date: track.release_date, artist_name: track.artist_name });
    });
  }
  
  // Sort all items by release date (newest first)
  allItems.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
  
  const totalItems = countResult.total;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  
  if (allItems.length === 0 || totalItems === 0) {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "No new releases in the last 30 days."
      })
    });
    return;
  }
  
  // Get items for current page
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const pageItems = allItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  
  // Build response
  let responseText = `🆕 New Releases (Last 30 days) - Page ${page}/${totalPages}\n\n`;
  
  const buttons = [];
  
  pageItems.forEach((item) => {
    let emoji = "";
    let displayText = "";
    
    if (item.type === "album") {
      emoji = "💿";
      displayText = `${emoji} Album: ${item.title}`;
    } else if (item.type === "ep") {
      emoji = "🎵";
      displayText = `${emoji} EP: ${item.title}`;
    } else {
      emoji = "🎤";
      displayText = `${emoji} Track: ${item.title}`;
    }
    
    // Truncate long titles
    if (displayText.length > 60) {
      displayText = displayText.substring(0, 57) + "...";
    }
    
    buttons.push([{ text: displayText, callback_data: `${item.type}_${item.id}` }]);
  });
  
  // Pagination buttons
  const paginationRow = [];
  if (page > 1) {
    paginationRow.push({ text: "◀️ Previous", callback_data: `page_new_${page - 1}` });
  }
  paginationRow.push({ text: `${page}/${totalPages}`, callback_data: "noop" });
  if (page < totalPages) {
    paginationRow.push({ text: "Next ▶️", callback_data: `page_new_${page + 1}` });
  }
  buttons.push(paginationRow);
  buttons.push([{ text: "❌", callback_data: "delete_message" }]);
  
  const keyboard = { inline_keyboard: buttons };
  
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