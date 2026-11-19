// tgδ cuộn dây MBA (QĐ 1901 Điều 9 mục 5, Điều 30 mục 3): tgδ20 ≤ 1 % → tốt, không cần so với giá trị khởi đầu;
// lớn hơn → so với giá trị khởi đầu (cùng nhiệt độ, tăng ≤ 30 %); không có giá trị khởi đầu → tham khảo Bảng 46. Số liệu giả.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

function setup(v, withFx) {
  const ctx = load(CORE.concat(['js/domain/trend-inline.js']));
  const { state, schema } = F.fullState(ctx.Schema, { reason: 'Định kỳ 3 năm' });
  const g = ctx.Common.findGrid(schema, 'wtgd.meas');
  const k = `${g.id}.${g.rows[0].k}.tgd`;
  Object.assign(state.v, v(k));
  const fx = withFx ? F.fakeFactory() : null;
  const run = opts => ctx.Evaluate.evaluate(state, fx, schema, opts || {});
  const row = res => res.findings.find(f => f.sec === 'wtgd' && !f.trend && f.keys && f.keys[0] === k);
  return { ctx, state, schema, k, run, row, fx };
}

test('tgδ20 ≤ 1 %: Đạt, không so với giá trị khởi đầu (kể cả khi XX thấp hơn nhiều)', () => {
  const s = setup(k => ({ [k]: '0,25' }), true);
  const f = s.row(s.run());
  assert.equal(f.status, 'pass');
  assert.equal(f.limit, 'tgδ@20 °C ≤ 1 %');
});

test('tgδ20 > 1 %, không có giá trị khởi đầu: không tự đánh Không đạt — tra Bảng 46 theo điện áp cao áp', () => {
  // 0,7 % @10 °C → tgδ20 = 0,7 × K2(10) ≈ 1,09 % (> 1 %); Bảng 46 110÷220 kV @10 °C = 0,8 % → Đạt
  const s = setup(k => ({ [k]: '0,7', 'wtgd.t': '10', 'meta.voltage': '220/115/23' }), false);
  const f = s.row(s.run());
  assert.equal(f.status, 'pass', f.note);
  assert.match(f.limit, /Bảng 46/);
  assert.match(f.note, /không có giá trị khởi đầu/);
  // 2,0 % @32 °C (tgδ20 ≈ 1,17 %) vượt Bảng 46 @32 °C ≈ 1,38 % → Không đạt
  const hi = setup(k => ({ [k]: '2,0', 'wtgd.t': '32', 'meta.voltage': '220/115/23' }), false);
  assert.equal(hi.row(hi.run()).status, 'fail');
  // không biết điện áp → Cần xem xét (không tự chọn bảng)
  const nv = setup(k => ({ [k]: '2,0', 'wtgd.t': '32', 'meta.voltage': '' }), false);
  assert.equal(nv.row(nv.run()).status, 'warn');
});

test('tgδ20 > 1 %, có XX: so với giá trị khởi đầu cùng nhiệt độ, tăng ≤ 30 %', () => {
  const s = setup(k => ({ [k]: '2,0' }), true);
  const f = s.row(s.run());
  assert.match(f.limit, /tăng ≤ 30%/);
  const rise = parseFloat(f.dev.replace(',', '.'));
  assert.equal(f.status, rise > 30 ? 'fail' : 'pass');
});

test('tgδ20 > 1 %, CSDL có giá trị khởi đầu: đánh giá theo dòng Xu hướng, dòng trong mục chỉ tham khảo', () => {
  const s = setup(k => ({ [k]: '2,0', 'wtgd.t': '32', 'meta.voltage': '220/115/23' }), false);
  const blank = s.run();
  const pack = s.ctx.MbaRows.fieldRows(s.state, blank, s.schema, { withKey: true });
  const r = pack.rows.find(x => x.key === s.k);
  const serial = new Map(pack.refs.map(x => [x.key, x.serial_no])).get(r.eq);
  const hist = [{ serial_no: serial, item: r.item, param: r.param, config: r.config, phase: r.phase, tap: r.tap,
    value_cmp: r.value_norm / 2, cmp_basis: 'norm', kind: 'SAT', test_date: '2020-01-01', session_id: 's1' }];
  const res = s.run({ history: hist });
  const tr = res.findings.find(f => f.trend && f.keys[0] === s.k);
  assert.ok(tr, 'có dòng xu hướng');
  assert.equal(tr.status, 'fail', 'tăng 100 % > 30 %');
  const f = s.row(res);
  assert.equal(f.status, 'info');
  assert.match(f.note, /xem dòng Xu hướng/);
});
