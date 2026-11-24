// BBTN máy 1 pha 500 kV (mẫu theo pha A/B/C): sứ và biến dòng chân sứ thuộc máy đang lập, hai sứ hạ áp 3.1 / 3.2,
// nhãn cột sứ và chỉ danh biến dòng sửa được; đọc BBTN cũ (PDF) đã xóa bớt cột; tự nạp sứ khi tạo BBTN từ CSDL.
// Số liệu giả.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE, DOMAIN } = require('./harness');

const J = x => JSON.parse(JSON.stringify(x));
const T = ctx => ctx.EquipmentTypes.get('MBA');
const grid = (schema, id) => { let g = null; T.ctx.Common.eachGrid(schema, x => { if (x.id === id) g = x; }); return g; };

test('mẫu theo pha: cột sứ hạ áp a, b = 3.1, 3.2 của máy; nhãn cột sứ / chỉ danh BCT sửa được', () => {
  const ctx = load(CORE); T.ctx = ctx;
  const cfg = T(ctx).defaultCfg();
  cfg.template = 'B';
  const s = T(ctx).buildSchema(cfg);
  assert.equal(s.unitOwn, true);
  assert.equal(s.unitPhase, 'B');
  const lv = grid(s, 'b.lv.meas');
  assert.deepEqual(J(lv.cols.filter(c => c.phase).map(c => [c.k, c.label, c.term, c.tplLabel])), [['a', '3.1', '3.1', 'a'], ['b', '3.2', '3.2', 'b'], ['c', 'c', '3.3', 'c']]);
  assert.ok(lv.editHdr && grid(s, 'b.lv.c20').hdrDoc);
  assert.equal(grid(s, 'b.mv.meas').cols.find(c => c.k === 'N').term, '2');
  // nhãn người dùng sửa: cột sứ, cột và hàng biến dòng
  cfg.hdr = { 'b.lv.meas.a': 'LV1', 'bct.hv.A': 'CT 1.1' };
  cfg.bctLbl_hv_dcr = { w1s2: '1S1-1S2 (5P20)' };
  const s2 = T(ctx).buildSchema(cfg);
  assert.equal(grid(s2, 'b.lv.meas').cols[0].label, 'LV1');
  assert.equal(grid(s2, 'b.lv.c20').cols[0].label, 'LV1', 'bảng quy đổi 20 °C dùng chung nhãn');
  assert.equal(grid(s2, 'bct.hv.ir').cols[0].label, 'CT 1.1');
  assert.equal(grid(s2, 'bct.hv.dcr').cols[0].label, 'CT 1.1', 'chỉ danh dùng chung các bảng của phía');
  assert.equal(grid(s2, 'bct.hv.dcr').rows.find(r => r.k === 'w1s2').label, '1S1-1S2 (5P20)');
  assert.equal(grid(s2, 'bct.hv.dcr').lblCol, 1);
  // MBA 3 pha 110–220 kV: giữ cột a, b, c theo pha, không gắn máy
  const s110 = T(ctx).buildSchema(Object.assign(T(ctx).defaultCfg(), { template: '110' }));
  assert.equal(s110.unitOwn, false);
  assert.deepEqual(J(grid(s110, 'b.lv.meas').cols.filter(c => c.phase).map(c => [c.label, c.own || false])), [['a', false], ['b', false], ['c', false]]);
});

