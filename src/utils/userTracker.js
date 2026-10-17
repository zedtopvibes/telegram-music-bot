export async function trackUser(user, ctx, env) {
  if (!user || !user.id) return;
  
  const userId = user.id;
  const username = user.username || null;
  const firstName = user.first_name || null;
  const lastName = user.last_name || null;
  const langCode = user.language_code || null;
  
  // Insert new user OR update last_seen if they already exist
  const dbQuery = env.DB.prepare(`
    INSERT INTO bot_users (user_id, username, first_name, last_name, language_code, last_seen)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      language_code = excluded.language_code,
      last_seen = CURRENT_TIMESTAMP
  `).bind(userId, username, firstName, lastName, langCode);
  
  // Non-blocking background execution
  ctx.waitUntil(dbQuery.run());
}