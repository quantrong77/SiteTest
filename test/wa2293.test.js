// Nhập số liệu Haefely 2293: đọc .csv/.bin (dữ liệu tổng hợp theo đúng định dạng máy), ánh xạ vào biểu mẫu MBA,
// nén dạng sóng, phụ lục chụp sóng. File thật (không đưa lên repo) có ở ../MBA/Rdc/Chup song thì kiểm tra thêm.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load, CORE, ROOT } = require('./harness');
const F = require('./mba-fixture');

const same = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);

// ---------------------------------------------------------------- dữ liệu tổng hợp
const T = (...c) => c.join('\t') + '\t';
function csvText({ rdc = [], ratio = [], oltc = [] } = {}) {
  const L = ['HTAG Document Export\t\t', T('Created', 'Saved', 'Exported'), T('2026-03-18 13:24:07', '2026-03-18 13:24:07', '2026-03-20 16:27:11'), '', '',
    '***** WA2293 *****\t', T('Serial Number', '00192906'), T('Firmware Version', '4.16.0'), '', '',
    '***** DUT General *****\t', T('Seria lNumber', 'Type', 'OLTC Serial Number', 'OLTC Driver Number'), T('MBA X', '', '', ''), '',
    '***** DUT Specification *****\t', T('Winding', 'Terminal', 'Connection', 'Vector Group', 'Wire Material', 'Taps'),
    T('HV', 'A/B/C/N', 'Single', '--', 'Copper IEC', '±8'), T('LV', 'a/b/c/n', 'Single', '0', 'Copper IEC', '--'), '----- Taps -----\t', T('Winding', 'Name', 'Nominal', '')];
  for (let k = 1; k <= 17; k++) L.push(T(k === 1 ? 'HV' : '', String(k), k === 9 ? '«»' : '', ''));
  L.push('', '', '***** Setup *****\t', '', '', '***** Resistance Measurement *****\t', T('Correction Temperature', '75 °C'));
  if (rdc.length) {
    L.push(T('Time', 'Description', 'Current [A]', 'Temperature [°C]', 'Resistance [Ω]', 'Corr. Resisance [Ω]'));
    rdc.forEach(([d, r]) => L.push(T('2026-03-18 13:28:33', d, '7.95', '39.0', r, '0.2')));
  }
  L.push('', '', '***** Turns Ratio Measurement *****\t');
  if (ratio.length) {
    L.push(T('Time', 'Description', 'Voltage [V]', 'Frequency [Hz]', 'Connection', 'Ratio Raw', 'Ratio Turns', 'Ratio Volts', 'Phase [°]', 'Current [mA]', 'Deviation [%]', 'Deviation Raw [%]', 'Connection Summary'));
    ratio.forEach(([d, r]) => L.push(T('2026-03-18 14:43:52', d, '50', '50/60', 'A-N:a-n', r, r, r, '-0.01', ' 1.5', '-42.1', '-42.1', 'A-N:a-n')));
  }
  L.push('', '', '***** Tap Changer Measurement *****\t', T('Correction Temperature', '75 °C'));
  if (oltc.length) {
    const row = (name, f) => T(name, ...oltc.map(f));
    L.push(row('Tap Transition / Connection', o => o.tr), row('Temperature [°C]', () => '39.0'),
      row('Static Voltage Before Tap Change [V]', () => '1.98'), row('Static Current Before Tap Change [A]', () => '10.0'),
      row('Static Resistance Before Tap Change [Ω]', () => '0.19745'), row('Corr. Static Resistance Before Tap Change [Ω]', () => '0.22339'),
      row('Static Voltage After Tap Change [V]', () => '1.97'), row('Static Current After Tap Change [A]', () => '10.1'),
      row('Static Resistance After Tap Change [Ω]', () => '0.19535'), row('Corr. Static Resistance After Tap Change [Ω]', () => '0.22101'),
      row('tFall [mS]', o => o.tFall), row('tRise [mS]', o => o.tRise), T('Delta', ...oltc.map(() => '0.4')).replace(/\t$/, ''));
  }
  return L.join('\r\n');
}
// .csv thật của máy: UTF-16 LE có BOM
const utf16 = s => { const b = Buffer.from('﻿' + s, 'utf16le'); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };

