export async function handleList(chatId, listType, page, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  const ITEMS_PER_PAGE = 10;
  const offset = (page - 1) * ITEMS_PER_PAGE;
  
  let query = "";
  let countQuery = "";
  let title = "";
  let emoji = "";
  let itemNameField = "";
  
  if (listType === "artists") {
    query = `
      SELECT id, name FROM artists 
      WHERE deleted_at IS NULL AND status = 'published'
      ORDER BY name
      LIMIT ? OFFSET ?
    `;
    countQuery = `SELECT COUNT(*) as total FROM artists WHERE deleted_at IS NULL AND status = 'published'`;
    title = "🎤 Artists";
    emoji = "🎤";
    itemNameField = "name";
  } else if (listType === "albums") {
    query = `
      SELECT id, title FROM albums 
      WHERE deleted_at IS NULL AND status = 'published'
      ORDER BY title
      LIMIT ? OFFSET ?
    `;
    countQuery = `SELECT COUNT(*) as total FROM albums WHERE deleted_at IS NULL AND status = 'published'`;
    title = "💿 Albums";
    emoji = "💿";
    itemNameField = "title";
  } else if (listType === "eps") {
    query = `
      SELECT id, title FROM eps 
      WHERE deleted_at IS NULL AND status = 'published'
      ORDER BY title
      LIMIT ? OFFSET ?
    `;
    countQuery = `SELECT COUNT(*) as total FROM eps WHERE deleted_at IS NULL AND status = 'published'`;
    title = "🎵 EPs";
    emoji = "🎵";
    itemNameField = "title";
  } else if (listType === "playlists") {
    query = `
      SELECT id, name FROM playlists 
      WHERE deleted_at IS NULL AND status = 'published'
      ORDER BY name
      LIMIT ? OFFSET ?
    `;
    countQuery = `SELECT COUNT(*) as total FROM playlists WHERE deleted_at IS NULL AND status = 'published'`;
    title = "📋 Playlists";
    emoji = "📋";
    itemNameField = "name";
  }
  
  const [items, countResult] = await Promise.all([
    env.DB.prepare(query).bind(ITEMS_PER_PAGE, offset).all(),
    env.DB.prepare(countQuery).first()
  ]);
  
  const totalItems = countResult.total;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  
  if (!items.results || items.results.length === 0) {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `No ${listType} found.`
      })
    });
    return;
  }
  
  // Build response text
  let responseText = `${emoji} ${title} (Page ${page}/${totalPages})\n\n`;
  
  items.results.forEach((item, index) => {
    const number = offset + index + 1;
    const name = item[itemNameField];
    responseText += `${number}. ${name}\n`;
  });
  
  // Build buttons
  const buttons = [];
  
  // Add item buttons
  items.results.forEach((item) => {
    const itemId = item.id;
    const itemName = item[itemNameField];
    buttons.push([{ text: `${emoji} ${itemName}`, callback_data: `${listType.slice(0, -1)}_${itemId}` }]);
  });
  
  // Add pagination buttons
  const paginationRow = [];
  if (page > 1) {
    paginationRow.push({ text: "◀️ Previous", callback_data: `page_${listType}_${page - 1}` });
  }
  paginationRow.push({ text: `${page}/${totalPages}`, callback_data: "noop" });
  if (page < totalPages) {
    paginationRow.push({ text: "Next ▶️", callback_data: `page_${listType}_${page + 1}` });
  }
  buttons.push(paginationRow);
  
  // Add delete button
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