// Bộ đọc file XML OMICRON CPC 100: đặc tính từ hóa (card nType = 8, "Excitation").
// Trích điểm khuỷu (U_k, I_k) và các mốc 25 %, 50 %, 75 %. Khuỷu theo IEC 61869-2: tăng U 10 % thì I tăng 50 %;
// ưu tiên khuỷu do CPC 100 tính, máy không báo thì tính theo định nghĩa trên đường cong đo (nội suy log–log).
// Có khuỷu: mốc theo % U_k. Không xác định được khuỷu: mốc theo % U lớn nhất đã đo.
(function () {
  'use strict';
  const ok = Number.isFinite;

  // ---------------------------------------------------------------- đọc XML
  const kidsByName = (el, name) => Array.from(el.children).filter(c => c.localName === name);
  const kid = (el, name) => (el ? kidsByName(el, name)[0] : null);
  const text = (el, name) => { const k = kid(el, name); return k ? k.textContent.trim() : ''; };
  const dval = (el, name) => { const k = kid(kid(el, name), 'dValue'); const n = k ? Number(k.textContent) : NaN; return ok(n) ? n : NaN; };

  function parse(xml, fileName) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error(`${fileName}: không đọc được XML`);
    const root = doc.documentElement;
    const cardsEl = kid(root, 'Cards');
    if (!cardsEl) throw new Error(`${fileName}: không phải file XML xuất từ CPC 100 (thiếu Cards)`);
    const cards = [];
    kidsByName(cardsEl, 'Cards_Item').forEach(c => {
      if (text(c, 'nType') !== '8') return; // chỉ card đặc tính từ hóa
      const name = text(c, 'bstrName');
      const res = kid(c, 'Results');
      const raw = res ? kidsByName(res, 'Results_Item').map(it => ({ v: dval(it, 'V'), i: dval(it, 'I') })) : [];
      const pts = monotone(raw);
      const core = parseInt((name.match(/^(\d+)S/i) || [])[1], 10);
      const card = { name, core, points: pts, nRaw: raw.length };
      const vk = dval(c, 'Vknee'), ik = dval(c, 'Iknee');
      card.cpcKnee = text(c, 'bHasKneePoint') === '1' && ok(vk) && ok(ik) ? { v: vk, i: ik } : null;
      Object.assign(card, pick(card));
      cards.push(card);
    });
    return { file: fileName, device: text(root, 'Device'), date: text(root, 'DateTime'), path: text(root, 'Filename'), cards, guess: guess(fileName) };
  }

  // Sắp theo U tăng, bỏ điểm không đơn điệu (nhiễu ở đầu đường cong)
  function monotone(raw) {
    const s = raw.filter(p => p.v > 0 && p.i > 0).sort((a, b) => a.v - b.v);
    const out = [];
    s.forEach(p => { if (!out.length || (p.v > out[out.length - 1].v && p.i >= out[out.length - 1].i)) out.push(p); });
    return out;
  }

  // I(U) nội suy log–log trên đường cong đo
  function iAt(pts, v) {
    if (v <= pts[0].v) return pts[0].i;
    if (v >= pts[pts.length - 1].v) return pts[pts.length - 1].i;
    let k = 0;
    while (pts[k + 1].v < v) k++;
    const a = pts[k], b = pts[k + 1];
    const t = (Math.log(v) - Math.log(a.v)) / (Math.log(b.v) - Math.log(a.v));
    return Math.exp(Math.log(a.i) + t * (Math.log(b.i) - Math.log(a.i)));
  }

  // Điểm gối IEC: U nhỏ nhất mà I(1,1·U) ≥ 1,5·I(U)
  function kneeIEC(pts) {
    if (pts.length < 4) return null;
    const vmin = pts[0].v, vmax = pts[pts.length - 1].v / 1.1;
    if (vmax <= vmin) return null;
    const N = 4000, ratio = v => iAt(pts, 1.1 * v) / iAt(pts, v);
    let prev = null;
    for (let n = 0; n <= N; n++) {
      const v = vmin * Math.pow(vmax / vmin, n / N);
      if (ratio(v) >= 1.5) {
        if (prev === null) return null; // ngay từ đầu đã ≥ 1,5: không phải vùng gối
        let lo = prev, hi = v;
        for (let k = 0; k < 60; k++) { const m = Math.sqrt(lo * hi); if (ratio(m) >= 1.5) hi = m; else lo = m; }
        return { v: hi, i: iAt(pts, hi) };
      }
      prev = v;
    }
    return null;
  }

  // 4 giá trị mỗi cuộn: mốc 25 %, 50 %, 75 % và điểm khuỷu.
  // Có điểm khuỷu → mốc theo % U_k; không xác định được khuỷu → mốc theo % U lớn nhất đã đo (cột khuỷu để trống).
  const LEVELS = [0.25, 0.5, 0.75];
  function pick(card) {
    const pts = card.points;
    if (pts.length < 2) return { knee: null, picks: [], how: 'Cuộn không có số liệu đo', status: 'empty', basis: '' };
    const app = kneeIEC(pts);
    const knee = card.cpcKnee ? Object.assign({ src: 'CPC 100' }, card.cpcKnee) : app ? Object.assign({ src: 'tính theo IEC' }, app) : null;
    if (knee) {
      const picks = LEVELS.map(f => ({ v: f * knee.v, i: iAt(pts, f * knee.v) })).concat([{ v: knee.v, i: knee.i, knee: true }]);
      const how = card.cpcKnee
        ? `Khuỷu U_k = ${fmt(knee.v, 1)} V / ${fmt(knee.i * 1000, 3)} mA do CPC 100 tính${app ? ` (app tính lại theo IEC: ${fmt(app.v, 1)} V)` : ''}; mốc 25/50/75 % U_k`
        : `CPC 100 không báo khuỷu; app tính theo IEC 61869-2: U_k = ${fmt(knee.v, 1)} V / ${fmt(knee.i * 1000, 3)} mA — nên kiểm tra lại; mốc 25/50/75 % U_k`;
      return { knee, picks, how, status: card.cpcKnee ? 'cpc' : 'app', basis: '% U_k' };
    }
    const vmax = pts[pts.length - 1].v;
    return { knee: null, picks: LEVELS.map(f => ({ v: f * vmax, i: iAt(pts, f * vmax) })),
      how: `Không xác định được điểm khuỷu trong dải đo (U lớn nhất ${fmt(vmax, 1)} V) — mốc 25/50/75 % theo U lớn nhất đã đo`, status: 'noknee', basis: '% U max' };
  }

  const fmt = (x, d) => (ok(x) ? x.toFixed(d).replace('.', ',') : '—');

  // Đoán phía & pha từ tên file: "PHA A 220", "PHA a 22", "PHA N"
  function guess(fileName) {
    const base = fileName.replace(/\.xml$/i, '');
    const ph = (base.match(/PHA\s*([ABCNabc])\b/i) || base.match(/\b([ABCNabc])\b/) || [])[1] || '';
    const kv = Number((base.match(/(\d{2,3})\s*(kV)?\s*$/i) || [])[1]);
    return { phase: ph, kv: ok(kv) ? kv : null };
  }

  // Gán phía theo cả nhóm file: N → trung tính; chữ thường/≤35 kV → hạ áp; cấp cao nhất → cao áp; còn lại → trung áp
  function assignSides(files) {
    const kvs = [...new Set(files.map(f => f.guess.kv).filter(v => v && v > 35))].sort((a, b) => b - a);
    files.forEach(f => {
      const g = f.guess;
      if (/^N$/i.test(g.phase) && !/[abc]/.test(g.phase)) { f.side = 'n'; f.phase = 'N'; return; }
      if (/^[abc]$/.test(g.phase) || (g.kv && g.kv <= 35)) { f.side = 'lv'; f.phase = (g.phase || 'a').toLowerCase(); return; }
      f.side = g.kv && kvs.length > 1 && g.kv !== kvs[0] ? 'mv' : 'hv';
      f.phase = (g.phase || 'A').toUpperCase();
    });
  }

  window.Cpc100 = { parse, monotone, kneeIEC, iAt, pick, LEVELS, guess, assignSides };
})();
