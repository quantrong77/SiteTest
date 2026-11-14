// Phần chung khi làm việc với template BBTN: đọc giá trị sẵn có trong template theo đúng ánh xạ (bảng, hàng, cột)
// mà biểu mẫu dùng để xuất. tpl là đối tượng DocxTemplate (js/data/docx.js) đã nạp sẵn.
(function () {
  'use strict';
  const { eachField, eachGrid } = Common;

  // Bổ sung hàng biểu mẫu cần mà template không có (g.ensureRow: { after, label, match }), vd nhiệt độ từng sứ ở mẫu
  // chung 3 pha. Gọi trước khi đọc/ghi template để chỉ số hàng của schema khớp; template đã có hàng thì giữ nguyên.
  function prepare(tpl, schema) {
    eachGrid(schema, g => {
      const e = g.ensureRow;
      if (!e || !g.tables || !tpl.insertRowAfter) return;
      // đã có đúng hàng này ở vị trí schema cần (ngay sau hàng `after`) thì giữ nguyên
      const next = tpl.rows(g.tables)[e.after + 1];
      if (next && e.match.test(next.textContent)) return;
      tpl.insertRowAfter(g.tables[0], e.after, e.label);
    });
  }

  // Giá trị sẵn có trong template (thông tin chung, Uo = 10 kV…) làm mặc định cho biên bản mới
  function readDefaults(tpl, schema) {
    prepare(tpl, schema);
    const v = {};
    eachField(schema, f => {
      if (!f.doc || /remark|conclusion/.test(f.k)) return;
      const val = tpl.readField(f.doc);
      if (val && val.replace(/[\s.]/g, '')) v[f.k] = val;
    });
    eachGrid(schema, g => {
      if (g.readonly || !g.tables) return;
      g.rows.forEach(r => g.cols.forEach(c => {
        if (r.nodoc || c.nodoc || c.doc === undefined || c.calc || c.auto || (g.skip && g.skip(r.k, c.k))) return;
        if (c.slot) { // ô có nhãn cố định quanh giá trị: chỉ đọc phần giá trị
          const s = tpl.readField({ t: g.tables[0], r: r.doc, c: c.doc, re: c.slot });
          if (s && s.trim()) v[`${g.id}.${r.k}.${c.k}`] = s.trim();
          return;
        }
        const tc = tpl.cell(g.tables, r.doc, r.cmap && r.cmap[c.k] !== undefined ? r.cmap[c.k] : c.doc);
        const t = tc ? tc.textContent.trim() : '';
        if (t && t !== '/') v[`${g.id}.${r.k}.${c.k}`] = t;
      }));
    });
    return v;
  }

  // Thống nhất dấu thập phân cho giá trị thuần số khi ghi vào BBTN
  const decimal = sep => s => {
    const t = String(s).trim();
    return /^[-+]?\d+([.,]\d+)?$/.test(t) ? t.replace(/[.,]/, sep === '.' ? '.' : ',') : t;
  };

  window.Report = { readDefaults, prepare, decimal };
})();
