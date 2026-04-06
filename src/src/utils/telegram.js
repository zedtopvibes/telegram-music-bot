// Telegram API utilities

// Send message to Telegram
export async function sendMessage(chatId, text, env, replyMarkup = null) {
    const botToken = env.BOT_TOKEN;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const body = {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
    };
    
    if (replyMarkup) {
        body.reply_markup = replyMarkup;
    }
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await response.json();
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Delete message
export async function deleteMessage(chatId, messageId, env) {
    const botToken = env.BOT_TOKEN;
    const url = `https://api.telegram.org/bot${botToken}/deleteMessage`;
    
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId
            })
        });
    } catch (error) {
        console.error('Error deleting message:', error);
    }
}

// Answer callback query (for button clicks)
export async function answerCallbackQuery(callbackQueryId, env, options = {}) {
    const botToken = env.BOT_TOKEN;
    const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
    
    const body = {
        callback_query_id: callbackQueryId
    };
    
    if (options.text) {
        body.text = options.text;
    }
    
    if (options.show_alert) {
        body.show_alert = true;
    }
    
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    } catch (error) {
        console.error('Error answering callback:', error);
    }
}