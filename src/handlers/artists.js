import { sendMessage, sendPhoto } from '../utils/telegram.js';

const BASE_URL = 'https://zedtopvibes.com';

function buildImageUrl(path) {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${BASE_URL}/${cleanPath}`;
}

export async function handleArtistSearch(chatId, query, env) {
    if (!query) {
        await sendMessage(chatId, `Usage: /artist <artist name>\nExample: /artist Chile One`, env);
        return;
    }
    
    const searchTerm = `%${query}%`;
    
    const results = await env.DB.prepare(`
        SELECT 
            a.id,
            a.name,
            a.image_url,
            COUNT(DISTINCT ta.track_id) as total_tracks,
            COUNT(DISTINCT al.id) as album_count
        FROM artists a
        LEFT JOIN track_artists ta ON a.id = ta.artist_id
        LEFT JOIN albums al ON a.id = al.artist_id AND al.deleted_at IS NULL
        WHERE a.name LIKE ? AND a.status = 'published' AND a.deleted_at IS NULL
        GROUP BY a.id
        LIMIT 5
    `).bind(searchTerm).all();
    
    if (!results.results || results.results.length === 0) {
        await sendMessage(chatId, `❌ No artists found for "${query}"`, env);
        return;
    }
    
    for (const artist of results.results) {
        const caption = `👤 Artist: ${artist.name}\n💽 Albums: ${artist.album_count || 0}\n📊 Total Tracks: ${artist.total_tracks || 0}`;
        const imageUrl = buildImageUrl(artist.image_url);
        
        if (imageUrl) {
            try {
                await sendPhoto(chatId, imageUrl, caption, env);
            } catch (error) {
                console.error('Failed to send photo for artist:', artist.id, error);
                await sendMessage(chatId, caption, env);
            }
        } else {
            await sendMessage(chatId, caption, env);
        }
    }
}