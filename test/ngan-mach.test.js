// Thí nghiệm ngắn mạch: dòng đánh giá (Uk, Pk theo QĐ 1901 Điều 35, QĐ 1387) do lớp nghiệp vụ dựng trong Evaluate,
// ngưỡng lấy từ bộ tiêu chí (Admin chỉnh được). Số liệu giả.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

// Uk = 6,05 kV / 110 kV × (100 A / 50 A) × 100 = 11 %; Pk = 50 kW × 2² = 200 kW (cùng nhiệt độ Test Report)
const ROW = { pair: 'HV-LV', tap: '9', tempC: '30', reportTempC: '30', frequencyHz: '50', ratedFrequencyHz: '50', ratedVoltageKV: '110',
  ratedCurrentA: '100', testCurrentA: '50', testVoltage: '6050', testVoltageUnit: 'V', powerKw: '50', nameplateUkPct: '11', testCase: 'new' };
function run(ctx, rows, ref) {
  const { state, schema } = F.fullState(ctx.Schema);
  state.att = Object.assign({}, state.att, { shortCircuit: { rows } });
  const fx = Object.assign(F.fakeFactory(), { shortCircuitFor: () => [Object.assign({ pair: 'HV-LV', tap: '9', ukPct: 11, pkKw: 180, pkTempC: 30 }, ref || {})] });
  const res = ctx.Evaluate.evaluate(state, fx, schema);
  return { res, sc: res.findings.filter(f => f.sec === 'shortCircuit') };
}

test('đánh giá ngắn mạch nằm trong Evaluate: Uk, Uk nhãn máy, Pk; trạng thái hạng mục tổng hợp', () => {
  const ctx = load(CORE);
  const { res, sc } = run(ctx, [ROW]);
  const by = item => sc.find(f => f.item === item);
  assert.equal(by('Trở kháng ngắn mạch Uk so với Test Report').status, 'pass');
  assert.equal(by('Uk so với nhãn máy').status, 'pass');
  const pk = by('Tổn hao có tải Pk so với Test Report');
  assert.equal(pk.status, 'pass'); assert.match(pk.limit, /≤115% Test Report/);
  assert.equal(res.sec.shortCircuit.status, 'pass');
  assert.equal(res.sec.shortCircuit.text, 'Đạt');
});

test('ngưỡng ngắn mạch theo bộ tiêu chí: chỉnh Pk tối đa 10% → Không đạt, chữ giới hạn đổi theo', () => {
  const ctx = load(CORE);
  ctx.Criteria.setOverrides([{ key: 'PK_RISE', value: '10' }, { key: 'SC_CURRENT_MIN', value: '60' }], 'db');
  const { res, sc } = run(ctx, [ROW]);
  const pk = sc.find(f => f.item === 'Tổn hao có tải Pk so với Test Report');
  // dòng thử 50% < 60% → điều kiện thử chưa đạt → Cần xem xét, kèm ghi chú
  assert.equal(pk.status, 'warn'); assert.match(pk.note, /ít nhất 60% In/); assert.match(pk.limit, /≤110%/);
  ctx.Criteria.setOverrides([{ key: 'PK_RISE', value: '10' }], 'db');
  const r2 = run(ctx, [ROW]);
  assert.equal(r2.sc.find(f => f.item === 'Tổn hao có tải Pk so với Test Report').status, 'fail');
  assert.equal(r2.res.sec.shortCircuit.status, 'fail');
  assert.equal(res.sec.shortCircuit.status, 'warn');
});

test('hạng mục ngắn mạch không thực hiện → không có dòng đánh giá; không có số liệu → không có dòng', () => {
  const ctx = load(CORE);
  const { state, schema } = F.fullState(ctx.Schema);
  state.att = { shortCircuit: { rows: [ROW] } };
  state.cfg.skip = { shortCircuit: true };
  const res = ctx.Evaluate.evaluate(state, F.fakeFactory(), schema);
  assert.equal(res.findings.filter(f => f.sec === 'shortCircuit').length, 0);
  assert.equal(run(ctx, []).sc.length, 0);
});
