export async function handleStart(chatId, firstName, env) {
  const BOT_TOKEN = env.BOT_TOKEN; 
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `Hello ${firstName}! Bot is working.`
    })
  });
  
  return response.json();
}