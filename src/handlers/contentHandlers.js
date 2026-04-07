const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;
const CDN_URL = "https://files.zedtopvibes.com";

export async function handleArtist(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const artistId = callbackQuery.data.replace("artist_", "");
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  const artistQuery = `
    SELECT name, bio, country FROM artists 
    WHERE id = ? AND deleted_at IS NULL AND status = 'published'
  `;
  const artist = await env.DB.prepare(artistQuery).bind(artistId).first();
  
  if (!artist) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Artist not found."
      })
    });
    return;
  }
  
  const tracksQuery = `
    SELECT t.id, t.title
    FROM tracks t
    LEFT JOIN track_artists ta ON t.id = ta.track_id
    WHERE ta.artist_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
    GROUP BY t.id
    ORDER BY t.title
    LIMIT 20
  `;
  
  const tracks = await env.DB.prepare(tracksQuery).bind(artistId).all();
  
  let responseText = `🎤 ${artist.name}\n\n`;
  if (artist.bio) responseText += `${artist.bio}\n\n`;
  if (artist.country) responseText += `📍 Country: ${artist.country}\n\n`;
  responseText += `🎵 Tracks:\n\n`;
  
  const buttons = [];
  
  if (tracks.results && tracks.results.length > 0) {
    tracks.results.forEach((track, index) => {
      const number = index + 1;
      responseText += `${number}. ${track.title}\n`;
      buttons.push([{ text: `🎵 ${track.title}`, callback_data: `track_${track.id}` }]);
    });
  } else {
    responseText += `No tracks found.`;
  }
  
  buttons.push([{ text: "❌", callback_data: "delete_message" }]);
  
  const keyboard = { inline_keyboard: buttons };
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: responseText,
      reply_markup: keyboard
    })
  });
}

export async function handleAlbum(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const albumId = callbackQuery.data.replace("album_", "");
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  const albumQuery = `
    SELECT title, description, release_date, genre, label
    FROM albums
    WHERE id = ? AND deleted_at IS NULL AND status = 'published'
  `;
  const album = await env.DB.prepare(albumQuery).bind(albumId).first();
  
  if (!album) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Album not found."
      })
    });
    return;
  }
  
  const tracksQuery = `
    SELECT t.id, t.title, at.track_number
    FROM album_tracks at
    LEFT JOIN tracks t ON at.track_id = t.id
    WHERE at.album_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
    ORDER BY at.track_number
  `;
  
  const tracks = await env.DB.prepare(tracksQuery).bind(albumId).all();
  
  let responseText = `💿 ALBUM: ${album.title}\n\n`;
  if (album.description) responseText += `${album.description}\n\n`;
  if (album.release_date) responseText += `📅 Release: ${album.release_date}\n`;
  if (album.genre) responseText += `🎸 Genre: ${album.genre}\n`;
  if (album.label) responseText += `🏷️ Label: ${album.label}\n\n`;
  responseText += `🎵 Tracklist:\n\n`;
  
  const buttons = [];
  
  if (tracks.results && tracks.results.length > 0) {
    tracks.results.forEach((track, index) => {
      const number = index + 1;
      responseText += `${number}. ${track.title}\n`;
      buttons.push([{ text: `🎵 ${track.title}`, callback_data: `track_${track.id}` }]);
    });
    buttons.push([{ text: "📀 Get All", callback_data: `getall_album_${albumId}` }]);
  } else {
    responseText += `No tracks found.`;
  }
  
  buttons.push([{ text: "❌", callback_data: "delete_message" }]);
  
  const keyboard = { inline_keyboard: buttons };
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: responseText,
      reply_markup: keyboard
    })
  });
}

export async function handleEp(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const epId = callbackQuery.data.replace("ep_", "");
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  const epQuery = `
    SELECT title, description, release_date, genre, label
    FROM eps
    WHERE id = ? AND deleted_at IS NULL AND status = 'published'
  `;
  const ep = await env.DB.prepare(epQuery).bind(epId).first();
  
  if (!ep) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "EP not found."
      })
    });
    return;
  }
  
  const tracksQuery = `
    SELECT t.id, t.title, et.track_number
    FROM ep_tracks et
    LEFT JOIN tracks t ON et.track_id = t.id
    WHERE et.ep_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
    ORDER BY et.track_number
  `;
  
  const tracks = await env.DB.prepare(tracksQuery).bind(epId).all();
  
  let responseText = `🎵 EP: ${ep.title}\n\n`;
  if (ep.description) responseText += `${ep.description}\n\n`;
  if (ep.release_date) responseText += `📅 Release: ${ep.release_date}\n`;
  if (ep.genre) responseText += `🎸 Genre: ${ep.genre}\n`;
  if (ep.label) responseText += `🏷️ Label: ${ep.label}\n\n`;
  responseText += `🎵 Tracklist:\n\n`;
  
  const buttons = [];
  
  if (tracks.results && tracks.results.length > 0) {
    tracks.results.forEach((track, index) => {
      const number = index + 1;
      responseText += `${number}. ${track.title}\n`;
      buttons.push([{ text: `🎵 ${track.title}`, callback_data: `track_${track.id}` }]);
    });
    buttons.push([{ text: "📀 Get All", callback_data: `getall_ep_${epId}` }]);
  } else {
    responseText += `No tracks found.`;
  }
  
  buttons.push([{ text: "❌", callback_data: "delete_message" }]);
  
  const keyboard = { inline_keyboard: buttons };
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: responseText,
      reply_markup: keyboard
    })
  });
}

