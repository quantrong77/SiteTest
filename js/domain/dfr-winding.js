// DFR cách điện cuộn dây (mục độ ẩm cách điện rắn): phép đo CHL / CLT / CHT đọc từ CSV DIRANA, chọn lần đo đại diện,
// dựng phụ lục BBTN. MBA 3 cuộn dây: CHL, CLT; MBA tự ngẫu (tổ 3 máy 1 pha rời hoặc 3 pha chung vỏ): CHT.
// Có phép đo nào thì trình bày phép đo đó; chỉ trình bày số liệu đo, không đánh giá đạt / không đạt.
// Số liệu ở state.att.dfrw.items: { id, name, date, temp, file, objType, ins, phase, f[], tan[] (%), c[] (pF), ci[] (|C″|, pF),
//   oilCond (độ dẫn dầu pS/m), use, insManual, phaseManual, useManual;
//   từ file Excel DIRANA thêm: profile (H-T…), moist (%), moistCat, oilCat, oilCond20, c50 (pF), tan50 (%) — kết quả phân tích của DIRANA }
// Bảng tại tần số con trỏ 50 Hz: độ ẩm (ô độ ẩm của mục, phân loại theo Điều 28), độ dẫn dầu, tgδ, C, tổng trở |Z| = 1/(ω·|C*|).
// Độ ẩm, độ dẫn dầu là kết quả phân tích của phần mềm DIRANA: file Excel có sẵn → lấy theo file; file CSV không có → nhập tay. Không tự tính.
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
  // Cách điện khi tên phép đo không ghi (vd "PHA C"): kiểu đối tượng đo MBA tự ngẫu, hoặc tổ 3 máy 1 pha rời (500 kV tự ngẫu) → CHT
  function insFor(p, cfg) {
    // file Excel: Measurement profile H-T / H-L / L-T đã cho cách điện; kiểu MBA "AutoTransformerTertiary", "Auto w/ tert" → tự ngẫu
    return p.ins || insOf(p.name) || (/auto/i.test(p.objType || '') ? 'CHT' : '') || ((cfg || {}).topology === 'bank1p' ? 'CHT' : '');
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
        p.ci ? { ci: p.ci } : {}, { objType: p.objType || '' },
        Object.fromEntries(['profile', 'moist', 'moistCat', 'oilCat', 'oilCond20', 'c50', 'tan50', 'stopReached'].filter(k => p[k] !== undefined).map(k => [k, p[k]])),
        Number.isFinite(p.oilCond) ? { oilCond: String(Number(p.oilCond.toPrecision(3))).replace('.', ',') } : {},
        { id: old ? old.id : newId(), ins: insFor(p, cfg), phase: defaultPhase(p, cfg), use: old ? old.use : false });
      if (old) ['insManual', 'phaseManual', 'useManual'].forEach(k => { if (old[k]) next[k] = old[k]; });
      if (old && old.oilCond && next.oilCond === undefined) next.oilCond = old.oilCond;
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

  // tgδ, C′, |C″| tại tần số hz (nội suy tuyến tính theo log tần số); ngoài dải đo → null
  function at(m, hz) {
    if (!m || !(hz > 0) || !Array.isArray(m.f)) return null;
    const pts = m.f.map((f, i) => ({ f: Number(f), tan: Number(m.tan[i]), c: Number(m.c[i]), ci: m.ci ? Number(m.ci[i]) : NaN }))
      .filter(x => x.f > 0 && Number.isFinite(x.tan) && Number.isFinite(x.c)).sort((a, b) => a.f - b.f);
    if (!pts.length || hz < pts[0].f * 0.999 || hz > pts[pts.length - 1].f * 1.001) return null;
    const hi = pts.findIndex(p => p.f >= hz), b = pts[hi];
    if (Math.abs(b.f - hz) <= hz * 1e-6 || hi === 0) return { tan: b.tan, c: b.c, ci: b.ci };
    const a = pts[hi - 1], t = Math.log10(hz / a.f) / Math.log10(b.f / a.f), mix = (x, y) => x + t * (y - x);
    return { tan: mix(a.tan, b.tan), c: mix(a.c, b.c), ci: mix(a.ci, b.ci) };
  }
  // Giá trị tại tần số con trỏ: tgδ (%), C (nF), |Z| (kΩ) = 1/(2πf·√(C′² + C″²)); thiếu C″ thì |Z| ≈ 1/(2πf·C′)
  // File Excel DIRANA có sẵn C, tgδ tại 50 Hz (giá trị con trỏ của phần mềm) → dùng giá trị đó, |Z| tính từ C và tgδ
  function cursor(m, hz = 50) {
    if (hz === 50 && Number.isFinite(m.c50) && Number.isFinite(m.tan50)) {
      const cAbs = m.c50 * 1e-12 * Math.hypot(1, m.tan50 / 100);
      return { hz, tan: m.tan50, cNF: m.c50 / 1000, zK: 1 / (2 * Math.PI * hz * cAbs) / 1000, src: 'DIRANA' };
    }
    const v = at(m, hz);
    if (!v) return null;
    const cAbs = Math.hypot(v.c, Number.isFinite(v.ci) ? v.ci : 0) * 1e-12;
    return { hz, tan: v.tan, cNF: v.c / 1000, zK: cAbs > 0 ? 1 / (2 * Math.PI * hz * cAbs) / 1000 : NaN };
  }
  // Ô độ ẩm của mục: mẫu chung 3 pha theo pha (moist.r.A/B/C), mẫu khác một ô (moist.val)
  const moistKey = (cfg, phase) => ((cfg || {}).template === '3P' && phase ? `moist.r.${phase}` : 'moist.val');
  // Độ ẩm: ô độ ẩm của mục (người dùng nhập / đã điền); ô trống thì độ ẩm DIRANA của phép đo (file Excel), nếu > 0
  function moisture(state, m) {
    const s = String(((state || {}).v || {})[moistKey((state || {}).cfg, m.phase)] ?? '').trim().replace(',', '.');
    if (s !== '') return Number(s);
    return Number.isFinite(m.moist) && m.moist > 0 ? m.moist : NaN;
  }
  // Điền ô độ ẩm từ kết quả DIRANA: chỉ khi > 0 và phép đo đã quét tới tần số dừng (DIRANA ghi 0 % khi chưa phân tích được)
  const moistUsable = m => Number.isFinite(m.moist) && m.moist > 0 && m.stopReached !== false;
  // Phân loại độ ẩm của DIRANA (cùng ngưỡng 2,2 / 3,7 / 4,8 % như Điều 28) → tiếng Việt
  const CAT_VI = { 'dry': 'khô', 'moderately wet': 'ẩm trung bình', 'wet': 'ẩm', 'extremely wet': 'ẩm cao' };
  const catVi = s => CAT_VI[String(s || '').trim().toLowerCase()] || String(s || '');
  // Phân loại theo Điều 28 QĐ 1901 (cùng hàm đánh giá của mục)
  const category = x => (Number.isFinite(x) && window.QD ? QD.classifyMoisture(x).text.replace(/^[^:]*:\s*/, '').replace(/\s*\(.*\)\s*$/, '') : '');

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
    blocks.push({ type: 'table', size: 8, head: ['Cách điện', 'Pha', 'Ngày đo', 'Nhiệt độ (°C)', 'Độ ẩm (%)', 'Phân loại (Điều 28)', 'Độ dẫn dầu (pS/m)', 'tgδ (%)', 'C (nF)', '|Z| (kΩ)'],
      widths: [1250, 650, 1150, 750, 700, 1350, 900, 750, 850, 850],
      rows: ms.map(m => {
        const v = cursor(m, 50), mo = moisture(state, m);
        return [m.ins, phaseLabel(m.phase), o(String(m.date || '').split(' ')[0]), o(String(m.temp || '').replace('.', ',')), num(mo, 2), o(category(mo)),
          o(String(m.oilCond || '').replace('.', ',')), num(v && v.tan, 3), num(v && v.cNF, 2), num(v && v.zK, 1)];
      }) });
    blocks.push({ type: 'p', text: 'Tại tần số con trỏ 50 Hz. Độ ẩm (trong cellulose), độ dẫn dầu, C, tgδ theo kết quả phân tích của DIRANA; |Z| = 1/(2πf·|C*|).', italic: true, size: 9 });
    const partial = ms.filter(m => m.stopReached === false);
    if (partial.length) blocks.push({ type: 'p', text: `${partial.map(title).join(', ')}: phép đo chưa quét tới tần số dừng đặt trước (DIRANA: Max. stop frequency reached = no) — kết quả phân tích độ ẩm chỉ để tham khảo.`, italic: true, size: 9 });
    blocks.push({ type: 'p', text: 'II. Đồ thị tgδ theo tần số', bold: true, size: 12, keepNext: true });
    const charts = (assets && assets.dfrwCharts) || {};
    let no = 0;
    INS.forEach(ins => {
      const set = charts[ins];
      if (!set || !(set.individual || []).length) return;
      no++;
      blocks.push({ type: 'p', text: `II.${no} ${INS_TEXT[ins]}`, bold: true, size: 12, keepNext: true });
      // xếp chồng các pha đặt trước để so sánh; rồi đồ thị riêng từng phép đo
      if (set.overlay) {
        blocks.push({ type: 'p', text: 'Đồ thị xếp chồng các pha để so sánh', italic: true, size: 11, keepNext: true });
        blocks.push({ type: 'images', perRow: 1, widthCm: 16, items: [set.overlay] });
        blocks.push({ type: 'p', text: 'Đồ thị riêng từng pha', italic: true, size: 11, keepNext: true });
      }
      blocks.push({ type: 'images', perRow: 2, widthCm: 8, items: set.individual });
    });
    blocks.push({ type: 'p', text: 'Người thí nghiệm', bold: true, size: 12, align: 'right', after: 1200 });
    return blocks;
  }

  // BBTN tách từng pha: giữ phép đo của pha đó và phép đo không ghi pha
  const forPhase = (items, phase) => (items || []).filter(x => !x.phase || x.phase === phase);

  window.DfrW = { INS, INS_TEXT, PHASES, catVi, moistUsable, insOf, insFor, phaseIn, defaultPhase, phaseLabel, title, merge, chosen, has, at, cursor, moistKey, moisture, category, appendix, forPhase };
})();
