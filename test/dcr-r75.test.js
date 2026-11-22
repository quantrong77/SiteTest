// Điện trở một chiều: nhiệt độ đo từng cuộn dây và cột R quy đổi về 75 °C (R75 = R·(235+75)/(235+t), QĐ 1901 Điều 31).
// Số liệu giả.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

const r75 = (r, t) => r * 310 / (235 + t);
const num = s => Number(String(s).replace(',', '.'));
const dcrGroups = schema => schema.sections.find(s => s.id === 'dcr').groups;

for (const [name, extra] of [['theo pha', {}], ['110 kV', { template: 'custom', layout: '110' }], ['110 kV, OLTC cuộn trung áp', { template: 'custom', layout: '110', oltcWinding: 'MV' }], ['3 pha', { template: '3P' }]]) {
  test(`mẫu ${name}: mỗi cuộn dây có ô nhiệt độ đo và cột @75 °C ngay sau mỗi cột pha`, () => {
    const ctx = load(CORE);
    const schema = ctx.Schema.build(Object.assign(F.defaultCfg(ctx.Schema), extra));
    const groups = dcrGroups(schema);
    assert.equal(groups.length, 3);
    groups.forEach(g => {
      const w = g.grids[0].id.split('.')[1];
      const f = g.fields.find(x => x.k === `dcr.${w}.t`);
      assert.ok(f, `thiếu ô nhiệt độ cuộn ${w}`);
      assert.match(f.label, /^Nhiệt độ đo cuộn (cao|trung|hạ) áp/);
      const cols = g.grids[0].cols;
      cols.forEach((c, i) => {
        if (!c.phase) return;
        const next = cols[i + 1];
        assert.equal(next.k, `r75${c.k}`);
        assert.ok(next.calc && next.nodoc, 'cột R75 tự tính, không ghi vào BBTN');
        assert.match(next.label, /@75 °C$/);
      });
    });
  });
}

test('R75 quy đổi theo nhiệt độ nhập của từng cuộn dây (mẫu theo pha)', () => {
  const ctx = load(CORE);
  const { state, schema } = F.fullState(ctx.Schema);
  Object.assign(state.v, { 'dcr.hv.t': '20', 'dcr.mv.t': '35', 'dcr.lv.t': '50', 'dcr.hv.t1.A': '200', 'dcr.mv.r.B': '120', 'dcr.lv.r.C': '15' });
  const res = ctx.Evaluate.evaluate(state, null, schema);
  assert.ok(Math.abs(num(res.calc['dcr.hv.t1.r75A']) - r75(200, 20)) < 0.06);
  assert.ok(Math.abs(num(res.calc['dcr.mv.r.r75B']) - r75(120, 35)) < 0.06);
  assert.ok(Math.abs(num(res.calc['dcr.lv.r.r75C']) - r75(15, 50)) < 0.006);
  // thiếu nhiệt độ cuộn dây → không tính R75
  state.v['dcr.lv.t'] = '';
  assert.equal(ctx.Evaluate.evaluate(state, null, schema).calc['dcr.lv.r.r75C'], undefined);
});

test('mẫu 3 pha: nhiệt độ cuộn dây để trống lấy nhiệt độ máy từng pha; nhập thì dùng nhiệt độ cuộn dây', () => {
  const ctx = load(CORE);
  const cfg = Object.assign(F.defaultCfg(ctx.Schema), { template: '3P' });
  const schema = ctx.Schema.build(cfg);
  const v = { 'meta.serial': 'SN-T1', 'dcr.A.t': '25', 'dcr.B.t': '30', 'dcr.C.t': '35', 'dcr.lv.r.A': '10', 'dcr.lv.r.B': '10', 'dcr.mv.r.A': '50' };
  const state = { type: 'MBA', cfg, v, skip: {} };
  let calc = ctx.Evaluate.evaluate(state, null, schema).calc;
  assert.ok(Math.abs(num(calc['dcr.lv.r.r75A']) - r75(10, 25)) < 0.006);
  assert.ok(Math.abs(num(calc['dcr.lv.r.r75B']) - r75(10, 30)) < 0.006);
  v['dcr.lv.t'] = '40';
  calc = ctx.Evaluate.evaluate(state, null, schema).calc;
  assert.ok(Math.abs(num(calc['dcr.lv.r.r75A']) - r75(10, 40)) < 0.006, 'cuộn hạ áp dùng nhiệt độ cuộn dây');
  assert.ok(Math.abs(num(calc['dcr.mv.r.r75A']) - r75(50, 25)) < 0.06, 'cuộn trung áp vẫn theo nhiệt độ máy pha A');
  // dòng CSDL lưu cùng nhiệt độ
  const { rows } = ctx.MbaRows.fieldRows(state, ctx.Evaluate.evaluate(state, null, schema), schema);
  const lvA = rows.find(r => r.item === 'DCR' && r.config === 'LV' && r.phase === 'A');
  assert.equal(lvA.temp_c, 40);
});
