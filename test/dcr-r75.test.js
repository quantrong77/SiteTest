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

// Template giả: ghi lại ô bảng (bảng.hàng.cột) và trường (đoạn trước bảng); mọi thao tác khác bỏ qua
function recTpl(reads = {}) {
  const log = { cells: {}, fields: {} };
  const known = {
    log, tables: [],
    cell: (tables, r, c) => ({ key: `${tables[0]}.${r}.${c}` }),
    setCellText: (cell, text) => { if (cell) log.cells[cell.key] = text; return true; },
    writeField: (doc, text) => { log.fields[doc.before !== undefined ? `p${doc.before}` : JSON.stringify(doc)] = text; return true; },
    readField: doc => {
      const text = doc.before !== undefined ? reads[`p${doc.before}`] : undefined;
      if (text === undefined) return null;
      if (!doc.re) return text;
      const m = new RegExp(doc.re.source, doc.re.flags.replace('g', '')).exec(text); // như DocxTemplate: khe giá trị theo regex của trường
      return m && m.groups ? m.groups.v.trim() : null;
    },
    rows: () => [],
  };
  return new Proxy(known, { get: (o, k) => (k in o ? o[k] : () => null) });
}

test('xuất BBTN: bảng R một chiều ghi R@75 °C theo nhiệt độ từng pha; thiếu nhiệt độ thì không ghi số chưa quy đổi', () => {
  const ctx = load(CORE);
  const { state, schema } = F.fullState(ctx.Schema);
  Object.assign(state.v, { 'dcr.hv.t': '', 'dcr.hv.tA': '25', 'dcr.hv.tB': '30', 'dcr.hv.tC': '40', 'dcr.hv.t1.A': '200', 'dcr.hv.t1.B': '200', 'dcr.hv.t1.C': '200', 'dcr.mv.t': '', 'dcr.mv.tA': '', 'dcr.mv.tB': '', 'dcr.mv.tC': '' });
  state.sum = state.sum || { tick: {}, ev: {} };
  const res = ctx.Evaluate.evaluate(state, null, schema);
  const tpl = recTpl();
  const { miss } = ctx.MbaReport.fill(tpl, { state, res, schema, assets: {} });
  const hv = schema.sections.find(s => s.id === 'dcr').groups[0].grids[0];
  const row1 = hv.rows[0], cA = hv.cols.find(c => c.k === 'A'), cC = hv.cols.find(c => c.k === 'C');
  const cellOf = c => tpl.log.cells[`${hv.tables[0]}.${row1.doc}.${c.doc}`];
  assert.ok(Math.abs(num(cellOf(cA)) - r75(200, 25)) < 0.06, `ô A-N nấc 1 = ${cellOf(cA)}`);
  assert.ok(Math.abs(num(cellOf(cC)) - r75(200, 40)) < 0.06, `ô C-N nấc 1 = ${cellOf(cC)}`);
  // dòng nhiệt độ cuộn cao áp: chưa nhập nhiệt độ chung → các nhiệt độ pha
  const fT = hv && schema.sections.find(s => s.id === 'dcr').groups[0].fields.find(f => f.k === 'dcr.hv.t');
  assert.equal(tpl.log.fields[`p${fT.doc.before}`], '25; 30; 40 oC, quy đổi về 75');
  // cuộn trung áp không có nhiệt độ → không ghi số, báo thiếu
  assert.ok(miss.some(m => /^dcr\.mv\..*thiếu nhiệt độ/.test(m)));
});

test('nhập BBTN cũ: số trong bảng là R@75 °C → đổi về giá trị đo theo nhiệt độ ghi trên biên bản', () => {
  const ctx = load(CORE);
  const T = ctx.EquipmentTypes.get('MBA');
  const schema = T.buildSchema(T.defaultCfg());
  const dcr = schema.sections.find(s => s.id === 'dcr').groups;
  const hv = dcr[0];
  const fHV = hv.fields.find(f => f.k === 'dcr.hv.t');
  const v = { 'dcr.hv.t1.A': '241,2', 'dcr.hv.t1.C': '227,3', 'dcr.mv.r.A': '234,0' };
  const tpl = recTpl({ [`p${fHV.doc.before}`]: 'Cuộn dây 220kV , đo ở nhiệt độ t = 22; 30; 41 oC.' });
  const warn = ctx.MbaImportReport.dcrFrom75 ? ctx.MbaImportReport.dcrFrom75(tpl, schema, v) : null;
  assert.ok(warn, 'có hàm dcrFrom75');
  assert.equal(v['dcr.hv.tA'], '22'); assert.equal(v['dcr.hv.tC'], '41'); assert.equal(v['dcr.hv.t'], undefined);
  assert.equal(v['dcr.hv.t1.A'], '200'); // 241,2 · (235+22)/310
  assert.ok(Math.abs(num(v['dcr.hv.t1.C']) - 227.3 * 276 / 310) < 0.06);
  // cuộn trung áp không đọc được nhiệt độ → coi là @75 °C, cảnh báo
  assert.equal(v['dcr.mv.t'], '75'); assert.equal(v['dcr.mv.r.A'], '234');
  assert.ok(warn.some(w => /MV/.test(w)));
});

