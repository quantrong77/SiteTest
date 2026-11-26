// Đọc file Excel DIRANA xuất từ Primary Test Manager (vd AT2.xlsx): sheet "Job" (ngày giờ từng phép đo), "Asset" (kiểu MBA),
// mỗi phép đo một sheet có dòng "DIRANA Test": thông số đo, kết quả phân tích (độ ẩm cellulose, phân loại, độ dẫn dầu,
// C và tgδ tại 50 Hz) và bảng quét tần số (Frequency in Hz, Dissipation factor (%), Power factor, C', C'' (F)).
// Trả về cùng dạng phép đo với Dirana.parse (CSV) cộng các kết quả phân tích; không tự tính độ ẩm.
(function () {
  'use strict';
  const str = v => (v === null || v === undefined ? '' : String(v).replace(/_x000D_/g, '').trim());
  const num = v => { if (typeof v === 'number') return v; const m = str(v).replace(',', '.').match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/i); return m ? Number(m[0]) : NaN; };
  // "3.709 nF" → pF
  const pF = v => { const x = num(v), u = (str(v).match(/([pnµu]?)F\s*$/) || [])[1]; return Number.isFinite(x) ? x * ({ p: 1, n: 1e3, µ: 1e6, u: 1e6, '': 1e12 })[u || ''] : NaN; };
  // Ngày dạng dd/mm/yyyy, số ngày Excel hoặc Date
  function dateText(v) {
    if (v instanceof Date) return `${String(v.getDate()).padStart(2, '0')}/${String(v.getMonth() + 1).padStart(2, '0')}/${v.getFullYear()}`;
    if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; }
    return str(v);
  }
  // Giá trị ở ô bên phải nhãn (bỏ qua ô trống) trên cùng hàng, bắt đầu tìm từ cột của nhãn
  function after(row, i) { for (let k = i + 1; k < row.length; k++) if (str(row[k]) !== '') return row[k]; return ''; }
  function label(rows, re) {
    for (const r of rows) for (let i = 0; i < r.length; i++) if (re.test(str(r[i]))) return after(r, i);
    return '';
  }
  // "H-T" → CHT, "H-L" → CHL, "L-T" → CLT
  const INS_OF_PROFILE = { 'H-T': 'CHT', 'H-L': 'CHL', 'L-T': 'CLT', 'HT': 'CHT', 'HL': 'CHL', 'LT': 'CLT' };
  const insOfProfile = s => INS_OF_PROFILE[str(s).toUpperCase().replace(/\s+/g, '')] || '';

  // rows: mảng hàng của một sheet phép đo; ctx: { file, objType, times: { tên phép đo: 'hh:mm:ss' } }
  function parseSheet(sheetName, rows, ctx = {}) {
    if (!rows.some(r => r.some(c => /^DIRANA Test$/i.test(str(c))))) return [];
    const head = rows.slice(0, rows.findIndex(r => r.some(c => /^Measurements$/i.test(str(c)))) + 1 || rows.length);
    const profile = str(label(head, /^Measurement profile$/i)), date = dateText(label(head, /^Execution date$/i));
    const oilT = num(label(head, /^Oil temperature$/i));
    // khối kết quả: mỗi phép đo bắt đầu bằng hàng "Name … Channel"
    const blocks = [];
    rows.forEach((r, i) => { const k = r.findIndex(c => /^Name$/i.test(str(c))); if (k >= 0 && r.some(c => /^Channel$/i.test(str(c)))) blocks.push({ i, name: str(after(r, k)) }); });
    const results = blocks.map((b, j) => {
      const part = rows.slice(b.i, j + 1 < blocks.length ? blocks[j + 1].i : rows.length);
      const tanPf = str(label(part, /^Tan\s*δ.*@\s*50\s*Hz/i));
      return { name: b.name, moist: num(label(part, /^Moisture in cellulose$/i)), moistCat: str(label(part, /^Moisture category$/i)),
        oilCond: num(label(part, /^Oil conduct\.?$/i)), oilCond20: num(label(part, /^Oil conduct\.? @ 20/i)), oilCat: str(label(part, /^Oil category$/i)),
        c50: pF(label(part, /^Capacitance @ 50 Hz$/i)), tan50: tanPf ? num(tanPf.split('/')[0]) : NaN,
        // "Max. stop frequency reached: no" — phép đo chưa quét tới tần số dừng đặt trước, kết quả phân tích ẩm chỉ tham khảo
        stopReached: (s => (s ? !/^no$/i.test(s) : undefined))(str(label(part, /^Max\.? stop frequency reached$/i))) };
    });
    // bảng quét: hàng "Name | <tên>" rồi hàng tiêu đề "Frequency in Hz"
    const out = [];
    rows.forEach((r, i) => {
      const k = r.findIndex(c => /^Frequency in Hz$/i.test(str(c)));
      if (k < 0) return;
      const hdr = r.map(c => str(c).toLowerCase());
      const col = re => hdr.findIndex(h => re.test(h));
      const iT = col(/^dissipation factor/), iC = col(/^c'$/), iCi = col(/^c''$|^c"$/);
      let name = '';
      for (let u = i - 1; u >= Math.max(0, i - 3); u--) { const n = rows[u].findIndex(c => /^Name$/i.test(str(c))); if (n >= 0) { name = str(after(rows[u], n)); break; } }
      const pts = [];
      for (let u = i + 1; u < rows.length; u++) {
        const f = rows[u][k];
        if (typeof f !== 'number' && !Number.isFinite(num(f))) break;
        pts.push({ f: num(f), tan: num(rows[u][iT]), c: num(rows[u][iC]) * 1e12, ci: iCi >= 0 ? Math.abs(num(rows[u][iCi])) * 1e12 : NaN });
      }
      const ok = pts.filter(p => p.f > 0 && Number.isFinite(p.tan) && Number.isFinite(p.c)).sort((a, b) => a.f - b.f);
      if (!ok.length) return;
      const res = results.find(x => x.name === name) || results[0] || {};
      const time = (ctx.times || {})[name] || (ctx.times || {})[sheetName] || '';
      const m = { name: name || sheetName, date: time ? `${date} ${time}` : date, serial: '', temp: Number.isFinite(oilT) ? String(oilT) : '',
        objType: ctx.objType || '', profile, file: ctx.file || '',
        f: ok.map(p => p.f), tan: ok.map(p => p.tan), c: ok.map(p => p.c) };
      if (ok.every(p => Number.isFinite(p.ci))) m.ci = ok.map(p => p.ci);
      const ins = insOfProfile(profile);
      if (ins) m.ins = ins;
      ['moist', 'moistCat', 'oilCond', 'oilCond20', 'oilCat', 'c50', 'tan50', 'stopReached'].forEach(key => {
        const v = res[key];
        if (typeof v === 'number' ? Number.isFinite(v) : typeof v === 'boolean' || v) m[key] = v;
      });
      out.push(m);
    });
    return out;
  }

  // wb: workbook SheetJS. Lỗi rõ khi không phải file DIRANA hoặc có phép đo mà không có bảng quét tần số.
  function parseWorkbook(wb, fileName = '') {
    const rowsOf = n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' });
    const job = wb.SheetNames.includes('Job') ? rowsOf('Job') : [];
    // sheet Job: bảng "Executed tests" (Test name | Date | Time)
    const times = {};
    const h = job.findIndex(r => r.some(c => /^Test name$/i.test(str(c))));
    if (h >= 0) {
      const iN = job[h].findIndex(c => /^Test name$/i.test(str(c))), iT = job[h].findIndex(c => /^Time$/i.test(str(c)));
      for (let u = h + 1; u < job.length && str(job[u][iN]); u++) if (iT >= 0) times[str(job[u][iN])] = str(job[u][iT]);
    }
    const asset = wb.SheetNames.includes('Asset') ? rowsOf('Asset') : job;
    const objType = str(label(asset, /^Asset type$/i));
    const tests = wb.SheetNames.filter(n => !['Job', 'Asset', 'Location'].includes(n)).map(n => [n, rowsOf(n)])
      .filter(([, rows]) => rows.some(r => r.some(c => /^DIRANA Test$/i.test(str(c)))));
    if (!tests.length) throw new Error(`${fileName || 'Tệp'}: không phải file Excel DIRANA (không có sheet phép đo "DIRANA Test").`);
    const out = tests.flatMap(([n, rows]) => parseSheet(n, rows, { file: fileName, objType, times }));
    if (!out.length) throw new Error(`${fileName || 'Tệp'}: có ${tests.length} phép đo (${tests.map(t => t[0]).join(', ')}) nhưng không có bảng quét tần số.`);
    return out;
  }
  const parse = (buf, fileName = '') => parseWorkbook(XLSX.read(buf, { type: 'array' }), fileName);

  window.DiranaXlsx = { parse, parseWorkbook, parseSheet, insOfProfile, pF };
})();
