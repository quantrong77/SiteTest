'use strict';
// Nhập tgδ, điện dung sứ và cuộn dây từ file .txt máy Doble M4000. Số liệu, tên trạm, thiết bị đều giả.
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);
const ctx = () => load(CORE.concat(['js/data/instruments/doble-m4000.js', 'js/domain/types/mba/doble-map.js']));

const row = (no, id, mode, kv, pf, cap, unit = 'pF') =>
  `${String(no).padStart(3)} ${id.padEnd(19)} E ${mode.padEnd(9)} ${kv.padEnd(6)} 17.000 0.300    ${pf.padEnd(7)} 0.90   0.100  ${cap} ${unit}`;
const head = (no, t, f = '1.00') => `${String(no).padStart(3)} ${t.padEnd(62)} ${f}          `;
const FILE = ['M4000 - Clipboard', 'C:\\fake\\FAKE.txt', '27/11/26   10:24 AM', '', '                                   Nameplate',
  'Date (DD/MM/YY)         26/11/26                      Time      02:15 PM', 'Company                 FAKE', 'Location                TRAM GIA',
  'Equipment               MBA GIA', '', '                                Test Conditions',
  'Weather               Sunny               Air Temperature         28 \u00b0C', 'Humidity              67 %                Oil Temperature         27 \u00b0C', '',
  '                                  Test Results', '                                  ------------',
  '                        L Circ.                           Meas.   Corr.  Corr.   Cap./     R',
  'No  Test ID             C Desc.     kV     mA      Watts  %PF     Fctr   %PF      Ind.     T', '-'.repeat(92),
  head(1, 'DAY QUAN:'), head(2, 'Pha A (26-11-2026)'),
  row(3, 'CH (500/220 - Vo)', 'GAR-R', '10.00', '0.213', '5670.40'), row(4, 'CH', 'UST-R', '10.00', '0.118', '3692.47'),
  row(5, 'CH+CHT (500/220 - 35+Vo)', 'GND-RB', '10.00', '0.173', '9359.67'), row(6, 'CT (35 - Vo)', 'GAR-R', '10.00', '0.172', '7903.68'),
  row(7, 'CT+CTH', 'GND-RB', '10.00', '0.155', '11594.00'), row(8, 'CH + CT (500/220+35 - Vo)', 'GND-RB', '10.00', '0.208', '13584.45'),
  head(10, 'Pha B(26/11/2026)'), row(11, 'CT', 'GAR-R', '10.00', '0.203', '7805.93'), row(12, 'CT', 'GAR-R', '10.00', '0.201', '7804.18'),
  head(27, 'SU:'), head(28, 'Pha A: (26-11-2026)'),
  row(29, '500-C1', 'UST-R', '10.00', '0.343', '729.81'), row(30, '220-C1', 'UST-R', '10.00', '0.296', '1246.29'), row(31, 'N-', 'UST-R', '10.00', '0.298', '648.64'),
  row(32, '35.1-C1', 'UST-R', '10.00', '0.273', '650.52'), row(33, '35.2-C1', 'UST-R', '10.00', '0.274', '643.02'),
  head(51, 'Pha A: (26-11-2026)'), row(52, '500-C2', 'GAR-R', '0.500', '0.474', '1082.61'), row(55, '35', 'GAR-R', '0.500', '0.899', '295.95'),
  row(56, '35.2-C2', 'GAR-R', '0.500', '0.954', '282.22'),
  row(73, 'khong tai pha A', 'UST-R', '0.385', '64.112', '27.854', 'H'), '', 'LC (Line Configuration) Parameters:', 'E = Actual Values, Line Frequency Modulation, 50 Hz'].join('\r\n');

test('đọc file Doble M4000: thông tin chung, đề mục nhóm / pha, dòng số liệu, kích từ', () => {
  const { DobleM4000 } = ctx();
  const p = DobleM4000.parse(FILE, 'FAKE.txt');
  eq([p.meta.date, p.meta.time, p.meta.location, p.meta.equipment, p.meta.oilT, p.meta.airT], ['26/11/26', '02:15 PM', 'TRAM GIA', 'MBA GIA', '27', '28']);
  eq(p.items.map(it => [it.no, it.group, it.phase]).slice(0, 3), [[3, 'winding', 'A'], [4, 'winding', 'A'], [5, 'winding', 'A']]);
  const r = p.items.find(it => it.no === 5);
  eq([r.label, r.mode, r.lead, r.kv, r.pf, r.cap], ['CH+CHT (500/220 - 35+Vo)', 'GND', 'RB', 10, 0.173, 9359.67]);
  eq(p.items.filter(it => it.no >= 29 && it.no <= 56).map(it => [it.group, it.phase]).filter((x, i, a) => i === 0 || JSON.stringify(x) !== JSON.stringify(a[i - 1])), [['bushing', 'A']]);
  const nl = p.items.find(it => it.no === 73);
  eq([nl.group, nl.phase, nl.unit, Number.isNaN(nl.cap)], ['noload', 'A', 'H', true]);
  assert.throws(() => DobleM4000.parse('abc', 'x.txt'), /không phải file Doble M4000/);
});

