// Ảnh chụp các dòng CSDL sinh từ biểu mẫu MBA (thiết bị, lần thí nghiệm, số liệu, kết quả đánh giá).
// Khóa sơ đồ đo, pha, nấc và giá trị quy đổi ở đây là thứ trang Xu hướng dùng để nối các lần đo.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

const SNAP = path.join(__dirname, 'snapshots', 'to-rows.json');
const UPDATE = process.env.UPDATE_SNAPSHOTS === '1';

const SCENARIOS = {
  'đủ số liệu, có file xuất xưởng, sau lắp đặt': () => [{}, F.fakeFactory()],
  'đủ số liệu, chưa có file xuất xưởng, định kỳ': () => [{ reason: 'Định kỳ' }, null],
};

function run(name) {
  const ctx = load(CORE);
  const [opts, fx] = SCENARIOS[name]();
  const { state, schema } = F.fullState(ctx.Schema, opts);
  const res = ctx.Evaluate.evaluate(state, fx, schema);
  return JSON.parse(JSON.stringify(ctx.EquipmentTypes.get('MBA').toRows.fieldRows(state, res, schema)));
}

// Mỗi dòng số liệu một dòng JSON, để diff dễ đọc
const pretty = snap => `{\n${Object.entries(snap).map(([name, pack]) => ` ${JSON.stringify(name)}: {\n${Object.entries(pack).map(([k, val]) => (Array.isArray(val)
  ? `  ${JSON.stringify(k)}: [\n${val.map(x => '   ' + JSON.stringify(x)).join(',\n')}\n  ]`
  : `  ${JSON.stringify(k)}: ${JSON.stringify(val)}`)).join(',\n')}\n }`).join(',\n')}\n}\n`;

const saved = fs.existsSync(SNAP) ? JSON.parse(fs.readFileSync(SNAP, 'utf8')) : {};
const fresh = {};

for (const name of Object.keys(SCENARIOS)) {
  test(`dòng CSDL từ biểu mẫu MBA: ${name}`, () => {
    fresh[name] = run(name);
    if (UPDATE) return;
    assert.ok(saved[name], `Chưa có ảnh chụp cho "${name}" — chạy UPDATE_SNAPSHOTS=1 npm test`);
    assert.deepEqual(fresh[name], saved[name]);
  });
}

test.after(() => { if (UPDATE) fs.writeFileSync(SNAP, pretty(fresh)); });
