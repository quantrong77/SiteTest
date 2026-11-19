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
      out.set(r.key, norm !== null ? { value_cmp: norm, cmp_basis: 'norm' } : { value_cmp: r.value, cmp_basis: 'raw' });
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

  function html(target, cur) {
    const st = ctx.state;
    const s = TrendInline.series(hist, Object.assign({}, target, cur || {}), {
      sessionId: st.db && st.db.sessionId, testDate: Common.isoDate(st.v['meta.date']) || '',
    });
    if (!s) return '';
    const yellow = TrendInline.warn(target, s.fromBase, window.Criteria ? Criteria.limits() : null, s.fromPrevious);
    const bi = TrendInline.baseInfo(s.base, target.item), baseLbl = bi.short;
    const lines = s.hasCurrent
      ? [`${baseLbl} ${fmt(s.fromBase)}`].concat(s.fromPrevious !== null ? [`Trước ${fmt(s.fromPrevious)}`] : [])
      : [`${s.history.length} lần trước`];
    const title = `Xu hướng tham khảo (${s.history.length} lần đo trước${s.basis === 'norm' ? ', giá trị đã quy đổi nhiệt độ' : ''}). `
      + `${bi.short}: so với ${bi.name}${s.base.test_date ? ` (${String(s.base.test_date).split('-').reverse().join('/')})` : ''}${s.fromPrevious !== null ? '; Trước: so với lần đo gần nhất' : ''}. `
      + `Đánh giá chính thức ở mục kết quả.${yellow ? ' Vượt ngưỡng QĐ 1901 so với giá trị khởi đầu.' : ''}`;
    return `<span class="trend-inline${yellow ? ' is-warning' : ''}" title="${esc(title)}">${spark(s.points, s.hasCurrent)}${lines.map(l => `<span>${esc(l)}</span>`).join('')}</span>`;
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
      const h = target ? html(target, cur.get(k)) : '';
      if (!h) { if (old) old.remove(); return; }
      if (old) old.outerHTML = h; else td.insertAdjacentHTML('beforeend', h);
    });
  }

  // Tải lịch sử khi biên bản đã gắn thiết bị trong CSDL; gọi lại khi mở biên bản khác / đăng nhập. Không dựng lại trang.
  // onChange(): gọi khi lịch sử dùng để đánh giá thay đổi (bản lưu tạm hoặc bản mới tải) — app đánh giá lại ngay
  async function load(c, root, onChange) {
    ctx = c;
    const my = ++seq; // lượt tải mới nhất (mở biên bản khác trong lúc chờ thì bỏ kết quả cũ)
    const pack = rowsOf(c, false);
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

  window.TrendInlineUI = { prepare, decorate, load, reset, has, history };
})();
