export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        if (url.pathname === '/webhook' && request.method === 'POST') {
            try {
                const update = await request.json();
                console.log('Received update:', JSON.stringify(update));
                
                if (update.message) {
                    const chatId = update.message.chat.id;
                    const text = update.message.text || '';
                    const firstName = update.message.from.first_name || 'User';
                    
                    if (text === '/start') {
                        await sendMessage(chatId, `Hello ${firstName}! Test bot is working. Your chat ID: ${chatId}`, env);
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
        
        if (url.pathname === '/setwebhook') {
            const botToken = env.BOT_TOKEN;
            const workerUrl = `https://${request.headers.get('host')}`;
            const webhookUrl = `${workerUrl}/webhook`;
            const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${webhookUrl}`);
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
        body: JSON.stringify({ chat_id: chatId, text: text })
    });
}