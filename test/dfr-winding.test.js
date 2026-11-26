'use strict';
// DFR cách điện cuộn dây (mục độ ẩm cách điện rắn): nhận dạng CHL / CLT / CHT, pha, chọn lần đo, phụ lục BBTN. Số liệu giả.
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
// mảng tạo trong vm của harness khác realm → chuyển về giá trị thường trước khi so
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);

const fs = [0.001, 0.01, 0.1, 1, 10, 50, 100, 1000];
const meas = (name, date, extra = {}) => Object.assign({ name, date, temp: '25', file: 'fake.csv', serial: '', f: fs.slice(), tan: fs.map((f, i) => 5 - i * 0.5), c: fs.map(() => 20000) }, extra);
const csv410 = names => ['[DIRANA CSV]', 'Version,Decimal', '4.10,point', '', '[Test]', 'Name,Comment', 'Fake,""', '',
  '[Measurements]', 'ID,Name,Date,Color,Temperature,Channel', ...names.map((n, i) => `${i + 1},${n},18/03/2026 0${i}:10:00,,23.5,CH1`), '',
  '[FrequencySweeps]', 'ID,Frequency,Tangent Delta,Power Factor,C(Real),C(Imag)',
  ...names.flatMap((n, i) => ['0.001,4,4', '50,0.4,0.4', '1000,0.7,0.7'].map(r => `${i + 1},${r.split(',')[0]},${r.split(',')[1]},${r.split(',')[2]},2E-08,-1E-10`))].join('\n');

test('nhận dạng cách điện và pha theo tên phép đo / tên file', () => {
  const { DfrW } = load(CORE);
  eq(['CHL', 'CLT', 'CHT_A', 'cht pha b', 'Ch1', 'XCHLY'].map(DfrW.insOf), ['CHL', 'CLT', 'CHT', 'CHT', '', '']);
  eq(['CHT_A', 'CHT pha B', 'CHT-c', 'CHL', 'AT1 C.csv', 'DIRANA Sample Job.csv'].map(DfrW.phaseIn), ['A', 'B', 'C', '', 'C', '']);
});

test('pha mặc định: BBTN theo pha → pha của mẫu; tổ 1 pha → khớp số chế tạo; MBA 3 pha chung → 3 pha', () => {
  const { DfrW } = load(CORE);
  assert.equal(DfrW.defaultPhase(meas('CHT'), { topology: 'bank1p', template: 'B' }), 'B');
  assert.equal(DfrW.defaultPhase(meas('CHT', '', { serial: 'SN-PC' }), { topology: 'bank1p', template: '3P', ps: { A: 'SN-PA', B: 'SN-PB', C: 'SN-PC' } }), 'C');
  assert.equal(DfrW.defaultPhase(meas('CHT'), { topology: 'threePhase', template: '220' }), '');
  assert.equal(DfrW.defaultPhase(meas('CHT_A'), { topology: 'threePhase' }), 'A');
});

test('đọc CSV DIRANA 4.x có nhiệt độ; gộp lần nạp tự chọn lần đo muộn từng nhóm cách điện|pha', () => {
  const { Dirana, DfrW } = load(CORE);
  const parsed = Dirana.parse(csv410(['CHL', 'CLT', 'Ch1']), 'fake.csv');
  assert.equal(parsed[0].temp, '23.5');
  let n = 0; const id = () => `id${++n}`, cfg = { topology: 'threePhase' };
  let items = DfrW.merge([], parsed, id, cfg);
  eq(items.map(x => [x.name, x.ins, x.phase, x.use]), [['CHL', 'CHL', '', true], ['CLT', 'CLT', '', true], ['Ch1', '', '', false]]);
  // nạp thêm lần đo CHL muộn hơn → lần mới được dùng, lần cũ bỏ chọn; nạp lại cùng file giữ id
  items = DfrW.merge(items, [meas('CHL', '19/03/2026 08:00:00', { file: 'later.csv' })], id, cfg);
  eq(items.filter(x => x.ins === 'CHL').map(x => [x.file, x.use]), [['fake.csv', false], ['later.csv', true]]);
  const again = DfrW.merge(items, parsed, id, cfg);
  assert.equal(again[0].id, items[0].id);
  // chọn tay: giữ khi nạp lại
  items[0].useManual = true; items[0].use = true; items[3].useManual = true; items[3].use = false;
  const kept = DfrW.merge(items, parsed, id, cfg);
  assert.equal(kept[0].use, true);
});

