export async function handleForceSub(command, chatId, env) {
  const ADMIN_ID = env.ADMIN_ID;
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  // Check if user is admin
  if (chatId.toString() !== ADMIN_ID) {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "❌ You are not authorized to use this command."
      })
    });
    return;
  }
  
  const args = command.split(" ")[1]; // on, off, or status
  
  if (args === "on") {
    await env.DB.prepare(
      "UPDATE bot_settings SET force_sub_enabled = 1, updated_at = CURRENT_TIMESTAMP"
    ).run();
    
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✅ Force subscribe has been ENABLED. Users must join the channel to use the bot."
      })
    });
    
  } else if (args === "off") {
    await env.DB.prepare(
      "UPDATE bot_settings SET force_sub_enabled = 0, updated_at = CURRENT_TIMESTAMP"
    ).run();
    
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "❌ Force subscribe has been DISABLED. Users can use the bot without joining the channel."
      })
    });
    
  } else if (args === "status") {
    const settings = await env.DB.prepare(
      "SELECT force_sub_enabled FROM bot_settings LIMIT 1"
    ).first();
    
    const status = settings?.force_sub_enabled === 1 ? "ENABLED" : "DISABLED";
    
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🔐 Force subscribe is currently: ${status}`
      })
    });
    
  } else {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Usage:\n/forcesub on - Enable force subscribe\n/forcesub off - Disable force subscribe\n/forcesub status - Check current status"
      })
    });
  }
}