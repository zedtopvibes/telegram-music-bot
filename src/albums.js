// src/albums.js

// UPDATED: Removed 'files.' subdomain to use main domain
const IMAGE_BASE = "https://zedtopvibes.com";

function getAlbumImage(album) {
    if (album.cover_url && album.cover_url !== 'null' && album.cover_url !== '') {
        if (album.cover_url.startsWith('/')) {
            return `${IMAGE_BASE}${album.cover_url}`;
        }
        return album.cover_url.startsWith('http') ? album.cover_url : `${IMAGE_BASE}/${album.cover_url}`;
    }
    return 'https://zedtopvibes.com/apple-touch-icon.png';
}

export async function searchAlbum(db, query) {
  const searchTerm = `%${query.toLowerCase()}%`;
  const sql = `
    SELECT a.*, ar.name AS artist_name
    FROM albums a
    LEFT JOIN artists ar ON a.artist_id = ar.id
    WHERE (LOWER(a.title) LIKE ?1 OR LOWER(ar.name) LIKE ?1)
      AND a.deleted_at IS NULL
      AND a.status = 'published'
    LIMIT 1
  `;
  try {
    return await db.prepare(sql).bind(searchTerm).first();
  } catch (err) {
    console.error("D1 Album Search Error:", err);
    return null;
  }
}

export async function getTracksForAlbum(db, albumId) {
  const sql = `
    SELECT t.id, t.title, at.track_number
    FROM tracks t
    JOIN album_tracks at ON t.id = at.track_id
    WHERE at.album_id = ? 
      AND t.deleted_at IS NULL 
      AND t.status = 'published'
    ORDER BY at.track_number ASC
  `;
  try {
    const { results } = await db.prepare(sql).bind(albumId).all();
    return results || [];
  } catch (err) {
    console.error("D1 Album Tracks Error:", err);
    return [];
  }
}

export function formatAlbumUI(album, tracks) {
  const artwork = getAlbumImage(album);
  
  let caption = `💿 <b>ALBUM: ${album.title}</b>\n`;
  caption += `👤 <b>Artist:</b> ${album.artist_name || album.artist || "Unknown Artist"}\n\n`;
  caption += `<b>Tracklist:</b>\n`;

  const keyboard = { inline_keyboard: [] };
  
  tracks.forEach((track, index) => {
    const num = track.track_number || (index + 1);
    caption += `${num}. ${track.title}\n`;
    keyboard.inline_keyboard.push([{
      text: `🎵 Download: ${track.title}`,
      callback_data: `dl_${track.id}`
    }]);
  });

  return { caption, artwork, keyboard };
}
