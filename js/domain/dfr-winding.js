// DFR cách điện cuộn dây (mục độ ẩm cách điện rắn): phép đo CHL / CLT / CHT đọc từ CSV DIRANA, chọn lần đo đại diện,
// dựng phụ lục BBTN. MBA 3 cuộn dây: CHL, CLT; MBA tự ngẫu (tổ 3 máy 1 pha rời hoặc 3 pha chung vỏ): CHT.
// Có phép đo nào thì trình bày phép đo đó; chỉ trình bày số liệu đo, không đánh giá đạt / không đạt.
// Số liệu ở state.att.dfrw.items: { id, name, date, temp, file, ins, phase, f[], tan[] (%), c[] (pF), use, insManual, phaseManual, useManual }
(function () {
  'use strict';
  const INS = ['CHL', 'CLT', 'CHT'];
  const INS_TEXT = { CHL: 'CHL (cao áp – hạ áp)', CLT: 'CLT (hạ áp – vỏ)', CHT: 'CHT (cao áp – vỏ)' };
  const PHASES = ['A', 'B', 'C'];
  const dateKey = s => (window.Dfr ? Dfr.dateKey(s) : String(s || ''));

  // Loại cách điện theo tên phép đo (vd "CHL", "CHT_A", "CHT pha B")
  function insOf(name) {
    const m = String(name || '').toUpperCase().match(/(?:^|[^A-Z])(CHL|CLT|CHT)(?![A-Z])/);
    return m ? m[1] : '';
  }
  // Pha ghi cuối tên phép đo hoặc tên file (vd "CHT_A", "CHT pha B", "AT1_C.csv"); không có thì rỗng
  function phaseIn(text) {
    const m = String(text || '').replace(/\.[a-z0-9]+$/i, '').match(/(?:^|[\s_\-.])(?:pha|phase)?[\s_\-]*([ABC])$/i);
    return m ? m[1].toUpperCase() : '';
  }
  // Pha mặc định khi tên không ghi pha: BBTN theo pha (template A/B/C) → pha đó; tổ 3 máy 1 pha → khớp số chế tạo; còn lại rỗng (3 pha)
  function defaultPhase(m, cfg) {
    const c = cfg || {}, own = phaseIn(m.name) || phaseIn(m.file);
    if (own) return own;
    if (c.topology === 'bank1p' && PHASES.includes(c.template)) return c.template;
    const ps = c.ps || {}, sn = String(m.serial || '').trim().toUpperCase();
    if (c.topology === 'bank1p' && sn) return PHASES.find(p => String(ps[p] || '').trim().toUpperCase() === sn) || '';
    return '';
  }
  const phaseLabel = p => (p ? `Pha ${p}` : '3 pha');
  const title = m => `${m.ins || m.name} – ${phaseLabel(m.phase)}`;

  // Gộp lần nạp mới (cùng file + tên + ngày thì thay, giữ id và lựa chọn tay); mỗi nhóm cách điện|pha tự chọn lần đo muộn nhất
  // khi người dùng chưa chọn tay. Phép đo không nhận ra loại cách điện thì để bỏ chọn, người dùng chọn tay.
  function merge(before, parsed, newId, cfg) {
    const merged = (before || []).map(x => Object.assign({}, x));
    (parsed || []).forEach(p => {
      const i = merged.findIndex(x => x.file === p.file && x.name === p.name && x.date === p.date);
      const old = i >= 0 ? merged[i] : null;
      const next = Object.assign({ name: p.name, date: p.date, temp: p.temp || '', serial: p.serial || '', file: p.file, f: p.f, tan: p.tan, c: p.c },
        { id: old ? old.id : newId(), ins: insOf(p.name), phase: defaultPhase(p, cfg), use: old ? old.use : false });
      if (old) ['insManual', 'phaseManual', 'useManual'].forEach(k => { if (old[k]) next[k] = old[k]; });
      if (old && old.insManual) next.ins = old.ins;
      if (old && old.phaseManual) next.phase = old.phase;
      if (i >= 0) merged[i] = next; else merged.push(next);
    });
    const groups = new Map();
    merged.forEach(x => { if (x.ins) groups.set(`${x.ins}|${x.phase}`, (groups.get(`${x.ins}|${x.phase}`) || []).concat([x])); });
    groups.forEach(g => {
      if (g.some(x => x.useManual)) return;
      const win = g.slice().sort((a, b) => dateKey(b.date).localeCompare(dateKey(a.date)))[0];
      g.forEach(x => { x.use = x === win; });
    });
    merged.forEach(x => { if (!x.ins) x.use = false; });
    return merged;
  }

  // Phép đo đại diện theo thứ tự CHL, CLT, CHT rồi pha (3 pha chung trước, rồi A, B, C)
  function chosen(items) {
    const best = new Map();
    (items || []).filter(x => x.use && x.ins).forEach(x => {
      const k = `${x.ins}|${x.phase || ''}`, old = best.get(k);
      if (!old || dateKey(x.date) > dateKey(old.date)) best.set(k, x);
    });
    const rank = x => INS.indexOf(x.ins) * 10 + ['', ...PHASES].indexOf(x.phase || '');
    return [...best.values()].sort((a, b) => rank(a) - rank(b));
  }
  const has = state => chosen(((state && state.att && state.att.dfrw) || {}).items).length > 0;

  // tgδ, C tại tần số hz (nội suy theo log tần số); ngoài dải đo → null
  const at = (m, hz) => (window.Dfr ? Dfr.at(m, hz) : null);

  // Khối phụ lục BBTN: bảng phép đo (tgδ, C tại 50 Hz) + đồ thị từng phép đo, ghi rõ cách điện và pha;
  // cùng cách điện có từ 2 pha trở lên thì thêm đồ thị xếp chồng các pha
  function appendix(state, assets, out, label) {
    const ms = chosen(((state.att || {}).dfrw || {}).items);
    if (!ms.length) return [];
    const o = out || (x => x);
    const num = (x, d) => (Number.isFinite(x) ? o(Number(x).toFixed(d).replace('.', ',')) : '');
    const blocks = [{ type: 'page' }, { type: 'p', text: label || 'PHỤ LỤC', bold: true, size: 14, align: 'center' },
      { type: 'p', text: 'Đáp ứng tần số điện môi cách điện cuộn dây (hàm lượng ẩm trong cách điện rắn)', bold: true, size: 13, align: 'center' },
      { type: 'p', text: 'I. Phép đo', bold: true, size: 12, keepNext: true }];
    blocks.push({ type: 'table', size: 9, head: ['Cách điện', 'Pha', 'Ngày đo', 'Nhiệt độ (°C)', 'tgδ 50 Hz (%)', 'C 50 Hz (pF)'],
      widths: [2200, 1000, 2000, 1300, 1400, 1600],
      rows: ms.map(m => { const v = at(m, 50); return [INS_TEXT[m.ins] || m.ins, phaseLabel(m.phase), o(m.date || ''), o(String(m.temp || '').replace('.', ',')), num(v && v.tan, 3), num(v && v.c, 1)]; }) });
    blocks.push({ type: 'p', text: 'II. Đồ thị tgδ theo tần số', bold: true, size: 12, keepNext: true });
    const charts = (assets && assets.dfrwCharts) || {};
    let no = 0;
    INS.forEach(ins => {
      const set = charts[ins];
      if (!set || !(set.individual || []).length) return;
      no++;
      blocks.push({ type: 'p', text: `II.${no} ${INS_TEXT[ins]}`, bold: true, size: 12, keepNext: true });
      blocks.push({ type: 'images', perRow: 2, widthCm: 8, items: set.individual });
      if (set.overlay) {
        blocks.push({ type: 'p', text: 'Đồ thị xếp chồng các pha để so sánh', italic: true, size: 11, keepNext: true });
        blocks.push({ type: 'images', perRow: 1, widthCm: 16, items: [set.overlay] });
      }
    });
    blocks.push({ type: 'p', text: 'Người thí nghiệm', bold: true, size: 12, align: 'right', after: 1200 });
    return blocks;
  }

  // BBTN tách từng pha: giữ phép đo của pha đó và phép đo không ghi pha
  const forPhase = (items, phase) => (items || []).filter(x => !x.phase || x.phase === phase);

  window.DfrW = { INS, INS_TEXT, PHASES, insOf, phaseIn, defaultPhase, phaseLabel, title, merge, chosen, has, appendix, forPhase };
})();
