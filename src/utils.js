// src/utils.js

/**
 * Sends a text message to a specific Telegram chat.
 * Supports HTML parsing and optional Inline Keyboards.
 */
export async function sendMessage(chatId, text, token, keyboard = null) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
    disable_web_page_preview: true
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

/**
 * Checks if a user is a member, admin, or creator of the specified channel.
 * Requires the bot to be an administrator in the channel.
 */
export async function checkSubscription(userId, channelUsername, token) {
  // Remove '@' if the user included it in the variable, then add it back for the API
  const cleanUsername = channelUsername.replace('@', '');
  const url = `https://api.telegram.org/bot${token}/getChatMember?chat_id=@${cleanUsername}&user_id=${userId}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.ok) return false;
    
    const status = data.result.status;
    // Valid statuses for 'access granted'
    return ["creator", "administrator", "member"].includes(status);
  } catch (e) {
    console.error("CheckSubscription Error:", e);
    return false;
  }
}

/**
 * Deletes a specific message from a chat.
 * Used to clean up "Access Denied" messages after a user joins.
 */
export async function deleteMessage(chatId, messageId, token) {
  const url = `https://api.telegram.org/bot${token}/deleteMessage`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      chat_id: chatId, 
      message_id: messageId 
    }),
  });
}

/**
 * Provides feedback for Callback Buttons (the "Join" check).
 * Stops the 'loading' spinner on the button and can show a notification.
 */
export async function answerCallbackQuery(callbackQueryId, text, showAlert, token) {
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: showAlert
    }),
  });
}
