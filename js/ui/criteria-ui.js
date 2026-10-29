// Trang "Bộ tiêu chí": các ngưỡng đánh giá theo QĐ 1901 và ngưỡng đơn vị đã chỉnh. Mọi người xem; chỉ admin chỉnh.
// Giá trị gốc QĐ 1901 luôn hiện cạnh giá trị đang áp dụng; ngưỡng đã chỉnh được ghi vào kết luận tự động của BBTN.
(function () {
  'use strict';
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => App.esc(s);
  const C = { loading: false, loaded: false };
  const isAdmin = () => typeof DB !== 'undefined' && DB.role === 'admin';
  const fmtV = v => String(v).replace('.', ',');
  const num = v => { const s = String(v ?? '').trim().replace(',', '.'); return s === '' ? '' : Number(s); };

  async function load(force) {
    if (C.loading || (C.loaded && !force)) return;
    C.loading = true;
    try {
      if (await CriteriaRepo.load()) App.rebuild(false);
      C.loaded = true;
    } catch (e) { App.toast('Lỗi tải bộ tiêu chí: ' + e.message, true); }
    finally { C.loading = false; }
  }

  function render() {
    const ed = isAdmin(), schema = App.schema;
    const secIdx = id => { const i = schema.sections.findIndex(x => x.id === id); return i < 0 ? 99 : i; };
    const list = Criteria.list().map((c, i) => Object.assign(c, { i })).sort((a, b) => secIdx(a.sec) - secIdx(b.sec) || a.i - b.i);
    const secTitle = id => { const s = schema.sections.find(x => x.id === id); return s ? `${s.no}. ${s.title}` : id; };
    const src = { db: 'CSDL', cache: 'bản sao lưu trên máy (lần tải gần nhất từ CSDL)', default: 'giá trị QĐ 1901 có sẵn trong app' }[Criteria.source];
    let h = '<div class="panel-head"><span class="secno">TC</span><h2>Bộ tiêu chí đánh giá</h2><span class="en">Assessment criteria</span></div>';
    h += `<div class="callout">Ngưỡng dùng để đánh giá Đạt / Không đạt. Mặc định theo <b>QĐ 1901/QĐ-EVNNPT</b>; Admin chỉnh được khi đơn vị áp dụng ngưỡng khác
      (hướng dẫn NSX, văn bản của đơn vị). Ngưỡng đã chỉnh được tô màu và <b>ghi vào kết luận tự động của BBTN</b> kèm giá trị QĐ 1901. Đang dùng: ${esc(src)}.
      Các bảng tra (K1, K2, Bảng 5, PI, độ ẩm) giữ nguyên theo QĐ 1901.</div>`;
    if (!DB.user) h += '<div class="callout warn">Chưa đăng nhập: chỉ xem. Đăng nhập tài khoản Admin để chỉnh ngưỡng.</div>';
    else if (!ed) h += '<div class="callout warn">Tài khoản của bạn chỉ được xem. Chỉnh ngưỡng cần quyền Admin.</div>';
    h += `<div class="grid-wrap"><table class="ftable crit-tbl"><thead><tr><th>Hạng mục</th><th>Tiêu chí</th><th>QĐ 1901</th><th>Đang áp dụng</th><th>Căn cứ</th><th>Ghi chú của đơn vị</th></tr></thead><tbody>`;
    let lastSec = '';
    list.forEach(c => {
      const sec = c.sec !== lastSec ? secTitle(c.sec) : '';
      lastSec = c.sec;
      h += `<tr class="${c.changed ? 'crit-changed' : ''}"><td>${esc(sec)}</td><td>${esc(c.label)}</td><td class="num">${fmtV(c.qd)}${c.unit ? ' ' + esc(c.unit) : ''}</td>
        <td class="num">${ed ? `<input class="crit-in" data-crit="${c.key}" value="${fmtV(c.value)}" inputmode="decimal" aria-label="${esc(c.label)} — giá trị áp dụng">` : `<b>${fmtV(c.value)}</b>`}${c.unit ? ' ' + esc(c.unit) : ''}${c.changed ? '<br><span class="badge st-warn">khác QĐ 1901</span>' : ''}</td>
        <td>${esc(c.source)}</td><td>${ed ? `<input class="crit-note" data-critnote="${c.key}" value="${esc(c.note)}" placeholder="vd HD NSX, văn bản số…">` : esc(c.note)}</td></tr>`;
    });
    h += '</tbody></table></div>';
    if (ed) h += '<div class="row-actions"><button class="btn" data-crit-act="reset">Khôi phục toàn bộ theo QĐ 1901</button><button class="btn primary" data-crit-act="save">Lưu bộ tiêu chí</button></div>';
    return `<section class="panel">${h}</section>`;
  }

  async function afterRender() {
    if (DB.user && !C.loaded) { await load(false); App.renderMain(); }
  }

  async function onClick(e) {
    const b = e.target.closest('[data-crit-act]');
    if (!b) return;
    try {
      if (!isAdmin()) throw new Error('Cần quyền Admin');
      if (b.dataset.critAct === 'reset') {
        if (!confirm('Khôi phục mọi ngưỡng về giá trị QĐ 1901? Các ghi chú của đơn vị cũng bị xóa.')) return;
        const r = await CriteriaRepo.save(Criteria.list().map(c => ({ key: c.key, value: '' })));
        App.rebuild(false); App.toast(`Đã khôi phục ${r.reset} ngưỡng theo QĐ 1901`);
        return;
      }
      const changes = [], bad = [];
      $$('[data-crit]').forEach(inp => {
        const key = inp.dataset.crit, v = num(inp.value), note = ($$(`[data-critnote="${key}"]`)[0] || {}).value || '';
        if (v !== '' && (!Number.isFinite(v) || v < 0)) bad.push(key);
        changes.push({ key, value: v === '' ? '' : v, note: note.trim() });
      });
      if (bad.length) throw new Error('Giá trị không hợp lệ (phải là số ≥ 0): ' + bad.map(k => (Criteria.list().find(c => c.key === k) || {}).label).join('; '));
      const r = await CriteriaRepo.save(changes);
      App.rebuild(false);
      App.toast(r.saved ? `Đã lưu bộ tiêu chí: ${r.saved} ngưỡng khác QĐ 1901` : 'Đã lưu: toàn bộ theo QĐ 1901');
    } catch (err) { App.toast(err.message, true); }
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-crit-act]')) onClick(e); });

  window.CriteriaUI = { render, afterRender, load, reset() { C.loaded = false; } };
})();
