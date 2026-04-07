// src/artists.js

/**
 * Finds an artist by name
 */
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
    console.error("D1 Artist Search Error:", err);
    return null;
  }
}

/**
 * Fetches the latest tracks for this artist
 */
export async function getArtistTracks(db, artistId) {
  // Using the track_artists pivot table
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
    console.error("D1 Artist Tracks Error:", err);
    return [];
  }
}

/**
 * UI for Artist Profile
 */
export function formatArtistUI(artist, tracks) {
  let text = `👤 <b>ARTIST: ${artist.name}</b>\n`;
  if (artist.bio) text += `\n<i>${artist.bio}</i>\n`;
  
  text += `\n<b>Latest Tracks:</b>\n`;

  const keyboard = { inline_keyboard: [] };

  if (tracks.length > 0) {
    tracks.forEach((track) => {
      text += `🎵 ${track.title}\n`;
      keyboard.inline_keyboard.push([{
        text: `⬇️ Download: ${track.title}`,
        callback_data: `dl_${track.id}`
      }]);
    } );
  } else {
    text += `<i>No tracks found.</i>`;
  }

  return { text, keyboard };
}
