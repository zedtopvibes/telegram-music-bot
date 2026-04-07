// src/albums.js

/**
 * Searches the 'albums' table and joins with 'artists'
 */
export async function searchAlbum(db, query) {
  const searchTerm = `%${query.toLowerCase()}%`;
  
  const sql = `
    SELECT 
      a.id, 
      a.title, 
      a.artwork_url, 
      a.release_date,
      a.slug,
      art.name AS artist_name
    FROM albums a
    LEFT JOIN artists art ON a.artist_id = art.id
    WHERE (LOWER(a.title) LIKE ?1 OR LOWER(art.name) LIKE ?1)
    LIMIT 1
  `;

  try {
    const result = await db.prepare(sql).bind(searchTerm).first();
    return result || null;
  } catch (err) {
    console.error("D1 Album Search Error:", err);
    return null;
  }
}

/**
 * Fetches all tracks linked to the album via release_id
 */
export async function getTracksForAlbum(db, albumId) {
  const sql = `
    SELECT id, title, duration, track_number
    FROM tracks
    WHERE release_id = ? AND release_type = 'album'
    ORDER BY track_number ASC, title ASC
  `;

  try {
    const { results } = await db.prepare(sql).bind(albumId).all();
    return results || [];
  } catch (err) {
    console.error("D1 Album Tracks Error:", err);
    return [];
  }
}

/**
 * Formats the Album View UI with a Tracklist and buttons
 */
export function formatAlbumUI(album, tracks) {
  const siteUrl = "https://zedtopvibes.com";
  let artwork = `${siteUrl}/apple-touch-icon.png`;

  if (album.artwork_url) {
    const cleanPath = album.artwork_url.startsWith('/') ? album.artwork_url : `/${album.artwork_url}`;
    artwork = `${siteUrl}${cleanPath}`;
  }

  let caption = `💿 <b>ALBUM: ${album.title}</b>\n`;
  caption += `👤 <b>Artist:</b> ${album.artist_name || "Unknown"}\n`;
  caption += `📅 <b>Year:</b> ${album.release_date ? album.release_date.substring(0, 4) : "N/A"}\n\n`;
  caption += `<b>Tracklist:</b>\n`;

  const keyboard = { inline_keyboard: [] };
  
  tracks.forEach((track, index) => {
    const trackNum = track.track_number || (index + 1);
    caption += `${trackNum}. ${track.title}\n`;

    // Reuses the 'dl_' callback from our tracks logic
    keyboard.inline_keyboard.push([{
      text: `🎵 Download: ${track.title}`,
      callback_data: `dl_${track.id}`
    }]);
  });

  // Optional: Add "View on Website" button
  keyboard.inline_keyboard.push([{
    text: "🌐 View on ZedTopVibes",
    url: `${siteUrl}/album/${album.slug}`
  }]);

  return { caption, artwork, keyboard };
}
