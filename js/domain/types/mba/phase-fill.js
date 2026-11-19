// Tổ 3 máy 1 pha lập BBTN riêng từng pha (mẫu theo pha A / B / C): bổ sung số liệu 2 pha còn lại cho các hạng mục
// phải so sánh giữa các pha (QĐ 1901 Điều 9 mục 6, 7; Điều 33: R một chiều, tỷ số biến) từ CSDL — lần đo "cùng đợt",
// cách ngày thí nghiệm của biên bản không quá N ngày (cfg.campaignDays, mặc định 30). Hàm thuần: không đụng giao diện / CSDL.
(function () {
  'use strict';
  const PH = ['A', 'B', 'C'];
  const GRIDS = ['dcr.hv', 'dcr.mv', 'dcr.lv', 'ratio.hm', 'ratio.hl', 'ratio.ml'];
  const DEFAULT_DAYS = 30;
  const up = x => String(x || '').trim().toUpperCase();
  const num = x => (x === null || x === undefined || x === '' ? NaN : Number(x));
  const ok = x => Number.isFinite(x);
  const days = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
  const KEY = ['item', 'param', 'config', 'phase', 'tap'];
  const vn = (x, d) => String(+x.toFixed(d)).replace('.', ',');

  // pha của máy đang lập BBTN: theo mẫu (A / B / C), không thì theo số chế tạo
  function currentPhase(state) {
    const t = up(state.cfg.template);
    if (PH.includes(t)) return t;
    const sn = up(state.v['meta.serial']);
    return PH.find(p => sn && up((state.cfg.ps || {})[p]) === sn) || '';
  }
  // áp dụng: mẫu theo pha (không phải mẫu chung 3 pha / 3 pha 110–220 kV), có số chế tạo máy của ít nhất một pha khác
  function applies(state, schema) {
    if (!state || !schema || schema.layout !== '1P' || state.cfg.topology === 'bank1p') return null;
    const cur = currentPhase(state);
    if (!cur) return null;
    const others = PH.filter(p => p !== cur && String((state.cfg.ps || {})[p] || '').trim());
    return others.length ? { cur, others } : null;
  }
  const campaignDays = cfg => (ok(num(cfg.campaignDays)) && num(cfg.campaignDays) >= 0 ? num(cfg.campaignDays) : DEFAULT_DAYS);

  // opts: { state, schema, cells: Map khóa ô → { item, param, config, phase, tap, serial_no } (TrendInlineUI), history (v_trend_delta),
  //         sessionId (phiên đang mở — loại ra), val: khóa → số (đọc ô biên bản) }
  // → { fills: [{ k, value, phase, serial, date, note }], empty: [ô trống pha khác không có số liệu cùng đợt], days, date, reason }
  function plan(opts) {
    const { state, schema } = opts;
    const ap = applies(state, schema);
    if (!ap) return { fills: [], empty: [], reason: 'not-applicable' };
    const date = Common.isoDate(state.v['meta.date']);
    const N = campaignDays(state.cfg);
    if (!date) return { fills: [], empty: [], days: N, reason: 'no-date' };
    const fills = [], empty = [];
    const mine = new Set(ap.others.map(p => up(state.cfg.ps[p])));
    const hist = (opts.history || []).filter(h => mine.has(up(h.serial_no)) && h.test_date && days(h.test_date, date) <= N
      && (!opts.sessionId || h.session_id !== opts.sessionId) && (ok(num(h.value)) || ok(num(h.value_norm))));
    GRIDS.forEach(gid => {
      const g = Common.findGrid(schema, gid);
      if (!g) return;
      const dcr = gid.startsWith('dcr.');
      const curT = dcr ? opts.val(`${gid}.t`) : NaN;
      g.rows.forEach(r => ap.others.forEach(ph => {
        const k = `${gid}.${r.k}.${ph}`;
        if (String(state.v[k] ?? '').trim() !== '') return;
        const key = opts.cells && opts.cells.get(k);
        const serial = state.cfg.ps[ph];
        if (!key) { empty.push(k); return; }
        const cand = hist.filter(h => up(h.serial_no) === up(serial) && KEY.every(x => String(h[x] ?? '') === String(key[x] ?? '')));
        if (!cand.length) { empty.push(k); return; }
        const h = cand.sort((a, b) => days(a.test_date, date) - days(b.test_date, date))[0];
        let value = num(h.value), note = '';
        if (dcr) {
          // R một chiều: quy về nhiệt độ cuộn dây của biên bản (235 + t, cuộn đồng) để so cùng nhiệt độ với pha đang đo
          const norm = num(h.value_norm), nT = num(h.norm_temp_c), t0 = num(h.temp_c);
          if (ok(curT) && ok(norm) && ok(nT)) { value = norm * (235 + curT) / (235 + nT); note = `quy từ ${vn(num(h.value), 4)} mΩ @${ok(t0) ? vn(t0, 1) : '?'} °C về ${vn(curT, 1)} °C`; }
          else if (ok(curT) && ok(t0) && ok(value)) { value = value * (235 + curT) / (235 + t0); note = `quy từ ${vn(num(h.value), 4)} mΩ @${vn(t0, 1)} °C về ${vn(curT, 1)} °C`; }
          else note = `đo ở ${ok(t0) ? vn(t0, 1) : '?'} °C — nhập nhiệt độ cuộn dây để quy cùng nhiệt độ`;
        }
        if (!ok(value)) { empty.push(k); return; }
        fills.push({ k, value: vn(value, dcr ? 4 : 5), phase: ph, serial, date: h.test_date, note });
      }));
    });
    return { fills, empty, days: N, date, reason: '' };
  }

  window.MbaPhaseFill = { plan, applies, currentPhase, campaignDays, GRIDS, DEFAULT_DAYS };
})();
