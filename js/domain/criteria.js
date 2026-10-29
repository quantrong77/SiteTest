// Bộ tiêu chí đánh giá: ngưỡng gốc theo QĐ 1901 (QD.LIMITS) và ngưỡng đơn vị đã chỉnh (Admin cấu hình, nạp từ CSDL
// qua js/data/criteria-repo.js). Lớp nghiệp vụ đánh giá theo Criteria.limits(); khi có ngưỡng khác QĐ 1901, kết quả và
// kết luận ghi rõ để người đọc BBTN biết căn cứ đánh giá.
(function () {
  'use strict';
  const DEF = QD.LIMITS, INFO = QD.LIMIT_INFO;
  let over = {}, meta = {}, source = 'default';

  // rows: [{ key, value, note, updated_at }]; khóa lạ / giá trị không phải số bị bỏ qua
  function setOverrides(rows, from) {
    over = {}; meta = {};
    (rows || []).forEach(r => {
      const v = Number(r && r.value);
      if (!r || !(r.key in DEF) || !Number.isFinite(v)) return;
      over[r.key] = v;
      meta[r.key] = { note: r.note || '', at: r.updated_at || '' };
    });
    source = from || 'db';
  }

  const limits = () => Object.assign({}, DEF, over);
  const isChanged = k => k in over && over[k] !== DEF[k];
  const changed = () => Object.keys(over).filter(isChanged);
  const fmtV = v => String(v).replace('.', ',');

  // Danh sách cho trang Bộ tiêu chí
  // theo thứ tự mô tả (đã xếp theo hạng mục), khóa chưa có mô tả xếp cuối
  const order = () => Object.keys(INFO).filter(k => k in DEF).concat(Object.keys(DEF).filter(k => !(k in INFO)));
  const list = () => order().map(k => Object.assign({ key: k }, INFO[k] || { label: k, unit: '', source: '' },
    { qd: DEF[k], value: k in over ? over[k] : DEF[k], changed: isChanged(k), note: (meta[k] || {}).note || '', at: (meta[k] || {}).at || '' }));

  // Câu ghi vào kết luận / trang đánh giá khi có ngưỡng khác QĐ 1901
  function changedText() {
    const ks = changed();
    if (!ks.length) return '';
    return 'Đánh giá theo bộ tiêu chí của đơn vị, khác QĐ 1901 ở: ' + ks.map(k => {
      const i = INFO[k] || { label: k, unit: '' };
      return `${i.label} ${fmtV(over[k])}${i.unit ? ' ' + i.unit : ''} (QĐ 1901: ${fmtV(DEF[k])}${i.unit ? ' ' + i.unit : ''})`;
    }).join('; ') + '.';
  }

  window.Criteria = { limits, changed, isChanged, list, setOverrides, changedText, get source() { return source; } };
})();
