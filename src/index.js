import { handleMessage } from './handlers/messages.js';
import { handleCallback } from './handlers/callbacks.js';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        if (url.pathname === '/webhook' && request.method === 'POST') {
            try {
                const update = await request.json();
                
                if (update.message) {
                    await handleMessage(update.message, env);
                }
                
                if (update.callback_query) {
                    await handleCallback(update.callback_query, env);
                }
                
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
        
        return new Response('Bot is ready. Visit /setwebhook', { status: 200 });
    }
};