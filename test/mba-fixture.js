// Hồ sơ MBA mẫu dựng từ schema (số liệu giả, có quy luật) và bảng tra xuất xưởng giả,
// dùng cho test ảnh chụp kết quả evaluate(). Không chứa số liệu thật của đơn vị.
'use strict';

function defaultCfg(Schema) {
  // Giống defaultCfg() trong js/app.js
  return {
    template: 'A', ps: { A: 'SN-A', B: 'SN-B', C: 'SN-C' }, taps: Schema.DEFAULT_TAPS.slice(), hvMeas: 'SER+COM', lvMode: 'unit',
    iLV: '2000', sLV: '50', sR: '150', i0Ref: '0,1', bC1Dev: '', bTgdMax: '0,5', bctCores: { hv: 4, mv: 4, lv: 4 },
    ctNo: { hv: '1,2,3,4,5,6', mv: '4,5,6,7,8', n: '8,9,10', lv: '11,12,13,14' }, bctErrLimit: '0,5', decSep: ',',
    hdr: {}, wtgdLabels: {}, wtgdRows: [],
  };
}

// Giá trị gốc theo lưới / cột / hàng
function base(gid, rk, ck) {
  if (gid.startsWith('nl.')) return { u: 0.4, i: 0.5, p: 300, um: 525, ur: 527, ia: 2.1, ib: 2.0, ic: 2.05, pm: 60 }[ck];
  if (gid === 'ir.meas') return { r15: 8000, r60: 12000, r600: 25000 }[ck];
  if (/^b\.\w+\.meas$/.test(gid)) return { ur: 245, tgd1: 0.35, c1: 450, r1: 50000, tgd2: 0.5, c2: 3000, r2: 20000 }[rk];
  if (gid === 'b.ac') return { u: 400, dur: 1 }[rk];
  if (gid === 'wtgd.meas') return { tgd: 0.25, c: 8000 }[ck];
  if (gid.startsWith('dcr.')) return 200;
  if (gid === 'ratio.hm') return 2.2;
  if (gid === 'ratio.hl') return 13;
  if (gid === 'ratio.ml') return 5.9;
  if (/^bct\.\w+\.ir$/.test(gid)) return 5000;
  if (/^bct\.\w+\.ratio$/.test(gid)) return 1000;
  if (/^bct\.\w+\.dcr$/.test(gid)) return 5;
  if (/^bct\.\w+\.ex\./.test(gid)) return rk.endsWith('u') ? 100 : 0.02;
  return undefined;
}

// Số dạng chuỗi kiểu người dùng nhập (dấu phẩy thập phân), lệch nhỏ theo hàng/cột để các pha khác nhau
const vn = x => String(+x.toFixed(4)).replace('.', ',');

