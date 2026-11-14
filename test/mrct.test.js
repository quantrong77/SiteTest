// Bộ đọc Megger MRCT: file .pdbxml của PowerDB và chữ của báo cáo PDF "CT TEST REPORT".
// Dữ liệu tổng hợp theo đúng cấu trúc file thật (file thật không đưa lên repo).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');

const ctx = load(CORE);
const M = ctx.Mrct;
const same = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);
const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

// ---------------------------------------------------------------- .pdbxml tổng hợp
function cstr(s) {
  const b = Buffer.alloc(4 + 2 * s.length);
  b[0] = 0xff; b[1] = 0xfe; b[2] = 0xff; b[3] = s.length;
  for (let k = 0; k < s.length; k++) b.writeUInt16LE(s.charCodeAt(k), 4 + 2 * k);
  return b;
}
function farr(a, cap = 100) {
  const b = Buffer.alloc(8 + 4 * a.length);
  b.writeInt32LE(cap, 0); b.writeInt32LE(a.length, 4);
  a.forEach((x, k) => b.writeFloatLE(x, 8 + 4 * k));
  return b;
}
function satChart(curves) {
  const parts = [Buffer.from([1, 0, 0, 0])];
  curves.forEach(c => parts.push(cstr(c.tap), farr(c.I), farr(c.V), farr(c.I.map(() => 60))));
  parts.push(cstr(''), farr([], 0), farr([], 0), farr([], 0)); // mục rỗng như file thật
  parts.push(Buffer.from([100, 0, 0, 0, 1, 0, 0, 0])); // phần đuôi
  return Buffer.concat(parts).toString('base64');
}
// đường từ hóa: I tăng chậm rồi nhanh sau khuỷu ~ 400 V
const V = [], I = [];
for (let u = 10; u <= 600; u += 10) { V.push(u); I.push(u < 400 ? u * 1e-4 : 0.04 * Math.pow(u / 400, 8)); }

function pdbxml() {
  const tag = (n, t, v) => `<tag name="${n}" type="${t}">${v}</tag>`;
  const arr = (n, items) => `<array name="${n}">${Object.entries(items).map(([i, v]) => `<arrayitem index="${i}" type="string">${v}</arrayitem>`).join('')}</array>`;
  return `<?xml version="1.0" encoding="UTF-8" ?><powerdb.testdata version="1.0"><form name="ITMS"><test><data>
    ${tag('eqptinventorynumber', 'string', 'Megger MRCT 0000')}${tag('testdate', 'string', '01/02/2026')}
    ${tag('ct1__cttested', 'integer', '1')}${tag('ct1__np_ctname', 'string', 'X')}${tag('ct1__np_ctlbl', 'string', '1S')}${tag('ct1__seccurrent', 'float', '1')}
    ${arr('ct1__np_ratio_prim', { 1: '150', 2: '300' })}${arr('ct1__tap_name', { 1: '1S1-1S2', 2: '1S1-1S3' })}
    ${arr('ct1__tap_kneev', { 2: '398.5' })}${arr('ct1__tap_kneec', { 2: '3.9E-02' })}
    ${arr('ct1__wind_tap_name', { 1: '1S1-1S3' })}${arr('ct1__wind_res', { 1: '5.281056' })}
    ${tag('ct1__satchartdata', 'string', satChart([{ tap: '1S1-1S3', I, V }]))}
    ${tag('ct2__cttested', 'integer', '1')}${tag('ct2__np_ctname', 'string', 'X')}${tag('ct2__np_ctlbl', 'string', '2S')}
    ${arr('ct2__wind_tap_name', { 1: '2S1-2S2' })}${arr('ct2__wind_res', { 1: '0.3285972' })}
    ${tag('ct3__cttested', 'integer', '0')}${tag('ct3__np_ctname', 'string', 'X')}
    ${tag('ct7__cttested', 'integer', '1')}${tag('ct7__np_ctname', 'string', 'XN')}${tag('ct7__np_ctlbl', 'string', '1S')}
    ${arr('ct7__wind_tap_name', { 1: '1S1-1S3' })}${arr('ct7__wind_res', { 1: '3.79' })}
  </data></test></form></powerdb.testdata>`;
}

test('ký hiệu đầu ra, số, tỷ số, góc pha', () => {
  assert.equal(M.parseTap('1.1-1.3').name, '1S1-1S3');
  assert.equal(M.parseTap('2S1-2S4').b, 4);
  assert.equal(M.parseTap('1.1-2.3'), null);
  assert.equal(M.num('1,082.9'), 1082.9);
  assert.equal(M.num('9.149394E-02'), 0.09149394);
  assert.ok(Number.isNaN(M.num('Correct')));
  near(M.ratioOf('2996.82:3').k, 998.94);
  assert.equal(M.phaseOf("0�2'").text, "0°2'");
  assert.equal(M.phaseOf("-0°15'").minutes, -15);
});

