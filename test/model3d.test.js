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
      for (const item of part.items) assert.ok(valid.has(item.id), `${part.id}: ${item.id}`);
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

test('hạng mục của bộ phận xếp theo số thứ tự trong mẫu', () => {
  const ctx = load(DOMAIN.concat(['js/domain/types/mba/model3d-map.js']));
  const T = ctx.EquipmentTypes.get('MBA');
  const schema = T.buildSchema(T.defaultCfg());
  const windings = ctx.MbaModel3DMap.partsFor(schema).find(p => p.id === 'windings');
  const nos = windings.items.map(i => Number(i.no));
  assert.deepEqual(nos, nos.slice().sort((a, b) => a - b));
  assert.ok(windings.items.some(i => i.id === 'vector'));
});
