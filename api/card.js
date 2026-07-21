import { head } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export default async function handler(req, res) {
  try {
    const slug = (req.query.slug || '').toLowerCase();
    let html = fs.readFileSync(path.resolve(process.cwd(), 'i.html'), 'utf8');

    if (/^[a-z0-9-]{3,40}$/.test(slug)) {
      let data = null;
      try {
        const meta = await head(`inv/${slug}.json`);
        const saved = await (await fetch(`${meta.url}?t=${Date.now()}`)).json();
        const notExpired = !(saved.data && saved.data.deleteDate && new Date(saved.data.deleteDate + 'T23:59:59+09:00') < new Date());
        if (notExpired) data = saved.data;
      } catch (e) { data = null; }

      if (data) {
        const title = `${data.groom} ♥ ${data.bride} 결혼합니다`;
        const desc = (data.ogDesc || data.lead || data.msg || '저희 두 사람의 결혼식에 초대합니다.')
          .replace(/\s+/g, ' ').trim().slice(0, 90);
        const image = data.ogImage || data.hero || '';
        const proto = req.headers['x-forwarded-proto'] || 'https';
        const url = `${proto}://${req.headers.host}/${slug}`;

        const ogTags = `
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary_large_image">
`;
        html = html.replace(
          '<title>모바일 청첩장</title>',
          `<title>${esc(title)}</title>\n${ogTags}`
        );
      }
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (e) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send('<h1>오류가 발생했어요</h1>');
  }
}
