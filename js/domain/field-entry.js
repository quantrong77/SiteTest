// Nhập hiện trường (màn hình nhỏ): danh sách các ô số cần nhập của một hạng mục, theo thứ tự đi từng ô.
// Bỏ ô tự tính (calc), ô gợi ý tự tính (auto — vẫn sửa được ở trang đầy đủ), ô chữ / lựa chọn, ô không áp dụng (skip).
// order: 'row' — hết một hàng rồi xuống hàng (vd R15 → R60 → R600 của một sơ đồ đo);
//        'col' — hết một cột rồi sang cột (vd các nấc của pha A rồi pha B); 'auto' — bảng có cột theo pha thì 'col', còn lại 'row'.
(function () {
  'use strict';
  const strip = s => String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  function gridCells(g, sec, group, order, rowLabel) {
    if (g.readonly) return [];
    const cols = g.cols.map((c, ci) => ({ c, ci })).filter(({ c }) => !c.calc && !c.auto && !c.text && !c.options);
    const rows = g.rows.map((r, ri) => ({ r, ri })).filter(({ r }) => !r.text && !r.auto && !r.select);
    const mode = order === 'row' || order === 'col' ? order : (cols.some(({ c }) => c.phase) && rows.length > 1 ? 'col' : 'row');
    const cell = ({ r, ri }, { c, ci }) => (g.skip && g.skip(r.k, c.k) ? null : {
      key: `${g.id}.${r.k}.${c.k}`, kind: 'cell', sec: sec.id, group: group ? strip(group.title) : '', grid: g.id, gridTitle: strip(g.title),
      row: ri, col: ci, rowLabel: strip((rowLabel && rowLabel(g, r)) || r.label || r.defLabel || r.k),
      colLabel: c.phase ? `Pha ${strip(c.label || c.k)}` : strip(c.label || c.defLabel || c.k),
    });
    const out = [];
    if (mode === 'col') cols.forEach(c => rows.forEach(r => out.push(cell(r, c))));
    else rows.forEach(r => cols.forEach(c => out.push(cell(r, c))));
    return out.filter(Boolean);
  }

  // → [{ key, kind: 'field' | 'cell', sec, group, grid, gridTitle, rowLabel, colLabel, label, unit }]
  function cells(schema, secId, opts = {}) {
    const sec = schema.sections.find(s => s.id === secId);
    if (!sec) return [];
    const out = [];
    const field = (f, group) => {
      if (!f.num || f.readonly || f.calc) return;
      out.push({ key: f.k, kind: 'field', sec: sec.id, group: group ? strip(group.title) : '', grid: '', gridTitle: '', rowLabel: '', colLabel: '', label: strip(f.label), unit: f.unit || '' });
    };
    const order = (opts.order || {});
    (sec.fields || []).forEach(f => field(f, null));
    (sec.grids || []).forEach(g => out.push(...gridCells(g, sec, null, order[g.id] || opts.defaultOrder, opts.rowLabel)));
    (sec.groups || []).forEach(gr => {
      (gr.fields || []).forEach(f => field(f, gr));
      (gr.grids || []).forEach(g => out.push(...gridCells(g, sec, gr, order[g.id] || opts.defaultOrder, opts.rowLabel)));
    });
    out.forEach(x => { if (x.kind === 'cell') x.label = `${x.rowLabel} – ${x.colLabel}`; });
    return out;
  }

  // Ô trống kế tiếp (vòng lại từ đầu); -1 nếu đã nhập hết
  function nextEmpty(list, v, from) {
    const empty = i => { const x = v[list[i].key]; return x === undefined || x === null || String(x).trim() === ''; };
    for (let k = 1; k <= list.length; k++) { const i = (from + k) % list.length; if (empty(i)) return i; }
    return -1;
  }
  const filled = (list, v) => list.filter(x => String(v[x.key] ?? '').trim() !== '').length;

  window.FieldEntry = { cells, nextEmpty, filled };
})();
