// Bộ đọc file xuất từ máy đo Haefely 2293 (Winding Analyzer): .csv (UTF-16, tab) có điện trở một chiều theo nấc,
// tỷ số biến theo nấc, thông số chuyển nấc OLTC; .bin cùng tên có dạng sóng điện trở động (chụp sóng OLTC).
// Định dạng .bin theo macro DRM Test Report V1.04 của hãng: int16 phiên bản, dòng tiêu đề UTF-16, rồi mỗi lần chuyển nấc
// 3 khối pha, mỗi khối = tiêu đề "1->2:A-N" (UTF-16, kết thúc CR LF) + 3250 mẫu (float32 U, float32 I), lấy mẫu 6500 Hz.
(function () {
  'use strict';
  const NS = 3250, FS = 6500;          // số mẫu mỗi khối, tần số lấy mẫu (Hz)
  const BAD = 3e38;                    // máy ghi 3.4E+38 (float32 ≈ 3,39999995E+38) cho mẫu không có số liệu

  // ---------------------------------------------------------------- .csv
  // File .csv của 2293 là UTF-16 LE có BOM; file đã lưu lại bằng trình khác có thể là UTF-8
  function decode(buf) {
    const b = new Uint8Array(buf);
    if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(b.subarray(2));
    if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(b.subarray(2));
    if (b.length > 1 && b[1] === 0 && b[0] !== 0) return new TextDecoder('utf-16le').decode(b);
    return new TextDecoder('utf-8').decode(b).replace(/^﻿/, '');
  }

  const num = s => { const n = parseFloat(String(s == null ? '' : s).trim().replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const cells = line => line.split('\t').map(c => c.trim());

  // Tách thành các phần "***** Tên *****" → mảng dòng (đã tách ô)
  function sections(text) {
    const out = {};
    let cur = '_head';
    out[cur] = [];
    text.split(/\r?\n/).forEach(line => {
      const m = line.match(/^\*{3,}\s*(.+?)\s*\*{3,}/);
      if (m) { cur = m[1]; out[cur] = []; return; }
      out[cur].push(cells(line));
    });
    return out;
  }

  // Bảng có hàng tiêu đề bắt đầu bằng "Time": trả về các hàng dạng { tên cột: giá trị }
  function table(rows) {
    const hi = rows.findIndex(r => r[0] === 'Time');
    if (hi < 0) return [];
    const head = rows[hi];
    const out = [];
    for (let i = hi + 1; i < rows.length && rows[i].some(Boolean); i++) {
      const o = {};
      head.forEach((h, k) => { if (h) o[h] = rows[i][k]; });
      out.push(o);
    }
    return out;
  }
  const pick = (o, re) => { const k = Object.keys(o).find(x => re.test(x)); return k ? o[k] : ''; };
  const decimals = s => { const m = String(s).trim().match(/\.(\d+)/); return m ? m[1].length : 0; };

  // "HV/17/A-N" → cuộn HV, nấc 17, đấu nối A-N; cuộn không có nấc: "LV/a-n"
  function rdcRow(o) {
    const parts = String(o.Description || '').split('/');
    const r = pick(o, /^Resistance/i);
    return {
      time: o.Time, winding: parts[0] || '', tap: parts.length > 2 ? parts[1] : '', conn: parts[parts.length - 1] || '',
      i: num(pick(o, /^Current/i)), t: num(pick(o, /^Temperature/i)), r: num(r), rDec: decimals(r), rCorr: num(pick(o, /^Corr/i)),
    };
  }
  // "HV:17/LV/A-N:a-n" → cuộn 1 HV nấc 17, cuộn 2 LV, đấu nối A-N:a-n
  function ratioRow(o) {
    const parts = String(o.Description || '').split('/');
    const [w1, tap1] = (parts[0] || '').split(':');
    const [w2, tap2] = (parts[1] || '').split(':');
    const v = pick(o, /^Ratio Volts/i) || pick(o, /^Ratio Turns/i) || pick(o, /^Ratio Raw/i);
    return {
      time: o.Time, w1: w1 || '', tap: tap1 || '', w2: w2 || '', tap2: tap2 || '', conn: o.Connection || parts[parts.length - 1] || '',
      ratio: num(v), ratioDec: decimals(v), phaseDeg: num(pick(o, /^Phase/i)), dev: num(pick(o, /^Deviation \[/i)), u: num(pick(o, /^Voltage/i)),
    };
  }

  // Bảng chuyển nấc: mỗi hàng là một đại lượng, mỗi cột là một lần chuyển nấc
  const OLTC_ROWS = [
    ['t', /^Temperature/], ['ub', /^Static Voltage Before/], ['ib', /^Static Current Before/], ['rb', /^Static Resistance Before/],
    ['ua', /^Static Voltage After/], ['ia', /^Static Current After/], ['ra', /^Static Resistance After/],
    ['tFall', /^tFall/], ['tRise', /^tRise/], ['delta', /^Delta/],
  ];
  function oltcRows(rows) {
    const hr = rows.find(r => /^Tap Transition/.test(r[0]));
    if (!hr) return [];
    const labels = hr.slice(1).filter(Boolean);
    return labels.map((lbl, k) => {
      const m = lbl.match(/^\s*(\w+)\s*->\s*(\w+)\s*:?\s*(.*)$/) || [];
      const o = { tr: lbl, from: m[1] || '', to: m[2] || '', conn: m[3] || '' };
      OLTC_ROWS.forEach(([key, re]) => { const r = rows.find(x => re.test(x[0])); o[key] = r ? num(r[k + 1]) : NaN; });
      return o;
    });
  }

  function parseCsv(text, fileName) {
    const S = sections(text);
    if (!S['WA2293'] && !/HTAG Document Export/.test((S._head[0] || [])[0] || '')) throw new Error(`${fileName}: không phải file .csv xuất từ Haefely 2293`);
    const head = S._head, dev = S['WA2293'] || [];
    const exp = head.findIndex(r => r[0] === 'Created');
    const devVal = re => { const r = dev.find(x => re.test(x[0])); return r ? r[1] : ''; };
    const gen = S['DUT General'] || [];
    const gi = gen.findIndex(r => /Seria\s*l\s*Number/i.test(r[0]));
    const corrT = rows => { const r = (rows || []).find(x => /^Correction Temperature/.test(x[0])); return r ? num(r[1]) : NaN; };
    // Số nấc khai trong máy đo (bảng "Taps" của cuộn có nấc)
    const spec = S['DUT Specification'] || [];
    const ti = spec.findIndex(r => /^-+\s*Taps/.test(r[0]));
    let nTaps = 0;
    if (ti >= 0) for (let i = ti + 2; i < spec.length && spec[i].some(Boolean); i++) if (spec[i][1]) nTaps++;
    return {
      file: fileName,
      created: exp >= 0 && head[exp + 1] ? head[exp + 1][0] : '',
      exported: exp >= 0 && head[exp + 1] ? head[exp + 1][2] : '',
      device: { model: 'Haefely 2293', serial: devVal(/^Serial/), fw: devVal(/^Firmware/) },
      dut: gi >= 0 && gen[gi + 1] ? gen[gi + 1][0] : '',
      nTaps,
      rdc: table(S['Resistance Measurement'] || []).map(rdcRow).filter(r => Number.isFinite(r.r)),
      rdcCorrT: corrT(S['Resistance Measurement']),
      ratio: table(S['Turns Ratio Measurement'] || []).map(ratioRow).filter(r => Number.isFinite(r.ratio)),
      oltc: oltcRows(S['Tap Changer Measurement'] || []),
    };
  }

  // ---------------------------------------------------------------- .bin
  function parseBin(buf, fileName) {
    const dv = ArrayBuffer.isView(buf) ? new DataView(buf.buffer, buf.byteOffset, buf.byteLength) : new DataView(buf);
    const len = dv.byteLength;
    let pos = 0;
    if (len < 2) throw new Error(`${fileName}: file .bin rỗng`);
    const version = dv.getInt16(0, true);
    pos = 2;
    // dòng chữ UTF-16 đến CR LF
    const line = () => {
      let s = '';
      while (pos + 1 < len) {
        const c = dv.getUint16(pos, true); pos += 2;
        if (c === 13 && pos + 1 < len && dv.getUint16(pos, true) === 10) { pos += 2; break; }
        if (c && c !== 10) s += String.fromCharCode(c);
      }
      return s;
    };
    line(); // dòng đầu (trống)
    const waves = [];
    while (pos + 2 < len) {
      const label = line().trim();
      const n = Math.min(NS, Math.floor((len - pos) / 8));
      if (n <= 0) break;
      const v = new Float32Array(n), i = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        const a = dv.getFloat32(pos, true), b = dv.getFloat32(pos + 4, true); pos += 8;
        v[k] = a >= BAD || !Number.isFinite(a) ? NaN : a;
        i[k] = b >= BAD || !Number.isFinite(b) ? NaN : b;
      }
      const m = label.match(/^\s*(\w+)\s*->\s*(\w+)\s*:?\s*(.*)$/) || [];
      waves.push({ tr: label, from: m[1] || '', to: m[2] || '', conn: m[3] || '', dt: 1 / FS, v, i, iMed: median(i) });
    }
    // Khối của pha không đo (máy 1 pha đo từng pha) có dòng ≈ 0 → bỏ
    const top = Math.max(0, ...waves.map(w => w.iMed || 0));
    return { file: fileName, version, waves: waves.filter(w => w.iMed > 0.1 * top && w.iMed > 0.01) };
  }
  function median(a) {
    const s = Array.from(a).filter(x => !Number.isNaN(x)).sort((x, y) => x - y);
    return s.length ? s[s.length >> 1] : 0;
  }

  // Pha đoán theo tên file (máy 1 pha đo từng máy với cùng dây đo A-N nên tên file đáng tin hơn đấu nối):
  // "…TAP-A", "…TSB B", "…pha C" → A/B/C; không có thì theo đấu nối "A-N"
  function guessPhase(fileName, conn) {
    const base = String(fileName || '').replace(/\.[^.]+$/, '').trim();
    const m = base.match(/(?:^|[\s_\-.])(?:pha\s*)?([ABC])$/i);
    if (m) return { phase: m[1].toUpperCase(), from: 'name' };
    const c = String(conn || '').trim().charAt(0).toUpperCase();
    return ['A', 'B', 'C'].includes(c) ? { phase: c, from: 'conn' } : { phase: 'A', from: 'none' };
  }

  window.Wa2293 = { decode, parseCsv, parseBin, guessPhase, FS, NS };
})();
