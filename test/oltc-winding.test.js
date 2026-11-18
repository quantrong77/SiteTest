// Mẫu 110–220 kV: tùy chọn bộ điều áp dưới tải (OLTC) đặt ở cuộn cao áp (mặc định) hay trung áp (MBA 220 kV kiểu
// Liên Xô cũ). Số liệu giả; không dùng template / BBTN thật.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');

const plain = x => JSON.parse(JSON.stringify(x === undefined ? null : x));
const same = (a, b) => assert.deepEqual(plain(a), plain(b));

function setup(oltcWinding, template = '110') {
  const ctx = load(CORE);
  const T = ctx.EquipmentTypes.get('MBA');
  const cfg = T.normalizeCfg(Object.assign(T.defaultCfg(), { template, oltcWinding }));
  return { ctx, T, cfg, schema: T.buildSchema(cfg), grid: id => ctx.Common.findGrid(T.buildSchema(cfg), id) };
}
const fieldOf = (ctx, schema, k) => { let f = null; ctx.Common.eachField(schema, x => { if (x.k === k) f = x; }); return f; };

test('cấu hình mặc định và biên bản cũ: OLTC ở cuộn cao áp', () => {
  const { T } = setup('HV');
  assert.equal(T.defaultCfg().oltcWinding, 'HV');
  assert.equal(T.normalizeCfg({}).oltcWinding, 'HV');
  assert.equal(T.normalizeCfg({ oltcWinding: 'xyz' }).oltcWinding, 'HV');
  assert.equal(T.normalizeCfg({ oltcWinding: 'MV' }).oltcWinding, 'MV');
});

test('mẫu 110–220, OLTC trung áp: R một chiều cuộn trung áp theo nấc trên bảng nấc, cuộn cao áp một hàng', () => {
  const hvMode = setup('HV'), mvMode = setup('MV');
  const hvHV = hvMode.grid('dcr.hv'), mvHV = hvMode.grid('dcr.mv');
  const mv = mvMode.grid('dcr.mv'), hv = mvMode.grid('dcr.hv');
  // lưới trung áp: 19 nấc, dùng đúng bảng nấc của template; cột dời sang phải 1 (cột "Nấc" đầu bảng)
  assert.equal(mv.rows.length, 19);
  same(mv.rows.map(r => r.tap), hvHV.rows.map(r => r.tap));
  same(mv.tables, hvHV.tables);
  same(mv.cols.map(c => c.doc), mvHV.cols.map(c => c.doc + 1));
  assert.equal(mv.cols[0].docLabel, 'AmN');
  // lưới cao áp: một hàng trên bảng một hàng của template, tiêu đề cột ghi lại AN/BN/CN
  same(hv.rows.map(r => r.k), ['r']);
  same(hv.tables, mvHV.tables);
  same(hv.cols.filter(c => c.phase).map(c => c.docLabel), ['AN', 'BN', 'CN']);
  same(hv.cols.map(c => c.doc), hvHV.cols.map(c => (c.doc === undefined ? undefined : c.doc - 1)));
  // nhiệt độ đo ghi vào đề mục đứng trước bảng mới của từng cuộn
  assert.equal(fieldOf(mvMode.ctx, mvMode.schema, 'dcr.mv.t').doc.before, hvHV.tables[0]);
  assert.equal(fieldOf(mvMode.ctx, mvMode.schema, 'dcr.hv.t').doc.before, mvHV.tables[0]);
  // phép đo cuộn cao áp A-Am: tiêu đề cột theo cách đo
  const ser = setup('MV'); ser.cfg.hvMeas = 'SER';
  same(ser.ctx.Common.findGrid(ser.T.buildSchema(ser.cfg), 'dcr.hv').cols.filter(c => c.phase).map(c => c.docLabel), ['AAm', 'BBm', 'CCm']);
  // thứ tự nhóm trong mục R một chiều: trung áp (theo nấc) trước, như BBTN của đơn vị
  const sec = mvMode.schema.sections.find(s => s.id === 'dcr');
  same(sec.groups.map(g => g.id), ['mv', 'hv', 'lv']);
  assert.ok(sec.groups[0].fields.some(f => f.cfg === 'oltcWinding'), 'ô chọn cuộn đặt OLTC ở đầu mục');
});

