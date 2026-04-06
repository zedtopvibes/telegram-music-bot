// src/utils.js

export async function sendMessage(chatId, text, token, keyboard = null) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
  };

  if (keyboard) {
    body.reply_markup = keyboard;
  }

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function checkSubscription(userId, channelUsername, token) {
  const url = `https://api.telegram.org/bot${token}/getChatMember?chat_id=@${channelUsername}&user_id=${userId}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data.ok) return false;
    
    const status = data.result.status;
    // Allow creators, admins, and members
    return ["creator", "administrator", "member"].includes(status);
  } catch (e) {
    return false;
  }
}
