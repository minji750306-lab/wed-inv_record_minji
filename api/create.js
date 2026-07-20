import { put, head } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { slug, editKey, data } = req.body || {};
    if (!slug || !/^[a-z0-9-]{3,40}$/.test(slug))
      return res.status(400).json({ error: '주소는 영문 소문자·숫자·하이픈(-)만, 3~40자로 정해주세요.' });
    if (!editKey || editKey.length < 4)
      return res.status(400).json({ error: '수정 비밀번호는 4자 이상으로 정해주세요.' });
    if (!data || !data.groom || !data.bride || !data.date || !data.venue)
      return res.status(400).json({ error: '신랑·신부 이름, 날짜, 예식장은 필수예요.' });
    if (!data.deleteDate)
      return res.status(400).json({ error: '정보 삭제 희망일을 선택해 주세요.' });
    {
      const w = new Date(data.date + 'T00:00:00+09:00');
      const min = new Date(w); min.setDate(min.getDate() + 1);
      const max = new Date(w); max.setMonth(max.getMonth() + 12);
      const del = new Date(data.deleteDate + 'T00:00:00+09:00');
      if (isNaN(del) || del < min || del > max)
        return res.status(400).json({ error: '삭제일은 예식일 다음날부터 최대 12개월 이내로 정해주세요.' });
    }

    const path = `inv/${slug}.json`;

    // 이미 있는 주소면 비밀번호가 맞을 때만 덮어쓰기(수정) 허용
    let exists = null;
    try { exists = await head(path); } catch (e) { exists = null; }
    if (exists) {
      const prev = await (await fetch(exists.url)).json();
      if (prev.editKey !== editKey)
        return res.status(409).json({ error: '이미 사용 중인 주소예요. (본인 청첩장이면 처음 정한 수정 비밀번호를 입력하세요)' });
    }

    await put(path, JSON.stringify({ editKey, data, updated: Date.now() }), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0
    });

    return res.status(200).json({ ok: true, slug, updated: !!exists });
  } catch (e) {
    return res.status(500).json({ error: '저장 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.' });
  }
}
