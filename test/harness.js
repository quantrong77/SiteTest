// Nạp các mô-đun trình duyệt (IIFE gán vào window) vào một ngữ cảnh vm của Node để test,
// không cần trình duyệt và không thêm thư viện. Mỗi lần gọi load() cho một ngữ cảnh mới, sạch.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function load(files, opts = {}) {
  const store = new Map(Object.entries(opts.localStorage || {}));
  const ctx = {
    console,
    TextDecoder,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    document: { addEventListener() {} },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  files.forEach(f => {
    const file = path.join(ROOT, f);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  });
  return ctx;
}

// Lớp nghiệp vụ (giống thứ tự nạp trong index.html) + bộ đọc máy đo CPC 100, Haefely 2293; không nạp giao diện và Supabase
const DOMAIN = ['js/domain/common.js', 'js/domain/qd1901.js', 'js/domain/criteria.js', 'js/domain/test-items.js', 'js/domain/bushing-hitachi.js', 'js/domain/bushing-k.js',
  'js/domain/equipment-types.js', 'js/domain/report.js', 'js/domain/records.js', 'js/domain/oltc-wave.js', 'js/domain/edit-history.js', 'js/domain/appendix.js',
  'js/domain/types/mba/factory.js', 'js/domain/types/mba/schema.js', 'js/domain/types/mba/evaluate.js',
  'js/domain/types/mba/to-rows.js', 'js/domain/types/mba/report.js', 'js/domain/types/mba/import-2293.js', 'js/domain/types/mba/nameplate.js', 'js/domain/types/mba/index.js'];
const CORE = ['js/vendor/xlsx.full.min.js'].concat(DOMAIN, ['js/data/instruments/cpc100.js', 'js/data/instruments/wa2293.js']);

module.exports = { load, CORE, DOMAIN, ROOT };
