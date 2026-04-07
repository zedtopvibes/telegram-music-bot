// /start command handler

export async function handleStart(chatId, firstName, db) {
  try {
    // Optional: Store user in database when they start
    const query = `
      INSERT OR IGNORE INTO user_preferences (user_id, username, created_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `;
    
    // Uncomment if you have user_preferences table
    // await db.prepare(query).bind(chatId.toString(), firstName).run();
    
    // Send welcome message with keyboard
    const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔍 Search Music", callback_data: "search" },
          { text: "🔥 Trending", callback_data: "trending" }
        ],
        [
          { text: "🎤 Artists", callback_data: "artists" },
          { text: "📀 Albums", callback_data: "albums" }
        ],
        [
          { text: "ℹ️ About", callback_data: "about" }
        ]
      ]
    };
    
    const welcomeText = `🎵 Welcome ${firstName} to ZedTopVibes Music Bot!\n\nI can help you discover and play music from Zambia's best artists.\n\nUse the buttons below to get started or send me a song name to search.`;
    
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: welcomeText,
        parse_mode: "HTML",
        reply_markup: keyboard
      })
    });
    
    return await response.json();
    
  } catch (error) {
    console.error("Error in handleStart:", error);
    return { ok: false, error: error.message };
  }
}