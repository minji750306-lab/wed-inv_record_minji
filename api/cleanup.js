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
    let snapCleaned = 0;
    const { blobs } = await list({ prefix: 'inv/' });
    for (const b of blobs) {
      try {
        const saved = await (await fetch(`${b.url}?t=${Date.now()}`)).json();
        const d = saved.data || {};
        const slug = b.pathname.replace(/^inv\//, '').replace(/\.json$/, '');

        // ── 게스트 스냅: 예식일 + 14일 지나면 사진만 삭제 ──
        if (d.date) {
          const snapLimit = new Date(d.date + 'T23:59:59+09:00');
          if (!isNaN(snapLimit)) {
            snapLimit.setDate(snapLimit.getDate() + 14);
            if (snapLimit < now) {
              await delPrefix(`snap/${slug}/`);
              snapCleaned++;
            }
          }
        }

        // ── 청첩장 전체: 삭제 희망일 지나면 모두 삭제 (기존 기능) ──
        if (!d.deleteDate) continue;
        if (new Date(d.deleteDate + 'T23:59:59+09:00') >= now) continue;
        const urls = [d.hero, ...(d.gallery || [])].filter(Boolean);
        for (const u of urls) { try { await del(u); } catch (e) {} }
        await delPrefix(`rsvp/${slug}/`);
        await delPrefix(`snap/${slug}/`);
        await del(b.url);
        deleted++;
      } catch (e) {}
    }
    return res.status(200).json({ ok: true, deleted, snapCleaned });
  } catch (e) {
    return res.status(500).json({ error: 'cleanup failed' });
  }
}
