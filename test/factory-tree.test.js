// Cây số liệu xuất xưởng (Trạm → Ngăn → Thiết bị → Số chế tạo), tìm nhanh, tính dòng cập nhật khi sửa tay. Số liệu giả.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');

const ctx = load(CORE.concat(['js/domain/factory-tree.js']));
const FT = ctx.FactoryTree;
const J = x => JSON.parse(JSON.stringify(x));

const equipment = [
  { id: 'e1', class_code: 'MBA', class_name: 'Máy biến áp', name: 'MBA AT1 pha A', serial_no: 'SN-A', phase: 'A', substation_name: 'Trạm Thử Nghiệm', bay_code: 'AT1', bay_name: 'Ngăn MBA AT1' },
  { id: 'e1s', class_code: 'SU', class_name: 'Sứ xuyên', serial_no: 'BU-11', position: '1.1', parent_id: 'e1', substation_name: 'Trạm Thử Nghiệm', bay_code: 'AT1' },
  { id: 'e2', class_code: 'MBA', class_name: 'Máy biến áp', name: '', serial_no: 'SN-B', substation_name: 'Trạm Thử Nghiệm', bay_code: 'AT2' },
  { id: 'e3', class_code: 'MBA', class_name: 'Máy biến áp', name: 'MBA chưa gắn', serial_no: 'SN-X' },
  { id: 'e4', class_code: 'MBA', name: 'MBA không có FAT', serial_no: 'SN-Z', substation_name: 'Trạm Thử Nghiệm', bay_code: 'AT1' },
];
const sessions = [
  { id: 's1', equipment_id: 'e1', serial_no: 'SN-A', test_date: '2019-01-10', kind: 'FAT' },
  { id: 's1b', equipment_id: 'e1', serial_no: 'SN-A', test_date: '2018-05-01', kind: 'FAT' },
  { id: 's2', equipment_id: 'e2', serial_no: 'SN-B', test_date: '2019-02-10', kind: 'FAT' },
  { id: 's3', equipment_id: 'e3', serial_no: 'SN-X', test_date: '2020-03-01', kind: 'FAT' },
];
const local = [{ name: 'tr-thu.xlsx', units: [{ serial: 'SN-A', phase: 'A' }, { serial: 'SN-C', phase: 'C' }] }];

test('cây Trạm → Ngăn → Thiết bị → Số chế tạo; nhóm chưa gắn trạm; file trên máy chỉ các máy chưa có trong CSDL', () => {
  const tree = J(FT.build(equipment, sessions, local));
  assert.deepEqual(tree.map(n => [n.type, n.label]), [['station', 'Trạm Thử Nghiệm'], ['station', 'Chưa gắn trạm / ngăn'], ['group', 'Chưa lưu CSDL (file trên máy này)']]);
  const st = tree[0];
  assert.deepEqual(st.children.map(b => b.label), ['AT1', 'AT2']);
  const at1 = st.children[0];
  assert.deepEqual(at1.children.map(c => c.label), ['MBA AT1 pha A', 'MBA không có FAT'], 'thiết bị chưa có FAT vẫn hiện');
  const noFat = at1.children[1];
  assert.equal(noFat.noFat, true);
  assert.equal(noFat.sessionId, '');
  assert.match(noFat.sub, /chưa có test report/);
  const eq = at1.children[0];
  assert.equal(eq.label, 'MBA AT1 pha A');
  assert.equal(eq.sessionId, 's1', 'lấy lần FAT mới nhất');
  assert.deepEqual(eq.children.map(c => [c.label, c.sub]), [['SN-A', 'Máy chính'], ['BU-11', 'Sứ xuyên · đầu 1.1']]);
  assert.equal(st.children[1].children[0].label, 'Máy biến áp SN-B', 'không có tên → loại + số chế tạo');
  assert.equal(tree[1].children[0].label, 'MBA chưa gắn', 'chưa gắn ngăn: thiết bị nằm thẳng dưới nhóm');
  assert.deepEqual(tree[2].children[0].children.map(u => u.label), ['SN-C']);
  assert.deepEqual(FT.leaves(eq).map(l => l.label), ['SN-A', 'BU-11']);
});

