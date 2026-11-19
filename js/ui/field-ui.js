// Trang "Nhập hiện trường" (HT): nhập từng ô trên điện thoại / máy tính bảng — một ô lớn, nút Trước / Tiếp lớn,
// đọc số bằng giọng nói tự sang ô kế, bản đồ ô để nhảy nhanh, đánh giá ngay dưới ô. Ô nhập vẫn là [data-k] trong #main
// nên dùng chung xử lý nhập, hoàn tác, lưu, đánh giá của app (không có đường ghi riêng).
(function () {
  'use strict';
  const LS = 'bbtn-mba.field';
  const ST_TEXT = { pass: 'Đạt', warn: 'Cần xem xét', fail: 'Không đạt', missing: 'Thiếu dữ liệu', info: 'Tham khảo' };
  let F = { sec: '', grid: '', order: {}, idx: 0 };
  try { F = Object.assign(F, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) { /* bỏ qua */ }
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(F)); } catch (e) { /* tùy chọn */ } };
  const esc = s => App.esc(s);
  const val = k => String(App.state.v[k] ?? '').trim();
  const TU = () => (window.TypeUI || {})[EquipmentTypes.codeOf(App.state)] || {};
  const rowLabel = () => (TU().rowLabel ? (g, r) => TU().rowLabel(g, r, App) : null);

  const allCells = sec => FieldEntry.cells(App.schema, sec, { order: F.order, rowLabel: rowLabel() });
  const sections = () => App.schema.sections.map(s => ({ s, n: allCells(s.id).length })).filter(x => x.n);
  function list() {
    const secs = sections();
    if (!secs.some(x => x.s.id === F.sec)) F.sec = secs.length ? secs[0].s.id : '';
    const all = F.sec ? allCells(F.sec) : [];
    const grids = [...new Map(all.map(c => [c.grid || '__f', c.grid ? `${c.group ? c.group + ' › ' : ''}${c.gridTitle || c.grid}` : 'Thông số đo (nhiệt độ…)'])).entries()];
    if (F.grid && !grids.some(([id]) => id === F.grid)) F.grid = '';
    const cells = F.grid ? all.filter(c => (c.grid || '__f') === F.grid) : all;
    F.idx = Math.max(0, Math.min(F.idx, cells.length - 1));
    return { secs, all, grids, cells };
  }
  const findingOf = key => {
    let best = null;
    (App.res.findings || []).forEach(f => { if ((f.keys || []).includes(key) && (!best || Common.RANK[f.status] > Common.RANK[best.status])) best = f; });
    return best;
  };

  function statusHTML(c) {
    if (!c) return '';
    const f = findingOf(c.key), v = val(c.key);
    if (!v) return '<span class="badge st-none">Chưa nhập</span>';
    if (!f) return '<span class="badge st-info">Đã nhập</span>';
    return `<span class="badge st-${f.status}">${f.status === 'fail' ? '✕ ' : f.status === 'warn' ? '! ' : ''}${ST_TEXT[f.status] || ''}</span>`
      + `${f.conv ? ` <span class="fe-conv">${esc(f.conv)}</span>` : ''}${f.dev ? ` <span class="fe-conv">Lệch ${esc(f.dev)}</span>` : ''}`
      + `${f.limit ? `<div class="fe-limit">${esc(f.limit)}</div>` : ''}`;
  }
  function chipsHTML(cells) {
    let h = '', last = null;
    cells.forEach((c, i) => {
      const grp = c.grid ? `${c.group ? c.group + ' › ' : ''}${c.gridTitle || c.grid}` : 'Thông số đo';
      if (grp !== last) { h += `${last === null ? '' : '</div>'}<div class="fe-map-t">${esc(grp)}</div><div class="fe-map-g">`; last = grp; }
      const f = val(c.key) ? findingOf(c.key) : null;
      h += `<button type="button" class="fe-chip${val(c.key) ? ' on' : ''}${f ? ' st-' + f.status : ''}${i === F.idx ? ' cur' : ''}" data-fe-go="${i}" title="${esc(c.label)}${val(c.key) ? ': ' + esc(val(c.key)) : ''}" aria-label="Ô ${i + 1}: ${esc(c.label)}${val(c.key) ? ', ' + esc(val(c.key)) : ', trống'}">${i + 1}</button>`;
    });
    return h + (last === null ? '' : '</div>');
  }

  function render() {
    const { secs, all, grids, cells } = list();
    if (!secs.length) return '<section class="panel"><div class="panel-head"><span class="secno">HT</span><h2>Nhập hiện trường</h2></div><div class="empty">Biên bản này không có ô số liệu để nhập theo từng ô.</div></section>';
    const c = cells[F.idx], sec = App.schema.sections.find(s => s.id === F.sec);
    const skipped = App.res.sec && App.res.sec[F.sec] && App.res.sec[F.sec].skipped;
    const n = cells.length, done = FieldEntry.filled(cells, App.state.v);
    const voice = !!window.VoiceInput, on = voice && VoiceInput.active;
    let h = `<div class="panel-head"><span class="secno">HT</span><h2>Nhập hiện trường</h2><span class="en">Field entry</span></div>`;
    h += `<div class="fe-top"><label class="field"><span>Hạng mục</span><select data-fe-sel="sec">${secs.map(x => `<option value="${x.s.id}" ${x.s.id === F.sec ? 'selected' : ''}>${esc(`${x.s.no}. ${x.s.title}`)} (${x.n})</option>`).join('')}</select></label>`
      + `<label class="field"><span>Bảng</span><select data-fe-sel="grid"><option value="">Tất cả bảng (${all.length} ô)</option>${grids.map(([id, t]) => `<option value="${esc(id)}" ${id === F.grid ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label></div>`;
    if (skipped) h += '<div class="callout warn">Hạng mục đang <b>không thực hiện</b> — số liệu nhập vẫn lưu nhưng không đánh giá. Tích “Thực hiện” ở trang đầy đủ của hạng mục.</div>';
    h += `<div class="fe-progress"><span><b>${done}/${n}</b> ô đã nhập</span><span class="wf-meter" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${done}" aria-label="${done}/${n} ô"><span style="width:${n ? Math.round(done / n * 100) : 0}%"></span></span></div>`;
    h += `<div class="fe-card">
      <div class="fe-pos">Ô <b data-fe-pos>${F.idx + 1}</b>/${n}<span class="fe-crumb" data-fe-crumb>${esc(c.grid ? `${c.group ? c.group + ' › ' : ''}${c.gridTitle}` : (c.group || sec.title))}</span></div>
      <div class="fe-label" data-fe-label>${c.kind === 'cell' ? `<span class="fe-row">${esc(c.rowLabel)}</span><span class="fe-col">${esc(c.colLabel)}</span>` : `<span class="fe-col">${esc(c.label)}</span>`}</div>
      <input class="fe-input" data-k="${esc(c.key)}" data-fe="cell" value="${esc(val(c.key))}" inputmode="${on ? 'none' : 'decimal'}" enterkeyhint="next" autocomplete="off" aria-label="${esc(c.label)}" aria-describedby="feStatus">
      <div class="fe-status" id="feStatus" aria-live="polite" data-fe-status>${statusHTML(c)}</div>
      <div class="fe-heard" aria-live="polite" data-fe-heard></div>
    </div>`;
    h += `<div class="fe-nav"><button type="button" class="btn fe-big" data-fe-act="prev" aria-label="Ô trước">◀ Trước</button>`
      + (voice ? `<button type="button" class="btn fe-big${on ? ' primary' : ''}" data-voice="continuous" aria-pressed="${on}" aria-label="Đọc số bằng giọng nói, tự sang ô kế">${on ? '■ Dừng đọc' : '🎙 Đọc số'}</button>` : '')
      + `<button type="button" class="btn fe-big primary" data-fe-act="next" aria-label="Ô tiếp">Tiếp ▶</button></div>`;
    h += `<div class="fe-aux"><button type="button" class="btn small" data-fe-act="empty">Ô trống kế tiếp</button><button type="button" class="btn small" data-fe-act="clear">Xóa ô</button>`
      + (c.kind === 'cell' ? `<button type="button" class="btn small" data-fe-act="order" title="Đổi thứ tự đi ô của bảng này">Thứ tự: ${(F.order[c.grid] || 'auto') === 'auto' ? 'tự động' : F.order[c.grid] === 'row' ? 'theo hàng' : 'theo cột'}</button>` : '')
      + `<button type="button" class="btn small" data-nav="${F.sec}">Trang đầy đủ</button></div>`;
    h += voice ? `<div class="fe-voiceopt">${VoiceInput.readbackHTML()}</div>` : '';
    h += voice ? '<div class="hint-text">Mỗi số nhận được: tiếng bíp, rung (Android), ô nháy xanh; không hiểu: hai tiếng bíp thấp. Giọng nói: đọc số (vd “bốn nghìn năm trăm”, “không phẩy ba lăm”, “2 phẩy 5”); lệnh <b>bỏ qua</b>, <b>lùi</b>, <b>xóa</b>, <b>dừng</b>. Cần mạng và cho phép micro; trang phải mở qua https.</div>'
      : '<div class="hint-text">Trình duyệt này không hỗ trợ nhập bằng giọng nói (dùng Chrome / Edge / Safari).</div>';
    h += `<details class="fe-mapbox" ${n <= 60 ? 'open' : ''}><summary>Bản đồ ô — chạm để nhảy tới ô</summary><div class="fe-map">${chipsHTML(cells)}</div></details>`;
    return `<section class="panel fe" data-fe-page>${h}</section>`;
  }

  // Đổi ô tại chỗ (không vẽ lại trang) để giữ bàn phím trên điện thoại
  function paint(focus) {
    const inp = document.querySelector('#main input[data-fe="cell"]');
    if (!inp) return;
    const { cells } = list(), c = cells[F.idx];
    if (!c) return;
    if (inp.dataset.k !== c.key) {
      inp.dataset.k = c.key; inp.value = val(c.key); inp.setAttribute('aria-label', c.label);
      inp.classList.remove('st-pass', 'st-warn', 'st-fail', 'st-missing', 'st-info'); inp.removeAttribute('aria-invalid'); inp.title = '';
      const sec = App.schema.sections.find(s => s.id === F.sec);
      document.querySelector('[data-fe-pos]').textContent = F.idx + 1;
      document.querySelector('[data-fe-crumb]').textContent = c.grid ? `${c.group ? c.group + ' › ' : ''}${c.gridTitle}` : (c.group || (sec && sec.title) || '');
      document.querySelector('[data-fe-label]').innerHTML = c.kind === 'cell' ? `<span class="fe-row">${esc(c.rowLabel)}</span><span class="fe-col">${esc(c.colLabel)}</span>` : `<span class="fe-col">${esc(c.label)}</span>`;
      // ô mới: báo cho app (mốc hoàn tác của ô, trạng thái đánh giá)
      inp.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    }
    refresh();
    if (focus) { inp.focus({ preventScroll: true }); inp.select?.(); }
    save();
  }
  // Sau mỗi lần đánh giá lại (app gọi): cập nhật trạng thái, tiến độ, bản đồ ô
  function refresh() {
    const page = document.querySelector('[data-fe-page]');
    if (!page) return;
    const { cells } = list(), c = cells[F.idx];
    const st = page.querySelector('[data-fe-status]'); if (st) st.innerHTML = statusHTML(c);
    const n = cells.length, done = FieldEntry.filled(cells, App.state.v);
    const pr = page.querySelector('.fe-progress');
    if (pr) { pr.querySelector('b').textContent = `${done}/${n}`; const m = pr.querySelector('.wf-meter'); m.setAttribute('aria-valuenow', done); m.firstElementChild.style.width = `${n ? Math.round(done / n * 100) : 0}%`; }
    const map = page.querySelector('.fe-map'); if (map) map.innerHTML = chipsHTML(cells);
  }
  function step(d) {
    const { cells } = list();
    if (d > 0 && F.idx >= cells.length - 1) {
      const e = FieldEntry.nextEmpty(cells, App.state.v, F.idx);
      App.toast(e < 0 ? 'Đã nhập hết các ô của bảng này.' : `Hết bảng — còn ô trống (ô ${e + 1}). Bấm “Ô trống kế tiếp”.`);
      return;
    }
    F.idx = Math.max(0, Math.min(cells.length - 1, F.idx + d));
    paint(true);
  }
  function go(i) { F.idx = i; paint(true); }
  // mở trang ở một hạng mục (nút trên trang đầy đủ)
  function open(secId) { if (secId) { F.sec = secId; F.grid = ''; F.idx = 0; } save(); App.go('field'); }

  function afterRender() {
    const inp = document.querySelector('#main input[data-fe="cell"]');
    if (inp && !matchMedia('(pointer: coarse)').matches) inp.focus({ preventScroll: true });
    if (inp) inp.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-fe-act], [data-fe-go], [data-fe-open]');
    if (!b) return;
    if (b.dataset.feOpen !== undefined) { open(b.dataset.feOpen); return; }
    if (b.dataset.feGo !== undefined) { go(+b.dataset.feGo); return; }
    const act = b.dataset.feAct;
    if (act === 'prev') step(-1);
    else if (act === 'next') step(1);
    else if (act === 'empty') { const { cells } = list(); const i = FieldEntry.nextEmpty(cells, App.state.v, F.idx); if (i < 0) App.toast('Đã nhập hết các ô.'); else go(i); }
    else if (act === 'clear') { const inp = document.querySelector('#main input[data-fe="cell"]'); if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); inp.focus(); } }
    else if (act === 'order') {
      const { cells } = list(), c = cells[F.idx], cur = F.order[c.grid] || 'auto';
      F.order[c.grid] = cur === 'auto' ? 'row' : cur === 'row' ? 'col' : 'auto';
      // giữ nguyên ô đang xem sau khi đổi thứ tự
      const after = list().cells; F.idx = Math.max(0, after.findIndex(x => x.key === c.key)); save(); App.renderMain();
    }
  });
  document.addEventListener('change', e => {
    const s = e.target.closest && e.target.closest('[data-fe-sel]');
    if (!s) return;
    if (s.dataset.feSel === 'sec') { F.sec = s.value; F.grid = ''; } else F.grid = s.value;
    F.idx = 0; save(); App.renderMain();
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.matches || !e.target.matches('#main input[data-fe="cell"]')) return;
    e.preventDefault();
    // Enter: ghi ô (change) rồi sang ô kế; Shift+Enter lùi
    e.target.dispatchEvent(new Event('change', { bubbles: true }));
    step(e.shiftKey ? -1 : 1);
  });
  document.addEventListener('voice:heard', e => {
    const box = document.querySelector('[data-fe-heard]');
    if (!box) return;
    const d = e.detail || {};
    box.textContent = d.error ? `Nghe: “${d.text}” — ${d.error}` : d.cmd ? `Lệnh: ${d.text}` : `Nghe: “${d.text}” → ${d.value}`;
    box.classList.toggle('bad', !!d.error);
  });
  document.addEventListener('voice:state', () => {
    document.querySelectorAll('[data-fe-page] [data-voice]').forEach(b => { b.classList.toggle('primary', VoiceInput.active); });
  });

  window.FieldUI = { render, afterRender, refresh, step, go, open };
})();
