// Không tải: test report xuất xưởng ghi P0 / I0 theo mức điện áp ("(100% Ur)", "(90% Ur)", "(10 kV)", "(380 V)").
// Lần đo hiện trường cùng mức điện áp (U lệch ≤ 2 %) tự so với số liệu đó: ΔP0 ±10 % / ±15 % (Điều 34), ΔI0 ≤ +30 % tham khảo.
// Workbook dựng bằng SheetJS với số liệu giả.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');

const eq = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);

function book(ctx) {
  const X = ctx.XLSX, wb = X.utils.book_new();
  const add = (name, rows) => X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(rows), name);
  add('Overview & Comparison', [['TỔNG HỢP'], [],
    ['Hạng mục / Thông số kỹ thuật', 'Đơn vị', 'Giá trị bảo đảm', 'Máy 1 (Pha A - X-001)', 'Máy 2 (Pha B - X-002)', 'Máy 3 (Pha C - X-003)', 'Đánh giá chung'],
    ['Tổn hao không tải (No-load loss P0)', 'kW', '≤ 73.0', 60.3, 60.1, 59.8, 'Đạt'],
    ['Dòng điện không tải (I0)', '%', '≤ 0.20', 0.036, 0.037, 0.037, 'Đạt'],
    ['Mức ồn âm thanh không tải (3m)', 'dB(A)', '≤ 75.0', 67.2, 67.1, 67, 'Đạt']]);
  add('6. Losses & Impedance', [['TỔN HAO'], [],
    ['Cặp cuộn dây thử nghiệm', 'Nấc phân áp (Tap)', 'Dung lượng chuẩn (MVA)', 'Giá trị bảo đảm', 'Pha A (X-001)', 'Pha B (X-002)', 'Pha C (X-003)', 'Đánh giá'],
    ['Tổn hao không tải P0 (100% Ur)', '-', 300, '≤ 73 kW', '60.3 kW', '60.1 kW', '59.8 kW', 'Đạt'],
    ['Tổn hao không tải P0 (90% Ur)', '-', 300, 'Tham khảo', '48.0 kW', '47.9 kW', '47.5 kW', ''],
    ['Tổn hao không tải P0 (2 kV)', '-', 300, 'Tham khảo', '250 W', '251 W', '249 W', ''],
    ['Dòng điện không tải I0 (2 kV)', '-', 300, 'Tham khảo', '0.150 A', '0.151 A', '0.149 A', ''],
    ['Tổn hao không tải P0 (380 V)', '-', 300, 'Tham khảo', '14.0 W', '14.1 W', '13.9 W', ''],
    ['Tổn hao ngắn mạch HV-MV (75°C)', 'Tap 9A', 300, '≤ 430 kW', '356.8 kW', '351.2 kW', '351.9 kW', 'Đạt']]);
  return X.write(wb, { type: 'base64', bookType: 'xlsx' });
}

test('test report: đọc P0 / I0 không tải theo mức điện áp (% Ur, kV, V), bỏ qua mức ồn và ngắn mạch', () => {
  const ctx = load(CORE);
  const FX = ctx.Factory.fromBase64(book(ctx), 'nl.xlsx');
  eq(FX.unit('X-001').noLoad, [
    { pu: 100, kv: null, p0: 60.3, i0: 0.036 },
    { pu: 90, kv: null, p0: 48 },
    { pu: null, kv: 2, p0: 0.25, i0A: 0.15 },
    { pu: null, kv: 0.38, p0: 0.014 }]);
  // ghép theo kV trước, rồi theo %Uđm; U lệch > 2 % → không cùng mức
  eq(FX.noLoadAt('X-001', { kv: 2.02, pu: 5.8 }).kv, 2);
  eq(FX.noLoadAt('X-001', { kv: 0.385, pu: 1.1 }).kv, 0.38);
  eq(FX.noLoadAt('X-001', { pu: 90.5 }).pu, 90);
  assert.equal(FX.noLoadAt('X-001', { kv: 2.1, pu: 6 }), null);
  assert.equal(FX.noLoadAt('X-001', { pu: 95 }), null);
});

test('lưu CSDL rồi dựng lại: giữ đủ các mức điện áp không tải', () => {
  const ctx = load(CORE);
  const FX = ctx.Factory.fromBase64(book(ctx), 'nl.xlsx');
  const sessions = ctx.MbaRows.factorySessions(FX).map(S => {
    const ref = new Map(S.refs.map(r => [r.key, r]));
    return { serial: S.serial, testDate: '2026-01-02', rows: S.rows.map(r => Object.assign({}, r, { serial_no: ref.get(r.eq).serial_no })) };
  });
  const DB = ctx.Factory.fromRows(sessions, 'CSDL');
  const key = l => `${l.pu}|${l.kv}`;
  const sort = a => JSON.parse(JSON.stringify(a)).sort((x, y) => key(x).localeCompare(key(y)));
  eq(sort(DB.unit('X-002').noLoad), sort(FX.unit('X-002').noLoad));
});

