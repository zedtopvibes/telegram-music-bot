import { sendMessage } from '../utils/telegram.js';

export async function handleStart(chatId, firstName, env) {
    await sendMessage(chatId, 
        `Welcome ${firstName}! 👋\n\n` +
        `Available commands:\n` +
        `/artist <name> - Search for an artist\n\n` +
        `Example: /artist Chile One`,
        env
    );
}