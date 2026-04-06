export async function sendMessage(chatId, text, env, replyMarkup = null) {
    const botToken = env.BOT_TOKEN;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const body = { 
        chat_id: chatId, 
        text: text, 
        parse_mode: 'Markdown',
        disable_web_page_preview: true
    };
    if (replyMarkup) body.reply_markup = replyMarkup;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return await response.json();
}

export async function sendPhoto(chatId, photoUrl, caption, env, replyMarkup = null) {
    const botToken = env.BOT_TOKEN;
    const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
    
    const body = { 
        chat_id: chatId, 
        photo: photoUrl, 
        caption: caption,
        parse_mode: 'Markdown'
    };
    if (replyMarkup) body.reply_markup = replyMarkup;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return await response.json();
}

export async function sendAudio(chatId, r2Key, title, env) {
    const botToken = env.BOT_TOKEN;
    const url = `https://api.telegram.org/bot${botToken}/sendAudio`;
    
    const audioObject = await env.AUDIO.get(r2Key);
    if (!audioObject) {
        await sendMessage(chatId, `❌ Audio file not found`, env);
        return;
    }
    
    const audioBuffer = await audioObject.arrayBuffer();
    const audioBlob = new Blob([audioBuffer]);
    
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('audio', audioBlob, r2Key.split('/').pop());
    formData.append('caption', `🎵 ${title}\n📌 Zedtopvibes.Com | Zambian Music`);
    
    await fetch(url, { method: 'POST', body: formData });
}

export async function deleteMessage(chatId, messageId, env) {
    const botToken = env.BOT_TOKEN;
    const url = `https://api.telegram.org/bot${botToken}/deleteMessage`;
    
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    });
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