test('mẫu 110–220, OLTC trung áp: tỷ số MV:LV theo nấc, HV:LV một hàng; đổi nhãn đề mục khi xuất', () => {
  const hvMode = setup('HV'), mvMode = setup('MV');
  const hlHV = hvMode.grid('ratio.hl'), mlHV = hvMode.grid('ratio.ml');
  const ml = mvMode.grid('ratio.ml'), hl = mvMode.grid('ratio.hl');
  assert.equal(ml.rows.length, 19); same(ml.tables, hlHV.tables); assert.equal(ml.cols[0].docLabel, 'UAmBm/Uab');
  same(hl.rows.map(r => r.k), ['r']); same(hl.tables, mlHV.tables); assert.equal(hl.cols[0].docLabel, 'UAB/Uab');
  same(mvMode.grid('ratio.hm').rows.length, 19);
  same(mvMode.schema.docSwaps, [
    { kind: 'winding', a: hvMode.grid('dcr.hv').tables[0], b: hvMode.grid('dcr.mv').tables[0] },
    { kind: 'ratio', a: hlHV.tables[0], b: mlHV.tables[0] },
  ]);
  assert.equal(hvMode.schema.docSwaps, undefined);
});

test('mẫu 500 kV không đổi theo tùy chọn (không có ô chọn, không đổi bảng)', () => {
  for (const template of ['A', '3P']) {
    const a = setup('HV', template), b = setup('MV', template);
    same(b.schema.sections.map(s => s.id), a.schema.sections.map(s => s.id));
    const grids = s => { const o = []; a.ctx.Common.eachGrid(s, g => o.push([g.id, g.rows.length, g.tables])); return o; };
    same(grids(b.schema), grids(a.schema));
    assert.equal(b.schema.docSwaps, undefined);
    assert.equal(fieldOf(b.ctx, b.schema, 'cfg.oltcWinding'), null);
  }
});

function mvState() {
  const { ctx, T, cfg, schema } = setup('MV');
  const v = { 'meta.serial': 'SN-GIA', 'meta.date': '01/11/2026', 'meta.reason': 'Định kỳ', 'dcr.mv.t': '30', 'dcr.hv.t': '30' };
  ctx.Common.findGrid(schema, 'dcr.mv').rows.forEach((r, i) => ['A', 'B', 'C'].forEach((ph, j) => { v[`dcr.mv.${r.k}.${ph}`] = String(300 + i * 5 + j * 0.4); }));
  ['A', 'B', 'C'].forEach((ph, j) => { v[`dcr.hv.r.${ph}`] = String(700 + j); });
  ctx.Common.findGrid(schema, 'ratio.ml').rows.forEach((r, i) => ['A', 'B', 'C'].forEach(ph => { v[`ratio.ml.${r.k}.${ph}`] = String(5 + i * 0.1); }));
  ['A', 'B', 'C'].forEach(ph => { v[`ratio.hl.r.${ph}`] = '11'; });
  return { ctx, T, schema, state: { v, cfg } };
}

test('đánh giá và dòng CSDL: R một chiều trung áp theo nấc, tỷ số MV:LV theo nấc', () => {
  const { ctx, T, schema, state } = mvState();
  const res = ctx.Evaluate.evaluate(state, null, schema);
  const dcrMv = res.findings.filter(f => f.sec === 'dcr' && f.item === 'R một chiều Cuộn trung áp (OLTC)');
  assert.equal(dcrMv.length, 19 * 3);
  assert.ok(dcrMv.some(f => /^Nấc 19 – pha C/.test(f.loc)));
  assert.ok(res.calc['dcr.mv.t1.dP'] !== undefined, 'độ lệch giữa các pha theo nấc');
  assert.equal(res.findings.filter(f => f.item === 'R một chiều Cuộn cao áp').length, 3);
  assert.equal(res.findings.filter(f => f.item === 'Tỷ số biến MV:LV').length, 19 * 3);
  const pack = T.toRows.fieldRows(state, res, schema);
  const mvRows = pack.rows.filter(r => r.item === 'DCR' && r.config === 'MV');
  assert.equal(mvRows.length, 19 * 3);
  same([...new Set(mvRows.map(r => r.tap))].length, 19);
  assert.ok(pack.rows.some(r => r.item === 'RATIO' && r.param === 'K' && r.config === 'MV/LV' && r.tap === '10'));
  assert.ok(pack.rows.some(r => r.item === 'DCR' && r.config === 'HV' && r.tap === ''));
  const main = pack.refs.find(r => r.key === pack.mainRef);
  assert.equal(main.rated.oltc_winding, 'MV');
  // mẫu 110 OLTC cao áp ghi 'HV'; mẫu 500 kV không ghi thuộc tính này
  const h = setup('HV');
  const hv = T.toRows.fieldRows({ v: { 'meta.serial': 'SN-GIA' }, cfg: h.cfg }, h.ctx.Evaluate.evaluate({ v: { 'meta.serial': 'SN-GIA' }, cfg: h.cfg }, null, h.schema), h.schema);
  assert.equal(hv.refs.find(r => r.key === hv.mainRef).rated.oltc_winding, 'HV');
  const a = setup('HV', 'A');
  const pa = T.toRows.fieldRows({ v: { 'meta.serial': 'SN-GIA' }, cfg: a.cfg }, a.ctx.Evaluate.evaluate({ v: { 'meta.serial': 'SN-GIA' }, cfg: a.cfg }, null, a.schema), a.schema);
  assert.equal(pa.refs.find(r => r.key === pa.mainRef).rated.oltc_winding, undefined);
});

