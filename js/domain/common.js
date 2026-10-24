// Hàm thuần dùng chung cho mọi loại thiết bị: số, định dạng, xếp hạng kết quả, duyệt biểu mẫu,
// loại lần thí nghiệm và ngày. Không truy cập DOM, mạng hay file.
(function () {
  'use strict';

  // Mức nghiêm trọng của kết quả đánh giá (lớn hơn = nặng hơn)
  const RANK = { fail: 5, warn: 4, missing: 3, pass: 2, info: 1 };
  const worst = (...st) => st.filter(Boolean).sort((a, b) => RANK[b] - RANK[a])[0] || null;
  const ST_TEXT = { pass: 'Đạt', warn: 'Cần xem xét', fail: 'Không đạt', missing: 'Thiếu dữ liệu', info: 'Tham khảo' };

  const toNum = s => {
    if (s === null || s === undefined) return NaN;
    const t = String(s).trim().replace(/\s/g, '').replace(',', '.');
    return t === '' ? NaN : Number(t);
  };
  const ok = Number.isFinite;
  function fmt(x, d) {
    if (!ok(x)) return '';
    if (d === undefined) d = Math.abs(x) >= 1000 ? 0 : Math.abs(x) >= 100 ? 1 : Math.abs(x) >= 10 ? 2 : Math.abs(x) >= 1 ? 3 : 4;
    return x.toFixed(d).replace('.', ',');
  }
  const sgn = (x, d = 2) => (ok(x) ? (x > 0 ? '+' : '') + fmt(x, d) : '');
  const devPct = (a, ref) => (ok(a) && ok(ref) && ref !== 0 ? (a - ref) / ref * 100 : NaN);
  const str = v => (v === undefined || v === null ? '' : String(v).trim());

  // Duyệt biểu mẫu: schema = { sections: [{ fields, grids, groups: [{ fields, grids }] }] }, cộng các trường
  // đầu/cuối biên bản (head/tail) do loại thiết bị khai báo
  function eachGrid(schema, fn) {
    schema.sections.forEach(s => {
      (s.grids || []).forEach(g => fn(g, s, null));
      (s.groups || []).forEach(gr => (gr.grids || []).forEach(g => fn(g, s, gr)));
    });
  }
  function eachField(schema, fn) {
    (schema.head || []).concat(schema.tail || []).forEach(f => fn(f, null));
    schema.sections.forEach(s => {
      (s.fields || []).forEach(f => fn(f, s));
      (s.groups || []).forEach(gr => (gr.fields || []).forEach(f => fn(f, s)));
    });
  }
  function findGrid(schema, id) {
    let hit = null;
    eachGrid(schema, g => { if (g.id === id) hit = g; });
    return hit;
  }

  // Loại lần thí nghiệm theo lý do ghi trong biên bản (mã dùng trong CSDL)
  const KIND_OF_REASON = [
    [/lắp đặt/i, 'SAT'], [/sửa chữa/i, 'AFTER_REPAIR'], [/định kỳ/i, 'PERIODIC'], [/bất thường/i, 'ABNORMAL'], [/dự phòng/i, 'SPARE'],
  ];
  const KIND_LABEL = { FAT: 'Xuất xưởng (FAT)', SAT: 'Sau lắp đặt', PERIODIC: 'Định kỳ', AFTER_REPAIR: 'Sau sửa chữa', ABNORMAL: 'Bất thường', SPARE: 'Dự phòng', OTHER: 'Khác' };
  const kindOf = reason => (KIND_OF_REASON.find(([re]) => re.test(reason || '')) || [null, 'OTHER'])[1];
  // dd/mm/yyyy hoặc yyyy-mm-dd → yyyy-mm-dd
  function isoDate(s) {
    const t = str(s);
    let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[0] : null;
  }

  window.Common = { RANK, worst, ST_TEXT, toNum, ok, fmt, sgn, devPct, str, eachGrid, eachField, findGrid, KIND_LABEL, kindOf, isoDate };
})();
