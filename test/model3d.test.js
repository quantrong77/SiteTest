'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, DOMAIN } = require('./harness');

test('bản đồ 3D chỉ trả hạng mục đang có ở ba schema MBA', () => {
  const ctx = load(DOMAIN.concat(['js/domain/types/mba/model3d-map.js']));
  const type = ctx.EquipmentTypes.get('MBA');
  const cfg = type.defaultCfg();
  const schemas = [
    type.buildSchema(cfg),
    type.buildSchema(Object.assign({}, cfg, { template: 'custom', layout: '110' })),
    type.buildSchema(Object.assign({}, cfg, { template: '3P' })),
  ];

  for (const schema of schemas) {
    const valid = new Set(schema.sections.map(section => section.id));
    const parts = ctx.MbaModel3DMap.partsFor(schema);
    assert.ok(parts.length);
    for (const part of parts) {
      assert.ok(part.items.length);
      // mục ngoài biểu mẫu (trang Phụ lục, app DGA) đánh dấu extra; còn lại phải là hạng mục của schema
      for (const item of part.items.filter(i => !i.extra)) assert.ok(valid.has(item.id), `${part.id}: ${item.id}`);
    }
  }
});

test('bộ phận sứ chỉ xuất hiện khi nhóm tương ứng có trong schema', () => {
  const ctx = load(DOMAIN.concat(['js/domain/types/mba/model3d-map.js']));
  const partsFor = ctx.MbaModel3DMap.partsFor;
  const schema = { sections: [
    { id: 'visual', no: 1, title: 'Kiểm tra bên ngoài' },
    { id: 'bushing', no: 5, title: 'Sứ', groups: [{ id: 'hv' }, { id: 'n' }, { id: 'lv2' }] },
  ] };
  const ids = partsFor(schema).map(part => part.id);
  assert.ok(ids.includes('bush-hv'));
  assert.ok(ids.includes('bush-n'));
  assert.ok(ids.includes('bush-lv'));
  assert.ok(!ids.includes('bush-mv'));
});

test('sứ trung tính có ở cả ba mẫu MBA (mẫu 1 pha / 110 kV: cột N trong nhóm trung áp)', () => {
  const ctx = load(DOMAIN.concat(['js/domain/types/mba/model3d-map.js']));
  const T = ctx.EquipmentTypes.get('MBA');
  const cfg = T.defaultCfg();
  for (const c of [cfg, Object.assign({}, cfg, { template: 'custom', layout: '110' }), Object.assign({}, cfg, { template: '3P' })]) {
    const part = ctx.MbaModel3DMap.partsFor(T.buildSchema(c)).find(p => p.id === 'bush-n');
    assert.ok(part, `thiếu sứ trung tính: ${c.template}/${c.layout}`);
    assert.deepEqual(part.items.map(i => i.id).join(), 'bushing');
  }
  const oneP = ctx.MbaModel3DMap.partsFor(T.buildSchema(cfg)).find(p => p.id === 'bush-n');
  assert.match(oneP.items[0].title, /cột N/);
  // chỉ có cột N ở bảng thử AC sứ hạ áp thì không tính là có sứ trung tính đo tgδ
  const acOnly = { sections: [{ id: 'bushing', no: 5, title: 'Sứ', groups: [
    { id: 'hv', grids: [{ id: 'b.hv', cols: [{ k: 'A' }] }] },
    { id: 'ac', grids: [{ id: 'b.ac', cols: [{ k: 'a' }, { k: 'N' }] }] },
  ] }] };
  assert.ok(!ctx.MbaModel3DMap.partsFor(acOnly).some(p => p.id === 'bush-n'));
});

test('hạng mục của bộ phận xếp theo số thứ tự trong mẫu', () => {
  const ctx = load(DOMAIN.concat(['js/domain/types/mba/model3d-map.js']));
  const T = ctx.EquipmentTypes.get('MBA');
  const schema = T.buildSchema(T.defaultCfg());
  const windings = ctx.MbaModel3DMap.partsFor(schema).find(p => p.id === 'windings');
  const nos = windings.items.map(i => Number(i.no));
  assert.deepEqual(nos, nos.slice().sort((a, b) => a - b));
  assert.ok(windings.items.some(i => i.id === 'vector'));
});

test('bình dầu phụ: Kiểm tra bên ngoài, trang Dầu MBA ở Phụ lục và liên kết app DGA', () => {
  const ctx = load(DOMAIN.concat(['js/domain/types/mba/model3d-map.js']));
  const T = ctx.EquipmentTypes.get('MBA');
  const part = ctx.MbaModel3DMap.partsFor(T.buildSchema(T.defaultCfg())).find(p => p.id === 'conservator');
  assert.deepEqual(JSON.parse(JSON.stringify(part.items.map(i => i.id || i.link))), ['visual', 'appendix', 'dga']);
  const oil = part.items.find(i => i.id === 'appendix');
  assert.equal(oil.anchor, 'appx-oil');
  assert.ok(part.items.filter(i => i.extra).length === 2);
});

test('sứ từng pha: HV A B C, MV Am Bm Cm, N; LV a b c (110 kV) / 3.1 3.2 (mẫu theo pha) trỏ tới ô tgδ C1', () => {
  const ctx = load(DOMAIN.concat(['js/domain/types/mba/model3d-map.js']));
  const T = ctx.EquipmentTypes.get('MBA');
  const cfg = T.defaultCfg();
  const lab = r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.map(e => e.label).join()]));
  for (const c of [cfg, Object.assign({}, cfg, { template: 'custom', layout: '110' })]) {
    const r = ctx.MbaModel3DMap.bushingPhases(T.buildSchema(c));
    const unit = c === cfg;
    assert.deepEqual(lab(r), { 'bush-hv': 'A,B,C', 'bush-mv': 'Am,Bm,Cm', 'bush-n': 'N', 'bush-lv': unit ? '3.1,3.2' : 'a,b,c' });
    assert.equal(r['bush-hv'][0].cell, 'b.hv.meas.tgd1.A');
    assert.equal(r['bush-n'][0].cell, 'b.mv.meas.tgd1.N', 'N gộp trong nhóm trung áp');
    assert.equal(r['bush-lv'][1].cell, 'b.lv.meas.tgd1.b');
  }
  // mẫu 3 pha: N của từng máy ở nhóm riêng
  const r3 = ctx.MbaModel3DMap.bushingPhases(T.buildSchema(Object.assign({}, cfg, { template: '3P' })));
  assert.equal(r3['bush-n'].map(e => e.cell).join(), 'b.n.meas.tgd1.A,b.n.meas.tgd1.B,b.n.meas.tgd1.C');
  assert.equal(r3['bush-mv'].length, 3);
  // ô đích phải có trong schema
  const keys = new Set();
  T.buildSchema(cfg).sections.find(s => s.id === 'bushing').groups.forEach(g => (g.grids || []).forEach(gr => (gr.rows || []).forEach(row => (gr.cols || []).forEach(col => keys.add(`${gr.id}.${row.k}.${col.k}`)))));
  Object.values(ctx.MbaModel3DMap.bushingPhases(T.buildSchema(cfg))).flat().forEach(e => assert.ok(keys.has(e.cell), e.cell));
});
