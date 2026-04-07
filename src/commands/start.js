export async function handleStart(chatId, firstName, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  const welcomeText = `🎵 Welcome to ZedTopVibes Music Bot! 🎵

Hello ${firstName},

Discover and enjoy the best Zambian music directly on Telegram.

✨ What I can do:
🔍 Search for songs, artists, albums, EPs, and playlists
🎧 Listen to any track instantly
📀 Download full albums or playlists with one click
🎤 Explore artist profiles and discographies

📋 How to use:
• Type any artist or song name to search
• Use /track [name] for direct track search
• Try /artist, /album, /ep, or /playlist

🎯 Tip: Click buttons below to explore!

Enjoy the music! 🎧`;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔍 Search", callback_data: "search" },
        { text: "🎤 Artists", callback_data: "artists" }
      ],
      [
        { text: "💿 Albums", callback_data: "albums" },
        { text: "🎵 EPs", callback_data: "eps" }
      ],
      [
        { text: "📋 Playlists", callback_data: "playlists" },
        { text: "❓ Help", callback_data: "help" }
      ]
    ]
  };
  
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: welcomeText,
      parse_mode: "HTML",
      reply_markup: keyboard
    })
  });
}