test('nhiệt độ quy đổi tùy chọn (mặc định 75 °C): cột, giá trị, BBTN và nhập lại theo nhiệt độ đã chọn', () => {
  const ctx = load(CORE);
  const rT = (r, t, T) => r * (235 + T) / (235 + t);
  // mặc định 75: ô cấu hình ở nhóm đầu, trống
  const s75 = ctx.Schema.build(F.defaultCfg(ctx.Schema));
  const g0 = s75.sections.find(s => s.id === 'dcr').groups[0];
  assert.ok(g0.fields.some(f => f.k === 'cfg.dcrRefT' && f.cfg === 'dcrRefT'));
  assert.equal(ctx.Schema.dcrRefOf({}), 75);
  assert.equal(ctx.Schema.dcrRefOf({ dcrRefT: '20' }), 20);
  assert.equal(ctx.Schema.dcrRefOf({ dcrRefT: 'abc' }), 75);
  // chọn 20 °C
  const { state } = F.fullState(ctx.Schema);
  state.cfg.dcrRefT = '20';
  state.sum = state.sum || { tick: {}, ev: {} };
  const schema = ctx.Schema.build(state.cfg);
  const hv = schema.sections.find(s => s.id === 'dcr').groups[0].grids[0];
  assert.equal(hv.cols.find(c => c.k === 'r75A').label.endsWith('@20 °C'), true);
  Object.assign(state.v, { 'dcr.hv.t': '30', 'dcr.hv.t1.A': '200' });
  const res = ctx.Evaluate.evaluate(state, null, schema);
  assert.ok(Math.abs(num(res.calc['dcr.hv.t1.r75A']) - rT(200, 30, 20)) < 0.06);
  // dòng CSDL vẫn lưu chuẩn 75 °C
  const { rows } = ctx.MbaRows.fieldRows(state, res, schema);
  const row = rows.find(r => r.item === 'DCR' && r.config === 'HV' && r.phase === 'A' && r.tap === '1');
  assert.equal(row.norm_temp_c, 75);
  // BBTN: ô ghi R@20, dòng nhiệt độ ghi kèm nhiệt độ quy đổi
  const tpl = recTpl();
  ctx.MbaReport.fill(tpl, { state, res, schema, assets: {} });
  const cell = tpl.log.cells[`${hv.tables[0]}.${hv.rows[0].doc}.${hv.cols.find(c => c.k === 'A').doc}`];
  assert.ok(Math.abs(num(cell) - rT(200, 30, 20)) < 0.06, `ô A-N = ${cell}`);
  const fT = schema.sections.find(s => s.id === 'dcr').groups[0].fields.find(f => f.k === 'dcr.hv.t');
  assert.equal(tpl.log.fields[`p${fT.doc.before}`], '30 oC, quy đổi về 20');
  // nhập lại: đọc "quy đổi về 20" → cfg.dcrRefT = 20, đổi ngược về giá trị đo
  const v = { 'dcr.hv.t': '30', 'dcr.hv.t1.A': cell };
  const cfg = {};
  ctx.MbaImportReport.dcrFrom75(recTpl({ [`p${fT.doc.before}`]: 'Cuộn dây 220kV , đo ở nhiệt độ t = 30 oC, quy đổi về 20 oC.' }), schema, v, cfg);
  assert.equal(cfg.dcrRefT, '20');
  assert.ok(Math.abs(num(v['dcr.hv.t1.A']) - 200) < 0.06, `R đo = ${v['dcr.hv.t1.A']}`);
});

test('mẫu 3 pha: đề mục "qui đổi về … oC" ghi nhiệt độ quy đổi đã chọn', () => {
  const ctx = load(CORE);
  const cfg = Object.assign(F.defaultCfg(ctx.Schema), { template: '3P', dcrRefT: '60' });
  const schema = ctx.Schema.build(cfg);
  const state = { type: 'MBA', cfg, v: { 'meta.serial': 'SN-T1', 'dcr.A.t': '25' }, sum: { tick: {}, ev: {} }, att: {} };
  const res = ctx.Evaluate.evaluate(state, null, schema);
  const log = [];
  const tpl = recTpl();
  const orig = tpl.writeField;
  const spy = new Proxy(tpl, { get: (o, k) => (k === 'writeField' ? (doc, text) => { log.push([doc.re && doc.re.source, text]); return orig(doc, text); } : o[k]) });
  ctx.MbaReport.fill(spy, { state, res, schema, assets: {} });
  assert.ok(log.some(([re, text]) => /đổi về/.test(re || '') && text === '60'), JSON.stringify(log.filter(x => /đổi/.test(x[0] || ''))));
});