// .bin: int16 phiên bản, CR LF, rồi mỗi lần chuyển nấc 3 khối pha (tiêu đề UTF-16 + 3250 mẫu float32 U, I)
function binBuf(transitions, iDrop = 1) {
  const parts = [];
  const i16 = n => { const b = Buffer.alloc(2); b.writeInt16LE(n); return b; };
  const str = s => Buffer.from(s, 'utf16le');
  parts.push(i16(1), str('\r\n'));
  transitions.forEach(tr => ['A', 'B', 'C'].forEach(ph => {
    parts.push(str(`${tr}:${ph}-N\0\r\n`));
    const d = Buffer.alloc(3250 * 8);
    for (let k = 0; k < 3250; k++) {
      const on = ph === 'A';
      const bump = k > 700 && k < 1100 ? 0.02 : 0; // R tăng khi chuyển mạch qua điện trở chuyển tiếp
      const i = on ? (k === 900 ? 10 * iDrop : 10) : 0;
      d.writeFloatLE(on ? (0.19 + bump) * i : 0, k * 8);
      d.writeFloatLE(i, k * 8 + 4);
    }
    parts.push(d);
  }));
  const b = Buffer.concat(parts);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}

const TAP_ROWS = [['HV/17/A-N', '0.19753'], ['HV/9/A-N', '0.18269'], ['HV/1/A-N', '0.19726'], ['LV/a-n', '0.059829']];

// ---------------------------------------------------------------- đọc file
test('2293 .csv: điện trở theo nấc, tỷ số biến, bảng chuyển nấc', () => {
  const { Wa2293 } = load(CORE);
  const p = Wa2293.parseCsv(Wa2293.decode(utf16(csvText({
    rdc: TAP_ROWS, ratio: [['HV:17/LV/A-N:a-n', '7.4402'], ['HV:1/LV/A-N:a-n', '9.0375']],
    oltc: [{ tr: '1->2:A-N', tFall: '41.23', tRise: '11.38' }, { tr: '17->16:A-N', tFall: '0', tRise: '0' }],
  }))), 'MBA X TAP-B.csv');
  assert.equal(p.nTaps, 17);
  assert.equal(p.dut, 'MBA X');
  same(p.device, { model: 'Haefely 2293', serial: '00192906', fw: '4.16.0' });
  same(p.rdc.map(r => [r.winding, r.tap, r.conn, r.r, r.rDec, r.t]), [['HV', '17', 'A-N', 0.19753, 5, 39], ['HV', '9', 'A-N', 0.18269, 5, 39], ['HV', '1', 'A-N', 0.19726, 5, 39], ['LV', '', 'a-n', 0.059829, 6, 39]]);
  same(p.ratio.map(r => [r.w1, r.tap, r.w2, r.ratio, r.ratioDec]), [['HV', '17', 'LV', 7.4402, 4], ['HV', '1', 'LV', 9.0375, 4]]);
  same(p.oltc.map(o => [o.from, o.to, o.conn, o.ub, o.ib, o.tFall, o.tRise, o.delta]), [['1', '2', 'A-N', 1.98, 10, 41.23, 11.38, 0.4], ['17', '16', 'A-N', 1.98, 10, 0, 0, 0.4]]);
  same(Wa2293.guessPhase('MBA X TAP-B.csv', 'A-N'), { phase: 'B', from: 'name' });
  same(Wa2293.guessPhase('AT2 500DNO TSB C.csv', 'A-N'), { phase: 'C', from: 'name' });
  same(Wa2293.guessPhase('AT2 500 DNO 069.csv', 'A-N'), { phase: 'A', from: 'conn' });
  assert.throws(() => Wa2293.parseCsv('a\tb\r\n', 'khac.csv'), /không phải file .csv xuất từ Haefely 2293/);
});

test('2293 .bin: bỏ khối pha không đo, đọc đủ 3250 mẫu mỗi lần chuyển nấc', () => {
  const { Wa2293 } = load(CORE);
  const b = Wa2293.parseBin(binBuf(['1->2', '2->3']), 'x.bin');
  assert.equal(b.version, 1);
  same(b.waves.map(w => [w.tr, w.from, w.to, w.conn, w.v.length]), [['1->2:A-N', '1', '2', 'A-N', 3250], ['2->3:A-N', '2', '3', 'A-N', 3250]]);
  assert.ok(Math.abs(b.waves[0].dt - 1 / 6500) < 1e-12);
});

// ---------------------------------------------------------------- ánh xạ vào biểu mẫu
test('nấc máy đo → hàng biểu mẫu (19 nhãn có 9a/9b/9c)', () => {
  const { Mba2293, Schema } = load(CORE);
  const taps = Schema.DEFAULT_TAPS;
  same(Mba2293.tapKeys('17', taps, 17), ['t19']);
  same(Mba2293.tapKeys('8', taps, 17), ['t8']);
  same(Mba2293.tapKeys('9', taps, 17), ['t10']);
  same(Mba2293.tapKeys('9', taps, 17, 'a'), ['t9']);
  same(Mba2293.tapKeys('9', taps, 17, 'all'), ['t9', 't10', 't11']);
  same(Mba2293.tapKeys('10', taps, 17), ['t12']);
  same(Mba2293.tapKeys('11', taps, 19), ['t11'], 'máy khai đủ 19 nấc → theo thứ tự');
});

