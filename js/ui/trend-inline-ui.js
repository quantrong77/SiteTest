// Xu hướng ngay tại ô nhập: tải lịch sử đo của các thiết bị trong biên bản (theo số chế tạo — cả biên bản mới đang lập ở
// hiện trường, không cần lưu CSDL trước), lưu tạm trong trình duyệt để dùng khi mất mạng; dưới mỗi ô số có lịch sử hiện biểu
// đồ nhỏ và % thay đổi của giá trị đang nhập so với xuất xưởng / lần trước. Lịch sử cũng được đưa vào đánh giá các tiêu chí
// so với giá trị khởi đầu / lần trước (vd R60@20 giảm >30%, QĐ 1901 Điều 29 mục 3) qua history().
(function () {
  'use strict';
  const PREFIX = 'bbtn-mba.trend-inline.';
  let hist = [], loadedFor = '', cells = new Map(), ctx = null, seq = 0;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = v => (Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%` : '—');
  const readCache = k => { try { return JSON.parse(localStorage.getItem(PREFIX + k) || '[]'); } catch (_) { return []; } };
  const writeCache = (k, rows) => { try { localStorage.setItem(PREFIX + k, JSON.stringify(rows)); } catch (_) { /* đầy bộ nhớ: chỉ dùng trong phiên */ } };

  // Dòng CSDL của biên bản (kèm khóa ô); thiếu số chế tạo máy chính thì loại thiết bị báo lỗi → không có xu hướng
  function rowsOf({ state, schema, type, res }, fill) {
    if (!type || !type.toRows || !state || !schema || !res) return null;
    let st = state;
    // ô trống: điền tạm để biết ô thuộc đại lượng / thiết bị nào (giá trị tạm không dùng để tính)
    if (fill) {
      const v = Object.assign({}, state.v);
      Common.eachGrid(schema, g => g.rows.forEach(r => g.cols.forEach(c => {
        const k = `${g.id}.${r.k}.${c.k}`;
        if (!g.readonly && !c.calc && !c.text && !r.text && String(v[k] ?? '').trim() === '') v[k] = '1';
      })));
      st = Object.assign({}, state, { v });
    }
    try { return type.toRows.fieldRows(st, res, schema, { withKey: true }); } catch (e) { console.warn('Xu hướng tại ô:', e.message); return null; }
  }
  const serialsOf = pack => [...new Set(pack.refs.map(r => r.serial_no).filter(Boolean))].sort();

  // Mỗi lần dựng trang: ánh xạ ô → { khóa đại lượng, số chế tạo } (chỉ khi đã có lịch sử)
  // c: { state, schema, type, res } của biên bản đang mở (res: kết quả đánh giá hiện tại, fieldRows cần)
  function prepare(c) {
    ctx = c;
    cells = new Map();
    if (!hist.length) return;
    const pack = rowsOf(ctx, true);
    if (!pack) return;
    const ser = new Map(pack.refs.map(r => [r.key, r.serial_no]));
    pack.rows.forEach(r => { if (r.key) cells.set(r.key, { item: r.item, param: r.param, config: r.config, phase: r.phase, tap: r.tap, serial_no: ser.get(r.eq) }); });
  }
  const has = key => cells.has(key);

  // Giá trị đang nhập đã quy đổi (như khi lưu CSDL): value_norm nếu có, không thì value
  function currentValues() {
    const pack = ctx && rowsOf(ctx, false);
    const out = new Map();
    if (pack) pack.rows.forEach(r => {
      if (!r.key) return;
      const norm = Number.isFinite(r.value_norm) ? r.value_norm : null;
      out.set(r.key, Object.assign(norm !== null ? { value_cmp: norm, cmp_basis: 'norm' } : { value_cmp: r.value, cmp_basis: 'raw' },
        { value: r.value, temp_c: r.temp_c, unit: r.unit, norm_temp_c: r.norm_temp_c }));
    });
    return out;
  }

  function spark(points, hasCurrent) {
    const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
    const xy = points.map((y, i) => [points.length > 1 ? i * 100 / (points.length - 1) : 50, 23 - (y - min) / span * 20]);
    const end = xy[xy.length - 1];
    return `<svg viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true"><polyline points="${xy.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}"/>`
      + `${hasCurrent ? `<circle cx="${end[0].toFixed(1)}" cy="${end[1].toFixed(1)}" r="3"/>` : ''}</svg>`;
  }

  const ICON = '<svg class="ti-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3v18h18"/><path d="m6 15 4-5 4 3 6-7"/><path d="M16 6h4v4"/></svg>';
  const tapLbl = t => (t.tap ? `nấc ${String(t.tap).toLowerCase()}` : '');
  function html(target, cur, key) {
    const st = ctx.state;
    const s = TrendInline.series(hist, Object.assign({}, target, cur || {}), {
      sessionId: st.db && st.db.sessionId, testDate: Common.isoDate(st.v['meta.date']) || '',
    });
    if (!s) return '';
    const yellow = TrendInline.warn(target, s.fromBase, window.Criteria ? Criteria.limits() : null, s.fromPrevious);
    // dự báo 3 năm (tham khảo, TrendForecast): các lần đo từ mốc khởi đầu + giá trị đang nhập; chỉ báo khi xu hướng có ý nghĩa thống kê
    let fcw = null;
    if (window.TrendForecast && s.hasCurrent) {
      const date = Common.isoDate(st.v['meta.date']);
      const pts = s.history.filter(r => !s.base.test_date || String(r.test_date) >= String(s.base.test_date)).map(r => ({ date: r.test_date, value: r.value_cmp }));
      if (date) pts.push({ date, value: Number(s.points[s.points.length - 1]) });
      const L = window.Criteria ? Criteria.limits() : null;
      fcw = TrendForecast.warning(TrendForecast.forecast(pts, 3, TrendForecast.limitsFor(target.item, target.param, s.base.value_cmp, L)));
      if (fcw && fcw.status !== 'predicted') fcw = null; // đã vượt: cảnh báo tô vàng / mục đánh giá đã báo
    }
    const bi = TrendInline.baseInfo(s.base, target.item), baseLbl = bi.short;
    const lines = s.hasCurrent
      ? [`${baseLbl} ${fmt(s.fromBase)}`].concat(s.fromPrevious !== null ? [`Trước ${fmt(s.fromPrevious)}`] : [])
      : [`${s.history.length} lần trước`];
    if (fcw) lines.push(`Dự báo ⚠ ${String(fcw.date).slice(0, 7).split('-').reverse().join('/')}`);
    const title = `Xu hướng tham khảo (${s.history.length} lần đo trước${s.basis === 'norm' ? ', giá trị đã quy đổi nhiệt độ' : ''}). `
      + `${bi.short}: so với ${bi.name}${s.base.test_date ? ` (${String(s.base.test_date).split('-').reverse().join('/')})` : ''}${s.fromPrevious !== null ? '; Trước: so với lần đo gần nhất' : ''}. `
      + `Đánh giá chính thức ở mục kết quả.${yellow ? ' Vượt ngưỡng QĐ 1901 so với giá trị khởi đầu.' : ''}`
      + (fcw ? ` Dự báo (tham khảo): xu hướng có ý nghĩa thống kê (p = ${fcw.pValue !== null && fcw.pValue !== undefined ? fcw.pValue.toFixed(3).replace('.', ',') : '?'}), chạm ngưỡng QĐ 1901 khoảng ${String(fcw.date).split('-').reverse().join('/')} (~${fcw.yearsFromLast.toFixed(1).replace('.', ',')} năm) — xem trang Xu hướng.` : '');
    const what = [target.config, tapLbl(target), target.phase ? `pha ${target.phase}` : ''].filter(Boolean).join(' · ');
    const btn = key && window.DbUI && DbUI.openSeries
      ? `<button type="button" class="trend-open" data-trend-open="${esc(key)}" title="Mở trang Xu hướng: ${esc(what)}" aria-label="Xem xu hướng ${esc(what)}">${ICON}</button>` : '';
    return `<span class="trend-inline${yellow || fcw ? ' is-warning' : ''}" title="${esc(title)}">${btn}${spark(s.points, s.hasCurrent)}${lines.map(l => `<span>${esc(l)}</span>`).join('')}</span>`;
  }

  // Vẽ/cập nhật gợi ý dưới các ô (gọi sau khi dựng trang và khi gõ)
  // res: kết quả đánh giá mới nhất (sau mỗi lần gõ)
  function decorate(root, res) {
    if (!hist.length || !ctx || !root) return;
    if (res) ctx = Object.assign({}, ctx, { res });
    const cur = currentValues();
    root.querySelectorAll('input[data-k]').forEach(input => {
      const k = input.dataset.k, target = cells.get(k), td = input.closest('td');
      if (!td) return;
      const old = td.querySelector('.trend-inline');
      const h = target ? html(target, cur.get(k), k) : '';
      if (!h) { if (old) old.remove(); return; }
      if (old) old.outerHTML = h; else td.insertAdjacentHTML('beforeend', h);
    });
  }

  // Tải lịch sử khi biên bản đã gắn thiết bị trong CSDL; gọi lại khi mở biên bản khác / đăng nhập. Không dựng lại trang.
  // onChange(): gọi khi lịch sử dùng để đánh giá thay đổi (bản lưu tạm hoặc bản mới tải) — app đánh giá lại ngay
  async function load(c, root, onChange) {
    ctx = c;
    const my = ++seq; // lượt tải mới nhất (mở biên bản khác trong lúc chờ thì bỏ kết quả cũ)
    // ô trống cũng tính (điền tạm): tải cả lịch sử máy các pha khác của tổ (BBTN riêng từng pha cần số liệu 2 pha còn lại)
    const pack = rowsOf(c, true);
    const serials = pack ? serialsOf(pack) : [];
    const key = serials.join('|');
    if (!key) { const had = hist.length; reset(); if (had && onChange) onChange(); return; }
    if (key !== loadedFor) {
      hist = readCache(key); loadedFor = key;
      if (onChange) onChange();
    }
    if (window.DB && DB.user && DB.trendForSerials) {
      try {
        const fresh = await DB.trendForSerials(serials);
        if (my !== seq || loadedFor !== key) return;
        const changed = JSON.stringify(fresh || []) !== JSON.stringify(hist);
        hist = fresh || [];
        writeCache(key, hist);
        if (changed && onChange) onChange();
      } catch (_) { /* mất mạng: dùng bản lưu tạm */ }
    }
    prepare(ctx); // trang có thể đã dựng lại trong lúc chờ: dùng ngữ cảnh mới nhất
    decorate(root);
  }
  function reset() { hist = []; loadedFor = ''; cells = new Map(); seq++; }
  const history = () => hist;

  const cellMap = () => cells;

  // Bấm icon xu hướng → trang Xu hướng của đúng máy (số chế tạo cột pha) và chuỗi số liệu (hạng mục · cuộn · nấc)
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-trend-open]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const key = b.dataset.trendOpen, target = cells.get(key);
    if (!target || !window.DbUI) return;
    const sec = window.App && App.currentSection ? App.currentSection() : '';
    const label = [target.config, tapLbl(target), target.phase ? `pha ${target.phase}` : ''].filter(Boolean).join(' · ');
    // số đang nhập (chưa lưu CSDL) → điểm "Biên bản đang nhập" trên biểu đồ
    const cur = currentValues().get(key), st = ctx && ctx.state;
    const current = cur && Number.isFinite(Number(cur.value_cmp)) ? Object.assign({}, target, cur, {
      test_date: (st && Common.isoDate(st.v['meta.date'])) || new Date().toISOString().slice(0, 10),
      session_id: st && st.db && st.db.sessionId || null, kind: 'CUR',
    }) : null;
    DbUI.openSeries(target, sec ? { sec, key, label } : null, current);
  });

  window.TrendInlineUI = { prepare, decorate, load, reset, has, history, cellMap };
})();
