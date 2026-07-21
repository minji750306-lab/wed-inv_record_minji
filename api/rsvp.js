import { put, list, head } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const { slug, name, side, attend, guests, phone, msg } = req.body || {};
      const s = (slug || '').toLowerCase();
      if (!/^[a-z0-9-]{3,40}$/.test(s))
        return res.status(400).json({ error: '잘못된 접근이에요.' });
      if (!name || !name.trim())
        return res.status(400).json({ error: '성함을 입력해 주세요.' });
      if (attend !== 'yes' && attend !== 'no')
        return res.status(400).json({ error: '참석 여부를 선택해 주세요.' });
      try { await head(`inv/${s}.json`); }
      catch (e) { return res.status(404).json({ error: '청첩장을 찾을 수 없어요.' }); }

      const rec = {
        name: name.trim().slice(0, 40),
        side: (side || '').slice(0, 10),
        attend,
        guests: Math.max(1, Math.min(20, parseInt(guests) || 1)),
        phone: (phone || '').replace(/[^0-9-]/g, '').slice(0, 20),
        msg: (msg || '').slice(0, 200),
        at: Date.now()
      };
      const key = `rsvp/${s}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
      await put(key, JSON.stringify(rec), {
        access: 'public', contentType: 'application/json',
        addRandomSuffix: false, cacheControlMaxAge: 0
      });
      return res.status(200).json({ ok: true });
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

      const { blobs } = await list({ prefix: `rsvp/${s}/` });
      const items = [];
      for (const b of blobs) {
        try { items.push(await (await fetch(`${b.url}?t=${Date.now()}`)).json()); }
        catch (e) {}
      }
      items.sort((a, b) => (b.at || 0) - (a.at || 0));
      return res.status(200).json({ ok: true, items });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: '처리 중 문제가 생겼어요.' });
  }
}
