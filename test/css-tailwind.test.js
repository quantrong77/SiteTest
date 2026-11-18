// Vỏ React dùng Tailwind: tiện ích .grid { display: grid } trùng lớp table.grid của bảng nhập liệu cũ → tiêu đề cột lệch.
// css/app.css phải giữ display: table cho table.grid.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./harness');

test('table.grid giữ display: table (không bị tiện ích .grid của Tailwind biến thành lưới)', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  const rule = css.match(/(^|\n)table\.grid\s*\{([^}]*)\}/);
  assert.ok(rule, 'có quy tắc table.grid');
  assert.match(rule[2], /display:\s*table\s*;/);
});
