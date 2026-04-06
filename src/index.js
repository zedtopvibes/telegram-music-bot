// Simple test bot for @zedtopvibesbot

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        // Handle webhook requests from Telegram
        if (url.pathname === '/webhook' && request.method === 'POST') {
            try {
                const update = await request.json();
                
                // Log the update (for debugging)
                console.log('Received update:', JSON.stringify(update));
                
                // Handle message if exists
                if (update.message) {
                    await handleMessage(update.message, env);
                }
                
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
        
        // Setup webhook (visit this URL once)
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

async function handleMessage(message, env) {
    const chatId = message.chat.id;
    const text = message.text || '';
    const firstName = message.from.first_name || 'User';
    
    // Simple echo bot
    if (text === '/start') {
        await sendMessage(chatId, `Hello ${firstName}! 👋\n\nI am a test bot. Send me any message and I'll reply!`, env);
    } else {
        await sendMessage(chatId, `You said: "${text}"`, env);
    }
}

async function sendMessage(chatId, text, env) {
    const botToken = env.BOT_TOKEN;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
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
}