test('phụ lục: bảng 50 Hz ghi cách điện, pha; đồ thị theo từng cách điện; tách pha giữ phép đo của pha', () => {
  const { DfrW } = load(CORE);
  const items = [Object.assign(meas('CHT_A', '18/03/2026'), { id: 'a', ins: 'CHT', phase: 'A', use: true }),
    Object.assign(meas('CHT_B', '18/03/2026'), { id: 'b', ins: 'CHT', phase: 'B', use: true }),
    Object.assign(meas('CHT_C', '18/03/2026'), { id: 'c', ins: 'CHT', phase: 'C', use: false })];
  const state = { att: { dfrw: { items } } };
  assert.ok(DfrW.has(state));
  eq(DfrW.chosen(items).map(DfrW.title), ['CHT – Pha A', 'CHT – Pha B']);
  const img = { png: new Uint8Array(1), w: 1, h: 1 };
  const blocks = DfrW.appendix(state, { dfrwCharts: { CHT: { individual: [img, img], overlay: img } } }, x => x, 'PHỤ LỤC 2');
  const table = blocks.find(b => b.type === 'table');
  eq(table.rows.map(r => r.slice(0, 2)), [['CHT', 'Pha A'], ['CHT', 'Pha B']]);
  assert.equal(table.rows[0][7], '2,500'); // tgδ tại 50 Hz (điểm đo đúng 50 Hz)
  assert.ok(blocks.some(b => b.text === 'II.1 CHT (cao áp – vỏ)'));
  assert.equal(blocks.filter(b => b.type === 'images').length, 2);
  // MBA 3 cuộn dây, 3 pha chung: CHL, CLT không ghi pha → "3 pha"
  const three = [Object.assign(meas('CLT', '1/1/2026'), { id: 'x', ins: 'CLT', phase: '', use: true }), Object.assign(meas('CHL', '1/1/2026'), { id: 'y', ins: 'CHL', phase: '', use: true })];
  eq(DfrW.chosen(three).map(DfrW.title), ['CHL – 3 pha', 'CLT – 3 pha']);
  eq(DfrW.forPhase(items.concat(three), 'B').map(x => x.id), ['b', 'x', 'y']);
  eq(DfrW.appendix({ att: {} }, {}, x => x, ''), []);
});

test('danh sách phụ lục có DFR cuộn dây khi có phép đo được dùng', () => {
  const { Appendix } = load(CORE);
  const st = { cfg: {}, att: { dfrw: { items: [Object.assign(meas('CHL', '1/1/2026'), { ins: 'CHL', phase: '', use: true })] } } };
  eq(Appendix.list(st).map(a => a.kind), ['dfrw']);
  st.att.dfrw.items[0].use = false;
  eq(Appendix.list(st).map(a => a.kind), []);
});

test('đồ thị cuộn dây: trục tgδ logarit, dải tần theo số liệu, nhãn µ/m/k', () => {
  const c = load(CORE.concat(['js/ui/types/mba/dfr-chart.js']));
  eq(c.DfrChart.fRangeOf([{ f: [1e-5, 0.5, 1012] }]), [1e-5, 1e4]);
  eq([1e-5, 1e-3, 0.1, 1, 1000, 10000].map(c.DfrChart.fLabel), ['10µ', '1m', '100m', '1', '1k', '10k']);
  const texts = [];
  const g = new Proxy({}, { get: (o, k) => k === 'measureText' ? t => ({ width: t.length * 12 }) : k === 'fillText' ? t => texts.push(t) : k in o ? o[k] : () => {}, set: (o, k, v) => { o[k] = v; return true; } });
  c.DfrChart.draw({ getContext: () => g }, [{ phase: '', f: [1e-4, 1, 1000], tan: [80, 0.5, 0.7] }], false, { logY: true, fAuto: true, title: 'CHL – 3 pha' });
  ['0,1', '1', '10', '100', '100µ', '1k', 'CHL – 3 pha'].forEach(t => assert.ok(texts.includes(t), t));
});

