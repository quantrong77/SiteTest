// Phần chung khi làm việc với template BBTN: đọc giá trị sẵn có trong template theo đúng ánh xạ (bảng, hàng, cột)
// mà biểu mẫu dùng để xuất. tpl là đối tượng DocxTemplate (js/data/docx.js) đã nạp sẵn.
(function () {
  'use strict';
  const { eachField, eachGrid } = Common;

  // Giá trị sẵn có trong template (thông tin chung, Uo = 10 kV…) làm mặc định cho biên bản mới
  function readDefaults(tpl, schema) {
    const v = {};
    eachField(schema, f => {
      if (!f.doc || /remark|conclusion/.test(f.k)) return;
      const val = tpl.readField(f.doc);
      if (val && val.replace(/[\s.]/g, '')) v[f.k] = val;
    });
    eachGrid(schema, g => {
      if (g.readonly) return;
      g.rows.forEach(r => g.cols.forEach(c => {
        if (r.nodoc || c.calc || c.auto || (g.skip && g.skip(r.k, c.k))) return;
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

  window.Report = { readDefaults, decimal };
})();
