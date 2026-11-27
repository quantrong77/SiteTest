// Đọc file .txt xuất từ máy đo tgδ Doble M4000 ("M4000 - Clipboard"): thông tin chung (ngày, trạm, thiết bị, nhiệt độ)
// và bảng "Test Results": No | Test ID | LC | Circ. Desc. (GAR/UST/GND) | kV | mA | Watts | Meas. %PF | Corr. Fctr | Corr. %PF | Cap./Ind.
// Dòng chỉ có chữ và hệ số (vd "DAY QUAN:", "SU:", "Pha A (26-11-2026)") là đề mục nhóm: xác định nhóm (cuộn dây / sứ) và pha
// của các dòng số liệu sau nó. Dòng đo kích từ (đơn vị H, "khong tai") xếp nhóm không tải. Không tự quy đổi: lấy %PF đo.
(function () {
  'use strict';
  const num = s => Number(String(s).replace(',', '.'));
  // dòng số liệu: số TT, Test ID, LC (A–H), sơ đồ đo, 7 số, giá trị điện dung / điện cảm và đơn vị
  const ROW = /^\s*(\d+)\s+(.*?)\s+([A-H])\s+(GAR|UST|GND)(?:-(\w+))?\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*(pF|nF|uF|µF|mH|H)?\s*$/i;
  // dòng đề mục: số TT, chữ, hệ số hiệu chỉnh
  const HEAD = /^\s*(\d+)\s+(.+?)\s+(-?[\d.]+)\s*$/;
  const groupOf = t => (/d[aâ]y\s*qu[aấ]n|winding|cu[oộ]n\s*d[aâ]y/i.test(t) ? 'winding' : /^\s*(s[uứ]|bushings?)\b/i.test(t) ? 'bushing' : /kh[oô]ng\s*t[aả]i|exciting|excitation/i.test(t) ? 'noload' : '');
  const phaseOf = t => { const m = String(t).match(/(?:^|[^a-z])(?:pha|phase)\s*:?\s*([ABC])(?![a-z])/i); return m ? m[1].toUpperCase() : ''; };
  const TO_PF = { pf: 1, nf: 1e3, uf: 1e6, 'µf': 1e6 };

  function parse(text, fileName = '') {
    const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/);
    if (!lines.some(l => /Test Results/i.test(l)) || !lines.some(l => /Circ\.|Meas\.\s*%PF|%PF/i.test(l)))
      throw new Error(`${fileName || 'Tệp'}: không phải file Doble M4000 (.txt) — thiếu bảng "Test Results".`);
    const meta = { file: fileName };
    const grab = (re, k) => { const l = lines.find(x => re.test(x)); const m = l && l.match(re); if (m) meta[k] = m[1].trim(); };
    grab(/Date\s*\(DD\/MM\/YY\)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i, 'date');
    grab(/\bTime\s+(\d{1,2}:\d{2}\s*[AP]M)/i, 'time');
    grab(/^Location\s+(.+)$/i, 'location');
    grab(/^Equipment\s+(.+)$/i, 'equipment');
    grab(/^Serial Number\s+(.+)$/i, 'serial');
    grab(/Air Temperature\s+(-?[\d.]+)/i, 'airT');
    grab(/Oil Temperature\s+(-?[\d.]+)/i, 'oilT');
    grab(/Humidity\s+(-?[\d.]+)/i, 'humidity');
    const items = [];
    let group = '', phase = '', block = 0;
    // chỉ dòng bắt đầu bằng số thứ tự là dòng số liệu / đề mục; tiêu đề cột, gạch ngang bỏ qua
    for (let i = lines.findIndex(x => /Test Results/i.test(x)) + 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^LC \(Line Configuration\)/i.test(l)) break;
      const m = l.match(ROW);
      if (m) {
        const label = m[2].trim(), unit = (m[13] || '').trim(), val = num(m[12]);
        const g = /h$/i.test(unit) ? 'noload' : groupOf(label) === 'noload' ? 'noload' : group;
        items.push({ no: +m[1], label, lc: m[3], mode: m[4].toUpperCase(), lead: m[5] || '', kv: num(m[6]), ma: num(m[7]), watts: num(m[8]),
          pf: num(m[9]), corrF: num(m[10]), corrPf: num(m[11]), cap: /f$/i.test(unit) ? val * (TO_PF[unit.toLowerCase()] || 1) : NaN,
          ind: /h$/i.test(unit) ? val * (/^mh$/i.test(unit) ? 1e-3 : 1) : NaN, unit, group: g, phase: phaseOf(label) || phase, block });
        continue;
      }
      const h = l.match(HEAD);
      if (h && !/^\s*\d+\s*$/.test(h[2])) {
        const t = h[2].trim(), g = groupOf(t), p = phaseOf(t);
        if (g) { group = g; phase = p; } else if (p) phase = p;
        block++;
      }
    }
    if (!items.length) throw new Error(`${fileName || 'Tệp'}: không đọc được dòng số liệu nào trong bảng "Test Results".`);
    return { meta, items };
  }

  window.DobleM4000 = { parse, phaseOf, groupOf };
})();