test('khung danh mục: trạm, ngăn chưa có thiết bị vẫn hiện', () => {
  const cat = { substations: [{ id: 'S1', name: 'Trạm Thử Nghiệm' }, { id: 'S2', name: 'Trạm Trống' }],
    bays: [{ id: 'B9', substation_id: 'S1', code: 'AT9', name: 'Ngăn dự phòng' }, { id: 'B8', substation_id: 'S2', code: '171' }] };
  const tree = J(FT.build(equipment, sessions, [], cat));
  assert.deepEqual(tree.map(n => n.label), ['Trạm Thử Nghiệm', 'Trạm Trống', 'Chưa gắn trạm / ngăn']);
  assert.deepEqual(tree[0].children.map(b => [b.label, b.sub, b.children.length]), [['AT1', 'Ngăn MBA AT1', 2], ['AT2', '', 1], ['AT9', 'Ngăn dự phòng', 0]]);
  assert.deepEqual(tree[1].children.map(b => b.label), ['171']);
});

test('tìm nhanh không phân biệt hoa thường / dấu, mở nhánh cha', () => {
  const tree = FT.build(equipment, sessions, local);
  let r = FT.filter(tree, 'bu-11');
  assert.deepEqual(J(r.tree).map(n => n.label), ['Trạm Thử Nghiệm']);
  assert.deepEqual([...r.open].sort(), ['bay:Trạm Thử Nghiệm|AT1', 'eq:e1', 'st:Trạm Thử Nghiệm']);
  r = FT.filter(tree, 'tram thu nghiem');
  assert.equal(J(r.tree)[0].children.length, 2, 'khớp trạm: giữ nguyên các ngăn');
  r = FT.filter(tree, 'chua gan');
  assert.equal(J(r.tree)[0].label, 'Chưa gắn trạm / ngăn');
  assert.equal(J(FT.filter(tree, 'khong-co').tree).length, 0);
  assert.equal(FT.filter(tree, '  ').tree, tree);
});

test('sửa tay: bỏ dòng không đổi, co giãn value_norm, ghi chú người sửa, báo giá trị sai', () => {
  const rows = [
    { id: 1, value: 0.25, value_norm: 0.2, note: null },
    { id: 2, value: 1200, value_norm: null, note: 'Nhãn sứ' },
    { id: 3, value: 5, value_norm: null, note: null },
    { id: 4, value: null, value_text: 'Đạt', note: null },
    { id: 5, value: 7, note: null },
  ];
  const { updates, errors } = FT.editDiff(rows, { 1: '0,3', 2: '1200', 3: 'abc', 4: 'Không đạt', 5: '' }, { who: 'nguoi.sua', date: '2026-11-18' });
  assert.deepEqual(J(errors), [{ id: 3, msg: '“abc” không phải số' }, { id: 5, msg: 'Không để trống giá trị xuất xưởng' }]);
  assert.deepEqual(J(updates), [
    { id: 1, value: 0.3, value_text: null, value_norm: 0.24, note: 'Sửa tay 18/11/2026 – nguoi.sua: 0.25 → 0.3' },
    { id: 4, value: null, value_text: 'Không đạt', value_norm: null, note: 'Sửa tay 18/11/2026 – nguoi.sua: Đạt → Không đạt' },
  ]);
  // ghi chú cũ được giữ, nối thêm
  const r2 = FT.editDiff([{ id: 9, value: 10, note: 'Nhãn sứ' }], { 9: '11' }, { who: 'a', date: '2026-01-02' }).updates[0];
  assert.equal(r2.note, 'Nhãn sứ; Sửa tay 02/01/2026 – a: 10 → 11');
});
