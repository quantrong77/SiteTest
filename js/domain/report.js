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
  const readDefaults = (tpl, schema) => readValues(tpl, schema);

  // Đọc mọi ô nhập liệu theo đúng ánh xạ dùng để xuất BBTN (ô tự tính bỏ qua — app tính lại).
  // o.all: đọc cả ghi chú, kết luận (nhập BBTN cũ); mặc định bỏ qua (giá trị mặc định của template).
  // Khe ghi giá trị giữa nhãn và đơn vị (vd "t=(?<v>\s*)oC", "Loại sứ:(?<v>)") chỉ khớp khi còn trống → khi đọc
  // file đã điền, nới nhóm v thành "mọi chữ tới phần sau nhãn"; khe ở cuối mẫu thì đọc tới dấu ";" (câu nhiều mục)
  function looseDoc(d) {
    const src = d.re.source;
    if (!/\(\?<v>(\\s\*)?\)/.test(src)) return d;
    const atEnd = /\(\?<v>(\\s\*)?\)$/.test(src);
    return Object.assign({}, d, { re: new RegExp(src.replace(/\(\?<v>(\\s\*)?\)/, atEnd ? '(?<v>[^;]*)' : '(?<v>[^]*?)'), d.re.flags) });
  }
  const NUM = /[-+]?\d+(?:[.,]\d+)?/;

  function readValues(tpl, schema, o = {}) {
    prepare(tpl, schema);
    const v = {};
    eachField(schema, f => {
      if (!f.doc || (!o.all && /remark|conclusion/.test(f.k))) return;
      let val = tpl.readField(f.doc.re ? looseDoc(f.doc) : f.doc);
      // ô số có ghi kèm chú thích (vd hệ số K sứ tự tra: "1,070 (fc = …)") → lấy số đầu
      if (val && f.num) { const m = val.match(NUM); val = m ? m[0] : ''; }
      if (val && val.replace(/[\s.]/g, '')) v[f.k] = val.trim();
    });
    eachGrid(schema, g => {
      if (g.readonly || !g.tables) return;
      // bảng đặc tính từ hóa đã chèn hàng tiêu đề khi xuất (có điểm khuỷu) → các hàng số liệu lùi xuống một hàng
      const first = g.ex && tpl.rows(g.tables)[0];
      const off = first && /Đầu cuộn|Mốc 25/.test(first.textContent) ? 1 : 0;
      g.rows.forEach(r0 => g.cols.forEach(c => {
        const r = off ? Object.assign({}, r0, { doc: r0.doc + off }) : r0;
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

  window.Report = { readDefaults, readValues, prepare, decimal };
})();
