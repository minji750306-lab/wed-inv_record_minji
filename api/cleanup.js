import { list, del } from '@vercel/blob';

async function delPrefix(prefix) {
  try {
    const { blobs } = await list({ prefix });
    for (const b of blobs) { try { await del(b.url); } catch (e) {} }
  } catch (e) {}
}

export default async function handler(req, res) {
  try {
    const now = new Date();
    let deleted = 0;
    const { blobs } = await list({ prefix: 'inv/' });
    for (const b of blobs) {
      try {
        const saved = await (await fetch(`${b.url}?t=${Date.now()}`)).json();
        const d = saved.data || {};
        if (!d.deleteDate) continue;
        if (new Date(d.deleteDate + 'T23:59:59+09:00') >= now) continue;
        const urls = [d.hero, ...(d.gallery || [])].filter(Boolean);
        for (const u of urls) { try { await del(u); } catch (e) {} }
        const slug = b.pathname.replace(/^inv\//, '').replace(/\.json$/, '');
        await delPrefix(`rsvp/${slug}/`);
        await delPrefix(`snap/${slug}/`);
        await del(b.url);
        deleted++;
      } catch (e) {}
    }
    return res.status(200).json({ ok: true, deleted });
  } catch (e) {
    return res.status(500).json({ error: 'cleanup failed' });
  }
}
