export async function handleProfile(chatId, env, messageId = null) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  try {
    // Fetch user from database
    const user = await env.DB.prepare(
      "SELECT first_name, username, first_seen, user_total_downloads FROM bot_users WHERE user_id = ?"
    ).bind(chatId).first();
    
    if (!user) {
      const errorBody = {
        chat_id: chatId,
        text: "❌ Profile not found. Please send /start to register."
      };
      if (messageId) errorBody.reply_to_message_id = messageId;
      
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(errorBody)
      });
      return;
    }
    
    // Format the join date (Extract just YYYY-MM-DD)
    const joinDate = user.first_seen ? user.first_seen.split(" ")[0] : "Unknown";
    
    // Get the Badge based on downloads
    const downloads = user.user_total_downloads || 0;
    let badge = "🎵 Newbie";
    
    if (downloads >= 5000) badge = "🏆 Legend";
    else if (downloads >= 2500) badge = "⚡ Elite";
    else if (downloads >= 1000) badge = "💎 Music Addict";
    else if (downloads >= 500) badge = "🌟 Super Fan";
    else if (downloads >= 150) badge = "👑 Vibe Master";
    else if (downloads >= 50) badge = "🔥 Music Lover";
    else if (downloads >= 10) badge = "🎧 Listener";
    
    const profileText = `👤 <b>Your Profile</b>

📛 <b>Name:</b> ${user.first_name || "User"}
🆔 <b>ID:</b> <code>${chatId}</code>
📅 <b>Joined:</b> ${joinDate}

🎧 <b>Total Downloads:</b> ${downloads}
🎖️ <b>Badge:</b> ${badge}`;
    
    const successBody = {
      chat_id: chatId,
      text: profileText,
      parse_mode: "HTML"
    };
    
    if (messageId) successBody.reply_to_message_id = messageId;
    
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(successBody)
    });
    
  } catch (error) {
    console.error("Profile error:", error);
  }
}