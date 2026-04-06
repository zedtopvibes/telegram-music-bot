// Telegram Bot for @zedtopvibesbot with Force Sub Buttons

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        if (url.pathname === '/webhook' && request.method === 'POST') {
            try {
                const update = await request.json();
                await handleUpdate(update, env);
                return new Response('OK', { status: 200 });
            } catch (error) {
                console.error('Error:', error);
                return new Response('Error', { status: 500 });
            }
        }
        
        if (url.pathname === '/health') {
            return new Response('Bot is running', { status: 200 });
        }
        
        if (url.pathname === '/setwebhook') {
            const botToken = env.BOT_TOKEN;
            const workerUrl = `https://${request.headers.get('host')}`;
            const webhookUrl = `${workerUrl}/webhook`;
            
            const apiUrl = `https://api.telegram.org/bot${botToken}/setWebhook?url=${webhookUrl}`;
            const response = await fetch(apiUrl);
            const result = await response.json();
            
            return new Response(JSON.stringify(result, null, 2), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        return new Response('Bot is ready. Visit /setwebhook to setup.', { status: 200 });
    }
};

async function handleUpdate(update, env) {
    // Handle callback queries (button clicks)
    if (update.callback_query) {
        await handleCallbackQuery(update.callback_query, env);
        return;
    }
    
    // Handle messages
    if (update.message) {
        await handleMessage(update.message, env);
        return;
    }
}

async function handleCallbackQuery(callbackQuery, env) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;
    
    // Answer callback to remove loading state
    await answerCallbackQuery(callbackQuery.id);
    
    if (data === 'done') {
        await deleteMessage(chatId, messageId, env);
        await sendMessage(chatId, 
            `[Info]\nWelcome to ZedtopVibes Bot!\n\nUse /start to begin.\n\n[Join updates channel]\n👉 @${env.CHANNEL_USERNAME}\n\n[Done]`,
            env
        );
    }
}

async function handleMessage(message, env) {
    const chatId = message.chat.id;
    const text = message.text || '';
    const firstName = message.from.first_name || 'User';
    const userId = message.from.id;
    
    const isPrivateChat = chatId === userId;
    
    // Force sub for private chats
    if (isPrivateChat) {
        const isSubscribed = await checkSubscription(userId, env);
        
        if (!isSubscribed) {
            await sendForceSubMessage(chatId, env);
            return;
        }
    }
    
    // Handle commands after subscription
    if (text === '/start') {
        await sendMessage(chatId, 
            `[Info]\nWelcome ${firstName}! 👋\n\nBot is ready to use.\n\n[Join updates channel]\n👉 @${env.CHANNEL_USERNAME}\n\n[Done]`,
            env
        );
        return;
    }
    
    // Echo for testing
    await sendMessage(chatId, 
        `[Info]\nYou said: "${text}"\n\n[Join updates channel]\n👉 @${env.CHANNEL_USERNAME}\n\n[Done]`,
        env
    );
}

// Send force sub message with buttons
async function sendForceSubMessage(chatId, env) {
    const botToken = env.BOT_TOKEN;
    const channelUsername = env.CHANNEL_USERNAME;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const inlineKeyboard = {
        inline_keyboard: [
            [
                {
                    text: "Join Updates Channel",
                    url: `https://t.me/${channelUsername}`
                }
            ],
            [
                {
                    text: "Done",
                    callback_data: "done"
                }
            ]
        ]
    };
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: `Join Updates Channel to use this Bot!\n\nOnly Channel Subscribers can use the Bot!`,
            reply_markup: inlineKeyboard
        })
    });
    
    return await response.json();
}

// Send regular message
async function sendMessage(chatId, text, env) {
    const botToken = env.BOT_TOKEN;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'Markdown'
            })
        });
        return await response.json();
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Delete message
async function deleteMessage(chatId, messageId, env) {
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

// Answer callback query
async function answerCallbackQuery(callbackQueryId) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;
    
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                callback_query_id: callbackQueryId
            })
        });
    } catch (error) {
        console.error('Error answering callback:', error);
    }
}

// Check subscription
async function checkSubscription(userId, env) {
    const botToken = env.BOT_TOKEN;
    const channelUsername = env.CHANNEL_USERNAME;
    
    const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=@${channelUsername}&user_id=${userId}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.ok && data.result) {
            const status = data.result.status;
            return status === 'member' || status === 'administrator' || status === 'creator';
        }
        return false;
    } catch (error) {
        console.error('Error checking subscription:', error);
        return false;
    }
}