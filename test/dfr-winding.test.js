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
  eq(table.rows.map(r => r.slice(0, 2)), [['CHT (cao áp – vỏ)', 'Pha A'], ['CHT (cao áp – vỏ)', 'Pha B']]);
  assert.equal(table.rows[0][4], '2,500'); // tgδ tại 50 Hz (điểm đo đúng 50 Hz)
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
