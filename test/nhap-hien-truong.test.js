// Nhập hiện trường: danh sách ô số cần nhập của một hạng mục, thứ tự đi ô, ô trống kế tiếp.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

function setup() {
  const ctx = load(CORE);
  const { state, schema } = F.fullState(ctx.Schema);
  return { ctx, FE: ctx.FieldEntry, state, schema };
}

test('cách điện: nhiệt độ trước, rồi bảng số liệu đo theo hàng; bỏ ô tự tính, bảng quy đổi chỉ đọc', () => {
  const { FE, schema } = setup();
  const c = FE.cells(schema, 'ir');
  assert.equal(c[0].key, 'ir.t'); assert.equal(c[0].kind, 'field');
  const keys = c.map(x => x.key);
  assert.deepEqual(JSON.parse(JSON.stringify(keys.slice(1, 5))), ['ir.meas.r0.r15', 'ir.meas.r0.r60', 'ir.meas.r0.r600', 'ir.meas.r1.r15']);
  assert.ok(!keys.some(k => /\.(kht|pi)$/.test(k)), 'không có ô gợi ý tự tính');
  assert.ok(!keys.some(k => k.startsWith('ir.c20')), 'không có bảng quy đổi');
  assert.match(c[1].label, /–/);
});

test('điện trở một chiều: bảng theo pha đi hết cột (các nấc pha A rồi pha B); đổi thứ tự theo hàng', () => {
  const { FE, schema } = setup();
  const c = FE.cells(schema, 'dcr').filter(x => x.grid === 'dcr.hv');
  assert.ok(c.length > 3);
  assert.ok(c.slice(0, 3).every(x => /^Pha A/.test(x.colLabel)), 'theo cột: pha A trước');
  assert.ok(!c.some(x => /\.d[ABC]$|\.dP$/.test(x.key)), 'không có cột độ lệch tự tính');
  const r = FE.cells(schema, 'dcr', { order: { 'dcr.hv': 'row' } }).filter(x => x.grid === 'dcr.hv');
  assert.deepEqual(JSON.parse(JSON.stringify(r.slice(0, 3).map(x => x.colLabel.slice(0, 5)))), ['Pha A', 'Pha B', 'Pha C']);
  assert.equal(r.length, c.length);
});

test('sứ: bỏ ô không áp dụng (skip) và hàng chữ; ô trống kế tiếp, số ô đã nhập', () => {
  const { FE, schema, state } = setup();
  const c = FE.cells(schema, 'bushing');
  const g = schema.sections.find(s => s.id === 'bushing').groups[0].grids[0];
  c.filter(x => x.grid === g.id).forEach(x => { const [rk, ck] = x.key.split('.').slice(-2); assert.ok(!(g.skip && g.skip(rk, ck)), x.key); });
  assert.ok(c.every(x => x.key && x.label));
  const v = {}; c.forEach((x, i) => { if (i !== 3) v[x.key] = '1'; });
  assert.equal(FE.filled(c, v), c.length - 1);
  assert.equal(FE.nextEmpty(c, v, 0), 3);
  assert.equal(FE.nextEmpty(c, v, 3), 3);
  v[c[3].key] = '2'; assert.equal(FE.nextEmpty(c, v, 0), -1);
  assert.equal(FE.cells(schema, 'khong-co').length, 0); // hạng mục lạ → []
  assert.ok(state);
});