test('khối ảnh phụ lục (2 ảnh/hàng): lưới bảng đủ cột, không lọt chuỗi "/> vào văn bản', () => {
  const { DocxTemplate } = load(CORE.concat(['js/data/docx.js']));
  const xml = DocxTemplate.prototype.blockXml.call({ imageXml: () => '<w:p/>' }, { type: 'images', perRow: 2, widthCm: 8, items: [{ caption: 'Đo 1' }, { caption: 'Đo 2' }] });
  assert.equal((xml.match(/<w:gridCol /g) || []).length, 2);
  assert.ok(!xml.replace(/<[^>]*>/g, '').includes('"/>'));
});


// Định dạng file DIRANA 4.10 xuất từ máy (tên phép đo chỉ ghi pha, kiểu đối tượng MBA tự ngẫu, ngày dạng 26-Nov-26 2:08:37 PM)
const at2 = (rows = true) => ['[DIRANA CSV]', 'Version,Decimal', '4.10,point', '', '[Test]',
  'Name,Comment,Test Object Serial,Test Object Type,Location,Tester,InsulationMedium,FDS Voltage,PDC Voltage,Firmware Version,UniqueId',
  'PHA A,"",FAKE-1/2/3,AutoTransformerTertiary,FAKE,FAKE,,200,200,0,x', '',
  '[Measurements]', 'ID,Name,Date,Color,Temperature,Channel,EpsilonR,MeasId,CopyForComparison,ParentTestId',
  '1,PHA C,26-Nov-26 2:08:37 PM,,24,CH1,2.2,0,False,x', '',
  '[FrequencySweeps]', 'ID,Frequency,Tangent Delta,Power Factor,C(Real),C(Imag)',
  ...(rows ? ['1,1E-05,500,99,3E-08,-1.5E-07', '1,50,0.4,0.4,2E-08,-8E-11', '1,1000,0.6,0.6,1.99E-08,-1.2E-10'] : []), '',
  '[PolarizationSweeps]', 'ID,Time,Current'].join('\n');

test('DIRANA 4.10 dạng AT2: ngày 26-Nov-26 PM, kiểu MBA tự ngẫu → CHT, pha theo tên "PHA C", C″', () => {
  const { Dirana, DfrW } = load(CORE);
  assert.equal(Dirana.normDate('26-Nov-26 2:08:37 PM'), '26/11/2026 14:08:37');
  assert.equal(Dirana.normDate('1-Jan-2026 12:05:00 AM'), '01/01/2026 00:05:00');
  assert.equal(Dirana.normDate('18/03/2026 08:52:36'), '18/03/2026 08:52:36');
  const [m] = Dirana.parse(at2(), 'AT.csv');
  eq([m.name, m.date, m.temp, m.objType], ['PHA C', '26/11/2026 14:08:37', '24', 'AutoTransformerTertiary']);
  assert.ok(Math.abs(m.ci[1] - 80) < 1e-9);
  const [w] = DfrW.merge([], [m], () => 'id1', { topology: 'threePhase', template: '110' });
  eq([w.ins, w.phase, w.use], ['CHT', 'C', true]);
  // tên chỉ ghi pha, không có kiểu đối tượng: tổ 3 máy 1 pha rời → CHT; MBA 3 pha khác → chọn tay
  assert.equal(DfrW.insFor({ name: 'PHA B' }, { topology: 'bank1p' }), 'CHT');
  assert.equal(DfrW.insFor({ name: 'PHA B' }, { topology: 'threePhase' }), '');
  assert.throws(() => Dirana.parse(at2(false), 'AT2.csv'), /có 1 phép đo \(PHA C\) nhưng \[FrequencySweeps\] không có số liệu/);
});