test('lưu CSDL mẫu theo pha: sứ 3.1 / 3.2 và biến dòng là của máy đang lập', () => {
  const ctx = load(CORE); T.ctx = ctx;
  const cfg = T(ctx).defaultCfg();
  cfg.template = 'C'; cfg.ps = { A: 'SN-A', B: 'SN-B', C: 'SN-C' };
  const schema = T(ctx).buildSchema(cfg);
  const v = {
    'meta.serial': 'SN-C', 'meta.date': '01/02/2025', 'meta.reason': 'Định kỳ', 'b.lv.btype': 'OIP',
    'b.hv.meas.serial.C': 'BU-HV', 'b.hv.meas.type.C': 'ETA-550', 'b.hv.meas.tgd1.C': '0,40',
    'b.lv.meas.serial.a': 'BU-31', 'b.lv.meas.type.a': 'LV-40', 'b.lv.meas.tgd1.a': '0,32',
    'b.lv.meas.serial.b': 'BU-32', 'b.lv.meas.tgd1.b': '0,31', 'bct.hv.ir.w1.C': '1000',
  };
  const state = { type: 'MBA', v, cfg, sum: { tick: {}, ev: {} }, att: {} };
  const res = ctx.Evaluate.evaluate(state, null, schema);
  const out = J(T(ctx).toRows.fieldRows(state, res, schema));
  const ref = k => out.refs.find(r => r.key === k);
  assert.equal(ref('MBA|SN-C').phase, 'C');
  assert.deepEqual([ref('SU|BU-31').position, ref('SU|BU-31').parent, ref('SU|BU-31').phase, ref('SU|BU-31').rated.insulation], ['3.1', 'MBA|SN-C', 'C', 'OIP']);
  assert.deepEqual([ref('SU|BU-32').position, ref('SU|BU-32').parent], ['3.2', 'MBA|SN-C']);
  assert.equal(ref('SU|BU-HV').parent, 'MBA|SN-C');
  assert.equal(out.rows.some(r => r.eq === 'MBA|SN-A' && /^(BUSHING|BCT)/.test(r.item)), false, 'không gắn sứ / BCT vào máy pha khác của tổ');
  assert.equal(out.refs.filter(r => r.class_code === 'SU').every(r => r.parent === 'MBA|SN-C'), true);
  const bct = out.rows.find(r => r.item === 'BCT_IR');
  assert.equal(bct.eq, 'MBA|SN-C');
});

test('tự nạp sứ khi tạo BBTN từ CSDL: theo vị trí đầu sứ; thiếu thì BBTN gần nhất; chép chỉ danh BCT', () => {
  const ctx = load(CORE.concat(['js/domain/equipment-specs.js'])); T.ctx = ctx;
  const cfg = T(ctx).defaultCfg();
  cfg.template = 'A';
  const schema = T(ctx).buildSchema(cfg);
  const kids = [
    { class_code: 'SU', position: '1.1', phase: 'A', serial_no: 'BU-1', model: 'ETA-550', manufacturer: 'Hãng X', rated: { insulation: 'RIP' } },
    { class_code: 'SU', position: '2', phase: 'N', serial_no: 'BU-N', model: 'ETA-126' },
    { class_code: 'SU', position: '3.2', phase: 'A', serial_no: 'BU-32' },
  ];
  const hist = { date: '2024-05-06', v: { 'b.lv.meas.serial.a': 'BU-31', 'b.lv.meas.serial.b': 'CU-KHAC', 'b.mv.meas.serial.A': 'BU-21' } };
  const f = J(ctx.EquipmentSpecs.bushingFrom(kids, schema, hist));
  assert.deepEqual(f['b.hv.meas.serial.A'], { value: 'BU-1', src: 'CSDL' });
  assert.equal(f['b.hv.meas.type.A'].value, 'ETA-550');
  assert.equal(f['b.hv.btype'].value, 'RIP');
  assert.equal(f['b.mv.meas.serial.N'].value, 'BU-N');
  assert.deepEqual(f['b.lv.meas.serial.b'], { value: 'BU-32', src: 'CSDL' }, 'CSDL trước BBTN cũ');
  assert.deepEqual(f['b.lv.meas.serial.a'], { value: 'BU-31', src: 'BBTN 06/05/2024' });
  assert.equal(f['b.mv.meas.serial.A'].value, 'BU-21');
  const cur = { hdr: { 'b.hv.meas.A': 'Đã sửa' }, ctNo: { hv: '1,2' } };
  const n = ctx.EquipmentSpecs.cfgFromHist(cur, { hdr: { 'b.hv.meas.A': 'cũ', 'bct.mv.N': 'CT N', 'meta.x': 'bỏ' }, bctLbl_hv_ir: { w1: 'TC1' }, ctNo: { hv: '7,8', mv: '9' } });
  assert.ok(n > 0);
  assert.equal(cur.hdr['b.hv.meas.A'], 'Đã sửa', 'không đè nhãn đang có');
  assert.equal(cur.hdr['bct.mv.N'], 'CT N');
  assert.equal(cur.hdr['meta.x'], undefined);
  assert.equal(cur.bctLbl_hv_ir.w1, 'TC1');
  assert.equal(cur.ctNo.mv, '9');
});

