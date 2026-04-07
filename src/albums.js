// src/albums.js

/**
 * Searches for a published album using the exact same logic as your API.
 */
export async function searchAlbum(db, query) {
  const searchTerm = `%${query.toLowerCase()}%`;
  
  const sql = `
    SELECT 
      a.id, 
      a.title, 
      a.cover_url, -- Matches your API's 'cover_url'
      a.release_date,
      a.slug,
      ar.name AS artist_name
    FROM albums a
    LEFT JOIN artists ar ON a.artist_id = ar.id
    WHERE (LOWER(a.title) LIKE ?1 OR LOWER(ar.name) LIKE ?1)
      AND a.deleted_at IS NULL
      AND a.status = 'published'
    ORDER BY a.created_at DESC
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
 * Fetches published tracks for an album.
 */
export async function getTracksForAlbum(db, albumId) {
  const sql = `
    SELECT id, title, duration, track_number
    FROM tracks
    WHERE release_id = ? 
      AND release_type = 'album'
      AND status = 'published'
      AND deleted_at IS NULL
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
 * Formats the Album View for Telegram.
 */
export function formatAlbumUI(album, tracks) {
  const siteUrl = "https://zedtopvibes.com";
  
  // Use cover_url from your API, fallback to default icon
  let artwork = `${siteUrl}/apple-touch-icon.png`;
  if (album.cover_url) {
    const cleanPath = album.cover_url.startsWith('/') ? album.cover_url : `/${album.cover_url}`;
    artwork = `${siteUrl}${cleanPath}`;
  }

  let caption = `💿 <b>ALBUM: ${album.title}</b>\n`;
  caption += `👤 <b>Artist:</b> ${album.artist_name || "Unknown Artist"}\n`;
  
  if (album.release_date) {
    caption += `📅 <b>Released:</b> ${new Date(album.release_date).getFullYear()}\n`;
  }
  
  caption += `\n<b>Tracklist (${tracks.length} songs):</b>\n`;

  const keyboard = { inline_keyboard: [] };
  
  tracks.forEach((track, index) => {
    const trackNum = track.track_number || (index + 1);
    caption += `${trackNum}. ${track.title}\n`;

    // Reuses the 'dl_' callback from index.js
    keyboard.inline_keyboard.push([{
      text: `🎵 ${track.title}`,
      callback_data: `dl_${track.id}`
    }]);
  });

  // Direct link to the website album page
  keyboard.inline_keyboard.push([{
    text: "🌐 View Album Online",
    url: `${siteUrl}/album/${album.slug}`
  }]);

  return { caption, artwork, keyboard };
}
