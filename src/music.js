// src/music.js

export async function searchTracks(db, query) {
  // 1. Lowercase the query for better matching
  const searchTerm = `%${query.toLowerCase()}%`;

  // 2. The SQL Query
  // Note: We use LEFT JOIN so that even if an artist is missing, 
  // the track still shows up (artist_name will just be null).
  const sql = `
    SELECT 
      t.id, 
      t.title, 
      t.r2_key, 
      t.artwork_url, 
      t.genre,
      t.duration,
      a.name AS artist_name,
      a.is_zambian_legend
    FROM tracks t
    LEFT JOIN artists a ON t.artist_id = a.id
    WHERE (LOWER(t.title) LIKE ?1 OR LOWER(a.name) LIKE ?1)
    AND t.deleted_at IS NULL
    LIMIT 5
  `;

  try {
    const { results } = await db.prepare(sql).bind(searchTerm).all();
    
    // This log helps you see what's happening in the Cloudflare dashboard
    console.log(`Search for "${query}" returned ${results?.length || 0} results`);
    
    return results || [];
  } catch (err) {
    console.error("D1 Search Error:", err);
    return [];
  }
}

// Keep your formatTrackMessage function the same
export function formatTrackMessage(track) {
  const siteUrl = "https://zedtopvibes.com";
  
  // Ensure the URL is clean (handle leading slashes)
  const cleanArtworkPath = track.artwork_url?.startsWith('/') 
    ? track.artwork_url 
    : `/${track.artwork_url}`;
    
  const artwork = track.artwork_url 
    ? `${siteUrl}${cleanArtworkPath}` 
    : `${siteUrl}/default-cover.jpg`;

  const artist = track.artist_name || "Unknown Artist";
  const legendTag = track.is_zambian_legend ? " 🇿🇲 [Legend]" : "";

  const caption = `
🎵 <b>${track.title}</b>
👤 <b>Artist:</b> ${artist}${legendTag}
📂 <b>Genre:</b> ${track.genre || "N/A"}
⏱ <b>Duration:</b> ${track.duration ? Math.floor(track.duration / 60) + ":" + (track.duration % 60).toString().padStart(2, '0') : "N/A"}

Search powered by <b>ZedTopVibes</b>
  `;

  return { caption, artwork };
}
