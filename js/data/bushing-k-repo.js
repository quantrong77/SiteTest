// Nạp bảng hệ số K sứ cho lớp nghiệp vụ: từ CSDL khi đã đăng nhập, lưu bản sao trên máy để dùng khi offline.
(function () {
  'use strict';
  const LS_KEY = 'bbtn-mba.bushingK';

  // Bản sao lần tải gần nhất (nếu có) dùng ngay khi mở app
  try {
    const c = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (c && Array.isArray(c.tables)) BushingK.setTables(c.tables, 'cache');
  } catch (e) { /* bỏ qua */ }

  // true nếu đã tải từ CSDL (đã đăng nhập)
  async function load() {
    if (typeof DB === 'undefined' || !DB.user || !DB.client) return false;
    const data = await DB.listKTables();
    BushingK.setTables(data, 'db');
    try { localStorage.setItem(LS_KEY, JSON.stringify({ at: new Date().toISOString(), tables: data.length ? data : null })); } catch (e) { /* bỏ qua */ }
    return true;
  }

  window.BushingKRepo = { load };
})();
