import { sendMessage, sendPhoto } from '../utils/telegram.js';
import { checkSubscription, sendForceSubMessage, isForceSubEnabled, setForceSubEnabled } from '../services/subscription.js';

const BASE_URL = 'https://zedtopvibes.com';

export async function handleMessage(message, env) {
    const chatId = message.chat.id;
    const text = message.text || '';
    const firstName = message.from.first_name || 'User';
    const userId = message.from.id;
    const isPrivateChat = chatId === userId;
    
    if (text.startsWith('/forcesub') && userId.toString() === env.ADMIN_ID) {
        await handleForceSubCommand(chatId, text, env);
        return;
    }
    
    if (isPrivateChat) {
        const isSubscribed = await checkSubscription(userId, env);
        if (!isSubscribed) {
            await sendForceSubMessage(chatId, env);
            return;
        }
    }
    
    if (text === '/start') {
        await sendMessage(chatId, `Welcome ${firstName}! 👋\n\nUse /track, /artist, /album, /ep, /playlist, or /compilation to search Zambian music.`, env);
        return;
    }
    
    if (text.startsWith('/track')) {
        const query = text.replace('/track', '').trim();
        if (query) await searchTracks(chatId, query, env);
        else await sendMessage(chatId, `Usage: /track <song name>\nExample: /track Mr Santa`, env);
        return;
    }
    
    if (text.startsWith('/artist')) {
        const query = text.replace('/artist', '').trim();
        if (query) await searchArtists(chatId, query, env);
        else await sendMessage(chatId, `Usage: /artist <artist name>\nExample: /artist Chile One`, env);
        return;
    }
    
    if (text.startsWith('/album')) {
        const query = text.replace('/album', '').trim();
        if (query) await searchAlbums(chatId, query, env);
        else await sendMessage(chatId, `Usage: /album <album name>\nExample: /album Mr Santa`, env);
        return;
    }
    
    if (text.startsWith('/ep')) {
        const query = text.replace('/ep', '').trim();
        if (query) await searchEPs(chatId, query, env);
        else await sendMessage(chatId, `Usage: /ep <EP name>\nExample: /ep Love Ep`, env);
        return;
    }
    
    if (text.startsWith('/playlist')) {
        const query = text.replace('/playlist', '').trim();
        if (query) await searchPlaylists(chatId, query, env);
        else await sendMessage(chatId, `Usage: /playlist <playlist name>\nExample: /playlist Zambian Hits`, env);
        return;
    }
    
    if (text.startsWith('/compilation')) {
        const query = text.replace('/compilation', '').trim();
        if (query) await searchCompilations(chatId, query, env);
        else await sendMessage(chatId, `Usage: /compilation <compilation name>\nExample: /compilation Best of 2024`, env);
        return;
    }
    
    await sendMessage(chatId, `Unknown command. Try /track, /artist, /album, /ep, /playlist, or /compilation`, env);
}

async function searchTracks(chatId, query, env) {
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
        
        let imageUrl = null;
        if (track.artwork_url) {
            if (track.artwork_url.startsWith('http')) {
                imageUrl = track.artwork_url;
            } else {
                imageUrl = `${BASE_URL}/${track.artwork_url}`;
            }
        }
        
        if (imageUrl) {
            await sendPhoto(chatId, imageUrl, caption, env, inlineKeyboard);
        } else {
            await sendMessage(chatId, caption, env, inlineKeyboard);
        }
    }
}

async function searchArtists(chatId, query, env) {
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
        
        let imageUrl = null;
        if (artist.image_url) {
            if (artist.image_url.startsWith('http')) {
                imageUrl = artist.image_url;
            } else {
                imageUrl = `${BASE_URL}/${artist.image_url}`;
            }
        }
        
        if (imageUrl) {
            await sendPhoto(chatId, imageUrl, caption, env);
        } else {
            await sendMessage(chatId, caption, env);
        }
    }
}

async function searchAlbums(chatId, query, env) {
    const searchTerm = `%${query}%`;
    
    const results = await env.DB.prepare(`
        SELECT 
            al.id,
            al.title,
            al.release_date,
            al.cover_url,
            a.name as artist_name,
            COUNT(DISTINCT at.track_id) as track_count
        FROM albums al
        LEFT JOIN artists a ON al.artist_id = a.id
        LEFT JOIN album_tracks at ON al.id = at.album_id
        WHERE al.title LIKE ? AND al.status = 'published' AND al.deleted_at IS NULL
        GROUP BY al.id
        LIMIT 5
    `).bind(searchTerm).all();
    
    if (!results.results || results.results.length === 0) {
        await sendMessage(chatId, `❌ No albums found for "${query}"`, env);
        return;
    }
    
    for (const album of results.results) {
        const year = album.release_date ? album.release_date.split('-')[0] : 'Unknown';
        const caption = `💽 Album: ${album.title}\n👤 Artist: ${album.artist_name}\n📅 Date: ${year}\n🎧 Total tracks: ${album.track_count || 0}`;
        
        let imageUrl = null;
        if (album.cover_url) {
            if (album.cover_url.startsWith('http')) {
                imageUrl = album.cover_url;
            } else {
                imageUrl = `${BASE_URL}/${album.cover_url}`;
            }
        }
        
        if (imageUrl) {
            await sendPhoto(chatId, imageUrl, caption, env);
        } else {
            await sendMessage(chatId, caption, env);
        }
    }
}

