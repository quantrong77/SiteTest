// Mẫu BBTN chung 3 pha (tổ 3 máy 1 pha A, B, C trong một biên bản): bố cục biểu mẫu, đánh giá theo từng máy,
// dòng CSDL, phụ lục biến dòng chân sứ. Số liệu giả; mẫu theo pha máy chính được khóa bằng test ảnh chụp.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

const same = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);
const vn = x => String(+x.toFixed(4)).replace('.', ',');

function base(gid, rk, ck) {
  if (/^nl\.[ABC]\.rated$/.test(gid)) return { um: 35.2, ur: 35.0, ia: 3.1, pm: 60 }[ck];
  if (/^ir\.[ABC]\.meas$/.test(gid)) return { r15: 8000, r60: 12000, r180: 16000, r360: 20000, r600: 25000 }[ck];
  if (/^b\.\w+\.meas$/.test(gid)) return { ur: 245, tgd1: 0.35, c1: 450, tgd2: 0.5, c2: 3000 }[rk];
  if (/^wtgd\.[ABC]\.meas$/.test(gid)) return { tgd: 0.25, c: 8000 }[ck];
  if (gid.startsWith('dcr.')) return 150;
  if (gid === 'ratio.hm') return 2.2;
  if (gid === 'ratio.hl') return 9;
  if (gid === 'ratio.ml') return 3.7;
  if (gid === 'moist') return 1.2;
  if (/^bct\.\w+\.ir$/.test(gid)) return 5000;
  if (/^bct\.\w+\.ratio$/.test(gid)) return 1000;
  if (/^bct\.\w+\.dcr$/.test(gid)) return 5;
  return undefined;
}

function state3P(Schema) {
  const cfg = Object.assign(F.defaultCfg(Schema), { template: '3P' });
  const schema = Schema.build(cfg);
  const v = {};
  Schema.eachGrid(schema, g => {
    if (g.readonly) return;
    g.rows.forEach((r, ri) => g.cols.forEach((c, ci) => {
      if (c.calc || c.auto || (g.skip && g.skip(r.k, c.k))) return;
      const k = `${g.id}.${r.k}.${c.k}`;
      if (g.id === 'visual.items') { v[k] = 'Đạt/Pass'; return; }
      if (r.text || c.text) { v[k] = r.k === 'serial' ? `S-${g.id.split('.')[1]}-${c.k}` : `${r.k}-${c.k}`; return; }
      const b = base(g.id, r.k, c.k);
      if (b !== undefined) v[k] = vn(b * (1 + 0.004 * ri + 0.003 * ci));
    }));
  });
  Object.assign(v, {
    'meta.serial': 'SN-A', 'meta.reason': 'Sau lắp đặt', 'meta.ambT': '30', 'meta.vector': 'YNa0d11', 'vector.result': 'YNa0d11', 'visual.eval': 'Đạt',
    'ir.A.t': '30', 'ir.B.t': '31', 'ir.C.t': '32', 'wtgd.A.t': '35', 'wtgd.B.t': '35', 'wtgd.C.t': '36',
    'dcr.A.t': '30', 'dcr.B.t': '40', 'dcr.C.t': '26',
    'b.hv.t': '35', 'b.hv.kmode': 'Nhập hệ số K', 'b.hv.k': '0,9', 'b.n.kmode': 'Nhập hệ số K', 'b.n.k': '0,9',
    'oltc.type': 'VUCGN 380/1000', 'oltc.eval': 'Đạt', 'bct.polarity': 'Đúng cực tính', 'bct.t_dcr': '30',
  });
  return { state: { v, cfg, att: {}, sum: { tick: {}, ev: {} } }, schema };
}

