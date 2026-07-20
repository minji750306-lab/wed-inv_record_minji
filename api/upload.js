import { put, head } from '@vercel/blob';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { dataUrl, name, code } = req.body || {};
    // 초대 코드 확인 (발급된 코드여야 업로드 가능)
    const codeUp = (code || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,20}$/.test(codeUp))
      return res.status(403).json({ error: '초대 코드를 먼저 입력해 주세요. (맨 위 항목)' });
    try { await head(`code/${codeUp}.json`); }
    catch (e) { return res.status(403).json({ error: '유효하지 않은 초대 코드예요.' }); }

    if (!dataUrl || !dataUrl.startsWith('data:image/'))
      return res.status(400).json({ error: '이미지 파일만 올릴 수 있어요.' });
    const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: '이미지 형식을 읽을 수 없어요.' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 4 * 1024 * 1024)
      return res.status(400).json({ error: '사진이 너무 커요 (4MB 이하).' });
    const ext = m[1] === 'image/png' ? 'png' : 'jpg';
    const safe = (name || 'photo').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'photo';
    const blob = await put(`img/${Date.now()}-${safe}.${ext}`, buf, {
      access: 'public', contentType: m[1]
    });
    return res.status(200).json({ url: blob.url });
  } catch (e) {
    return res.status(500).json({ error: '업로드 중 문제가 생겼어요.' });
  }
}
