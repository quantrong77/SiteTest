// Phụ lục BBTN: tóm tắt báo cáo SFRA Analyzer (đoạn văn theo cấu trúc docxBuilder của SFRA), đánh số phụ lục.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');

const same = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);

const OUTLINE = [
  { style: '', text: 'BÁO CÁO PHÂN TÍCH SFRA – MBA X – TBA Y' },
  { style: '', text: 'Baseline 10/05/2026 – Lần đo 14/05/2026' },
  { style: 'Heading1', text: '1. Thông tin chung' },
  { style: 'Heading1', text: '3. Bảng tổng hợp kết quả' },
  { style: 'Heading1', text: '4. Chi tiết từng phép đo' },
  { style: 'Heading2', text: '4.1. Phép đo 1 – HV A-N (hở mạch)' },
  { style: 'Heading2', text: '4.2. Phép đo 2 – HV B-N (hở mạch)' },
  { style: 'Heading1', text: '5. Kết luận' },
  { style: '', text: 'Các cuộn dây không có biến dạng theo DL/T 911-2004.' },
  { style: '', text: 'Đề nghị lưu làm baseline.' },
  { style: 'Heading1', text: '6. Tài liệu tham khảo' },
  { style: '', text: '[1] DL/T 911-2004' },
];

test('tóm tắt báo cáo SFRA: tiêu đề, số phép đo, kết luận', () => {
  const { Appendix } = load(CORE);
  same(Appendix.fraSummary(OUTLINE), {
    title: 'BÁO CÁO PHÂN TÍCH SFRA – MBA X – TBA Y', measurements: 2,
    conclusion: ['Các cuộn dây không có biến dạng theo DL/T 911-2004.', 'Đề nghị lưu làm baseline.'], isSfra: true,
  });
  assert.equal(Appendix.fraSummary([{ style: '', text: 'Hợp đồng mua bán' }]).isSfra, false);
});

test('đánh số phụ lục: một phụ lục không đánh số, hai phụ lục đánh 1, 2; thiếu file SFRA thì bỏ', () => {
  const { Appendix } = load(CORE);
  const oltc = { A: { rows: [{}], waves: [] } }, fra = { id: 'fra-1', name: 'SFRA.docx' };
  same(Appendix.list({ att: { oltc } }), [{ kind: 'oltc', label: 'PHỤ LỤC' }]);
  same(Appendix.list({ att: { oltc, fra } }), [{ kind: 'oltc', label: 'PHỤ LỤC 1' }, { kind: 'fra', label: 'PHỤ LỤC 2' }]);
  same(Appendix.list({ att: { oltc, fra } }, { fra: false }), [{ kind: 'oltc', label: 'PHỤ LỤC' }]);
  same(Appendix.list({ att: {} }), []);
  assert.equal(Appendix.fraHeader('PHỤ LỤC 2', fra)[1].text, 'PHỤ LỤC 2');
});
