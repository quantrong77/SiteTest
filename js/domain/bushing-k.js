// Bảng hệ số quy đổi tgδ sứ xuyên về 20 °C: bảng QĐ 1901 có sẵn + bảng theo hãng do admin cấu hình trong CSDL.
// Tra theo loại cách điện (cột) và nhiệt độ sứ; tgδ20 = tgδ(t) × K (QĐ 1901), bảng theo hãng có thể khai báo ÷ K.
(function () {
  'use strict';

  // QĐ 1901 (Cauhinh/Kquidoi_1901.xlsx) — dùng khi chưa đăng nhập/chưa tải được bảng từ CSDL
  const BUILTIN = {
    id: 'builtin-qd1901', name: 'QĐ 1901 – hệ số quy đổi tgδ sứ về 20 °C', basis: 'QD1901', manufacturer: null, columns: ['OIP', 'RIP'],
    rows: [[17, 0.95, 0.93], [18, 1, 1], [19, 1, 1], [20, 1, 1], [21, 1, 1], [22, 1, 1], [23, 1.05, 1.07], [24, 1.05, 1.07], [25, 1.05, 1.07],
      [26, 1.05, 1.07], [27, 1.05, 1.07], [28, 1.1, 1.14], [29, 1.1, 1.14], [30, 1.1, 1.14], [31, 1.1, 1.14], [32, 1.1, 1.14], [33, 1.15, 1.21],
      [34, 1.15, 1.21], [35, 1.15, 1.21], [36, 1.15, 1.21], [37, 1.15, 1.21], [38, 1.2, 1.27], [39, 1.2, 1.27], [40, 1.2, 1.27], [41, 1.2, 1.27],
      [42, 1.2, 1.27], [43, 1.25, 1.33], [44, 1.25, 1.33], [45, 1.25, 1.33], [46, 1.25, 1.33], [47, 1.25, 1.33], [48, 1.25, 1.33], [49, 1.3, 1.37],
      [50, 1.3, 1.37], [51, 1.3, 1.37], [52, 1.3, 1.37], [53, 1.34, 1.41], [54, 1.34, 1.41], [55, 1.34, 1.41], [56, 1.34, 1.41], [57, 1.34, 1.41],
      [58, 1.35, 1.43], [59, 1.35, 1.43], [60, 1.35, 1.43]],
    formula: 'MUL', lookup: 'NEAREST', note: 'tgδ20 = tgδ(t) × K; t = nhiệt độ sứ (lấy bằng nhiệt độ dầu MBA – Điều 38)', active: true, builtin: true,
  };

  const MODE_HITACHI = 'Hitachi Energy (RIP) – theo HD hãng';
  const MODE_1901 = 'Theo QĐ 1901 – bảng hệ số K';
  const MODE_MANUAL = 'Nhập hệ số K';
  const MODE_MFR = 'Theo hãng – ';

  let tables = null, source = 'builtin';

  const all = () => tables || [BUILTIN];
  const active = () => all().filter(t => t.active !== false);
  const qd1901 = () => active().find(t => t.basis === 'QD1901') || BUILTIN;
  const byManufacturer = () => active().filter(t => t.basis === 'MANUFACTURER');

  function modeOptions() {
    return [MODE_HITACHI, MODE_1901].concat(byManufacturer().map(t => MODE_MFR + t.name), [MODE_MANUAL]);
  }

  // Chế độ quy đổi của một phía sứ theo giá trị ô "Cách quy đổi về 20 °C"
  function resolve(mode) {
    const m = String(mode || '');
    if (!m || m === MODE_HITACHI) return { kind: 'hitachi' };
    if (/Nhập/i.test(m)) return { kind: 'manual' };
    if (m === MODE_1901) return { kind: 'table', table: qd1901() };
    if (m.startsWith(MODE_MFR)) {
      const t = active().find(x => x.name === m.slice(MODE_MFR.length));
      return t ? { kind: 'table', table: t } : { kind: 'table', table: null, missing: m.slice(MODE_MFR.length) };
    }
    return { kind: 'hitachi' };
  }

  // Tra K: NEAREST = dòng có t gần nhất (bảng bậc theo từng °C), LINEAR = nội suy giữa hai dòng kề
  function lookup(table, type, t) {
    if (!table) return { k: NaN, why: 'Bảng hệ số không còn trong cấu hình' };
    const ci = table.columns.findIndex(c => String(c).trim().toUpperCase() === String(type || '').trim().toUpperCase());
    if (ci < 0) return { k: NaN, why: `Bảng “${table.name}” không có cột cho sứ ${type}` };
    if (!Number.isFinite(t)) return { k: NaN, why: 'Thiếu nhiệt độ sứ' };
    const rows = table.rows.map(r => [Number(r[0]), Number(r[ci + 1])]).filter(r => Number.isFinite(r[0]) && Number.isFinite(r[1])).sort((a, b) => a[0] - b[0]);
    if (!rows.length) return { k: NaN, why: `Bảng “${table.name}” chưa có số liệu cột ${type}` };
    const lo = rows[0][0], hi = rows[rows.length - 1][0];
    const step = rows.length > 1 ? (hi - lo) / (rows.length - 1) : 0;
    // bảng bậc: cho phép lệch nửa bước ở hai đầu (vd 60,4 °C vẫn dùng dòng 60)
    const tol = table.lookup === 'NEAREST' ? step / 2 : 0;
    if (t < lo - tol || t > hi + tol) return { k: NaN, why: `t sứ = ${t} °C ngoài dải bảng ${lo}–${hi} °C` };
    if (table.lookup === 'LINEAR') {
      const j = rows.findIndex(r => r[0] >= t);
      if (rows[j][0] === t || j === 0) return { k: rows[j][1], t: rows[j][0] };
      const [t0, k0] = rows[j - 1], [t1, k1] = rows[j];
      return { k: k0 + (k1 - k0) * (t - t0) / (t1 - t0), t, interp: true };
    }
    let best = rows[0];
    rows.forEach(r => { if (Math.abs(r[0] - t) < Math.abs(best[0] - t) || (Math.abs(r[0] - t) === Math.abs(best[0] - t) && r[0] > best[0])) best = r; });
    return { k: best[1], t: best[0] };
  }

  const convert = (table, tgd, k) => (table && table.formula === 'MUL' ? tgd * k : tgd / k);

  // Đọc bảng từ Excel: cột đầu là nhiệt độ, các cột sau là K; tên loại sứ lấy từ tiêu đề (vd "Correction to 20°C OIP")
  function fromSheet(ws) {
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false });
    const num = v => (typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.').trim()));
    const hi = aoa.findIndex(r => r.length > 1 && !Number.isFinite(num(r[0])) && r.slice(1).some(x => String(x ?? '').trim()));
    if (hi < 0) throw new Error('Không thấy hàng tiêu đề (cột 1: nhiệt độ, các cột sau: hệ số K theo loại sứ)');
    const head = aoa[hi];
    const cols = [];
    for (let c = 1; c < head.length; c++) {
      const h = String(head[c] ?? '').trim();
      if (!h) continue;
      const m = h.match(/\b(OIP|RIP|RIS|RBP|GIF|ERIP)\b/i);
      cols.push({ c, name: m ? m[1].toUpperCase() : h });
    }
    const rows = aoa.slice(hi + 1).map(r => [num(r[0])].concat(cols.map(x => num(r[x.c]))))
      .filter(r => Number.isFinite(r[0]) && r.slice(1).some(Number.isFinite));
    if (!cols.length || !rows.length) throw new Error('Sheet không có số liệu hệ số K');
    return { columns: cols.map(x => x.name), rows: rows.map(r => r.map(x => (Number.isFinite(x) ? x : null))) };
  }
  function fromArrayBuffer(buf) {
    const wb = XLSX.read(buf, { type: 'array' });
    return fromSheet(wb.Sheets[wb.SheetNames[0]]);
  }

  // Bảng đang dùng do lớp dữ liệu nạp vào (CSDL hoặc bản sao lưu trên máy); null = dùng bảng QĐ 1901 có sẵn
  function setTables(list, src) {
    tables = Array.isArray(list) && list.length ? list : null;
    source = tables ? src : 'builtin';
  }

  window.BushingK = {
    BUILTIN, MODE_HITACHI, MODE_1901, MODE_MANUAL, MODE_MFR,
    all, active, qd1901, byManufacturer, modeOptions, resolve, lookup, convert, fromArrayBuffer, fromSheet, setTables,
    get source() { return source; },
  };
})();
