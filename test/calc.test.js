// Phép quy đổi và bảng tra: QĐ 1901 (K1, K2, Bảng 5, PI, độ ẩm), hệ số K sứ, sứ Hitachi, đặc tính từ hóa CPC 100.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');

// Đối tượng tạo trong ngữ cảnh vm có prototype khác, nên so qua JSON
const same = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
const { QD, BushingK, HitachiBushing: H, CpcImport } = load(CORE);

test('K1 Bảng 4: ô có trong bảng dùng thẳng, ngoài bảng nhân các cột', () => {
  same(QD.tableFactor(QD.K1, 10), { k: 1.5, dt: 10, expr: 'K(10)' });
  const f = QD.tableFactor(QD.K1, 9);
  close(f.k, 1.22 * 1.17);
  assert.equal(f.expr, 'K(5)×K(4)');
  assert.equal(QD.tableFactor(QD.K1, -10).k, 1.5); // chiều chênh không đổi hệ số
  assert.equal(QD.tableFactor(QD.K1, 0).expr, '1');
});

test('R cách điện về 20 °C: đo trên 20 °C nhân K1, dưới 20 °C chia K1', () => {
  close(QD.convIR(1000, 30, 20).val, 1500);
  close(QD.convIR(1000, 10, 20).val, 1000 / 1.5);
  close(QD.convIR(1000, 20, 20).val, 1000);
});

test('K2 Bảng 7: 16 °C = 2,4; trên 16 °C nhân các cột 1…15, không dùng cột 16', () => {
  assert.equal(QD.tableFactor(QD.K2, 16).k, 2.4);
  const f = QD.tableFactor(QD.K2, 18);
  close(f.k, 1.95 * 1.15);
  assert.equal(f.expr, 'K(15)×K(3)');
});

test('tgδ cuộn dây về 20 °C: đo trên 20 °C chia K2, dưới 20 °C nhân K2', () => {
  close(QD.convTgd(0.3, 36, 20).val, 0.3 / 2.4);
  close(QD.convTgd(0.3, 10, 20).val, 0.3 * 1.55);
});

test('R một chiều quy đổi nhiệt độ: R2 = R1(235+t2)/(235+t1)', () => {
  close(QD.convDCR(200, 30, 75), 200 * 310 / 265);
});

test('Bảng 5 (MBA ≥110 kV) và Bảng 46 nội suy theo nhiệt độ', () => {
  assert.equal(QD.irMin(20), 600);
  assert.equal(QD.irMin(25), 500);
  assert.equal(QD.irMin(5), 900);
  assert.equal(QD.tgdMax(20, '330-500'), 1.0);
});

test('Phân loại PI (Điều 29) và độ ẩm cách điện cứng (Điều 28)', () => {
  assert.equal(QD.classifyPI(0.9).status, 'fail');
  assert.equal(QD.classifyPI(1.05).status, 'fail');
  assert.equal(QD.classifyPI(1.2).status, 'warn');
  assert.equal(QD.classifyPI(1.25).status, 'pass');
  assert.equal(QD.classifyPI(2.5).status, 'pass');
  assert.equal(QD.classifyMoisture(2.1).status, 'pass');
  assert.equal(QD.classifyMoisture(3.7).status, 'warn');
  assert.equal(QD.classifyMoisture(4.8).status, 'fail');
});

test('Độ lệch giữa các pha ∆(%) = (max − min)/trung bình', () => {
  close(QD.phaseSpread([100, 101, 102]), 2 / 101 * 100);
  assert.equal(QD.phaseSpread([100, NaN]), null);
});

test('Hệ số K sứ QĐ 1901 có sẵn: tgδ20 = tgδ × K, tra dòng gần nhất', () => {
  const t = BushingK.BUILTIN;
  assert.equal(t.formula, 'MUL');
  assert.equal(BushingK.lookup(t, 'OIP', 35).k, 1.15);
  assert.equal(BushingK.lookup(t, 'RIP', 35.4).k, 1.21);
  assert.equal(BushingK.lookup(t, 'OIP', 60.4).k, 1.35); // lệch nửa bậc ở đầu bảng vẫn dùng dòng 60
  assert.ok(Number.isNaN(BushingK.lookup(t, 'OIP', 61).k));
  assert.ok(Number.isNaN(BushingK.lookup(t, 'GIF', 30).k));
  close(BushingK.convert(t, 0.4, 1.15), 0.46);
});

