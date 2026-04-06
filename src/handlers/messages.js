import { sendMessage } from '../utils/telegram.js';
import { checkSubscription, sendForceSubMessage } from '../services/subscription.js';

export async function handleMessage(message, env) {
    const chatId = message.chat.id;
    const text = message.text || '';
    const firstName = message.from.first_name || 'User';
    const userId = message.from.id;
    
    const isPrivateChat = chatId === userId;
    
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
            `[Info]\nWelcome ${firstName}! 👋\n\nBot is ready to use.\n\n[Done]`,
            env
        );
        return;
    }
    
    // Echo for testing
    await sendMessage(chatId, 
        `[Info]\nYou said: "${text}"\n\n[Done]`,
        env
    );
}