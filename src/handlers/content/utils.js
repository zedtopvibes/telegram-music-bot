import { checkSubscription } from "../../middleware/checkSubscription.js";

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;
const IMAGE_CDN = "https://zedtopvibes.com";

export async function checkUserSubscription(chatId, env) {
  const subCheck = await checkSubscription(chatId, env);
  if (!subCheck.allowed) {
    return { allowed: false, message: subCheck.message, keyboard: subCheck.keyboard };
  }
  return { allowed: true };
}

export async function sendPhotoWithCaption(chatId, imageUrl, caption, env, keyboard = null) {
  const BOT_TOKEN = env.BOT_TOKEN;
  
  if (!imageUrl || imageUrl === "" || imageUrl === "null") return null;
  
  let fullImageUrl = imageUrl;
  if (!imageUrl.startsWith("http")) {
    fullImageUrl = `${IMAGE_CDN}${imageUrl}`;
  }
  
  const body = {
    chat_id: chatId,
    photo: fullImageUrl,
    caption: caption,
    parse_mode: "HTML"
  };
  
  if (keyboard) body.reply_markup = keyboard;

  try {
    const response = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return await response.json();
  } catch (error) {
    console.error("Error sending photo:", error);
    return null;
  }
}