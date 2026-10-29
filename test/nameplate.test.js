// Đọc nameplate MBA từ chữ OCR (giá trị giả, bố cục giống nameplate máy 500 kV): tách trường, độ tin cậy, trạng thái.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');

// Dòng OCR: chữ + độ tin cậy từng từ (mặc định 95; từ ghi kèm "~" có độ tin cậy thấp)
const lines = (...xs) => xs.map(t => {
  const words = t.split(/\s+/).filter(Boolean).map(w => (w.startsWith('~') ? { text: w.slice(1), conf: 55 } : { text: w, conf: 95 }));
  return { text: words.map(w => w.text).join(' '), conf: Math.min(...words.map(w => w.conf)), words };
});
const pick = f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, [v.value, v.status]]));

test('nameplate có ký hiệu cuộn HV/MV/LV: đủ trường, đúng định dạng BBTN', () => {
  const { MbaNameplate } = load(CORE);
  const f = MbaNameplate.parse(lines(
    'AUTO TRANSFORMER',
    'MANUFACTURER ACME TRANSFORMER CO., LTD.',
    'TRANSFORMER CODE OFDPSZ-300000/500',
    'RATED POWER HV 180/240/300 MV 180/240/300 LV 36/48/60 MVA',
    'RATED FREQUENCY 50 Hz',
    'RATED VOLTAGE HV 500/V3 ±8x1.25% MV 225/V3 LV 35 kV',
    'RATED CURRENT HV 624/831/1039 MV 1386/1848/2309 LV 1029/1371/1714 A',
    'CONNECTION SYMBOL YNa0d11',
    'SERIAL NUMBER X2O25177',
    'YEAR OF MANUFACTURE 2026',
    'OLTC CODE VRM12622-300/RD-10193W',
    'NO-LOAD CURRENT 0.04 %',
  ));
  assert.deepEqual(pick(f), {
    'meta.manuf': ['ACME TRANSFORMER CO., LTD.', 'ok'],
    'meta.type': ['OFDPSZ-300000/500', 'ok'],
    'meta.serial': ['X2025177', 'check'], // O đọc thành 0: từ OCR gốc "X2O25177" khác giá trị → không đủ chắc chắn
    'meta.year': ['2026', 'ok'],
    'meta.power': ['180/240/300', 'ok'],
    'meta.voltage': ['500/√3 ±8×1.25%/225/√3/35', 'ok'],
    'meta.current': ['1039/2309/1714', 'ok'],
    'meta.vector': ['YNa0d11', 'ok'],
    'oltc.type': ['VRM12622-300/RD-10193W', 'ok'],
    'cfg.i0Ref': ['0.04', 'ok'],
  });
});

test('bảng bị OCR tách thành cột nhãn và cột giá trị, ảnh nghiêng → ghép lại theo toạ độ', () => {
  const { MbaNameplate } = load(CORE);
  const k = 0.04; // nghiêng ~2,3°: cùng hàng, giá trị ở bên phải thấp hơn nhãn
  const at = (text, x, row) => {
    const y = 100 + row * 110 + k * x;
    return Object.assign(lines(text)[0], { bbox: { x0: x, y0: y, x1: x + 400, y1: y + 40 }, baseline: { x0: x, y0: y + 40, x1: x + 400, y1: y + 40 + k * 400 } });
  };
  const labels = ['MANUFACTURER', 'RATEDPOWER', 'RATED VOLTAGE', 'SERIAL NUMBER', 'OLTC CODE'].map((t, i) => at(t, 80, i));
  const values = ['ACME TRANSFORMER CO., LTD.', 'HV 180/240/300 MV 180/240/300 LV 36/48/60 MVA', 'HV 500V3 £8x1.25% MV 225V3 LV 35 kV', 'X2025177', 'See VRM12622-300/RD-10193W']
    .map((t, i) => at(t, 760, i));
  const f = MbaNameplate.parse(labels.concat(values)); // OCR trả hết cột nhãn rồi mới đến cột giá trị
  assert.deepEqual(pick(f)['meta.manuf'], ['ACME TRANSFORMER CO., LTD.', 'ok']);
  assert.deepEqual(pick(f)['meta.power'], ['180/240/300', 'ok']);
  assert.deepEqual(pick(f)['meta.voltage'], ['500/√3 ±8×1.25%/225/√3/35', 'ok']);
  assert.deepEqual(pick(f)['meta.serial'], ['X2025177', 'ok']);
  assert.deepEqual(pick(f)['oltc.type'], ['VRM12622-300/RD-10193W', 'ok'], 'bỏ chữ nhiễu đứng trước mã');
});

