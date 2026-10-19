export async function handleProfile(chatId, env, messageId = null) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  try {
    const user = await env.DB.prepare(
      "SELECT first_name, username, first_seen, user_total_downloads FROM bot_users WHERE user_id = ?"
    ).bind(chatId).first();
    
    if (!user) return;
    
    const joinDate = user.first_seen ? user.first_seen.split(" ")[0] : "Unknown";
    const downloads = user.user_total_downloads || 0;
    
    // Get Badge
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
📅 <b>Joined:</b> ${joinDate}
🎖️ <b>Current Title:</b> ${badge}

🎧 <b>Total Downloads:</b> ${downloads}`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🏆 Titles & Progress", callback_data: "profile_badges" }],
        [{ text: "📊 My Stats", callback_data: "profile_stats" }],
        [{ text: "❌ Close", callback_data: "delete_message" }]
      ]
    };

    const requestBody = {
      chat_id: chatId,
      text: profileText,
      parse_mode: "HTML",
      reply_markup: keyboard
    };
    
    if (messageId) requestBody.reply_to_message_id = messageId;
    
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    
  } catch (error) {
    console.error("Profile error:", error);
  }
}

// 👇 NEW FUNCTION: For the Badges Button
export async function handleProfileBadges(chatId, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  const user = await env.DB.prepare(
    "SELECT user_total_downloads FROM bot_users WHERE user_id = ?"
  ).bind(chatId).first();
  
  const downloads = user.user_total_downloads || 0;
  
  let currentBadge = "🎵 Newbie";
  let nextBadge = "🎧 Listener (10)";
  let needed = 10 - downloads;
  
  if (downloads >= 5000) { currentBadge = "🏆 Legend"; nextBadge = "MAX LEVEL"; needed = 0; }
  else if (downloads >= 2500) { currentBadge = "⚡ Elite"; nextBadge = "🏆 Legend (5000)"; needed = 5000 - downloads; }
  else if (downloads >= 1000) { currentBadge = "💎 Music Addict"; nextBadge = "⚡ Elite (2500)"; needed = 2500 - downloads; }
  else if (downloads >= 500) { currentBadge = "🌟 Super Fan"; nextBadge = "💎 Music Addict (1000)"; needed = 1000 - downloads; }
  else if (downloads >= 150) { currentBadge = "👑 Vibe Master"; nextBadge = "🌟 Super Fan (500)"; needed = 500 - downloads; }
  else if (downloads >= 50) { currentBadge = "🔥 Music Lover"; nextBadge = "👑 Vibe Master (150)"; needed = 150 - downloads; }
  else if (downloads >= 10) { currentBadge = "🎧 Listener"; nextBadge = "🔥 Music Lover (50)"; needed = 50 - downloads; }

  const progressText = `🏆 <b>Your Titles & Progress</b>

🎖️ <b>Current Title:</b> ${currentBadge}
🎧 <b>Total Downloads:</b> ${downloads}

📈 <b>Next Level:</b> ${nextBadge}
${needed > 0 ? `👉 Download <b>${needed}</b> more tracks to level up!` : `🎉 You have reached the maximum level!`}`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "🔙 Back to Profile", callback_data: "profile_home" }],
      [{ text: "❌ Close", callback_data: "delete_message" }]
    ]
  };

  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: progressText,
      parse_mode: "HTML",
      reply_markup: keyboard
    })
  });
}