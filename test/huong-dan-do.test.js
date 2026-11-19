// Hướng dẫn đo (bước 2 mỗi hạng mục): nội dung mặc định đủ hạng mục, có trích nguồn; khóa hình khớp danh mục hình;
// hình không nằm trong mã nguồn mà nạp từ tài liệu vào kho file riêng tư (đường dẫn guide/<loại>/<khóa>).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { load, CORE } = require('./harness');

test('mọi hạng mục của các mẫu MBA đều có hướng dẫn đo, có trích nguồn từng ý', () => {
  const ctx = load(CORE);
  const { MbaGuide, EquipmentTypes } = ctx;
  const T = EquipmentTypes.get('MBA');
  assert.equal(T.guide, MbaGuide);
  const ids = new Set();
  ['1P', '3P', '110'].forEach(tpl => {
    const cfg = T.normalizeCfg(Object.assign({}, T.defaultCfg(), { template: tpl === '1P' ? 'A' : tpl }));
    T.buildSchema(cfg).sections.forEach(s => ids.add(s.id));
  });
  ids.forEach(id => {
    const md = MbaGuide.GUIDE[id];
    assert.ok(md && md.length > 400, `hướng dẫn ${id}`);
    assert.match(md, /^### Mục đích/m, `${id}: có mục đích`);
    assert.match(md, /\*\((QĐ|QT|ĐT)[^)]*\)\*/, `${id}: có trích nguồn`);
  });
});

test('khóa hình trong hướng dẫn khớp danh mục; danh mục không có hình thừa; khung cắt PDF hợp lệ', () => {
  const { MbaGuide } = load(CORE);
  const used = new Set(Object.values(MbaGuide.GUIDE).flatMap(md => MbaGuide.imageKeys(md)));
  used.forEach(k => assert.ok(MbaGuide.IMAGES[k], `hình ${k} chưa khai báo`));
  Object.keys(MbaGuide.IMAGES).forEach(k => assert.ok(used.has(k), `hình ${k} không dùng`));
  Object.entries(MbaGuide.IMAGES).forEach(([k, im]) => {
    assert.ok(MbaGuide.DOCS[im.doc], k);
    assert.ok(im.caption, `${k}: chú thích`);
    if (im.doc === 'dt') { assert.match(im.media, /^word\/media\/image\d+\.png$/); assert.ok(im.size > 1000); }
    else {
      assert.ok(im.page >= 1 && im.page <= MbaGuide.DOCS.qt.pages, `${k}: trang`);
      const [x0, y0, x1, y1] = im.rect;
      assert.ok(x0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1 && x1 > x0 && y1 > y0, `${k}: khung`);
    }
  });
  assert.equal(MbaGuide.storagePath('MBA', 'qt-ir-cao'), 'guide/MBA/qt-ir-cao.png');
  assert.equal(MbaGuide.storagePath('MBA', 'u/ir-x1-so-do.jpg'), 'guide/MBA/u/ir-x1-so-do.jpg');
  assert.equal(MbaGuide.imagesOfDoc('qt').length + MbaGuide.imagesOfDoc('dt').length, Object.keys(MbaGuide.IMAGES).length);
});

test('mã nguồn không chứa hình của tài liệu nội bộ', () => {
  const root = path.join(__dirname, '..');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? (['node_modules', 'dist', '.git', 'vendor'].includes(e.name) ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]));
  const bad = walk(path.join(root, 'js')).concat(walk(path.join(root, 'css'))).filter(f => /guide|huong-dan/i.test(f) && /\.(png|jpe?g|webp)$/i.test(f));
  assert.deepEqual(bad, []);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'js/domain/types/mba/guide.js'), 'utf8'), /data:image\//);
});

test('Markdown hướng dẫn: dòng hình thành khung hình, chữ nghiêng cho trích nguồn', () => {
  const ctx = { document: { addEventListener() {} } }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/ui/help-ui.js'), 'utf8'), ctx);
  const html = ctx.HelpUI.mdToHtml('Đo *(QĐ Điều 31.2)*.\n\n![Sơ đồ](img:qt-ir-cao)\n\n![x](javascript:alert(1))', { image: (a, s) => `<fig data-a="${a}" data-s="${s}">` });
  assert.match(html, /<em>\(QĐ Điều 31\.2\)<\/em>/);
  assert.match(html, /<fig data-a="Sơ đồ" data-s="img:qt-ir-cao">/);
  // không có opts.image (trang Hướng dẫn sử dụng): giữ dạng chữ, không sinh thẻ hình
  assert.doesNotMatch(ctx.HelpUI.mdToHtml('![Sơ đồ](img:qt-ir-cao)'), /<img|<fig/);
});