test('ghép mẫu 3 pha: cuộn dây theo tên + sơ đồ đo, sứ theo tên / C1-C2, đo lặp lấy lần sau, kích từ không điền', () => {
  const c = ctx(), M = c.EquipmentTypes.get('MBA');
  const cfg = Object.assign(M.defaultCfg(), { template: '3P', topology: 'bank1p' }), schema = M.buildSchema(cfg);
  const items = c.MbaDoble.guess(c.DobleM4000.parse(FILE, 'FAKE.txt'), schema, cfg);
  const by = no => items.find(it => it.no === no);
  eq([3, 4, 5, 6, 7, 8].map(n => by(n).target), ['w|wtgd.A.meas|r4', 'w|wtgd.A.meas|r3', 'w|wtgd.A.meas|r0', 'w|wtgd.A.meas|r5', 'w|wtgd.A.meas|r1', 'w|wtgd.A.meas|r2']);
  eq([by(11).use, by(12).use, by(11).target], [false, true, 'w|wtgd.B.meas|r5']);
  assert.match(by(11).note, /đo lặp — dùng lần sau \(TT 12\)/);
  eq([29, 30, 31, 32, 33, 52, 55, 56].map(n => by(n).target),
    ['b|b.hv.meas|1|A', 'b|b.mv.meas|1|A', 'b|b.n.meas|1|A', 'b|b.lv.meas|1|a', 'b|b.lv2.meas|1|a', 'b|b.hv.meas|2|A', 'b|b.lv.meas|2|a', 'b|b.lv2.meas|2|a']);
  assert.match(by(31).note, /đoán C1/);
  assert.match(by(55).note, /bị cắt "35" — đoán 35\.1/);
  eq([by(73).use, by(73).target], [false, '']);
  // ghi vào ô: tgδ = %PF đo, C, U đo, sơ đồ đo; nhiệt độ dầu vào ô nhiệt độ còn trống
  const { v, n } = c.MbaDoble.writes(items);
  assert.equal(n, 15);
  eq([v['wtgd.A.meas.r0.tgd'], v['wtgd.A.meas.r0.c'], v['wtgd.A.meas.r0.u'], v['wtgd.A.meas.r0.d']], ['0,173', '9359,67', '10', 'GND']);
  eq([v['b.lv.meas.tgd2.a'], v['b.lv.meas.c2.a'], v['b.lv.meas.tgd2.u'], v['b.lv.meas.tgd2.d']], ['0,899', '295,95', '0,5', 'GAR']);
  const parsed = c.DobleM4000.parse(FILE, 'FAKE.txt');
  eq(c.MbaDoble.tempWrites(parsed, schema, items, { v: { 'wtgd.B.t': '30' } }), { 'wtgd.A.t': '27', 'b.hv.t': '27' });
});

test('ghép mẫu theo pha: chỉ pha của biên bản; sứ trung tính vào cột N bảng MV; trùng ô bị báo', () => {
  const c = ctx(), M = c.EquipmentTypes.get('MBA');
  const cfg = Object.assign(M.defaultCfg(), { template: 'A', topology: 'bank1p' }), schema = M.buildSchema(cfg);
  const items = c.MbaDoble.guess(c.DobleM4000.parse(FILE, 'FAKE.txt'), schema, cfg);
  const by = no => items.find(it => it.no === no);
  eq([by(3).target, by(31).target], ['w|wtgd.meas|r4', 'b|b.mv.meas|1|N']);
  eq([by(12).use, by(12).target], [false, '']);
  assert.match(by(12).note, /biên bản đang lập pha A/);
  // người dùng chọn tay trùng ô → clashes
  by(4).target = by(3).target; by(4).use = true;
  assert.equal(c.MbaDoble.clashes(items).length, 1);
  eq(['CHT', 'CH+CHT'].map(l => c.MbaDoble.windingRow({ label: l, mode: l === 'CHT' ? 'UST' : 'GND' })), ['r3', 'r0']);
  eq(['CL', 'CL+CLH', 'CHL'].map((l, i) => c.MbaDoble.windingRow({ label: l, mode: ['GAR', 'GND', 'UST'][i] })), ['r5', 'r1', 'r3']);
});
