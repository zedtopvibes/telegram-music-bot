import { sendMessage } from '../utils/telegram.js';
import { isForceSubEnabled, setForceSubEnabled } from '../services/subscription.js';

export async function handleForceSub(chatId, text, env, userId) {
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
}