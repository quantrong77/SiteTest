'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, DOMAIN } = require('./harness');
test('đọc danh mục theo tên cột, ưu tiên và trạng thái', () => {
  const { Library } = load(DOMAIN);
  const rows = [['Ghi chú', 'Trạng thái', 'Tên tiêu chuẩn (tiếng Anh)', 'Số hiệu', 'Ưu tiên (★★★)', 'STT', 'Nhóm thiết bị', 'Phiên bản (năm)', 'Nội dung chính', 'Dùng cho (hạng mục / app)', 'TCVN tương đương'], ['ghi chú giả', 'Đã có bản cũ', 'Tiêu chuẩn giả A', 'IEC 000', '★★★', 1, 'MBA', 2024, 'Nội dung giả', 'Mục 2 không tải', 'TCVN giả']];
  const docs = Library.parseCatalog(rows);
  assert.equal(docs.length, 1); assert.equal(docs[0].priority, 3); assert.equal(docs[0].status, 'old'); assert.equal(docs[0].code, 'IEC 000');
});
test('liên kết hạng mục theo số và từ khóa, nhóm và sắp xếp tài liệu', () => {
  const { Library } = load(DOMAIN);
  const sections = [{ id: 'dcr', no: 7, title: 'Điện trở một chiều' }, { id: 'ratio', no: 8, title: 'Tỷ số biến' }];
  assert.deepEqual(Array.from(Library.sectionsFromText('Mục 2 không tải, 7 R một chiều, 8 tỷ số', sections)), ['dcr', 'ratio']);
  const docs = [{ kind: 'standard', code: 'B', priority: 1, sections: ['dcr'] }, { kind: 'standard', code: 'A', priority: 3, sections: ['dcr'] }, { kind: 'manual', code: 'M', priority: 1, sections: [], class_codes: ['MBA'] }];
  const got = Library.forSection(docs, 'dcr', 'MBA'); assert.deepEqual(Array.from(got.standard, x => x.code), ['A', 'B']); assert.equal(got.manual.length, 1);
  // tiêu chuẩn chung (chưa gắn hạng mục) không hiện ở khung tham khảo
  assert.equal(Library.forSection(docs.concat([{ kind: 'standard', code: 'G', sections: [], class_codes: ['MBA'] }]), 'dcr', 'MBA').standard.length, 2);
});

test('nhóm thiết bị trong danh mục ánh xạ sang mã loại MBA', () => {
  const { Library } = load(DOMAIN);
  assert.deepEqual(Array.from(Library.classCodesOf('Máy biến áp')), ['MBA']);
  assert.deepEqual(Array.from(Library.classCodesOf('Dầu cách điện…')), ['MBA']);
  assert.deepEqual(Array.from(Library.classCodesOf('Máy cắt')), []);
});

test('merge Excel giữ chỉnh sửa thủ công và bỏ qua dòng không đổi', () => {
  const { Library } = load(DOMAIN);
  const existing = [{ id: 'doc-1', kind: 'standard', code: 'IEC 1', edition: '2020', title: 'Tên cũ', sections: ['admin-picked'], summary_md: 'Tóm tắt', file_path: 'doc-1/a.pdf', file_name: 'a.pdf', size_bytes: 10, class_codes: ['MBA'], status: 'have', note: 'ghi chú cũ' }];
  const incoming = [{ kind: 'standard', code: ' iec  1 ', edition: ' 2020 ', title: 'Tên mới', scope: 'Phạm vi', sections: [], class_codes: [], status: 'missing', note: '', _sectionsText: 'Mục 7' }];
  const result = Library.mergeImport(existing, incoming, [{ id: 'auto', no: 7, title: 'Hạng mục' }]);
  assert.equal(result.updated, 1);
  assert.equal(result.rows[0].id, 'doc-1');
  assert.deepEqual(Array.from(result.rows[0].sections), ['admin-picked']);
  assert.equal(result.rows[0].status, 'have');
  assert.equal(result.rows[0].summary_md, 'Tóm tắt');
  assert.equal(result.rows[0].file_path, 'doc-1/a.pdf');
  assert.equal(result.rows[0].title, 'Tên mới');
  const same = Library.mergeImport(result.rows, [Object.assign({}, incoming[0], { title: 'Tên mới', scope: 'Phạm vi', note: null })], []);
  assert.equal(same.unchanged, 1);
  assert.equal(same.rows.length, 1);
});

test('nhập Excel: dòng trùng khóa chỉ tính một lần (dòng sau thắng); khóa có ký tự | không đụng nhau', () => {
  const { Library } = load(DOMAIN);
  const a = { kind: 'standard', code: 'IEC 1', edition: '2000', title: 'Cũ', status: 'missing' };
  const r = Library.mergeImport([], [a, Object.assign({}, a, { code: ' iec 1 ', title: 'Mới' })], []);
  assert.deepEqual([r.rows.length, r.added, r.duplicates, r.rows[0].title], [1, 1, 1, 'Mới']);
  const x = Library.mergeImport([{ id: '1', kind: 'standard', code: 'A|B', edition: '', title: 't', status: 'missing' }],
    [{ kind: 'standard', code: 'A', edition: 'B|', title: 't2', status: 'missing' }], []);
  assert.equal(x.added, 1);
});
