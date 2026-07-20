import { put, head } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { slug, editKey, data, code } = req.body || {};
    if (!slug || !/^[a-z0-9-]{3,40}$/.test(slug))
      return res.status(400).json({ error: '주소는 영문 소문자·숫자·하이픈(-)만, 3~40자로 정해주세요.' });
    if (!editKey || editKey.length < 4)
      return res.status(400).json({ error: '수정 비밀번호는 4자 이상으로 정해주세요.' });
    if (!data || !data.groom || !data.bride || !data.date || !data.venue)
      return res.status(400).json({ error: '신랑·신부 이름, 날짜, 예식장은 필수예요.' });
    if (!data.deleteDate)
      return res.status(400).json({ error: '정보 삭제 희망일을 선택해 주세요.' });
    {
      const now = new Date();
      const max = new Date(); max.setMonth(max.getMonth() + 12);
      const del = new Date(data.deleteDate + 'T23:59:59+09:00');
      if (isNaN(del) || del < now || del > max)
        return res.status(400).json({ error: '삭제일은 오늘 이후부터 최대 12개월 이내로 정해주세요.' });
    }

    const path = `inv/${slug}.json`;

    // 기존 청첩장 확인
    let exists = null;
    try { exists = await head(path); } catch (e) { exists = null; }

    if (exists) {
      // ── 수정: 비밀번호만 확인, 삭제일은 최초값 고정, 코드 불필요 ──
      const prev = await (await fetch(exists.url)).json();
      if (prev.editKey !== editKey)
        return res.status(409).json({ error: '이미 사용 중인 주소예요. (본인 청첩장이면 처음 정한 수정 비밀번호를 입력하세요)' });
      if (prev.data && prev.data.deleteDate) data.deleteDate = prev.data.deleteDate;
      if (prev.code) data._code = prev.code;
      await put(path, JSON.stringify({ editKey, code: prev.code || null, data, updated: Date.now() }), {
        access: 'public', contentType: 'application/json',
        addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0
      });
      return res.status(200).json({ ok: true, slug, updated: true });
    }

    // ── 신규 생성: 초대 코드 필수 ──
    const codeUp = (code || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,20}$/.test(codeUp))
      return res.status(400).json({ error: '초대 코드를 입력해 주세요.' });
    let codeMeta = null;
    try { codeMeta = await head(`code/${codeUp}.json`); } catch (e) { codeMeta = null; }
    if (!codeMeta)
      return res.status(403).json({ error: '유효하지 않은 초대 코드예요.' });
    const codeData = await (await fetch(`${codeMeta.url}?t=${Date.now()}`)).json();
    if (codeData.usedBy)
      return res.status(403).json({ error: '이미 사용된 초대 코드예요.' });

    // 코드 사용 처리 + 청첩장 저장
    await put(`code/${codeUp}.json`, JSON.stringify({ ...codeData, usedBy: slug, usedAt: Date.now() }), {
      access: 'public', contentType: 'application/json',
      addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0
    });
    await put(path, JSON.stringify({ editKey, code: codeUp, data, updated: Date.now() }), {
      access: 'public', contentType: 'application/json',
      addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0
    });
    return res.status(200).json({ ok: true, slug, updated: false });
  } catch (e) {
    return res.status(500).json({ error: '저장 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.' });
  }
}
