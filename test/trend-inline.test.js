// Xu hướng ngay tại ô nhập: ghép lịch sử theo thiết bị + đại lượng, so giá trị đang nhập với mốc khởi đầu / lần trước,
// tô vàng chỉ theo ngưỡng QĐ 1901 có sẵn; fieldRows kèm khóa ô khi được yêu cầu (dòng lưu CSDL không đổi). Số liệu giả.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

const KEY = { item: 'DCR', param: 'R', config: 'HV', phase: 'A', tap: '1', serial_no: 'MBA-A' };
const H = (o) => Object.assign({ session_id: 's', kind: 'field', cmp_basis: 'norm' }, KEY, o);

test('so giá trị đang nhập với xuất xưởng (FAT) và lần đo gần nhất', () => {
  const w = load(['js/domain/trend-inline.js']).TrendInline;
  const rows = [H({ kind: 'FAT', test_date: '2020-01-01', value_cmp: 10 }), H({ test_date: '2024-01-01', value_cmp: 12 })];
  const s = w.series(rows, Object.assign({}, KEY, { value_cmp: 11, cmp_basis: 'norm' }));
  assert.equal(s.base.kind, 'FAT');
  assert.equal(s.fromBase, 10);
  assert.ok(Math.abs(s.fromPrevious - (11 - 12) / 12 * 100) < 1e-3);
  assert.deepEqual(Array.from(s.points), [10, 12, 11]);
  // chỉ có FAT: "lần trước" chính là mốc → không lặp lại
  assert.equal(w.series(rows.slice(0, 1), Object.assign({}, KEY, { value_cmp: 11, cmp_basis: 'norm' })).fromPrevious, null);
});

test('loại phiên đang mở, lần đo sau ngày biên bản, thiết bị khác, đại lượng khác, cơ sở quy đổi khác', () => {
  const w = load(['js/domain/trend-inline.js']).TrendInline;
  const rows = [
    H({ session_id: 'open', test_date: '2025-01-01', value_cmp: 5 }),
    H({ session_id: 'old', test_date: '2024-01-01', value_cmp: 10 }),
    H({ session_id: 'later', test_date: '2026-01-01', value_cmp: 99 }),
    H({ serial_no: 'MBA-B', kind: 'FAT', test_date: '2020-01-01', value_cmp: 100 }),
    H({ config: 'LV', kind: 'FAT', test_date: '2020-01-01', value_cmp: 100 }),
    H({ cmp_basis: 'raw', kind: 'FAT', test_date: '2020-01-01', value_cmp: 100 }),
  ];
  const s = w.series(rows, Object.assign({}, KEY, { value_cmp: 8, cmp_basis: 'norm' }), { sessionId: 'open', testDate: '2025-02-01' });
  assert.deepEqual(Array.from(s.history, r => r.session_id), ['old']);
  assert.equal(s.fromBase, -20);
  // số chế tạo so không phân biệt hoa thường, khoảng trắng
  assert.equal(w.series(rows, Object.assign({}, KEY, { serial_no: ' mba-b ', value_cmp: 50, cmp_basis: 'norm' })).fromBase, -50);
});

test('ô trống: vẫn có lịch sử (ưu tiên giá trị quy đổi), không có % ', () => {
  const w = load(['js/domain/trend-inline.js']).TrendInline;
  const rows = [H({ cmp_basis: 'raw', test_date: '2020', value_cmp: 3 }), H({ test_date: '2021', value_cmp: 4 })];
  const s = w.series(rows, KEY);
  assert.equal(s.hasCurrent, false);
  assert.equal(s.basis, 'norm');
  assert.equal(s.history.length, 1);
  assert.equal(s.fromBase, null);
  assert.equal(w.series([], KEY), null);
});

