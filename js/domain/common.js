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
  // Khóa số liệu → mã hạng mục (ô của hạng mục, hoặc ô/khóa phụ trong lưới của hạng mục); thông tin chung, kết luận → null
  function sectionOfKey(schema) {
    const exact = {}, prefix = [], memo = new Map();
    schema.sections.forEach(s => {
      (s.fields || []).forEach(f => { exact[f.k] = s.id; });
      (s.groups || []).forEach(gr => (gr.fields || []).forEach(f => { exact[f.k] = s.id; }));
      (s.extraDoc || []).forEach(x => { exact[x.k] = s.id; });
    });
    eachGrid(schema, (g, s) => prefix.push([g.id + '.', s.id]));
    prefix.sort((a, b) => b[0].length - a[0].length);
    return k => {
      if (!memo.has(k)) memo.set(k, exact[k] || (prefix.find(([p]) => k.startsWith(p)) || [])[1] || null);
      return memo.get(k);
    };
  }
  function findGrid(schema, id) {
    let hit = null;
    eachGrid(schema, g => { if (g.id === id) hit = g; });
    return hit;
  }

  // Loại lần thí nghiệm theo lý do ghi trong biên bản (mã dùng trong CSDL)
  // Thứ tự quan trọng: "1 năm sau lắp đặt" là định kỳ (không phải SAT); "Tăng cường" chưa có mã riêng trong CSDL → OTHER
  // (chữ đầy đủ vẫn lưu ở test_sessions.reason)
  const KIND_OF_REASON = [
    [/^\s*sau\s+lắp\s+đặt/i, 'SAT'], [/sau\s+lắp\s+đặt|định\s+kỳ/i, 'PERIODIC'], [/sửa\s+chữa|đại\s+tu/i, 'AFTER_REPAIR'],
    [/bất\s+thường|đột\s+xuất/i, 'ABNORMAL'], [/dự\s+phòng/i, 'SPARE'], [/lắp\s+đặt/i, 'SAT'],
  ];
  const KIND_LABEL = { FAT: 'Xuất xưởng (FAT)', SAT: 'Sau lắp đặt', PERIODIC: 'Định kỳ', AFTER_REPAIR: 'Sau sửa chữa', ABNORMAL: 'Bất thường', SPARE: 'Dự phòng', OTHER: 'Khác' };
  // Chữ đọc từ BBTN cũ khớp một lựa chọn (không phân biệt hoa thường, khoảng trắng, dạng Unicode) → đúng chữ của lựa chọn
  const optionOf = (text, options) => {
    // gạch chéo / gạch ngang (OCR hay đọc "Sau sửa chữa – đại tu") coi như nhau
    const n = x => String(x || '').normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, ' ').replace(/\s*[\/\-\u2010-\u2015]\s*/g, '/').trim();
    const t = n(text);
    return (t && (options || []).find(o => n(o) === t)) || text;
  };
  const kindOf = reason => (KIND_OF_REASON.find(([re]) => re.test(reason || '')) || [null, 'OTHER'])[1];
  // dd/mm/yyyy hoặc yyyy-mm-dd → yyyy-mm-dd
  function isoDate(s) {
    const t = str(s);
    let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[0] : null;
  }

  // Chữ "pha X" trong Vị trí lắp đặt (vd "MBA 500kV AT1 PHA A (Di Linh)", tên thiết bị "AT9 pha A") theo biên bản đang lập:
  // phase 'A' | 'B' | 'C' → đổi thành pha đó (giữ chữ hoa / thường của từ "pha"); phase rỗng (BBTN chung tổ 3 máy) → bỏ.
  // Không có chữ "pha X" thì giữ nguyên, không tự thêm.
  const PHASE_IN_SITE = /(\s*[-–,:]?\s*)\b(pha|phase)\s+([ABC])(?![\w\u00C0-\u1EF9])/i;
  function sitePhase(site, phase) {
    const t = String(site ?? '');
    const m = t.match(PHASE_IN_SITE);
    if (!m) return t;
    const p = String(phase || '').toUpperCase();
    if (['A', 'B', 'C'].includes(p)) return t.replace(PHASE_IN_SITE, (all, sep, word, ph) => `${sep}${word} ${ph === ph.toLowerCase() ? p.toLowerCase() : p}`);
    return t.replace(PHASE_IN_SITE, ' ').replace(/\s+([)\],.;])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  }

  window.Common = { RANK, worst, ST_TEXT, toNum, ok, fmt, sgn, devPct, str, eachGrid, eachField, findGrid, sectionOfKey, KIND_LABEL, kindOf, optionOf, isoDate, sitePhase };
})();
