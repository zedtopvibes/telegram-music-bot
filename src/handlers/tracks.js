import { sendMessage, sendPhoto } from '../utils/telegram.js';

const BASE_URL = 'https://zedtopvibes.com';

function buildImageUrl(path) {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${BASE_URL}/${cleanPath}`;
}

export async function handleTrackSearch(chatId, query, env) {
    if (!query) {
        await sendMessage(chatId, `Usage: /track <song name>\nExample: /track Mr Santa`, env);
        return;
    }
    
    const searchTerm = `%${query}%`;
    
    const results = await env.DB.prepare(`
        SELECT 
            t.id,
            t.title,
            t.release_date,
            t.artwork_url,
            a.name as artist_name,
            al.title as album_title
        FROM tracks t
        LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
        LEFT JOIN artists a ON ta.artist_id = a.id
        LEFT JOIN albums al ON t.album_id = al.id
        WHERE (t.title LIKE ? OR a.name LIKE ?)
        AND t.status = 'published'
        AND t.deleted_at IS NULL
        GROUP BY t.id
        LIMIT 5
    `).bind(searchTerm, searchTerm).all();
    
    if (!results.results || results.results.length === 0) {
        await sendMessage(chatId, `❌ No tracks found for "${query}"`, env);
        return;
    }
    
    for (const track of results.results) {
        const year = track.release_date ? track.release_date.split('-')[0] : 'Unknown';
        const albumName = track.album_title || '—';
        const caption = `🎧 Track: ${track.title}\n👤 Artist: ${track.artist_name}\n💽 Album: ${albumName}\n📅 Date: ${year}`;
        
        const inlineKeyboard = {
            inline_keyboard: [[{ text: "🎵 View in Bot Chat", callback_data: `track_${track.id}` }]]
        };
        
        const imageUrl = buildImageUrl(track.artwork_url);
        
        if (imageUrl) {
            try {
                await sendPhoto(chatId, imageUrl, caption, env, inlineKeyboard);
            } catch (error) {
                console.error('Failed to send photo for track:', track.id, error);
                await sendMessage(chatId, caption, env, inlineKeyboard);
            }
        } else {
            await sendMessage(chatId, caption, env, inlineKeyboard);
        }
    }
}