test('dòng dị thường: số giá trị giữa các cuộn không khớp (dấu / đọc thành 1)', () => {
  const { MbaNameplate } = load(CORE);
  const f = MbaNameplate.parse(lines('RATED CURRENT HV 624/831/1039 MV 1386/1848/2309 LV 1029113711714 A'));
  assert.equal(f['meta.current'].status, 'check');
  assert.match(f['meta.current'].why, /nghi dấu “\/” đọc thành số/);
});

test('chữ mờ, thiếu ký hiệu cuộn, thiếu trường → cần kiểm tra / không đọc được', () => {
  const { MbaNameplate } = load(CORE);
  const f = MbaNameplate.parse(lines(
    'ACME ELECTRIC CO., LTD.',
    'RATED POWER 180/240/300 180/240/300 36/48/60 MVA',
    'RATED VOLTAGE 500/V3 225/V3 kV',
    'SERIAL NO. ~C2025178',
    'YEAR 2O26',
  ));
  const s = k => f[k].status;
  assert.equal(f['meta.manuf'].value, 'ACME ELECTRIC CO., LTD.');
  assert.equal(s('meta.manuf'), 'check', 'không có nhãn Manufacturer');
  assert.deepEqual([f['meta.power'].value, s('meta.power')], ['180/240/300', 'check']);
  assert.match(f['meta.power'].why, /không thấy ký hiệu cuộn/);
  assert.deepEqual([f['meta.voltage'].value, s('meta.voltage')], ['500/√3/225/√3', 'check']);
  assert.match(f['meta.voltage'].why, /2\/3 cuộn/);
  assert.deepEqual([f['meta.serial'].value, f['meta.serial'].conf, s('meta.serial')], ['C2025178', 55, 'check']);
  assert.equal(f['meta.year'].value, '2026');
  ['meta.type', 'meta.current', 'meta.vector', 'oltc.type', 'cfg.i0Ref'].forEach(k => assert.equal(s(k), 'missing', k));
});

test('số chế tạo đối chiếu file xuất xưởng: khớp giữ nguyên, lệch 1–2 ký tự chọn S/N trong file và tô vàng', () => {
  const { MbaNameplate } = load(CORE);
  const serials = ['X2025177', 'X2025178', 'X2025179'];
  const sn = t => MbaNameplate.parse(lines(`SERIAL NO. ${t}`), { serials })['meta.serial'];
  assert.deepEqual([sn('X2025178').value, sn('X2025178').status], ['X2025178', 'ok']);
  const near = sn('2025178');
  assert.deepEqual([near.value, near.status], ['X2025178', 'check']);
  assert.match(near.why, /gần với S\/N X2025178/);
  assert.deepEqual([sn('Q9999999').value, sn('Q9999999').status], ['Q9999999', 'check']);
});

test('giá trị nhiều khả năng sai (thiếu cuộn, S/N lạ, I0 bất thường) đánh dấu weak để không điền sẵn', () => {
  const { MbaNameplate } = load(CORE);
  const f = MbaNameplate.parse(lines('RATED VOLTAGE 2026', 'SERIAL NO. 83171039', 'NO-LOAD CURRENT 004 %'), { serials: ['X2025177'] });
  assert.deepEqual(['meta.voltage', 'meta.serial', 'cfg.i0Ref'].map(k => [f[k].status, !!f[k].weak]), [['check', true], ['check', true], ['check', true]]);
  const g = MbaNameplate.parse(lines('RATED VOLTAGE HV 500/V3 MV 225/V3 LV 35 kV'));
  assert.equal(!!g['meta.voltage'].weak, false);
  assert.equal(MbaNameplate.found(f), 3);
  const b = MbaNameplate.best(f, g);
  assert.equal(b['meta.voltage'].value, '500/√3/225/√3/35', 'lấy lượt đọc tốt hơn');
});