function fullState(Schema, opts = {}) {
  const cfg = defaultCfg(Schema);
  const schema = Schema.build(cfg);
  const v = {};
  Schema.eachGrid(schema, g => {
    if (g.readonly) return;
    g.rows.forEach((r, ri) => g.cols.forEach((c, ci) => {
      if (c.calc || c.auto || (g.skip && g.skip(r.k, c.k))) return;
      const k = `${g.id}.${r.k}.${c.k}`;
      if (r.text || c.text) { v[k] = r.k === 'serial' ? `S-${g.id.split('.')[1]}-${c.k}` : `${r.k}-${c.k}`; return; }
      if (g.id === 'b.ac' && r.k === 'eval') { v[k] = 'Đạt'; return; }
      const b = base(g.id, r.k, c.k);
      if (b === undefined) return;
      v[k] = vn(b * (1 + 0.004 * ri + 0.003 * ci));
    }));
  });
  Object.assign(v, {
    'meta.serial': 'SN-A', 'meta.reason': opts.reason || 'Sau lắp đặt', 'meta.date': '20/10/2026', 'meta.ambT': '30', 'meta.hum': '70',
    'meta.vector': 'YNa0d11',
    'visual.text': 'Bình thường', 'visual.eval': 'Đạt', 'ir.t': '32', 'vector.result': 'YNa0d11',
    'b.hv.t': '35', 'b.hv.btype': 'OIP', 'b.hv.kmode': 'Theo QĐ 1901 – bảng hệ số K', 'b.hv.mount': 'Đã lắp', 'b.hv.tamb': '30',
    'b.mv.t': '35', 'b.mv.btype': 'RIP', 'b.mv.kmode': 'Hitachi Energy (RIP) – theo HD hãng', 'b.mv.mount': 'Đã lắp', 'b.mv.tamb': '30',
    'b.lv.t': '35', 'b.lv.btype': 'RIP', 'b.lv.kmode': 'Nhập hệ số K', 'b.lv.mount': 'Chưa lắp', 'b.lv.tamb': '30', 'b.lv.k': '1,1',
    'wtgd.t': '32', 'dcr.hv.t': '30', 'dcr.mv.t': '30', 'dcr.lv.t': '30',
    'oltc.type': 'VUCGN 380/1000', 'oltc.eval': 'Đạt', 'moist.val': '1,5', 'bct.t_ir': '30', 'bct.polarity': 'Subtractive', 'bct.t_dcr': '30',
  });
  return { state: { v, cfg }, schema };
}

function emptyState(Schema) {
  const cfg = defaultCfg(Schema);
  return { state: { v: {}, cfg }, schema: Schema.build(cfg) };
}

// Bảng tra xuất xưởng giả, cùng giao diện với api() trong js/factory.js
function fakeFactory() {
  const units = { 'SN-A': { serial: 'SN-A', machine: 1, phase: 'A', noLoadLoss: 58 }, 'SN-B': { serial: 'SN-B', machine: 2, phase: 'B', noLoadLoss: 59 },
    'SN-C': { serial: 'SN-C', machine: 3, phase: 'C', noLoadLoss: 61 } };
  const errOf = { 'SN-A': 0.05, 'SN-B': -0.03, 'SN-C': 0.1 };
  const data = {
    order: ['SN-A', 'SN-B', 'SN-C'], units,
    specs: { vector: 'YNa0d11', oltc: 'VUCGN 380/1000', current: { LV: '2000' }, power: { LV: '50', HV: '150' } },
    ratio: { taps: [], mvlv: { lvKV: 22, nominal: 5.9, err: errOf } }, bushingCriteria: {}, conditions: {},
  };
  const ins = { r15: 7000, r60: 11000, r600: 22000, tgd: 0.22, c: 7900 };
  return {
    data,
    has: s => !!units[s],
    unit: s => units[s] || null,
    ratioTap: tap => (tap ? { tap: String(tap).toUpperCase(), nominal: 2.2, hvKV: 500, mvKV: 227, err: errOf } : null),
    dcr: (w, tap, s) => (units[s] ? { r75: w === 'COM' ? 0.08 : 0.15, meas: 0.2, tap: String(tap || '').toUpperCase(), refT: 75, measT: 25 } : null),
    ins: (cfg, param, s) => (units[s] && ins[param] !== undefined ? ins[param] : null),
    insT: s => (units[s] ? 25 : null),
    bushingBySerial: bs => (/^S-hv-/.test(String(bs)) ? { serial: bs, td: 0.33, c1: 445, t: 22, c2: 2900, td2: 0.45 } : null),
    bushingByUnit: (s, term) => (units[s] ? { serial: `${s}-${term}`, td: 0.34, c1: 448, t: 22 } : null),
    bushingSpec: term => ({ terminal: term, ac: term === '2' ? 140 : 680 }),
    bct: (s, term) => (units[s] ? { ratio: 1000, ratioText: '1000/1', err: 0.02, r75: 5.5, terminal: term } : null),
    moisture: s => (units[s] ? 1.2 : null),
  };
}

module.exports = { defaultCfg, fullState, emptyState, fakeFactory };