test('điện trở Ω → mΩ vào đúng ô pha; tỷ số biến; đoán cặp cuộn dây', () => {
  const { Wa2293, Mba2293, Schema } = load(CORE);
  const taps = Schema.DEFAULT_TAPS;
  const p = Wa2293.parseCsv(csvText({ rdc: TAP_ROWS, ratio: [['HV:17/LV/A-N:a-n', '2.1631'], ['HV:9/LV/A-N:a-n', '2.2387']] }), 'x.csv');
  const [hv, lv] = Mba2293.rdcGroups(p);
  same([hv.winding, hv.target, lv.winding, lv.target], ['HV', 'hv', 'LV', 'mv']);
  same(Mba2293.rdcWrites(hv, 'hv', 'B', taps, 17, 'b'), { 'dcr.hv.t19.B': '197.53', 'dcr.hv.t10.B': '182.69', 'dcr.hv.t1.B': '197.26' });
  same(Mba2293.rdcWrites(lv, 'lv', 'C', taps, 17, 'b'), { 'dcr.lv.r.C': '59.829' });
  // nhóm "HV" chỉ 61 mΩ giữa các nhóm ~190 mΩ → lệch xa, mặc định không điền
  const odd = Mba2293.rdcGroups(Wa2293.parseCsv(csvText({ rdc: [['HV/17/A-N', '0.061464']] }), 'z.csv'))[0];
  same(Mba2293.rdcOutliers([hv, odd, hv]).map(o => [o.g.rows.length, Math.round(o.dev)]), [[1, -69]]);
  same(Mba2293.rdcOutliers([hv]), []);
  // pha đo ở 39 °C, pha khác 28 °C → quy về cùng nhiệt độ: R2 = R1·(235 + t2)/(235 + t1)
  const cold = Object.assign({}, hv, { t: 28 });
  same(Mba2293.rdcTempConflicts([{ g: cold, phase: 'C' }, { g: hv, phase: 'A' }], {}), [{ target: 'hv', temps: [{ phase: 'C', t: 28 }, { phase: 'A', t: 39 }], ref: 28 }]);
  assert.equal(Mba2293.rdcTempConflicts([{ g: hv, phase: 'A' }], { hv: '39' }).length, 0);
  assert.equal(Mba2293.rdcWrites(hv, 'hv', 'A', taps, 17, 'b', 28)['dcr.hv.t19.A'], (0.19753 * 263 / 274 * 1000).toFixed(2));
  same(Mba2293.ratioWrites(p, 'hm', 'A', taps, 'b'), { 'ratio.hm.t19.A': '2.1631', 'ratio.hm.t10.A': '2.2387' });
  assert.equal(Mba2293.guessRatioTarget(p, null, { lvMode: 'unit' }, taps), 'hm');
  const p2 = Wa2293.parseCsv(csvText({ ratio: [['HV:9/LV/A-N:a-n', '8.2387']] }), 'y.csv');
  assert.equal(Mba2293.guessRatioTarget(p2, null, { lvMode: 'unit' }, taps), 'hl');
  // có file xuất xưởng: theo tỷ số định mức gần nhất
  const FX = { ratioTap: () => ({ hvKV: 500, mvKV: 225 }), data: { ratio: { mvlv: { lvKV: 35, nominal: 3.71 } } } };
  assert.equal(Mba2293.guessRatioTarget(p2, FX, { lvMode: 'unit' }, taps), 'hl');
});

// ---------------------------------------------------------------- dạng sóng
test('nén dạng sóng: giữ đường cong trong sai số lượng tử, phát hiện sụt dòng', () => {
  const { Wa2293, OltcWave } = load(CORE);
  const [w] = Wa2293.parseBin(binBuf(['1->2']), 'x.bin').waves;
  const c = OltcWave.compact(w);
  assert.equal(c.n, 650);
  assert.ok(c.q.length < 4000, 'dưới 4 kB cho một lần chuyển nấc');
  const e = OltcWave.expand(JSON.parse(JSON.stringify(c)));
  assert.ok(Math.abs(e.lo[0] - 0.19) < 1e-5 && Math.abs(e.hi[180] - 0.21) < 1e-5, 'giá trị R trước và trong lúc chuyển mạch');
  assert.ok(Math.abs(e.t[100] - 100 * 5 / 6500 * 1000) < 1e-3);
  assert.equal(c.iMinPct, 100);
  same(OltcWave.anomalies({ rows: [], waves: [c] }), []);
  const [wd] = Wa2293.parseBin(binBuf(['1->2'], 0.1), 'x.bin').waves;
  same(OltcWave.anomalies({ rows: [{ tr: '16->17', from: '16', to: '17', tFall: 0, tRise: 0 }], waves: [OltcWave.compact(wd)] }).map(a => a.kind), ['nodetect', 'idrop']);
  assert.equal(OltcWave.dir({ from: '17', to: '16' }), 'down');
  const bytes = Uint8Array.from([0, 1, 2, 250, 255, 7, 9]);
  same(Array.from(OltcWave.b64dec(OltcWave.b64enc(bytes))), Array.from(bytes));
});

