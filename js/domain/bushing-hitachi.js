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
  let source = null;    // tên file (nhiều file: nối bằng " + ")
  let sources = [];

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

  // append: gộp với các file đã nạp (vd test report sứ AT1 + AT2), trùng S/N thì lấy file nạp sau; không append: thay toàn bộ
  function load(wb, name, opts = {}) {
    const ws = n => (wb.SheetNames.includes(n) ? rowsOf(wb.Sheets[n]) : null);
    const tc = ws('TraCuu'), tr = ws('TestReport');
    if (!tr) throw new Error('File không có sheet "TestReport"');
    const add = readTR(tr);
    if (tc) K = readConsts(tc);
    else if (!opts.append || !sources.length) K = JSON.parse(JSON.stringify(DEFAULTS));
    if (opts.append) {
      const keys = new Set(add.map(r => norm(r.serial)));
      TR = TR.filter(r => !keys.has(norm(r.serial))).concat(add);
      sources = sources.filter(n => n !== name).concat([name]);
    } else { TR = add; sources = [name]; }
    source = sources.join(' + ');
    return { count: add.length, total: TR.length, consts: K };
  }
  function clear() { TR = []; sources = []; source = null; K = JSON.parse(JSON.stringify(DEFAULTS)); }

  // Test report @20 °C của một sứ (quy đổi bằng chính quy trình trên)
  function report(serial) {
    const k = norm(serial);
    const r = k ? TR.find(x => norm(x.serial) === k) : null;
    if (!r) return null;
    return Object.assign({ raw: r }, to20(r));
  }

  // ---------------------------------------------------------------- lưu test report sứ lên CSDL (lần thí nghiệm FAT của từng sứ)
  // Ngày trong file: số ngày Excel, Date, dd/mm/yyyy hoặc yyyy-mm-dd → yyyy-mm-dd (không đọc được → '')
  function isoDate(v) {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    return (window.Common && Common.isoDate(String(v))) || '';
  }
  // Tình trạng từng sứ trong các file đã nạp so với danh mục: chỉ lưu sứ đã có trong danh mục (đã gắn vào MBA, có vị trí đầu sứ)
  // để chuỗi xu hướng khớp với số đo hiện trường (khóa: số chế tạo sứ + vị trí). sessions: các lần FAT (v_session_list).
  // → [{ serial, date, eq, where, hasFat, pick, reason }]
  function dbPlan(equipment, sessions) {
    const su = new Map((equipment || []).filter(e => e.class_code === 'SU').map(e => [norm(e.serial_no), e]));
    const fat = new Set((sessions || []).map(s => norm(s.serial_no)));
    return TR.map(r => {
      const eq = su.get(norm(r.serial)) || null;
      const hasFat = fat.has(norm(r.serial));
      const reason = !eq ? 'Chưa có trong danh mục — lưu BBTN / test report MBA có S/N sứ này, hoặc thêm sứ ở danh mục' : !eq.position ? 'Sứ chưa có vị trí đầu sứ' : '';
      return { serial: r.serial, date: isoDate(r.date), eq, where: eq ? [eq.parent_serial, eq.position ? `đầu ${eq.position}` : ''].filter(Boolean).join(' · ') : '',
        hasFat, pick: !reason && !hasFat, reason };
    });
  }
  // Gói lần thí nghiệm FAT (cùng dạng MbaRows.factorySessions) cho các sứ được chọn; số liệu quy về 20 °C như số đo hiện trường
  // (C quy nhiệt độ, tanδ / fc; không cộng ΔC lắp đặt). opts: { equipment, fileName, date (ngày nhập tay khi file không ghi) }
  function factoryPacks(serials, opts) {
    const want = new Set((serials || []).map(norm));
    const su = new Map((opts.equipment || []).filter(e => e.class_code === 'SU').map(e => [norm(e.serial_no), e]));
    return TR.filter(r => want.has(norm(r.serial))).map(r => {
      const eq = su.get(norm(r.serial)) || {};
      const f = to20(r), key = `SU|${r.serial}`, rows = [];
      const put = (param, value, unit, n) => {
        if (!ok(value)) return;
        rows.push({ eq: key, item: 'BUSHING', param, config: eq.position || '', phase: '', tap: '', value, value_text: null, unit,
          temp_c: ok(f.tB) ? +f.tB.toFixed(2) : null, value_norm: ok(n) ? +n.toFixed(6) : null, norm_temp_c: ok(n) ? 20 : null, status: null,
          note: `Test report hãng (${isMounted(r.mount) ? 'đã lắp' : 'chưa lắp'})` });
      };
      put('C1', r.c1, 'pF', f.c1); put('TGD1', r.tgd1, '%', f.tgd1); put('C2', r.c2, 'pF', f.c2); put('TGD2', r.tgd2, '%', f.tgd2);
      return {
        serial: r.serial, mainRef: key, refs: [{ key, class_code: 'SU', serial_no: r.serial }], rows,
        session: { kind: 'FAT', test_date: isoDate(r.date) || opts.date || null, source: 'factory_import', source_file: opts.fileName || source || null,
          reason: 'Thí nghiệm xuất xưởng sứ (test report hãng)' },
      };
    });
  }

  window.HitachiBushing = {
    DEFAULTS, bodyTemp, fc, deltaC, to20, compare, load, clear, report, isMounted, isoDate, dbPlan, factoryPacks,
    fromBase64(b64, name, opts) { return load(XLSX.read(b64, { type: 'base64' }), name, opts); },
    fromArrayBuffer(buf, name, opts) { return load(XLSX.read(buf, { type: 'array' }), name, opts); },
    get consts() { return K; }, get reports() { return TR; }, get source() { return source; }, get sources() { return sources.slice(); },
  };
})();
