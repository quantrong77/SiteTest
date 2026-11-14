'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const ctx = { window: {}, document: { addEventListener() {} } };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/ui/help-ui.js'), 'utf8'), ctx);
const mdToHtml = ctx.HelpUI.mdToHtml;
const markdown = fs.readFileSync(path.join(root, 'docs/HUONG_DAN_SU_DUNG.md'), 'utf8');

test('chuyển Markdown hỗ trợ tiêu đề, danh sách, bảng, định dạng và liên kết an toàn', () => {
  const html = mdToHtml('# Tiêu đề\n\n## Một mục\n\n1. Bước **đậm** với `mã`.\n- Gạch đầu dòng\n\n| A | B |\n|---|---|\n| x | y |\n\n[XSS](javascript:alert(1)) [web](https://example.com)');
  assert.match(html, /<h1 id="tieu-de">/);
  assert.match(html, /<h2 id="mot-muc">/);
  assert.match(html, /<ol>/); assert.match(html, /<ul>/);
  assert.match(html, /<table class="ftable">/);
  assert.match(html, /<strong>đậm<\/strong>/); assert.match(html, /<code>mã<\/code>/);
  assert.doesNotMatch(html, /javascript:/i);
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.match(mdToHtml('<script>alert(1)</script>'), /&lt;script&gt;/);
  assert.doesNotMatch(mdToHtml('<script>alert(1)</script>'), /<script>/);
});

test('mapping ngữ cảnh đều khớp tiêu đề hướng dẫn', () => {
  const titles = [...markdown.matchAll(/^#{1,3}\s+(.+)$/gm)].map(m => m[1].toLocaleLowerCase('vi'));
  for (const [id, wanted] of Object.entries(ctx.HelpUI.CONTEXT)) {
    assert.ok(titles.some(title => title.includes(wanted.toLocaleLowerCase('vi'))), `${id} → ${wanted}`);
  }
});
