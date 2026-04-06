export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        // Webhook endpoint
        if (url.pathname === '/webhook' && request.method === 'POST') {
            try {
                const update = await request.json();
                
                // Handle message
                if (update.message) {
                    const chatId = update.message.chat.id;
                    const text = update.message.text || '';
                    const firstName = update.message.from.first_name || 'User';
                    
                    if (text === '/start') {
                        await sendMessage(chatId, `Hello ${firstName}! Bot is working.`, env);
                    } else {
                        await sendMessage(chatId, `You said: ${text}`, env);
                    }
                }
                
                return new Response('OK', { status: 200 });
            } catch (error) {
                console.error('Error:', error);
                return new Response('Error', { status: 500 });
            }
        }
        
        // Set webhook
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
        
        return new Response('Bot is ready. Visit /setwebhook', { status: 200 });
    }
};

async function sendMessage(chatId, text, env) {
    const botToken = env.BOT_TOKEN;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text
        })
    });
}