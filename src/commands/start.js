export async function handleStart(chatId, firstName, env, replyToMessageId = null) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  const BOT_USERNAME = env.BOT_USERNAME || "zedtopvibesbot"; // Use your actual bot username here!
  
  const welcomeText = `Hello ${firstName}! 👋 Welcome to ZedTopVibes 🎵\n\nDiscover Zambia's best music on Telegram! 🇿🇲🎧\n\n<i>Tip: Click a button below, then type your search and hit send!</i>`;
  
  const keyboard = {
    inline_keyboard: [
      [
        // Empty string opens the keyboard with just "@zedtopvibesbot "
        { text: "🔍 Search", switch_inline_query_current_chat: "" },
        // ".art " opens the keyboard with "@zedtopvibesbot .art "
        { text: "🎤 Artists", switch_inline_query_current_chat: ".art " }
      ],
      [
        { text: "💿 Albums", switch_inline_query_current_chat: ".al " },
        { text: "🎵 EPs", switch_inline_query_current_chat: ".ep " }
      ],
      [
        { text: "📋 Playlists", switch_inline_query_current_chat: ".pl " },
        { text: "📅 By Year", switch_inline_query_current_chat: ".yr " }
      ],
      [
        { text: "🆕 New Releases", callback_data: "new_releases" },
        { text: "❓ Help", callback_data: "help" }
      ],
      [
        { text: "❌ Close", callback_data: "delete_message" }
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