export async function handlePlaylist(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const playlistId = callbackQuery.data.replace("playlist_", "");
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  const playlistQuery = `
    SELECT name, description
    FROM playlists
    WHERE id = ? AND deleted_at IS NULL AND status = 'published'
  `;
  const playlist = await env.DB.prepare(playlistQuery).bind(playlistId).first();
  
  if (!playlist) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Playlist not found."
      })
    });
    return;
  }
  
  const tracksQuery = `
    SELECT t.id, t.title, pt.position
    FROM playlist_tracks pt
    LEFT JOIN tracks t ON pt.track_id = t.id
    WHERE pt.playlist_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
    ORDER BY pt.position
  `;
  
  const tracks = await env.DB.prepare(tracksQuery).bind(playlistId).all();
  
  let responseText = `📋 PLAYLIST: ${playlist.name}\n\n`;
  if (playlist.description) responseText += `${playlist.description}\n\n`;
  responseText += `🎵 Tracks:\n\n`;
  
  const buttons = [];
  
  if (tracks.results && tracks.results.length > 0) {
    tracks.results.forEach((track, index) => {
      const number = index + 1;
      responseText += `${number}. ${track.title}\n`;
      buttons.push([{ text: `🎵 ${track.title}`, callback_data: `track_${track.id}` }]);
    });
    buttons.push([{ text: "📀 Get All", callback_data: `getall_playlist_${playlistId}` }]);
  } else {
    responseText += `No tracks found.`;
  }
  
  buttons.push([{ text: "❌", callback_data: "delete_message" }]);
  
  const keyboard = { inline_keyboard: buttons };
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: responseText,
      reply_markup: keyboard
    })
  });
}

export async function handleTrack(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const trackId = callbackQuery.data.replace("track_", "");
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  const trackQuery = `
    SELECT t.title, t.filename, a.name as artist_name
    FROM tracks t
    LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
    LEFT JOIN artists a ON ta.artist_id = a.id
    WHERE t.id = ? AND t.deleted_at IS NULL AND t.status = 'published'
  `;
  
  const track = await env.DB.prepare(trackQuery).bind(trackId).first();
  
  if (!track) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "❌ Track not found."
      })
    });
    return;
  }
  
  const audioUrl = `${CDN_URL}/${encodeURIComponent(track.filename)}`;
  const artistName = track.artist_name || "Unknown Artist";
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendAudio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      audio: audioUrl,
      title: track.title,
      performer: artistName,
      caption: `🎵 ${track.title}\n🎤 ${artistName}`
    })
  });
}

export async function handleGetAllAlbum(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const albumId = callbackQuery.data.replace("getall_album_", "");
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  const albumQuery = `
    SELECT title FROM albums WHERE id = ? AND deleted_at IS NULL AND status = 'published'
  `;
  const album = await env.DB.prepare(albumQuery).bind(albumId).first();
  
  const tracksQuery = `
    SELECT t.id, t.title, t.filename, a.name as artist_name
    FROM album_tracks at
    LEFT JOIN tracks t ON at.track_id = t.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
    LEFT JOIN artists a ON ta.artist_id = a.id
    WHERE at.album_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
    ORDER BY at.track_number
  `;
  
  const tracks = await env.DB.prepare(tracksQuery).bind(albumId).all();
  
  if (!tracks.results || tracks.results.length === 0) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "No tracks found in this album."
      })
    });
    return;
  }
  
  const totalTracks = tracks.results.length;
  const albumTitle = album ? album.title : "Album";
  
  const statusMsg = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `📀 Sending album "${albumTitle}": 0/${totalTracks}`
    })
  });
  const statusData = await statusMsg.json();
  const statusMessageId = statusData.result.message_id;
  
  for (let i = 0; i < totalTracks; i++) {
    const track = tracks.results[i];
    const audioUrl = `${CDN_URL}/${encodeURIComponent(track.filename)}`;
    const artistName = track.artist_name || "Unknown Artist";
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendAudio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        audio: audioUrl,
        title: track.title,
        performer: artistName,
        caption: `🎵 ${track.title}\n🎤 ${artistName}`
      })
    });
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: statusMessageId,
        text: `📀 Sending album "${albumTitle}": ${i+1}/${totalTracks}`
      })
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: statusMessageId
    })
  }).catch(() => {});
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `✅ Done! All ${totalTracks} tracks from "${albumTitle}" sent.`
    })
  });
}

