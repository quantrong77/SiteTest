// BBTN riêng từng pha của tổ 3 máy 1 pha: bổ sung R một chiều, tỷ số biến của 2 pha còn lại từ CSDL (cùng đợt ≤ N ngày),
// quy R về nhiệt độ cuộn dây của biên bản; số liệu bổ sung không ghi vào lần thí nghiệm này. Số liệu giả.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

function setup(days) {
  const ctx = load(CORE);
  const cfg = Object.assign(F.defaultCfg(ctx.Schema), { template: 'A', topology: 'single1p', ps: { A: 'SN-A', B: 'SN-B', C: 'SN-C' } });
  if (days !== undefined) cfg.campaignDays = days;
  const schema = ctx.Schema.build(cfg);
  const g = ctx.Common.findGrid(schema, 'dcr.hv'), r0 = g.rows[0].k;
  const v = { 'meta.serial': 'SN-A', 'meta.date': '10/03/2025', 'meta.reason': 'Định kỳ', 'dcr.hv.t': '30', [`dcr.hv.${r0}.A`]: '400' };
  const state = { type: 'MBA', cfg, v, att: {} };
  // ánh xạ ô → khóa đại lượng như TrendInlineUI (điền tạm ô trống)
  const dv = Object.assign({}, v);
  ctx.Common.eachGrid(schema, gg => gg.rows.forEach(r => gg.cols.forEach(c => { const k = `${gg.id}.${r.k}.${c.k}`; if (!gg.readonly && !c.calc && !c.text && !r.text && !dv[k]) dv[k] = '1'; })));
  const blank = Object.fromEntries(schema.sections.map(s => [s.id, { status: null, text: '', counts: { pass: 0, warn: 0, fail: 0, missing: 0, info: 0 } }]));
  const pack = ctx.MbaRows.fieldRows(Object.assign({}, state, { v: dv }), { calc: {}, findings: [], sec: blank }, schema, { withKey: true });
  const ser = new Map(pack.refs.map(x => [x.key, x.serial_no]));
  const cells = new Map(pack.rows.filter(x => x.key).map(x => [x.key, { item: x.item, param: x.param, config: x.config, phase: x.phase, tap: x.tap, serial_no: ser.get(x.eq) }]));
  return { ctx, state, schema, cells, r0, key: k => cells.get(k) };
}

test('bổ sung pha B, C cùng đợt; quy R75 về nhiệt độ biên bản; lần ngoài N ngày bị bỏ', () => {
  const { ctx, state, schema, cells, r0, key } = setup();
  const kB = `dcr.hv.${r0}.B`, kC = `dcr.hv.${r0}.C`;
  const H = (k, o) => Object.assign({ session_id: 'x' }, key(k), o);
  const history = [
    H(kB, { serial_no: 'SN-B', test_date: '2025-03-01', value: 401, temp_c: 25, value_norm: 480, norm_temp_c: 75 }),
    H(kB, { serial_no: 'SN-B', test_date: '2024-03-01', value: 390, temp_c: 25, value_norm: 470, norm_temp_c: 75 }),
    H(kC, { serial_no: 'SN-C', test_date: '2025-01-01', value: 402, temp_c: 25, value_norm: 481, norm_temp_c: 75 }),
  ];
  const val = k => ctx.Common.toNum(state.v[k]);
  const p = ctx.MbaPhaseFill.plan({ state, schema, cells, history, val });
  const fB = p.fills.find(f => f.k === kB);
  assert.equal(fB.date, '2025-03-01');
  assert.equal(fB.value, String(+(480 * 265 / 310).toFixed(4)).replace('.', ','));
  assert.match(fB.note, /quy từ 401 mΩ @25 °C về 30 °C/);
  assert.ok(!p.fills.some(f => f.k === kC), 'pha C đo cách 68 ngày > 30 ngày');
  const p2 = ctx.MbaPhaseFill.plan({ state: Object.assign({}, state, { cfg: Object.assign({}, state.cfg, { campaignDays: '90' }) }), schema, cells, history, val });
  assert.ok(p2.fills.some(f => f.k === kC), 'N = 90 ngày: có pha C');
  // ô đã có số đo của người dùng: giữ nguyên
  state.v[kB] = '399';
  assert.ok(!ctx.MbaPhaseFill.plan({ state, schema, cells, history, val }).fills.some(f => f.k === kB));
});

test('không áp dụng: mẫu chung 3 pha, máy không thuộc tổ; thiếu ngày thí nghiệm', () => {
  const { ctx, state, schema, cells } = setup();
  assert.equal(ctx.MbaPhaseFill.applies(Object.assign({}, state, { cfg: Object.assign({}, state.cfg, { ps: { A: 'SN-A' } }) }), schema), null);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.MbaPhaseFill.applies(state, schema))), { cur: 'A', others: ['B', 'C'] });
  const noDate = Object.assign({}, state, { v: Object.assign({}, state.v, { 'meta.date': '' }) });
  assert.equal(ctx.MbaPhaseFill.plan({ state: noDate, schema, cells, history: [], val: () => NaN }).reason, 'no-date');
});

test('ô bổ sung từ pha khác không ghi vào lần thí nghiệm này khi lưu CSDL', () => {
  const { ctx, state, schema, r0 } = setup();
  const kB = `dcr.hv.${r0}.B`;
  state.v[kB] = '410';
  const blank = Object.fromEntries(schema.sections.map(s => [s.id, { status: null, text: '', counts: { pass: 0, warn: 0, fail: 0, missing: 0, info: 0 } }]));
  const res = { calc: {}, findings: [], sec: blank };
  const has = () => { const pk = ctx.MbaRows.fieldRows(state, res, schema); const ref = pk.refs.find(r => r.serial_no === 'SN-B'); return !!ref && pk.rows.some(r => r.eq === ref.key); };
  assert.equal(has(), true, 'người dùng tự nhập: ghi');
  state.att.phaseFill = { [kB]: { serial: 'SN-B', phase: 'B', date: '2025-03-01' } };
  assert.equal(has(), false, 'bổ sung từ CSDL: không ghi');
});