test('.pdbxml: CT/lõi, điện trở, điểm khuỷu, đường từ hóa', () => {
  const r = M.parsePdbxml(pdbxml(), 'mau.pdbxml');
  assert.equal(r.kind, 'pdbxml');
  assert.equal(r.hasRatio, false);
  assert.equal(r.date, '01/02/2026');
  same(r.cts.map(c => c.name), ['X', 'XN']);
  const [c1, c2] = r.cts[0].cores;
  assert.equal(c1.code, 1); assert.equal(c2.code, 2);
  assert.equal(c1.rating, '150-300/1 A');
  const t13 = c1.taps.find(t => t.name === '1S1-1S3');
  near(t13.r, 5.281056, 1e-9);
  same(t13.knee, { v: 398.5, i: 0.039 });
  assert.equal(c1.curves[0].tap, '1S1-1S3');
  assert.equal(c1.curves[0].points.length, V.length);
  near(c1.curves[0].points[5].v, 60, 1e-4);
  near(c2.taps[0].r, 0.3285972, 1e-9);
  const ex = M.excitation(c1);
  assert.equal(ex.name, '1S1-1S3');
  assert.equal(ex.status, 'cpc'); // khuỷu do máy tính
  near(ex.picks[3].v, 398.5); near(ex.picks[1].v, 199.25);
  assert.match(ex.how, /MRCT/);
  assert.throws(() => M.parsePdbxml('<x/>', 'a.pdbxml'), /PowerDB/);
});

// ---------------------------------------------------------------- PDF tổng hợp (chữ + tọa độ như pdf.js)
function pdfPage() {
  const it = [];
  const row = (y, cells) => cells.forEach(([x, s]) => it.push({ str: s, x, y, w: s.length * 4 }));
  row(759, [[230, 'CT TEST REPORT']]);
  row(709, [[351, 'DATE'], [375, '31/12/2025'], [452, 'PAGE'], [513, '1']]);
  row(617, [[70, 'CT: 9.9.B1'], [155, 'Core1'], [227, 'NAMEPLATE DATA']]);
  row(590, [[48, 'ASSET ID'], [199, 'ACCURACY CLASS'], [336, 'Protection'], [398, 'SATURATION STD'], [469, 'ANSI 45']]);
  row(554, [[405, 'Phase '], [489, 'Resist. ']]);
  row(549, [[29, 'Tap'], [446, 'Polarity']]);
  row(547, [[408, 'Dev.'], [489, '(Ohms)']]);
  row(542, [[57, ' Nameplate'], [104, 'Measured'], [150, '% Error'], [188, 'Test V (V)'], [232, 'Test I (A)'], [273, 'Prim V (V)'], [321, 'Volt.(V)'], [364, 'Cur.(A)']]);
  row(529, [[24, '1.1-1.2'], [64, '1600:1'], [104, '1598.14:1'], [152, '-0.116'], [193, '32.335'], [236, '0.0012'], [279, '0.0202'], [322, '190.73'], [364, '0.0032'], [409, "0�2'"], [447, 'Correct'], [490, '10.950']]);
  // hàng thiếu điểm khuỷu (ô trống) — các cột sau vẫn đúng chỗ
  row(516, [[24, '1.1-1.3'], [64, '2000:1'], [104, '1997.77:1'], [152, '-0.112'], [193, '40.421'], [236, '0.0009'], [279, '0.0202'], [409, "0�2'"], [447, 'Reversed'], [490, '13.833']]);
  row(502, [[24, '1.2-1.3'], [66, '400:1'], [104, '399.628:1'], [152, '-0.093'], [193, '8.0859'], [236, '0.0047'], [279, '0.0202'], [322, '1,047.8'], [364, '0.0131'], [409, "0�2'"], [447, 'Correct'], [492, '2.883']]);
  row(199, [[25, '#'], [46, 'Voltage/Current'], [118, '1.1-1.2'], [163, '1.1-1.3']]);
  let y = 189;
  [[10, 12, 0.0001, 0.0001], [100, 120, 0.001, 0.0008], [200, 240, 0.003, 0.002], [250, 300, 0.02, 0.01]].forEach(([v1, v2, i1, i2], k) => {
    row(y, [[52, 'VOLTAGE (volts)'], [122, String(v1)]].concat(k === 3 ? [] : [[167, String(v2)]])); // điểm cuối cột 2 trống
    row(y - 5, [[25, String(k + 1)]]);
    row(y - 7, [[51, 'CURRENT (amps)'], [122, String(i1)]].concat(k === 3 ? [] : [[167, String(i2)]]));
    y -= 14;
  });
  row(59, [[20, 'TEST EQUIPMENT USED:'], [106, 'Megger MRCT 0000'], [334, 'TESTED BY:']]);
  return it;
}

