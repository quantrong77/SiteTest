// Nạp bộ tiêu chí đơn vị cho lớp nghiệp vụ: từ CSDL khi đã đăng nhập, lưu bản sao trên máy để dùng khi offline;
// lưu / khôi phục ngưỡng (chỉ admin, RLS kiểm tra phía CSDL).
(function () {
  'use strict';
  const LS_KEY = 'bbtn-mba.criteria';

  // Bản sao lần tải gần nhất dùng ngay khi mở app
  try {
    const c = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (c && Array.isArray(c.rows)) Criteria.setOverrides(c.rows, 'cache');
  } catch (e) { /* bỏ qua */ }

  function cache(rows) {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ at: new Date().toISOString(), rows })); } catch (e) { /* bỏ qua */ }
  }

  // true nếu đã tải từ CSDL (đã đăng nhập)
  async function load() {
    if (typeof DB === 'undefined' || !DB.user || !DB.client) return false;
    const rows = await DB.listCriteria();
    Criteria.setOverrides(rows, 'db');
    cache(rows);
    return true;
  }

  // changes: [{ key, value, note }] — value trùng QĐ 1901 hoặc rỗng thì xóa dòng (dùng lại giá trị gốc)
  async function save(changes) {
    const def = QD.LIMITS;
    const up = changes.filter(c => c.value !== '' && Number.isFinite(+c.value) && +c.value !== def[c.key]).map(c => ({ key: c.key, value: +c.value, note: c.note || null }));
    const del = changes.filter(c => !up.some(u => u.key === c.key)).map(c => c.key);
    await DB.saveCriteria(up);
    await DB.deleteCriteria(del);
    await load();
    return { saved: up.length, reset: del.length };
  }

  window.CriteriaRepo = { load, save };
})();
