// src/artists.js

const IMAGE_BASE = "https://zedtopvibes.com";

/**
 * Generates the artist image URL.
 * Your proxy handles /images/artists/ or just the filename.
 */
function getArtistImage(artist) {
    if (artist.image_url && artist.image_url !== 'null' && artist.image_url !== '') {
        // If it's a full URL already, use it
        if (artist.image_url.startsWith('http')) return artist.image_url;
        
        // If it's a path like /images/artists/name.jpg, ensure it has the domain
        if (artist.image_url.startsWith('/')) return `${IMAGE_BASE}${artist.image_url}`;
        
        // Otherwise, assume it's a filename and let the proxy handle the 'artists/' prefix
        return `${IMAGE_BASE}/images/artists/${artist.image_url}`;
    }
    // Fallback if no image exists
    return 'https://zedtopvibes.com/apple-touch-icon.png';
}

export async function searchArtist(db, query) {
  const searchTerm = `%${query.toLowerCase()}%`;
  const sql = `
    SELECT * FROM artists 
    WHERE LOWER(name) LIKE ? 
    AND deleted_at IS NULL 
    LIMIT 1
  `;
  try {
    return await db.prepare(sql).bind(searchTerm).first();
  } catch (err) {
    return null;
  }
}

export async function getArtistTracks(db, artistId) {
  const sql = `
    SELECT t.id, t.title 
    FROM tracks t
    JOIN track_artists ta ON t.id = ta.track_id
    WHERE ta.artist_id = ? 
    AND t.deleted_at IS NULL 
    AND t.status = 'published'
    ORDER BY t.created_at DESC
    LIMIT 5
  `;
  try {
    const { results } = await db.prepare(sql).bind(artistId).all();
    return results || [];
  } catch (err) {
    return [];
  }
}

export function formatArtistUI(artist, tracks) {
  const artwork = getArtistImage(artist);
  
  let caption = `👤 <b>ARTIST: ${artist.name}</b>\n`;
  if (artist.bio && artist.bio !== 'null') {
    caption += `\n<i>${artist.bio}</i>\n`;
  }
  
  caption += `\n<b>Latest Releases:</b>\n`;

  const keyboard = { inline_keyboard: [] };
  if (tracks.length > 0) {
    tracks.forEach((track) => {
      caption += `🎵 ${track.title}\n`;
      keyboard.inline_keyboard.push([{
        text: `⬇️ Download: ${track.title}`,
        callback_data: `dl_${track.id}`
      }]);
    });
  }

  keyboard.inline_keyboard.push([{
    text: "🌐 Full Profile",
    url: `https://zedtopvibes.com/artists/${artist.slug}`
  }]);

  return { caption, artwork, keyboard };
}
