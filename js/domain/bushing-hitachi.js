// Sứ RIP Hitachi Energy: quy đổi tanδ, C về 20 °C và so sánh test report theo
// "Operating Instructions for Bushings" mục 19.6–19.8 (Bảng 13, 14, 15) — đúng nghiệp vụ file SuRIP_Hitachi_QuyDoi20C.xlsx.
//   T sứ  = T môi trường (chưa lắp) | (2·T môi trường + T dầu)/3 (đã lắp)
//   fc    = nội suy tuyến tính Bảng 13 theo T sứ (0–80 °C, ngoài dải: không quy đổi)
//   tanδ20 = tanδ / fc ;  C20 = C·(1 − (T sứ − 20)·0,0004)
//   C1 relative = C1@20 + ΔC lắp đặt (chỉ khi đã lắp; Bảng 14 theo Ur)
//   Dung sai Bảng 15 so với test report @20 °C: C1, C2 tương đối; tanδ1, tanδ2 tuyệt đối (điểm %)
(function () {
  'use strict';

  const DEFAULTS = {
    fc: { t: [0, 10, 20, 30, 40, 50, 60, 70, 80], f: [1.45, 1.20, 1.00, 0.85, 0.77, 0.75, 0.77, 0.82, 0.90] },
    dC: [{ ur: 123, pf: 4 }, { ur: 245, pf: 6 }, { ur: 420, pf: 8 }],
    tol: { low: { c1: 0.05, tgd1: 0.05, c2: 0.20, tgd2: 0.15 }, high: { c1: 0.03, tgd1: 0.05, c2: 0.20, tgd2: 0.15 } },
    tRef: 20, cCoef: 0.0004, urSplit: 145,
  };
  let K = JSON.parse(JSON.stringify(DEFAULTS));
  let TR = [];          // test report hãng: [{ serial, ur, mount, tAmb, tOil, c1, tgd1, c2, tgd2, date, where }]
  let source = null;    // tên file

  const num = v => (v === null || v === undefined || v === '' ? NaN : typeof v === 'number' ? v : Number(String(v).replace(',', '.')));
  const ok = Number.isFinite;
  const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const isMounted = m => /đã\s*lắp|da\s*lap|installed|mounted/i.test(String(m || ''));

  // T thân sứ
  function bodyTemp(mounted, tAmb, tOil) {
    if (!ok(tAmb)) return NaN;
    if (!mounted) return tAmb;
    return ok(tOil) ? (2 * tAmb + tOil) / 3 : NaN;
  }

  // fc nội suy tuyến tính đúng như FORECAST trên đoạn chứa T (ngoài 0–80 °C → NaN = "Ngoài dải")
  function fc(t) {
    const { t: xs, f: ys } = K.fc;
    if (!ok(t) || t < xs[0] || t > xs[xs.length - 1]) return NaN;
    let i = 0;
    while (i < xs.length - 2 && t >= xs[i + 1]) i++;
    return ys[i] + (ys[i + 1] - ys[i]) * (t - xs[i]) / (xs[i + 1] - xs[i]);
  }

  // ΔC lắp đặt (Bảng 14): chỉ khi đã lắp; Ur > ngưỡng cuối → 0
  function deltaC(ur, mounted) {
    if (!mounted || !ok(ur)) return 0;
    const hit = K.dC.find(r => ur <= r.ur);
    return hit ? hit.pf : 0;
  }

  // Quy đổi một bộ số đo về 20 °C
  function to20(m) {
    const mounted = isMounted(m.mount);
    const tB = bodyTemp(mounted, m.tAmb, m.tOil);
    const f = fc(tB);
    const dT = ok(tB) ? tB - K.tRef : NaN;
    const cc = c => (ok(c) && ok(dT) ? c * (1 - dT * K.cCoef) : NaN);
    const out = { mounted, tB, fc: f, dT, c1: cc(m.c1), c2: cc(m.c2), tgd1: ok(m.tgd1) && ok(f) ? m.tgd1 / f : NaN, tgd2: ok(m.tgd2) && ok(f) ? m.tgd2 / f : NaN };
    out.dC = ok(out.c1) ? deltaC(m.ur, mounted) : NaN;
    out.c1rel = ok(out.c1) ? out.c1 + out.dC : NaN;
    return out;
  }

  // So với test report @20 °C theo Bảng 15 → { c1, tgd1, c2, tgd2: {dev, tol, pass}, verdict }
  function compare(f20, tr20, ur) {
    const T = ok(ur) && ur <= K.urSplit ? K.tol.low : K.tol.high;
    const r = {};
    const rel = (a, b) => (ok(a) && ok(b) && b !== 0 ? (a - b) / b : NaN);
    const abs = (a, b) => (ok(a) && ok(b) ? a - b : NaN);
    [['c1', rel(f20.c1rel, tr20 && tr20.c1)], ['tgd1', abs(f20.tgd1, tr20 && tr20.tgd1)], ['c2', rel(f20.c2, tr20 && tr20.c2)], ['tgd2', abs(f20.tgd2, tr20 && tr20.tgd2)]]
      .forEach(([k, d]) => { r[k] = { dev: d, tol: T[k], pass: ok(d) ? Math.abs(d) <= T[k] + 1e-9 : null }; });
    const vals = ['c1', 'tgd1', 'c2', 'tgd2'].map(k => r[k].pass);
    r.verdict = vals.includes(false) ? 'Không đạt – liên hệ Hitachi Energy' : vals.every(v => v === true) ? 'Đạt' : 'Chưa đủ dữ liệu';
    r.group = ok(ur) && ur <= K.urSplit ? `Ur ≤ ${K.urSplit} kV` : `Ur > ${K.urSplit} kV`;
    return r;
  }

  // ---------------------------------------------------------------- đọc file Excel nghiệp vụ
  const rowsOf = ws => XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  function readConsts(rows) {
    const k = JSON.parse(JSON.stringify(DEFAULTS));
    const cell = (r, c) => (rows[r] ? rows[r][c] : null);
    // Bảng 13: A5:B13
    const t = [], f = [];
    for (let r = 4; r < 13; r++) { const a = num(cell(r, 0)), b = num(cell(r, 1)); if (ok(a) && ok(b)) { t.push(a); f.push(b); } }
    if (t.length >= 2) k.fc = { t, f };
    // Bảng 14: D5:E7
    const dC = [];
    for (let r = 4; r < 7; r++) { const a = num(cell(r, 3)), b = num(cell(r, 4)); if (ok(a) && ok(b)) dC.push({ ur: a, pf: b }); }
    if (dC.length) k.dC = dC;
    // Bảng 15: H5:I8
    ['c1', 'tgd1', 'c2', 'tgd2'].forEach((p, i) => {
      const lo = num(cell(4 + i, 7)), hi = num(cell(4 + i, 8));
      if (ok(lo)) k.tol.low[p] = lo;
      if (ok(hi)) k.tol.high[p] = hi;
    });
    const tRef = num(cell(16, 1)), cc = num(cell(17, 1)), split = num(cell(18, 1));
    if (ok(tRef)) k.tRef = tRef;
    if (ok(cc)) k.cCoef = cc;
    if (ok(split)) k.urSplit = split;
    return k;
  }

  function readTR(rows) {
    const h = rows.findIndex(r => r && r.some(c => /Serial/i.test(String(c || ''))));
    if (h < 0) return [];
    const head = rows[h].map(x => String(x || ''));
    const col = re => head.findIndex(x => re.test(x));
    const c = {
      where: col(/Trạm|Thiết bị/i), pos: col(/Pha|Vị trí/i), serial: col(/Serial/i), ur: col(/^Ur/i), mount: col(/Trạng thái/i), date: col(/Ngày/i),
      tAmb: col(/T môi trường/i), tOil: col(/T dầu/i), c1: col(/^C1 đo/i), tgd1: col(/tanδ1 đo/i), c2: col(/^C2 đo/i), tgd2: col(/tanδ2 đo/i),
    };
    const out = [];
    for (let r = h + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !row[c.serial]) continue;
      const rec = {
        serial: String(row[c.serial]).trim(), ur: num(row[c.ur]), mount: row[c.mount] || 'Chưa lắp', where: row[c.where], pos: row[c.pos],
        date: row[c.date], tAmb: num(row[c.tAmb]), tOil: num(row[c.tOil]), c1: num(row[c.c1]), tgd1: num(row[c.tgd1]), c2: num(row[c.c2]), tgd2: num(row[c.tgd2]),
      };
      if ([rec.c1, rec.tgd1, rec.c2, rec.tgd2].some(ok)) out.push(rec);
    }
    return out;
  }

  function load(wb, name) {
    const ws = n => (wb.SheetNames.includes(n) ? rowsOf(wb.Sheets[n]) : null);
    const tc = ws('TraCuu'), tr = ws('TestReport');
    if (!tr) throw new Error('File không có sheet "TestReport"');
    K = tc ? readConsts(tc) : JSON.parse(JSON.stringify(DEFAULTS));
    TR = readTR(tr);
    source = name;
    return { count: TR.length, consts: K };
  }

  // Test report @20 °C của một sứ (quy đổi bằng chính quy trình trên)
  function report(serial) {
    const k = norm(serial);
    const r = k ? TR.find(x => norm(x.serial) === k) : null;
    if (!r) return null;
    return Object.assign({ raw: r }, to20(r));
  }

  window.HitachiBushing = {
    DEFAULTS, bodyTemp, fc, deltaC, to20, compare, load, report, isMounted,
    fromBase64(b64, name) { return load(XLSX.read(b64, { type: 'base64' }), name); },
    fromArrayBuffer(buf, name) { return load(XLSX.read(buf, { type: 'array' }), name); },
    get consts() { return K; }, get reports() { return TR; }, get source() { return source; },
  };
})();
