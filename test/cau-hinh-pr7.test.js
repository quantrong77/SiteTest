// Quyết định của chủ dự án (18/11/2026) cho PR #7:
// - mẫu theo pha: cột pha B, C của R một chiều / tỷ số biến là máy B, C của tổ (cfg.ps) — kể cả topology 'single1p' sau normalizeCfg;
// - phụ lục bảng tra cứu tiêu chuẩn: tùy chọn (cfg.stdAppendix = 'on'), mặc định không kèm. Số liệu giả.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

test('mẫu theo pha (topology single1p): cột pha B, C so và ghi CSDL theo máy B, C; MBA 3 pha 110–220 kV một máy', () => {
  const ctx = load(CORE);
  const T = ctx.EquipmentTypes.get('MBA');
  const { state, schema } = F.fullState(ctx.Schema, {});
  state.cfg = T.normalizeCfg(state.cfg);
  assert.equal(state.cfg.topology, 'single1p');
  const res = ctx.Evaluate.evaluate(state, null, schema);
  const locs = res.findings.filter(f => f.sec === 'dcr' && / – pha B – /.test(f.loc || '')).map(f => f.loc);
  assert.ok(locs.length > 0);
  assert.ok(locs.every(l => /SN-B$/.test(l)), locs[0]);
  const pack = ctx.MbaRows.fieldRows(state, res, schema);
  assert.ok(pack.refs.some(r => r.serial_no === 'SN-B'), 'có thiết bị SN-B trong dòng CSDL');
});

test('phụ lục bảng tra cứu tiêu chuẩn: mặc định không kèm, chọn "on" thì là phụ lục cuối', () => {
  const ctx = load(CORE);
  const T = ctx.EquipmentTypes.get('MBA');
  assert.equal(T.normalizeCfg({}).stdAppendix, 'off');
  assert.equal(T.normalizeCfg({ stdAppendix: 'x' }).stdAppendix, 'off');
  const st = on => ({ cfg: { stdAppendix: on }, att: { oltc: { a: 1 } } });
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.Appendix.list(st('off')))), [{ kind: 'oltc', label: 'PHỤ LỤC' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.Appendix.list(st('on')))),
    [{ kind: 'oltc', label: 'PHỤ LỤC 1' }, { kind: 'standards', label: 'PHỤ LỤC 2' }]);
});
