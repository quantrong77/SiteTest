// Nhập đặc tính từ hóa biến dòng chân sứ từ file XML OMICRON CPC 100 (card nType = 8, "Excitation").
// Trích điểm khuỷu (U_k, I_k) và các mốc 25 %, 50 %, 75 %. Khuỷu theo IEC 61869-2: tăng U 10 % thì I tăng 50 %;
// ưu tiên khuỷu do CPC 100 tính, máy không báo thì tính theo định nghĩa trên đường cong đo (nội suy log–log).
// Có khuỷu: mốc theo % U_k. Không xác định được khuỷu: mốc theo % U lớn nhất đã đo.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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

  // ---------------------------------------------------------------- giao diện nhập
  const SIDES = { hv: 'Cao áp (HV)', mv: 'Trung áp (MV)', n: 'Trung tính (N)', lv: 'Hạ áp (LV)' };
  const PHASES = { hv: ['A', 'B', 'C'], mv: ['A', 'B', 'C'], n: ['N'], lv: ['a', 'b', 'c'] };
  const MAXCORE = { hv: 6, mv: 5, n: 3, lv: 4 }; // số cuộn tối đa template hỗ trợ
  let files = [];
  let locked = null; // { side, phase } khi tải XML cho một ô pha cụ thể

  function open(fileList, target) {
    locked = target || null;
    const jobs = Array.from(fileList).map(f => f.text().then(t => parse(t, f.name)).catch(e => ({ error: e.message, file: f.name })));
    Promise.all(jobs).then(list => {
      files = list.filter(x => !x.error);
      list.filter(x => x.error).forEach(x => Notify.show({ type: 'error', msg: x.error }));
      if (!files.length) return;
      assignSides(files);
      if (locked) files.forEach(f => { f.side = locked.side; f.phase = locked.phase; });
      files.forEach(f => f.cards.forEach(c => { c.use = c.status !== 'empty' && c.core <= MAXCORE[f.side]; }));
      render();
      $('#cpcDialog').showModal();
    });
  }

  function render() {
    let h = `<div class="ad-body cpc"><h2 id="cpcTitle">Nhập đặc tính từ hóa từ CPC 100</h2>
      <p class="ad-lead">Mỗi cuộn lấy <b>mốc 25 %, 50 %, 75 %</b> và <b>điểm khuỷu</b> (IEC 61869-2: +10 % áp → +50 % dòng). Có khuỷu thì mốc tính theo % U<sub>k</sub>; không xác định được khuỷu thì theo % U lớn nhất đã đo.${locked ? '' : ' Kiểm tra phía và pha của từng file trước khi điền.'}</p>`;
    files.forEach((f, fi) => {
      h += `<section class="cpc-file"><div class="cpc-file-head"><b>${esc(f.file)}</b><span>${esc(f.date)}</span>
        <label>Phía <select data-cpc="side" data-f="${fi}" ${locked ? 'disabled' : ''}>${Object.entries(SIDES).map(([k, t]) => `<option value="${k}" ${k === f.side ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>Pha <select data-cpc="phase" data-f="${fi}" ${locked ? 'disabled' : ''}>${PHASES[f.side].map(p => `<option ${p === f.phase ? 'selected' : ''}>${p}</option>`).join('')}</select></label></div>
        <table class="ftable cpc-tbl"><thead><tr><th></th><th>Cuộn</th><th>Mốc 25 %</th><th>Mốc 50 %</th><th>Mốc 75 %</th><th>Khuỷu (U<sub>k</sub>, I<sub>k</sub>)</th><th>Ghi chú</th></tr></thead><tbody>`;
      f.cards.forEach((c, ci) => {
        const over = c.core > MAXCORE[f.side];
        const pt = p => (p ? `${fmt(p.v, 1)} V<br><span>${fmt(p.i * 1000, 3)} mA</span>` : '—');
        h += `<tr class="${c.status === 'empty' ? 'muted' : ''}"><td><input type="checkbox" data-cpc="use" data-f="${fi}" data-c="${ci}" ${c.use ? 'checked' : ''} ${c.status === 'empty' || over ? 'disabled' : ''} aria-label="Điền cuộn ${esc(c.name)}"></td>
          <td><b>${esc(c.name)}</b><br><span>${c.points.length} điểm</span></td>
          <td class="num">${pt(c.picks[0])}</td><td class="num">${pt(c.picks[1])}</td><td class="num">${pt(c.picks[2])}</td><td class="num knee">${pt(c.picks[3])}</td>
          <td class="note">${over ? `Template phía này chỉ có ${MAXCORE[f.side]} cuộn` : esc(c.how)}${c.status === 'app' ? ' <span class="badge st-warn">kiểm tra</span>' : ''}</td></tr>`;
      });
      h += '</tbody></table></section>';
    });
    h += `<div class="row-actions" style="justify-content:flex-end"><button class="btn" data-cpc="cancel">Hủy</button><button class="btn primary" data-cpc="apply">Điền vào biểu mẫu</button></div></div>`;
    $('#cpcPanel').innerHTML = h;
  }

  function apply() {
    const st = App.state, need = {};
    const filled = [];
    files.forEach(f => f.cards.forEach(c => {
      if (!c.use || !c.picks.length) return;
      if (f.side === 'hv' || f.side === 'mv') need[f.side] = Math.max(need[f.side] || 0, c.core);
    }));
    // Hiện thêm cuộn 5, 6 nếu file có
    let rebuilt = false;
    ['hv', 'mv'].forEach(side => {
      const cur = +st.cfg.bctCores[side];
      if (need[side] > cur) { st.cfg.bctCores[side] = Math.min(need[side], MAXCORE[side]); rebuilt = true; }
    });
    files.forEach(f => f.cards.forEach(c => {
      if (!c.use || !c.picks.length) return;
      const g = f.side === 'n' ? 'bct.n.ex.N' : `bct.${f.side}.ex.${f.phase}`;
      [0, 1, 2, 3].forEach(k => { // xóa giá trị cũ (vd cột khuỷu khi lần này không xác định được khuỷu)
        const p = c.picks[k];
        st.v[`${g}.w${c.core}u.p${k + 1}`] = p ? p.v.toFixed(1) : '';
        st.v[`${g}.w${c.core}i.p${k + 1}`] = p ? (p.i * 1000).toFixed(3) : '';
      });
      st.v[`${g}.src.w${c.core}`] = `${f.file} · ${c.name} · ${c.how}`;
      // đầu cuộn thực đo ghi vào ô nhãn BBTN; cuộn không xác định được khuỷu ghi rõ mốc theo % U max
      st.v[`${g}.tap.w${c.core}`] = c.name + (c.status === 'noknee' ? ' (mốc theo % U max)' : '');
      filled.push(`${SIDES[f.side]} ${f.phase} · ${c.name}`);
    }));
    $('#cpcDialog').close();
    App.rebuild(rebuilt);
    Notify.show({ type: 'success', title: `Đã điền ${filled.length} cuộn từ ${files.length} file CPC 100`,
      msg: rebuilt ? `Đã mở thêm cuộn thứ cấp: HV ${st.cfg.bctCores.hv}, MV ${st.cfg.bctCores.mv}.` : 'Xem lại các ô đặc tính từ hóa trong mục 11.' });
  }

  document.addEventListener('change', e => {
    const t = e.target;
    if (!t.dataset || !t.dataset.cpc) return;
    const f = files[+t.dataset.f];
    if (t.dataset.cpc === 'side') { f.side = t.value; f.phase = PHASES[f.side][0]; f.cards.forEach(c => { c.use = c.status !== 'empty' && c.core <= MAXCORE[f.side]; }); render(); }
    if (t.dataset.cpc === 'phase') f.phase = t.value;
    if (t.dataset.cpc === 'use') f.cards[+t.dataset.c].use = t.checked;
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-cpc]');
    if (!b || b.tagName !== 'BUTTON') return;
    if (b.dataset.cpc === 'cancel') $('#cpcDialog').close();
    if (b.dataset.cpc === 'apply') apply();
  });

  window.CpcImport = { parse, kneeIEC, iAt, open, guess, assignSides, pick, LEVELS };
})();
