import { sendMessage } from '../utils/telegram.js';

export async function handleStart(chatId, firstName, env) {
    await sendMessage(chatId, 
        `Welcome ${firstName}! 👋\n\n` +
        `Available commands:\n` +
        `/artist <name> - Search for an artist\n` +
        `/track <name> - Search for a track\n\n` +
        `Examples:\n` +
        `/artist Chile One\n` +
        `/track Mr Santa`,
        env
    );
}