import { sendMessage, deleteMessage, answerCallbackQuery } from '../utils/telegram.js';
import { checkSubscription } from '../services/subscription.js';

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
            `[Info]\nWelcome to ZedtopVibes Bot! ✅\n\nUse /start to begin.\n\n[Done]`,
            env
        );
    }
}