test('tô vàng chỉ khi có ngưỡng QĐ 1901: lệch hai chiều (R, tỷ số, C), tăng (tgδ) hoặc giảm R60 (Điều 29 mục 3)', () => {
  const ctx = load(CORE.concat(['js/domain/trend-inline.js']));
  const L = ctx.Criteria.limits(), w = ctx.TrendInline;
  assert.equal(w.warn({ item: 'DCR', param: 'R' }, -2.5, L), true);
  assert.equal(w.warn({ item: 'DCR', param: 'R' }, 1.5, L), false);
  assert.equal(w.warn({ item: 'BUSHING', param: 'TGD1' }, -80, L), false); // giảm tgδ không phải dấu hiệu xấu
  assert.equal(w.warn({ item: 'BUSHING', param: 'TGD1' }, L.BUSHING_TGD_RISE_WARN + 1, L), true);
  // R60@20 cách điện cuộn dây: giảm quá IR_DROP (30%) so với khởi đầu HOẶC lần trước (QĐ 1901 Điều 29 mục 3)
  assert.equal(w.warn({ item: 'IR', param: 'R60' }, -(L.IR_DROP + 5), L), true);
  assert.equal(w.warn({ item: 'IR', param: 'R60' }, -(L.IR_DROP - 5), L), false);
  assert.equal(w.warn({ item: 'IR', param: 'R60' }, +5, L, -(L.IR_DROP + 1)), true, 'so với lần trước');
  assert.equal(w.warn({ item: 'IR', param: 'R60' }, +40, L), false, 'tăng không phải dấu hiệu xấu');
  assert.equal(w.warn({ item: 'IR', param: 'R15' }, -90, L), false, 'chỉ R60 có ngưỡng');
  assert.equal(w.warn({ item: 'DCR', param: 'R' }, null, L), false);
});

test('fieldRows: withKey kèm khóa ô; mặc định không đổi dòng lưu CSDL', () => {
  const ctx = load(CORE);
  const { state, schema } = F.fullState(ctx.Schema, {});
  const res = ctx.Evaluate.evaluate(state, null, schema);
  const T = ctx.EquipmentTypes.get('MBA').toRows;
  const plain = T.fieldRows(state, res, schema), keyed = T.fieldRows(state, res, schema, { withKey: true });
  assert.ok(plain.rows.every(r => !('key' in r)));
  assert.equal(keyed.rows.length, plain.rows.length);
  const dcr = keyed.rows.find(r => r.item === 'DCR' && r.key);
  assert.ok(dcr && dcr.key in state.v, 'khóa ô trỏ đúng số liệu trong biên bản');
});

test('thứ tự mốc khởi đầu: đặt lại sau sửa chữa → xuất xưởng → sau lắp đặt → lần đo sớm nhất', () => {
  const w = load(['js/domain/trend-inline.js']).TrendInline;
  const per = H({ kind: 'PERIODIC', test_date: '2019-01-01', value_cmp: 9 });
  const sat = H({ kind: 'SAT', test_date: '2020-01-01', value_cmp: 10 });
  const sat2 = H({ kind: 'SAT', test_date: '2021-01-01', value_cmp: 11 });
  const fat = H({ kind: 'FAT', test_date: '2018-01-01', value_cmp: 8 });
  const tgt = Object.assign({}, KEY, { item: 'IR', value_cmp: 12, cmp_basis: 'norm' });
  const T = rows => rows.map(r => Object.assign({}, r, { item: 'IR' }));
  let s = w.series(T([per, sat, sat2]), tgt);
  assert.equal(s.base.test_date, '2020-01-01', 'không có XX: lần sau lắp đặt sớm nhất, không lấy lần định kỳ sớm hơn');
  assert.deepEqual(JSON.parse(JSON.stringify(w.baseInfo(s.base, 'IR'))), { code: 'SAT', short: 'LĐ', name: 'sau lắp đặt' });
  s = w.series(T([per, sat, fat]), tgt);
  assert.equal(w.baseInfo(s.base, 'IR').code, 'FAT');
  const rep = H({ kind: 'PERIODIC', test_date: '2024-01-01', value_cmp: 7, baseline_reset: 'INSULATION' });
  s = w.series(T([per, sat, fat, rep]), tgt);
  assert.equal(w.baseInfo(s.base, 'IR').code, 'RESET');
  // đặt lại "cách điện" không áp cho điện trở một chiều
  s = w.series([per, sat, Object.assign({}, rep, { item: 'DCR' })], Object.assign({}, KEY, { value_cmp: 12, cmp_basis: 'norm' }));
  assert.equal(w.baseInfo(s.base, 'DCR').code, 'SAT');
  assert.equal(w.baseInfo(w.series([per], Object.assign({}, KEY, { value_cmp: 1, cmp_basis: 'norm' })).base, 'DCR').code, 'FIRST');
});
