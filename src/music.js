// src/music.js

export async function searchTracks(db, query) {
  const searchTerm = `%${query.toLowerCase()}%`;
  
  const sql = `
    SELECT 
      t.id, 
      t.title, 
      t.genre,
      t.duration,
      a.name AS artist_name,
      a.is_zambian_legend
    FROM tracks t
    LEFT JOIN artists a ON t.artist_id = a.id
    WHERE (LOWER(t.title) LIKE ?1 OR LOWER(a.name) LIKE ?1)
    AND t.deleted_at IS NULL
    LIMIT 1
  `;

  try {
    const { results } = await db.prepare(sql).bind(searchTerm).all();
    return results || [];
  } catch (err) {
    console.error("D1 Search Error:", err);
    return [];
  }
}

export function formatTrackMessage(track) {
  const artist = track.artist_name || "Unknown Artist";
  const legendTag = track.is_zambian_legend ? " 🇿🇲 [Legend]" : "";
  
  // Convert seconds to MM:SS
  const mins = Math.floor((track.duration || 0) / 60);
  const secs = ((track.duration || 0) % 60).toString().padStart(2, '0');

  return `
🎵 <b>${track.title}</b>
👤 <b>Artist:</b> ${artist}${legendTag}
📂 <b>Genre:</b> ${track.genre || "N/A"}
⏱ <b>Duration:</b> ${mins}:${secs}

Search powered by <b>ZedTopVibes</b>
  `;
}
