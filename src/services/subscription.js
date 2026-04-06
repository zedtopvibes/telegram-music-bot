import { sendMessage } from '../utils/telegram.js';

export async function isForceSubEnabled(env) {
    const result = await env.DB.prepare(
        'SELECT force_sub_enabled FROM bot_settings WHERE id = 1'
    ).first();
    return result ? result.force_sub_enabled === 1 : false;
}

export async function setForceSubEnabled(enabled, env) {
    await env.DB.prepare(
        'UPDATE bot_settings SET force_sub_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1'
    ).bind(enabled ? 1 : 0).run();
}

export async function checkSubscription(userId, env) {
    const forceSubEnabled = await isForceSubEnabled(env);
    if (!forceSubEnabled) return true;
    
    const botToken = env.BOT_TOKEN;
    const channelUsername = env.CHANNEL_USERNAME;
    
    const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=@${channelUsername}&user_id=${userId}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.ok && data.result) {
            const status = data.result.status;
            return status === 'member' || status === 'administrator' || status === 'creator';
        }
        return false;
    } catch (error) {
        return false;
    }
}

export async function sendForceSubMessage(chatId, env) {
    const channelUsername = env.CHANNEL_USERNAME;
    const inlineKeyboard = {
        inline_keyboard: [
            [{ text: "Join Updates Channel", url: `https://t.me/${channelUsername}` }],
            [{ text: "Done", callback_data: "done" }]
        ]
    };
    
    await sendMessage(chatId, 
        `Join Updates Channel to use this Bot!\n\nOnly Channel Subscribers can use the Bot!`,
        env,
        inlineKeyboard
    );
}