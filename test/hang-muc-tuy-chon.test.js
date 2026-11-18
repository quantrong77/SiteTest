// Hạng mục thực hiện / không thực hiện, thí nghiệm ngắn mạch là mục cuối BBTN, loại thí nghiệm (lý do) mới.
// Số liệu giả; template giả cho phần xuất BBTN.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

const plain = x => JSON.parse(JSON.stringify(x === undefined ? null : x));
const same = (a, b) => assert.deepEqual(plain(a), plain(b));

test('số mục khớp mẫu Word; thí nghiệm ngắn mạch là mục cuối', () => {
  const ctx = load(CORE), T = ctx.EquipmentTypes.get('MBA');
  const nos = template => T.buildSchema(T.normalizeCfg(Object.assign(T.defaultCfg(), { template }))).sections.map(s => `${s.no}:${s.id}`);
  const oneP = ['1:visual', '2:noload', '3:ir', '4:vector', '5:bushing', '6:wtgd', '7:dcr', '8:ratio', '9:oltc', '10:moisture', '11:bct', '12:shortCircuit'];
  same(nos('A'), oneP);
  same(nos('110'), oneP);
  same(nos('3P'), ['1:visual', '2:noload', '3:ir', '4:vector', '5:bushing', '7:wtgd', '8:dcr', '9:ratio', '10:moisture', '11:oltc', '13:bct', '14:shortCircuit']);
  // tiêu đề nhóm con theo đúng số mục (vd R một chiều mẫu theo pha: 7.1 …)
  const s = T.buildSchema(T.normalizeCfg(Object.assign(T.defaultCfg(), { template: 'A' })));
  assert.match(s.sections.find(x => x.id === 'dcr').groups[0].title, /^7\.1 /);
  assert.match(s.sections.find(x => x.id === 'bushing').groups[0].title, /^5\.1 /);
});

test('mặc định mọi hạng mục thực hiện; biên bản cũ không có khóa skip', () => {
  const ctx = load(CORE), T = ctx.EquipmentTypes.get('MBA');
  same(T.defaultCfg().skip, {});
  same(T.normalizeCfg({}).skip, {});
  same(T.normalizeCfg({ skip: { ratio: true, dcr: false, x: 'y' } }).skip, { ratio: true });
  const { state, schema } = F.fullState(ctx.Schema, {});
  assert.equal(ctx.Report.performed(state, schema), state, 'không bỏ tích → dùng nguyên state');
});

test('hạng mục bỏ tích: không đánh giá, không ghi CSDL, số liệu vẫn giữ trong biên bản', () => {
  const ctx = load(CORE), T = ctx.EquipmentTypes.get('MBA');
  const { state, schema } = F.fullState(ctx.Schema, {});
  const full = ctx.Evaluate.evaluate(state, F.fakeFactory(), schema);
  assert.ok(full.findings.some(f => f.sec === 'ratio'));
  const before = Object.keys(state.v).filter(k => k.startsWith('ratio.')).length;
  state.cfg.skip = { ratio: true };
  const res = ctx.Evaluate.evaluate(state, F.fakeFactory(), schema);
  assert.equal(res.findings.filter(f => f.sec === 'ratio').length, 0);
  assert.equal(res.sec.ratio.skipped, true);
  assert.equal(res.sec.ratio.text, 'Không thực hiện');
  assert.equal(res.sec.ratio.status, null);
  assert.ok(res.findings.some(f => f.sec === 'dcr'), 'hạng mục khác vẫn đánh giá');
  assert.ok(!/Tỷ số biến/.test(ctx.Evaluate.autoConclusion(res, schema, state)), 'không vào kết luận tự động');
  const pack = T.toRows.fieldRows(state, res, schema);
  assert.equal(pack.rows.filter(r => r.item === 'RATIO').length, 0);
  assert.ok(pack.rows.some(r => r.item === 'DCR'));
  assert.equal(Object.keys(state.v).filter(k => k.startsWith('ratio.')).length, before, 'state gốc không bị xóa');
});

