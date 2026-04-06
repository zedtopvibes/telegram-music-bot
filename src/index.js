export default {
  async fetch(request, env) {
    if (request.method === "POST") {
      const payload = await request.json();

      // Check if it's a message and contains text
      if (payload.message && payload.message.text) {
        const chatId = payload.message.chat.id;
        const text = payload.message.text;

        if (text === "/start") {
          await sendMessage(chatId, "Welcome to your Music Bot! 🎵 Send me a song name (feature coming soon).", env.BOT_TOKEN);
        } else {
          await sendMessage(chatId, `You said: ${text}. I'm still learning how to find music!`, env.BOT_TOKEN);
        }
      }
    }
    return new Response("OK", { status: 200 });
  },
};

// Helper function to talk back to Telegram
async function sendMessage(chatId, text, token) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text }),
  });
}
