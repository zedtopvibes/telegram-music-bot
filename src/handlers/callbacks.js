import { sendMessage, deleteMessage, answerCallbackQuery, sendAudio } from '../utils/telegram.js';
import { checkSubscription, sendForceSubMessage } from '../services/subscription.js';

export async function handleCallback(callbackQuery, env) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;
    const userId = callbackQuery.from.id;
    
    if (data === 'done') {
        const isSubscribed = await checkSubscription(userId, env);
        
        if (!isSubscribed) {
            await answerCallbackQuery(callbackQuery.id, env, {
                text: "❌ Please join the channel first!",
                show_alert: true
            });
            return;
        }
        
        await answerCallbackQuery(callbackQuery.id, env);
        await deleteMessage(chatId, messageId, env);
        await sendMessage(chatId, `Welcome to ZedtopVibes Bot! ✅\n\nUse /start to begin.`, env);
        return;
    }
    
    if (data.startsWith('track_')) {
        const trackId = data.split('_')[1];
        await handleTrackCallback(chatId, trackId, env, callbackQuery.id);
        return;
    }
}

async function handleTrackCallback(chatId, trackId, env, callbackQueryId) {
    await answerCallbackQuery(callbackQueryId, env);
    
    const isSubscribed = await checkSubscription(chatId, env);
    if (!isSubscribed) {
        await sendForceSubMessage(chatId, env);
        return;
    }
    
    const track = await env.DB.prepare(`
        SELECT t.title, t.r2_key, a.name as artist_name
        FROM tracks t
        LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
        LEFT JOIN artists a ON ta.artist_id = a.id
        WHERE t.id = ?
    `).bind(trackId).first();
    
    if (!track || !track.r2_key) {
        await sendMessage(chatId, `❌ Track not found`, env);
        return;
    }
    
    await sendAudio(chatId, track.r2_key, `${track.artist_name} - ${track.title}`, env);
}