// Template giả cho phần thêm mục ngắn mạch (bảng hạng mục trang 1 + thân biên bản)
function fakeTpl() {
  const log = { rows: [], cells: {}, blocks: null };
  const tr = { nodeType: 1 };
  return {
    log,
    insertRowAfter: (t, after, label, opts) => { log.rows.push({ t, after, label, mark: !!(opts && opts.mark) }); return tr; },
    cellAt: (row, col) => (row === tr ? { col } : null),
    setCellText: (cell, text) => { if (cell) log.cells[cell.col] = text; },
    bodyPara: re => (re.test('THIẾT BỊ THÍ NGHIỆM (Testing instruments):') ? { p: 'thiet-bi' } : null),
    insertBlocksBefore: (p, blocks) => { log.blocks = { p, blocks }; },
  };
}
const scState = (ctx, template) => {
  const T = ctx.EquipmentTypes.get('MBA');
  const cfg = T.normalizeCfg(Object.assign(T.defaultCfg(), { template }));
  const schema = T.buildSchema(cfg);
  const state = { v: { 'meta.serial': 'SN-GIA' }, cfg, sum: { tick: {}, ev: {} },
    att: { shortCircuit: { rows: [{ pair: 'HV-MV', tap: '9', tempC: '30', testVoltage: '1000', testCurrentA: '5', powerKw: '1.2' }] } } };
  return { T, schema, state, res: ctx.Evaluate.evaluate(state, null, schema) };
};

test('xuất BBTN: thêm hàng "12. Thí nghiệm ngắn mạch" sau hàng BCT ở trang 1 và mục 12 trước "THIẾT BỊ THÍ NGHIỆM"', () => {
  const ctx = load(CORE);
  const { schema, state, res } = scState(ctx, 'A');
  const tpl = fakeTpl();
  const SUM = schema.summary;
  assert.equal(ctx.MbaReport.shortCircuitToBody(tpl, state, schema, res, { shortCircuitRows: [] }, x => x, SUM), 'body');
  same(tpl.log.rows, [{ t: 0, after: SUM.rows.bct, label: '12. Thí nghiệm ngắn mạch máy biến áp (Short-circuit impedance and load loss)', mark: true }]);
  assert.ok(tpl.log.blocks && tpl.log.blocks.p.p === 'thiet-bi');
  assert.match(tpl.log.blocks.blocks[0].text, /^12\. Thí nghiệm ngắn mạch/);
  assert.ok(tpl.log.blocks.blocks.some(b => /^12\.1 /.test(b.text || '')), 'tiểu mục 12.1, 12.2…');
  assert.ok(!tpl.log.blocks.blocks.some(b => b.type === 'page' || /PHỤ LỤC|Người thí nghiệm/.test(b.text || '')));
  // mẫu 3 pha chung: mục 14, sau hàng BCT (23) của bảng trang 1
  const t3 = scState(ctx, '3P'), tpl3 = fakeTpl();
  ctx.MbaReport.shortCircuitToBody(tpl3, t3.state, t3.schema, t3.res, {}, x => x, t3.schema.summary);
  assert.equal(tpl3.log.rows[0].after, t3.schema.summary.rows.bct);
  assert.match(tpl3.log.rows[0].label, /^14\. /);
  // ngắn mạch không còn là phụ lục
  assert.ok(!ctx.Appendix.list(state, {}).some(a => a.kind === 'shortCircuit'));
});

test('xuất BBTN: template không có "THIẾT BỊ THÍ NGHIỆM" → vẫn xuất ngắn mạch thành phụ lục (không mất số liệu)', () => {
  const ctx = load(CORE);
  const { schema, state, res } = scState(ctx, 'A');
  const tpl = Object.assign(fakeTpl(), { bodyPara: () => null });
  assert.equal(ctx.MbaReport.shortCircuitToBody(tpl, state, schema, res, {}, x => x, schema.summary), 'fallback');
  assert.equal(tpl.log.blocks, null);
  assert.equal(tpl.log.rows.length, 1, 'hàng ở bảng trang 1 vẫn thêm');
  assert.ok(ctx.Appendix.list(state, { shortCircuit: true }).some(a => a.kind === 'shortCircuit'));
  // không có số liệu ngắn mạch thì không có phụ lục
  assert.ok(!ctx.Appendix.list({ att: {} }, { shortCircuit: true }).some(a => a.kind === 'shortCircuit'));
});

