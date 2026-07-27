import { list, del, head } from '@vercel/blob';

/*
  📄 api/delete.js — 커플 셀프 삭제
  주소(slug) + 수정 비밀번호가 모두 맞을 때만 아래를 전부 지웁니다.
    · 청첩장 본문      inv/{slug}.json
    · 표지·갤러리·공유 미리보기 사진
    · 참석 여부 응답   rsvp/{slug}/*
    · 게스트 스냅 사진 snap/{slug}/*
  비밀번호가 틀리면 아무것도 지우지 않고 403을 돌려줍니다.
  비밀번호는 서버에 저장된 값과 대조만 하며, 운영자도 원문을 알 수 없기 때문에
  비밀번호를 잊으면 이 기능으로 삭제할 수 없습니다.
*/

async function delPrefix(prefix) {
  let n = 0;
  try {
    const { blobs } = await list({ prefix });
    for (const b of blobs) {
      try { await del(b.url); n++; } catch (e) {}
    }
  } catch (e) {}
  return n;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { slug, editKey } = req.body || {};
    const s = (slug || '').toLowerCase().trim();

    if (!/^[a-z0-9-]{3,40}$/.test(s))
      return res.status(400).json({ error: '청첩장 주소를 다시 확인해 주세요.' });
    if (!editKey)
      return res.status(400).json({ error: '수정 비밀번호를 입력해 주세요.' });

    const path = `inv/${s}.json`;
    let meta;
    try { meta = await head(path); }
    catch (e) { return res.status(404).json({ error: '그 주소의 청첩장을 찾을 수 없어요. 이미 삭제되었을 수도 있어요.' }); }

    const saved = await (await fetch(`${meta.url}?t=${Date.now()}`)).json();

    // ── 비밀번호가 맞지 않으면 여기서 중단 (아무것도 삭제되지 않음) ──
    if (!saved.editKey || saved.editKey !== editKey)
      return res.status(403).json({ error: '수정 비밀번호가 올바르지 않아요. 아무것도 삭제되지 않았어요.' });

    const d = saved.data || {};
    let photos = 0;

    // 1) 표지 · 갤러리 · 링크 공유 미리보기 사진
    const urls = [d.hero, d.ogImage, ...(d.gallery || [])].filter(Boolean);
    for (const u of urls) {
      try { await del(u); photos++; } catch (e) {}
    }

    // 2) 참석 여부 응답 · 게스트 스냅 사진
    const rsvpCount = await delPrefix(`rsvp/${s}/`);
    const snapCount = await delPrefix(`snap/${s}/`);

    // 3) 청첩장 본문은 마지막에 (중간에 실패하면 다시 시도할 수 있도록)
    await del(meta.url);

    return res.status(200).json({ ok: true, photos, rsvp: rsvpCount, snap: snapCount });
  } catch (e) {
    return res.status(500).json({ error: '삭제 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' });
  }
}
