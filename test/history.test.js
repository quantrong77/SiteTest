// Xóa / hoàn tác số liệu theo hạng mục: khóa nào thuộc hạng mục nào, bước hoàn tác tách theo hạng mục.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

const same = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);

test('khóa số liệu → hạng mục (ô, lưới, khóa phụ của lưới); thông tin chung không thuộc hạng mục', () => {
  const ctx = load(CORE);
  const { schema } = F.emptyState(ctx.Schema);
  const sec = ctx.Common.sectionOfKey(schema);
  same(['dcr.hv.t', 'dcr.hv.t3.A', 'ratio.hm.t1.B', 'oltc.osc', 'oltc.rounds.d1.k', 'bct.hv.ex.A.src.w1', 'wtgd.k2', 'meta.serial', 'meta.conclusion', 'xyz'].map(sec),
    ['dcr', 'dcr', 'ratio', 'oltc', 'oltc', 'bct', 'wtgd', null, null, null]);
});

test('hoàn tác theo hạng mục: mỗi thao tác một bước cho từng hạng mục bị đổi', () => {
  const ctx = load(CORE);
  const { Common, EditHistory: H } = ctx;
  const { state, schema } = F.emptyState(ctx.Schema);
  const secOf = Common.sectionOfKey(schema), attSec = { oltc: 'oltc', oscAuto: 'oltc' };
  state.att = {};

  // gõ một ô
  let b = H.snapshot(state, false);
  state.v['dcr.hv.t1.A'] = '197.26';
  same(H.record('Sửa ô', b, state, secOf), ['dcr']);
  // nhập file máy đo: đổi mục 7, 8, 9 cùng lúc (kèm số liệu đính kèm)
  b = H.snapshot(state);
  state.v['dcr.hv.t1.A'] = '189.34'; state.v['ratio.hm.t1.A'] = '2.4370'; state.v['oltc.osc'] = 'tóm tắt'; state.v['meta.site'] = 'trạm';
  state.att.oltc = { A: { rows: [], waves: [] } };
  same(H.record('Nhập file', b, state, secOf, attSec).sort(), ['dcr', 'oltc', 'ratio']);
  same([H.count('dcr'), H.count('ratio'), H.count('oltc'), H.count('ir')], [2, 1, 1, 0]);

  // hoàn tác mục 9 không đụng mục 7, 8
  assert.equal(H.undo('oltc', state).label, 'Nhập file');
  assert.equal(state.v['oltc.osc'], undefined);
  assert.equal(state.att.oltc, undefined);
  same([state.v['dcr.hv.t1.A'], state.v['ratio.hm.t1.A']], ['189.34', '2.4370']);
  // mục 7 lùi từng bước
  H.undo('dcr', state); assert.equal(state.v['dcr.hv.t1.A'], '197.26');
  H.undo('dcr', state); assert.equal(state.v['dcr.hv.t1.A'], undefined);
  assert.equal(H.undo('dcr', state), null);

  // xóa hạng mục rồi hoàn tác
  state.v['ratio.hm.t2.B'] = '2.41';
  assert.ok(H.hasData('ratio', state, secOf, attSec));
  b = H.snapshot(state);
  assert.equal(H.clearSection('ratio', state, secOf, attSec), 2);
  H.record('Xóa số liệu hạng mục 8', b, state, secOf, attSec);
  assert.equal(H.hasData('ratio', state, secOf, attSec), false);
  assert.equal(state.v['meta.site'], 'trạm', 'thông tin chung giữ nguyên');
  H.undo('ratio', state);
  same([state.v['ratio.hm.t1.A'], state.v['ratio.hm.t2.B']], ['2.4370', '2.41']);

  H.reset();
  assert.equal(H.count('ratio'), 0);
});