test('xuất BBTN: hạng mục ngắn mạch bỏ tích → không thêm hàng, không thêm mục', () => {
  const ctx = load(CORE);
  const { schema, state } = scState(ctx, 'A');
  state.cfg.skip = { shortCircuit: true };
  const res = ctx.Evaluate.evaluate(state, null, schema);
  const tpl = fakeTpl();
  assert.equal(ctx.MbaReport.shortCircuitToBody(tpl, state, schema, res, {}, x => x, schema.summary), false);
  same(tpl.log.rows, []);
  assert.equal(tpl.log.blocks, null);
});

test('loại thí nghiệm: 8 lựa chọn, mã CSDL, "1 năm sau lắp đặt" là máy đã vận hành', () => {
  const ctx = load(CORE), C = ctx.Common;
  same(ctx.Schema.REASONS, ['Sau lắp đặt', '1 năm sau lắp đặt', 'Định kỳ 1 năm', 'Định kỳ 3 năm', 'Định kỳ 6 năm', 'Tăng cường', 'Đột xuất', 'Sau sửa chữa/đại tu']);
  const T = ctx.EquipmentTypes.get('MBA');
  const meta = T.buildSchema(T.defaultCfg()).head.find(f => f.k === 'meta.reason');
  same(meta.options, ctx.Schema.REASONS);
  same(ctx.Schema.REASONS.map(C.kindOf), ['SAT', 'PERIODIC', 'PERIODIC', 'PERIODIC', 'PERIODIC', 'OTHER', 'ABNORMAL', 'AFTER_REPAIR']);
  // giá trị cũ giữ mã cũ
  same(['Định kỳ', 'Sau sửa chữa', 'Bất thường', 'Dự phòng', ''].map(C.kindOf), ['PERIODIC', 'AFTER_REPAIR', 'ABNORMAL', 'SPARE', 'OTHER']);
  // chữ đọc từ BBTN cũ → đúng lựa chọn
  assert.equal(C.optionOf('1 năm  sau lắp đặt', ctx.Schema.REASONS), '1 năm sau lắp đặt');
  assert.equal(C.optionOf('Sau sửa chữa / đại tu', ctx.Schema.REASONS), 'Sau sửa chữa/đại tu');
  assert.equal(C.optionOf('Sau sửa chữa – đại tu', ctx.Schema.REASONS), 'Sau sửa chữa/đại tu');
  assert.equal(C.optionOf('sau sửa chữa-đại tu', ctx.Schema.REASONS), 'Sau sửa chữa/đại tu');
  assert.equal(C.optionOf('Kiểm tra lạ', ctx.Schema.REASONS), 'Kiểm tra lạ');
  // ngưỡng cách điện lõi từ: máy mới (sau lắp đặt, sau sửa chữa/đại tu) / đã vận hành (1 năm sau lắp đặt)
  const coreLimit = reason => {
    const { state, schema } = F.fullState(ctx.Schema, { reason });
    const f = ctx.Evaluate.evaluate(state, F.fakeFactory(), schema).findings.find(x => x.sec === 'ir' && /MBA mới|đã vận hành/.test(x.limit || ''));
    return f && f.limit;
  };
  assert.match(coreLimit('Sau lắp đặt'), /MBA mới/);
  assert.match(coreLimit('Sau sửa chữa/đại tu'), /MBA mới/);
  assert.match(coreLimit('1 năm sau lắp đặt'), /đã vận hành/);
  assert.match(coreLimit('Định kỳ 3 năm'), /đã vận hành/);
});
