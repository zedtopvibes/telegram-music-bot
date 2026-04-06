import { sendMessage } from '../utils/telegram.js';
import { checkSubscription, sendForceSubMessage, isForceSubEnabled, setForceSubEnabled } from '../services/subscription.js';

export async function handleMessage(message, env) {
    const chatId = message.chat.id;
    const text = message.text || '';
    const firstName = message.from.first_name || 'User';
    const userId = message.from.id;
    const isPrivateChat = chatId === userId;
    
    // Admin commands for force sub toggle
    if (text.startsWith('/forcesub') && userId.toString() === env.ADMIN_ID) {
        await handleForceSubCommand(chatId, text, env);
        return;
    }
    
    // Force sub for private chats
    if (isPrivateChat) {
        const isSubscribed = await checkSubscription(userId, env);
        
        if (!isSubscribed) {
            await sendForceSubMessage(chatId, env);
            return;
        }
    }
    
    // Handle commands after subscription
    if (text === '/start') {
        await sendMessage(chatId, 
            `[Info]\nWelcome ${firstName}! 👋\n\nBot is ready to use.`,
            env
        );
        return;
    }
    
    // Handle search commands
    if (text.startsWith('/track')) {
        const query = text.replace('/track', '').trim();
        if (query) {
            await searchTracks(chatId, query, env);
        } else {
            await sendMessage(chatId, `[Info]\nUsage: /track <song name>\n\nExample: /track Ice Spice Bikini Bottom`, env);
        }
        return;
    }
    
    if (text.startsWith('/artist')) {
        const query = text.replace('/artist', '').trim();
        if (query) {
            await searchArtists(chatId, query, env);
        } else {
            await sendMessage(chatId, `[Info]\nUsage: /artist <artist name>\n\nExample: /artist Ice Spice`, env);
        }
        return;
    }
    
    if (text.startsWith('/album')) {
        const query = text.replace('/album', '').trim();
        if (query) {
            await searchAlbums(chatId, query, env);
        } else {
            await sendMessage(chatId, `[Info]\nUsage: /album <album name>\n\nExample: /album Like?`, env);
        }
        return;
    }
    
    // Echo for testing
    await sendMessage(chatId, 
        `[Info]\nYou said: "${text}"\n\nUse /track, /artist, or /album to search Zambian music.`,
        env
    );
}

async function searchTracks(chatId, query, env) {
    const searchTerm = `%${query}%`;
    
    const results = await env.DB.prepare(`
        SELECT 
            t.id,
            t.title,
            t.duration,
            t.plays,
            a.name as artist_name
        FROM tracks t
        LEFT JOIN artists a ON t.artist_id = a.id
        WHERE (t.title LIKE ? OR a.name LIKE ?)
        AND t.status = 'published'
        LIMIT 5
    `).bind(searchTerm, searchTerm).all();
    
    if (!results.results || results.results.length === 0) {
        await sendMessage(chatId, `[Info]\n❌ No tracks found for "${query}"`, env);
        return;
    }
    
    for (const track of results.results) {
        const duration = formatDuration(track.duration);
        const plays = track.plays ? track.plays.toLocaleString() : '0';
        
        const inlineKeyboard = {
            inline_keyboard: [
                [{ text: "🎵 View in Bot Chat", callback_data: `track_${track.id}` }]
            ]
        };
        
        await sendMessage(chatId, 
            `🇿🇲 *${track.artist_name} - ${track.title}*\n` +
            `⏱️ Duration: ${duration}\n` +
            `🎧 Plays: ${plays}`,
            env,
            inlineKeyboard
        );
    }
}

async function searchArtists(chatId, query, env) {
    const searchTerm = `%${query}%`;
    
    const results = await env.DB.prepare(`
        SELECT 
            id,
            name,
            total_tracks,
            total_plays
        FROM artists
        WHERE name LIKE ?
        AND status = 'published'
        LIMIT 5
    `).bind(searchTerm).all();
    
    if (!results.results || results.results.length === 0) {
        await sendMessage(chatId, `[Info]\n❌ No artists found for "${query}"`, env);
        return;
    }
    
    for (const artist of results.results) {
        const tracks = artist.total_tracks || 0;
        const plays = artist.total_plays ? artist.total_plays.toLocaleString() : '0';
        
        const inlineKeyboard = {
            inline_keyboard: [
                [{ text: "🎵 View Songs", callback_data: `artist_${artist.id}` }]
            ]
        };
        
        await sendMessage(chatId, 
            `🇿🇲 *${artist.name}*\n` +
            `🎤 Tracks: ${tracks}\n` +
            `🎧 Total Plays: ${plays}`,
            env,
            inlineKeyboard
        );
    }
}

async function searchAlbums(chatId, query, env) {
    const searchTerm = `%${query}%`;
    
    const results = await env.DB.prepare(`
        SELECT 
            al.id,
            al.title,
            al.release_date,
            a.name as artist_name
        FROM albums al
        LEFT JOIN artists a ON al.artist_id = a.id
        WHERE al.title LIKE ?
        AND al.status = 'published'
        LIMIT 5
    `).bind(searchTerm).all();
    
    if (!results.results || results.results.length === 0) {
        await sendMessage(chatId, `[Info]\n❌ No albums found for "${query}"`, env);
        return;
    }
    
    for (const album of results.results) {
        const year = album.release_date ? album.release_date.split('-')[0] : 'Unknown';
        
        const inlineKeyboard = {
            inline_keyboard: [
                [{ text: "🎵 View Album", callback_data: `album_${album.id}` }]
            ]
        };
        
        await sendMessage(chatId, 
            `🇿🇲 *${album.artist_name} - ${album.title}*\n` +
            `📅 Year: ${year}`,
            env,
            inlineKeyboard
        );
    }
}

async function handleForceSubCommand(chatId, text, env) {
    const parts = text.split(' ');
    const action = parts[1];
    
    if (action === 'on') {
        await setForceSubEnabled(true, env);
        await sendMessage(chatId, 
            `[Info]\n✅ Force Sub ENABLED\n\nUsers must join @${env.CHANNEL_USERNAME}`,
            env
        );
    } else if (action === 'off') {
        await setForceSubEnabled(false, env);
        await sendMessage(chatId, 
            `[Info]\n❌ Force Sub DISABLED\n\nAnyone can use the bot`,
            env
        );
    } else if (action === 'status') {
        const isEnabled = await isForceSubEnabled(env);
        await sendMessage(chatId, 
            `[Info]\n🔒 Force Sub is: **${isEnabled ? 'ON' : 'OFF'}**`,
            env
        );
    } else {
        await sendMessage(chatId, 
            `[Info]\n📋 **Force Sub Commands:**\n\n/forcesub on - Enable\n/forcesub off - Disable\n/forcesub status - Check status`,
            env
        );
    }
}

function formatDuration(seconds) {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}