test('chọn mẫu: template 3P (hoặc template tùy chỉnh nhận dạng 3 pha) → bố cục 3 pha', () => {
  const { Schema } = load(CORE);
  assert.equal(Schema.layoutOf({ template: 'A' }), '1P');
  assert.equal(Schema.layoutOf({ template: '3P' }), '3P');
  assert.equal(Schema.layoutOf({ template: 'custom', layout: '3P' }), '3P');
  assert.equal(Schema.layoutOf({ template: 'A', layout: '3P' }), '1P');
});

test('biểu mẫu 3 pha: hạng mục theo máy lặp cho A, B, C; bảng ánh xạ đúng 28 bảng của mẫu', () => {
  const { Schema } = load(CORE);
  const schema = Schema.build(Object.assign(F.defaultCfg(Schema), { template: '3P' }));
  assert.equal(schema.layout, '3P');
  assert.equal(schema.tables, 28);
  same(schema.sections.map(s => s.id), ['visual', 'noload', 'ir', 'vector', 'bushing', 'wtgd', 'dcr', 'ratio', 'moisture', 'oltc', 'bct']);
  const ids = [];
  Schema.eachGrid(schema, g => {
    ids.push(g.id);
    (g.tables || []).forEach(t => assert.ok(t >= 1 && t <= 26, `${g.id}: bảng ${t}`));
  });
  assert.equal(new Set(ids).size, ids.length, 'mã lưới không trùng');
  ['nl', 'ir', 'wtgd'].forEach(p => ['A', 'B', 'C'].forEach(ph => assert.ok(ids.includes(p === 'nl' ? `nl.${ph}.rated` : `${p}.${ph}.meas`), `${p}.${ph}`)));
  same(['b.hv.meas', 'b.mv.meas', 'b.n.meas', 'b.lv.meas', 'b.lv2.meas'].map(id => ids.includes(id)), [true, true, true, true, true]);
  // 17 nấc, R một chiều mΩ không có cột ΔR từng pha trong BBTN
  const dcr = schema.sections.find(s => s.id === 'dcr').groups[0].grids[0];
  assert.equal(dcr.rows.length, 17);
  same(dcr.cols.filter(c => c.doc !== undefined).map(c => [c.k, c.doc]), [['A', 1], ['B', 2], ['C', 3], ['dP', 4]]);
  // biến dòng chân sứ: không có bảng trong thân BBTN
  Schema.eachGrid(schema, (g, s) => { if (s.id === 'bct') assert.equal(g.tables, undefined, g.id); });
  // tổng hợp: mục 3 và 4 lấy theo cách điện, cột ✓ = 6, đánh giá = 7
  same(schema.summary.rows.ir, [13, 14]);
  assert.equal(schema.summary.tick, 6);
});

