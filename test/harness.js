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

// Bộ mô-đun tính toán MBA (giống thứ tự nạp trong index.html, bỏ phần giao diện và CSDL)
const CORE = ['js/vendor/xlsx.full.min.js', 'js/qd1901.js', 'js/factory.js', 'js/bushing-hitachi.js', 'js/cpc-import.js', 'js/bushing-k.js', 'js/schema.js', 'js/evaluate.js'];

module.exports = { load, CORE, ROOT };