// ---------- PDF giả: bìa 2 cột, bảng sứ đã xóa bớt cột, BCT chỉ cột "Pha A"
function fakePdf() {
  const page0 = [], page1 = [];
  const at = (pg, y, cells) => cells.forEach(([str, x, w]) => pg.push({ str, x, y, w: w || str.length * 5 }));
  at(page0, 800, [['NPTS/BM.01', 400]]);
  at(page0, 780, [['Tên dự án/tên trạm (Project): Trạm Thử', 40]]);
  at(page0, 765, [['Vị trí lắp đặt (Site): Máy biến áp AT9 ( Pha A)', 40]]);
  at(page0, 750, [['Hãng sản xuất (Manufacturer): HÃNG X', 40], ['Số chế tạo (Serial No): SN-9A', 330]]);
  at(page0, 735, [['Năm sản xuất (Year of manufacture): 2020', 40], ['Kiểu loại (Type): KIEU-500', 330]]);
  at(page0, 720, [['Công suất (Rated power): 300/300/60 MVA', 40], ['Điện áp định mức (Rated voltage):', 330]]);
  at(page0, 708, [['(500/√3)/225/√3/35kV', 330]]);
  at(page0, 695, [['Tổ đấu dây (Vector group): YNa0d11', 40], ['Dòng định mức (Rated current): 1039/2309/1714A', 330]]);
  at(page0, 680, [['Lý do kiểm định, thí nghiệm: Định kỳ', 40], ['Ngày kiểm định, thí nghiệm (Date): 02/03/2024', 330]]);
  at(page0, 665, [['Điều kiện môi trường (Ambient condition): t (Temp.) = 30 ºC , Độ ẩm (Humidity) = 70 %', 40]]);
  at(page0, 640, [['Số biên bản: 00009/2024/NPTS3-CA', 40]]);
  // 5.1 chỉ còn cột A
  at(page1, 800, [['5.1 Sứ phía cao áp (H.V bushings):', 40]]);
  at(page1, 785, [['Sứ phía 500kV, đo nhiệt độ t= 30 oC.', 40]]);
  at(page1, 770, [['Pha', 120, 17], ['Sơ đồ đo', 500, 40]]);
  at(page1, 763, [['A (kV)', 225, 60]]);
  at(page1, 740, [['Kiểu loại (Type)', 40, 80], ['ETA-550/1600-', 210, 60]]);
  at(page1, 733, [['4', 230, 5]]);
  at(page1, 715, [['Hãng sản xuất (Manufacturer)', 40, 110], ['Hãng Y', 215, 30]]);
  at(page1, 695, [['Số chế tạo (Serial N0)', 40, 100], ['BU-1', 220, 20]]);
  at(page1, 675, [['tgδ (%)', 150, 30], ['0.394', 220, 22], ['10', 440, 10], ['UST', 505, 20]]);
  at(page1, 655, [['C1 (pF)', 150, 30], ['721.26', 218, 28]]);
  at(page1, 645, [['Trị số tgδ sứ quy đổi về 20oC (tgδ of bushings corrected to 20oC); Loại sứ: RIP ; Hệ số quy đổi K = 1.21', 40, 450]]);
  // 5.3 hai sứ hạ áp
  at(page1, 632, [['5.3. Sứ phía hạ áp (L.V bushings):', 40]]);
  at(page1, 625, [['Sứ phía 35kV , đo ở nhiệt độ t= 31 oC.', 40]]);
  at(page1, 610, [['Pha', 120, 17], ['Điện áp đo', 430, 45], ['Sơ đồ đo', 500, 40]]);
  at(page1, 603, [['3.1', 220, 12], ['3.2', 300, 12], ['(kV)', 440, 20]]);
  at(page1, 585, [['Số chế tạo (Serial N0)', 40, 100], ['BU-31', 215, 25], ['BU-32', 295, 25]]);
  at(page1, 565, [['tgδ (%)', 150, 30], ['0.321', 215, 25], ['0.309', 295, 25], ['10', 440, 10], ['UST', 505, 20]]);
  at(page1, 550, [['Trị số tgδ sứ quy đổi về 20oC (tgδ of bushings corrected to 20oC); Loại sứ: OIP ; Hệ số quy đổi K = 1.15', 40, 450]]);
  at(page1, 530, [['5.4 Thử điện áp xoay chiều tăng cao (A.C high voltage testing):', 40]]);
  // 11 biến dòng chân sứ: phía cao áp 5 cuộn, chỉ cột "Pha A"
  at(page1, 400, [['11. Kiểm tra biến dòng chân sứ (Bushing type current transformer testing):', 40]]);
  at(page1, 385, [['11.2.1 Phía cao áp (H.V).', 40]]);
  at(page1, 370, [['b. Biến dòng có 5 cuộn nhị thứ.', 40]]);
  at(page1, 355, [['Cuộn dây', 60, 40], ['Pha A', 300, 27]]);
  [1, 2, 3, 4, 5].forEach((w, i) => at(page1, 340 - i * 14, [[`Thứ cấp ${w} – (TC khác + Vỏ)`, 40, 230], [String(1000 + w), 305, 20]]));
  at(page1, 250, [['11.3. Đặc tính từ hoá (Excitation curve).', 40]]);
  return [page0, page1];
}

