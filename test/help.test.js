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

test('hướng dẫn: liên kết mục trỏ đúng tiêu đề, nút Mở trang trỏ trang có thật, ảnh có trong docs/img và đều được dùng', () => {
  const { load, CORE } = require('./harness');
  const c = load(CORE);
  const T = c.EquipmentTypes.get('MBA');
  const sections = new Set();
  ['A', '3P', '110'].forEach(t => T.buildSchema(T.normalizeCfg(Object.assign({}, T.defaultCfg(), { template: t }))).sections.forEach(s => sections.add(s.id)));
  const pages = new Set(['field', 'factory', 'importReport', 'model3d', 'appendix', 'trend', 'summary', 'db', 'catalog', 'criteria', 'kconf', 'standards', 'guidecfg', 'general', ...sections]);
  const html = mdToHtml(markdown, { image: ctx.HelpUI.helpImage });
  const ids = new Set([...html.matchAll(/<h[1-3] id="([^"]+)"/g)].map(m => m[1]));
  const anchors = [...html.matchAll(/<a href="#([\w-]+)"/g)].map(m => m[1]);
  assert.ok(anchors.length >= 15);
  anchors.forEach(a => assert.ok(ids.has(a), `liên kết #${a} không có tiêu đề tương ứng`));
  const goes = [...html.matchAll(/data-help-go="([^"]+)"/g)].map(m => m[1].split('/')[0]);
  assert.ok(goes.length > 20);
  goes.forEach(g => assert.ok(pages.has(g), `nút Mở trang trỏ trang lạ: ${g}`));
  const imgs = [...markdown.matchAll(/!\[[^\]]*\]\((img\/[^)]+)\)/g)].map(m => m[1]);
  const files = fs.readdirSync(path.join(root, 'docs/img'));
  imgs.forEach(i => assert.ok(files.includes(i.slice(4)), `thiếu ảnh ${i}`));
  files.forEach(f => assert.ok(imgs.includes('img/' + f), `ảnh không dùng: ${f}`));
  assert.equal((html.match(/<figure class="help-fig">/g) || []).length, imgs.length);
  assert.match(html, /<div class="callout help-note">/);
});

test('hướng dẫn: ảnh chỉ nhận đường dẫn docs/img; liên kết #app tạo nút, không chạy javascript', () => {
  const h = ctx.HelpUI.helpImage;
  assert.match(h('Sơ đồ', 'img/a-1.webp'), /<img src="docs\/img\/a-1\.webp"/);
  assert.doesNotMatch(h('x', 'https://evil.example/a.png'), /<img/);
  assert.doesNotMatch(h('x', '../js/config.js'), /<img/);
  const out = mdToHtml('[Mở →](#app:ir/guide) [Xem](#muc-1) [x](#app:a b)');
  assert.match(out, /data-help-go="ir\/guide"/);
  assert.match(out, /<a href="#muc-1">Xem<\/a>/);
  assert.doesNotMatch(out, /data-help-go="a b"/);
});