// Template giả: đoạn văn đứng trước từng bảng (chỉ phần dùng để đổi nhãn)
function fakeTpl(before) {
  const paras = {};
  Object.entries(before).forEach(([t, list]) => { paras[t] = list.map(text => ({ text })); });
  const slot = (p, re) => { const m = re.exec(p.text); return m && m.groups ? m.groups.v.trim() : null; };
  return {
    paras,
    paraBefore: (t, re) => (paras[t] || []).slice().reverse().find(p => re.test(p.text)) || null,
    paraText: p => p.text,
    getSlot: slot,
    setSlot: (p, re, value) => {
      const m = new RegExp(re.source, re.flags.replace('d', '') + 'd').exec(p.text);
      if (!m) return false;
      const [s, e] = m.indices.groups.v;
      p.text = p.text.slice(0, s) + value + p.text.slice(e);
      return true;
    },
  };
}

test('xuất BBTN: đổi chỗ nhãn đề mục cuộn dây, cấp điện áp và tỷ số trước bảng nấc / bảng một hàng', () => {
  const { ctx, schema } = mvState();
  const [w, r] = schema.docSwaps;
  const tpl = fakeTpl({
    [w.a]: ['Điện trở một chiều các cuộn dây (Winding resistance mesuament), (mΩ):', 'Cuộn dây cao thế, ( H.V Winding ).', 'Cuộn dây 220kV , đo ở nhiệt độ t = oC.'],
    [w.b]: ['Cuộn dây trung áp, ( M.V Winding ).', 'Cuộn dây 110kV , đo ở nhiệt độ t = oC.'],
    [r.a]: ['Cuộn HV:LV.'],
    [r.b]: ['Cuộn MV:LV.'],
  });
  ctx.MbaReport.swapHeadings(tpl, schema.docSwaps);
  same(tpl.paras[w.a].map(p => p.text).slice(1), ['Cuộn dây trung áp, ( M.V Winding ).', 'Cuộn dây 110kV , đo ở nhiệt độ t = oC.']);
  same(tpl.paras[w.b].map(p => p.text), ['Cuộn dây cao thế, ( H.V Winding ).', 'Cuộn dây 220kV , đo ở nhiệt độ t = oC.']);
  same(tpl.paras[r.a].map(p => p.text), ['Cuộn MV:LV.']);
  same(tpl.paras[r.b].map(p => p.text), ['Cuộn HV:LV.']);
  // template đã sửa tay, thiếu đoạn: bỏ qua, không lỗi
  const partial = fakeTpl({ [w.a]: ['Cuộn dây cao thế, ( H.V Winding ).'] });
  ctx.MbaReport.swapHeadings(partial, schema.docSwaps);
  same(partial.paras[w.a].map(p => p.text), ['Cuộn dây cao thế, ( H.V Winding ).']);
});

test('nhập BBTN .docx cũ: nhận OLTC trung áp theo đề mục trước bảng nấc R một chiều', () => {
  const { ctx } = setup('HV');
  const schema = setup('HV').schema;
  const t = ctx.Common.findGrid(schema, 'dcr.hv').tables[0];
  const mv = fakeTpl({ [t]: ['Cuộn dây trung áp, ( M.V Winding ).', 'Cuộn dây 110kV , đo ở nhiệt độ t = 75 oC.'] });
  const hv = fakeTpl({ [t]: ['Cuộn dây cao thế, ( H.V Winding ).', 'Cuộn dây 220kV , đo ở nhiệt độ t = oC.'] });
  assert.equal(ctx.MbaImportReport.detectOltcWinding(mv, schema), 'MV');
  assert.equal(ctx.MbaImportReport.detectOltcWinding(hv, schema), 'HV');
  assert.equal(ctx.MbaImportReport.detectOltcWinding({}, schema), 'HV');
});
