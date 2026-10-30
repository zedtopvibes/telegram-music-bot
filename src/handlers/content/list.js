const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

export async function handleList(chatId, listType, page, env, filterLetter = "", messageId = null) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API_URL = TELEGRAM_API(BOT_TOKEN);
  
  // 👇 VIEW 1: The Alphabet Grid
  if (filterLetter === "AZ") {
    const buttons = [];
    buttons.push([{ text: "🔢 0-9", callback_data: `filter_artists_NUM_1` }]);
    
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    let row = [];
    letters.forEach((letter, index) => {
      row.push({ text: letter, callback_data: `filter_artists_${letter}_1` });
      if (row.length === 7 || index === letters.length - 1) {
        buttons.push(row);
        row = [];
      }
    });
    
    buttons.push([{ text: "🔙 Back to List", callback_data: `page_artists_1_` }]);
    buttons.push([{ text: "❌ Close", callback_data: "delete_message" }]);
    
    const text = `🎤 <b>Browse Artists by Letter</b>\n\nSelect a letter or number to find your favorite artist:`;
    
    if (messageId) {
      await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: text, parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } })
      });
      return { message_id: messageId };
    } else {
      const res = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } })
      });
      const data = await res.json();
      return { message_id: data.result?.message_id };
    }
  }

  // 👇 VIEW 2 & 3: The List (Filtered or Unfiltered)
  const ITEMS_PER_PAGE = 10;
  const offset = (page - 1) * ITEMS_PER_PAGE;
  
  let query = "";
  let countQuery = "";
  let title = "";
  let emoji = "";
  let itemNameField = "";
  let filterCondition = "";
  
  if (listType === "artists") {
    if (filterLetter && filterLetter !== "ALL") {
      if (filterLetter === "NUM") {
        filterCondition = `AND name GLOB '[0-9]*'`;
      } else {
        filterCondition = `AND name LIKE '${filterLetter}%'`;
      }
    }
    query = `SELECT id, name FROM artists WHERE deleted_at IS NULL AND status = 'published' ${filterCondition} ORDER BY name LIMIT ? OFFSET ?`;
    countQuery = `SELECT COUNT(*) as total FROM artists WHERE deleted_at IS NULL AND status = 'published' ${filterCondition}`;
    title = filterLetter ? `🎤 Artists (${filterLetter === 'NUM' ? '0-9' : filterLetter})` : "🎤 Artists Directory";
    emoji = "🎵"; itemNameField = "name";
  } else if (listType === "albums") {
    query = `SELECT id, title FROM albums WHERE deleted_at IS NULL AND status = 'published' ORDER BY title LIMIT ? OFFSET ?`;
    countQuery = `SELECT COUNT(*) as total FROM albums WHERE deleted_at IS NULL AND status = 'published'`;
    title = "💿 Albums Directory"; emoji = "💿"; itemNameField = "title";
  } else if (listType === "eps") {
    query = `SELECT id, title FROM eps WHERE deleted_at IS NULL AND status = 'published' ORDER BY title LIMIT ? OFFSET ?`;
    countQuery = `SELECT COUNT(*) as total FROM eps WHERE deleted_at IS NULL AND status = 'published'`;
    title = "🎵 EPs Directory"; emoji = "🎵"; itemNameField = "title";
  } else if (listType === "playlists") {
    query = `SELECT id, name FROM playlists WHERE deleted_at IS NULL AND status = 'published' ORDER BY name LIMIT ? OFFSET ?`;
    countQuery = `SELECT COUNT(*) as total FROM playlists WHERE deleted_at IS NULL AND status = 'published'`;
    title = "📋 Playlists Directory"; emoji = "📋"; itemNameField = "name";
  }
  
  const [items, countResult] = await Promise.all([
    env.DB.prepare(query).bind(ITEMS_PER_PAGE, offset).all(),
    env.DB.prepare(countQuery).first()
  ]);
  
  // 👇 NEW: Fetch Featured Artists (Only on Page 1, no filter, for Artists)
  let featured = [];
  if (listType === "artists" && page === 1 && !filterLetter) {
    const featuredQuery = `SELECT id, name FROM artists WHERE is_featured = 1 AND deleted_at IS NULL AND status = 'published' LIMIT 4`;
    const featuredRes = await env.DB.prepare(featuredQuery).all();
    if (featuredRes.results) featured = featuredRes.results;
  }
  
  const totalItems = countResult.total;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  
  // Title + Total Count
  let responseText = `<b>${title}</b>\n`;
  if (!filterLetter) {
    responseText += `<i>📊 Total: ${totalItems} ${listType}</i>\n\n`;
  } else {
    responseText += `\n`;
  }
  
  // 👇 Add Featured to Text (if exists)
  if (featured.length > 0) {
    responseText += `🌟 <b>Featured Artists:</b>\n`;
    featured.forEach(f => { responseText += `⭐ ${f.name}\n`; });
    responseText += `\n`;
  }
  
  if (items.results && items.results.length > 0) {
    items.results.forEach((item, index) => {
      const num = offset + index + 1;
      responseText += `${emoji} ${num}. ${item[itemNameField]}\n`;
    });
  } else {
    responseText += `No ${listType} found.`;
  }
  
  const buttons = [];
  
  // 👇 TOP ROW: A-Z Button (Only for Artists)
  if (listType === "artists") {
    buttons.push([{ text: "👤 Browse A-Z", callback_data: `filter_artists_AZ_1` }]);
  }
  
  // 👇 Featured Buttons
  if (featured.length > 0) {
    let featuredRow = [];
    featured.forEach((f, index) => {
      featuredRow.push({ text: `🌟 ${f.name}`, callback_data: `artist_${f.id}` });
      if (featuredRow.length === 2 || index === featured.length - 1) {
        buttons.push(featuredRow);
        featuredRow = [];
      }
    });
  }
  
  // 👇 Main 2-Column Grid
  if (items.results) {
    let itemRow = [];
    items.results.forEach((item, index) => {
      itemRow.push({ text: `${item[itemNameField]}`, callback_data: `${listType.slice(0, -1)}_${item.id}` });
      if (itemRow.length === 2 || index === items.results.length - 1) {
        buttons.push(itemRow);
        itemRow = [];
      }
    });
  }
  
  // 👇 Pagination Row
  const paginationRow = [];
  if (page > 1) {
    paginationRow.push({ text: "⬅️ Prev", callback_data: `page_${listType}_${page - 1}_${filterLetter}` });
  }
  paginationRow.push({ text: `${page}/${totalPages}`, callback_data: "noop" });
  if (page < totalPages) {
    paginationRow.push({ text: "Next ➡️", callback_data: `page_${listType}_${page + 1}_${filterLetter}` });
  }
  if (paginationRow.length > 1) buttons.push(paginationRow);
  
  // 👇 Close Button (Alone at the bottom)
  buttons.push([{ text: "❌ Close", callback_data: "delete_message" }]);
  
  const keyboard = { inline_keyboard: buttons };
  
  if (messageId) {
    await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: responseText, parse_mode: "HTML", reply_markup: keyboard })
    });
    return { message_id: messageId };
  } else {
    const res = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: responseText, parse_mode: "HTML", reply_markup: keyboard })
    });
    const data = await res.json();
    return { message_id: data.result?.message_id };
  }
}