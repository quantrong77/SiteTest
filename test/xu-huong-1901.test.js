// Tiêu chí xu hướng QĐ 1901 (so với giá trị khởi đầu / lần trước theo lịch sử CSDL) đánh giá ngay khi nhập:
// tgδ và điện dung cuộn dây (Điều 30, Điều 9 mục 5), C1 và tgδ C1 sứ (Điều 38 mục 3), tổn hao không tải P0 (Điều 34).
// Lịch sử giả dựng từ chính dòng CSDL của biên bản (cùng khóa như v_trend_delta). Số liệu giả.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

function setup(opts = {}) {
  const ctx = load(CORE.concat(['js/domain/trend-inline.js']));
  const { state, schema } = F.fullState(ctx.Schema, opts.reason ? { reason: opts.reason } : {});
  if (opts.template) { state.cfg.template = opts.template; }
  Object.assign(state.v, opts.v || {});
  const sch = opts.template ? ctx.EquipmentTypes.get('MBA').buildSchema(ctx.EquipmentTypes.get('MBA').normalizeCfg(state.cfg)) : schema;
  const blank = ctx.Evaluate.evaluate(state, null, sch);
  const pack = ctx.MbaRows.fieldRows(state, blank, sch, { withKey: true });
  const serialOf = new Map(pack.refs.map(r => [r.key, r.serial_no]));
  // dòng CSDL hiện tại theo khóa ô → dòng lịch sử giả với giá trị = cur × factor
  const hist = (key, factor, date, kind, extra) => {
    const r = pack.rows.find(x => x.key === key);
    assert.ok(r, `có dòng CSDL cho ${key}`);
    const norm = Number.isFinite(r.value_norm) ? r.value_norm : null;
    return Object.assign({ serial_no: serialOf.get(r.eq), item: r.item, param: r.param, config: r.config, phase: r.phase, tap: r.tap,
      value_cmp: (norm !== null ? norm : r.value) * factor, cmp_basis: norm !== null ? 'norm' : 'raw', kind, test_date: date, session_id: 's-' + date }, extra || {});
  };
  const run = history => ctx.Evaluate.evaluate(state, F.fakeFactory(), sch, { history });
  const trendOf = (res, key) => res.findings.find(f => f.trend && f.keys[0] === key);
  return { ctx, state, schema: sch, hist, run, trendOf };
}
const firstKey = (ctx, schema, gridId, col) => { const g = ctx.Common.findGrid(schema, gridId); return `${g.id}.${g.rows[0].k}.${col}`; };

test('tgδ cuộn dây: tăng >30% so với khởi đầu → Không đạt (Điều 30); tgδ20 < 1% coi là tốt → không so', () => {
  const s = setup({ reason: 'Định kỳ 3 năm' });
  const k = firstKey(s.ctx, s.schema, 'wtgd.meas', 'tgd');
  // fixture tgδ 0,25% @32 °C (< 1% sau quy đổi) → không có dòng xu hướng dù khởi đầu thấp hơn nhiều
  assert.equal(s.trendOf(s.run([s.hist(k, 0.3, '2020-01-01', 'SAT')]), k), undefined);
  // 2,5% @32 °C → ≈1,47% @20 °C (> 1%) → áp tiêu chí tăng ≤30%
  const hi = setup({ reason: 'Định kỳ 3 năm', v: { [k]: '2,5' } });
  const f = hi.trendOf(hi.run([hi.hist(k, 1 / 1.5, '2020-01-01', 'SAT')]), k);
  assert.equal(f.status, 'fail');
  assert.equal(f.trendFail, true);
  assert.match(f.basis, /Điều 30 mục 3/);
  assert.match(f.note, /Điều 30 mục 2/);
  assert.match(f.note, /MBA nguội/);
  assert.equal(hi.trendOf(hi.run([hi.hist(k, 1 / 1.2, '2020-01-01', 'SAT')]), k).status, 'pass');
});

test('điện dung cuộn dây: lệch >±5% so với khởi đầu → Không đạt (Điều 9 mục 5)', () => {
  const s = setup();
  const k = firstKey(s.ctx, s.schema, 'wtgd.meas', 'c');
  const f = s.trendOf(s.run([s.hist(k, 1.1, '2020-01-01', 'SAT')]), k);
  assert.equal(f.status, 'fail');
  assert.match(f.limit, /±5% so với giá trị khởi đầu/);
  assert.equal(s.trendOf(s.run([s.hist(k, 1.02, '2020-01-01', 'SAT')]), k).status, 'pass');
});