test('ΔR giữa các pha: so trên R quy đổi đúng pha, kể cả khi một pha để trống ô R', () => {
  const ctx = load(CORE);
  const spread = xs => { const v = xs.filter(Number.isFinite); const avg = v.reduce((a, b) => a + b, 0) / v.length; return (Math.max(...v) - Math.min(...v)) / avg * 100; };
  const run = extra => {
    const { state, schema } = F.fullState(ctx.Schema);
    Object.assign(state.v, { 'dcr.hv.t': '30', 'dcr.hv.t1.A': '200', 'dcr.hv.t1.B': '201', 'dcr.hv.t1.C': '202' }, extra);
    return num(ctx.Evaluate.evaluate(state, null, schema).calc['dcr.hv.t1.dP']);
  };
  // cùng nhiệt độ: như so trên giá trị đo
  assert.ok(Math.abs(run({}) - spread([200, 201, 202])) < 0.006);
  // nhiệt độ khác nhau, đủ 3 pha
  assert.ok(Math.abs(run({ 'dcr.hv.tA': '28', 'dcr.hv.tC': '32' }) - spread([r75(200, 28), r75(201, 30), r75(202, 32)])) < 0.006);
  // pha B trống: so A với C sau quy đổi
  assert.ok(Math.abs(run({ 'dcr.hv.tA': '28', 'dcr.hv.tC': '32', 'dcr.hv.t1.B': '' }) - spread([r75(200, 28), r75(202, 32)])) < 0.006);
  // pha A trống: so B với C sau quy đổi (trước đây lệch vị trí pha → so giá trị đo)
  assert.ok(Math.abs(run({ 'dcr.hv.tB': '28', 'dcr.hv.tC': '40', 'dcr.hv.t1.A': '' }) - spread([r75(201, 28), r75(202, 40)])) < 0.006);
  // pha có số đo nhưng thiếu nhiệt độ → so trên giá trị đo (không trộn hai loại)
  assert.ok(Math.abs(run({ 'dcr.hv.t': '', 'dcr.hv.tA': '28', 'dcr.hv.tB': '30' }) - spread([200, 201, 202])) < 0.006);
});

test('đo cuộn cao áp A-Am (chỉ nối tiếp): dòng CSDL và xu hướng tại ô so với SER của xuất xưởng, không phải SER + COM', () => {
  const ctx = load(CORE);
  const { state, schema } = F.fullState(ctx.Schema);
  const hvRows = st => ctx.MbaRows.fieldRows(st, ctx.Evaluate.evaluate(st, null, schema), schema, { withKey: true }).rows.filter(r => r.item === 'DCR' && r.key && r.key.startsWith('dcr.hv.'));
  const r0 = hvRows(state);
  assert.ok(r0.length && r0.every(r => r.config === 'HV'), 'đo A-N → HV');
  state.cfg.hvMeas = 'SER';
  const s2 = ctx.Schema.build(state.cfg);
  Object.assign(state.v, { 'dcr.hv.t': '24', 'dcr.hv.t1.B': '131,95' });
  const pack = ctx.MbaRows.fieldRows(state, ctx.Evaluate.evaluate(state, null, s2), s2, { withKey: true });
  const rows = pack.rows.filter(r => r.item === 'DCR' && r.key && r.key.startsWith('dcr.hv.'));
  assert.ok(rows.length && rows.every(r => r.config === 'SER'), 'đo A-Am → SER');
  assert.ok(pack.rows.filter(r => r.item === 'DCR' && r.key && /^dcr\.(mv|lv)\./.test(r.key)).every(r => r.config !== 'SER'));
  // xu hướng tại ô: lịch sử xuất xưởng có cả SER (nối tiếp) và HV (= SER + COM) — ô B-Bm nấc 1 lấy SER
  const b1 = rows.find(r => r.key === 'dcr.hv.t1.B');
  const hist = [
    { session_id: 'x', kind: 'FAT', test_date: '2025-01-01', item: 'DCR', param: 'R', config: 'SER', phase: 'B', tap: b1.tap, value_cmp: 159.9, cmp_basis: 'norm' },
    { session_id: 'x', kind: 'FAT', test_date: '2025-01-01', item: 'DCR', param: 'R', config: 'HV', phase: 'B', tap: b1.tap, value_cmp: 230.0, cmp_basis: 'norm' },
  ];
  const s = ctx.TrendInline.series(hist, { item: 'DCR', param: 'R', config: b1.config, phase: 'B', tap: b1.tap, value_cmp: b1.value_norm, cmp_basis: 'norm' });
  assert.equal(s.base.config, 'SER');
  assert.ok(Math.abs(s.fromBase) < 2, `lệch so XX ${s.fromBase} %`);
});
