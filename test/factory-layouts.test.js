// Bộ đọc file xuất xưởng: bố cục cột theo "Pha A (số chế tạo)" (nấc, cuộn dây, sứ ghi từng dòng) bên cạnh bố cục "Máy N".
// Gộp nhiều file test report sứ Hitachi theo S/N. Workbook dựng bằng SheetJS với số liệu giả.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');

const same = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);

function book(ctx, sheets) {
  const X = ctx.XLSX, wb = X.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(rows), name));
  return X.write(wb, { type: 'base64', bookType: 'xlsx' });
}
const P = ['Pha A (X-001)', 'Pha B (X-002)', 'Pha C (X-003)'];

function perPhaseBook(ctx) {
  return book(ctx, {
    'Overview & Comparison': [['TỔNG HỢP 3 MÁY (MÁY BIẾN ÁP SỐ 2)'], [],
      ['Hạng mục / Thông số kỹ thuật', 'Đơn vị', 'Giá trị bảo đảm', 'Máy 1 (Pha A - X-001)', 'Máy 2 (Pha B - X-002)', 'Máy 3 (Pha C - X-003)', 'Đánh giá chung'],
      ['Tổn hao không tải (No-load loss P0)', 'kW', '≤ 73.0', 60.3, 60.1, 59.8, 'Đạt']],
    '1. Specs & Nameplate': [['THÔNG SỐ'], [], ['Thông số kỹ thuật', 'Đơn vị', ...P],
      ['Kiểu máy (Type)', '-', 'KIEU-1', 'KIEU-1', 'KIEU-1'], ['Dung lượng định mức cuộn Hạ áp (LV)', 'MVA', '36 / 48 / 60', '', ''],
      ['Dòng điện định mức LV', 'A', '1029 / 1371 / 1714', '', ''], ['Tổ đấu dây (Connection Symbol)', '-', 'YNa0d11', '', ''],
      ['Mã bộ đổi nấc dưới tải (OLTC)', '-', 'OLTC-1', '', ''], ['Dòng định mức bộ OLTC', 'A', 2600, '', '']],
    '3. Voltage Ratio & Polarity': [['ĐO TỶ SỐ 17 NẤC PHÂN ÁP'], [],
      ['Nấc (Tap)', 'HV', 'MV', 'Tỷ số', 'Pha A Sai số (%)', 'Pha A Đánh giá', 'Pha B Sai số (%)', 'Pha B Đánh giá', 'Pha C Sai số (%)', 'Pha C Đánh giá', 'Cực tính'],
      ['Tap 1', '550.0/√3', '225.0/√3', 2.4444, 0.03, 'Đạt', 0.05, 'Đạt', 0.02, 'Đạt', 'Subtractive'],
      ['Tap 9A', '500.0/√3', '225.0/√3', 2.2222, 0.07, 'Đạt', 0.09, 'Đạt', 0.07, 'Đạt', 'Subtractive'],
      ['MV - LV', '225.0/√3', '35.0', 3.7115, -0.22, 'Đạt', -0.16, 'Đạt', -0.23, 'Đạt', 'Subtractive']],
    '4. DC Resistance': [['ĐO ĐIỆN TRỞ MỘT CHIỀU (QUY ĐỔI VỀ 75°C) CHO CẢ 3 PHA A, B, C'], [],
      ['Cuộn dây (Winding)', 'Vị trí nấc (Tap)', 'Pha A Đo thực (Ω)', 'Pha A 75°C (Ω)', 'Pha B Đo thực (Ω)', 'Pha B 75°C (Ω)', 'Pha C Đo thực (Ω)', 'Pha C 75°C (Ω)', 'Độ lệch pha cực đại (%)'],
      ['SER (HV 1.1-2.1)', '9A', 0.1215, 0.1427, 0.1245, 0.1432, 0.1223, 0.1421, 0.8],
      ['COM (MV 2.1-2)', '-', 0.060, 0.0705, 0.0616, 0.0694, 0.0605, 0.0703, 1.1]],
    '5. Insulation & TanDelta': [['CÁCH ĐIỆN'], [], ['Hạng mục thử nghiệm', 'Đơn vị', 'Tiêu chuẩn kỹ thuật', ...P, 'Đánh giá'],
      ['R60 cuộn HV+MV+N đến LV+Tank', 'MΩ', '≥ 1000', 6560, 4480, 7710, 'Đạt'],
      ['Hệ số hấp thụ Kht (R60/R15)', '-', '≥ 1.30', 1.51, 1.49, 1.52, 'Đạt'],
      ['Tan Delta LV đến HV+MV+N+Tank', '%', '≤ 0.50 %', 0.146, 0.151, 0.155, 'Đạt'],
      ['Cách điện Mạch từ đến Gông từ + Vỏ (Core - Clamp+Tank)', 'MΩ', '> 600', 2310, 2280, 2350, 'Đạt']],
    '10. Bushings (Sứ xuyên)': [['SỨ'], [],
      ['Pha / Máy', 'Vị trí sứ', 'Mã hiệu sứ (Bushing SN)', 'C1 Nhãn (pF)', 'C1 Đo (pF)', 'Sai số C1 (%)', 'Tanδ Nhãn (%)', 'Tanδ Đo (%)', 'Nhiệt độ dầu (°C)'],
      ['Pha A (X-001)', '1.1 (HV)', 'SU-01', 736, 732.2, null, 0.35, 0.314, 32.1], ['Pha B (X-002)', '2 (N)', 'SU-02', 653, 657.1, null, 0.38, 0.26, 32.1]],
    '12. BCT (Biến dòng sứ)': [['BCT'], [], ['Pha / Máy', 'Vị trí cuộn dây', 'Lõi CT (No.)', 'Ký hiệu đầu ra (Terminal)', 'Tỷ số định mức (Ratio)', 'Điện trở DC 75°C (Ω)', 'Sai số tỷ số (%)', 'Cực tính'],
      ['Pha A (X-001)', 'HV', 1, '1S1-1S3', '1200/1', 5.783, 0.228, 'Subtractive']],
  });
}