test('sứ: C1 thay đổi >5% → Không đạt; tgδ C1 trong vận hành tăng 70–100% → Cần xem xét, >100% → Không đạt; sau lắp đặt không áp tgδ', () => {
  const op = setup({ reason: 'Định kỳ 3 năm' });
  const kc = 'b.hv.meas.c1.A', kt = 'b.hv.meas.tgd1.A';
  const fc = op.trendOf(op.run([op.hist(kc, 1 / 1.08, '2020-01-01', 'SAT')]), kc);
  assert.equal(fc.status, 'fail');
  assert.match(fc.basis, /Điều 38 mục 3c/);
  const warn = op.trendOf(op.run([op.hist(kt, 1 / 1.8, '2020-01-01', 'SAT')]), kt);
  assert.equal(warn.status, 'warn');
  assert.match(warn.note, /15 Hz và 400 Hz/);
  assert.equal(op.trendOf(op.run([op.hist(kt, 1 / 2.5, '2020-01-01', 'SAT')]), kt).status, 'fail');
  const fresh = setup({ reason: 'Sau lắp đặt' });
  assert.equal(fresh.trendOf(fresh.run([fresh.hist(kt, 1 / 2.5, '2020-01-01', 'FAT')]), kt), undefined);
});

test('tổn hao không tải P0: ngưỡng theo loại máy và lý do (Điều 34 mục 3)', () => {
  // MBA 1 pha ≥110 kV (mẫu theo pha), sau lắp đặt: ±10% giá trị khởi đầu
  const n1 = setup({ reason: 'Sau lắp đặt' });
  const k = 'nl.rated.r0.p0';
  const f1 = n1.trendOf(n1.run([n1.hist(k, 1.2, '2018-01-01', 'FAT')]), k);
  assert.equal(f1.status, 'fail');
  assert.match(f1.limit, /±10% giá trị khởi đầu/);
  // vận hành: ±15%
  const op = setup({ reason: 'Định kỳ 1 năm' });
  const f2 = op.trendOf(op.run([op.hist(k, 1.12, '2018-01-01', 'FAT')]), k);
  assert.equal(f2.status, 'pass');
  assert.match(f2.limit, /±15%/);
});

test('cảnh báo chung: cờ trendFail, kết luận tự động liệt kê đại lượng vượt tiêu chí; không lịch sử → như trước', () => {
  const s = setup({ reason: 'Định kỳ 3 năm' });
  const kc = 'b.hv.meas.c1.A', kw = firstKey(s.ctx, s.schema, 'wtgd.meas', 'c');
  const res = s.run([s.hist(kc, 1 / 1.08, '2020-01-01', 'SAT'), s.hist(kw, 1.1, '2020-01-01', 'SAT')]);
  const bad = res.findings.filter(f => f.trendFail);
  assert.equal(bad.length, 2);
  const text = s.ctx.Evaluate.autoConclusion(res, s.schema, s.state);
  assert.match(text, /Xu hướng vượt tiêu chí QĐ 1901 so với giá trị khởi đầu: /);
  assert.match(text, /điện dung C1 sứ \(Điều 38 mục 3c\)/);
  assert.match(text, /điện dung cuộn dây .*\(Điều 9 mục 5\)/);
  const plain = s.ctx.Evaluate.evaluate(s.state, F.fakeFactory(), s.schema);
  assert.deepEqual(JSON.parse(JSON.stringify(s.run([]).findings)), JSON.parse(JSON.stringify(plain.findings)));
  assert.ok(!plain.findings.some(f => f.trend));
});

test('tiêu chí quy về 20 °C: thiếu nhiệt độ → không so số thô với lịch sử', () => {
  const s = setup({ reason: 'Định kỳ 3 năm' });
  const k = 'ir.meas.r0.r60';
  const h = s.hist(k, 3, '2020-01-01', 'SAT');
  assert.equal(s.trendOf(s.run([h]), k).status, 'fail');
  s.state.v['ir.t'] = '';
  const raw = Object.assign({}, h, { cmp_basis: 'raw' });
  assert.equal(s.trendOf(s.run([raw]), k), undefined);
});
