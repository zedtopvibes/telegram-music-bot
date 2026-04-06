import { handleStart } from './handlers/start.js';
import { handleForceSub } from './handlers/forcesub.js';
import { handleArtistSearch } from './handlers/artists.js';
import { handleTrackSearch } from './handlers/tracks.js';
import { handleCallback } from './handlers/callbacks.js';
import { checkSubscription, sendForceSubMessage } from './services/subscription.js';
import { sendMessage } from './utils/telegram.js';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        if (url.pathname === '/webhook' && request.method === 'POST') {
            try {
                const update = await request.json();
                
                if (update.message) {
                    const message = update.message;
                    const chatId = message.chat.id;
                    const text = message.text || '';
                    const firstName = message.from.first_name || 'User';
                    const userId = message.from.id;
                    const isPrivateChat = chatId === userId;
                    
                    if (text.startsWith('/forcesub') && userId.toString() === env.ADMIN_ID) {
                        await handleForceSub(chatId, text, env, userId);
                        return new Response('OK', { status: 200 });
                    }
                    
                    if (isPrivateChat) {
                        const isSubscribed = await checkSubscription(userId, env);
                        if (!isSubscribed) {
                            await sendForceSubMessage(chatId, env);
                            return new Response('OK', { status: 200 });
                        }
                    }
                    
                    if (text === '/start') {
                        await handleStart(chatId, firstName, env);
                    } else if (text.startsWith('/artist')) {
                        const query = text.replace('/artist', '').trim();
                        await handleArtistSearch(chatId, query, env);
                    } else if (text.startsWith('/track')) {
                        const query = text.replace('/track', '').trim();
                        await handleTrackSearch(chatId, query, env);
                    } else {
                        await sendMessage(chatId, `Unknown command. Try /artist, /track, or /start`, env);
                    }
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