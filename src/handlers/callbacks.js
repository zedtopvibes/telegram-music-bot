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
        await sendMessage(chatId, 
            `[Info]\nWelcome to ZedtopVibes Bot! ✅\n\nUse /start to begin.`,
            env
        );
        return;
    }
    
    // Handle track callback
    if (data.startsWith('track_')) {
        const trackId = data.split('_')[1];
        await handleTrackCallback(chatId, trackId, env, callbackQuery.id);
        return;
    }
    
    // Handle artist callback
    if (data.startsWith('artist_')) {
        const artistId = data.split('_')[1];
        await handleArtistCallback(chatId, artistId, env, callbackQuery.id);
        return;
    }
    
    // Handle album callback
    if (data.startsWith('album_')) {
        const albumId = data.split('_')[1];
        await handleAlbumCallback(chatId, albumId, env, callbackQuery.id);
        return;
    }
}

async function handleTrackCallback(chatId, trackId, env, callbackQueryId) {
    await answerCallbackQuery(callbackQueryId, env);
    
    // Check subscription before sending audio
    const isSubscribed = await checkSubscription(chatId, env);
    
    if (!isSubscribed) {
        await sendForceSubMessage(chatId, env);
        return;
    }
    
    const track = await env.DB.prepare(`
        SELECT t.title, t.r2_key, a.name as artist_name
        FROM tracks t
        LEFT JOIN artists a ON t.artist_id = a.id
        WHERE t.id = ?
    `).bind(trackId).first();
    
    if (!track || !track.r2_key) {
        await sendMessage(chatId, `[Info]\n❌ Track not found`, env);
        return;
    }
    
    await sendAudio(chatId, track.r2_key, `${track.artist_name} - ${track.title}`, env);
}

async function handleArtistCallback(chatId, artistId, env, callbackQueryId) {
    await answerCallbackQuery(callbackQueryId, env);
    
    const tracks = await env.DB.prepare(`
        SELECT t.id, t.title
        FROM tracks t
        WHERE t.artist_id = ?
        AND t.status = 'published'
        LIMIT 10
    `).bind(artistId).all();
    
    if (!tracks.results || tracks.results.length === 0) {
        await sendMessage(chatId, `[Info]\n❌ No tracks found for this artist`, env);
        return;
    }
    
    let message = `[Info]\n🎤 *Songs by this artist:*\n\n`;
    for (const track of tracks.results) {
        message += `• ${track.title}\n`;
    }
    
    await sendMessage(chatId, message, env);
}

async function handleAlbumCallback(chatId, albumId, env, callbackQueryId) {
    await answerCallbackQuery(callbackQueryId, env);
    
    const tracks = await env.DB.prepare(`
        SELECT t.id, t.title, a.name as artist_name
        FROM tracks t
        LEFT JOIN artists a ON t.artist_id = a.id
        WHERE t.album_id = ?
        AND t.status = 'published'
        LIMIT 20
    `).bind(albumId).all();
    
    if (!tracks.results || tracks.results.length === 0) {
        await sendMessage(chatId, `[Info]\n❌ No tracks found for this album`, env);
        return;
    }
    
    let message = `[Info]\n💿 *Album Tracks:*\n\n`;
    for (const track of tracks.results) {
        message += `• ${track.title}\n`;
    }
    
    await sendMessage(chatId, message, env);
} 