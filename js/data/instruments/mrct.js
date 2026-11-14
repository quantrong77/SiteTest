// Bộ đọc số liệu máy đo biến dòng Megger MRCT (phần mềm PowerDB):
//  - file .pdbxml (dữ liệu PowerDB): điện trở một chiều, điểm khuỷu, đường cong từ hóa, dòng định mức.
//    File này không chứa kết quả tỷ số đo/sai số/góc pha/cực tính.
//  - báo cáo PDF "CT TEST REPORT" in từ PowerDB: tỷ số định mức và đo, sai số %, lệch góc pha, cực tính, điện trở,
//    điểm khuỷu và bảng đặc tính từ hóa theo từng cặp đầu ra. Chữ trong PDF do js/data/pdf-text.js lấy ra (pdf.js),
//    bộ đọc ở đây chỉ nhận danh sách chữ kèm tọa độ nên chạy được cả trong test Node.
// Kết quả chung: { file, kind, device, date, cts: [{ name, cores: [{ code, taps: [...], curves: [...] }] }] }.
// Ký hiệu đầu ra chuẩn hóa về dạng "1S1-1S3": PDF ghi "1.1-1.3", PowerDB ghi "1S1-1S3".
(function () {
  'use strict';
  const ok = Number.isFinite;

  // ---------------------------------------------------------------- tiện ích
  // "1S1-1S3", "1.1-1.3", "1s1 - 1s3" → { core: 1, a: 1, b: 3, name: '1S1-1S3' }
  function parseTap(s) {
    const m = String(s || '').trim().match(/^(\d+)\s*[.Ss]\s*(\d+)\s*-\s*(\d+)\s*[.Ss]\s*(\d+)$/);
    if (!m || m[1] !== m[3]) return null;
    const core = +m[1], a = +m[2], b = +m[4];
    return { core, a, b, name: `${core}S${a}-${core}S${b}` };
  }
  // số kiểu PowerDB: "1,082.9" (dấu phẩy phân nghìn), "-0.116", "9.149394E-02"
  function num(s) {
    const t = String(s ?? '').trim().replace(/,(?=\d{3}(\D|$))/g, '');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return NaN;
    return Number(t);
  }
  // "1598.14:1" → { p: 1598.14, s: 1 }
  function ratioOf(s) {
    const m = String(s || '').trim().match(/^([\d,.]+)\s*:\s*([\d,.]+)$/);
    if (!m) return null;
    const p = num(m[1]), q = num(m[2]);
    return ok(p) && ok(q) && q > 0 ? { p, s: q, k: p / q, text: `${m[1]}:${m[2]}` } : null;
  }
  // "0°2'" (ký hiệu độ có thể bị đổi khi lấy chữ từ PDF) → { deg, min, text, minutes }
  function phaseOf(s) {
    const m = String(s || '').trim().match(/^(-?)(\d+)\D+(\d+)'?$/);
    if (!m) return null;
    const sign = m[1] ? -1 : 1, deg = +m[2], min = +m[3];
    return { minutes: sign * (deg * 60 + min), text: `${m[1]}${deg}°${min}'` };
  }

  // Sắp U tăng, bỏ điểm không đơn điệu (giống bộ đọc CPC 100)
  const monotone = raw => (window.Cpc100 ? Cpc100.monotone(raw) : raw);

  // ---------------------------------------------------------------- .pdbxml
  function decodeEntities(s) {
    return s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) => {
      const map = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
      if (map[e.toLowerCase()]) return map[e.toLowerCase()];
      return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    });
  }
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function b64bytes(s) {
    const t = String(s).replace(/[^A-Za-z0-9+/]/g, '');
    const out = new Uint8Array(Math.floor(t.length * 3 / 4));
    let n = 0, buf = 0, bits = 0;
    for (let i = 0; i < t.length; i++) {
      buf = (buf << 6) | B64.indexOf(t[i]); bits += 6;
      if (bits >= 8) { bits -= 8; out[n++] = (buf >> bits) & 255; }
    }
    return out.subarray(0, n);
  }

  // Khối nhị phân ct<i>__satchartdata: int 1; rồi từng cặp đầu ra:
  // CString MFC (FF FE FF, độ dài 1 byte, UTF-16LE) + 3 mảng float32, mỗi mảng có (dung lượng, số phần tử) int32:
  // dòng I (A), áp U (V), mảng thứ ba (không dùng). Hết các mục thì là phần đuôi không có dấu FF FE FF.
  function satCurves(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const out = [];
    let p = 4;
    const arr = () => {
      if (p + 8 > bytes.length) throw new Error('hết dữ liệu');
      const cnt = dv.getInt32(p + 4, true); p += 8;
      if (cnt < 0 || p + 4 * cnt > bytes.length) throw new Error('độ dài mảng sai');
      const a = [];
      for (let k = 0; k < cnt; k++) a.push(dv.getFloat32(p + 4 * k, true));
      p += 4 * cnt;
      return a;
    };
    try {
      while (p + 4 <= bytes.length && bytes[p] === 0xff && bytes[p + 1] === 0xfe && bytes[p + 2] === 0xff) {
        const len = bytes[p + 3]; p += 4;
        if (p + 2 * len > bytes.length) break; // tên bị cắt cụt
        let name = '';
        for (let k = 0; k < len; k++) name += String.fromCharCode(dv.getUint16(p + 2 * k, true));
        p += 2 * len;
        const I = arr(), V = arr(); arr();
        if (name && I.length && I.length === V.length) out.push({ tap: name, points: I.map((i, k) => ({ v: V[k], i })) });
      }
    } catch (e) { /* phần còn lại không đọc được: giữ các đường đã đọc */ }
    return out;
  }

  function parsePdbxml(xml, fileName) {
    if (!/<powerdb\.testdata/i.test(xml)) throw new Error(`${fileName}: không phải file dữ liệu PowerDB (.pdbxml)`);
    const tags = {}, arrays = {};
    xml.replace(/<tag\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/tag>/g, (m, n, v) => { tags[n] = decodeEntities(v).trim(); return ''; });
    xml.replace(/<array\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/array>/g, (m, n, body) => {
      const a = {};
      body.replace(/<arrayitem\s+index="(\d+)"[^>]*>([\s\S]*?)<\/arrayitem>/g, (mm, i, v) => { a[+i] = decodeEntities(v).trim(); return ''; });
      arrays[n] = a; return '';
    });
    if (!Object.keys(tags).some(k => /^ct\d+__/.test(k))) throw new Error(`${fileName}: file PowerDB không có số liệu biến dòng (MRCT)`);
    const ctMap = new Map();
    const slots = [...new Set(Object.keys(tags).map(k => (k.match(/^ct(\d+)__/) || [])[1]).filter(Boolean).map(Number))].sort((a, b) => a - b);
    for (const i of slots) {
      const P = `ct${i}__`;
      if (tags[P + 'cttested'] !== '1') continue;
      const ctNo = Math.ceil(i / 6), slot = (i - 1) % 6 + 1;
      const name = tags[P + 'np_ctname'] || tags[`rpt_ct${ctNo}`] || `CT${ctNo}`;
      const code = parseInt(tags[P + 'np_ctlbl'], 10) || slot;
      const A = n => arrays[P + n] || {};
      const prim = Object.values(A('np_ratio_prim')).map(num).filter(ok);
      const sec = num(tags[P + 'seccurrent']);
      const taps = new Map();
      const tapOf = s => {
        const t = parseTap(s);
        if (!t) return null;
        if (!taps.has(t.name)) taps.set(t.name, Object.assign(t, { nominal: null, ratio: null, err: NaN, phase: null, polarity: '', r: NaN, knee: null }));
        return taps.get(t.name);
      };
      const tn = A('tap_name'), kv = A('tap_kneev'), kc = A('tap_kneec');
      Object.keys(tn).forEach(ix => {
        const t = tapOf(tn[ix]);
        if (t && ok(num(kv[ix])) && ok(num(kc[ix]))) t.knee = { v: num(kv[ix]), i: num(kc[ix]) };
      });
      const wn = A('wind_tap_name'), wr = A('wind_res');
      Object.keys(wn).forEach(ix => { const t = tapOf(wn[ix]); if (t && ok(num(wr[ix]))) t.r = num(wr[ix]); });
      const curves = tags[P + 'satchartdata'] ? satCurves(b64bytes(tags[P + 'satchartdata'])) : [];
      curves.forEach(c => { const t = parseTap(c.tap); if (t) { c.tap = t.name; c.points = monotone(c.points); tapOf(t.name); } });
      if (!ctMap.has(name)) ctMap.set(name, { name, cores: [] });
      ctMap.get(name).cores.push({
        code, label: tags[P + 'np_ctlbl'] || `${code}S`, taps: [...taps.values()].sort((x, y) => x.a - y.a || x.b - y.b),
        curves: curves.filter(c => c.points.length >= 2), rating: prim.length && ok(sec) ? `${prim.join('-')}/${sec} A` : '', std: '',
      });
    }
    const cts = [...ctMap.values()];
    if (!cts.length) throw new Error(`${fileName}: không có cuộn nào được đánh dấu đã thí nghiệm`);
    return { file: fileName, kind: 'pdbxml', device: tags.eqptinventorynumber || 'Megger MRCT', date: tags.testdate || '', cts, hasRatio: false };
  }

  // ---------------------------------------------------------------- PDF "CT TEST REPORT"
  // pages: mảng trang, mỗi trang là mảng { str, x, y, w } (y tính từ đáy trang như pdf.js).
  // Gom chữ thành dòng theo y; một mục chứa nhiều số cách nhau bởi dấu cách được tách và ước lượng x theo vị trí ký tự.
  function lines(items) {
    const toks = [];
    items.forEach(it => {
      const s = String(it.str || '');
      if (!s.trim()) return;
      const w = ok(it.w) ? it.w : 0;
      const parts = s.trim().split(/\s+/);
      if (parts.length > 1 && parts.every(p => ok(num(p)) || ratioOf(p) || parseTap(p))) {
        let from = 0;
        parts.forEach(p => { const at = s.indexOf(p, from); from = at + p.length; toks.push({ s: p, x: it.x + (s.length ? w * at / s.length : 0), y: it.y }); });
      } else toks.push({ s: s.trim(), x: it.x, y: it.y });
    });
    toks.sort((a, b) => b.y - a.y || a.x - b.x);
    const out = [];
    toks.forEach(t => {
      const L = out[out.length - 1];
      if (L && Math.abs(L.y - t.y) <= 2.5) L.t.push(t); else out.push({ y: t.y, t: [t] });
    });
    out.forEach(L => L.t.sort((a, b) => a.x - b.x));
    return out;
  }
  const nearest = (cols, x) => {
    let best = -1, d = Infinity;
    cols.forEach((c, k) => { const dd = Math.abs(c - x); if (dd < d) { d = dd; best = k; } });
    return best;
  };

  // Cột bảng tỷ số (tọa độ x đầu cột trên mẫu PowerDB, dùng khi không thấy dòng tiêu đề)
  const RATIO_COLS = ['nominal', 'measured', 'err', 'testV', 'testI', 'primV', 'kneeV', 'kneeI', 'phase', 'polarity', 'r'];
  const RATIO_HEAD = [/Nameplate/i, /^Measured/i, /%\s*Error/i, /Test\s*V/i, /Test\s*I/i, /Prim\s*V/i, /Volt/i, /Cur/i, /^Dev\.?$/i, /^Polarity/i, /^\(Ohms\)/i];
  const RATIO_X = [57, 104, 150, 188, 232, 273, 321, 364, 405, 446, 489];

  function parsePdfItems(pages, fileName) {
    const all = pages.map(lines);
    const flat = all.flat();
    const text = flat.map(L => L.t.map(t => t.s).join(' ')).join('\n');
    if (!/CT TEST REPORT/i.test(text) || !/Voltage\/Current|Nameplate/i.test(text)) throw new Error(`${fileName}: không phải báo cáo "CT TEST REPORT" của PowerDB/MRCT`);
    const device = ((text.match(/TEST EQUIPMENT USED:\s*(.+?)(?:\s+TESTED BY|\n|$)/i) || [])[1] || 'Megger MRCT').trim();
    const date = ((text.match(/DATE\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/) || [])[1] || '');
    const ctMap = new Map();
    let ct = null, core = null, ratioX = RATIO_X.slice(), exCols = null, pendingV = null, std = '';
    const coreOf = code => {
      if (!ct) { ct = { name: 'CT', cores: [] }; ctMap.set('CT', ct); }
      let c = ct.cores.find(k => k.code === code);
      if (!c) { c = { code, label: `${code}S`, taps: [], curves: [], rating: '', std }; ct.cores.push(c); }
      return c;
    };
    flat.forEach(L => {
      const T = L.t, first = T[0].s, line = T.map(t => t.s).join(' ');
      const ctTok = T.find(t => /^CT:/i.test(t.s));
      if (ctTok) {
        const name = ctTok.s.replace(/^CT:\s*/i, '').trim() || (T[T.indexOf(ctTok) + 1] || {}).s || 'CT';
        if (!ctMap.has(name)) ctMap.set(name, { name, cores: [] });
        ct = ctMap.get(name);
        const cm = line.match(/Core\s*(\d+)/i);
        core = cm ? coreOf(+cm[1]) : null;
        exCols = null; pendingV = null;
        return;
      }
      // "CoreN" in tách khỏi dòng "CT:" (mẫu báo cáo khác): vẫn gán vào CT hiện hành
      const coreTok = T.find(t => /^Core\s*\d+$/i.test(t.s));
      if (coreTok && ct) { core = coreOf(+coreTok.s.match(/\d+/)[0]); exCols = null; pendingV = null; }
      const sm = line.match(/SATURATION STD\s+(.+?)(?:\s+VA)?$/i);
      if (sm) { std = sm[1].trim(); if (core) core.std = std; }
      // dòng tiêu đề bảng tỷ số: lấy tọa độ cột
      if (T.some(t => /Measured/i.test(t.s)) && T.some(t => /Nameplate/i.test(t.s))) {
        RATIO_HEAD.forEach((re, k) => { const h = T.find(t => re.test(t.s)); if (h) ratioX[k] = h.x; });
        return;
      }
      if (T.some(t => /^Dev\.?$/i.test(t.s))) { const h = T.find(t => /^Dev\.?$/i.test(t.s)); ratioX[8] = h.x; }
      if (T.some(t => /^\(Ohms\)/i.test(t.s))) { const h = T.find(t => /^\(Ohms\)/i.test(t.s)); ratioX[10] = h.x; }
      if (T.some(t => /^Polarity/i.test(t.s))) { const h = T.find(t => /^Polarity/i.test(t.s)); ratioX[9] = h.x; }
      // dòng kết quả tỷ số: "1.1-1.2 1600:1 1598.14:1 -0.116 ..."
      const tap = parseTap(first);
      if (tap && T.length >= 3 && ratioOf(T[1].s)) {
        const row = {};
        T.slice(1).forEach(t => { const k = nearest(ratioX, t.x); if (k >= 0 && row[RATIO_COLS[k]] === undefined) row[RATIO_COLS[k]] = t.s; });
        const c = coreOf(tap.core);
        const kneeV = num(row.kneeV), kneeI = num(row.kneeI);
        c.taps.push(Object.assign(tap, {
          nominal: ratioOf(row.nominal), ratio: ratioOf(row.measured), err: num(row.err), phase: phaseOf(row.phase), polarity: row.polarity || '',
          r: num(row.r), knee: ok(kneeV) && ok(kneeI) && kneeV > 0 ? { v: kneeV, i: kneeI } : null,
          test: { v: num(row.testV), i: num(row.testI), prim: num(row.primV) },
        }));
        return;
      }
      // tiêu đề bảng từ hóa: "# Voltage/Current 1.1-1.2 1.1-1.3 ..."
      if (T.some(t => /^Voltage\/Current$/i.test(t.s))) {
        exCols = T.filter(t => parseTap(t.s)).map(t => ({ tap: parseTap(t.s).name, x: t.x, pts: [] }));
        exCols.forEach(col => {
          const c = coreOf(parseTap(col.tap).core);
          let cur = c.curves.find(k => k.tap === col.tap);
          if (!cur) { cur = { tap: col.tap, raw: [] }; c.curves.push(cur); }
          col.cur = cur;
        });
        pendingV = null;
        return;
      }
      if (exCols && /VOLTAGE/i.test(line) && /volts/i.test(line)) {
        pendingV = valuesByCol(T, exCols);
        return;
      }
      if (exCols && pendingV && /CURRENT/i.test(line) && /amps/i.test(line)) {
        const I = valuesByCol(T, exCols);
        exCols.forEach((col, k) => { if (ok(pendingV[k]) && ok(I[k])) col.cur.raw.push({ v: pendingV[k], i: I[k] }); });
        pendingV = null;
      }
    });
    const cts = [...ctMap.values()].filter(c => c.cores.length);
    cts.forEach(c => c.cores.forEach(k => {
      k.curves = k.curves.map(cv => ({ tap: cv.tap, points: monotone(cv.raw) })).filter(cv => cv.points.length >= 2);
      k.taps.sort((x, y) => x.a - y.a || x.b - y.b);
      const r = k.taps.find(t => t.nominal);
      if (r) k.rating = k.taps.filter(t => t.a === 1 && t.nominal).map(t => t.nominal.text).join('; ');
      if (!k.std) k.std = std;
    }));
    if (!cts.length) throw new Error(`${fileName}: không tìm thấy bảng kết quả trong báo cáo`);
    return { file: fileName, kind: 'pdf', device, date, cts, hasRatio: cts.some(c => c.cores.some(k => k.taps.some(t => t.ratio))) };
  }
  // giá trị số trên một dòng → theo cột đầu ra gần nhất (ô trống thì NaN)
  function valuesByCol(T, cols) {
    const out = cols.map(() => NaN);
    T.forEach(t => {
      const v = num(t.s);
      if (!ok(v)) return;
      const k = nearest(cols.map(c => c.x), t.x);
      if (k >= 0 && Math.abs(cols[k].x - t.x) < 30 && !ok(out[k])) out[k] = v;
    });
    return out;
  }

  // ---------------------------------------------------------------- chọn số liệu cho BBTN
  // Đường từ hóa dùng cho bảng: ưu tiên cặp đầu ra có đủ số liệu (đường cong ≥ 4 điểm và điểm khuỷu do máy tính),
  // sau đó cặp S1–S(lớn nhất). Điểm khuỷu chỉ lấy theo máy; máy không báo thì ghi "Không có" và lấy 3 mốc theo U lớn nhất đã đo.
  function excitation(core) {
    if (!core.curves.length) return null;
    const kneeOf = name => { const t = core.taps.find(k => k.name === name); return t && t.knee ? t : null; };
    const scored = core.curves.map(c => ({ c, t: parseTap(c.tap), full: c.points.length >= 4 && !!kneeOf(c.tap) })).filter(x => x.t)
      .sort((x, y) => y.full - x.full || (y.t.a === 1) - (x.t.a === 1) || (y.t.b - y.t.a) - (x.t.b - x.t.a) || y.c.points.length - x.c.points.length);
    const best = scored.find(x => x.c.points.length >= 4) || scored[0];
    if (!best) return null;
    const tap = kneeOf(best.c.tap);
    const card = { name: best.c.tap, points: best.c.points, cpcKnee: tap && tap.knee ? tap.knee : null, kneeSrc: `MRCT${core.std ? ` (${core.std})` : ''}`, machineOnly: true };
    return Object.assign(card, Cpc100.pick(card));
  }

  window.Mrct = { parseTap, num, ratioOf, phaseOf, satCurves, b64bytes, parsePdbxml, parsePdfItems, lines, excitation };
})();
