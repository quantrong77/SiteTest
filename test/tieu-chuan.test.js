// G5: bảng tra hạng mục → điều khoản QĐ 1901 → tiêu chuẩn IEC/IEEE QĐ 1901 dẫn chiếu. Chỉ tra cứu, không thêm ngưỡng.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

test('mỗi hạng mục có căn cứ QĐ 1901 đều có dòng bảng tra (danh sách hoặc ghi chú vì sao không có)', () => {
  const { QD } = load(CORE);
  Object.keys(QD.REF).forEach(k => {
    assert.ok(Array.isArray(QD.STANDARDS[k]), `thiếu bảng tra cho ${k}`);
    assert.ok(QD.STANDARDS_LABEL[k], `thiếu tên hạng mục ${k}`);
    if (!QD.STANDARDS[k].length) assert.ok(QD.STANDARDS_NOTE[k], `${k}: không có tiêu chuẩn thì phải ghi lý do`);
  });
});

test('tiêu chuẩn chỉ lấy từ QĐ 1901: "cần xác nhận" phải có trong danh mục Phụ lục III; không mang ngưỡng', () => {
  const { QD } = load(CORE);
  const cited = new Set(QD.CITED.flatMap(c => c.list));
  const all = Object.values(QD.STANDARDS).flat().concat(QD.STANDARDS_EXTRA.flatMap(x => x.std));
  all.forEach(s => {
    assert.ok(s.code && s.scope && s.where, JSON.stringify(s));
    if (!s.ok) assert.ok(cited.has(s.code), `${s.code} không có trong danh mục QĐ 1901`);
    if (s.ok) assert.match(s.where, /^Điều \d+/, `${s.code}: dẫn chiếu trong điều phải ghi số điều`);
    assert.deepEqual(Object.keys(s).sort(), ['code', 'ok', 'scope', 'where'], 'không có trường ngưỡng');
  });
  // các dẫn chiếu nêu ngay trong điều khoản (đã đối chiếu văn bản gốc)
  const codes = k => QD.STANDARDS[k].filter(s => s.ok).map(s => s.code);
  assert.deepEqual(JSON.parse(JSON.stringify(codes('pi'))), ['IEEE C57.152']);
  assert.deepEqual(JSON.parse(JSON.stringify(codes('noload'))), ['IEC 60076-1', 'IEC 60076-19']);
  assert.deepEqual(JSON.parse(JSON.stringify(codes('bushing'))), ['IEC 60137', 'IEEE C57.12.200']);
});

test('dòng đánh giá → tiêu chuẩn: theo căn cứ (PI, lõi từ) rồi theo hạng mục; cần xác nhận ghi rõ', () => {
  const { QD } = load(CORE);
  assert.equal(QD.stdOf({ sec: 'ir', basis: QD.REF.pi }), 'IEEE C57.152');
  assert.equal(QD.stdOf({ sec: 'ir', basis: QD.REF.core }), 'IEEE C57.152 (cần xác nhận)');
  assert.equal(QD.stdOf({ sec: 'bushing', basis: 'QĐ 1901 Điều 38 mục 3c' }), 'IEC 60137; IEEE C57.12.200; bộ IEEE C57.19 (cần xác nhận)');
  assert.match(QD.stdOf({ sec: 'oltc', basis: QD.REF.oltc }), /không dẫn chiếu/);
  assert.equal(QD.stdOf({ sec: 'khac', basis: 'x' }), '');
});

test('mọi dòng đánh giá của biên bản mẫu đều tra được tiêu chuẩn hoặc lý do; kết quả đánh giá không đổi', () => {
  const ctx = load(CORE);
  const { Evaluate, QD, Schema } = ctx;
  const { state, schema } = F.fullState(Schema);
  const res = Evaluate.evaluate(state, F.fakeFactory(), schema);
  assert.ok(res.findings.length > 10);
  res.findings.forEach(f => {
    assert.equal(f.std, undefined, 'không ghi vào kết quả đánh giá');
    assert.ok(QD.stdOf(f), `không tra được tiêu chuẩn cho ${f.sec} / ${f.basis}`);
  });
});
