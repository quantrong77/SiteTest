// Bộ tiêu chí: mặc định đúng QĐ 1901; ngưỡng đơn vị đã chỉnh được dùng khi đánh giá và ghi vào kết luận tự động.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

const same = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);

test('mặc định = QĐ 1901, không có câu ghi chú trong kết luận', () => {
  const { Criteria, QD } = load(CORE);
  same(Criteria.limits(), JSON.parse(JSON.stringify(QD.LIMITS)));
  same(Criteria.changed(), []);
  assert.equal(Criteria.changedText(), '');
  assert.ok(Criteria.list().every(c => c.label && c.source && c.sec), 'mỗi ngưỡng có tên, căn cứ, hạng mục');
});

test('ngưỡng đơn vị: dùng khi đánh giá, ghi vào kết luận; khóa lạ, giá trị không phải số bị bỏ', () => {
  const ctx = load(CORE);
  const { Criteria, Evaluate } = ctx;
  const run = () => { const { state, schema } = F.fullState(ctx.Schema); const res = Evaluate.evaluate(state, F.fakeFactory(), schema); return { res, schema, state }; };
  const before = run().res.findings.filter(f => f.sec === 'ratio' && /±0\.5%/.test(f.limit || '')).length;
  assert.ok(before > 0);

  Criteria.setOverrides([{ key: 'RATIO_DEV', value: '0.3', note: 'HD NSX' }, { key: 'KHONG_CO', value: 1 }, { key: 'DCR_DEV', value: 'abc' }], 'db');
  same(Criteria.changed(), ['RATIO_DEV']);
  const { res, schema, state } = run();
  assert.equal(res.findings.filter(f => f.sec === 'ratio' && /±0\.3%/.test(f.limit || '')).length, before);
  assert.equal(res.findings.filter(f => /±0\.5%/.test(f.limit || '')).length, 0);
  const c = Evaluate.autoConclusion(res, schema, state);
  assert.match(c, /bộ tiêu chí của đơn vị, khác QĐ 1901 ở: Tỷ số biến — lệch tối đa so với nameplate và giữa các pha 0,3 % \(QĐ 1901: 0,5 %\)/);

  // ghi giá trị trùng QĐ 1901 → không tính là đã chỉnh
  Criteria.setOverrides([{ key: 'RATIO_DEV', value: 0.5 }], 'db');
  same(Criteria.changed(), []);
});

test('hạng mục dùng chung: R một chiều về 75 °C, tỷ số biến, lệch pha, điện dung', () => {
  const { TestItems: T } = load(CORE);
  const r = T.dcr({ m: 197.26, t: 28, ref: 228.0, refT: 75, lim: 2 });
  assert.ok(Math.abs(r.atRef - 197.26 * 310 / 263) < 1e-9);
  assert.equal(r.status, Math.abs(r.dev) <= 2 ? 'pass' : 'fail');
  assert.equal(T.dcr({ m: 1, t: NaN, ref: 1, lim: 2 }).status, 'missing', 'thiếu nhiệt độ');
  assert.equal(T.dcr({ m: 1, t: 20, ref: NaN, lim: 2 }).status, 'info', 'không có NSX → giá trị khởi đầu');
  assert.equal(T.ratio({ m: 2.4370, nominal: 2.4444, lim: 0.5 }).status, 'pass');
  assert.equal(T.ratio({ m: 2.4370, nominal: 2.4444, manualDev: 0.8, lim: 0.5 }).status, 'fail', 'độ lệch nhập tay được ưu tiên');
  assert.equal(T.ratio({ m: 2.4370, nominal: NaN, lim: 0.5 }).status, 'missing');
  assert.equal(T.spread([1, NaN, NaN], 2), null);
  assert.deepEqual(JSON.parse(JSON.stringify(T.spread([100, 101, 103], 2))), { sp: 3 / (304 / 3) * 100, status: 'fail' });
  assert.equal(T.capacitance({ c: 1050, ref: 1000, lim: 5 }).status, 'pass');
  assert.equal(T.capacitance({ c: 1051, ref: 1000, lim: 5 }).status, 'fail');
  assert.equal(T.capacitance({ c: 1051, ref: NaN, lim: 5 }).status, 'info');
});
