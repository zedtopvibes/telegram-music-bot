export async function listYears(chatId, page, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  const ITEMS_PER_PAGE = 10;
  const offset = (page - 1) * ITEMS_PER_PAGE;
  
  // Get unique years from tracks, albums, eps
  const yearsQuery = `
    SELECT DISTINCT year FROM (
      SELECT strftime('%Y', release_date) as year FROM tracks WHERE release_date IS NOT NULL AND deleted_at IS NULL AND status = 'published'
      UNION
      SELECT strftime('%Y', release_date) as year FROM albums WHERE release_date IS NOT NULL AND deleted_at IS NULL AND status = 'published'
      UNION
      SELECT strftime('%Y', release_date) as year FROM eps WHERE release_date IS NOT NULL AND deleted_at IS NULL AND status = 'published'
    ) WHERE year IS NOT NULL
    ORDER BY year DESC
    LIMIT ? OFFSET ?
  `;
  
  const countQuery = `
    SELECT COUNT(DISTINCT year) as total FROM (
      SELECT strftime('%Y', release_date) as year FROM tracks WHERE release_date IS NOT NULL AND deleted_at IS NULL AND status = 'published'
      UNION
      SELECT strftime('%Y', release_date) as year FROM albums WHERE release_date IS NOT NULL AND deleted_at IS NULL AND status = 'published'
      UNION
      SELECT strftime('%Y', release_date) as year FROM eps WHERE release_date IS NOT NULL AND deleted_at IS NULL AND status = 'published'
    ) WHERE year IS NOT NULL
  `;
  
  const [years, countResult] = await Promise.all([
    env.DB.prepare(yearsQuery).bind(ITEMS_PER_PAGE, offset).all(),
    env.DB.prepare(countQuery).first()
  ]);
  
  const totalYears = countResult.total;
  const totalPages = Math.ceil(totalYears / ITEMS_PER_PAGE);
  
  if (!years.results || years.results.length === 0) {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "No releases found."
      })
    });
    const data = await response.json();
    return { message_id: data.result?.message_id };
  }
  
  // Build response
  let responseText = `📆 Browse by Year (Page ${page}/${totalPages})\n\n`;
  
  const buttons = [];
  
  years.results.forEach((yearObj) => {
    const year = yearObj.year;
    buttons.push([{ text: `📅 ${year}`, callback_data: `year_content_${year}_1` }]);
  });
  
  // Pagination buttons
  const paginationRow = [];
  if (page > 1) {
    paginationRow.push({ text: "◀️ Previous", callback_data: `page_years_${page - 1}` });
  }
  paginationRow.push({ text: `${page}/${totalPages}`, callback_data: "noop" });
  if (page < totalPages) {
    paginationRow.push({ text: "Next ▶️", callback_data: `page_years_${page + 1}` });
  }
  buttons.push(paginationRow);
  buttons.push([{ text: "❌", callback_data: "delete_message" }]);
  
  const keyboard = { inline_keyboard: buttons };
  
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: responseText,
      reply_markup: keyboard
    })
  });
  
  const responseData = await response.json();
  return { message_id: responseData.result?.message_id };
}

export async function showYearContent(chatId, year, page, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  const ITEMS_PER_PAGE = 10;
  const offset = (page - 1) * ITEMS_PER_PAGE;
  
  // Get albums from this year
  const albumsQuery = `
    SELECT id, title, 'album' as type, release_date
    FROM albums
    WHERE strftime('%Y', release_date) = ? AND deleted_at IS NULL AND status = 'published'
    ORDER BY release_date DESC
  `;
  
  // Get EPs from this year
  const epsQuery = `
    SELECT id, title, 'ep' as type, release_date
    FROM eps
    WHERE strftime('%Y', release_date) = ? AND deleted_at IS NULL AND status = 'published'
    ORDER BY release_date DESC
  `;
  
  // Get tracks not in albums or EPs (singles)
  const tracksQuery = `
    SELECT t.id, t.title, 'track' as type, t.release_date, a.name as artist_name
    FROM tracks t
    LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
    LEFT JOIN artists a ON ta.artist_id = a.id
    WHERE strftime('%Y', t.release_date) = ? 
      AND t.deleted_at IS NULL 
      AND t.status = 'published'
      AND t.id NOT IN (SELECT track_id FROM album_tracks)
      AND t.id NOT IN (SELECT track_id FROM ep_tracks)
    ORDER BY t.release_date DESC
    LIMIT ? OFFSET ?
  `;
  
  const countQuery = `
    SELECT COUNT(*) as total FROM (
      SELECT id FROM albums WHERE strftime('%Y', release_date) = ? AND deleted_at IS NULL AND status = 'published'
      UNION ALL
      SELECT id FROM eps WHERE strftime('%Y', release_date) = ? AND deleted_at IS NULL AND status = 'published'
      UNION ALL
      SELECT t.id FROM tracks t
      WHERE strftime('%Y', t.release_date) = ? 
        AND t.deleted_at IS NULL 
        AND t.status = 'published'
        AND t.id NOT IN (SELECT track_id FROM album_tracks)
        AND t.id NOT IN (SELECT track_id FROM ep_tracks)
    )
  `;
  
  const [albums, eps, tracks, countResult] = await Promise.all([
    env.DB.prepare(albumsQuery).bind(year).all(),
    env.DB.prepare(epsQuery).bind(year).all(),
    env.DB.prepare(tracksQuery).bind(year, ITEMS_PER_PAGE, offset).all(),
    env.DB.prepare(countQuery).bind(year, year, year).first()
  ]);
  
  // Combine all items
  const allItems = [];
  
  if (albums.results) {
    albums.results.forEach(album => {
      allItems.push({ id: album.id, title: album.title, type: 'album' });
    });
  }
  
  if (eps.results) {
    eps.results.forEach(ep => {
      allItems.push({ id: ep.id, title: ep.title, type: 'ep' });
    });
  }
  
  if (tracks.results) {
    tracks.results.forEach(track => {
      const displayTitle = track.artist_name ? `${track.title} - ${track.artist_name}` : track.title;
      allItems.push({ id: track.id, title: displayTitle, type: 'track' });
    });
  }
  
  const totalItems = countResult.total;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  
  if (allItems.length === 0) {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `No releases found for ${year}.`
      })
    });
    const data = await response.json();
    return { message_id: data.result?.message_id };
  }
  
  // Build response
  let responseText = `📅 Releases from ${year} (Page ${page}/${totalPages})\n\n`;
  
  const buttons = [];
  
  allItems.forEach((item) => {
    let emoji = "";
    if (item.type === "album") emoji = "💿";
    if (item.type === "ep") emoji = "🎵";
    if (item.type === "track") emoji = "🎤";
    
    buttons.push([{ text: `${emoji} ${item.title.substring(0, 50)}`, callback_data: `${item.type}_${item.id}` }]);
  });
  
  // Pagination buttons
  const paginationRow = [];
  if (page > 1) {
    paginationRow.push({ text: "◀️ Previous", callback_data: `page_year_${year}_${page - 1}` });
  }
  paginationRow.push({ text: `${page}/${totalPages}`, callback_data: "noop" });
  if (page < totalPages) {
    paginationRow.push({ text: "Next ▶️", callback_data: `page_year_${year}_${page + 1}` });
  }
  buttons.push(paginationRow);
  buttons.push([{ text: "❌", callback_data: "delete_message" }]);
  
  const keyboard = { inline_keyboard: buttons };
  
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: responseText,
      reply_markup: keyboard
    })
  });
  
  const responseData = await response.json();
  return { message_id: responseData.result?.message_id };
}