test('đánh giá 3 pha: mỗi máy so với xuất xưởng của chính nó, nhiệt độ riêng từng máy', () => {
  const ctx = load(CORE);
  const { state, schema } = state3P(ctx.Schema);
  const res = ctx.Evaluate.evaluate(state, F.fakeFactory(), schema);
  const by = sec => res.findings.filter(f => f.sec === sec);
  // không tải: P0 của 3 máy, mỗi máy tham chiếu P0 xuất xưởng riêng (58 / 59 / 61 kW)
  const p0 = by('noload').filter(f => /P0/.test(f.item) && /lần 1/.test(f.item));
  same(p0.map(f => f.ref), ['58,00 kW (XX)', '59,00 kW (XX)', '61,00 kW (XX)']);
  assert.ok(p0.every((f, i) => f.loc.startsWith(['SN-A', 'SN-B', 'SN-C'][i])));
  // cách điện: R60 quy đổi theo nhiệt độ từng máy; K1 và số chế tạo ghi vào BBTN theo pha
  const r60 = by('ir').filter(f => /^R60 Cao, Trung ~ Hạ/.test(f.item));
  same(r60.map(f => /@(\d+),0 °C/.exec(f.meas)[1]), ['30', '31', '32']);
  assert.ok(res.notes['ir.A.k1'] && res.notes['ir.C.k1']);
  assert.equal(res.notes['ir.B.sn'], ' SN-B');
  assert.ok(res.calc['ir.A.c20.r0.r180'], 'R180 quy đổi 20 °C');
  // tgδ cuộn dây: cột tgδ@20 °C trong cùng bảng, nhiệt độ ở tiêu đề cột
  assert.ok(res.calc['wtgd.A.meas.r4.t20']);
  assert.equal(res.notes['wtgd.C.th'], ' 36,0');
  assert.equal(by('wtgd').filter(f => /^tgδ/.test(f.item)).length, 18);
  // R một chiều: quy đổi 75 °C theo nhiệt độ từng máy
  const d1 = by('dcr').filter(f => /^R một chiều Cuộn cao áp/.test(f.item) && /^Nấc 1 –/.test(f.loc));
  same(d1.map(f => /@(\d+),0 °C/.exec(f.meas)[1]), ['30', '40', '26']);
  // ẩm theo máy, OLTC theo bảng số vòng pha, bên ngoài theo 9 hạng mục
  same(by('moisture').map(f => f.keys[0]), ['moist.r.A', 'moist.r.B', 'moist.r.C']);
  assert.ok(by('oltc').some(f => /12 lần chuyển nấc/.test(f.meas)));
  assert.equal(by('visual').find(f => /hạng mục/.test(f.item)).status, 'pass');
  // sứ: 5 nhóm, nhóm để trống nhiệt độ lấy theo sứ cao áp
  assert.ok(by('bushing').some(f => /trung tính/.test(f.loc)));
  assert.ok(by('bushing').some(f => /x$|x \[/.test(f.loc)));
});

test('CSDL 3 pha: số liệu theo máy gắn vào đúng máy A, B, C', () => {
  const ctx = load(CORE);
  const { state, schema } = state3P(ctx.Schema);
  const res = ctx.Evaluate.evaluate(state, F.fakeFactory(), schema);
  const out = ctx.MbaRows.fieldRows(state, res, schema);
  const eqOf = s => out.refs.find(r => r.serial_no === s).key;
  const rows = (item, param) => out.rows.filter(r => r.item === item && r.param === param);
  same([...new Set(rows('IR', 'R180').map(r => r.eq))].sort(), ['SN-A', 'SN-B', 'SN-C'].map(eqOf).sort());
  same(rows('MOISTURE', 'WC').map(r => r.eq), ['SN-A', 'SN-B', 'SN-C'].map(eqOf));
  assert.equal(rows('NOLOAD', 'I0_A').length, 6);
  assert.equal(rows('OLTC', 'ROUNDS_K').length, 36);
  const dcrB = rows('DCR', 'R').find(r => r.phase === 'B' && r.config === 'HV' && r.tap === '1');
  assert.equal(dcrB.temp_c, 40);
  assert.ok(rows('BUSHING', 'TGD1').some(r => r.config === '3.2'), 'sứ x, y, z (vị trí 3.2)');
});

test('phụ lục biến dòng chân sứ (mẫu 3 pha): bảng theo phía, chỉ hàng có số liệu', () => {
  const ctx = load(CORE);
  const { state, schema } = state3P(ctx.Schema);
  const res = ctx.Evaluate.evaluate(state, F.fakeFactory(), schema);
  assert.ok(ctx.MbaReport.hasBct(state));
  assert.equal(ctx.MbaReport.hasBct({ v: { 'bct.polarity': 'x' } }), false);
  const blocks = ctx.MbaReport.bctAppendix(state, schema, res, x => x, 'PHỤ LỤC 2');
  assert.equal(blocks[0].type, 'page');
  assert.equal(blocks[1].text, 'PHỤ LỤC 2');
  const tables = blocks.filter(b => b.type === 'table');
  assert.ok(tables.length >= 9, `${tables.length} bảng`);
  tables.forEach(t => t.rows.forEach(r => assert.equal(r.length, t.head.length)));
  same(ctx.Appendix.list({ att: {} }, { bct: true }).map(a => a.kind), ['bct']);
  same(ctx.Appendix.list({ att: {} }, {}).map(a => a.kind), []);
});

test('sứ mẫu 3 pha: nhiệt độ riêng từng sứ dùng để quy đổi 20 °C, trống thì theo nhiệt độ chung', () => {
  const ctx = load(CORE);
  const { state, schema } = state3P(ctx.Schema);
  // nhập K theo nhiệt độ: dùng bảng QĐ 1901 để K phụ thuộc nhiệt độ sứ
  Object.assign(state.v, { 'b.hv.kmode': 'Theo QĐ 1901 – bảng hệ số K', 'b.hv.btype': 'OIP', 'b.hv.mount': 'Đã lắp', 'b.hv.t': '35', 'b.hv.meas.t.B': '20' });
  const res = ctx.Evaluate.evaluate(state, F.fakeFactory(), schema);
  const conv = ph => res.findings.find(f => f.item === 'tgδ C1 sứ' && f.keys[0] === `b.hv.meas.tgd1.${ph}`);
  // sứ B đo ở 20 °C: K = 1, tgδ20 = tgδ đo; sứ A, C theo nhiệt độ chung 35 °C
  const n = s => Number(String(s).replace(',', '.'));
  assert.ok(Math.abs(n(res.calc['b.hv.c20.tgd1.B']) - n(state.v['b.hv.meas.tgd1.B'])) < 0.001, 'sứ B: K = 1 ở 20 °C');
  assert.ok(Math.abs(n(res.calc['b.hv.c20.tgd1.A']) - n(state.v['b.hv.meas.tgd1.A'])) > 0.005, 'sứ A: quy đổi theo 35 °C');
  assert.match(conv('B').note, /nhiệt độ sứ 20,0 °C/);
  assert.doesNotMatch(conv('A').note, /nhiệt độ sứ/);
  const out = ctx.MbaRows.fieldRows(state, res, schema);
  const tB = out.rows.filter(r => r.item === 'BUSHING' && r.param === 'TGD1' && r.config === '1.1').map(r => r.temp_c);
  assert.ok(tB.length === 3 && new Set(tB).size === 2, `nhiệt độ sứ trong CSDL: ${tB}`);
});

test('xuất BBTN: chèn hàng nhiệt độ sứ khi template chưa có, đã có thì giữ nguyên', () => {
  const ctx = load(CORE);
  const schema = ctx.Schema.build(Object.assign(F.defaultCfg(ctx.Schema), { template: '3P' }));
  // bảng 11: chưa có hàng nhiệt độ; 12: đã có đúng vị trí; 13: có chữ "Nhiệt độ" ở hàng khác (vẫn phải chèn)
  const tables = { 11: ['Số chế tạo', 'Kiểu loại', 'Mã hiệu', 'Điện áp định mức', 'Dòng điện định mức', 'tg C1'],
    12: ['Số chế tạo', 'Kiểu loại', 'Mã hiệu', 'Điện áp định mức', 'Dòng điện định mức', 'Nhiệt độ đo (°C)', 'tg C1'],
    13: ['Số chế tạo (đo ở nhiệt độ môi trường)', 'Kiểu loại', 'Mã hiệu', 'Điện áp định mức', 'Dòng điện định mức', 'tg C1'] };
  const ins = [];
  const tpl = {
    rows: t => (tables[t[0]] || ['x']).map(s => ({ textContent: s })),
    insertRowAfter: (t, after, label) => { ins.push([t, after, label.split('\n')[0]]); return true; },
  };
  ctx.Report.prepare(tpl, schema);
  same(ins.filter(x => x[0] === 11), [[11, 4, 'Nhiệt độ đo (°C)']]);
  assert.equal(ins.filter(x => x[0] === 12).length, 0, 'bảng đã có hàng nhiệt độ');
  same(ins.map(x => x[0]).sort((a, b) => a - b), [11, 13, 14, 15]);
});
