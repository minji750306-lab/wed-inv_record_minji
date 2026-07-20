import { head } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    const slug = (req.query.id || '').toLowerCase();
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) return res.status(400).json({ error: 'bad id' });
    let meta;
    try { meta = await head(`inv/${slug}.json`); }
    catch (e) { return res.status(404).json({ error: 'not found' }); }
    const saved = await (await fetch(`${meta.url}?t=${Date.now()}`)).json();
    if (saved.data && saved.data.deleteDate && new Date(saved.data.deleteDate + 'T23:59:59+09:00') < new Date())
      return res.status(404).json({ error: 'expired' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(saved.data);
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
}
