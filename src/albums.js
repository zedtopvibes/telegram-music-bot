// src/albums.js

export async function searchAlbum(db, query) {
  const words = query.trim().split(/\s+/);
  const firstWord = `%${words[0]}%`;
  const fullSearch = `%${query}%`;

  // Fuzzy search: Looks for the full string, then falls back to the first word
  const sql = `
    SELECT a.*, ar.name AS artist_name
    FROM albums a
    LEFT JOIN artists ar ON a.artist_id = ar.id
    WHERE (LOWER(a.title) LIKE ?1 OR LOWER(ar.name) LIKE ?1 OR LOWER(a.title) LIKE ?2)
      AND a.deleted_at IS NULL
      AND a.status = 'published'
    ORDER BY 
      (LOWER(a.title) = LOWER(?3)) DESC, 
      (LOWER(a.title) LIKE ?1) DESC,
      a.created_at DESC
    LIMIT 1
  `;

  try {
    return await db.prepare(sql).bind(fullSearch, firstWord, query).first();
  } catch (err) {
    console.error("D1 Album Search Error:", err);
    return null;
  }
}

export async function getTracksForAlbum(db, albumId) {
  const sql = `
    SELECT id, title, duration, track_number
    FROM tracks
    WHERE release_id = ? AND release_type = 'album'
      AND status = 'published' AND deleted_at IS NULL
    ORDER BY track_number ASC, title ASC
  `;
  const { results } = await db.prepare(sql).bind(albumId).all();
  return results || [];
}

export function formatAlbumUI(album, tracks) {
  let caption = `💿 <b>ALBUM: ${album.title}</b>\n`;
  caption += `👤 <b>Artist:</b> ${album.artist_name || "Unknown"}\n`;
  if (album.release_date) caption += `📅 <b>Year:</b> ${new Date(album.release_date).getFullYear()}\n`;
  caption += `\n<b>Tracklist:</b>\n`;

  const keyboard = { inline_keyboard: [] };
  
  tracks.forEach((t, i) => {
    const num = t.track_number || (i + 1);
    caption += `${num}. ${t.title}\n`;
    keyboard.inline_keyboard.push([{
      text: `🎵 Download: ${t.title}`,
      callback_data: `dl_${t.id}`
    }]);
  });

  keyboard.inline_keyboard.push([{
    text: "🌐 View on Website",
    url: `https://zedtopvibes.com/album/${album.slug}`
  }]);

  return { caption, keyboard };
}
