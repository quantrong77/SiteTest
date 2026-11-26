// Đọc CSV DIRANA: trích phép đo, nhãn sứ, pha và dữ liệu đáp ứng tần số.
// Hai dạng file: [FDSData] (cột Tan Delta, c') và bản 4.x [FrequencySweeps] (cột Tangent Delta, C(Real)); tgδ tính bằng %, C bằng F.
(function () {
  'use strict';
  function identify(name) {
    const s = String(name || '').match(/bushing(\d+(?:_\d+)?|N|TT|neutral)(?:L2|_L2)?_([ABC])(?:_lan2)?$/i);
    if (!s) return { side: '', phase: '', label: '' };
    const raw = s[1], upper = raw.toUpperCase();
    let label = upper === 'N' || upper === 'TT' || upper === 'NEUTRAL' ? 'TT' : raw.replace('_', '.');
    let side = /^(N|TT|NEUTRAL)$/i.test(raw) ? 'N' : /_1$/.test(raw) ? 'LV1' : /_2$/.test(raw) ? 'LV2' : '';
    return { side, phase: s[2].toUpperCase(), label };
  }
  function splitRow(line, sep) {
    const row=[]; let cell='', quote=false;
    for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'&&line[i+1]==='"'&&quote){cell+='"';i++;}else if(ch==='"')quote=!quote;else if(ch===sep&&!quote){row.push(cell.trim());cell='';}else cell+=ch;}
    row.push(cell.trim()); return row;
  }
  // Ngày DIRANA: "18/03/2026 08:52:36" giữ nguyên; bản 4.x "26-Nov-26 2:08:37 PM" → "26/11/2026 14:08:37"
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function normDate(s) {
    const t = String(s || '').trim(), m = t.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
    if (!m || !MON[m[2].toLowerCase()]) return t;
    const p2 = x => String(x).padStart(2, '0'), y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    let out = `${p2(m[1])}/${p2(MON[m[2].toLowerCase()])}/${y}`;
    if (m[4] !== undefined) {
      let h = Number(m[4]) % 12; if (!m[7]) h = Number(m[4]); else if (/pm/i.test(m[7])) h += 12;
      out += ` ${p2(h)}:${m[5]}:${m[6] || '00'}`;
    }
    return out;
  }
  function parse(text, fileName = '') {
    const source = String(text || '').replace(/^\uFEFF/, '');
    if (!/^\s*\[DIRANA CSV\]/im.test(source)) throw new Error(`${fileName || 'Tệp'}: không phải CSV DIRANA (thiếu [DIRANA CSV]).`);
    if (!/^\s*\[(FDSData|FrequencySweeps)\]\s*$/im.test(source)) throw new Error(`${fileName || 'Tệp'}: không có phần [FDSData] / [FrequencySweeps].`);
    const decimal = (source.match(/^\s*Version\s*[,;]\s*Decimal\s*\r?\n\s*[^,;]+\s*[,;]\s*(point|comma)\s*$/im) || [])[1] || 'point';
    const sep = decimal.toLowerCase() === 'comma' ? ';' : ',';
    const sections = {};
    const lines = source.split(/\r?\n/); let section = '';
    lines.forEach(line => { const h = line.trim().match(/^\[(.+)\]$/); if (h) { section = h[1]; sections[section] = []; } else if (section && line.trim()) sections[section].push(splitRow(line, sep).map(x => x.replace(/^"|"$/g, ''))); });
    const measurements = sections.Measurements || [], mh = measurements.findIndex(r => r[0].toLowerCase() === 'id');
    if (mh < 0) throw new Error(`${fileName || 'Tệp'}: thiếu tiêu đề [Measurements].`);
    const mi = Object.fromEntries(measurements[mh].map((x, i) => [x.toLowerCase(), i]));
    // [Test] (bản 4.x): kiểu đối tượng đo (vd AutoTransformerTertiary, Transformer3W) — dùng nhận dạng cách điện CHT / CHL
    const test = sections.Test || [], th = test.findIndex(r => (r[0] || '').toLowerCase() === 'name');
    const ti = th < 0 ? {} : Object.fromEntries(test[th].map((x, i) => [x.toLowerCase(), i])), tr = th < 0 ? null : test[th + 1];
    const objType = tr && ti['test object type'] !== undefined ? tr[ti['test object type']] || '' : '';
    const info = new Map(measurements.slice(mh + 1).map(r => [r[mi.id], { name: r[mi.name] || '', date: normDate(r[mi.date] || ''), serial: r[mi['test object serial']] || '', temp: mi.temperature === undefined ? '' : (r[mi.temperature] || '') }]));
    const sec = sections.FDSData ? 'FDSData' : 'FrequencySweeps', data = sections[sec], dh = data.findIndex(r => r[0].toLowerCase() === 'id');
    if (dh < 0) throw new Error(`${fileName || 'Tệp'}: thiếu tiêu đề cột [${sec}].`);
    const di = Object.fromEntries(data[dh].map((x, i) => [x.toLowerCase(), i])), groups = new Map();
    const col = (...names) => names.map(n => di[n]).find(i => i !== undefined);
    const iTan = col('tan delta', 'tangent delta'), iC = col("c'", 'c(real)'), iCi = col('c"', 'c(imag)');
    if (di.frequency === undefined || iTan === undefined || iC === undefined) throw new Error(`${fileName || 'Tệp'}: [${sec}] thiếu cột Frequency / Tan Delta / C.`);
    const num = s => { const n = decimal.toLowerCase() === 'comma' ? String(s).replace(',', '.') : s; return Number(n); };
    data.slice(dh + 1).forEach(r => {
      const id = r[di.id]; if (!groups.has(id)) groups.set(id, []);
      // ci: |C″| (pF), cùng C′ tính tổng trở; file không có cột C″ thì để trống
      groups.get(id).push({ f: num(r[di.frequency]), tan: num(r[iTan]), c: num(r[iC]) * 1e12, ci: iCi === undefined ? NaN : Math.abs(num(r[iCi])) * 1e12 });
    });
    // file có phép đo nhưng mục quét tần số trống (vd xuất từ DIRANA khi chưa đo xong) → báo rõ
    if (!groups.size && info.size) throw new Error(`${fileName || 'Tệp'}: có ${info.size} phép đo (${[...info.values()].map(x => x.name).join(', ')}) nhưng [${sec}] không có số liệu quét tần số.`);
    return Array.from(groups, ([id, pts]) => {
      const m = info.get(id) || {}, ident = identify(m.name);
      pts = pts.filter(p => Number.isFinite(p.f) && Number.isFinite(p.tan) && Number.isFinite(p.c)).sort((a, b) => a.f - b.f);
      const ci = pts.every(p => Number.isFinite(p.ci)) ? { ci: pts.map(p => p.ci) } : {};
      return Object.assign({ name: m.name, date: m.date, serial: m.serial, temp: m.temp || '', objType, file: fileName, f: pts.map(p => p.f), tan: pts.map(p => p.tan), c: pts.map(p => p.c) }, ci, ident);
    });
  }
  function assignSides(items) {
    const labels = [...new Set((items || []).map(x => Number(String(x.label || '').match(/^\d+(?:\.\d+)?/)?.[0])).filter(Number.isFinite))].sort((a, b) => b - a);
    const explicit = labels.length < 2;
    return (items || []).map(item => {
      const label = Number(String(item.label || '').match(/^\d+(?:\.\d+)?/)?.[0]);
      const rank = labels.indexOf(label);
      const side = item.side === 'N' || item.side === 'LV1' || item.side === 'LV2' ? item.side : explicit ? (item.side || '') : rank === 0 ? 'HV' : rank === 1 ? 'MV' : rank >= 2 ? 'LV1' : '';
      return Object.assign({}, item, { side });
    });
  }
  // Gộp phép đo mới nạp vào danh sách đang có (cùng file + Name + Date thì thay, giữ id và chỉnh tay).
  // Phía: xếp hạng lại theo nhãn điện áp trên toàn danh sách, trừ phép đo người dùng đã chọn phía/pha tay (sideManual).
  // Dùng: nhóm phía|pha chưa có lựa chọn tay (useManual) thì tự chọn lần đo muộn nhất; nhóm đã chọn tay thì phép đo mới để bỏ chọn.
  function merge(before, parsed, newId) {
    const merged = (before || []).map(x => Object.assign({}, x));
    (parsed || []).forEach(m => {
      const i = merged.findIndex(x => x.file === m.file && x.name === m.name && x.date === m.date);
      const old = i >= 0 ? merged[i] : null;
      const next = Object.assign({}, m, old ? { id: old.id, use: old.use, useManual: old.useManual, sideManual: old.sideManual } : { id: newId(), use: false });
      if (old && old.sideManual) Object.assign(next, { side: old.side, phase: old.phase });
      if (i >= 0) merged[i] = next; else merged.push(next);
    });
    const ranked = assignSides(merged.map(x => (x.sideManual ? x : Object.assign({}, x, { side: identify(x.name).side }))));
    merged.forEach((x, i) => { if (!x.sideManual) x.side = ranked[i].side; });
    const key = x => `${x.side}|${x.phase}`;
    const groups = new Map();
    merged.forEach(x => { if (x.side && x.phase) groups.set(key(x), (groups.get(key(x)) || []).concat([x])); });
    groups.forEach(g => {
      if (g.some(x => x.useManual)) return; // giữ lựa chọn tay; phép đo mới (use: false) không tự được chọn
      const win = g.slice().sort((a, b) => Dfr.dateKey(b.date).localeCompare(Dfr.dateKey(a.date)))[0];
      g.forEach(x => { x.use = x === win; });
    });
    merged.forEach(x => { if (!x.side || !x.phase) x.use = false; });
    return merged;
  }

  window.Dirana = { parse, identify, assignSides, merge, normDate };
})();
