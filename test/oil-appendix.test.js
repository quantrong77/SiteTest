'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, DOMAIN } = require('./harness');
const { Appendix } = load(DOMAIN);
const same = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);

test('oilSummary nhận dạng DGA, lý hóa và file lạ, trích thông tin và kết luận', () => {
  const dga = Appendix.oilSummary([
    { style: 'Title', text: 'BIÊN BẢN THÍ NGHIỆM PHÂN TÍCH KHÍ HÒA TAN TRONG DẦU CÁCH ĐIỆN' },
    { style: 'Normal', text: 'Số chế tạo (Serial No): MBA-GIA-01' },
    { style: 'Normal', text: 'Ngày lấy mẫu (Date of sampling): 15/11/2026' },
    { style: 'Normal', text: 'Tên dự án/tên trạm (Project): Trạm Giả' },
    { style: 'Normal', text: 'KẾT LUẬN (Conclusion): Kết quả bình thường.' },
    { style: 'Normal', text: 'Không phát hiện khí bất thường.' },
    { style: 'Normal', text: 'Hà Nội, ngày 15 tháng 11 năm 2026' },
    { style: 'Normal', text: 'Dòng ký tên không lấy' },
  ]);
  assert.equal(dga.kind, 'dga');
  assert.equal(dga.serial, 'MBA-GIA-01');
  assert.equal(dga.sampleDate, '15/11/2026');
  assert.equal(dga.project, 'Trạm Giả');
  same(dga.conclusion, ['Kết quả bình thường.', 'Không phát hiện khí bất thường.']);
  // BBTN lý hóa dầu: dòng ngày ghi "(Date)"; BBTN DGA của app có thể để trống số chế tạo
  const oil = Appendix.oilSummary([{ style: '', text: 'BIÊN BẢN THÍ NGHIỆM DẦU CÁCH ĐIỆN' }, { style: '', text: 'Số chế tạo (Serial No):' },
    { style: '', text: 'Ngày lấy mẫu (Date): 02/11/2026' }]);
  assert.equal(oil.kind, 'oil');
  assert.equal(oil.sampleDate, '02/11/2026');
  assert.equal(oil.serial, '');
  assert.equal(Appendix.oilSummary([{ style: '', text: 'Tài liệu khác' }]).kind, null);
});

test('serialMatch chuẩn hóa hoa thường và khoảng trắng; dgaLink mã hóa serial', () => {
  assert.equal(Appendix.serialMatch('ab 12', ['AB12', 'C']), true);
  assert.equal(Appendix.serialMatch('', ['AB12']), false);
  assert.equal(Appendix.dgaLink('A B/Đ?'), 'https://quantrong77.github.io/dga-webapp/?serial=A%20B%2F%C4%90%3F');
  assert.equal(Appendix.dgaLink(''), Appendix.DGA_URL);
});

test('list xếp phụ lục dầu sau DFR, bỏ file tắt/thiếu, giữ kết quả cũ nếu không có dầu', () => {
  const state = { att: { oltc: { A: {} }, fra: { id: 'f' }, dfr: { items: [{ use: true }] },
    oil: { items: [{ id: 'o1', use: true }, { id: 'o2', use: false }] } } };
  const list = Appendix.list(state, { fra: true, oil: new Set(['o1']), bct: true });
  same(list.map(x => x.kind), ['oltc', 'fra', 'dfr', 'oil', 'bct']);
  same(list.map(x => x.label), ['PHỤ LỤC 1', 'PHỤ LỤC 2', 'PHỤ LỤC 3', 'PHỤ LỤC 4', 'PHỤ LỤC 5']);
  const oldState = { att: { oltc: { A: {} }, fra: { id: 'f' }, dfr: { items: [{ use: true }] } } };
  same(Appendix.list(oldState, { fra: true, bct: true }), [
    { kind: 'oltc', label: 'PHỤ LỤC 1' }, { kind: 'fra', label: 'PHỤ LỤC 2' },
    { kind: 'dfr', label: 'PHỤ LỤC 3' }, { kind: 'bct', label: 'PHỤ LỤC 4' },
  ]);
});
