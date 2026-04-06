export async function checkSubscription(userId, env) {
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
        console.error('Error checking subscription:', error);
        return false;
    }
}

export async function sendForceSubMessage(chatId, env) {
    const channelUsername = env.CHANNEL_USERNAME;
    const { sendMessage } = await import('../utils/telegram.js');
    
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