test('file xuất xưởng bố cục theo pha: số chế tạo, thông số, tỷ số, R một chiều, cách điện, sứ, BCT', () => {
  const ctx = load(CORE);
  const F = ctx.Factory.fromBase64(perPhaseBook(ctx), 'may2.xlsx');
  const D = F.data;
  same(D.order, ['X-001', 'X-002', 'X-003']);
  same(D.order.map(s => [D.units[s].phase, D.units[s].noLoadLoss]), [['A', 60.3], ['B', 60.1], ['C', 59.8]]);
  same([D.specs.type, D.specs.vector, D.specs.oltc, D.specs.power.LV, D.specs.current.LV], ['KIEU-1', 'YNa0d11', 'OLTC-1', '36 / 48 / 60', '1029 / 1371 / 1714']);
  // tỷ số: bỏ dòng tên bảng có chữ "NẤC", bỏ cột "Đánh giá"; nấc "Tap 9A" → 9A; MV - LV; cực tính theo cột
  same(D.ratio.taps.map(t => t.tap), ['1', '9A']);
  same(F.ratioTap('9b').err, { 'X-001': 0.07, 'X-002': 0.09, 'X-003': 0.07 });
  same(D.ratio.mvlv.err, { 'X-001': -0.22, 'X-002': -0.16, 'X-003': -0.23 });
  assert.equal(D.ratio.polarity['X-002'], 'Subtractive');
  // R một chiều: nấc ở cột riêng; "Độ lệch pha cực đại" không bị nhận là cột pha C
  same(F.dcr('SER', '9', 'X-003'), { r75: 0.1421, meas: 0.1223, tap: '9A', refT: 75 });
  assert.equal(F.dcr('COM', null, 'X-002').r75, 0.0694);
  // cách điện theo sơ đồ đo
  assert.equal(F.ins('HV+MV+N-LV+TANK', 'r60', 'X-002'), 4480);
  assert.equal(F.ins('HV+MV+N-LV+TANK', 'kht', 'X-003'), 1.52);
  assert.equal(F.ins('LV-HV+MV+N+TANK', 'tgd', 'X-001'), 0.146);
  assert.equal(F.ins('CORE', 'r60', 'X-003'), 2350);
  // sứ theo S/N và theo vị trí của từng máy
  same(F.bushingBySerial('su-01'), { mba: 'X-001', terminal: '1.1', terminalLabel: '1.1 (HV)', serial: 'SU-01', c1np: 736, tdnp: 0.35, c1: 732.2, td: 0.314, t: 32.1 });
  assert.equal(F.bushingByUnit('X-002', '2').serial, 'SU-02');
  assert.equal(F.bct('X-001', '1S1-1S3').ratio, 1200);
  // phần file không có → cảnh báo, không lỗi
  assert.ok(D.warnings.some(w => /điều kiện thí nghiệm/.test(w)));
});

