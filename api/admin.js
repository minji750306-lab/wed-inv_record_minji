import { put, head, list } from '@vercel/blob';

function newCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return 'MJ-' + c;
}

export default async function handler(req, res) {
  try {
    const key = req.headers['x-admin-key'] || (req.body && req.body.key) || req.query.key || '';
    if (!process.env.ADMIN_KEY)
      return res.status(500).json({ error: 'ADMIN_KEY 환경변수가 설정되지 않았어요. Vercel Settings에서 추가해 주세요.' });
    if (key !== process.env.ADMIN_KEY)
      return res.status(403).json({ error: '관리자 비밀번호가 올바르지 않아요.' });

    const action = (req.query.action || (req.body && req.body.action) || '').toString();

    if (action === 'issue') {
      let code = newCode();
      for (let i = 0; i < 5; i++) {
        let dup = null;
        try { dup = await head(`code/${code}.json`); } catch (e) { dup = null; }
        if (!dup) break;
        code = newCode();
      }
      await put(`code/${code}.json`, JSON.stringify({ issuedAt: Date.now(), usedBy: null }), {
        access: 'public', contentType: 'application/json',
        addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge: 0
      });
      return res.status(200).json({ ok: true, code });
    }

    if (action === 'list') {
      const { blobs } = await list({ prefix: 'code/' });
      const items = [];
      for (const b of blobs) {
        try {
          const d = await (await fetch(`${b.url}?t=${Date.now()}`)).json();
          items.push({
            code: b.pathname.replace('code/', '').replace('.json', ''),
            issuedAt: d.issuedAt || null,
            usedBy: d.usedBy || null,
            usedAt: d.usedAt || null
          });
        } catch (e) {}
      }
      items.sort((a, b) => (b.issuedAt || 0) - (a.issuedAt || 0));
      return res.status(200).json({ ok: true, items });
    }

    return res.status(400).json({ error: 'action은 issue 또는 list' });
  } catch (e) {
    return res.status(500).json({ error: '처리 중 문제가 생겼어요.' });
  }
}
