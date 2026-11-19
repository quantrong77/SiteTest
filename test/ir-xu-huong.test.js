// Xu hướng R60@20 cách điện cuộn dây: QĐ 1901 Điều 29 mục 3 (Điều 9 mục 4) — không giảm quá 30% so với giá trị khởi đầu
// hoặc lần thí nghiệm trước; vượt thì "Không đạt" + hướng xử lý. Lịch sử giả (dạng dòng v_trend_delta).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

function setup(reason) {
  const ctx = load(CORE.concat(['js/domain/trend-inline.js']));
  const { state, schema } = F.fullState(ctx.Schema, reason ? { reason } : {});
  const r60 = Number(String(state.v['ir.meas.r0.r60']).replace(',', '.'));
  const r20 = ctx.QD.convIR(r60, Number(state.v['ir.t']), 20).val;
  const cfg = ctx.MbaRows.IR_CFG.r0;
  const row = (value, date, kind, extra) => Object.assign({ serial_no: 'SN-A', item: 'IR', param: 'R60', config: cfg, phase: '', tap: '',
    value_cmp: value, cmp_basis: 'norm', kind, test_date: date, session_id: 's-' + date }, extra || {});
  const run = history => ctx.Evaluate.evaluate(state, F.fakeFactory(), schema, { history });
  const trend = res => res.findings.find(f => f.sec === 'ir' && /^Xu hướng R60@20 /.test(f.item) && f.keys[0] === 'ir.meas.r0.r60');
  return { ctx, state, schema, r20, row, run, trend };
}

test('giảm >30% so với lần trước → Không đạt, hướng xử lý theo Điều 29 / Điều 9, kết luận nêu người có thẩm quyền', () => {
  const { ctx, state, schema, r20, row, run, trend } = setup('Định kỳ 3 năm');
  const res = run([row(r20 * 1.1, '2020-05-01', 'SAT'), row(r20 / 0.6, '2023-05-01', 'PERIODIC')]);
  const f = trend(res);
  assert.ok(f, 'có dòng xu hướng R60');
  assert.equal(f.status, 'fail');
  assert.equal(f.trendFail, true);
  assert.match(f.basis, /Điều 29 mục 3/);
  assert.match(f.note, /PI/);
  assert.match(f.note, /Điều 9 ghi chú d/);
  assert.match(f.note, /người có thẩm quyền/);
  assert.match(f.ref, /lần trước 01\/05\/2023/);
  assert.match(f.dev, /^-40/);
  assert.equal(res.sec.ir.status, 'fail');
  assert.match(ctx.Evaluate.autoConclusion(res, schema, state), /đóng điện MBA do người có thẩm quyền quyết định \(QĐ 1901 Điều 29 mục 3\)/);
});

test('giảm >30% so với giá trị khởi đầu dù lần trước gần bằng → vẫn Không đạt', () => {
  const { r20, row, run, trend } = setup();
  const f = trend(run([row(r20 / 0.5, '2019-01-10', 'FAT'), row(r20 * 1.02, '2024-01-10', 'PERIODIC')]));
  assert.equal(f.status, 'fail');
  assert.match(f.ref, /^xuất xưởng 10\/01\/2019/);
});

test('giảm ≤30% so với cả hai mốc → Đạt; tăng không phải dấu hiệu xấu', () => {
  const { r20, row, run, trend } = setup();
  const f = trend(run([row(r20 / 0.8, '2020-01-01', 'SAT'), row(r20 / 0.75, '2023-01-01', 'PERIODIC')]));
  assert.equal(f.status, 'pass');
  assert.equal(f.trendFail, undefined);
  assert.equal(trend(run([row(r20 * 0.5, '2020-01-01', 'SAT')])).status, 'pass');
});

test('không có lịch sử phù hợp → không có dòng xu hướng, kết quả như trước', () => {
  const { ctx, state, schema, r20, row, run, trend } = setup();
  const base = ctx.Evaluate.evaluate(state, F.fakeFactory(), schema);
  assert.equal(trend(base), undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(run([]).findings)), JSON.parse(JSON.stringify(base.findings)));
  // khác số chế tạo / sơ đồ đo / cơ sở chưa quy đổi → không so
  assert.equal(trend(run([row(r20 * 3, '2020-01-01', 'SAT', { serial_no: 'SN-KHAC' })])), undefined);
  assert.equal(trend(run([row(r20 * 3, '2020-01-01', 'SAT', { config: 'LV-TANK' })])), undefined);
  assert.equal(trend(run([row(r20 * 3, '2020-01-01', 'SAT', { cmp_basis: 'raw' })])), undefined);
  // lần đo sau ngày thí nghiệm của biên bản không dùng làm mốc so
  assert.equal(trend(run([row(r20 * 3, '2099-01-01', 'PERIODIC')])), undefined);
  // phiên đang mở (đã lưu CSDL) bị loại khỏi lịch sử
  const res = ctx.Evaluate.evaluate(state, F.fakeFactory(), schema, { history: [row(r20 * 3, '2020-01-01', 'SAT', { session_id: 'dang-mo' })], sessionId: 'dang-mo' });
  assert.equal(trend(res), undefined);
});

test('hạng mục cách điện bỏ tích "Thực hiện" → không đánh giá xu hướng', () => {
  const { state, r20, row, run, trend } = setup();
  state.cfg.skip = { ir: true };
  assert.equal(trend(run([row(r20 / 0.5, '2020-01-01', 'SAT')])), undefined);
});