test('chụp sóng: chiều chuyển nấc, tóm tắt, đánh giá và phụ lục BBTN', () => {
  const ctx = load(CORE);
  const { Wa2293, Mba2293, OltcWave, Evaluate, MbaReport } = ctx;
  const p = Wa2293.parseCsv(csvText({ oltc: [{ tr: '1->2:A-N', tFall: '41.23', tRise: '11.38' }, { tr: '2->1:A-N', tFall: '0', tRise: '0' }] }), 'TAP-A.csv');
  const waves = Wa2293.parseBin(binBuf(['1->2', '2->1']), 'TAP-A.bin').waves.map(w => OltcWave.compact(w));
  const rec = Mba2293.oltcRecord(p, waves, 'TAP-A.bin');
  const att = { A: rec };
  same(Mba2293.oltcDirections(att), { up: { from: '1', to: '2' }, down: { from: '2', to: '1' } });
  assert.equal(Mba2293.spanLabel(rec.rows), '1→2→1');
  assert.equal(Mba2293.spanLabel(rec.rows.slice(0, 1)), '1→2');
  const sum = Mba2293.oltcSummary(att);
  assert.match(sum, /Pha A: 2 lần chuyển nấc \(1 tăng, 1 giảm\); tFall 41,23–41,23 ms/);
  assert.match(sum, /2→1: máy đo không ghi nhận quá trình chuyển mạch/);

  const { state, schema } = F.emptyState(ctx.Schema);
  state.att = { oltc: att };
  const res = Evaluate.evaluate(state, null, schema);
  const f = res.findings.filter(x => x.sec === 'oltc' && /Chụp sóng/.test(x.item));
  same(f.map(x => [x.loc, x.status]), [['Pha A', 'warn']]);

  // Phụ lục: trang mới, bảng 2 lần chuyển nấc, đồ thị chia theo chiều tăng/giảm
  const img = { png: new Uint8Array([1]), w: 900, h: 540, perRow: 2 };
  const blocks = MbaReport.oltcAppendix(state, att, { oltcCharts: { A: [Object.assign({ dir: 'up' }, img), Object.assign({ dir: 'down' }, img)] } }, x => String(x).replace('.', ','));
  same(blocks.map(b => b.type), ['page', 'p', 'p', 'p', 'p', 'table', 'p', 'p', 'images', 'p', 'images', 'p']);
  const tbl = blocks.find(b => b.type === 'table');
  same(tbl.rows[0], ['1->2:A-N', '39', '1,98', '10', '1,97', '10,1', '41,23', '11,38', '0,4']);
  assert.equal(tbl.widths.reduce((a, b) => a + b, 0), 9040, 'vừa khổ chữ A4 của template (16 cm)');
});

// ---------------------------------------------------------------- file thật trên máy (bỏ qua khi không có)
const REAL = path.join(ROOT, '..', 'MBA', 'Rdc', 'Chup song');
test('file 2293 thật (nếu có trên máy)', { skip: !fs.existsSync(REAL) && 'không có thư mục số liệu thật' }, () => {
  const { Wa2293, OltcWave } = load(CORE);
  const ab = f => { const b = fs.readFileSync(path.join(REAL, f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
  const csv = f => Wa2293.parseCsv(Wa2293.decode(ab(f)), f);
  const a = csv('AT2 500 DNO RDC-A.csv');
  assert.equal(a.rdc.length, 17);
  assert.equal(a.oltc.length, 16);
  const b = csv('AT2 500DNO TAP-B.csv');
  assert.equal(b.oltc.length, 32);
  assert.equal(b.ratio.length, 17);
  const bin = Wa2293.parseBin(ab('AT2 500DNO TAP-B.bin'), 'TAP-B.bin');
  assert.equal(bin.waves.length, 32, 'chỉ khối của pha đo');
  const kinds = OltcWave.anomalies({ rows: b.oltc, waves: bin.waves.map(w => OltcWave.compact(w)) });
  same(kinds.map(k => k.tr), ['16->17:A-N'], 'lần 16→17 máy không ghi nhận chuyển mạch');
});
