// Ảnh chụp kết quả evaluate() của MBA: mọi thay đổi ở phép tính, ngưỡng hay câu chữ đánh giá
// đều làm test này đỏ. Khi thay đổi là cố ý, chạy lại với UPDATE_SNAPSHOTS=1 rồi xem diff của file ảnh chụp.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

const SNAP = path.join(__dirname, 'snapshots', 'evaluate.json');
const UPDATE = process.env.UPDATE_SNAPSHOTS === '1';

const SCENARIOS = {
  'trống, chưa có file xuất xưởng': (S) => [F.emptyState(S), null],
  'đủ số liệu, chưa có file xuất xưởng': (S) => [F.fullState(S), null],
  'đủ số liệu, có file xuất xưởng, sau lắp đặt': (S) => [F.fullState(S), F.fakeFactory()],
  'đủ số liệu, có file xuất xưởng, định kỳ': (S) => [F.fullState(S, { reason: 'Định kỳ' }), F.fakeFactory()],
};

function run(name) {
  const ctx = load(CORE);
  const [{ state, schema }, fx] = SCENARIOS[name](ctx.Schema);
  const res = ctx.Evaluate.evaluate(state, fx, schema);
  const out = { calc: res.calc, findings: res.findings, sec: res.sec, notes: res.notes, conclusion: ctx.Evaluate.autoConclusion(res, schema, state) };
  return JSON.parse(JSON.stringify(out));
}

// Mỗi kết quả đánh giá / giá trị tự tính một dòng, để diff của ảnh chụp dễ đọc
function pretty(snap) {
  const scen = Object.entries(snap).map(([name, o]) => {
    const parts = Object.entries(o).map(([k, val]) => {
      if (Array.isArray(val)) return `  ${JSON.stringify(k)}: [\n${val.map(x => '   ' + JSON.stringify(x)).join(',\n')}\n  ]`;
      if (val && typeof val === 'object') return `  ${JSON.stringify(k)}: {\n${Object.entries(val).map(([a, b]) => `   ${JSON.stringify(a)}: ${JSON.stringify(b)}`).join(',\n')}\n  }`;
      return `  ${JSON.stringify(k)}: ${JSON.stringify(val)}`;
    });
    return ` ${JSON.stringify(name)}: {\n${parts.join(',\n')}\n }`;
  });
  return `{\n${scen.join(',\n')}\n}`;
}

const saved = fs.existsSync(SNAP) ? JSON.parse(fs.readFileSync(SNAP, 'utf8')) : {};
const fresh = {};

for (const name of Object.keys(SCENARIOS)) {
  test(`evaluate(): ${name}`, () => {
    fresh[name] = run(name);
    if (UPDATE) return;
    assert.ok(saved[name], `Chưa có ảnh chụp cho "${name}" — chạy UPDATE_SNAPSHOTS=1 npm test`);
    assert.deepEqual(fresh[name], saved[name]);
  });
}

test('evaluate() cho cùng kết quả khi chạy lại (không phụ thuộc thời gian, thứ tự)', () => {
  const name = 'đủ số liệu, có file xuất xưởng, sau lắp đặt';
  assert.deepEqual(run(name), run(name));
});

test.after(() => {
  if (!UPDATE) return;
  fs.mkdirSync(path.dirname(SNAP), { recursive: true });
  fs.writeFileSync(SNAP, pretty(fresh) + '\n');
});