export async function handleGetAllEp(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const epId = callbackQuery.data.replace("getall_ep_", "");
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  const epQuery = `
    SELECT title FROM eps WHERE id = ? AND deleted_at IS NULL AND status = 'published'
  `;
  const ep = await env.DB.prepare(epQuery).bind(epId).first();
  
  const tracksQuery = `
    SELECT t.id, t.title, t.filename, a.name as artist_name
    FROM ep_tracks et
    LEFT JOIN tracks t ON et.track_id = t.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
    LEFT JOIN artists a ON ta.artist_id = a.id
    WHERE et.ep_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
    ORDER BY et.track_number
  `;
  
  const tracks = await env.DB.prepare(tracksQuery).bind(epId).all();
  
  if (!tracks.results || tracks.results.length === 0) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "No tracks found in this EP."
      })
    });
    return;
  }
  
  const totalTracks = tracks.results.length;
  const epTitle = ep ? ep.title : "EP";
  
  const statusMsg = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `🎵 Sending EP "${epTitle}": 0/${totalTracks}`
    })
  });
  const statusData = await statusMsg.json();
  const statusMessageId = statusData.result.message_id;
  
  for (let i = 0; i < totalTracks; i++) {
    const track = tracks.results[i];
    const audioUrl = `${CDN_URL}/${encodeURIComponent(track.filename)}`;
    const artistName = track.artist_name || "Unknown Artist";
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendAudio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        audio: audioUrl,
        title: track.title,
        performer: artistName,
        caption: `🎵 ${track.title}\n🎤 ${artistName}`
      })
    });
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: statusMessageId,
        text: `🎵 Sending EP "${epTitle}": ${i+1}/${totalTracks}`
      })
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: statusMessageId
    })
  }).catch(() => {});
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `✅ Done! All ${totalTracks} tracks from "${epTitle}" sent.`
    })
  });
}

export async function handleGetAllPlaylist(callbackQuery, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const playlistId = callbackQuery.data.replace("getall_playlist_", "");
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  const playlistQuery = `
    SELECT name FROM playlists WHERE id = ? AND deleted_at IS NULL AND status = 'published'
  `;
  const playlist = await env.DB.prepare(playlistQuery).bind(playlistId).first();
  
  const tracksQuery = `
    SELECT t.id, t.title, t.filename, a.name as artist_name
    FROM playlist_tracks pt
    LEFT JOIN tracks t ON pt.track_id = t.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.is_primary = 1
    LEFT JOIN artists a ON ta.artist_id = a.id
    WHERE pt.playlist_id = ? AND t.deleted_at IS NULL AND t.status = 'published'
    ORDER BY pt.position
  `;
  
  const tracks = await env.DB.prepare(tracksQuery).bind(playlistId).all();
  
  if (!tracks.results || tracks.results.length === 0) {
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "No tracks found in this playlist."
      })
    });
    return;
  }
  
  const totalTracks = tracks.results.length;
  const playlistName = playlist ? playlist.name : "Playlist";
  
  const statusMsg = await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `📋 Sending playlist "${playlistName}": 0/${totalTracks}`
    })
  });
  const statusData = await statusMsg.json();
  const statusMessageId = statusData.result.message_id;
  
  for (let i = 0; i < totalTracks; i++) {
    const track = tracks.results[i];
    const audioUrl = `${CDN_URL}/${encodeURIComponent(track.filename)}`;
    const artistName = track.artist_name || "Unknown Artist";
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendAudio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        audio: audioUrl,
        title: track.title,
        performer: artistName,
        caption: `🎵 ${track.title}\n🎤 ${artistName}`
      })
    });
    
    await fetch(`${TELEGRAM_API(BOT_TOKEN)}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: statusMessageId,
        text: `📋 Sending playlist "${playlistName}": ${i+1}/${totalTracks}`
      })
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: statusMessageId
    })
  }).catch(() => {});
  
  await fetch(`${TELEGRAM_API(BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `✅ Done! All ${totalTracks} tracks from "${playlistName}" sent.`
    })
  });
}