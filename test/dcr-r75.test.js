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
      assert.match(f.label, /^Nhiệt độ chung cuộn (cao|trung|hạ) áp/);
      const cols = g.grids[0].cols;
      // mỗi pha một ô nhiệt độ đo riêng, ngay sau ô chung
      const i = g.fields.indexOf(f);
      const phases = cols.filter(c => c.phase);
      assert.equal(g.fields.slice(i + 1, i + 1 + phases.length).map(x => x.k).join(), phases.map(c => `dcr.${w}.t${c.k}`).join());
      phases.forEach(c => assert.equal(g.fields.find(x => x.k === `dcr.${w}.t${c.k}`).label, `Nhiệt độ đo ${c.label} (°C)`));
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

test('nhiệt độ đo riêng từng pha: ưu tiên ô pha, trống thì ô chung của cuộn', () => {
  const ctx = load(CORE);
  const { state, schema } = F.fullState(ctx.Schema);
  Object.assign(state.v, { 'dcr.hv.t': '30', 'dcr.hv.tA': '25', 'dcr.hv.tB': '', 'dcr.hv.tC': '40', 'dcr.hv.t1.A': '200', 'dcr.hv.t1.B': '200', 'dcr.hv.t1.C': '200' });
  const res = ctx.Evaluate.evaluate(state, null, schema);
  assert.ok(Math.abs(num(res.calc['dcr.hv.t1.r75A']) - r75(200, 25)) < 0.06, 'pha A theo nhiệt độ pha A');
  assert.ok(Math.abs(num(res.calc['dcr.hv.t1.r75B']) - r75(200, 30)) < 0.06, 'pha B trống → nhiệt độ chung');
  assert.ok(Math.abs(num(res.calc['dcr.hv.t1.r75C']) - r75(200, 40)) < 0.06, 'pha C theo nhiệt độ pha C');
  const fA = res.findings.find(f => (f.keys || []).includes('dcr.hv.t1.A'));
  assert.match(fA.meas, /@25,0 °C/);
  // mẫu 3 pha: ô pha → ô chung → nhiệt độ máy
  const cfg = Object.assign(F.defaultCfg(ctx.Schema), { template: '3P' });
  const s3 = ctx.Schema.build(cfg);
  const v = { 'meta.serial': 'SN-T1', 'dcr.A.t': '25', 'dcr.B.t': '30', 'dcr.lv.tB': '45', 'dcr.lv.r.A': '10', 'dcr.lv.r.B': '10' };
  const st = { type: 'MBA', cfg, v, skip: {} };
  const r3 = ctx.Evaluate.evaluate(st, null, s3);
  assert.ok(Math.abs(num(r3.calc['dcr.lv.r.r75A']) - r75(10, 25)) < 0.006);
  assert.ok(Math.abs(num(r3.calc['dcr.lv.r.r75B']) - r75(10, 45)) < 0.006);
  const { rows } = ctx.MbaRows.fieldRows(st, r3, s3);
  assert.equal(rows.find(r => r.item === 'DCR' && r.config === 'LV' && r.phase === 'B').temp_c, 45);
});