test('PDF: bảng tỷ số theo cột, ô trống, đặc tính từ hóa', () => {
  const r = M.parsePdfItems([pdfPage()], 'bao-cao.pdf');
  assert.equal(r.kind, 'pdf');
  assert.equal(r.hasRatio, true);
  assert.equal(r.device, 'Megger MRCT 0000');
  assert.equal(r.date, '31/12/2025');
  assert.equal(r.cts.length, 1);
  assert.equal(r.cts[0].name, '9.9.B1');
  const c = r.cts[0].cores[0];
  assert.equal(c.code, 1);
  assert.equal(c.std, 'ANSI 45');
  const [a, b, d] = c.taps;
  assert.equal(a.name, '1S1-1S2'); near(a.ratio.k, 1598.14); near(a.err, -0.116); assert.equal(a.phase.text, "0°2'");
  assert.equal(a.polarity, 'Correct'); near(a.r, 10.95); same(a.knee, { v: 190.73, i: 0.0032 });
  assert.equal(b.knee, null); assert.equal(b.polarity, 'Reversed'); near(b.r, 13.833);
  assert.equal(d.name, '1S2-1S3'); near(d.knee.v, 1047.8);
  assert.equal(c.rating, '1600:1; 2000:1');
  const cv = Object.fromEntries(c.curves.map(k => [k.tap, k.points.length]));
  assert.deepEqual(cv, { '1S1-1S2': 4, '1S1-1S3': 3 });
  assert.throws(() => M.parsePdfItems([[{ str: 'Hello', x: 0, y: 0, w: 10 }]], 'x.pdf'), /CT TEST REPORT/);
});

test('từ hóa: ưu tiên cặp đầu ra có đủ đường cong và điểm khuỷu do máy tính', () => {
  const pts = V.map((v, k) => ({ v, i: I[k] }));
  const core = { code: 1, std: 'ANSI 45', curves: [{ tap: '1S1-1S3', points: pts }, { tap: '1S1-1S2', points: pts }],
    taps: [{ name: '1S1-1S2', knee: { v: 300, i: 0.03 } }, { name: '1S1-1S3', knee: null }] };
  const ex = M.excitation(core);
  assert.equal(ex.name, '1S1-1S2'); assert.equal(ex.status, 'cpc'); near(ex.picks[3].v, 300);
  core.taps[0].knee = null; // không cặp nào đủ: lấy cặp S1-S lớn nhất, không tự tính khuỷu, 3 mốc theo U lớn nhất
  const nk = M.excitation(core);
  assert.equal(nk.name, '1S1-1S3'); assert.equal(nk.status, 'noknee'); assert.equal(nk.picks.length, 3);
  near(nk.picks[2].v, 0.75 * 600); assert.match(nk.how, /Không có/);
});

test('.pdbxml: khối nhị phân hỏng không làm hỏng cả file; CT ở chỉ số lớn vẫn đọc', () => {
  const good = Buffer.from(satChart([{ tap: '1S1-1S3', I, V }]), 'base64');
  const cut = Buffer.concat([good.subarray(0, 4), Buffer.from([0xff, 0xfe, 0xff, 40, 0x31, 0x00])]); // tên bị cắt
  assert.equal(M.satCurves(new Uint8Array(cut)).length, 0);
  assert.equal(M.satCurves(new Uint8Array(good.subarray(0, 300))).length, 0); // mảng bị cắt
  const x = pdbxml().replace(/ct7__/g, 'ct121__');
  const r = M.parsePdbxml(x, 'mau.pdbxml');
  same(r.cts.map(c => c.name), ['X', 'XN']);
});

test('PDF: "CoreN" nằm ở dòng riêng sau "CT:"', () => {
  const items = pdfPage().map(it => (it.str === 'Core1' ? Object.assign({}, it, { y: 611 }) : it));
  const r = M.parsePdfItems([items], 'bao-cao.pdf');
  assert.equal(r.cts[0].name, '9.9.B1');
  same(r.cts[0].cores.map(c => c.code), [1]);
  assert.equal(r.cts[0].cores[0].taps.length, 3);
});

test('mục chữ gộp nhiều số được tách theo vị trí', () => {
  const L = M.lines([{ str: '0.6479  0.8095', x: 120, y: 10, w: 56 }, { str: 'VOLTAGE (volts)', x: 50, y: 10, w: 60 }]);
  assert.equal(L.length, 1);
  same(L[0].t.map(t => t.s), ['VOLTAGE (volts)', '0.6479', '0.8095']);
  assert.ok(L[0].t[2].x > 140);
});
