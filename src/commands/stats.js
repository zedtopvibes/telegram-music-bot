export async function handleStats(chatId, env, messageId = null) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  const ADMIN_ID = env.ADMIN_ID;
  
  // Admin only check
  if (chatId.toString() !== ADMIN_ID) {
    const errorBody = {
      chat_id: chatId,
      text: "❌ You are not authorized to use this command."
    };
    
    if (messageId) {
      errorBody.reply_to_message_id = messageId;
    }
    
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(errorBody)
    });
    return;
  }
  
  try {
    // Run all count queries in parallel
    const [
      tracksCount,
      artistsCount,
      albumsCount,
      epsCount,
      playlistsCount,
      yearCount,
      editorPicks,
      featuredTracks,
      featuredAlbums,
      zambianLegends,
      explicitCount,
      cleanCount
    ] = await Promise.all([
      // Total tracks
      env.DB.prepare(
        "SELECT COUNT(*) as c FROM tracks WHERE deleted_at IS NULL AND status = 'published'"
      ).first(),
      
      // Total artists
      env.DB.prepare(
        "SELECT COUNT(*) as c FROM artists WHERE deleted_at IS NULL AND status = 'published'"
      ).first(),
      
      // Total albums
      env.DB.prepare(
        "SELECT COUNT(*) as c FROM albums WHERE deleted_at IS NULL AND status = 'published'"
      ).first(),
      
      // Total EPs
      env.DB.prepare(
        "SELECT COUNT(*) as c FROM eps WHERE deleted_at IS NULL AND status = 'published'"
      ).first(),
      
      // Total playlists
      env.DB.prepare(
        "SELECT COUNT(*) as c FROM playlists WHERE deleted_at IS NULL AND status = 'published'"
      ).first(),
      
      // Tracks by year
      env.DB.prepare(`
        SELECT strftime('%Y', release_date) as year, COUNT(*) as count
        FROM tracks 
        WHERE release_date IS NOT NULL 
          AND deleted_at IS NULL 
          AND status = 'published'
        GROUP BY year 
        ORDER BY year DESC 
        LIMIT 5
      `).all(),
      
      // Editor picks
      env.DB.prepare(
        "SELECT COUNT(*) as c FROM tracks WHERE editor_pick = 1 AND deleted_at IS NULL AND status = 'published'"
      ).first(),
      
      // Featured tracks
      env.DB.prepare(
        "SELECT COUNT(*) as c FROM tracks WHERE featured = 1 AND deleted_at IS NULL AND status = 'published'"
      ).first(),
      
      // Featured albums
      env.DB.prepare(
        "SELECT COUNT(*) as c FROM albums WHERE is_featured = 1 AND deleted_at IS NULL AND status = 'published'"
      ).first(),
      
      // Zambian legends
      env.DB.prepare(
        "SELECT COUNT(*) as c FROM artists WHERE is_zambian_legend = 1 AND deleted_at IS NULL AND status = 'published'"
      ).first(),
      
      // Explicit tracks
      env.DB.prepare(
        "SELECT COUNT(*) as c FROM tracks WHERE explicit = 1 AND deleted_at IS NULL AND status = 'published'"
      ).first(),
      
      // Clean tracks
      env.DB.prepare(
        "SELECT COUNT(*) as c FROM tracks WHERE explicit = 0 AND deleted_at IS NULL AND status = 'published'"
      ).first()
    ]);
    
    // Build year list
    let yearList = "";
    if (yearCount.results && yearCount.results.length > 0) {
      yearCount.results.forEach((row) => {
        yearList += `├─ ${row.year}: ${row.count} tracks\n`;
      });
      yearList = yearList.slice(0, -1); // Remove last newline
    } else {
      yearList = "├─ No data";
    }
    
    // Build stats message
    const statsText = `📊 <b>ZedTopVibes Bot Stats</b>

🎵 <b>Library</b>
├─ 🎤 Artists: ${artistsCount.c}
├─ 💿 Albums: ${albumsCount.c}
├─ 🎵 EPs: ${epsCount.c}
├─ 📋 Playlists: ${playlistsCount.c}
└─ 🎧 Tracks: ${tracksCount.c}

📅 <b>Tracks by Year</b>
${yearList}

⭐ <b>Featured Content</b>
├─ Editor Picks: ${editorPicks.c}
├─ Featured Tracks: ${featuredTracks.c}
├─ Featured Albums: ${featuredAlbums.c}
└─ 🌟 Zambian Legends: ${zambianLegends.c}

🔊 <b>Content Type</b>
├─ Explicit: ${explicitCount.c}
└─ Clean: ${cleanCount.c}`;
    
    const successBody = {
      chat_id: chatId,
      text: statsText,
      parse_mode: "HTML"
    };
    
    if (messageId) {
      successBody.reply_to_message_id = messageId;
    }
    
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(successBody)
    });
    
  } catch (error) {
    console.error("Stats error:", error);
    
    const errorBody = {
      chat_id: chatId,
      text: "❌ Error fetching stats. Please try again."
    };
    
    if (messageId) {
      errorBody.reply_to_message_id = messageId;
    }
    
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(errorBody)
    });
  }
}