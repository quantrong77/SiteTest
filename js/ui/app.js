// Lõi giao diện Site Test Report: vẽ biểu mẫu theo schema của loại thiết bị, đánh giá tức thời, lưu/mở, xuất DOCX/XLSX.
// Phép tính, đánh giá, dòng CSDL và cách ghi BBTN do loại thiết bị khai báo (EquipmentTypes, js/domain/);
// phần giao diện riêng của từng loại ở TypeUI (js/ui/types/<loại>/ui.js).
(function () {
  'use strict';
  const LS_STATE = 'bbtn-mba.state.v1';
  const LS_TPL = 'bbtn-mba.customTemplate';
  const LS_FAC = 'bbtn-mba.customFactory';
  const ST_TEXT = Common.ST_TEXT;
  // Loại thiết bị sẽ thêm sau (đã có trong danh mục CSDL); nút Mới hiện để người dùng biết lộ trình
  const PLANNED = [['TI', 'Biến dòng điện (TI)'], ['TU', 'Biến điện áp (TU)'], ['KH', 'Kháng điện'], ['MC', 'Máy cắt'], ['DCL', 'Dao cách ly'],
    ['CSV', 'Chống sét van'], ['TD', 'Tụ điện'], ['CAP', 'Cáp'], ['GIS', 'GIS']];

  // Template & Test report nhúng sẵn (js/embedded.js, tự sinh, không đưa lên Git). Thiếu thì người dùng nạp file ở mục 0.
  const EMB = window.EMBEDDED || { templates: {}, factory: null };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); return true; } catch (e) { return false; } };

  let FX = null, state = null, schema = null, res = null, current = 'general';
  const filters = {};

  // ---------------------------------------------------------------- helpers
  function toast(msg, err) { Notify.show({ type: err ? 'error' : 'success', msg }); }
  function abToB64(buf) {
    const bytes = new Uint8Array(buf); let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const safeName = s => String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

  // Loại thiết bị của biên bản đang mở và phần giao diện riêng của loại đó
  const T = () => EquipmentTypes.get(EquipmentTypes.codeOf(state));
  const TU = () => (window.TypeUI || {})[EquipmentTypes.codeOf(state)] || {};
  const applyFactoryDefaults = cfg => { if (T().applyFactoryDefaults) T().applyFactoryDefaults(cfg, FX); };

  // ---------------------------------------------------------------- xóa / hoàn tác theo hạng mục
  let secOfFn = null, secOfSchema = null, editStart = null;
  const secOf = () => { if (secOfSchema !== schema) { secOfSchema = schema; secOfFn = Common.sectionOfKey(schema); } return secOfFn; };
  // Chạy một thao tác sửa số liệu (nhập file, điền tự động, xóa…) và ghi một bước hoàn tác cho mỗi hạng mục bị đổi
  async function track(label, fn) {
    const before = EditHistory.snapshot(state);
    try { return await fn(); } finally { EditHistory.record(label, before, state, secOf(), T().attSections); updateEditTools(); }
  }
  function undoSection(sec) {
    const st = EditHistory.undo(sec, state);
    if (!st) return;
    editStart = null;
    recompute(); renderNav(); renderMain(); persist();
    toast(`Đã hoàn tác: ${st.label}`);
  }
  function clearSection(sec) {
    const s = schema.sections.find(x => x.id === sec);
    if (!s || !EditHistory.hasData(sec, state, secOf(), T().attSections)) return;
    if (!confirm(`Xóa toàn bộ số liệu đã nhập của hạng mục ${s.no}. ${s.title}?\nCó thể hoàn tác bằng nút “Hoàn tác”.`)) return;
    let n = 0;
    track(`Xóa số liệu hạng mục ${s.no}`, () => { n = EditHistory.clearSection(sec, state, secOf(), T().attSections); }).then(() => {
      recompute(); renderNav(); renderMain(); persist();
      toast(`Đã xóa ${n} ô số liệu của hạng mục ${s.no} — bấm “Hoàn tác” nếu xóa nhầm`);
    });
  }
  function editToolsHTML(sec) {
    const n = EditHistory.count(sec), last = EditHistory.last(sec);
    const has = EditHistory.hasData(sec, state, secOf(), T().attSections);
    return `<div class="sec-edit" data-edittools="${sec}"><button class="btn small" data-undo="${sec}" ${n ? '' : 'disabled'} title="${esc(last ? `Hoàn tác: ${last.label} (Ctrl+Z)` : 'Chưa có thay đổi để hoàn tác')}">Hoàn tác<span class="n">${n ? ` · ${n}` : ''}</span></button>`
      + `<button class="btn small danger" data-clearsec="${sec}" ${has ? '' : 'disabled'} title="Xóa toàn bộ số liệu đã nhập của hạng mục này">Xóa số liệu hạng mục</button></div>`;
  }
  // Cập nhật nút sau khi gõ / nhập mà không vẽ lại trang
  function updateEditTools() {
    $$('[data-edittools]').forEach(box => { box.outerHTML = editToolsHTML(box.dataset.edittools); });
  }

  function templateData() {
    if (state.cfg.template === 'custom') {
      const b = lsGet(LS_TPL);
      if (b) return JSON.parse(b).b64;
      toast('Không tìm thấy template tùy chỉnh — dùng template có sẵn', true);
      state.cfg.template = 'A';
    }
    const t = EMB.templates[state.cfg.template] || Object.values(EMB.templates)[0];
    return t ? t.b64 : null;
  }
  function templateName() {
    if (state.cfg.template === 'custom') { const b = lsGet(LS_TPL); return b ? JSON.parse(b).name : '(thiếu)'; }
    return (EMB.templates[state.cfg.template] || {}).name || 'chưa có template';
  }

  // ---------------------------------------------------------------- state
  // keepCfg: giữ cấu hình của biên bản đang mở (cùng loại thiết bị)
  async function newRecord(keepCfg, type) {
    const code = type || EquipmentTypes.codeOf(state);
    const cfg = keepCfg ? JSON.parse(JSON.stringify(state.cfg)) : EquipmentTypes.get(code).defaultCfg();
    state = { type: code, v: {}, cfg, sum: { tick: {}, ev: {} }, att: {}, created: new Date().toISOString() };
    EditHistory.reset();
    applyFactoryDefaults(cfg);
    schema = T().buildSchema(state.cfg);
    await readTemplateDefaults();
    const key = T().templateKeyFor ? T().templateKeyFor(state, FX) : null;
    if (key && state.cfg.template !== 'custom' && key !== state.cfg.template && EMB.templates[key]) {
      state.cfg.template = key;
      state.v = {};
      await readTemplateDefaults();
    }
    if (!state.v['meta.reason']) state.v['meta.reason'] = T().report.defaultReason || '';
  }

  // Lấy giá trị sẵn có trong template (thông tin chung, Uo = 10 kV…) làm mặc định
  async function readTemplateDefaults() {
    const data = templateData();
    if (!data) return;
    Object.assign(state.v, Report.readDefaults(await DocxTemplate.load(data), schema));
  }

  let saveT = null;
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { lsSet(LS_STATE, JSON.stringify(state)); }, 350);
  }

  function recompute() {
    res = T().evaluate(state, FX, schema);
  }

  // ---------------------------------------------------------------- nav
  function navItems() {
    return [{ id: 'general', no: '0', title: 'Thông tin chung & cấu hình' }]
      .concat(schema.sections.map(s => ({ id: s.id, no: String(s.no), title: s.title })))
      .concat([{ id: 'summary', no: 'Σ', title: 'Tổng hợp & kết luận' }, { id: 'appendix', no: 'PL', title: 'Phụ lục BBTN' }, { id: 'factory', no: 'XX', title: 'Số liệu xuất xưởng' },
        { id: 'db', no: 'DB', title: 'CSDL – biên bản đã lưu' }, { id: 'catalog', no: '≡', title: 'Trạm – Ngăn – Thiết bị' }, { id: 'trend', no: '↗', title: 'Xu hướng' },
        { id: 'kconf', no: 'K', title: 'Hệ số quy đổi sứ' }, { id: 'criteria', no: 'TC', title: 'Bộ tiêu chí đánh giá' }]);
  }
  // Thanh điều hướng vẽ như sơ đồ một sợi: mỗi hạng mục là một ngăn lộ, trạng thái là ký hiệu máy cắt
  const BRK_LABEL = { pass: 'Đạt — máy cắt đóng', warn: 'Cần xem xét', fail: 'Không đạt — máy cắt cắt', missing: 'Thiếu dữ liệu', info: 'Tham khảo' };
  let navPrev = null;
  const navChangedAt = {};
  function renderNav() {
    const items = navItems();
    const first = !navPrev;
    navPrev = navPrev || {};
    let html = Workflow.progressHTML(schema.sections, res ? res.sec : {}, esc);
    items.forEach((it, i) => {
      if (i === 1) html += '<div class="nav-group">Hạng mục thí nghiệm</div>';
      if (it.id === 'summary') html += '<div class="nav-group">Kết quả</div>';
      if (it.id === 'db') html += '<div class="nav-group">Cơ sở dữ liệu</div>';
      const S = res && res.sec[it.id];
      const st = S && S.status ? S.status : '';
      // máy cắt "đóng/cắt" có hiệu ứng khi trạng thái vừa đổi (giữ 0,6 s vì thanh điều hướng có thể vẽ lại liên tiếp)
      if (!first && navPrev[it.id] !== st) navChangedAt[it.id] = Date.now();
      navPrev[it.id] = st;
      const flip = st && Date.now() - (navChangedAt[it.id] || 0) < 600 ? ' flip' : '';
      const fails = S && S.counts.fail ? `<span class="cnt">${S.counts.fail} lỗi</span>` : '';
      const tip = st ? BRK_LABEL[st] : (S ? 'Chưa nhập' : '');
      const wf = S ? Workflow.stateOf(S, current === it.id) : '';
      html += `<button class="nav-item ${current === it.id ? 'active' : ''}" data-nav="${it.id}" ${current === it.id ? 'aria-current="page"' : ''}>`
        + `<span class="brk ${st ? 'st-' + st : ''}${flip}" ${tip ? `title="${esc(tip)}"` : ''} aria-hidden="true"></span>`
        + `<span class="nav-no">${esc(it.no)}</span><span class="nav-t">${esc(it.title)}${fails}${wf ? `<span class="nav-st st-${wf}">${Workflow.STATE[wf]}</span>` : ''}</span>`
        + `${tip ? `<span class="sr-only">${esc(tip)}</span>` : ''}</button>`;
    });
    ($('#navItems') || $('#nav')).innerHTML = html;
  }
  function renderRecordChip() {
    const v = state.v, u = FX && FX.unit(v['meta.serial']);
    $('#recordChip').innerHTML = [
      `<span class="chip chip-type">${esc(T().label)}</span>`,
      `<span class="chip">S/N <b>${esc(v['meta.serial'] || '—')}</b>${u ? ` · pha ${esc(u.phase)}` : ''}</span>`,
      `<span class="chip">${esc(v['meta.date'] || 'chưa có ngày')}</span>`,
      `<span class="chip">${esc(v['meta.reason'] || '')}</span>`,
    ].join('');
  }

  // ---------------------------------------------------------------- ô đọc tự động cần kiểm tra (vd từ ảnh nameplate)
  // state.att.ocr[khóa] = { status: 'check' | 'missing', label, conf, why }; khóa cấu hình ghi "cfg.<đường dẫn>"
  const flagOf = k => (state.att && state.att.ocr && state.att.ocr[k]) || null;
  function flagHTML(k) {
    const fl = flagOf(k);
    if (!fl) return { cls: '', note: '' };
    const note = fl.status === 'missing' ? 'Không đọc được trên ảnh — nhập tay' : `Đọc từ ảnh, độ tin cậy ${fl.conf} %${fl.why ? ` (${fl.why})` : ''} — kiểm tra lại`;
    return { cls: ` flag-${fl.status}`, note: `<span class="note flag-note">${esc(note)}</span>` };
  }
  // Người dùng sửa ô → coi như đã kiểm tra, bỏ tô nền
  function clearFlag(k, el) {
    if (!flagOf(k)) return;
    delete state.att.ocr[k];
    const box = el && el.closest('.field');
    if (box) { box.classList.remove('flag-check', 'flag-missing'); const n = box.querySelector('.flag-note'); if (n) n.remove(); }
    const banner = $('[data-flagbanner]');
    if (banner) banner.outerHTML = flagBannerHTML();
  }
  function flagBannerHTML() {
    const fl = Object.entries((state.att && state.att.ocr) || {});
    if (!fl.length) return '<div data-flagbanner hidden></div>';
    const chk = fl.filter(([, x]) => x.status === 'check').map(([, x]) => x.label), miss = fl.filter(([, x]) => x.status === 'missing').map(([, x]) => x.label);
    return `<div class="callout warn flag-banner" data-flagbanner><b>Thông tin đọc từ ảnh nameplate cần xem lại.</b>
      ${chk.length ? `<div><span class="flag-key check"></span>Cần kiểm tra: ${chk.map(esc).join(', ')}</div>` : ''}
      ${miss.length ? `<div><span class="flag-key missing"></span>Không đọc được, cần nhập tay: ${miss.map(esc).join(', ')}</div>` : ''}
      <div class="row-actions"><button class="btn small" data-act="flagsDone">Đã kiểm tra hết — bỏ tô nền</button></div></div>`;
  }

  // ---------------------------------------------------------------- render primitives
  function fieldHTML(f, opts = {}) {
    const k = f.k, val = state.v[k] ?? '';
    const id = 'f_' + k.replace(/\W/g, '_');
    let ctrl;
    if (f.type === 'select') {
      ctrl = `<select id="${id}" data-k="${k}">${f.options.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    } else if (f.type === 'textarea') {
      ctrl = `<textarea id="${id}" data-k="${k}" placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>`;
    } else if (opts.calc) {
      ctrl = `<div class="calcval" data-c="${k}"></div>`;
    } else {
      const list = f.serial && FX ? ' list="dlSerials"' : '';
      ctrl = `<input id="${id}" data-k="${k}" value="${esc(val)}" ${f.num ? 'inputmode="decimal"' : ''} placeholder="${esc(f.placeholder || '')}"${list}>`;
    }
    const fl = flagHTML(k);
    return `<div class="field ${f.type === 'textarea' ? 'wide' : ''}${fl.cls}"><label for="${id}">${esc(f.label)}</label>${ctrl}${opts.note ? `<span class="note">${opts.note}</span>` : ''}${fl.note}</div>`;
  }
  function cfgField(path, label, opts = {}) {
    const val = path.split('.').reduce((o, p) => (o ? o[p] : ''), state.cfg) ?? '';
    const id = 'c_' + path.replace(/\W/g, '_');
    let ctrl;
    if (opts.options) ctrl = `<select id="${id}" data-cfg="${path}">${opts.options.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select>`;
    else ctrl = `<input id="${id}" data-cfg="${path}" value="${esc(Array.isArray(val) ? val.join(', ') : val)}" ${opts.list ? 'list="dlSerials"' : ''} ${opts.num ? 'inputmode="decimal"' : ''}>`;
    const fl = flagHTML('cfg.' + path);
    return `<div class="field ${opts.wide ? 'wide' : ''}${fl.cls}"><label for="${id}">${esc(label)}</label>${ctrl}${opts.note ? `<span class="note">${opts.note}</span>` : ''}${fl.note}</div>`;
  }

  function gridHTML(g) {
    const ro = !!g.readonly;
    const cpcBtn = TU().gridTools ? TU().gridTools(g, App) : '';
    let h = `<div class="grid-block">${g.title || cpcBtn ? `<div class="grid-title">${esc(g.title || '')}${cpcBtn}</div>` : ''}<div class="grid-wrap ${ro ? 'readonly' : ''}"><table class="grid" data-grid="${g.id}"><thead><tr><th>${esc(g.corner || '')}</th>`;
    // cột pha: gắn mã pha để tô vạch màu A vàng · B xanh · C đỏ
    g.cols.forEach(c => {
      const ph = c.phase ? String(c.k).charAt(0).toUpperCase() : '';
      const lbl = g.editHdr
        ? `<input class="hdr" data-hk="${g.id}.${c.k}" value="${esc(c.label)}" placeholder="${esc(c.defLabel)}" title="Sửa đề mục cột — để trống để dùng lại “${esc(c.defLabel)}”" autocomplete="off">`
        : esc(c.label);
      h += `<th${ph ? ` data-ph="${ph}" title="Pha ${ph}"` : ''}>${lbl}</th>`;
    });
    h += '</tr></thead><tbody>';
    g.rows.forEach((r, ri) => {
      const typeLbl = TU().rowLabel ? TU().rowLabel(g, r, App) : null;
      if (g.editLabels) {
        h += `<tr><th class="lbl-cell"><input class="lbl" data-lbl="${r.k}" data-lblcfg="${g.labelCfg}" value="${esc(r.label)}" placeholder="${esc(r.defLabel || g.corner || '')}" autocomplete="off">`
          + (r.extra && g.addRow ? `<button class="row-del" data-act="${g.addRow.del}" data-rk="${r.k}" title="Xóa dòng" aria-label="Xóa dòng">×</button>` : '') + '</th>';
      } else if (g.mirrorLabels) h += `<tr><th data-lblm="${r.k}">${esc(r.label)}</th>`;
      else h += `<tr><th>${esc(typeLbl || r.label)}</th>`;
      g.cols.forEach((c, ci) => {
        const key = `${g.id}.${r.k}.${c.k}`;
        if (g.skip && g.skip(r.k, c.k)) { h += '<td class="na"></td>'; return; }
        if (ro || c.calc) { h += `<td class="calc"><span class="cv" data-c="${key}"></span></td>`; return; }
        const val = esc(state.v[key] ?? '');
        if (c.options) {
          const cur = state.v[key] ?? '';
          const opts = [''].concat(c.options, cur && !c.options.includes(cur) ? [cur] : []);
          h += `<td><select data-k="${key}" data-g="${g.id}" data-r="${ri}" data-col="${ci}">${opts.map(o => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></td>`;
          return;
        }
        if (r.select) {
          h += `<td><select data-k="${key}" data-g="${g.id}" data-r="${ri}" data-col="${ci}">${r.select.map(o => `<option ${o === state.v[key] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></td>`;
          return;
        }
        const text = r.text || c.text;
        // Bảng đã có cột độ lệch riêng (ΔR, ΔK, sai số) thì không lặp lại gợi ý dưới ô
        const hasDevCol = g.cols.some(x => x.k === 'd' + c.k || x.k === c.k + 'e');
        const hint = hasDevCol || c.auto || r.auto ? '' : `<span class="hint" data-h="${key}"></span>`;
        h += `<td><input data-k="${key}" data-g="${g.id}" data-r="${ri}" data-col="${ci}" class="${text ? 'text' : ''} ${c.auto || r.text || r.auto ? 'auto' : ''}" value="${val}" ${text ? '' : 'inputmode="decimal"'} autocomplete="off">${hint}</td>`;
      });
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    if (g.addRow) h += `<div class="row-actions"><button class="btn small" data-act="${g.addRow.act}">${esc(g.addRow.label)}</button></div>`;
    return h + '</div>';
  }

  function findingsHTML(secId) {
    const list = res.findings.filter(f => secId === '*' || f.sec === secId);
    const fk = filters[secId] || 'all';
    const counts = { all: list.length };
    ['fail', 'warn', 'missing', 'pass', 'info'].forEach(s => { counts[s] = list.filter(f => f.status === s).length; });
    const shown = list.filter(f => fk === 'all' || f.status === fk);
    const secTitle = id => { const s = schema.sections.find(x => x.id === id); return s ? `${s.no}. ${s.title}` : id; };
    let h = `<div class="findings" data-findings="${secId}">${criteriaNote()}<div class="findings-head"><h3>So sánh với số liệu xuất xưởng & đánh giá</h3><div class="filters">`;
    [['all', 'Tất cả'], ['fail', 'Không đạt'], ['warn', 'Cần xem xét'], ['missing', 'Thiếu dữ liệu'], ['pass', 'Đạt'], ['info', 'Tham khảo']].forEach(([k, t]) => {
      if (k !== 'all' && !counts[k]) return;
      h += `<button data-filter="${k}" data-fsec="${secId}" class="${fk === k ? 'on' : ''}">${t} · ${counts[k]}</button>`;
    });
    h += '</div></div>';
    if (!shown.length) return h + `<div class="empty">${list.length ? 'Không có mục nào theo bộ lọc.' : 'Chưa có số liệu để đánh giá — nhập số liệu ở các bảng phía trên.'}</div></div>`;
    h += `<div style="overflow-x:auto"><table class="ftable"><thead><tr>${secId === '*' ? '<th>Hạng mục</th>' : ''}<th>Nội dung</th><th>Vị trí / pha / nấc</th><th>Giá trị đo</th><th>Quy đổi</th><th>Tham chiếu</th><th>Độ lệch</th><th>Giới hạn</th><th>Đánh giá</th><th>Căn cứ</th><th>Ghi chú</th></tr></thead><tbody>`;
    shown.forEach(f => {
      h += `<tr class="st-${f.status}">${secId === '*' ? `<td>${esc(secTitle(f.sec))}</td>` : ''}<td>${esc(f.item)}</td><td>${esc(f.loc || '')}</td><td class="num">${esc(f.meas || '')}</td><td class="num">${esc(f.conv || '')}</td><td class="num">${esc(f.ref || '')}</td><td class="num">${esc(f.dev || '')}</td><td>${esc(f.limit || '')}</td><td><span class="badge st-${f.status}">${ST_TEXT[f.status]}</span></td><td>${esc(f.basis || '')}</td><td class="note">${esc(f.note || '')}</td></tr>`;
    });
    return h + '</tbody></table></div></div>';
  }

  // Đang dùng ngưỡng đơn vị khác QĐ 1901: nhắc ở trang đánh giá (nội dung cũng được ghi vào kết luận tự động)
  function criteriaNote() {
    const n = Criteria.changed().length;
    return n ? `<div class="callout warn">Đánh giá theo <b>bộ tiêu chí của đơn vị</b>: ${n} ngưỡng khác QĐ 1901. <button class="btn small" data-nav="criteria">Xem bộ tiêu chí</button></div>` : '';
  }

  function headHTML(no, title, en, secId) {
    const S = secId && res.sec[secId];
    const badge = S ? `<span class="badge ${S.status ? 'st-' + S.status : 'st-none'}">${S.text || 'Chưa nhập'}</span>` : '';
    return `<div class="panel-head"><span class="secno">${esc(no)}</span><h2>${esc(title)}</h2><span class="en">${esc(en || '')}</span><span class="spacer"></span>${badge}</div>`;
  }

  // ---------------------------------------------------------------- pages
  function renderGeneral() {
    const D = FX && FX.data, U = TU();
    let h = headHTML('0', 'Thông tin chung & cấu hình', 'General & settings');
    h += `<h3>Thông tin thiết bị (điền vào đầu biên bản)</h3>${U.headTools ? U.headTools(App) : ''}${flagBannerHTML()}<div class="fields">${schema.head.map(f => fieldHTML(f)).join('')}</div>`;
    h += '<h3>Template & số liệu xuất xưởng</h3><div class="fields">';
    h += cfgField('template', 'Template BBTN dùng để xuất', { options: (Object.keys(EMB.templates).length ? Object.keys(EMB.templates).map(k => [k, EMB.templates[k].name]) : [['A', '(chưa có — nạp template .docx)']]).concat(lsGet(LS_TPL) ? [['custom', 'Tùy chỉnh: ' + JSON.parse(lsGet(LS_TPL)).name]] : []) });
    h += `<div class="field"><label>Nạp template khác (.docx cùng cấu trúc)</label><button class="btn" data-act="loadDocx">Chọn file template…</button></div>`;
    h += `<div class="field"><label>File số liệu xuất xưởng</label><div class="calcval file" title="${esc(D ? D.fileName : '')}">${esc(D ? D.fileName : 'chưa nạp')}</div></div>`;
    h += `<div class="field"><label>Nạp file xuất xưởng khác (.xlsx)</label><button class="btn" data-act="loadXlsx">Chọn file .xlsx…</button></div>`;
    h += (U.generalFiles ? U.generalFiles(App) : '') + '</div>';
    if (D && D.warnings.length) h += `<div class="callout warn">${D.warnings.map(esc).join('<br>')}</div>`;
    h += U.generalConfig ? U.generalConfig(App) : '';
    h += U.factoryUnits ? U.factoryUnits(App) : '';
    return `<section class="panel">${h}</section>`;
  }

  // Hạng mục thí nghiệm theo 4 bước; khung Tài liệu tham khảo bên phải
  function renderSection(s) {
    const U = TU(), step = Workflow.stepOf(s.id), S = res.sec[s.id];
    let body = '';
    if (step === 'prep' || step === 'guide') body = Workflow.procedureHTML(T(), s.id, step, esc, DB.role === 'admin');
    else if (step === 'eval') body = findingsHTML(s.id);
    else {
      body = (U.intro ? U.intro(s.id, App) : '') + (U.sectionTools ? U.sectionTools(s.id, App) : '');
      if (s.fields) body += '<div class="fields">' + s.fields.map(f => sectionField(f)).join('') + '</div>';
      (s.grids || []).forEach(g => { body += gridHTML(g); });
      (s.groups || []).forEach(gr => {
        body += `<h3>${esc(gr.title)}</h3>`;
        if (gr.fields) body += '<div class="fields">' + gr.fields.map(f => sectionField(f)).join('') + '</div>';
        gr.grids.forEach(g => { body += gridHTML(g); });
      });
      if (s.extraDoc) body += '<div class="fields">' + s.extraDoc.map(x => `<div class="field"><label>${x.k === 'ir.k1' ? 'Hệ số quy đổi K1 (ghi vào BBTN)' : 'Hệ số quy đổi K2 (ghi vào BBTN)'}</label><div class="calcval" data-n="${x.k}"></div></div>`).join('') + '</div>';
      if (U.sectionFooter) body += U.sectionFooter(s.id, App);
      body += `<div class="wf-sum" data-fsum="${s.id}"></div>`;
    }
    const h = headHTML(String(s.no), s.title, s.en, s.id) + `<div class="wf-bar">${Workflow.stepsHTML(s.id, S)}${editToolsHTML(s.id)}</div>`
      + `<div class="wf-layout"><div class="wf-main" data-step="${step}">${body}</div>${Workflow.referencesHTML(T(), s.id, esc)}</div>`;
    return `<section class="panel" data-sec="${s.id}">${h}</section>`;
  }
  // Tóm tắt kết quả cuối bước Nhập số liệu (chi tiết ở bước Đánh giá)
  function findingsSummary(secId) {
    const S = res.sec[secId];
    if (!S || !S.status) return '';
    const c = S.counts, parts = [['pass', c.pass], ['warn', c.warn], ['fail', c.fail], ['missing', c.missing]].filter(([, n]) => n);
    return `<span>Kết quả: ${parts.map(([k, n]) => `<span class="badge st-${k}">${ST_TEXT[k]} · ${n}</span>`).join(' ')}</span>`
      + `<button class="btn small" data-wfstep="eval" data-sec="${secId}">Xem đánh giá chi tiết</button>`;
  }
  function sectionField(f) {
    const custom = TU().field ? TU().field(f, App) : null;
    return custom || fieldHTML(f);
  }

  function renderSummary() {
    let h = headHTML('Σ', 'Tổng hợp & kết luận', 'Summary');
    h += '<div class="hint-text">Cột “Ghi vào BBTN” điền vào bảng hạng mục ở trang 1 của biên bản. Để “Tự động” nếu muốn dùng kết quả đánh giá của app.</div>';
    h += '<div class="grid-wrap"><table class="ftable summary-table"><thead><tr><th>STT</th><th>Hạng mục</th><th>Đã thí nghiệm</th><th>Đánh giá tự động</th><th>Số mục (đạt / xem xét / không đạt / thiếu)</th><th>Ghi vào BBTN</th></tr></thead><tbody>';
    schema.sections.forEach(s => {
      const S = res.sec[s.id];
      const autoTick = !!S.status;
      const tick = state.sum.tick[s.id] ?? autoTick;
      const ev = state.sum.ev[s.id] || '';
      h += `<tr class="${S.status ? 'st-' + S.status : ''}"><td>${s.no}</td><td>${esc(s.title)}</td>
        <td><input type="checkbox" data-sumtick="${s.id}" ${tick ? 'checked' : ''}></td>
        <td><span class="badge ${S.status ? 'st-' + S.status : 'st-none'}">${S.text || 'Chưa nhập'}</span></td>
        <td class="num">${S.counts.pass} / ${S.counts.warn} / ${S.counts.fail} / ${S.counts.missing}</td>
        <td><select data-sumev="${s.id}">${[['', 'Tự động'], ['Đạt', 'Đạt'], ['Không đạt', 'Không đạt'], ['Cần xem xét', 'Cần xem xét'], ['—', '(để trống)']].map(([v, t]) => `<option value="${v}" ${v === ev ? 'selected' : ''}>${t}</option>`).join('')}</select></td></tr>`;
    });
    h += '</tbody></table></div>';
    h += '<h3>Ghi chú & kết luận (điền vào BBTN)</h3><div class="fields">' + schema.tail.map(f => fieldHTML(f)).join('') + '</div>';
    h += `<div class="row-actions"><button class="btn" data-act="autoConclusion">Điền kết luận tự động</button><button class="btn" data-act="xlsx">Xuất so sánh .xlsx</button><button class="btn primary" data-act="docx">Xuất BBTN .docx</button></div>`;
    h += `<div class="callout">Kết luận tự động chỉ tổng hợp kết quả so sánh; quyết định đóng điện thuộc người có thẩm quyền (QĐ 1901 Điều 3, Điều 9 mục 4). Gợi ý hiện tại: <i data-autoconc></i></div>`;
    h += findingsHTML('*');
    return `<section class="panel">${h}</section>`;
  }

  let factoryTab = 0;
  function renderFactory() {
    let h = headHTML('XX', 'Số liệu xuất xưởng', FX ? FX.data.fileName : '');
    if (!FX) return `<section class="panel">${h}<div class="empty">Chưa nạp file.</div></section>`;
    const sh = FX.data.sheets;
    h += `<div class="row-actions"><button class="btn" data-act="loadXlsx">Nạp file .xlsx khác…</button>${lsGet(LS_FAC) ? '<button class="btn" data-act="resetXlsx">Dùng lại file mặc định</button>' : ''}</div>`;
    h += '<div class="tabs">' + sh.map((s, i) => `<button data-ftab="${i}" class="${i === factoryTab ? 'on' : ''}">${esc(s.name)}</button>`).join('') + '</div>';
    const rows = sh[factoryTab].rows;
    h += '<div class="raw"><table>' + rows.map(r => '<tr>' + (r || []).map(c => `<td title="${esc(c)}">${esc(typeof c === 'number' ? +c.toFixed(6) : c)}</td>`).join('') + '</tr>').join('') + '</table></div>';
    return `<section class="panel">${h}</section>`;
  }

  function renderMain() {
    const main = $('#main');
    let html;
    if (current === 'general') html = renderGeneral();
    else if (current === 'summary') html = renderSummary();
    else if (current === 'factory') html = renderFactory();
    else if (current === 'db') html = DbUI.renderDb();
    else if (current === 'trend') html = DbUI.renderTrend();
    else if (current === 'catalog') html = Catalog.render();
    else if (current === 'kconf') html = KConf.render();
    else if (current === 'appendix') html = AppendixUI.render(App);
    else if (current === 'criteria') html = CriteriaUI.render();
    else html = renderSection(schema.sections.find(s => s.id === current));
    const dl = FX ? `<datalist id="dlSerials">${FX.data.order.map(s => `<option value="${esc(s)}">`).join('')}</datalist>` : '';
    main.innerHTML = html + dl;
    updateComputed();
    if (current === 'db' || current === 'trend') DbUI.afterRender(current);
    if (current === 'catalog') Catalog.afterRender();
    if (current === 'kconf') KConf.afterRender();
    if (current === 'appendix') AppendixUI.afterRender(App);
    if (current === 'criteria') CriteriaUI.afterRender();
  }

  // Cập nhật ô tính toán, trạng thái ô, bảng so sánh mà không render lại form (giữ focus)
  function updateComputed() {
    const main = $('#main');
    $$('[data-c]', main).forEach(el => { el.textContent = res.calc[el.dataset.c] || ''; });
    $$('[data-n]', main).forEach(el => {
      const k = el.dataset.n;
      el.textContent = (res.notes[k] || res.calc[k] || '').trim() || '—';
    });
    $$('input.auto', main).forEach(el => { el.placeholder = res.calc[el.dataset.k] || ''; });
    const byKey = {};
    res.findings.forEach(f => (f.keys || []).forEach(k => {
      if (!byKey[k] || Common.RANK[f.status] > Common.RANK[byKey[k].status]) byKey[k] = f;
    }));
    $$('[data-k]', main).forEach(el => {
      el.classList.remove('st-pass', 'st-warn', 'st-fail', 'st-missing', 'st-info');
      const f = byKey[el.dataset.k];
      if (f && f.status !== 'info') el.classList.add('st-' + f.status);
      el.title = f ? `${ST_TEXT[f.status]} — ${f.item}${f.loc ? ' · ' + f.loc : ''}\nĐo: ${f.meas || ''}${f.conv ? '\nQuy đổi: ' + f.conv : ''}${f.ref ? '\nTham chiếu: ' + f.ref : ''}${f.dev ? '\nĐộ lệch: ' + f.dev : ''}${f.limit ? '\nGiới hạn: ' + f.limit : ''}${f.note ? '\n' + f.note : ''}\n(${f.basis || ''})` : '';
    });
    $$('[data-h]', main).forEach(el => {
      const f = byKey[el.dataset.h];
      el.className = 'hint' + (f ? ' st-' + f.status : '');
      const tok = f && f.dev ? f.dev.trim().split(' ')[0] : '';
      el.textContent = tok ? (tok.endsWith('%') ? tok : tok + '%') : '';
    });
    $$('.calc .cv', main).forEach(el => {
      const f = byKey[el.dataset.c];
      el.classList.remove('st-pass', 'st-warn', 'st-fail');
      if (f && f.status !== 'info') el.classList.add('st-' + f.status);
    });
    $$('[data-findings]', main).forEach(el => { el.outerHTML = findingsHTML(el.dataset.findings); });
    const ac = $('[data-autoconc]', main);
    if (ac) ac.textContent = T().autoConclusion(res, schema, state) || '(chưa có dữ liệu)';
    $$('[data-fsum]', main).forEach(el => { el.innerHTML = findingsSummary(el.dataset.fsum); });
    const head = $('.panel[data-sec] .panel-head .badge', main);
    const secEl = $('.panel[data-sec]', main);
    if (head && secEl) { const S = res.sec[secEl.dataset.sec]; head.className = `badge ${S.status ? 'st-' + S.status : 'st-none'}`; head.textContent = S.text || 'Chưa nhập'; }
    const flag = $('[data-wfflag]', main);
    if (flag && secEl) { const c = res.sec[secEl.dataset.sec].counts, n = c.fail + c.warn; flag.textContent = n || ''; flag.hidden = !n; }
    renderNav();
    renderRecordChip();
  }

  let evalT = null;
  function scheduleEval() {
    clearTimeout(evalT);
    evalT = setTimeout(() => { recompute(); updateComputed(); }, 120);
    persist();
  }

  // ---------------------------------------------------------------- events
  function setCfg(path, value) {
    const parts = path.split('.');
    let o = state.cfg;
    parts.slice(0, -1).forEach(p => { o[p] = o[p] || {}; o = o[p]; });
    const last = parts[parts.length - 1];
    if (path === 'taps') o[last] = value.split(/[,;]+/).map(x => x.trim()).filter(Boolean);
    else o[last] = value;
  }

  function onInput(e) {
    const el = e.target;
    if (el.dataset.k) {
      state.v[el.dataset.k] = el.value;
      if (e.type === 'change') clearFlag(el.dataset.k, el);
      // mỗi lần sửa xong một ô (change) là một bước hoàn tác của hạng mục chứa ô đó
      if (e.type === 'change' && editStart && editStart.k === el.dataset.k) {
        EditHistory.record('Sửa ô', { v: Object.assign({}, state.v, { [el.dataset.k]: editStart.v }), att: null }, state, secOf());
        editStart.v = el.value;
        updateEditTools();
      }
      if (TU().rerenderOn && TU().rerenderOn.test(el.dataset.k)) { recompute(); renderMain(); persist(); return; }
      if (el.dataset.k === 'meta.serial' && e.type === 'change') onSerialChange();
      scheduleEval();
    } else if ((el.dataset.hk || el.dataset.lbl) && e.type === 'change') {
      // đề mục cột / nhãn hàng sửa được (vd mục 6, 8 MBA): lưu vào cấu hình, dựng lại schema mà không vẽ lại trang
      const t = el.value.trim();
      const map = el.dataset.hk ? (state.cfg.hdr = state.cfg.hdr || {}) : (state.cfg[el.dataset.lblcfg] = state.cfg[el.dataset.lblcfg] || {});
      const id = el.dataset.hk || el.dataset.lbl;
      if (t && t !== el.placeholder) map[id] = t; else delete map[id];
      if (el.dataset.lbl) $$(`[data-lblm="${id}"]`).forEach(x => { x.textContent = t || el.placeholder; });
      if (!t) el.value = el.dataset.hk ? el.placeholder : '';
      schema = T().buildSchema(state.cfg); recompute(); updateComputed(); persist();
    } else if (el.dataset.cfg && e.type === 'change') {
      setCfg(el.dataset.cfg, el.value);
      clearFlag('cfg.' + el.dataset.cfg, el);
      if (/^(taps|bctCores)/.test(el.dataset.cfg)) {
        if (el.dataset.cfg === 'taps' && state.cfg.taps.length !== 19) toast(`Cần đúng 19 nhãn nấc (đang có ${state.cfg.taps.length}) — tạm dùng mặc định`, true);
        schema = T().buildSchema(state.cfg);
      }
      recompute();
      if (/^(template|bctCores|taps|oltcCharts)/.test(el.dataset.cfg)) renderMain(); else updateComputed();
      persist();
    } else if (el.dataset.sumtick) {
      state.sum.tick[el.dataset.sumtick] = el.checked; persist();
    } else if (el.dataset.sumev !== undefined && e.type === 'change') {
      state.sum.ev[el.dataset.sumev] = el.value; persist();
    }
  }
  function onSerialChange() {
    const u = FX && FX.unit(state.v['meta.serial']);
    if (!u) { toast('Số chế tạo không có trong file xuất xưởng — các so sánh với máy chính sẽ thiếu tham chiếu', true); return; }
    const key = T().templateKeyFor ? T().templateKeyFor(state, FX) : null;
    if (key && state.cfg.template !== 'custom' && EMB.templates[key] && state.cfg.template !== key) {
      state.cfg.template = key;
      toast(`Đã chọn template ${EMB.templates[key].name} theo pha ${key}`);
    }
  }

  function onPaste(e) {
    const el = e.target;
    if (!el.dataset || !el.dataset.g) return;
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!/[\t\n]/.test(text.replace(/\r?\n$/, ''))) return;
    e.preventDefault();
    const before = EditHistory.snapshot(state, false);
    const table = el.closest('table');
    const map = {};
    $$('[data-g]', table).forEach(x => { map[`${x.dataset.r}:${x.dataset.col}`] = x; });
    const r0 = +el.dataset.r, c0 = +el.dataset.col;
    const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n');
    let n = 0;
    lines.forEach((line, i) => line.split('\t').forEach((cell, j) => {
      // bỏ qua các cột tính toán: tìm ô nhập thứ j bên phải
      let cc = c0, step = 0, target = null;
      while (cc < 60) { const t = map[`${r0 + i}:${cc}`]; if (t) { if (step === j) { target = t; break; } step++; } cc++; }
      if (target) { target.value = cell.trim(); state.v[target.dataset.k] = target.value; n++; }
    }));
    EditHistory.record(`Dán ${n} ô`, before, state, secOf());
    editStart = null;
    updateEditTools();
    toast(`Đã dán ${n} ô`);
    scheduleEval();
  }

  function onKey(e) {
    const el = e.target;
    if (e.key === 'Enter' && el.dataset && el.dataset.g && el.tagName === 'INPUT') {
      e.preventDefault();
      const table = el.closest('table');
      const next = $(`[data-r="${+el.dataset.r + (e.shiftKey ? -1 : 1)}"][data-col="${el.dataset.col}"]`, table);
      if (next) { next.focus(); next.select && next.select(); }
    }
  }

  async function onClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.nav) { current = b.dataset.nav; renderNav(); renderMain(); $('#main').scrollTop = 0; window.scrollTo(0, 0); return; }
    if (b.dataset.filter) { filters[b.dataset.fsec] = b.dataset.filter; updateComputed(); return; }
    if (b.dataset.ftab !== undefined) { factoryTab = +b.dataset.ftab; renderMain(); return; }
    if (b.dataset.wfstep) { Workflow.setStep(b.dataset.sec, b.dataset.wfstep); renderMain(); return; }
    if (b.dataset.newtype) { chooseTypeDone(b.dataset.newtype); return; }
    if (b.dataset.undo) { undoSection(b.dataset.undo); return; }
    if (b.dataset.clearsec) { clearSection(b.dataset.clearsec); return; }
    const act = b.dataset.act;
    try {
      if (act === 'new') openTypeDialog();
      else if (act === 'save') await saveJson();
      else if (act === 'open') $('#fileJson').click();
      else if (act === 'loadXlsx') $('#fileXlsx').click();
      else if (act === 'loadDocx') $('#fileDocx').click();
      else if (act === 'resetXlsx') { lsSet(LS_FAC, null); loadFactoryDefault(); applyFactoryDefaults(state.cfg); recompute(); renderMain(); toast('Đã dùng lại file xuất xưởng mặc định'); }
      else if (act === 'docx') await exportDocx();
      else if (act === 'xlsx') exportXlsx();
      else if (act === 'flagsDone') { if (state.att) delete state.att.ocr; renderMain(); persist(); toast('Đã bỏ tô nền các ô đọc từ ảnh'); }
      else if (act === 'autoConclusion') {
        state.v['meta.conclusion'] = T().autoConclusion(res, schema, state);
        renderMain(); persist();
      } else if (act && act.startsWith('db')) await DbUI.action(act, b);
      else if (act && act.startsWith('appx')) await AppendixUI.action(act, b, App);
      else if (act && TU().actions && TU().actions[act]) await track(b.textContent.trim() || act, () => TU().actions[act](b, App));
    } catch (err) {
      console.error(err);
      toast('Lỗi: ' + err.message, true);
    }
  }

  // ---------------------------------------------------------------- biên bản mới: chọn loại thiết bị
  function openTypeDialog() {
    let dlg = $('#typeDialog');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'typeDialog'; dlg.className = 'auth-dialog type-dialog'; dlg.setAttribute('aria-labelledby', 'tdTitle');
      document.body.appendChild(dlg);
    }
    const cur = EquipmentTypes.codeOf(state);
    const ready = EquipmentTypes.list().map(t => `<button class="type-opt" data-newtype="${esc(t.code)}"><b>${esc(t.label)}</b><span>${t.code === cur ? 'Giữ cấu hình của biên bản đang mở' : 'Cấu hình mặc định'}</span></button>`).join('');
    const later = PLANNED.filter(([c]) => !EquipmentTypes.has(c)).map(([, l]) => `<span class="type-opt off" aria-disabled="true"><b>${esc(l)}</b><span>Chưa hỗ trợ</span></span>`).join('');
    dlg.innerHTML = `<div class="ad-band"><span>Biên bản mới</span><button class="ad-x" data-tdclose aria-label="Đóng">×</button></div>
      <div class="ad-body"><h2 id="tdTitle">Chọn loại thiết bị</h2><p class="ad-lead">Biên bản đang nhập chưa lưu file .json hoặc CSDL sẽ bị thay thế.</p>
      <div class="type-grid">${ready}${later}</div></div>`;
    dlg.querySelector('[data-tdclose]').onclick = () => dlg.close();
    dlg.showModal();
  }
  async function chooseTypeDone(code) {
    $('#typeDialog').close();
    try {
      await newRecord(code === EquipmentTypes.codeOf(state), code);
      current = 'general'; recompute(); renderNav(); renderMain(); persist();
      toast(`Đã tạo biên bản ${T().label} mới từ template`);
    } catch (err) { console.error(err); toast('Lỗi: ' + err.message, true); }
  }

  // ---------------------------------------------------------------- files
  // File .json mang theo file đính kèm (báo cáo SFRA) dạng base64 để mở được trên máy khác
  async function saveJson() {
    const data = { app: 'bbtn-mba', version: 1, savedAt: new Date().toISOString(), factoryFile: FX ? FX.data.fileName : null, state, files: await AppendixUI.filesFor(state) };
    const name = `BBTN_${T().report.filePrefix}_${safeName(state.v['meta.serial'])}_${safeName(state.v['meta.date'])}.json`;
    download(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), name);
    toast('Đã lưu ' + name);
  }
  // Biên bản cũ (trước khi có nhiều loại thiết bị) không ghi loại → MBA
  function loadState(obj) {
    const st = obj.state || obj;
    if (!st || !st.v || !st.cfg) throw new Error('File không đúng định dạng dữ liệu BBTN');
    const type = EquipmentTypes.codeOf(st);
    if (!EquipmentTypes.has(type)) throw new Error(`Biên bản loại “${type}” chưa được hỗ trợ trong phiên bản này`);
    const cfg = EquipmentTypes.get(type).normalizeCfg(st.cfg);
    state = { type, v: st.v, cfg, sum: st.sum || { tick: {}, ev: {} }, att: st.att || {}, created: st.created, db: st.db || null };
    EditHistory.reset();
    state.sum.tick = state.sum.tick || {}; state.sum.ev = state.sum.ev || {};
    applyFactoryDefaults(state.cfg);
    schema = T().buildSchema(state.cfg);
  }
  async function readFile(input, fn) {
    const f = input.files[0];
    input.value = '';
    if (!f) return;
    try { await fn(f); } catch (err) { console.error(err); toast('Lỗi đọc file: ' + err.message, true); }
  }

  function loadFactoryDefault() {
    const custom = lsGet(LS_FAC);
    try {
      if (custom) { const o = JSON.parse(custom); FX = factoryReader().fromBase64(o.b64, o.name); return; }
    } catch (e) { console.warn('custom factory invalid', e); }
    FX = EMB.factory ? factoryReader().fromBase64(EMB.factory.b64, EMB.factory.name) : null;
  }
  // Bộ đọc Test report xuất xưởng của loại thiết bị (trước khi có biên bản: loại mặc định)
  const factoryReader = () => EquipmentTypes.get(EquipmentTypes.codeOf(state)).factory;
  // ---------------------------------------------------------------- export
  async function exportDocx() {
    recompute();
    const data = templateData();
    if (!data) { toast('Chưa có template BBTN — nạp file .docx ở mục 0 “Thông tin chung & cấu hình”', true); return; }
    const tpl = await DocxTemplate.load(data), R = T().report;
    if (tpl.tables.length < R.minTables) toast(`Cảnh báo: template có ${tpl.tables.length} bảng (mẫu chuẩn ${R.stdTables}) — vị trí điền có thể lệch`, true);
    // Tài nguyên cần trình duyệt dựng (vd ảnh đồ thị chụp sóng cho phụ lục)
    const assets = Object.assign(TU().reportAssets ? await TU().reportAssets(App) : {}, await AppendixUI.reportAssets(App));
    const { cells, miss } = R.fill(tpl, { state, res, schema, assets });
    const v = state.v;
    const blob = await tpl.toBlob();
    const name = `BBTN_${R.filePrefix}_${safeName(v['meta.serial'])}_${safeName(v['meta.date'])}.docx`;
    download(blob, name);
    toast(`Đã xuất ${name} (${cells} ô số liệu)${miss.length ? ` — không định vị được: ${miss.slice(0, 4).join(', ')}${miss.length > 4 ? '…' : ''}` : ''}`, miss.length > 0);
    // Biên bản đã lưu CSDL → lưu kèm file BBTN vào Storage
    if (state.db && state.db.sessionId && DB.user && DB.canEdit()) {
      try {
        await DB.uploadDoc(state.db.sessionId, state.db.equipmentId || null, 'BBTN_DOCX', `${v['meta.serial']}/${state.db.sessionId}/${name}`, name, blob);
        toast(`Đã xuất ${name} và lưu bản .docx vào CSDL`);
      } catch (err) { toast('Đã tải file nhưng chưa lưu được vào CSDL: ' + err.message, true); }
    }
  }

  function exportXlsx() {
    recompute();
    const v = state.v;
    const secTitle = id => { const s = schema.sections.find(x => x.id === id); return s ? `${s.no}. ${s.title}` : id; };
    const head = ['Số chế tạo (máy chính)', 'Ngày TN', 'Lý do', 'Hạng mục', 'Nội dung', 'Vị trí / pha / nấc', 'Giá trị đo', 'Giá trị quy đổi', 'Tham chiếu (xuất xưởng / tiêu chuẩn)', 'Độ lệch', 'Giới hạn', 'Đánh giá', 'Điều/Bảng QĐ 1901', 'Ghi chú'];
    const rows = [head].concat(res.findings.map(f => [v['meta.serial'], v['meta.date'], v['meta.reason'], secTitle(f.sec), f.item, f.loc || '', f.meas || '', f.conv || '', f.ref || '', f.dev || '', f.limit || '', ST_TEXT[f.status], f.basis || '', f.note || '']));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [12, 11, 11, 30, 34, 34, 20, 20, 34, 14, 34, 12, 26, 50].map(w => ({ wch: w }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: head.length - 1 } }) };
    const sum = [['STT', 'Hạng mục', 'Đánh giá', 'Đạt', 'Cần xem xét', 'Không đạt', 'Thiếu dữ liệu', 'Tham khảo']].concat(schema.sections.map(s => {
      const S = res.sec[s.id];
      return [s.no, s.title, S.text || 'Chưa nhập', S.counts.pass, S.counts.warn, S.counts.fail, S.counts.missing, S.counts.info];
    }));
    sum.push([], ['Kết luận gợi ý', T().autoConclusion(res, schema, state)], ['Thiết bị', `${v['meta.site'] || ''} — S/N ${v['meta.serial'] || ''}`], ['File xuất xưởng', FX ? FX.data.fileName : '']);
    const ws2 = XLSX.utils.aoa_to_sheet(sum);
    ws2['!cols'] = [{ wch: 14 }, { wch: 46 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 13 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws2, 'Tổng hợp');
    XLSX.utils.book_append_sheet(wb, ws, 'So sánh chi tiết');
    const name = `SoSanh_${T().report.filePrefix}_${safeName(v['meta.serial'])}_${safeName(v['meta.date'])}.xlsx`;
    XLSX.writeFile(wb, name);
    toast('Đã xuất ' + name);
  }

  // ---------------------------------------------------------------- boot
  async function boot() {
    Records.setRepo(DB);
    loadFactoryDefault();
    Object.values(window.TypeUI || {}).forEach(u => { if (u.init) u.init(App); });
    AppendixUI.init(App);
    const saved = lsGet(LS_STATE);
    let restored = false;
    if (saved) {
      try { loadState(JSON.parse(saved)); restored = true; } catch (e) { console.warn('saved state invalid', e); }
    }
    if (!restored) { state = null; await newRecord(false, EquipmentTypes.DEFAULT); }
    recompute();
    renderMain();
    if (restored && !new URLSearchParams(location.search).has('code')) Notify.show({ type: 'info', msg: 'Đã mở lại biên bản đang nhập dở trên máy này.' });
    // Đăng nhập / đăng xuất / đổi kết nối → làm mới dữ liệu CSDL đang hiển thị
    document.addEventListener('auth:changed', () => {
      DbUI.reset(); Catalog.reset(); KConf.reset(); CriteriaUI.reset(); renderNav(); renderMain();
      // bảng hệ số quy đổi sứ trong CSDL (admin cấu hình) → dựng lại lựa chọn ở mục 5
      if (DB.user) KConf.load(true);
      // bộ tiêu chí đơn vị (admin cấu hình) → đánh giá lại biên bản đang mở
      if (DB.user) CriteriaUI.load(true);
    });
    DB.connect();
    AuthUI.init().catch(e => console.warn(e));

    document.addEventListener('click', onClick);
    $('#main').addEventListener('input', onInput);
    $('#main').addEventListener('change', onInput);
    $('#main').addEventListener('paste', onPaste);
    $('#main').addEventListener('keydown', onKey);
    $('#main').addEventListener('focusin', e => { const k = e.target.dataset && e.target.dataset.k; if (k) editStart = { k, v: state.v[k] }; });
    // Ctrl+Z ngoài ô nhập: hoàn tác bước gần nhất của hạng mục đang mở (trong ô nhập giữ hoàn tác gõ chữ của trình duyệt)
    document.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
      if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable], dialog[open]')) return;
      if (!schema.sections.some(s => s.id === current) || !EditHistory.count(current)) return;
      e.preventDefault(); undoSection(current);
    });
    $('#fileJson').addEventListener('change', e => readFile(e.target, async f => {
      const obj = JSON.parse(await f.text());
      loadState(obj);
      if (obj.files) await AppendixUI.restoreFiles(obj.files);
      recompute(); current = 'general'; renderMain(); persist(); toast('Đã mở ' + f.name);
    }));
    $('#fileXlsx').addEventListener('change', e => readFile(e.target, async f => {
      const buf = await f.arrayBuffer();
      FX = factoryReader().fromArrayBuffer(buf, f.name);
      if (!lsSet(LS_FAC, JSON.stringify({ name: f.name, b64: abToB64(buf) }))) toast('File lớn — chỉ dùng trong phiên này', true);
      applyFactoryDefaults(state.cfg);
      recompute(); renderMain(); persist();
      toast(`Đã nạp ${f.name}: ${FX.data.order.length} máy${FX.data.warnings.length ? ' — có cảnh báo' : ''}`, FX.data.warnings.length > 0);
    }));
    $('#fileDocx').addEventListener('change', e => readFile(e.target, async f => {
      const buf = await f.arrayBuffer();
      const t = await DocxTemplate.load(buf);
      if (t.tables.length < T().report.minTables) toast(`Template có ${t.tables.length} bảng, khác mẫu chuẩn (${T().report.stdTables}) — kiểm tra kỹ file xuất`, true);
      lsSet(LS_TPL, JSON.stringify({ name: f.name, b64: abToB64(buf) }));
      state.cfg.template = 'custom';
      renderMain(); persist(); toast('Đã nạp template ' + f.name);
    }));
    window.addEventListener('beforeunload', () => lsSet(LS_STATE, JSON.stringify(state)));
  }

  // API cho các trang khác (js/ui/*.js) và phần giao diện riêng của loại thiết bị (TypeUI)
  const App = window.App = {
    get state() { return state; }, get res() { return res; }, get schema() { return schema; }, get FX() { return FX; }, get type() { return T(); }, EMB,
    exportDocx, exportXlsx, toast, esc, download, safeName, persist, recompute, renderMain, fieldHTML, cfgField, readFile, lsGet, lsSet, abToB64, track,
    rebuild(schemaChanged) { if (schemaChanged) schema = T().buildSchema(state.cfg); recompute(); renderNav(); renderMain(); persist(); },
    render() { renderNav(); renderMain(); },
    go(id) { current = id; renderNav(); renderMain(); window.scrollTo(0, 0); },
    openState(st, db) { loadState(st); state.db = db; recompute(); current = 'general'; renderMain(); persist(); },
  };
  boot().catch(err => { console.error(err); toast('Lỗi khởi động: ' + err.message, true); });
})();