async function searchEPs(chatId, query, env) {
    const searchTerm = `%${query}%`;
    
    const results = await env.DB.prepare(`
        SELECT 
            e.id,
            e.title,
            e.release_date,
            e.cover_url,
            a.name as artist_name,
            COUNT(DISTINCT et.track_id) as track_count
        FROM eps e
        LEFT JOIN artists a ON e.artist_id = a.id
        LEFT JOIN ep_tracks et ON e.id = et.ep_id
        WHERE e.title LIKE ? AND e.status = 'published' AND e.deleted_at IS NULL
        GROUP BY e.id
        LIMIT 5
    `).bind(searchTerm).all();
    
    if (!results.results || results.results.length === 0) {
        await sendMessage(chatId, `❌ No EPs found for "${query}"`, env);
        return;
    }
    
    for (const ep of results.results) {
        const year = ep.release_date ? ep.release_date.split('-')[0] : 'Unknown';
        const caption = `💽 EP: ${ep.title}\n👤 Artist: ${ep.artist_name}\n📅 Date: ${year}\n🎧 Total tracks: ${ep.track_count || 0}`;
        
        let imageUrl = null;
        if (ep.cover_url) {
            if (ep.cover_url.startsWith('http')) {
                imageUrl = ep.cover_url;
            } else {
                imageUrl = `${BASE_URL}/${ep.cover_url}`;
            }
        }
        
        if (imageUrl) {
            await sendPhoto(chatId, imageUrl, caption, env);
        } else {
            await sendMessage(chatId, caption, env);
        }
    }
}

async function searchPlaylists(chatId, query, env) {
    const searchTerm = `%${query}%`;
    
    const results = await env.DB.prepare(`
        SELECT 
            p.id,
            p.title,
            p.cover_url,
            COUNT(DISTINCT pt.track_id) as track_count
        FROM playlists p
        LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
        WHERE p.title LIKE ? AND p.status = 'published' AND p.deleted_at IS NULL
        GROUP BY p.id
        LIMIT 5
    `).bind(searchTerm).all();
    
    if (!results.results || results.results.length === 0) {
        await sendMessage(chatId, `❌ No playlists found for "${query}"`, env);
        return;
    }
    
    for (const playlist of results.results) {
        const caption = `📋 Playlist: ${playlist.title}\n🎧 Total tracks: ${playlist.track_count || 0}`;
        
        let imageUrl = null;
        if (playlist.cover_url) {
            if (playlist.cover_url.startsWith('http')) {
                imageUrl = playlist.cover_url;
            } else {
                imageUrl = `${BASE_URL}/${playlist.cover_url}`;
            }
        }
        
        if (imageUrl) {
            await sendPhoto(chatId, imageUrl, caption, env);
        } else {
            await sendMessage(chatId, caption, env);
        }
    }
}

async function searchCompilations(chatId, query, env) {
    const searchTerm = `%${query}%`;
    
    const results = await env.DB.prepare(`
        SELECT 
            c.id,
            c.title,
            c.cover_url,
            COUNT(DISTINCT ci.track_id) as track_count
        FROM compilations c
        LEFT JOIN compilation_items ci ON c.id = ci.compilation_id
        WHERE c.title LIKE ? AND c.status = 'published' AND c.deleted_at IS NULL
        GROUP BY c.id
        LIMIT 5
    `).bind(searchTerm).all();
    
    if (!results.results || results.results.length === 0) {
        await sendMessage(chatId, `❌ No compilations found for "${query}"`, env);
        return;
    }
    
    for (const compilation of results.results) {
        const caption = `📀 Compilation: ${compilation.title}\n🎧 Total tracks: ${compilation.track_count || 0}`;
        
        let imageUrl = null;
        if (compilation.cover_url) {
            if (compilation.cover_url.startsWith('http')) {
                imageUrl = compilation.cover_url;
            } else {
                imageUrl = `${BASE_URL}/${compilation.cover_url}`;
            }
        }
        
        if (imageUrl) {
            await sendPhoto(chatId, imageUrl, caption, env);
        } else {
            await sendMessage(chatId, caption, env);
        }
    }
}

async function handleForceSubCommand(chatId, text, env) {
    const parts = text.split(' ');
    const action = parts[1];
    
    if (action === 'on') {
        await setForceSubEnabled(true, env);
        await sendMessage(chatId, `✅ Force Sub ENABLED\n\nUsers must join @${env.CHANNEL_USERNAME}`, env);
    } else if (action === 'off') {
        await setForceSubEnabled(false, env);
        await sendMessage(chatId, `❌ Force Sub DISABLED\n\nAnyone can use the bot`, env);
    } else {
        const isEnabled = await isForceSubEnabled(env);
        await sendMessage(chatId, `🔒 Force Sub is: ${isEnabled ? 'ON' : 'OFF'}`, env);
    }
}