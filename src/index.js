import { handleStart } from "./commands/start.js";

export default {
  async fetch(request, env, ctx) {
    if (request.method === "POST" && new URL(request.url).pathname === "/webhook") {
      try {
        const update = await request.json();
        ctx.waitUntil(handleUpdate(update, env));
        return new Response("OK", { status: 200 });
      } catch (error) {
        console.error("Webhook error:", error);
        return new Response("Error", { status: 500 });
      }
    }
    
    return new Response("Not found", { status: 404 });
  },
};

async function handleUpdate(update, env) {
  if (update.message && update.message.text === "/start") {
    const chatId = update.message.chat.id;
    const firstName = update.message.chat.first_name || "User";
    await handleStart(chatId, firstName, env);
  }
}