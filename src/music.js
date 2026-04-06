// src/music.js

export async function searchTracks(db, query) {
  // We use a JOIN to get the Artist Name along with the Track details
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
    JOIN artists a ON t.artist_id = a.id
    WHERE (t.title LIKE ?1 OR a.name LIKE ?1)
    AND t.deleted_at IS NULL
    LIMIT 5
  `;

  const { results } = await db.prepare(sql).bind(`%${query}%`).all();
  return results;
}

export function formatTrackMessage(track) {
  const siteUrl = "https://zedtopvibes.com";
  
  // Construct the full URL for the artwork
  // Adjust the path "/storage/" if your site uses a different folder
  const artwork = track.artwork_url 
    ? `${siteUrl}/${track.artwork_url}` 
    : `${siteUrl}/default-cover.jpg`;

  const legendTag = track.is_zambian_legend ? " 🇿🇲 [Legend]" : "";

  const caption = `
🎵 <b>${track.title}</b>
👤 <b>Artist:</b> ${track.artist_name}${legendTag}
📂 <b>Genre:</b> ${track.genre || "N/A"}
⏱ <b>Duration:</b> ${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}

Search powered by <b>ZedTopVibes</b>
  `;

  return { caption, artwork };
}
