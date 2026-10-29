// MBA: tách thông tin thiết bị từ chữ OCR của ảnh nameplate → các ô mục 0 (và kiểu OLTC, I0 nameplate).
// Mỗi trường trả { value, conf (0–100), status: 'ok' | 'check' | 'missing', raw, why, weak }; weak = giá trị nhiều khả năng sai
// (thiếu cuộn, S/N không có trong file xuất xưởng, I0 bất thường) — hiện để tham khảo, không điền sẵn.
// ok = đọc rõ và đúng dạng; check = đọc được nhưng chữ mờ / sai dạng / phải ghép, cần người dùng xem lại; missing = không thấy.
// Định dạng ghi giống BBTN: công suất "180/240/300", điện áp "500/√3 ±8×1.25%/225/√3/35", dòng "1039/2309/1714"
// (lớn nhất của từng cuộn HV/MV/LV).
(function () {
  'use strict';
  const OK_CONF = 80;

  // Sửa lỗi OCR hay gặp trong phần số: O→0, l/I→1, S→5 khi nằm giữa chữ số; "V3", "/ 3" → "/√3"
  const fixDigits = s => s.replace(/(?<=\d)[Oo](?=\d|\b)|(?<=\b)[Oo](?=\d)/g, '0').replace(/(?<=\d)[lI|](?=\d)/g, '1');
  const fixSqrt = s => s.replace(/\/\s*[V√v]\s*3/g, '/√3').replace(/(\d)\s*[V√v]\s*3\b/g, '$1/√3');
  // "£8x1.25%", "+8x" → "±8x" (OCR hay đọc ± thành £ / +)
  const fixPm = s => s.replace(/[£€+]\s*(?=\d+\s*[x×*]\s*\d)/g, '±');
  const norm = s => fixPm(fixSqrt(String(s || '').replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()));

  // Nhãn của các trường (chữ hoa, chấp nhận lỗi OCR nhẹ); dừng gom dòng khi gặp nhãn khác
  const L = {
    manuf: /MANUFACTUR(?:ER|E)?\b|MAKER\b|H[ÃA]NG\s+S[ẢA]N(?:\s+XU[ẤA]T)?/i,
    type: /TRANSFORMER\s+(CODE|TYPE)|^\s*TYPE\b|\bMODEL\b|KI[ỂE]U\s+(LO[ẠA]I|M[ÁA]Y)/i,
    serial: /SERIAL|S\s*\/\s*N\b|SER\.?\s*NO|S[ỐO]\s+CH[ẾE]\s+T[ẠA]O/i,
    year: /YEAR|DATE\s+OF\s+MANUF|N[ĂA]M\s+S[ẢA]N/i,
    power: /RATED\s*(POWER|CAPACITY|OUTPUT)|C[ÔO]NG\s+SU[ẤA]T/i,
    voltage: /RATED\s*VOLTAGE|[ĐD]I[ỆE]N\s+[ÁA]P\s+[ĐD][ỊI]NH/i,
    current: /RATED\s*CURRENT|D[ÒO]NG\s+[ĐD]I[ỆE]N\s+[ĐD][ỊI]NH|D[ÒO]NG\s+[ĐD][ỊI]NH/i,
    vector: /CONNECTION\s*SYMBOL|VECTOR\s*GROUP|T[ỔO]\s+[ĐD][ẤA]U/i,
    oltc: /\bOLTC\s*(CODE|TYPE)|TAP\s*-?\s*CHANGER\s*(CODE|TYPE)/i,
    i0: /NO\s*-?\s*LOAD\s*CURRENT|D[ÒO]NG\s+KH[ÔO]NG\s+T[ẢA]I/i,
    other: /FREQUENCY|PHASES|COOLING|STANDARD|TEMPERATURE|MASS|WEIGHT|OIL|LOSS|IMPEDANCE|INSULATION|SOUND|INSTRUCTION|SHORT\s+CIRCUIT|TAP\s+POSITION|STEP/i,
  };
  const anyLabel = text => Object.values(L).some(re => re.test(text));

  // Phần chữ sau nhãn trên cùng dòng (bỏ dấu ":"), kèm các dòng tiếp theo chưa có nhãn khác (bảng nhiều dòng)
  function after(lines, i, re, more = 0) {
    const t = lines[i].text, m = t.match(re);
    const rest = m ? t.slice(m.index + m[0].length) : t;
    const seg = [{ text: rest.replace(/^[\s:.\-–—|]+/, ''), line: lines[i] }];
    for (let k = i + 1; k <= i + more && k < lines.length && !anyLabel(lines[k].text); k++) seg.push({ text: lines[k].text, line: lines[k] });
    return seg;
  }
  // Độ tin cậy của một giá trị: nhỏ nhất của các từ OCR tạo nên giá trị (không có thông tin từ thì theo dòng)
  function confOf(value, lines) {
    const v = String(value).replace(/\s/g, '');
    const ws = lines.flatMap(l => l.words || []).filter(w => w.text && w.text.length > 0 && v.includes(String(w.text).replace(/\s/g, '').replace(/[:;,]$/, '')));
    if (ws.length) return Math.round(Math.min(...ws.map(w => w.conf)));
    const lc = lines.map(l => l.conf).filter(Number.isFinite);
    return lc.length ? Math.round(Math.min(...lc)) : 0;
  }
  const result = (value, conf, valid, why = '', raw = value) => ({
    value, conf, raw, why, status: !value ? 'missing' : (valid && conf >= OK_CONF && !why ? 'ok' : 'check'),
  });
  const missing = why => ({ value: '', conf: 0, raw: '', why, status: 'missing' });

  // Trường một giá trị: tìm dòng có nhãn, lấy giá trị theo mẫu; không có nhãn thì dò cả văn bản theo mẫu (kém chắc chắn)
  function single(lines, label, pat, opts = {}) {
    for (let i = 0; i < lines.length; i++) {
      if (!label.test(lines[i].text) || (opts.skip && opts.skip.test(lines[i].text))) continue;
      const seg = after(lines, i, label, opts.more || 1);
      for (const s of seg) {
        const src = opts.digits ? fixDigits(s.text) : s.text;
        const m = src.match(pat);
        if (m) {
          const v = (opts.clean ? opts.clean(m[0]) : m[0]).trim();
          const orig = s.text.slice(m.index, m.index + m[0].length); // sửa O→0, l→1 giữ nguyên độ dài
          const why = [s.line !== lines[i] ? 'giá trị ở dòng dưới nhãn' : '', orig !== m[0] ? `đã sửa ký tự OCR “${orig}” → “${m[0]}”` : '',
            /\s/.test(m[0].trim()) && !/\s/.test(v) ? `đã bỏ khoảng trắng trong “${m[0].trim()}”` : '',
            !/\s/.test(m[0].trim()) && v.replace(',', '.') !== m[0].trim().replace(',', '.') && v.length === m[0].trim().length ? `đã sửa ký tự OCR “${m[0].trim()}” → “${v}”` : ''].filter(Boolean).join('; ');
          return result(v, confOf(orig, [s.line]), true, why, orig);
        }
      }
    }
    if (opts.scan) {
      for (const l of lines) {
        const src = opts.digits ? fixDigits(l.text) : l.text;
        const m = src.match(opts.scan);
        if (m) return result(m[0].trim(), confOf(m[0], [l]), true, 'không thấy nhãn, dò theo dạng giá trị');
      }
    }
    return missing('không thấy trên ảnh');
  }

  // Trường theo cuộn HV/MV/LV: ưu tiên ký hiệu cuộn, không có thì theo thứ tự xuất hiện
  const NUMLIST = /\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)*/g;
  // công suất theo cấp làm mát luôn ghi dạng "180/240/300" — tránh nhận nhầm số đơn lẻ (vd IEC 60076)
  const SLASHLIST = /\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)+/g;
  const VOLT = /\d+(?:[.,]\d+)?\s*(?:\/\s*√3)?(?:\s*[±+]\s*\d+\s*[x×*]\s*\d+(?:[.,]\d+)?\s*%)?/g;
  function windings(lines, label, pat) {
    // bỏ nhãn trùng tên trong bảng thông số OLTC ("OLTC RATING … RATED CURRENT … STEP VOLTAGE")
    const i = lines.findIndex(l => label.test(l.text) && !/OLTC|STEP|CODE/i.test(l.text));
    if (i < 0) return null;
    const seg = after(lines, i, label, 4);
    const tagged = {}, order = [];
    seg.forEach(s => {
      const t = norm(fixDigits(s.text));
      const re = /\b(HV|MV|LV|TV|H\.V\.?|M\.V\.?|L\.V\.?)\b[\s:.\-]*/gi;
      let m, any = false;
      const tags = [];
      while ((m = re.exec(t))) tags.push({ w: m[1].replace(/\./g, '').toUpperCase().replace('TV', 'LV'), at: m.index + m[0].length });
      tags.forEach((g, k) => {
        const part = t.slice(g.at, k + 1 < tags.length ? tags[k + 1].at : undefined);
        const v = (part.match(pat) || [])[0];
        if (v && !tagged[g.w]) { tagged[g.w] = { v: v.trim(), line: s.line }; any = true; }
      });
      if (!any && !tags.length) (t.match(pat) || []).forEach(v => order.push({ v: v.trim(), line: s.line }));
    });
    const byTag = ['HV', 'MV', 'LV'].filter(w => tagged[w]);
    if (byTag.length) return { vals: ['HV', 'MV', 'LV'].map(w => tagged[w]).filter(Boolean), ordered: false, full: byTag.length === 3 };
    return order.length ? { vals: order.slice(0, 3), ordered: true, full: order.length >= 3 } : { vals: [], ordered: true, full: false };
  }
  // Không đọc được nhãn (chữ nhãn mờ): nhận theo hàng có ký hiệu cuộn ở đầu và đơn vị ở cuối, vd "HV 624/831/1039 A".
  // OCR hay đọc HV thành HY, H V.
  function byUnit(lines, unit, pat) {
    const tagged = {};
    const re = new RegExp(`(?:^|[^A-Z])(H\\s?[VY]|M\\s?V|L\\s?V|TV)\\b[\\s|\\[\\](:.\\-]*(${pat.source})[\\s|\\]\\)_]*${unit}(?![A-Za-z])`);
    lines.forEach(l => {
      const t = fixDigits(l.text), m = t.match(re);
      if (!m) return;
      const w = m[1].replace(/\s/g, '').replace('HY', 'HV').replace('TV', 'LV');
      if (!tagged[w]) tagged[w] = { v: m[2].trim(), line: l };
    });
    const ws = ['HV', 'MV', 'LV'].filter(w => tagged[w]);
    return ws.length ? { vals: ws.map(w => tagged[w]), ordered: false, full: ws.length === 3, byUnit: true } : null;
  }

  // need3: giá trị ghép từ cả ba cuộn (điện áp, dòng); không thì chỉ lấy cuộn HV (công suất)
  function multi(lines, label, pat, compose, what, need3 = true, unit = null) {
    let w = windings(lines, label, pat);
    if ((!w || !w.vals.length) && unit) w = byUnit(lines, unit, pat) || w;
    if (!w || !w.vals.length) return missing(w ? 'thấy nhãn nhưng không đọc được số' : 'không thấy trên ảnh');
    if (!need3) w.vals = w.vals.slice(0, 1);
    const value = compose(w.vals.map(x => x.v));
    // các cuộn có cùng số cấp làm mát (vd 3 giá trị "624/831/1039"); khác nhau thường do dấu "/" bị đọc thành "1"
    const slashes = new Set(w.vals.map(x => (x.v.match(/\//g) || []).length));
    const why = [w.byUnit ? 'không đọc được nhãn, nhận theo ký hiệu cuộn và đơn vị' : '',
      need3 && !w.full ? `chỉ đọc được ${w.vals.length}/3 cuộn` : '',
      pat === NUMLIST && slashes.size > 1 ? 'số giá trị giữa các cuộn không khớp — nghi dấu “/” đọc thành số' : '',
      w.ordered ? (need3 ? `ghép ${what} theo thứ tự HV, MV, LV (không thấy ký hiệu cuộn)` : `lấy ${what} đầu tiên làm cuộn HV (không thấy ký hiệu cuộn)`) : ''].filter(Boolean).join('; ');
    // thiếu cuộn → giá trị không đúng dạng BBTN: hiện để tham khảo nhưng không điền sẵn (weak)
    return Object.assign(result(value, Math.min(...w.vals.map(x => confOf(x.v, [x.line]))), true, why, w.vals.map(x => x.v).join(' | ')), { weak: need3 && !w.full });
  }
  const maxOf = v => { const ns = v.split('/').map(x => parseFloat(x.replace(',', '.'))).filter(Number.isFinite); return ns.length ? String(Math.max(...ns)) : v; };

  // Nameplate dạng bảng: OCR thường đọc cột nhãn và cột giá trị thành hai khối riêng. Có toạ độ thì ghép các dòng
  // nằm cùng hàng trên ảnh (bù độ nghiêng của ảnh theo đường chân chữ) thành một dòng "NHÃN giá trị", trái sang phải.
  function rows(lines) {
    if (!lines.every(l => l.bbox)) return lines;
    const slopes = lines.filter(l => l.baseline && l.bbox.x1 - l.bbox.x0 > 150)
      .map(l => (l.baseline.y1 - l.baseline.y0) / Math.max(1, l.baseline.x1 - l.baseline.x0)).sort((a, b) => a - b);
    const k = slopes.length ? slopes[slopes.length >> 1] : 0;
    const items = lines.map(l => {
      const b = l.bbox, h = b.y1 - b.y0;
      return { l, h, x: b.x0, y: (b.y0 + b.y1) / 2 - k * (b.x0 + b.x1) / 2 };
    }).sort((a, b) => a.y - b.y);
    const groups = [];
    items.forEach(it => {
      const g = groups[groups.length - 1];
      if (g && Math.abs(it.y - g.y) < 0.6 * Math.min(it.h, g.h)) { g.items.push(it); g.y = (g.y * (g.items.length - 1) + it.y) / g.items.length; } else groups.push({ y: it.y, h: it.h, items: [it] });
    });
    return groups.map(g => {
      const ls = g.items.sort((a, b) => a.x - b.x).map(x => x.l);
      return { text: ls.map(l => l.text).join(' '), conf: Math.min(...ls.map(l => l.conf)), words: ls.flatMap(l => l.words || []) };
    });
  }

  // lines: [{ text, conf, bbox?, baseline?, words: [{ text, conf }] }] theo thứ tự đọc
  // Khoảng cách sửa chữ (Levenshtein) để so S/N đọc được với danh sách S/N đã biết
  function dist(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  // S/N đối chiếu file xuất xưởng: khớp → giữ; lệch 1–2 ký tự → chọn S/N trong file, cần kiểm tra; không có → cần kiểm tra
  function checkSerial(f, known) {
    if (!known || !known.length || !f.value) return f;
    const v = f.value.toUpperCase();
    if (known.some(k => k.toUpperCase() === v)) return f;
    const near = known.map(k => ({ k, d: dist(v, k.toUpperCase()) })).sort((a, b) => a.d - b.d)[0];
    if (near.d <= 2) return Object.assign({}, f, { value: near.k, status: 'check', why: [f.why, `đọc được “${f.value}”, gần với S/N ${near.k} trong file xuất xưởng — đã chọn S/N này`].filter(Boolean).join('; ') });
    return Object.assign({}, f, { status: 'check', weak: true, why: [f.why, 'không có trong file xuất xưởng đã nạp'].filter(Boolean).join('; ') });
  }

  // opts.serials: danh sách S/N trong file xuất xưởng (để đối chiếu số chế tạo)
  function parse(input, opts = {}) {
    const lines = rows(input).map(l => Object.assign({}, l, { text: norm(l.text) })).filter(l => l.text);
    const f = {};
    // tên hãng: cả phần còn lại của dòng (ký tự lạ do OCR vẫn giữ để độ tin cậy thấp của từ đó lộ ra)
    f['meta.manuf'] = single(lines, L.manuf, /[A-Z].{3,}/, { more: 1, clean: s => s.replace(/[\s|_—–-]+$/, '') });
    if (f['meta.manuf'].status === 'missing') {
      const l = lines.find(x => /\b(CO\.?,?\s*LTD|CORPORATION|CORP\b|GMBH|ELECTRIC\s+(CO\b|WORKS|CORP)|TRANSFORMER\s+(CO\b|WORKS|FACTORY)|INC\b)/i.test(x.text));
      if (l) f['meta.manuf'] = result(l.text, confOf(l.text, [l]), true, 'không thấy nhãn, lấy dòng có tên công ty');
    }
    f['meta.type'] = single(lines, L.type, /[A-Z][A-Z0-9]*(?:\s[A-Z0-9]+)*\s*-\s*\d+(?:\s*\/\s*\d+)*[A-Z0-9-]*/, { skip: /OIL|COOLING|OLTC|TAP/i, more: 1, clean: s => s.replace(/\s+/g, ''), scan: /\b[A-Z]{3,}[A-Z0-9]*-\d{4,}\/\d{2,3}\b/ });
    f['meta.serial'] = single(lines, L.serial, /\b[A-Z]{0,3}\d{5,}[A-Z0-9-]*\b/, { digits: true, more: 1 });
    f['meta.year'] = single(lines, L.year, /\b(19[5-9]\d|20[0-9]\d)\b/, { digits: true, more: 1 });
    f['meta.power'] = multi(lines, L.power, SLASHLIST, vs => vs[0].replace(/\s/g, ''), 'công suất', false, 'MVA');
    f['meta.voltage'] = multi(lines, L.voltage, VOLT, vs => vs.map(v => v.replace(/\s*\/\s*√3/, '/√3').replace(/\s*([±+])\s*/, ' ±').replace(/\s*[x×*]\s*/, '×').replace(/\s+%/, '%')).join('/'), 'điện áp', true, 'kV');
    f['meta.current'] = multi(lines, L.current, NUMLIST, vs => vs.map(maxOf).join('/'), 'dòng điện', true, 'A');
    // tổ đấu dây: chữ O đứng trước ký hiệu cuộn tiếp theo là số 0 (YNaOd11 → YNa0d11)
    const vec = s => s.replace(/(?<=[A-Za-z])[Oo](?=[dDyYzZ]\d)/g, '0');
    f['meta.vector'] = single(lines, L.vector, /\b(?:YN|Y|D|Z|I)[a-zA-Z]*[\dO]{1,2}(?:[a-zA-Z]+\d{1,2})*\b/, { more: 1, clean: vec, scan: /\bYN?a?[\dO]{1,2}[dy]\d{1,2}\b/i });
    // mã OLTC: từ đầu tiên có chữ số và các nhóm nối bằng - / . (bỏ chữ nhiễu đứng trước)
    f['oltc.type'] = single(lines, L.oltc, /\b[A-Z]+\d[A-Z0-9]*(?:[-/.][A-Z0-9]+)+/i, { more: 1 });
    f['cfg.i0Ref'] = single(lines, L.i0, /\d+(?:[.,]\d+)?(?=\s*%)|\b0[.,]\d+\b/, { digits: true, more: 1, clean: s => s.replace(',', '.') });
    // I0 của MBA lực vài phần trăm trở xuống, luôn có phần thập phân; "004" là mất dấu chấm
    const i0 = f['cfg.i0Ref'];
    if (i0.value && !(/^\d*\.\d+$/.test(i0.value) && +i0.value < 5)) f['cfg.i0Ref'] = Object.assign({}, i0, { status: 'check', weak: true, why: [i0.why, 'giá trị bất thường cho I0 (%) — nghi mất dấu thập phân'].filter(Boolean).join('; ') });
    f['meta.serial'] = checkSerial(f['meta.serial'], opts.serials);
    return f;
  }

  // Trường đọc được: nhãn hiển thị, ô biểu mẫu tương ứng
  const FIELDS = [
    ['meta.manuf', 'Hãng sản xuất'], ['meta.type', 'Kiểu loại'], ['meta.serial', 'Số chế tạo (máy chính)'], ['meta.year', 'Năm sản xuất'],
    ['meta.power', 'Công suất (MVA)'], ['meta.voltage', 'Điện áp định mức'], ['meta.current', 'Dòng định mức (A)'], ['meta.vector', 'Tổ đấu dây'],
    ['oltc.type', 'Kiểu OLTC (mục 9)'], ['cfg.i0Ref', 'I0 nameplate (%) — cấu hình mục 0'],
  ];

  // Số trường đọc được (rõ hoặc cần kiểm tra); kết hợp hai lượt đọc: mỗi trường lấy bản tốt hơn (rõ > cần kiểm tra > thiếu,
  // cùng mức thì độ tin cậy cao hơn)
  const RANKS = { ok: 2, check: 1, missing: 0 };
  const found = f => Object.values(f).filter(x => x.status !== 'missing').length;
  const best = (a, b) => Object.fromEntries(Object.keys(a).map(k => {
    const x = a[k], y = b[k] || x;
    return [k, RANKS[y.status] > RANKS[x.status] || (RANKS[y.status] === RANKS[x.status] && y.conf > x.conf) ? y : x];
  }));

  window.MbaNameplate = { parse, rows, found, best, FIELDS, OK_CONF };
})();
