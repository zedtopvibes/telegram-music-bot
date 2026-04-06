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
        const forceSubEnabled = await isForceSubEnabled(env);
        const statusText = forceSubEnabled ? '✅ ON' : '❌ OFF';
        
        await sendMessage(chatId, 
            `[Info]\nWelcome ${firstName}! 👋\n\nBot is ready to use.\n\n🔒 Force Sub: ${statusText}\n\n[Done]`,
            env
        );
        return;
    }
    
    await sendMessage(chatId, 
        `[Info]\nYou said: "${text}"\n\n[Done]`,
        env
    );
}

async function handleForceSubCommand(chatId, text, env) {
    const parts = text.split(' ');
    const action = parts[1];
    
    if (action === 'on') {
        await setForceSubEnabled(true, env);
        await sendMessage(chatId, 
            `[Info]\n✅ Force Sub has been **ENABLED**\n\nNew users must join @${env.CHANNEL_USERNAME} to use the bot.\n\n[Done]`,
            env
        );
    } else if (action === 'off') {
        await setForceSubEnabled(false, env);
        await sendMessage(chatId, 
            `[Info]\n❌ Force Sub has been **DISABLED**\n\nAnyone can use the bot without joining the channel.\n\n[Done]`,
            env
        );
    } else if (action === 'status') {
        const isEnabled = await isForceSubEnabled(env);
        await sendMessage(chatId, 
            `[Info]\n🔒 Force Sub is currently: **${isEnabled ? 'ON' : 'OFF'}**\n\nTo change: /forcesub on  or  /forcesub off\n\n[Done]`,
            env
        );
    } else {
        await sendMessage(chatId, 
            `[Info]\n📋 **Force Sub Commands:**\n\n/forcesub on - Enable force sub\n/forcesub off - Disable force sub\n/forcesub status - Check current status\n\n[Done]`,
            env
        );
    }
}