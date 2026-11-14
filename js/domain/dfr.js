// Chọn phép đo DFR đại diện và tạo bảng, nội dung phụ lục từ dữ liệu đã chọn.
(function () {
  'use strict';
  const PHASES = ['A', 'B', 'C'];
  const SIDES = ['HV', 'MV', 'N', 'LV1', 'LV2'];
  const dateKey = s => { const m=String(s||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?/); return m ? `${m[3]}${m[2].padStart(2,'0')}${m[1].padStart(2,'0')}${(m[4]||'00').padStart(2,'0')}${m[5]||'00'}${m[6]||'00'}` : String(s||''); };
  function at(m, hz) {
    if (!m || !(hz > 0) || !Array.isArray(m.f)) return null;
    const pts = m.f.map((f, i) => ({ f: Number(f), tan: Number(m.tan[i]), c: Number(m.c[i]) })).filter(x => x.f > 0 && Number.isFinite(x.tan) && Number.isFinite(x.c)).sort((a, b) => a.f - b.f);
    if (!pts.length || hz < pts[0].f || hz > pts[pts.length - 1].f) return null;
    const exact = pts.find(p => p.f === hz);
    if (exact) return { tan: exact.tan, c: exact.c };
    const hi = pts.findIndex(p => p.f > hz), a = pts[hi - 1], b = pts[hi];
    const t = (Math.log10(hz) - Math.log10(a.f)) / (Math.log10(b.f) - Math.log10(a.f));
    return { tan: a.tan + t * (b.tan - a.tan), c: a.c + t * (b.c - a.c) };
  }
  function chosen(list) {
    const selected = (list || []).filter(x => x.use);
    const byKey = new Map();
    selected.slice().sort((a, b) => SIDES.indexOf(a.side) - SIDES.indexOf(b.side) || PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase)).forEach(x => { const k = `${x.side}|${x.phase}`, old = byKey.get(k); if (!old || dateKey(x.date) > dateKey(old.date)) byKey.set(k, x); });
    return byKey;
  }
  function table(list) {
    const selected = chosen(list), rows = [];
    SIDES.forEach(side => PHASES.forEach(phase => {
      const m = selected.get(`${side}|${phase}`); if (!m) return;
      rows.push({ side, phase, m, values: { 15: at(m, 15), 400: at(m, 400) } });
    }));
    return rows;
  }
  function appendix(state, assets, out, label) {
    const items = (state.att && state.att.dfr && state.att.dfr.items) || [], selected = chosen(items);
    const sides = SIDES.filter(s => PHASES.some(p => selected.has(`${s}|${p}`)));
    if (!sides.length) return [];
    const fmt = x => x == null ? '' : out(Number(x).toFixed(2).replace('.', ','));
    const blocks = [{ type: 'page' }, { type: 'p', text: label || 'PHỤ LỤC', bold: true, size: 14, align: 'center' },
      { type: 'p', text: 'Đáp ứng tần số điện môi của sứ đầu vào', bold: true, size: 13, align: 'center' },
      { type: 'p', text: 'I. Tổn hao điện môi ở tần số 15Hz, 400Hz', bold: true, size: 12, keepNext: true }];
    const head = ['Sứ', 'Tần số', 'Pha A', '', 'Pha B', '', 'Pha C', ''];
    const head2 = ['', '', 'Tan (%)', 'C (pF)', 'Tan (%)', 'C (pF)', 'Tan (%)', 'C (pF)'];
    const rows = [];
    sides.forEach(side => [400, 15].forEach((hz, ix) => {
      const label = PHASES.map(p => selected.get(`${side}|${p}`)).find(Boolean)?.label || (side === 'N' ? 'TT' : side);
      const cells = [label, `${hz} Hz`];
      PHASES.forEach(p => { const m = selected.get(`${side}|${p}`), v = m && at(m, hz); cells.push(fmt(v && v.tan), fmt(v && v.c)); });
      rows.push({ cells, mergeSide: ix === 0 });
    }));
    blocks.push({ type: 'table', head, head2, mergeHead: [[2, 2], [4, 2], [6, 2]], size: 9,
      widths: [900, 1000, 950, 950, 950, 950, 950, 950], rows: rows.map(r => r.cells), mergeFirstColumnPairs: true });
    blocks.push({ type: 'p', text: 'II. Đồ thị đáp ứng tần số dải tần thấp (10mHz-10kHz)', bold: true, size: 12, keepNext: true });
    let sectionNo = 0;
    sides.forEach(side => {
      const title = side === 'N' ? 'Sứ trung tính' : `Sứ ${side}`;
      const charts = assets && assets.dfrCharts && assets.dfrCharts[side];
      if (!charts) return;
      const label = PHASES.map(p => selected.get(`${side}|${p}`)).find(Boolean)?.label || (side === 'N' ? 'TT' : side);
      sectionNo++;
      blocks.push({ type: 'p', text: `II.${sectionNo} ${title} (${label})`, bold: true, size: 12, keepNext: true });
      blocks.push({ type: 'p', text: 'Đồ thị riêng từng pha', italic: true, size: 11, keepNext: true });
      blocks.push({ type: 'images', perRow: 2, widthCm: 8, items: charts.individual || [] });
      blocks.push({ type: 'p', text: 'Đồ thị xếp chồng 3 pha để so sánh', italic: true, size: 11, keepNext: true });
      if (charts.overlay) blocks.push({ type: 'images', perRow: 1, widthCm: 16, items: [charts.overlay] });
    });
    blocks.push({ type: 'p', text: 'Người thí nghiệm', bold: true, size: 12, align: 'right', after: 1200 });
    return blocks;
  }
  window.Dfr = { at, chosen, table, appendix, SIDES, PHASES, dateKey };
})();
