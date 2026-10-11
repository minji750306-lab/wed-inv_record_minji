// Never include editor credentials in public API responses or HTML.
export function publicInvitation(data) {
  const { editKey, inviteCode, _code, code, ...publicData } = data || {};
  return publicData;
}

export function cacheSeconds(data, now = Date.now()) {
  if (!data?.deleteDate) return 60;
  const expires = Date.parse(data.deleteDate + 'T23:59:59+09:00');
  if (!Number.isFinite(expires)) return 0;
  return Math.max(0, Math.min(60, Math.floor((expires - now) / 1000)));
}

export function setPublicCache(res, data) {
  // Keep browsers fresh; share only sanitized public responses at Vercel's edge.
  res.setHeader('Cache-Control', 'no-store');
  const seconds = cacheSeconds(data);
  res.setHeader('Vercel-CDN-Cache-Control', seconds ? `public, s-maxage=${seconds}` : 'no-store');
}

export function serializeInvitation(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
