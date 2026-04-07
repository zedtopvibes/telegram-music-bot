// src/albums.js

export async function searchAlbum(db, query) {
  const words = query.trim().split(/\s+/);
  const firstWord = `%${words[0]}%`;
  const fullSearch = `%${query}%`;

  const sql = `
    SELECT a.*, ar.name AS artist_name
    FROM albums a
    LEFT JOIN artists ar ON a.artist_id = ar.id
    WHERE (LOWER(a.title) LIKE ?1 OR LOWER(ar.name) LIKE ?1 OR LOWER(a.title) LIKE ?2)
      AND a.deleted_at IS NULL
      AND a.status = 'published'
    ORDER BY (LOWER(a.title) = LOWER(?3)) DESC, a.created_at DESC
    LIMIT 1
  `;

  try {
    return await db.prepare(sql).bind(fullSearch, firstWord, query).first();
  } catch (err) {
    console.error("Album Search Error:", err);
    return null;
  }
}

export async function getTracksForAlbum(db, albumId) {
  const sql = `
    SELECT id, title, r2_key FROM tracks 
    WHERE release_id = ? AND release_type = 'album' 
    AND status = 'published' AND deleted_at IS NULL
    ORDER BY track_number ASC
  `;
  const { results } = await db.prepare(sql).bind(albumId).all();
  return results || [];
}

export function formatAlbumUI(album, tracks) {
  let caption = `💿 <b>ALBUM: ${album.title}</b>\n`;
  caption += `👤 <b>Artist:</b> ${album.artist_name || "Unknown"}\n\n`;
  caption += `<b>Tracklist:</b>\n`;

  const keyboard = { inline_keyboard: [] };
  tracks.forEach((t, i) => {
    caption += `${i + 1}. ${t.title}\n`;
    keyboard.inline_keyboard.push([{ text: `🎵 ${t.title}`, callback_data: `dl_${t.id}` }]);
  });

  return { caption, keyboard };
}