test('đánh giá: lần đo cùng mức điện áp với test report tự so — ΔP0, ΔI0 và đạt / không đạt', () => {
  const ctx = load(CORE), M = ctx.EquipmentTypes.get('MBA');
  const FX = ctx.Factory.fromBase64(book(ctx), 'nl.xlsx');
  const cfg = Object.assign(M.defaultCfg(), { template: '3P', topology: 'bank1p', sLV: '60', iLV: '1714', sR: '300', ps: { A: 'X-001', B: 'X-002', C: 'X-003' } });
  const schema = M.buildSchema(cfg);
  const v = { 'meta.reason': 'Sau lắp đặt',
    // pha A: lần 1 ở 380 V, lần 2 ở 2 kV — cả hai có số liệu xuất xưởng cùng mức
    'nl.A.rated.r0.ur': '0,38', 'nl.A.rated.r0.ia': '0,05855', 'nl.A.rated.r0.p0': '0,014156',
    'nl.A.rated.r1.ur': '2', 'nl.A.rated.r1.ia': '0,16641', 'nl.A.rated.r1.p0': '0,26208',
    // pha B: 2 kV, P0 lệch +20 % → không đạt
    'nl.B.rated.r1.ur': '2', 'nl.B.rated.r1.ia': '0,151', 'nl.B.rated.r1.p0': '0,3012',
    // pha C: 1,5 kV — test report không có mức này → chỉ ghi nhận
    'nl.C.rated.r1.ur': '1,5', 'nl.C.rated.r1.ia': '0,1', 'nl.C.rated.r1.p0': '0,15' };
  const res = M.evaluate({ type: 'MBA', v, cfg, sum: { tick: {}, ev: {} }, att: {} }, FX, schema);
  const f = (ph, re) => res.findings.find(x => x.sec === 'noload' && x.loc && x.loc.includes(ph) && re.test(x.item));
  const p1 = f('X-001', /P0 \(lần 1\)/), p2 = f('X-001', /P0 \(lần 2\)/), i2 = f('X-001', /I0 \(lần 2\)/);
  eq([p1.status, p1.dev, p1.ref], ['pass', '+1,11', '14,00 W ở 0,380 kV (XX)']);
  eq([p2.status, p2.dev, p2.ref, res.calc['nl.A.rated.r1.dp']], ['pass', '+4,83', '250,00 W ở 2,000 kV (XX)', '+4,83']);
  assert.match(p2.note, /Test report xuất xưởng có số liệu ở 2,000 kV/);
  eq([i2.status, i2.dev, res.calc['nl.A.rated.r1.di']], ['pass', '+10,94', '+10,94']);
  eq(f('X-002', /P0 \(lần 2\)/).status, 'fail');
  eq(f('X-003', /P0 \(lần 2\)/).status, 'info');
  // nhập tay "XX cùng mức" vẫn được ưu tiên
  v['nl.A.rated.r1.pref'] = '0,26';
  const res2 = M.evaluate({ type: 'MBA', v, cfg, sum: { tick: {}, ev: {} }, att: {} }, FX, schema);
  assert.equal(res2.findings.find(x => x.sec === 'noload' && x.loc.includes('X-001') && /P0 \(lần 2\)/.test(x.item)).ref, '260,00 W (XX)');
});

test('đánh giá tại Uđm: I0 % so với test report xuất xưởng (ưu tiên hơn I0 nameplate)', () => {
  const ctx = load(CORE), M = ctx.EquipmentTypes.get('MBA');
  const FX = ctx.Factory.fromBase64(book(ctx), 'nl.xlsx');
  const cfg = Object.assign(M.defaultCfg(), { template: '3P', topology: 'bank1p', sLV: '60', iLV: '1714', sR: '300', i0Ref: '0,2', ps: { A: 'X-001', B: 'X-002', C: 'X-003' } });
  const schema = M.buildSchema(cfg);
  const v = { 'nl.A.rated.r0.pu': '100', 'nl.A.rated.r0.ur': '35', 'nl.A.rated.r0.ia': '3,1', 'nl.A.rated.r0.p0': '61' };
  const res = M.evaluate({ type: 'MBA', v, cfg, sum: { tick: {}, ev: {} }, att: {} }, FX, schema);
  const f = re => res.findings.find(x => x.sec === 'noload' && x.loc.includes('X-001') && re.test(x.item));
  const p = f(/P0 tại Uđm \(lần 1\)/), i = f(/I0 \(lần 1\)/);
  eq([p.status, p.ref, res.calc['nl.A.rated.r0.dp']], ['pass', '60,30 kW (XX)', '+1,16']);
  assert.match(i.ref, /0,0360 % ở 100,0 % Ur \(XX\)/);
});
