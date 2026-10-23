export async function handleArtist(chatId, artistName, env, replyToMessageId = null) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  const IMAGE_CDN = "https://zedtopvibes.com";
  
  // 1. Search for artist
  const artistQuery = `
    SELECT id, name, country, image_url, created_at
    FROM artists
    WHERE name LIKE ? AND deleted_at IS NULL AND status = 'published'
    LIMIT 1
  `;
  
  const searchTerm = `%${artistName}%`;
  const artistResult = await env.DB.prepare(artistQuery).bind(searchTerm).first();
  
  if (!artistResult) {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: `❌ Artist "${artistName}" not found.` })
    });
    return;
  }
  
  // 2. Get total song count
  const tracksQuery = `
    SELECT COUNT(*) as total FROM tracks t
    LEFT JOIN track_artists ta ON t.id = ta.track_id
    WHERE ta.artist_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
  `;
  const tracksResult = await env.DB.prepare(tracksQuery).bind(artistResult.id).first();
  const totalSongs = tracksResult.total || 0;

  // 3. Format the added date
  const addedDate = artistResult.created_at ? artistResult.created_at.split(" ")[0] : "Unknown";

  // 4. Build the new clean caption
  const caption = `👤 <b>Artist:</b> ${artistResult.name}\n\n💿 <b>Total Songs:</b> ${totalSongs}\n🗓️ <b>Profile Added:</b> ${addedDate}`;

  // 5. Build the buttons
  const buttons = [
    [
      { text: "Related", callback_data: `artist_related_${artistResult.id}` },
      { text: "Follow", callback_data: `artist_follow_${artistResult.id}` }
    ],
    [
      { text: "Albums", callback_data: `artist_albums_${artistResult.id}` },
      { text: "Songs", callback_data: `artist_songs_${artistResult.id}` }
    ],
    [
      { text: "Close", callback_data: "delete_message" }
    ]
  ];

  const keyboard = { inline_keyboard: buttons };

  // 6. Send with Photo (NO reply_to_message_id to prevent the quote box!)
  let fullImageUrl = artistResult.image_url;
  if (fullImageUrl && !fullImageUrl.startsWith("http")) {
    fullImageUrl = `${IMAGE_CDN}${fullImageUrl}`;
  }

  if (fullImageUrl && fullImageUrl !== "null") {
    await fetch(`${TELEGRAM_API}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: fullImageUrl,
        caption: caption,
        parse_mode: "HTML",
        reply_markup: keyboard
      })
    });
  } else {
    // Fallback to text if no image
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption,
        parse_mode: "HTML",
        reply_markup: keyboard
      })
    });
  }
}