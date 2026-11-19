// Khởi tạo BBTN theo danh mục: tổ 3 máy 1 pha / máy đơn trong ngăn; thông số kỹ thuật theo thứ tự CSDL → test report → nhập tay.
// Số liệu giả.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');

const ctx = load(CORE.concat(['js/domain/equipment-specs.js']));
const ES = ctx.EquipmentSpecs;
const J = x => JSON.parse(JSON.stringify(x));

const eqs = [
  { id: 'a', bay_id: 'b1', class_code: 'MBA', phase: 'A', serial_no: 'SN-A', name: 'AT1 pha A' },
  { id: 'b', bay_id: 'b1', class_code: 'MBA', phase: 'B', serial_no: 'SN-B' },
  { id: 'c', bay_id: 'b1', class_code: 'MBA', phase: 'C', serial_no: 'SN-C' },
  { id: 'a1', bay_id: 'b1', class_code: 'SU', parent_id: 'a', serial_no: 'BU-1' },
  { id: 's', bay_id: 'b1', class_code: 'MBA', serial_no: 'SN-DP', name: 'Máy dự phòng' },
  { id: 't', bay_id: 'b2', class_code: 'MBA', serial_no: 'SN-T', phase: '' },
];

test('ngăn: tổ 3 máy 1 pha rời (A/B/C), máy đơn, ngăn trống; bỏ thành phần (sứ)', () => {
  const r = J(ES.bayUnits(eqs, 'b1', 'MBA'));
  assert.deepEqual(Object.keys(r.bank).sort(), ['A', 'B', 'C']);
  assert.equal(r.bank.B.serial_no, 'SN-B');
  assert.deepEqual(r.singles.map(e => e.serial_no), ['SN-DP']);
  const r2 = J(ES.bayUnits(eqs, 'b2', 'MBA'));
  assert.equal(r2.bank, null);
  assert.deepEqual(r2.singles.map(e => e.serial_no), ['SN-T']);
  assert.deepEqual(J(ES.bayUnits(eqs, 'khong-co', 'MBA')), { bank: null, singles: [] });
  // chỉ một máy có pha → không phải tổ
  assert.equal(ES.bayUnits([{ id: 'x', bay_id: 'b3', class_code: 'MBA', phase: 'A', serial_no: 'X' }], 'b3', 'MBA').bank, null);
});

test('thông số: CSDL ưu tiên, test report bù ô thiếu, nối HV/MV/LV', () => {
  const eq = { name: 'AT1 pha A', manufacturer: 'Hãng CSDL', model: '', year_made: 2020, rated: { power_mva: '100/100/30', voltage: '' } };
  const fx = { manufacturer: 'Hãng TR', type: 'KIEU-TR', power: { HV: '90' }, voltage: { HV: '220', MV: '115', LV: '23' }, current: { HV: '262', LV: '' }, vector: 'YNa0d11' };
  const f = J(ES.headFrom(eq, fx, { substation: 'Trạm Thử', bay: 'AT1' }));
  assert.deepEqual(f['meta.project'], { value: 'Trạm Thử', src: 'CSDL' });
  assert.deepEqual(f['meta.site'], { value: 'AT1 pha A', src: 'CSDL' });
  assert.deepEqual(f['meta.manuf'], { value: 'Hãng CSDL', src: 'CSDL' });
  assert.deepEqual(f['meta.type'], { value: 'KIEU-TR', src: 'Test report' }, 'CSDL trống → test report');
  assert.deepEqual(f['meta.year'], { value: '2020', src: 'CSDL' });
  assert.deepEqual(f['meta.power'], { value: '100/100/30', src: 'CSDL' });
  assert.deepEqual(f['meta.voltage'], { value: '220/115/23', src: 'Test report' });
  assert.deepEqual(f['meta.current'], { value: '262', src: 'Test report' });
  assert.deepEqual(f['meta.vector'], { value: 'YNa0d11', src: 'Test report' });
  // thiết bị mới, không có test report → chỉ trạm / ngăn
  assert.deepEqual(Object.keys(J(ES.headFrom(null, null, { substation: 'T', bay: 'N' }))), ['meta.project', 'meta.site']);
});

test('chỉ ghi ô trống hoặc còn giá trị mặc định của template; không đè ô người dùng đã nhập', () => {
  const fills = { 'meta.manuf': { value: 'H1', src: 'CSDL' }, 'meta.type': { value: 'K1', src: 'CSDL' }, 'meta.year': { value: '2020', src: 'CSDL' }, 'meta.power': { value: '100', src: 'CSDL' } };
  const v = { 'meta.manuf': 'Hãng mẫu', 'meta.type': 'Người dùng gõ', 'meta.year': '', 'meta.power': '100' };
  const plan = J(ES.fillPlan(v, fills, { 'meta.manuf': 'Hãng mẫu', 'meta.type': 'Kiểu mẫu' }));
  assert.deepEqual(Object.keys(plan).sort(), ['meta.manuf', 'meta.year']);
});

test('ô thông số không có nguồn nào mà còn giá trị mẫu của template → cần xóa để nhập tay', () => {
  const tpl = { 'meta.voltage': 'Điện áp mẫu', 'meta.current': 'Dòng mẫu', 'meta.vector': '', 'meta.serial': 'SN mẫu' };
  const v = { 'meta.voltage': 'Điện áp mẫu', 'meta.current': 'Người dùng gõ', 'meta.vector': '', 'meta.serial': 'SN mẫu' };
  const fills = { 'meta.power': { value: '100', src: 'CSDL' } };
  assert.deepEqual(J(ES.staleKeys(v, fills, tpl)), ['meta.voltage'], 'giữ ô người dùng đã nhập, ô trống; không đụng số chế tạo');
});

test('tổ máy khai trong CSDL (equipment_groups) được ưu tiên; máy thanh lý không tính', () => {
  const list = [
    { id: 'a', bay_id: 'b1', class_code: 'MBA', phase: 'A', serial_no: 'SN-A' },
    { id: 'b', bay_id: 'b1', class_code: 'MBA', phase: 'B', serial_no: 'SN-B' },
    { id: 'b2', bay_id: 'b1', class_code: 'MBA', phase: 'B', serial_no: 'SN-B-DP', name: 'Máy dự phòng' },
    { id: 'c', bay_id: 'b1', class_code: 'MBA', phase: 'C', serial_no: 'SN-C' },
    { id: 'x', bay_id: 'b1', class_code: 'MBA', serial_no: 'SN-OLD', status: 'retired' },
  ];
  const groups = [{ id: 'g1', bay_id: 'b1', class_code: 'MBA', name: 'Tổ MBA AT1', eq_a: 'a', eq_b: 'b2', eq_c: 'c' }];
  const r = J(ES.bayUnits(list, 'b1', 'MBA', groups));
  assert.equal(r.bank.B.serial_no, 'SN-B-DP', 'pha B theo tổ máy (máy dự phòng đã thay)');
  assert.deepEqual(r.bank.group, { id: 'g1', name: 'Tổ MBA AT1' });
  assert.deepEqual(r.singles.map(e => e.serial_no), ['SN-B'], 'máy cũ pha B là máy đơn; máy thanh lý không hiện');
  assert.equal(J(ES.bayUnits(list, 'b1', 'MBA')).bank.B.serial_no, 'SN-B', 'không có tổ trong CSDL: suy theo pha như cũ');
});
