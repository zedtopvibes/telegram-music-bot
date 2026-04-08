export async function handleStart(chatId, firstName, env, replyToMessageId = null) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  const welcomeText = `Hello ${firstName}! 👋 Welcome to ZedTopVibes 🎵\n\nDiscover Zambia's best music on Telegram! 🇿🇲🎧`;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔍 Search", callback_data: "search" },
        { text: "🎤 Artists", callback_data: "list_artists" }
      ],
      [
        { text: "💿 Albums", callback_data: "list_albums" },
        { text: "🎵 EPs", callback_data: "list_eps" }
      ],
      [
        { text: "📋 Playlists", callback_data: "list_playlists" },
        { text: "🆕 New", callback_data: "new_releases" }
      ],
      [
        { text: "📆 By Year", callback_data: "browse_years" },
        { text: "❓ Help", callback_data: "help" }
      ],
      [
        { text: "❌", callback_data: "delete_message" }
      ]
    ]
  };
  
  const requestBody = {
    chat_id: chatId,
    text: welcomeText,
    parse_mode: "HTML",
    reply_markup: keyboard
  };
  
  if (replyToMessageId) {
    requestBody.reply_to_message_id = replyToMessageId;
  }
  
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });
}