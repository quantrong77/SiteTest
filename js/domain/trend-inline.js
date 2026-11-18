// Xu hướng ngay tại ô nhập (hàm thuần): ghép lịch sử đo của cùng thiết bị và cùng đại lượng với giá trị đang nhập,
// tính % so với mốc khởi đầu (FAT, không có thì lần sớm nhất — như view v_trend_delta) và so với lần đo trước.
// Chỉ để tham khảo khi nhập; đánh giá chính thức vẫn ở mục kết quả. Không truy cập giao diện hay CSDL.
(function () {
  'use strict';
  const KEY = ['item', 'param', 'config', 'phase', 'tap'];
  const same = (a, b) => KEY.every(k => String(a[k] ?? '') === String(b[k] ?? ''));
  const num = x => (x === null || x === undefined || x === '' ? NaN : Number(x));
  const pct = (value, base) => (Number.isFinite(value) && Number.isFinite(base) && base !== 0
    ? Math.round((value - base) / Math.abs(base) * 100000) / 1000 : null);
  const serial = x => String(x || '').trim().toUpperCase();

  // history: dòng v_trend_delta; target: { item, param, config, phase, tap, serial_no, value_cmp, cmp_basis }
  // opts: { sessionId (phiên đang mở — loại ra), testDate (ISO; chỉ lấy lần đo trước ngày này) }
  function series(history, target, opts = {}) {
    const cur = num(target.value_cmp);
    let old = (history || []).filter(r => (!opts.sessionId || r.session_id !== opts.sessionId)
      && (!target.serial_no || serial(r.serial_no) === serial(target.serial_no))
      && same(r, target) && Number.isFinite(num(r.value_cmp))
      && (!opts.testDate || !r.test_date || String(r.test_date) < opts.testDate));
    // không so giá trị quy đổi với giá trị thô; ô trống thì hiện lịch sử theo cơ sở có nhiều số liệu quy đổi (norm) trước
    const basis = Number.isFinite(cur) && target.cmp_basis ? target.cmp_basis
      : (old.some(r => r.cmp_basis === 'norm') ? 'norm' : 'raw');
    old = old.filter(r => (r.cmp_basis || 'raw') === basis)
      .sort((a, b) => String(a.test_date || '').localeCompare(String(b.test_date || '')));
    if (!old.length) return null;
    const base = old.find(r => r.kind === 'FAT') || old[0];
    const previous = old[old.length - 1];
    const points = old.map(r => num(r.value_cmp));
    if (Number.isFinite(cur)) points.push(cur);
    return {
      history: old, base, previous, basis, points, hasCurrent: Number.isFinite(cur),
      fromBase: pct(cur, num(base.value_cmp)),
      fromPrevious: previous === base && base.kind === 'FAT' ? null : pct(cur, num(previous.value_cmp)),
    };
  }

  // Tô vàng chỉ khi đại lượng có ngưỡng QĐ 1901 so với giá trị khởi đầu (bộ tiêu chí L = Criteria.limits()):
  // độ lệch hai chiều (R một chiều, tỷ số, điện dung), mức tăng (tgδ) hoặc mức giảm so với khởi đầu HOẶC lần trước
  // (R60@20 cách điện cuộn dây — Điều 29 mục 3). Không có ngưỡng thì không tô.
  const RULES = {
    'DCR:R': ['DCR_DEV', 'abs'], 'RATIO:K': ['RATIO_DEV', 'abs'], 'WTGD:C': ['WINDING_C_DEV', 'abs'],
    'BUSHING:C1': ['BUSHING_C1_DEV', 'abs'], 'WTGD:TGD': ['WINDING_TGD_RISE', 'rise'], 'BUSHING:TGD1': ['BUSHING_TGD_RISE_WARN', 'rise'],
    'IR:R60': ['IR_DROP', 'drop'],
  };
  function warn(target, fromBase, L, fromPrevious) {
    const r = RULES[`${target.item}:${target.param}`];
    const lim = r && L ? Number(L[r[0]]) : NaN;
    if (!Number.isFinite(lim)) return false;
    if (r[1] === 'drop') return [fromBase, fromPrevious].some(d => d !== null && Number.isFinite(d) && d < -lim);
    if (!Number.isFinite(fromBase)) return false;
    return r[1] === 'rise' ? fromBase > lim : Math.abs(fromBase) > lim;
  }

  window.TrendInline = { series, warn, pct, KEY };
})();
