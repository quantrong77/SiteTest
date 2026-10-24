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

test('js/data/: không quyết định Đạt/Không đạt', () => {
  const bad = files('js/data').filter(f => /status\s*:\s*['"](pass|fail|warn)['"]/.test(src(f)));
  assert.deepEqual(bad, []);
});

test('index.html nạp đủ các file của ba lớp, nghiệp vụ trước dữ liệu trước giao diện', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const order = [...html.matchAll(/<script src="(js\/(?:domain|data|ui)\/[^"]+)"/g)].map(m => m[1]);
  const all = files('js/domain').concat(files('js/data'), files('js/ui'));
  assert.deepEqual(all.filter(f => !order.includes(f)), [], 'file chưa được nạp trong index.html');
  const layer = f => ['domain', 'data', 'ui'].indexOf(f.split('/')[1]);
  order.forEach((f, i) => { if (i) assert.ok(layer(f) >= layer(order[i - 1]), `${f} nạp trước lớp dưới`); });
});
