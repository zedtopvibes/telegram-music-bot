export async function checkSubscription(chatId, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const CHANNEL_USERNAME = env.CHANNEL_USERNAME;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  // Get force sub setting from database
  const settingsQuery = await env.DB.prepare(
    "SELECT force_sub_enabled FROM bot_settings LIMIT 1"
  ).first();
  
  const forceSubEnabled = settingsQuery?.force_sub_enabled === 1;
  
  if (!forceSubEnabled) {
    return { allowed: true };
  }
  
  // Check if user is member of channel
  const chatMemberResponse = await fetch(
    `${TELEGRAM_API}/getChatMember?chat_id=@${CHANNEL_USERNAME}&user_id=${chatId}`
  );
  
  const memberData = await chatMemberResponse.json();
  const status = memberData.result?.status;
  
  const allowed = status === "member" || status === "administrator" || status === "creator";
  
  if (!allowed) {
    const keyboard = {
      inline_keyboard: [
        [{ text: "Join channel ↗️", url: `https://t.me/${CHANNEL_USERNAME}` }],
        [{ text: "Done ✅", callback_data: "check_subscription" }]
      ]
    };
    
    return {
      allowed: false,
      message: "Please join our channel to use this bot",
      keyboard: keyboard
    };
  }
  
  return { allowed: true };
}