import { put, list, head } from '@vercel/blob';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const { slug, dataUrl, name } = req.body || {};
      const s = (slug || '').toLowerCase();
      if (!/^[a-z0-9-]{3,40}$/.test(s))
        return res.status(400).json({ error: '잘못된 접근이에요.' });
      try { await head(`inv/${s}.json`); }
      catch (e) { return res.status(404).json({ error: '청첩장을 찾을 수 없어요.' }); }

      if (!dataUrl || !dataUrl.startsWith('data:image/'))
        return res.status(400).json({ error: '이미지 파일만 올릴 수 있어요.' });
      const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
      if (!m) return res.status(400).json({ error: '이미지 형식을 읽을 수 없어요.' });
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 4 * 1024 * 1024)
        return res.status(400).json({ error: '사진이 너무 커요 (4MB 이하).' });
      const ext = m[1] === 'image/png' ? 'png' : 'jpg';
      const safe = (name || 'photo').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'photo';
      const blob = await put(
        `snap/${s}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}.${ext}`,
        buf,
        { access: 'public', contentType: m[1] }
      );
      return res.status(200).json({ ok: true, url: blob.url });
    }

    if (req.method === 'GET') {
      const s = (req.query.slug || '').toLowerCase();
      const editKey = req.query.editKey || '';
      if (!/^[a-z0-9-]{3,40}$/.test(s)) return res.status(400).json({ error: '잘못된 접근이에요.' });
      let meta;
      try { meta = await head(`inv/${s}.json`); }
      catch (e) { return res.status(404).json({ error: '청첩장을 찾을 수 없어요.' }); }
      const inv = await (await fetch(`${meta.url}?t=${Date.now()}`)).json();
      if (!editKey || inv.editKey !== editKey)
        return res.status(403).json({ error: '수정 비밀번호가 올바르지 않아요.' });

      const { blobs } = await list({ prefix: `snap/${s}/` });
      blobs.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
      return res.status(200).json({
        ok: true,
        items: blobs.map(b => ({ url: b.url, name: b.pathname.split('/').pop() }))
      });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: '처리 중 문제가 생겼어요.' });
  }
}
