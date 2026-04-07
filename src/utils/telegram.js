// Helper functions for Telegram Bot API

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendMessage(chatId, text, replyMarkup = null) {
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
  };
  
  if (replyMarkup) {
    body.reply_markup = JSON.stringify(replyMarkup);
  }
  
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  
  return response.json();
}

export async function sendStartKeyboard(chatId, firstName) {
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
  
  return sendMessage(chatId, welcomeText, keyboard);
}