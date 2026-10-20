export async function handleProfile(chatId, env, messageId, view = "main") {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  try {
    const user = await env.DB.prepare(
      "SELECT first_name, username, first_seen, user_total_downloads FROM bot_users WHERE user_id = ?"
    ).bind(chatId).first();
    
    if (!user) return;
    
    const joinDate = user.first_seen ? user.first_seen.split(" ")[0] : "Unknown";
    const downloads = user.user_total_downloads || 0;
    
    let badge = "🎵 Newbie";
    if (downloads >= 5000) badge = "🏆 Legend";
    else if (downloads >= 2500) badge = "⚡ Elite";
    else if (downloads >= 1000) badge = "💎 Music Addict";
    else if (downloads >= 500) badge = "🌟 Super Fan";
    else if (downloads >= 150) badge = "👑 Vibe Master";
    else if (downloads >= 50) badge = "🔥 Music Lover";
    else if (downloads >= 10) badge = "🎧 Listener";

    // Default main profile text
    let text = `👤 <b>Your Profile</b>

📛 <b>Name:</b> ${user.first_name || "User"}
📅 <b>Joined:</b> ${joinDate}
🎖️ <b>Current Title:</b> ${badge}

🎧 <b>Total Downloads:</b> ${downloads}`;

    // --- HANDLE DIFFERENT VIEWS ---
    if (view === "titles") {
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

      text = `🏆 <b>Titles & Progress</b>

🎖️ <b>Current Title:</b> ${currentBadge}
🎧 <b>Total Downloads:</b> ${downloads}

📈 <b>Next Level:</b> ${nextBadge}
${needed > 0 ? `👉 Download <b>${needed}</b> more tracks to level up!` : `🎉 You have reached the maximum level!`}`;
    } 
    else if (view === "stats") {
      text = `📊 <b>My Stats</b>

🎧 <b>Total Tracks Downloaded:</b> ${downloads}
📅 <b>Member Since:</b> ${joinDate}

<i>Keep listening to unlock more stats!</i>`;
    }
    else if (view === "subs") {
      text = `🔔 <b>Subscriptions</b>

You haven't followed any artists yet.

<i>Artist follow feature is coming soon!</i>`;
    }
    else if (view === "rewards") {
      text = `🎁 <b>Rewards</b>

You currently have <b>0</b> points.

<i>Earn points by downloading music and redeem them for exclusive content. Coming soon!</i>`;
    }

    // --- THE 4 BUTTONS ---
    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔔 Subs", callback_data: "profile_subs" },
          { text: "🏆 Titles", callback_data: "profile_titles" }
        ],
        [
          { text: "🎁 Rewards", callback_data: "profile_rewards" },
          { text: "📊 Stats", callback_data: "profile_stats" }
        ],
        [
          { text: "❌ Close", callback_data: "delete_message" }
        ]
      ]
    };

    // If messageId exists, EDIT the message. If null, SEND a new one.
    if (messageId) {
      await fetch(`${TELEGRAM_API}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: text,
          parse_mode: "HTML",
          reply_markup: keyboard
        })
      });
    } else {
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "HTML",
          reply_markup: keyboard
        })
      });
    }
    
  } catch (error) {
    console.error("Profile error:", error);
  }
} 