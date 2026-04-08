// Store deep link requests with expiry
const deepLinkRequests = new Map();

export function storeDeepLink(requestId, userId, trackData, expirySeconds = 600) {
  const expiresAt = Date.now() + (expirySeconds * 1000);
  deepLinkRequests.set(requestId, {
    userId: userId,
    trackData: trackData,
    expiresAt: expiresAt
  });
  
  // Auto-cleanup after expiry
  setTimeout(() => {
    deepLinkRequests.delete(requestId);
  }, expirySeconds * 1000);
  
  return requestId;
}

export function getDeepLink(requestId) {
  const request = deepLinkRequests.get(requestId);
  if (!request) return null;
  if (Date.now() > request.expiresAt) {
    deepLinkRequests.delete(requestId);
    return null;
  }
  return request;
}

export function generateDeepLink(botUsername, requestId) {
  return `https://t.me/${botUsername}?start=${requestId}`;
}