test('Hệ số K sứ: bảng theo hãng nội suy tuyến tính và công thức ÷ K', () => {
  const t = { name: 'Hãng X', columns: ['OIP'], rows: [[20, 1], [30, 1.2]], formula: 'DIV', lookup: 'LINEAR' };
  const r = BushingK.lookup(t, 'oip', 25);
  close(r.k, 1.1);
  assert.equal(r.interp, true);
  close(BushingK.convert(t, 0.44, 1.1), 0.4);
});

test('Hệ số K sứ: chọn cách quy đổi theo ô "Cách quy đổi về 20 °C"', () => {
  assert.equal(BushingK.resolve('').kind, 'hitachi');
  assert.equal(BushingK.resolve(BushingK.MODE_MANUAL).kind, 'manual');
  assert.equal(BushingK.resolve(BushingK.MODE_1901).table.basis, 'QD1901');
  assert.equal(BushingK.resolve(BushingK.MODE_MFR + 'Không có').table, null);
});

test('Hệ số K sứ: bảng đã lưu trong trình duyệt được dùng thay bảng có sẵn', () => {
  const cached = { tables: [{ name: 'Hãng Y', basis: 'MANUFACTURER', columns: ['RIP'], rows: [[20, 1]], formula: 'MUL', lookup: 'NEAREST', active: true }] };
  const { BushingK: K } = load(['js/bushing-k.js'], { localStorage: { 'bbtn-mba.bushingK': JSON.stringify(cached) } });
  assert.equal(K.source, 'cache');
  assert.ok(K.modeOptions().includes(K.MODE_MFR + 'Hãng Y'));
  assert.equal(K.qd1901().id, 'builtin-qd1901'); // không có bảng QĐ 1901 trong bộ đệm → dùng bảng có sẵn
});

test('Sứ RIP Hitachi: nhiệt độ thân sứ và hệ số fc Bảng 13', () => {
  assert.equal(H.bodyTemp(false, 30, 50), 30);
  close(H.bodyTemp(true, 30, 45), 35);
  assert.ok(Number.isNaN(H.bodyTemp(true, 30, NaN)));
  close(H.fc(20), 1);
  close(H.fc(25), 0.925);
  assert.ok(Number.isNaN(H.fc(81)));
});

test('Đặc tính từ hóa: nội suy log–log và điểm khuỷu theo IEC 61869-2', () => {
  const pts = [10, 20, 40, 60, 80, 100, 110, 120, 130].map(v => ({ v, i: v <= 80 ? v * 1e-4 : 0.008 * Math.pow(v / 80, 8) }));
  close(CpcImport.iAt(pts, 40), 0.004);
  close(CpcImport.iAt(pts, 30), 0.003, 1e-12); // I ∝ U trên đoạn này nên nội suy log–log cho đúng 3 mA
  const knee = CpcImport.kneeIEC(pts);
  assert.ok(knee && knee.v > 70 && knee.v < 100, `khuỷu ${knee && knee.v}`);
  close(CpcImport.iAt(pts, 1.1 * knee.v) / knee.i, 1.5, 1e-6);
  const p = CpcImport.pick({ points: pts });
  assert.equal(p.status, 'app');
  assert.equal(p.picks.length, 4);
  close(p.picks[1].v, knee.v / 2);
});

test('Đặc tính từ hóa: không có khuỷu thì mốc theo U lớn nhất đã đo', () => {
  const pts = [10, 20, 40, 80].map(v => ({ v, i: v * 1e-4 }));
  const p = CpcImport.pick({ points: pts });
  assert.equal(p.status, 'noknee');
  close(p.picks[2].v, 60);
});

test('Đoán phía/pha từ tên file XML CPC 100', () => {
  same(CpcImport.guess('PHA A 220.xml'), { phase: 'A', kv: 220 });
  const files = ['PHA A 500.xml', 'PHA B 220.xml', 'PHA a 22.xml', 'PHA N.xml'].map(f => ({ guess: CpcImport.guess(f) }));
  CpcImport.assignSides(files);
  assert.deepEqual(files.map(f => `${f.side}/${f.phase}`), ['hv/A', 'mv/B', 'lv/a', 'n/N']);
});
