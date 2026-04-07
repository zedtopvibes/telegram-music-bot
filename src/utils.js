// src/utils.js

export async function sendMessage(chatId, text, token, keyboard = null) {
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
  };
  if (keyboard) body.reply_markup = keyboard;

  return await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// THIS IS THE MISSING PIECE
export async function sendPhoto(chatId, photo, caption, keyboard, token) {
  return await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photo,
      caption: caption,
      parse_mode: "HTML",
      reply_markup: keyboard
    })
  });
}

export async function answerCallbackQuery(callbackQueryId, text, showAlert, token) {
  return await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: showAlert,
    }),
  });
}
