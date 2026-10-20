export async function handleInfo(chatId, env, messageId = null) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  try {
    // Fetch live stats from D1
    const [usersCount, trackDownloadsSum, albumDownloadsSum, epDownloadsSum, playlistDownloadsSum] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) as c FROM bot_users").first(),
      env.DB.prepare("SELECT COALESCE(SUM(bot_downloads), 0) as total FROM tracks").first(),
      env.DB.prepare("SELECT COALESCE(SUM(bot_downloads), 0) as total FROM albums").first(),
      env.DB.prepare("SELECT COALESCE(SUM(bot_downloads), 0) as total FROM eps").first(),
      env.DB.prepare("SELECT COALESCE(SUM(bot_downloads), 0) as total FROM playlists").first()
    ]);
    
    const totalDownloads = 
      (trackDownloadsSum.total || 0) + 
      (albumDownloadsSum.total || 0) + 
      (epDownloadsSum.total || 0) + 
      (playlistDownloadsSum.total || 0);

    const infoText = `ℹ️ <b>About Zambian Music Finder</b>

📛 <b>Name:</b> Zambian Music Finder
📂 <b>Category:</b> Music & Audio
⚙️ <b>Version:</b> v1.0.0

📊 <b>Live Stats:</b>
├─ 👥 Total Users: ${usersCount.c}
└─ 📥 Total Downloads: ${totalDownloads}

✨ <b>Features:</b>
├─ ⚡ Instant CDN Downloads
├─ 📀 Bulk Download (Albums/Playlists)
├─ 🎖️ User Badge System
└─ 📢 Group Support

🌐 <b>Developer:</b> zedtopvibes.com
📧 <b>Email:</b> support@zedtopvibes.com
📞 <b>Support:</b> @ZedTopVibes`;

    const requestBody = {
      chat_id: chatId,
      text: infoText,
      parse_mode: "HTML"
    };
    
    if (messageId) {
      requestBody.reply_to_message_id = messageId;
    }
    
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    
  } catch (error) {
    console.error("Info error:", error);
  }
}