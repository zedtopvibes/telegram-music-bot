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
    const [
      usersCount, // 👈 NEW: Total Users
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
      cleanCount,
      trackDownloadsSum,
      albumDownloadsSum,
      epDownloadsSum,
      playlistDownloadsSum,
      tracksDeliveredAlbums,
      tracksDeliveredEps,
      tracksDeliveredPlaylists,
      topTracks,
      topArtists
    ] = await Promise.all([
      // 1. Total Users
      env.DB.prepare("SELECT COUNT(*) as c FROM bot_users").first(),
      
      // 2. Library Counts
      env.DB.prepare("SELECT COUNT(*) as c FROM tracks WHERE deleted_at IS NULL AND status = 'published'").first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM artists WHERE deleted_at IS NULL AND status = 'published'").first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM albums WHERE deleted_at IS NULL AND status = 'published'").first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM eps WHERE deleted_at IS NULL AND status = 'published'").first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM playlists WHERE deleted_at IS NULL AND status = 'published'").first(),
      
      // 3. Tracks by year
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
      
      // 4. Featured Content
      env.DB.prepare("SELECT COUNT(*) as c FROM tracks WHERE editor_pick = 1 AND deleted_at IS NULL AND status = 'published'").first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM tracks WHERE featured = 1 AND deleted_at IS NULL AND status = 'published'").first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM albums WHERE is_featured = 1 AND deleted_at IS NULL AND status = 'published'").first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM artists WHERE is_zambian_legend = 1 AND deleted_at IS NULL AND status = 'published'").first(),
      
      // 5. Content Type
      env.DB.prepare("SELECT COUNT(*) as c FROM tracks WHERE explicit = 1 AND deleted_at IS NULL AND status = 'published'").first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM tracks WHERE explicit = 0 AND deleted_at IS NULL AND status = 'published'").first(),
      
      // 6. Download Activity (Clicks)
      env.DB.prepare("SELECT COALESCE(SUM(bot_downloads), 0) as total FROM tracks").first(),
      env.DB.prepare("SELECT COALESCE(SUM(bot_downloads), 0) as total FROM albums").first(),
      env.DB.prepare("SELECT COALESCE(SUM(bot_downloads), 0) as total FROM eps").first(),
      env.DB.prepare("SELECT COALESCE(SUM(bot_downloads), 0) as total FROM playlists").first(),
      
      // 7. Tracks Delivered (Actual Files Sent)
      env.DB.prepare(`
        SELECT COALESCE(SUM(
          (SELECT COUNT(*) FROM album_tracks at WHERE at.album_id = a.id) * a.bot_downloads
        ), 0) as total 
        FROM albums a
      `).first(),
      
      env.DB.prepare(`
        SELECT COALESCE(SUM(
          (SELECT COUNT(*) FROM ep_tracks et WHERE et.ep_id = e.id) * e.bot_downloads
        ), 0) as total 
        FROM eps e
      `).first(),
      
      env.DB.prepare(`
        SELECT COALESCE(SUM(
          (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) * p.bot_downloads
        ), 0) as total 
        FROM playlists p
      `).first(),
      
      // 8. Top Tracks
      env.DB.prepare(`
        SELECT t.title, t.bot_downloads, a.name as artist_name
        FROM tracks t
        LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
        LEFT JOIN artists a ON ta.artist_id = a.id
        WHERE t.bot_downloads > 0 
          AND t.deleted_at IS NULL 
          AND t.status = 'published'
        ORDER BY t.bot_downloads DESC 
        LIMIT 5
      `).all(),
      
      // 9. Top Artists
      env.DB.prepare(`
        SELECT name, bot_total_downloads
        FROM artists
        WHERE bot_total_downloads > 0 
          AND deleted_at IS NULL 
          AND status = 'published'
        ORDER BY bot_total_downloads DESC 
        LIMIT 5
      `).all()
    ]);
    
    // Build lists
    let yearList = "";
    if (yearCount.results && yearCount.results.length > 0) {
      yearCount.results.forEach((row) => {
        yearList += `├─ ${row.year}: ${row.count} tracks\n`;
      });
      yearList = yearList.slice(0, -1);
    } else {
      yearList = "├─ No data";
    }
    
    let topTracksList = "";
    if (topTracks.results && topTracks.results.length > 0) {
      topTracks.results.forEach((row, i) => {
        const artistPart = row.artist_name ? ` - ${row.artist_name}` : "";
        topTracksList += `${i + 1}. ${row.title}${artistPart} (${row.bot_downloads})\n`;
      });
      topTracksList = topTracksList.slice(0, -1);
    } else {
      topTracksList = "No downloads yet";
    }
    
    let topArtistsList = "";
    if (topArtists.results && topArtists.results.length > 0) {
      topArtists.results.forEach((row, i) => {
        topArtistsList += `${i + 1}. ${row.name} (${row.bot_total_downloads})\n`;
      });
      topArtistsList = topArtistsList.slice(0, -1);
    } else {
      topArtistsList = "No downloads yet";
    }
    
    // Calculate Totals
    const totalEvents = 
      (trackDownloadsSum.total || 0) + 
      (albumDownloadsSum.total || 0) + 
      (epDownloadsSum.total || 0) + 
      (playlistDownloadsSum.total || 0);
      
    const totalFilesDelivered = 
      (trackDownloadsSum.total || 0) + 
      (tracksDeliveredAlbums.total || 0) + 
      (tracksDeliveredEps.total || 0) + 
      (tracksDeliveredPlaylists.total || 0);
    
    // Build Message
    const statsText = `📊 <b>ZedTopVibes Bot Stats</b>

👥 <b>Users</b>
└─ Total Users: ${usersCount.c}

🎵 <b>Library</b>
├─ 🎤 Artists: ${artistsCount.c}
├─ 💿 Albums: ${albumsCount.c}
├─ 🎵 EPs: ${epsCount.c}
├─ 📋 Playlists: ${playlistsCount.c}
└─ 🎧 Tracks: ${tracksCount.c}

📥 <b>Download Activity (Clicks)</b>
├─ Individual Tracks: ${trackDownloadsSum.total}
├─ Albums: ${albumDownloadsSum.total}
├─ EPs: ${epDownloadsSum.total}
├─ Playlists: ${playlistDownloadsSum.total}
└─ Total Events: ${totalEvents}

🎧 <b>Tracks Delivered (Files)</b>
├─ From Individual: ${trackDownloadsSum.total}
├─ From Albums: ${tracksDeliveredAlbums.total}
├─ From EPs: ${tracksDeliveredEps.total}
├─ From Playlists: ${tracksDeliveredPlaylists.total}
└─ Total Files: ${totalFilesDelivered}

🔥 <b>Top 5 Tracks</b>
${topTracksList}

🎤 <b>Top 5 Artists</b>
${topArtistsList}

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