test('tần số con trỏ 50 Hz: tgδ, C (nF), |Z| = 1/(ω·|C*|); độ ẩm theo ô của mục, phân loại Điều 28, độ dẫn dầu', () => {
  const { Dirana, DfrW } = load(CORE);
  const [p] = Dirana.parse(at2(), 'AT.csv');
  const v = DfrW.cursor(p, 50);
  assert.ok(Math.abs(v.tan - 0.4) < 1e-12 && Math.abs(v.cNF - 20) < 1e-9);
  assert.ok(Math.abs(v.zK - 1 / (2 * Math.PI * 50 * Math.hypot(20e-9, 80e-12)) / 1000) < 1e-9);
  assert.equal(DfrW.cursor(p, 5000), null);
  assert.equal(DfrW.moistKey({ template: '3P' }, 'C'), 'moist.r.C');
  assert.equal(DfrW.moistKey({ template: 'C' }, 'C'), 'moist.val');
  assert.equal(DfrW.moistKey({ template: '3P' }, ''), 'moist.val');
  const m = Object.assign({}, p, { id: 'c', ins: 'CHT', phase: 'C', use: true, oilCond: '1.25' });
  const state = { cfg: { template: '3P' }, v: { 'moist.r.C': '2,9' }, att: { dfrw: { items: [m] } } };
  assert.equal(DfrW.moisture(state, m), 2.9);
  assert.match(DfrW.category(2.9), /trung bình/);
  assert.match(DfrW.category(1.5), /khô/);
  assert.equal(DfrW.category(NaN), '');
  const row = DfrW.appendix(state, {}, x => x, 'PL').find(b => b.type === 'table').rows[0];
  eq(row, ['CHT', 'Pha C', '26/11/2026', '24', '2,90', 'độ ẩm trung bình', '1,25', '0,400', '20,00', row[9]]);
  assert.match(row[9], /^159,\d$/);
});

// Workbook giả theo bố cục file Excel DIRANA (Primary Test Manager): Job, Asset, một sheet mỗi phép đo
function fakeWorkbook(XLSX, { moist = 2.6, stop = 'yes', name = 'PHA B', profile = 'H-T', rows = true } = {}) {
  const wb = XLSX.utils.book_new(), add = (n, aoa) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), n);
  add('Job', [['', 'Job'], ['', 'Name', '', 'FAKE'], ['', 'Executed tests'], ['', 'Result state', '', 'Assessment', 'Test name', '', '', 'Date', 'Time'],
    ['', 'Executed', '', '', name, '', '', '26/11/2026', '15:00:08']]);
  add('Asset', [['', 'Transformer'], ['', 'Asset type', '', 'Auto w/ tert'], ['', 'Serial number', '', 'FAKE-SN']]);
  add('Location', [['', 'Location'], ['', 'Name', '', 'FAKE']]);
  add(name, [['', name], ['', 'DIRANA Test'], ['', 'Measurement profile', '', profile, '', 'Measurement sequence', '', 'FDS and PDC+'],
    ['', 'Execution date', '', '26/11/2026'], ['', 'Start frequency', '', '1 kHz', '', 'Oil temperature', '', '23 °C'], ['', 'Measurements'],
    ['', 'Name', '', name, '', 'Channel', '', 1], ['', 'Moisture in cellulose', '', moist, '%', 'Capacitance @ 50 Hz', '', '3.709 nF'],
    ['', 'Moisture category', '', 'moderately wet', '', 'Capacitance @ 60 Hz', '', '3.708 nF'],
    ['', 'Moisture saturation', '', '0 %', '', 'Tan δ / Power factor @ 50 Hz', '', '0.15% / 0.15%'],
    ['', 'Oil conduct.', '', 0.1247, 'pS/m', 'Barriers (X)', '', 17, '%'], ['', 'Oil conduct. @ 20°C', '', 0.106, 'pS/m'],
    ['', 'Oil category', '', 'very good'], ['', 'Max. stop frequency reached', '', stop], [], ['', 'Moisture categories', '', '', '', 'Oil categories'],
    ['', 'dry', '', '< 2.2%'], [], ['', 'Name', name], [], ['', 'Frequency in Hz', 'Dissipation factor', 'Power factor', "C'", "C''"],
    ...(rows ? [['', 0.0001, 96.9, 69.6, 1.74e-8, -1.69e-8], ['', 1, 0.187, 0.187, 3.719e-9, -6.95e-12], ['', 1000, 0.216, 0.216, 3.699e-9, -8e-12]] : [])]);
  return wb;
}

