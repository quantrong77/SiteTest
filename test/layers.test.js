// Ranh giới ba lớp (giao diện → nghiệp vụ → dữ liệu): kiểm tra tĩnh trên mã nguồn, chạy cùng npm test.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./harness');

const files = dir => fs.readdirSync(path.join(ROOT, dir), { recursive: true })
  .filter(f => f.endsWith('.js')).map(f => path.join(dir, f).replace(/\\/g, '/'));
const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // bỏ chú thích

// Lớp nghiệp vụ là hàm thuần: không DOM, không mạng, không lưu trình duyệt, không gọi kho dữ liệu trực tiếp
const DOMAIN_FORBIDDEN = [
  [/\bdocument\./, 'DOM'], [/\blocalStorage\b/, 'localStorage'], [/\bfetch\(/, 'fetch'], [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bDB\./, 'kho dữ liệu DB (dùng Records.setRepo)'], [/\bsupabase\b/i, 'Supabase'], [/\bNotify\b/, 'thông báo giao diện'], [/\bApp\./, 'giao diện App'],
];

test('js/domain/: không truy cập DOM, mạng, lưu trình duyệt hay giao diện', () => {
  const bad = [];
  files('js/domain').forEach(f => {
    const s = src(f);
    DOMAIN_FORBIDDEN.forEach(([re, what]) => { if (re.test(s)) bad.push(`${f}: ${what}`); });
  });
  assert.deepEqual(bad, []);
});

test('js/ui/: không truy vấn Supabase trực tiếp (đi qua js/data/db.js)', () => {
  const bad = [];
  files('js/ui').forEach(f => {
    const s = src(f);
    if (/\.from\(['"`]/.test(s) || /\.rpc\(/.test(s) || /DB\.client\./.test(s) || /\.storage\./.test(s)) bad.push(f);
  });
  assert.deepEqual(bad, []);
});

// Giao diện chỉ hiển thị kết quả đánh giá: không tự dựng dòng đánh giá, không gán / gộp trạng thái Đạt – Không đạt
test('js/ui/: không tự dựng dòng đánh giá hay quyết định Đạt/Không đạt (thuộc lớp nghiệp vụ)', () => {
  const rules = [[/\bfindings\.push\(/, 'thêm dòng đánh giá (findings.push)'], [/\b(?:Evaluate|Common)\.worst\(/, 'gộp trạng thái (worst)'],
    [/\bstatus\s*:\s*['"](pass|fail|warn)['"]/, 'gán trạng thái Đạt/Không đạt'], [/\bQD\.LIMITS\b/, 'ngưỡng gốc QD.LIMITS (dùng Criteria.limits() ở lớp nghiệp vụ)']];
  const bad = [];
  files('js/ui').forEach(f => { const s = src(f); rules.forEach(([re, what]) => { if (re.test(s)) bad.push(`${f}: ${what}`); }); });
  assert.deepEqual(bad, []);
});

// Ngưỡng đánh giá đi qua bộ tiêu chí (Admin chỉnh được): chỉ qd1901.js (nơi khai báo) và criteria.js (nơi ghép) đọc QD.LIMITS
test('js/domain/: ngưỡng lấy từ Criteria.limits(), không đọc thẳng QD.LIMITS', () => {
  const bad = files('js/domain').filter(f => !/\/(qd1901|criteria)\.js$/.test(f) && /\bQD\.LIMITS\b/.test(src(f)));
  assert.deepEqual(bad, []);
});

test('js/data/: không quyết định Đạt/Không đạt', () => {
  const bad = files('js/data').filter(f => /status\s*:\s*['"](pass|fail|warn)['"]/.test(src(f)));
  assert.deepEqual(bad, []);
});

test('vỏ React (src/main.jsx) nạp đủ các file của ba lớp, nghiệp vụ trước dữ liệu trước giao diện', () => {
  // index.html chỉ có #app-root; danh sách script cổ điển nằm trong src/main.jsx (nạp tuần tự sau khi vỏ React dựng xong)
  const src = fs.readFileSync(path.join(ROOT, 'src/main.jsx'), 'utf8');
  const order = [...src.matchAll(/'(js\/(?:domain|data|ui)\/[^']+)'/g)].map(m => m[1]);
  assert.ok(order.length > 0, 'không đọc được danh sách script trong src/main.jsx');
  const all = files('js/domain').concat(files('js/data'), files('js/ui'));
  assert.deepEqual(all.filter(f => !order.includes(f)), [], 'file chưa được nạp trong src/main.jsx');
  const layer = f => ['domain', 'data', 'ui'].indexOf(f.split('/')[1]);
  order.forEach((f, i) => { if (i) assert.ok(layer(f) >= layer(order[i - 1]), `${f} nạp trước lớp dưới`); });
});