test('đọc BBTN cũ theo pha (PDF): nhận mẫu theo pha, bìa 2 cột, cột sứ theo nhãn, sứ hạ áp 3.1 / 3.2, BCT 5 cuộn', () => {
  const ctx = load(DOMAIN);
  const r = ctx.MbaPdfImportReport.read(fakePdf(), 'gia.pdf');
  const { v, cfg } = r.state;
  assert.equal(r.layout, '1P');
  assert.equal(cfg.template, 'A');
  assert.equal(v['meta.type'], 'KIEU-500');
  assert.equal(v['meta.power'], '300/300/60 MVA');
  assert.equal(v['meta.voltage'], '(500/√3)/225/√3/35kV');
  assert.equal(v['b.hv.meas.serial.A'], 'BU-1');
  assert.equal(v['b.hv.meas.type.A'], 'ETA-550/1600-4', 'ghép kiểu sứ ngắt dòng sau gạch nối');
  assert.equal(v['b.hv.meas.manuf.A'], 'Hãng Y', 'không lẫn nhãn hàng');
  assert.equal(v['b.hv.meas.tgd1.A'], '0.394');
  assert.equal(v['b.hv.meas.c1.A'], '721.26');
  assert.equal(v['b.hv.meas.serial.B'], undefined);
  assert.deepEqual([v['b.lv.meas.serial.a'], v['b.lv.meas.serial.b']], ['BU-31', 'BU-32']);
  assert.deepEqual([v['b.lv.meas.tgd1.a'], v['b.lv.meas.tgd1.b']], ['0.321', '0.309']);
  assert.equal(v['b.lv.btype'], 'OIP');
  assert.equal(cfg.bctCores.hv, 5);
  assert.deepEqual([1, 2, 3, 4, 5].map(w => v[`bct.hv.ir.w${w}.A`]), ['1001', '1002', '1003', '1004', '1005']);
  assert.ok(r.warnings.some(w => /máy 1 pha 500 kV — pha A/.test(w)));
});

test('mẫu chung 3 pha → BBTN riêng từng pha: sứ hạ áp 3.1 / 3.2 của máy vào cột a / b, không lấy sứ máy khác', () => {
  const ctx = load(CORE); T.ctx = ctx;
  const cfg3 = Object.assign(T(ctx).defaultCfg(), { template: '3P', ps: { A: 'SN-A', B: 'SN-B', C: 'SN-C' } });
  const src = T(ctx).buildSchema(cfg3);
  const v = { 'meta.serial': 'SN-A', 'b.lv.meas.serial.a': 'LA1', 'b.lv.meas.serial.b': 'LB1', 'b.lv2.meas.serial.b': 'LB2', 'b.lv.meas.tgd1.b': '0,3', 'b.lv2.meas.tgd1.b': '0,4',
    'b.hv.meas.serial.A': 'HA', 'b.hv.meas.serial.B': 'HB' };
  const tgtCfg = Object.assign(T(ctx).defaultCfg(), { template: 'B', topology: 'bank1p' });
  const out = ctx.MbaReport.phaseState({ type: 'MBA', v, cfg: cfg3, sum: { tick: {}, ev: {} }, att: {} }, src, T(ctx).buildSchema(tgtCfg), 'B').v;
  assert.equal(out['meta.serial'], 'SN-B');
  assert.deepEqual([out['b.lv.meas.serial.a'], out['b.lv.meas.serial.b'], out['b.lv.meas.serial.c']], ['LB1', 'LB2', undefined]);
  assert.deepEqual([out['b.lv.meas.tgd1.a'], out['b.lv.meas.tgd1.b']], ['0,3', '0,4']);
  assert.deepEqual([out['b.hv.meas.serial.A'], out['b.hv.meas.serial.B']], [undefined, 'HB']);
});
