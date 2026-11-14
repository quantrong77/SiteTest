// Kiểm tra số đọc tiếng Việt, chữ số nhận dạng trực tiếp và cách đọc các hàng số thông dụng.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./harness');
const { VnNumber } = load(['js/domain/vn-number.js']);

test('đọc số tiếng Việt, hàng nghìn, triệu, dấu thập phân và số âm', () => {
  assert.equal(VnNumber.parse('một trăm hai mươi lăm phẩy ba'), '125,3');
  assert.equal(VnNumber.parse('không phẩy không bốn'), '0,04');
  assert.equal(VnNumber.parse('âm hai triệu ba trăm nghìn linh năm'), '-2300005');
  assert.equal(VnNumber.parse('hai mươi tư'), '24');
  assert.equal(VnNumber.parse('ba mươi mốt'), '31');
  assert.equal(VnNumber.parse('không chấm không bốn'), '0,04');
  assert.equal(VnNumber.parse('một trăm lẻ năm'), '105');
  assert.equal(VnNumber.parse('một trăm linh năm'), '105');
  assert.equal(VnNumber.parse('mười'), '10');
  assert.equal(VnNumber.parse('mười lăm'), '15');
  assert.equal(VnNumber.parse('ba nghìn không trăm năm mươi'), '3050');
  assert.equal(VnNumber.parse('xin chào'), null);
});

test('nhận kết quả nhận dạng trả về dưới dạng chữ số', () => {
  assert.equal(VnNumber.parse('125,3'), '125,3');
  assert.equal(VnNumber.parse('125.3'), '125,3');
  assert.equal(VnNumber.parse('2026'), '2026');
  assert.equal(VnNumber.parse('0,04'), '0,04');
  assert.equal(VnNumber.parse('197.53'), '197,53');
  assert.equal(VnNumber.parse('-5'), '-5');
});
