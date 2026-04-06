import { sendMessage } from '../utils/telegram.js';
import { checkSubscription, sendForceSubMessage, isForceSubEnabled, setForceSubEnabled } from '../services/subscription.js';

export async function handleMessage(message, env) {
    const chatId = message.chat.id;
    const text = message.text || '';
    const firstName = message.from.first_name || 'User';
    const userId = message.from.id;
    const isPrivateChat = chatId === userId;
    
    // Admin command: /forcesub on / off / status
    if (text.startsWith('/forcesub') && userId.toString() === env.ADMIN_ID) {
        const parts = text.split(' ');
        const action = parts[1];
        if (action === 'on') {
            await setForceSubEnabled(true, env);
            await sendMessage(chatId, `✅ Force Sub ENABLED\nUsers must join @${env.CHANNEL_USERNAME}`, env);
        } else if (action === 'off') {
            await setForceSubEnabled(false, env);
            await sendMessage(chatId, `❌ Force Sub DISABLED\nAnyone can use the bot`, env);
        } else {
            const isEnabled = await isForceSubEnabled(env);
            await sendMessage(chatId, `🔒 Force Sub is: ${isEnabled ? 'ON' : 'OFF'}`, env);
        }
        return;
    }
    
    // Force sub check for private chats
    if (isPrivateChat) {
        const isSubscribed = await checkSubscription(userId, env);
        if (!isSubscribed) {
            await sendForceSubMessage(chatId, env);
            return;
        }
    }
    
    // Normal commands
    if (text === '/start') {
        await sendMessage(chatId, `Welcome ${firstName}! 👋\n\nBot is ready. Send any message to test.`, env);
        return;
    }
    
    // Echo for testing
    await sendMessage(chatId, `You said: "${text}"`, env);
}