// Telegram Bot for @zedtopvibesbot with Force Sub

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        // Handle webhook requests from Telegram
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
        
        // Health check
        if (url.pathname === '/health') {
            return new Response('Bot is running', { status: 200 });
        }
        
        // Setup webhook
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
    // Handle messages
    if (update.message) {
        await handleMessage(update.message, env);
        return;
    }
}

async function handleMessage(message, env) {
    const chatId = message.chat.id;
    const text = message.text || '';
    const firstName = message.from.first_name || 'User';
    const userId = message.from.id;
    
    // Check if this is a private chat (DM)
    const isPrivateChat = chatId === userId;
    
    // For private chats, check subscription
    if (isPrivateChat) {
        const isSubscribed = await checkSubscription(userId, env);
        
        if (!isSubscribed) {
            const channelUsername = env.CHANNEL_USERNAME;
            await sendMessage(chatId, 
                `🔒 *Please join our channel first!*\n\n` +
                `👉 Join: @${channelUsername}\n\n` +
                `After joining, send /start again to use the bot.`,
                env
            );
            return;
        }
    }
    
    // Handle commands
    if (text === '/start') {
        await sendMessage(chatId, 
            `🎵 *Welcome to ZedtopVibes Bot!*\n\n` +
            `You are now subscribed to @${env.CHANNEL_USERNAME} ✅\n\n` +
            `🔍 *Commands:*\n` +
            `/search song <name> - Find a song\n` +
            `/search album <name> - Find an album\n` +
            `/search artist <name> - Find an artist\n` +
            `/search playlist <name> - Find a playlist\n` +
            `/search ep <name> - Find an EP\n` +
            `/search compilation <name> - Find a compilation\n\n` +
            `📌 *Example:*\n` +
            `/search song Burna Boy Last Last`,
            env
        );
        return;
    }
    
    // Echo for testing (will replace with search later)
    if (text.startsWith('/search')) {
        await sendMessage(chatId, 
            `🔍 Search feature coming soon!\n\n` +
            `You searched: "${text}"`,
            env
        );
        return;
    }
    
    // Unknown command
    if (text.startsWith('/')) {
        await sendMessage(chatId, 
            `❓ Unknown command. Use /start to see available commands.`,
            env
        );
        return;
    }
}

// Check if user has joined the channel
async function checkSubscription(userId, env) {
    const botToken = env.BOT_TOKEN;
    const channelUsername = env.CHANNEL_USERNAME;
    
    const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=@${channelUsername}&user_id=${userId}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.ok && data.result) {
            const status = data.result.status;
            // User is subscribed if status is member, administrator, or creator
            return status === 'member' || status === 'administrator' || status === 'creator';
        }
        return false;
    } catch (error) {
        console.error('Error checking subscription:', error);
        return false;
    }
}

// Send message to Telegram
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