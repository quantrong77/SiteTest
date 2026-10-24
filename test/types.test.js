// Đăng ký loại thiết bị, biên bản cũ (không ghi loại) và dịch vụ lưu biên bản qua kho dữ liệu.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

const same = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);

test('MBA đã đăng ký và là loại mặc định của biên bản không ghi loại', () => {
  const { EquipmentTypes: E } = load(CORE);
  same(E.list().map(t => t.code), ['MBA']);
  assert.equal(E.codeOf({ v: {}, cfg: {} }), 'MBA');
  assert.equal(E.codeOf(null), 'MBA');
  assert.equal(E.codeOf({ type: 'TI' }), 'TI');
  assert.equal(E.get().code, 'MBA');
  assert.throws(() => E.get('TI'), /Chưa hỗ trợ loại thiết bị “TI”/);
});

test('Đăng ký loại thiết bị thiếu khai báo bắt buộc bị từ chối', () => {
  const { EquipmentTypes: E } = load(CORE);
  const mba = E.get('MBA');
  const def = Object.assign({}, mba, { code: 'TI', label: 'Biến dòng điện' });
  delete def.evaluate;
  assert.throws(() => E.register(def), /thiếu hoặc sai kiểu “evaluate”/);
  assert.throws(() => E.register(Object.assign({}, mba, { code: 'TI', toRows: {} })), /thiếu toRows.fieldRows/);
  assert.equal(E.has('TI'), false);
});

test('Cấu hình biên bản MBA cũ được bổ sung khóa mới, giữ nguyên giá trị đã có', () => {
  const { EquipmentTypes: E } = load(CORE);
  const old = { template: 'B', ps: { A: 'X1' }, taps: ['1', '2'], bctCores: { hv: 6 }, decSep: '.' };
  const cfg = E.get('MBA').normalizeCfg(old);
  assert.equal(cfg.template, 'B');
  same(cfg.ps, { A: 'X1', B: '', C: '' });
  same(cfg.bctCores, { hv: 6, mv: 4, lv: 4 });
  same([cfg.hdr, cfg.wtgdLabels, cfg.wtgdRows], [{}, {}, []]);
  assert.equal(cfg.decSep, '.');
  same(cfg.ctNo, JSON.parse(JSON.stringify(E.get('MBA').defaultCfg().ctNo)));
});

test('Biểu mẫu MBA khai báo trường đầu/cuối biên bản cho phần duyệt biểu mẫu dùng chung', () => {
  const { EquipmentTypes: E, Common, Schema } = load(CORE);
  const schema = E.get('MBA').buildSchema(E.get('MBA').defaultCfg());
  assert.equal(schema.head, Schema.META);
  assert.equal(schema.tail, Schema.CLOSING);
  const keys = [];
  Common.eachField(schema, f => keys.push(f.k));
  assert.equal(keys[0], Schema.META[0].k);
  assert.ok(keys.includes('meta.conclusion'));
  assert.equal(Common.findGrid(schema, 'wtgd.meas').labelCfg, 'wtgdLabels');
});

test('Lưu biên bản: mô-đun loại thiết bị dựng dòng CSDL, kho dữ liệu chỉ nhận gói dòng', async () => {
  const ctx = load(CORE);
  const calls = [];
  ctx.Records.setRepo({
    saveField: async (pack, state, status) => { calls.push(['saveField', pack.mainRef, pack.rows.length, status, state.v['meta.serial']]); return { id: 's1' }; },
    importFactory: async (packs, fileName) => { calls.push(['importFactory', packs.length, fileName]); return []; },
  });
  const { state, schema } = F.fullState(ctx.Schema);
  const res = ctx.Evaluate.evaluate(state, F.fakeFactory(), schema);
  assert.deepEqual(await ctx.Records.saveField(state, res, schema, 'draft'), { id: 's1' });
  assert.equal(calls[0][0], 'saveField');
  assert.equal(calls[0][1], 'MBA|SN-A');
  assert.ok(calls[0][2] > 100);
  assert.deepEqual(calls[0].slice(3), ['draft', 'SN-A']);
  await assert.rejects(() => ctx.Records.importFactory({ type: 'TI' }, {}, null, null), /Chưa hỗ trợ loại thiết bị/);
});

test('Lưu biên bản khi chưa gắn kho dữ liệu báo lỗi rõ', async () => {
  const ctx = load(CORE);
  const { state, schema } = F.fullState(ctx.Schema);
  const res = ctx.Evaluate.evaluate(state, null, schema);
  await assert.rejects(() => ctx.Records.saveField(state, res, schema), /Chưa gắn kho dữ liệu/);
});
