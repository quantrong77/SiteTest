// Dự báo xu hướng (chuyển từ dga-webapp): số tham chiếu khớp scipy (linregress, theilslopes, Mann–Kendall),
// ngưỡng QĐ 1901 từ giá trị khởi đầu, chạm ngưỡng hai chiều, mốc khởi đầu sau sửa chữa. Số liệu giả.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./harness');

const F = load(['js/domain/trend-forecast.js']).TrendForecast;
const close = (a, b, eps, m) => assert.ok(Math.abs(a - b) < eps, `${m || ''} ${a} ≉ ${b}`);
const REF = [0, 90, 200, 380, 500, 730, 900, 1100, 1300, 1460].map((x, i) => ({ x, y: [20, 24, 23, 30, 29, 35, 33, 41, 40, 47][i] }));

test('khớp scipy: OLS, khoảng dự báo 95%, Sen + KTC, Mann–Kendall', () => {
  const r = F.linearRegression(REF);
  close(r.slope, 0.01645139075517334, 1e-12); close(r.r2, 0.9456170584010873, 1e-10); close(r.pSlope, 2.445579236215806e-6, 1e-10);
  const pi = F.olsPredictionInterval(r, 1460 + 3 * 365.25);
  close(pi.lower, 55.285834399892536, 1e-6); close(pi.upper, 71.2921969592851, 1e-6);
  const mk = F.mannKendallTest(REF);
  assert.equal(mk.S, 37); close(mk.p, 0.00128, 1e-5); assert.equal(mk.direction, 'increasing');
  const s = F.senSlopeEstimate(REF, mk.varS);
  close(s.slope, 1 / 60, 1e-12); close(s.lower, 0.01375, 1e-12); close(s.upper, 0.02, 1e-12);
  close(F.studentTCdf(2, 5), 0.94903, 1e-5); close(F.normalQuantile(0.975), 1.959964, 1e-5);
});

test('ngưỡng QĐ 1901 tính từ giá trị khởi đầu: giảm (R60), tăng (tgδ), hai chiều (C); không có tiêu chí → rỗng', () => {
  const L = { IR_DROP: 30, WINDING_TGD_RISE: 30, WINDING_C_DEV: 5 };
  assert.deepEqual(JSON.parse(JSON.stringify(F.limitsFor('IR', 'R60', 1000, L))), [{ value: 700, dir: 'down', pct: -30, key: 'IR_DROP' }]);
  assert.equal(F.limitsFor('WTGD', 'TGD', 0.3, L)[0].dir, 'up');
  close(F.limitsFor('WTGD', 'TGD', 0.3, L)[0].value, 0.39, 1e-12);
  assert.deepEqual(JSON.parse(JSON.stringify(F.limitsFor('WTGD', 'C', 100, L).map(l => l.dir))), ['down', 'up']);
  assert.equal(F.limitsFor('VECTOR', 'RESULT', 1, L).length, 0);
  assert.equal(F.limitsFor('IR', 'R60', 0, L).length, 0);
});

const yearly = (vals, from = 2015) => vals.map((v, i) => ({ date: `${from + i}-06-01`, value: v }));

test('R60 giảm đều: xu hướng giảm có ý nghĩa, dự báo chạm ngưỡng −30% trong số năm dự báo', () => {
  const fc = F.forecast(yearly([1000, 960, 930, 890, 860, 820]), 5, F.limitsFor('IR', 'R60', 1000, { IR_DROP: 30 }));
  assert.equal(fc.ok, true); assert.equal(fc.trend.direction, 'decreasing');
  const c = fc.methods.sen.crossing;
  assert.equal(c.status, 'predicted'); assert.equal(c.significant, true); assert.equal(c.withinHorizon, true);
  assert.ok(c.yearsFromLast > 3 && c.yearsFromLast < 3.7, `${c.yearsFromLast}`);
  const w = F.warning(fc);
  assert.equal(w.status, 'predicted'); assert.equal(w.method, 'sen');
});

test('đi ngược phía ngưỡng / đã vượt / không ngưỡng / ít điểm / mốc khởi đầu sau sửa chữa', () => {
  const lim = F.limitsFor('IR', 'R60', 1000, { IR_DROP: 30 });
  assert.equal(F.forecast(yearly([1000, 1020, 1050, 1080, 1100]), 3, lim).methods.sen.crossing.status, 'not_toward');
  assert.equal(F.warning(F.forecast(yearly([1000, 900, 650]), 3, lim)).status, 'exceeded');
  assert.equal(F.forecast(yearly([1, 2, 3]), 3, []).methods.ols.crossing, null);
  assert.equal(F.forecast(yearly([1]), 3, lim).reason, 'not_enough_data');
  // xu hướng chưa có ý nghĩa thống kê (3 điểm) → không cảnh báo dự báo
  assert.equal(F.warning(F.forecast(yearly([1000, 950, 900]), 3, lim)), null);
  const fc = F.forecast(yearly([1000, 900, 800, 1200, 1190, 1180]), 3, lim, { sinceDate: '2018-06-01' });
  assert.equal(fc.n, 3); assert.equal(fc.nBefore, 3); assert.equal(fc.sinceDate, '2018-06-01');
});
