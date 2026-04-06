export async function sendMessage(chatId, text, env, replyMarkup = null) {
    const botToken = env.BOT_TOKEN;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const body = { chat_id: chatId, text, parse_mode: 'Markdown' };
    if (replyMarkup) body.reply_markup = replyMarkup;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return response.json();
}

export async function answerCallbackQuery(callbackQueryId, env, options = {}) {
    const botToken = env.BOT_TOKEN;
    const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
    const body = { callback_query_id: callbackQueryId };
    if (options.text) body.text = options.text;
    if (options.show_alert) body.show_alert = true;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}