test('Excel DIRANA: profile H-T → CHT, pha theo tên, ngày giờ từ Job, kết quả phân tích, bảng quét', () => {
  const c = load(CORE), { DiranaXlsx, DfrW, XLSX } = c;
  const [m] = DiranaXlsx.parseWorkbook(fakeWorkbook(XLSX), 'fake.xlsx');
  eq([m.name, m.date, m.temp, m.objType, m.profile, m.ins, m.moist, m.moistCat, m.oilCat, m.c50, m.tan50, m.stopReached],
    ['PHA B', '26/11/2026 15:00:08', '23', 'Auto w/ tert', 'H-T', 'CHT', 2.6, 'moderately wet', 'very good', 3709, 0.15, true]);
  eq(m.f, [0.0001, 1, 1000]);
  assert.ok(Math.abs(m.c[1] - 3719) < 1e-6 && Math.abs(m.ci[1] - 6.95) < 1e-9);
  eq([DiranaXlsx.insOfProfile('H-L'), DiranaXlsx.insOfProfile('L-T'), DiranaXlsx.insOfProfile('X')], ['CHL', 'CLT', '']);
  // đọc từ bytes .xlsx như khi nạp file
  const bytes = XLSX.write(fakeWorkbook(XLSX, { name: 'PHA A' }), { type: 'array', bookType: 'xlsx' });
  assert.equal(DiranaXlsx.parse(bytes, 'a.xlsx')[0].name, 'PHA A');
  const [w] = DfrW.merge([], [m], () => 'id', { topology: 'bank1p', template: '3P' });
  eq([w.ins, w.phase, w.use, w.oilCond, w.moist], ['CHT', 'B', true, '0,125', 2.6]);
  // tại 50 Hz: C, tgδ theo DIRANA; |Z| = 1/(ω·C·√(1+tg²δ))
  const v = DfrW.cursor(w, 50);
  assert.equal(v.src, 'DIRANA');
  assert.ok(Math.abs(v.zK - 1 / (2 * Math.PI * 50 * 3709e-12 * Math.hypot(1, 0.0015)) / 1000) < 1e-9);
  // độ ẩm: ô của mục ưu tiên; ô trống → DIRANA; DIRANA 0 % hoặc chưa quét tới tần số dừng → không tự điền
  assert.equal(DfrW.moisture({ cfg: { template: '3P' }, v: {} }, w), 2.6);
  assert.equal(DfrW.moisture({ cfg: { template: '3P' }, v: { 'moist.r.B': '3,1' } }, w), 3.1);
  assert.ok(DfrW.moistUsable(w));
  const [z] = DiranaXlsx.parseWorkbook(fakeWorkbook(XLSX, { moist: 0, stop: 'no' }), 'z.xlsx');
  eq([z.moist, z.stopReached, DfrW.moistUsable(z)], [0, false, false]);
  assert.ok(Number.isNaN(DfrW.moisture({ cfg: {}, v: {} }, z)));
  assert.equal(DfrW.catVi('moderately wet'), 'ẩm trung bình');
  const blocks = DfrW.appendix({ cfg: {}, v: {}, att: { dfrw: { items: [Object.assign(z, { id: 'z', ins: 'CHT', phase: 'B', use: true })] } } }, {}, x => x, 'PL');
  assert.ok(blocks.some(b => /chưa quét tới tần số dừng/.test(b.text || '')));
});

test('Excel DIRANA: không phải file DIRANA, hoặc có phép đo mà không có bảng quét → báo rõ', () => {
  const { DiranaXlsx, XLSX } = load(CORE);
  const other = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(other, XLSX.utils.aoa_to_sheet([['a']]), 'Sheet1');
  assert.throws(() => DiranaXlsx.parseWorkbook(other, 'x.xlsx'), /không phải file Excel DIRANA/);
  assert.throws(() => DiranaXlsx.parseWorkbook(fakeWorkbook(XLSX, { rows: false }), 'y.xlsx'), /có 1 phép đo \(PHA B\) nhưng không có bảng quét tần số/);
});