test('test report sứ Hitachi: gộp nhiều file theo S/N, file sau thay bản ghi trùng', () => {
  const ctx = load(CORE);
  const H = ctx.HitachiBushing;
  const tr = rows => book(ctx, { TestReport: [['Serial', 'Ur', 'C1 đo', 'tanδ1 đo', 'T dầu'], ...rows] });
  H.clear();
  assert.equal(H.fromBase64(tr([['SU-1', 550, 730, 0.3, 30], ['SU-2', 245, 1250, 0.3, 30]]), 'at1.xlsx', { append: true }).total, 2);
  const r = H.fromBase64(tr([['SU-2', 245, 1260, 0.31, 30], ['SU-3', 126, 650, 0.3, 30]]), 'at2.xlsx', { append: true });
  same([r.count, r.total, H.sources], [2, 3, ['at1.xlsx', 'at2.xlsx']]);
  assert.equal(H.report('SU-2').raw.c1, 1260);
  assert.ok(H.report('SU-1') && H.report('SU-3'));
  H.fromBase64(tr([['SU-9', 550, 730, 0.3, 30]]), 'khac.xlsx'); // không gộp: thay toàn bộ
  same([H.reports.length, H.sources], [1, ['khac.xlsx']]);
});

test('test report sứ → lần FAT của từng sứ: chỉ sứ đã có trong danh mục (có vị trí); quy 20 °C như số đo hiện trường; ngày Excel / nhập tay', () => {
  const ctx = load(CORE);
  const H = ctx.HitachiBushing;
  H.clear();
  H.fromBase64(book(ctx, { TestReport: [['Serial', 'Ur', 'Trạng thái', 'Ngày', 'T môi trường', 'C1 đo', 'tanδ1 đo'],
    ['SU-1', 245, 'Chưa lắp', 45658, 25, 500, 0.35], ['SU-2', 245, 'Chưa lắp', '', 25, 510, 0.36], ['SU-9', 245, 'Chưa lắp', '02/01/2025', 25, 520, 0.37]] }), 'su.xlsx');
  const eqs = [
    { id: 'e1', class_code: 'SU', serial_no: 'SU-1', position: '1.1', parent_serial: 'MBA-1' },
    { id: 'e2', class_code: 'SU', serial_no: 'su-2', position: '1.1', parent_serial: 'MBA-2' },
  ];
  const plan = JSON.parse(JSON.stringify(H.dbPlan(eqs, [{ serial_no: 'SU-2' }])));
  same(plan.map(p => [p.serial, p.date, p.where, p.hasFat, p.pick, !!p.reason]), [
    ['SU-1', '2025-01-01', 'MBA-1 · đầu 1.1', false, true, false],
    ['SU-2', '', 'MBA-2 · đầu 1.1', true, false, false],
    ['SU-9', '2025-01-02', '', false, false, true],
  ]);
  const packs = JSON.parse(JSON.stringify(H.factoryPacks(['SU-1', 'SU-2'], { equipment: eqs, fileName: 'su.xlsx', date: '2024-12-30' })));
  assert.equal(packs.length, 2);
  same(packs[0].refs, [{ key: 'SU|SU-1', class_code: 'SU', serial_no: 'SU-1' }]);
  assert.equal(packs[0].session.test_date, '2025-01-01');
  assert.equal(packs[1].session.test_date, '2024-12-30', 'file không ghi ngày → ngày nhập tay');
  const c1 = packs[0].rows.find(r => r.param === 'C1'), f = H.to20({ ur: 245, mount: 'Chưa lắp', tAmb: 25, c1: 500, tgd1: 0.35 });
  same([c1.config, c1.phase, c1.value, c1.norm_temp_c], ['1.1', '', 500, 20]);
  assert.ok(Math.abs(c1.value_norm - f.c1) < 1e-6);
  assert.ok(Math.abs(packs[0].rows.find(r => r.param === 'TGD1').value_norm - f.tgd1) < 1e-6);
  H.clear();
});
