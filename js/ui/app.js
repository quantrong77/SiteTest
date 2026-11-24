// Lõi giao diện Site Test Report: vẽ biểu mẫu theo schema của loại thiết bị, đánh giá tức thời, lưu/mở, xuất DOCX/XLSX.
// Phép tính, đánh giá, dòng CSDL và cách ghi BBTN do loại thiết bị khai báo (EquipmentTypes, js/domain/);
// phần giao diện riêng của từng loại ở TypeUI (js/ui/types/<loại>/ui.js).
(function () {
  'use strict';
  const LS_STATE = 'bbtn-mba.state.v1';
  const LS_TPL = 'bbtn-mba.customTemplate';
  const LS_FAC = 'bbtn-mba.customFactory'; // (cũ) một file xuất xưởng nạp tay
  const LS_FACS = 'bbtn-mba.factoryFiles'; // các file xuất xưởng nạp thêm: [{ name, b64 }]
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
  let activePdfReview = null;
  let FXS = []; // các file xuất xưởng đã nạp: [{ name, api, emb }] — FX là file đang dùng (chọn theo số chế tạo)
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
    clearPdfReview();
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
    if (state.cfg.topology === 'bank1p') {
      state.cfg.ps.A = state.cfg.ps.A || state.v['meta.serial'] || '';
      state.v['meta.serial'] = state.cfg.ps.A;
    }
    if (!state.v['meta.reason']) state.v['meta.reason'] = T().report.defaultReason || '';
    rememberTemplateHead();
    // biên bản mới: chưa gắn ngăn / thiết bị của danh mục
    ['bayId', 'pickSub', 'pickBay', 'pickEq', 'pickPhase'].forEach(k => { delete state.cfg[k]; });
  }

  // Lấy giá trị sẵn có trong template (thông tin chung, Uo = 10 kV…) làm mặc định
  async function readTemplateDefaults() {
    const data = templateData();
    if (!data) return;
    Object.assign(state.v, Report.readDefaults(await DocxTemplate.load(data), schema));
  }
  // Đổi template giữa biên bản: chỉ điền giá trị mặc định của template mới vào ô còn trống
  async function fillTemplateDefaults() {
    const data = templateData();
    if (!data) return;
    const d = Report.readDefaults(await DocxTemplate.load(data), schema);
    Object.entries(d).forEach(([k, x]) => { if (!String(state.v[k] ?? '').trim()) state.v[k] = x; });
  }

  let saveT = null;
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { lsSet(LS_STATE, JSON.stringify(state)); }, 350);
  }

  function recompute() {
    // lịch sử đo của thiết bị (CSDL / bản lưu tạm) → đánh giá xu hướng so với giá trị khởi đầu / lần trước
    res = T().evaluate(state, FX, schema, { history: TrendInlineUI.history(), sessionId: state.db && state.db.sessionId });
  }

  // ---------------------------------------------------------------- nav
  // Nhóm điều hướng: Biên bản (dữ liệu đầu vào của biên bản đang lập) · Hạng mục · Kết quả · CSDL · Tiêu chuẩn & tra cứu · Trợ giúp.
  // collapsible: nhóm đóng / mở được trên sidebar (vỏ React, src/app-shell.jsx)
  const NAV_GROUPS = {
    record: { label: 'Biên bản' },
    items: { label: 'Hạng mục thí nghiệm' },
    result: { label: 'Kết quả' },
    db: { label: 'Cơ sở dữ liệu', collapsible: true },
    std: { label: 'Tiêu chuẩn & tra cứu', collapsible: true },
    help: { label: 'Trợ giúp' },
  };
  function navItems() {
    const g = groupId => it => Object.assign(it, { groupId });
    return [
      // "Thông tin chung & cấu hình" (trang general) không nằm trên sidebar: mở bằng nút Mới (trình khởi tạo) hoặc bấm thanh thông tin BBTN
      { id: 'field', no: 'HT', title: 'Nhập hiện trường' },
      { id: 'factory', no: 'XX', title: 'Số liệu xuất xưởng' },
      { id: 'importReport', no: 'NB', title: 'Nhập BBTN cũ' },
    ].map(g('record'))
      .concat([{ id: 'model3d', no: '3D', title: 'Mô hình 3D MBA' }].concat(schema.sections.map(s => ({ id: s.id, no: String(s.no), title: s.title }))).map(g('items')))
      // Kết quả: Phụ lục BBTN → Xu hướng → Tổng hợp & kết luận (kết luận sau cùng, khi đã xem phụ lục và xu hướng)
      .concat([{ id: 'appendix', no: 'PL', title: 'Phụ lục BBTN' }, { id: 'trend', no: '↗', title: 'Xu hướng' }, { id: 'summary', no: 'Σ', title: 'Tổng hợp & kết luận' }].map(g('result')))
      .concat([{ id: 'db', no: 'DB', title: 'Biên bản đã lưu' }, { id: 'catalog', no: '≡', title: 'Trạm – Ngăn – Thiết bị' }].map(g('db')))
      .concat([{ id: 'criteria', no: 'TC', title: 'Bộ tiêu chí đánh giá' }, { id: 'kconf', no: 'K', title: 'Hệ số quy đổi sứ' },
        { id: 'standards', no: 'TV', title: 'Thư viện tài liệu' }, { id: 'guidecfg', no: 'HD', title: 'Cấu hình hướng dẫn đo' }].map(g('std')))
      .concat([{ id: 'help', no: '?', title: 'Hướng dẫn sử dụng' }].map(g('help')));
  }
  // Thanh điều hướng vẽ như sơ đồ một sợi: mỗi hạng mục là một ngăn lộ, trạng thái là ký hiệu máy cắt
  const BRK_LABEL = { pass: 'Đạt — máy cắt đóng', warn: 'Cần xem xét', fail: 'Không đạt — máy cắt cắt', missing: 'Thiếu dữ liệu', info: 'Tham khảo' };
  let navPrev = null;
  const navChangedAt = {};
  function renderNav() {
    const items = navItems();
    const first = !navPrev;
    navPrev = navPrev || {};
    const renderedItems = items.map(it => {
      const G = NAV_GROUPS[it.groupId] || {};
      const S = res && res.sec[it.id];
      const status = S && S.status ? S.status : '';
      if (!first && navPrev[it.id] !== status) navChangedAt[it.id] = Date.now();
      navPrev[it.id] = status;
      const flip = status && Date.now() - (navChangedAt[it.id] || 0) < 600;
      const tip = S && S.skipped ? 'Không thực hiện' : status ? BRK_LABEL[status] : (S ? 'Chưa nhập' : '');
      const workflow = S ? Workflow.stateOf(S, current === it.id) : '';
      return {
        id: it.id,
        no: it.no,
        title: it.title,
        groupId: it.groupId,
        group: G.label || '',
        collapsible: !!G.collapsible,
        status,
        flip: !!flip,
        tip,
        workflow,
        workflowLabel: workflow ? Workflow.STATE[workflow] : '',
        failCount: S && S.counts ? Number(S.counts.fail || 0) : 0,
        current: current === it.id,
      };
    });
    window.dispatchEvent(new CustomEvent('legacy:navigation', {
      detail: {
        items: renderedItems,
        progressHTML: Workflow.progressHTML(schema.sections, res ? res.sec : {}, esc),
      },
    }));
  }
  // Thanh thông tin BBTN: bấm để mở lại trình khởi tạo (thông tin chung & cấu hình)
  function renderRecordChip() {
    const v = state.v, u = FX && FX.unit(v['meta.serial']);
    const serial = v['meta.serial'] || (state.cfg.ps && state.cfg.ps.A) || '';
    $('#recordChip').innerHTML = `<button type="button" class="record-edit${current === 'general' ? ' on' : ''}" data-nav="general" data-setup="${current === 'general' ? setupStep : 'test'}" `
      + `title="Sửa thông tin chung & cấu hình biên bản" aria-label="Sửa thông tin chung & cấu hình biên bản">`
      + [
        `<span class="chip chip-type">${esc(T().label)}</span>`,
        `<span class="chip">S/N <b>${esc(serial || '—')}</b>${u ? ` · pha ${esc(u.phase)}` : ''}</span>`,
        `<span class="chip">${esc(v['meta.date'] || 'chưa có ngày')}</span>`,
        `<span class="chip">${esc(v['meta.reason'] || '')}</span>`,
      ].join('') + '<span class="record-edit-icon" aria-hidden="true">✎</span></button>';
  }

  // ---------------------------------------------------------------- ô đọc tự động cần kiểm tra (vd từ ảnh nameplate)
  // state.att.ocr[khóa] = { status: 'check' | 'missing', label, conf, why }; khóa cấu hình ghi "cfg.<đường dẫn>"
  const flagOf = k => (state.att && state.att.ocr && state.att.ocr[k]) || null;
  function flagHTML(k) {
    const fl = flagOf(k);
    if (!fl) return { cls: '', note: '' };
    // fl.src: tự điền khi khởi tạo BBTN (CSDL / Test report); không có src: đọc từ ảnh nameplate
    const note = fl.src ? (fl.status === 'missing' ? `Chưa có trong ${fl.src} — nhập tay` : `Tự điền từ ${fl.src} — kiểm tra lại`)
      : fl.status === 'missing' ? 'Không đọc được trên ảnh — nhập tay' : `Đọc từ ảnh, độ tin cậy ${fl.conf} %${fl.why ? ` (${fl.why})` : ''} — kiểm tra lại`;
    return { cls: ` flag-${fl.status}`, note: `<span class="note flag-note">${esc(note)}</span>` };
  }
  // Người dùng sửa ô → coi như đã kiểm tra, bỏ tô nền
  function clearFlag(k, el) {
    if (!flagOf(k)) return;
    delete state.att.ocr[k];
    if (state.att.phaseFill) delete state.att.phaseFill[k]; // số liệu pha khác người dùng sửa lại → coi là số đo của lần này
    const td = el && el.closest('td.flag-check');
    if (td) { td.classList.remove('flag-check'); td.removeAttribute('title'); }
    const box = el && el.closest('.field');
    if (box) { box.classList.remove('flag-check', 'flag-missing'); const n = box.querySelector('.flag-note'); if (n) n.remove(); }
    const banner = $('[data-flagbanner]');
    if (banner) banner.outerHTML = flagBannerHTML();
  }
  function flagBannerHTML() {
    const fl = Object.entries((state.att && state.att.ocr) || {});
    if (!fl.length) return '<div data-flagbanner hidden></div>';
    const chk = fl.filter(([, x]) => x.status === 'check').map(([, x]) => x.label), miss = fl.filter(([, x]) => x.status === 'missing').map(([, x]) => x.label);
    // nguồn: ảnh nameplate (không có src) hoặc tự điền khi khởi tạo (CSDL / test report)
    const fromPhoto = fl.some(([, x]) => !x.src), fromAuto = fl.some(([, x]) => x.src);
    const autoSrc = [...new Set(fl.filter(([, x]) => x.src && x.status === 'check').map(([, x]) => x.src))];
    const title = fromAuto && !fromPhoto ? `Thông tin tự điền${autoSrc.length ? ` từ ${autoSrc.join(', ')}` : ''} cần xem lại.`
      : fromPhoto && !fromAuto ? 'Thông tin đọc từ ảnh nameplate cần xem lại.' : 'Thông tin tự điền và đọc từ ảnh nameplate cần xem lại.';
    const missText = fromAuto && !fromPhoto ? 'Chưa có trong CSDL / test report, cần nhập tay' : 'Không đọc được, cần nhập tay';
    return `<div class="callout warn flag-banner" data-flagbanner><b>${esc(title)}</b>
      ${chk.length ? `<div><span class="flag-key check"></span>Cần kiểm tra: ${chk.map(esc).join(', ')}</div>` : ''}
      ${miss.length ? `<div><span class="flag-key missing"></span>${missText}: ${miss.map(esc).join(', ')}</div>` : ''}
      <div class="row-actions"><button class="btn small" data-act="flagsDone">Đã kiểm tra hết — bỏ tô nền</button></div></div>`;
  }

  // ---------------------------------------------------------------- render primitives
  function fieldHTML(f, opts = {}) {
    const k = f.k, val = state.v[k] ?? '';
    const id = 'f_' + k.replace(/\W/g, '_');
    let ctrl;
    if (f.type === 'select') {
      // giá trị cũ không còn trong danh sách (vd lý do "Định kỳ" trước đây, chữ đọc từ PDF) vẫn hiện và giữ nguyên
      const opts2 = val && !f.options.includes(val) ? f.options.concat([val]) : f.options;
      ctrl = `<select id="${id}" data-k="${k}">${opts2.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}${f.options.includes(o) ? '' : ' (giá trị cũ)'}</option>`).join('')}</select>`;
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
      // đề mục cột sửa được (cột có defLabel); khóa lưu c.hk (dùng chung nhiều bảng, vd chỉ danh BCT theo phía) hoặc lưới.cột
      const hk = c.hk || `${g.id}.${c.k}`;
      const lbl = g.editHdr && c.defLabel !== undefined && !c.noEdit
        ? `<input class="hdr" data-hk="${esc(hk)}" value="${esc(c.label)}" placeholder="${esc(c.defLabel)}" title="Sửa đề mục cột — để trống để dùng lại “${esc(c.defLabel)}”" aria-label="Đề mục cột ${esc(c.label)}" autocomplete="off">`
        : c.hk ? `<span data-hkm="${esc(c.hk)}">${esc(c.label)}</span>` : esc(c.label);
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
      // tên ô cho trình đọc màn hình: "bảng: hàng – cột" (không hiện ra giao diện)
      const rowName = String(typeLbl || r.label || r.defLabel || r.k).replace(/<[^>]*>/g, '').trim();
      g.cols.forEach((c, ci) => {
        const key = `${g.id}.${r.k}.${c.k}`;
        const aria = ` aria-label="${esc(`${g.title ? g.title + ': ' : ''}${rowName} – ${String(c.label || c.defLabel || c.k).replace(/<[^>]*>/g, '').trim()}`)}"`;
        if (g.skip && g.skip(r.k, c.k)) { h += '<td class="na"></td>'; return; }
        if (ro || c.calc) { h += `<td class="calc"><span class="cv" data-c="${key}"></span></td>`; return; }
        const val = esc(state.v[key] ?? '');
        if (c.options) {
          const cur = state.v[key] ?? '';
          const opts = [''].concat(c.options, cur && !c.options.includes(cur) ? [cur] : []);
          h += `<td><select data-k="${key}" data-g="${g.id}" data-r="${ri}" data-col="${ci}"${aria}>${opts.map(o => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></td>`;
          return;
        }
        if (r.select) {
          h += `<td><select data-k="${key}" data-g="${g.id}" data-r="${ri}" data-col="${ci}"${aria}>${r.select.map(o => `<option ${o === state.v[key] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></td>`;
          return;
        }
        const text = r.text || c.text;
        // Bảng đã có cột độ lệch riêng (ΔR, ΔK, sai số) thì không lặp lại gợi ý dưới ô
        const hasDevCol = g.cols.some(x => x.k === 'd' + c.k || x.k === c.k + 'e');
        const hint = hasDevCol || c.auto || r.auto ? '' : `<span class="hint" data-h="${key}"></span>`;
        const fl = flagOf(key);
        const flAttr = fl && fl.src ? ` class="flag-check" title="${esc(`Tự điền từ ${fl.src}${fl.why ? ` (${fl.why})` : ''} — kiểm tra lại; sửa ô là bỏ tô nền`)}"` : '';
        h += `<td${flAttr}><input data-k="${key}" data-g="${g.id}" data-r="${ri}" data-col="${ci}" class="${text ? 'text' : ''} ${c.auto || r.text || r.auto ? 'auto' : ''}" value="${val}" ${text ? '' : 'inputmode="decimal"'}${aria} autocomplete="off">${hint}</td>`;
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
      h += `<tr class="st-${f.status}">${secId === '*' ? `<td>${esc(secTitle(f.sec))}</td>` : ''}<td>${esc(f.item)}</td><td>${esc(f.loc || '')}</td><td class="num">${esc(f.meas || '')}</td><td class="num">${esc(f.conv || '')}</td><td class="num">${esc(f.ref || '')}</td><td class="num">${esc(f.dev || '')}</td><td>${esc(f.limit || '')}</td><td><span class="badge st-${f.status}">${ST_TEXT[f.status]}</span></td><td>${esc(f.basis || '')}${QD.stdOf(f) ? `<div class="std-ref" title="Tiêu chuẩn QĐ 1901 dẫn chiếu (tra cứu; ngưỡng đánh giá vẫn theo QĐ 1901)">${esc(QD.stdOf(f))}</div>` : ''}</td><td class="note">${esc(f.note || '')}</td></tr>`;
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
    // ô "Thực hiện": bỏ tích → hạng mục không thực hiện trong lần thí nghiệm này (ẩn vùng nhập liệu)
    const doIt = S ? `<label class="sec-do"><input type="checkbox" data-skipsec="${secId}" ${S.skipped ? '' : 'checked'}> Thực hiện</label>` : '';
    return `<div class="panel-head"><span class="secno">${esc(no)}</span><h2>${esc(title)}</h2><span class="en">${esc(en || '')}</span><span class="spacer"></span>${doIt}${secId && !(S && S.skipped) ? `<button type="button" class="btn small fe-open" data-fe-open="${secId}" title="Nhập từng ô cỡ lớn, có giọng nói — tiện trên điện thoại"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/></svg><span>Nhập từng ô</span></button>` + voiceHTML() : ''}${badge}</div>`;
  }
  // Cảnh báo xu hướng tại hiện trường (vd R60@20 giảm >30% so với giá trị khởi đầu / lần trước — QĐ 1901 Điều 29 mục 3):
  // hiện ngay đầu hạng mục khi vừa nhập số, kèm hướng xử lý của từng kết luận
  // ---------------------------------------------------------------- khung tài liệu tham khảo: độ rộng kéo được, ẩn / hiện (nhớ theo máy)
  const LS_REFS = 'bbtn-ui.refs', REFS_MIN = 200, REFS_MAX = 560, REFS_DEFAULT = 280;
  const clampRefs = w => Math.min(REFS_MAX, Math.max(REFS_MIN, Math.round(w)));
  const refsUi = (() => {
    try { const o = JSON.parse(localStorage.getItem(LS_REFS) || '{}') || {}; return { w: clampRefs(+o.w || REFS_DEFAULT), hidden: !!o.hidden }; }
    catch (e) { return { w: REFS_DEFAULT, hidden: false }; }
  })();
  const saveRefs = () => { try { localStorage.setItem(LS_REFS, JSON.stringify(refsUi)); } catch (e) { /* trình duyệt chặn lưu trữ */ } };
  const refsLayoutClass = () => `wf-layout${refsUi.hidden ? ' refs-hidden' : ''}`;
  function applyRefs() {
    $$('.wf-layout').forEach(el => { el.className = refsLayoutClass(); el.style.setProperty('--refs-w', refsUi.w + 'px'); });
    $$('.wf-split').forEach(el => el.setAttribute('aria-valuenow', refsUi.w));
    $$('.wf-refs-toggle').forEach(el => el.setAttribute('aria-pressed', refsUi.hidden ? 'false' : 'true'));
  }
  function toggleRefs() {
    refsUi.hidden = !refsUi.hidden; saveRefs(); applyRefs();
    if (!refsUi.hidden) { const r = $('#wfRefs'); if (r) r.scrollIntoView({ block: 'nearest' }); }
  }
  // kéo thanh chia giữa vùng nhập và khung tham khảo (chuột / cảm ứng / bàn phím)
  let refsDrag = null;
  function onRefsPointerDown(e) {
    const sp = e.target.closest && e.target.closest('.wf-split');
    if (!sp) return;
    e.preventDefault();
    // độ lệch giữa điểm nắm và mép khung: không nhảy độ rộng khi bắt đầu kéo
    const layout = sp.parentElement;
    refsDrag = { layout, id: e.pointerId, off: layout.getBoundingClientRect().right - e.clientX - refsUi.w };
    sp.setPointerCapture(e.pointerId);
    document.body.classList.add('is-resizing');
  }
  function onRefsPointerMove(e) {
    if (!refsDrag || e.pointerId !== refsDrag.id) return;
    refsUi.w = clampRefs(refsDrag.layout.getBoundingClientRect().right - e.clientX - refsDrag.off);
    applyRefs();
  }
  function onRefsPointerUp(e) {
    if (!refsDrag || e.pointerId !== refsDrag.id) return;
    refsDrag = null; document.body.classList.remove('is-resizing'); saveRefs();
  }
  function onRefsKey(e) {
    if (!e.target.classList || !e.target.classList.contains('wf-split')) return;
    const step = e.shiftKey ? 48 : 16;
    // thanh chia ở bên trái khung: ← mở rộng khung, → thu hẹp
    if (e.key === 'ArrowLeft') refsUi.w = clampRefs(refsUi.w + step);
    else if (e.key === 'ArrowRight') refsUi.w = clampRefs(refsUi.w - step);
    else if (e.key === 'Home') refsUi.w = REFS_DEFAULT;
    else return;
    e.preventDefault(); applyRefs(); saveRefs();
  }

  function trendAlertHTML(secId) {
    const hits = (res.findings || []).filter(f => f.sec === secId && f.trendFail);
    if (!hits.length) return '';
    // hướng xử lý theo từng tiêu chí (căn cứ khác nhau), mỗi loại ghi một lần
    const actions = [...new Map(hits.map(f => [f.basis + (QD.stdOf(f) ? ` · ${QD.stdOf(f)}` : ''), (f.note || '').replace(/^.*?(Hướng xử lý:)/, '$1')])).entries()];
    return `<div class="callout bad" role="alert"><b>Cảnh báo xu hướng so với số liệu quá khứ (QĐ 1901):</b><ul>${hits.map(f =>
      `<li><b>${esc(f.item)}</b>${f.loc ? ` – ${esc(f.loc)}` : ''}: ${esc(f.meas)}, ${esc(f.dev)} — ${f.status === 'warn' ? 'cần xem xét' : 'không đạt'} (${esc(f.limit)}; ${esc(f.ref)})</li>`).join('')}</ul>`
      + actions.map(([basis, a]) => `<div><b>${esc(basis)}:</b> ${esc(a)}</div>`).join('')
      + '<div class="callout-foot"><button type="button" class="btn small" data-nav="trend">Xem biểu đồ xu hướng →</button></div></div>';
  }
  // Mục 0: chọn các hạng mục thực hiện trong lần thí nghiệm này
  // Sau sửa chữa / đại tu: chọn lấy số liệu lần này làm giá trị khởi đầu cho các lần thí nghiệm sau
  function baselineResetHTML() {
    if (!Schema.BASELINE_RESETS || Common.kindOf(state.v['meta.reason']) !== 'AFTER_REPAIR') return '';
    return '<h3>Giá trị khởi đầu sau sửa chữa</h3><div class="fields">'
      + cfgField('baselineReset', 'Lấy số liệu lần này làm giá trị khởi đầu cho các lần sau', { options: Schema.BASELINE_RESETS, wide: true,
        note: 'Lần thí nghiệm sau so xu hướng với lần này thay cho giá trị xuất xưởng. Lần này vẫn được so với giá trị khởi đầu cũ.' })
      + '</div>';
  }

  function itemsChecklistHTML() {
    const skip = state.cfg.skip || {};
    return '<h3>Hạng mục thực hiện trong lần thí nghiệm này</h3><div class="hint-text">Bỏ tích hạng mục không thực hiện: vùng nhập liệu được ẩn, '
      + 'không đánh giá, không ghi CSDL và để trống ô "đã thí nghiệm" ở trang 1 BBTN. Số liệu đã nhập vẫn được giữ — tích lại để xem.</div>'
      + `<div class="sec-checklist">${schema.sections.map(s => `<label><input type="checkbox" data-skipsec="${s.id}" ${skip[s.id] ? '' : 'checked'}> ${esc(String(s.no))}. ${esc(s.title)}</label>`).join('')}</div>`;
  }

  // ---------------------------------------------------------------- pages
  // ---------------------------------------------------------------- trình khởi tạo BBTN (trang general, 4 bước)
  const SETUP_STEPS = [['device', 'Thiết bị'], ['specs', 'Thông số kỹ thuật'], ['test', 'Lần thí nghiệm'], ['config', 'Mẫu & cấu hình']];
  const TEST_KEYS = ['meta.reason', 'meta.date', 'meta.ambT', 'meta.hum'];
  let setupStep = 'device';
  function setupGo(step) { if (SETUP_STEPS.some(([k]) => k === step)) setupStep = step; current = 'general'; renderNav(); renderMain(); window.scrollTo(0, 0); }
  function setupStepsHTML() {
    const i = SETUP_STEPS.findIndex(([k]) => k === setupStep);
    return `<nav class="wf-steps setup-steps" aria-label="Các bước khởi tạo biên bản">${SETUP_STEPS.map(([k, t], j) => `<button type="button" class="wf-step ${k === setupStep ? 'on' : ''}${j < i ? ' done' : ''}" `
      + `data-act="setupStep" data-step="${k}" ${k === setupStep ? 'aria-current="step"' : ''}><span class="wf-n">${j + 1}</span><span>${t}</span></button>`).join('')}</nav>`;
  }
  function setupFootHTML() {
    const i = SETUP_STEPS.findIndex(([k]) => k === setupStep);
    const prev = i > 0 ? `<button class="btn" data-act="setupStep" data-step="${SETUP_STEPS[i - 1][0]}">‹ ${SETUP_STEPS[i - 1][1]}</button>` : '<span></span>';
    const next = i < SETUP_STEPS.length - 1 ? `<button class="btn primary" data-act="setupStep" data-step="${SETUP_STEPS[i + 1][0]}">${SETUP_STEPS[i + 1][1]} ›</button>`
      : '<button class="btn primary" data-act="setupDone">Bắt đầu nhập số liệu →</button>';
    return `<div class="setup-foot">${prev}${next}</div>`;
  }
  // Đổi template (mẫu theo pha A/B/C, mẫu chung 3 pha, 110–220 kV) như ô "Mẫu BBTN", lấy mặc định của template mới cho ô trống
  async function applyTemplate(key) {
    if (!key || !EMB.templates[key] || state.cfg.template === 'custom' || state.cfg.template === key) return false;
    const before = schema.layout;
    state.cfg.template = key;
    const layout = Schema.layoutOf(state.cfg);
    state.cfg.topology = layout === Schema.LAYOUT_3P ? 'bank1p' : layout === Schema.LAYOUT_110 ? 'threePhase' : 'single1p';
    if (state.cfg.topology !== 'bank1p') state.cfg.reportScope = 'combined';
    applyFactoryDefaults(state.cfg);
    schema = T().buildSchema(state.cfg);
    if (schema.layout !== before) { await fillTemplateDefaults(); rememberTemplateHead(); }
    return true;
  }
  // giá trị mặc định của template ở các ô đầu biên bản (tự điền thông số được ghi đè các ô này)
  function rememberTemplateHead() {
    state.att = state.att || {};
    state.att.tplHead = Object.fromEntries(schema.head.map(f => [f.k, state.v[f.k] ?? '']));
  }
  // Tự điền thông số đầu biên bản (EquipmentSpecs.headFrom): ô trống, ô còn mặc định template, ô tự điền lần trước chưa sửa tay
  function applyHeadFills(fills) {
    state.att = state.att || {};
    const ocr = state.att.ocr = state.att.ocr || {};
    const tpl = state.att.tplHead || {};
    const auto = Object.fromEntries(Object.entries(ocr).filter(([, x]) => x.src).map(([k]) => [k, state.v[k]]));
    // ô tự điền lần trước (thiết bị khác) mà nguồn mới không có → trả về mặc định template
    Object.keys(auto).forEach(k => { if (!fills[k]) { state.v[k] = tpl[k] ?? ''; delete ocr[k]; } });
    const plan = EquipmentSpecs.fillPlan(state.v, fills, Object.assign({}, tpl, auto));
    // nhãn ô: trường đầu biên bản, hoặc ô bảng (vd sứ xuyên: "Sứ phía cao áp (HV) · A · Kiểu loại")
    const label = k => {
      const f = schema.head.find(x => x.k === k);
      if (f) return f.label;
      let out = k;
      Common.eachGrid(schema, g => {
        if (!k.startsWith(g.id + '.')) return;
        const [rk, ck] = k.slice(g.id.length + 1).split('.');
        const r = g.rows.find(x => x.k === rk), c = g.cols.find(x => x.k === ck);
        if (r && c) out = `${(schema.sections.find(s => (s.groups || []).some(gr => (gr.grids || []).includes(g))) || {}).title || ''} · ${c.label} · ${r.label}`.replace(/^ · /, '');
      });
      return out;
    };
    Object.entries(plan).forEach(([k, f]) => { state.v[k] = f.value; ocr[k] = { status: 'check', label: label(k), src: f.src }; });
    // ô không có trong CSDL / test report mà còn giá trị mẫu của template → để trống, tô đỏ "nhập tay"
    EquipmentSpecs.staleKeys(state.v, fills, tpl).forEach(k => { state.v[k] = ''; ocr[k] = { status: 'missing', label: label(k), src: 'CSDL / test report' }; });
    return plan;
  }

  function renderGeneral() {
    const U = TU();
    let h = headHTML('0', 'Thông tin chung & cấu hình', 'Khởi tạo biên bản');
    h += setupStepsHTML();
    if (setupStep === 'device') {
      const topology = state.cfg.topology || 'single1p';
      h += SetupUI.deviceHTML(App);
      h += U.generalTopology ? U.generalTopology(App) : '';
      if (topology !== 'bank1p') h += `<h3>Số chế tạo</h3><div class="fields">${schema.head.filter(f => f.k === 'meta.serial').map(f => fieldHTML(f)).join('')}</div>`;
      h += U.unitSerialFields ? U.unitSerialFields(App) : '';
      h += SetupUI.reportHTML(App);
    } else if (setupStep === 'specs') {
      h += `<h3>Thông số kỹ thuật (điền vào đầu biên bản)</h3>${U.headTools ? U.headTools(App) : ''}`
        + '<div class="row-actions"><button class="btn" data-act="suFill" title="Theo số chế tạo đang nhập: CSDL trước, thiếu thì test report; ô đã nhập tay được giữ">Điền lại từ CSDL / test report</button></div>'
        + `${flagBannerHTML()}<div class="fields">${schema.head.filter(f => f.k !== 'meta.serial' && !TEST_KEYS.includes(f.k)).map(f => fieldHTML(f)).join('')}</div>`
        + SetupUI.reportHTML(App);
    } else if (setupStep === 'test') {
      h += `<h3>Lần thí nghiệm</h3><div class="fields">${schema.head.filter(f => TEST_KEYS.includes(f.k)).map(f => fieldHTML(f)).join('')}</div>`;
      h += baselineResetHTML();
      h += itemsChecklistHTML();
    } else {
      h += renderConfigStep();
    }
    return `<section class="panel setup-panel">${h}${setupFootHTML()}</section>`;
  }

  function renderConfigStep() {
    const D = FX && FX.data, U = TU();
    const topology = state.cfg.topology || 'single1p';
    const topologyOfTemplate = key => key === '3P' ? 'bank1p' : key === '110' ? 'threePhase' : 'single1p';
    const templates = Object.keys(EMB.templates).filter(k => topologyOfTemplate(k) === topology);
    const custom = lsGet(LS_TPL) ? JSON.parse(lsGet(LS_TPL)) : null;
    if (custom && topologyOfTemplate(state.cfg.layout) === topology) templates.push('custom');
    const templateOptions = templates.map(k => [k, k === 'custom' ? `Tùy chỉnh: ${custom.name}` : EMB.templates[k].name]);
    let h = '<h3>Template & số liệu xuất xưởng</h3><div class="fields">';
    h += cfgField('template', 'Mẫu BBTN theo cấu hình', { options: templateOptions.length ? templateOptions : [[state.cfg.template, topology === 'bank1p' ? 'Mẫu chung 3 MBA một pha' : topology === 'threePhase' ? 'Mẫu MBA ba pha' : 'Mẫu MBA một pha']] });
    h += `<div class="field"><label>Nạp template khác (.docx cùng cấu trúc)</label><button class="btn" data-act="loadDocx">Chọn file template…</button></div>`;
    // nhiều file (vd AT1, AT2): chọn file đang dùng; app tự chọn theo số chế tạo máy chính khi nhập hoặc mở biên bản
    h += FXS.length > 1
      ? `<div class="field"><label>File số liệu xuất xưởng (${FXS.length} file — tự chọn theo số chế tạo)</label><select data-fxsel>${FXS.map((x, i) => `<option value="${i}" ${x.api === FX ? 'selected' : ''}>${esc(x.name)} — ${esc(x.api.data.order.join(', '))}</option>`).join('')}</select></div>`
      : `<div class="field"><label>File số liệu xuất xưởng</label><div class="calcval file" title="${esc(D ? D.fileName : '')}">${esc(D ? D.fileName : 'chưa nạp')}</div></div>`;
    h += `<div class="field"><label>Thêm file xuất xưởng (.xlsx, giữ cả các file đã nạp)</label><button class="btn" data-act="loadXlsx">Thêm file .xlsx…</button></div>`;
    h += (U.generalFiles ? U.generalFiles(App) : '') + '</div>';
    h += U.reportScopeFields ? U.reportScopeFields(App) : '';
    if (D && D.warnings.length) h += `<div class="callout warn"><b>${esc(D.fileName)}:</b><br>${D.warnings.map(esc).join('<br>')}</div>`;
    h += U.generalConfig ? U.generalConfig(App) : '';
    // "Các máy trong file xuất xưởng": xem ở mục XX (khối File .xlsx trên máy này)
    if (D) h += '<div class="hint-text">Các máy trong file xuất xưởng (Job No., P0, nhiệt độ đo, độ ẩm DFR): xem ở <button class="btn small" data-nav="factory">XX Số liệu xuất xưởng</button>.</div>';
    return h;
  }

  // Hạng mục thí nghiệm theo 4 bước; khung Tài liệu tham khảo bên phải
  function renderSection(s) {
    const U = TU(), step = Workflow.stepOf(s.id), S = res.sec[s.id];
    let body = '';
    // Hướng dẫn đo: nội dung có hình, Admin chỉnh được (GuideUI); loại thiết bị chưa khai báo thì dùng danh sách bước
    if (step === 'guide' && window.GuideUI && GuideUI.has(s.id)) body = GuideUI.html(s.id);
    else if (step === 'prep' || step === 'guide') body = Workflow.procedureHTML(T(), s.id, step, esc, DB.role === 'admin');
    else if (step === 'eval') body = findingsHTML(s.id);
    else if (s.id === 'shortCircuit') body = AppendixUI.shortCircuitHTML(App) + `<div class="wf-sum" data-fsum="${s.id}"></div>`;
    else {
      body = trendAlertHTML(s.id) + (U.intro ? U.intro(s.id, App) : '') + (U.sectionTools ? U.sectionTools(s.id, App) : '');
      if (s.fields) body += '<div class="fields">' + s.fields.map(f => sectionField(f)).join('') + '</div>';
      (s.grids || []).forEach(g => { body += gridHTML(g); });
      (s.groups || []).forEach(gr => {
        body += `<h3>${esc(gr.title)}</h3>`;
        if (gr.fields) body += '<div class="fields">' + gr.fields.map(f => sectionField(f)).join('') + '</div>';
        gr.grids.forEach(g => { body += gridHTML(g); });
      });
      if (s.extraDoc) body += '<div class="fields">' + s.extraDoc.map(x => `<div class="field"><label>${esc(x.label || (x.k === 'ir.k1' ? 'Hệ số quy đổi K1 (ghi vào BBTN)' : 'Hệ số quy đổi K2 (ghi vào BBTN)'))}</label><div class="calcval" data-n="${x.k}"></div></div>`).join('') + '</div>';
      if (U.sectionFooter) body += U.sectionFooter(s.id, App);
      body += `<div class="wf-sum" data-fsum="${s.id}"></div>`;
    }
    if (S && S.skipped) {
      return `<section class="panel" data-sec="${s.id}">${headHTML(String(s.no), s.title, s.en, s.id)}`
        + '<div class="callout">Hạng mục <b>không thực hiện</b> trong lần thí nghiệm này. Tích ô <b>Thực hiện</b> ở trên để nhập số liệu (số liệu đã nhập trước đó vẫn được giữ).</div></section>';
    }
    const refsBtn = `<button type="button" class="btn small wf-refs-toggle" data-act="refsToggle" aria-controls="wfRefs" aria-pressed="${refsUi.hidden ? 'false' : 'true'}" `
      + `title="Ẩn / hiện khung tài liệu tham khảo">Tài liệu tham khảo</button>`;
    const split = `<div class="wf-split" role="separator" tabindex="0" aria-orientation="vertical" aria-controls="wfRefs" `
      + `aria-label="Đổi độ rộng khung tài liệu tham khảo (mũi tên trái / phải, nhấp đúp: mặc định)" aria-valuemin="${REFS_MIN}" aria-valuemax="${REFS_MAX}" aria-valuenow="${refsUi.w}"></div>`;
    const h = headHTML(String(s.no), s.title, s.en, s.id) + `<div class="wf-bar">${Workflow.stepsHTML(s.id, S)}<div class="wf-bar-tools">${refsBtn}${editToolsHTML(s.id)}</div></div>`
      + `<div class="${refsLayoutClass()}" style="--refs-w:${refsUi.w}px"><div class="wf-main" data-step="${step}">${body}</div>${split}${Workflow.referencesHTML(T(), s.id, esc, StandardsUI.docs || [], EquipmentTypes.codeOf(state), (id, path) => DB.libraryFileUrl(path))}</div>`;
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
    // ô cấu hình đặt ngay trong hạng mục (vd 7.1 cách đo cuộn cao áp): ghi vào state.cfg, đồng bộ với mục 0
    if (!custom && f.cfg) return cfgField(f.cfg, f.label, { options: f.options, num: f.num });
    return custom || fieldHTML(f);
  }

  function renderSummary() {
    let h = headHTML('Σ', 'Tổng hợp & kết luận', 'Summary');
    h += '<div class="hint-text">Cột “Ghi vào BBTN” điền vào bảng hạng mục ở trang 1 của biên bản. Để “Tự động” nếu muốn dùng kết quả đánh giá của app.</div>';
    h += '<div class="grid-wrap"><table class="ftable summary-table"><thead><tr><th>STT</th><th>Hạng mục</th><th>Đã thí nghiệm</th><th>Đánh giá tự động</th><th>Số mục (đạt / xem xét / không đạt / thiếu)</th><th>Ghi vào BBTN</th></tr></thead><tbody>';
    schema.sections.forEach(s => {
      const S = res.sec[s.id];
      const autoTick = !!S.status;
      const tick = !S.skipped && (state.sum.tick[s.id] ?? autoTick);
      const ev = state.sum.ev[s.id] || '';
      h += `<tr class="${S.skipped ? 'sec-skipped' : S.status ? 'st-' + S.status : ''}"><td>${s.no}</td><td>${esc(s.title)}</td>
        <td><input type="checkbox" data-sumtick="${s.id}" ${tick ? 'checked' : ''} ${S.skipped ? 'disabled aria-label="Hạng mục không thực hiện"' : ''}></td>
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
  // Trang XX: cây / danh sách / xem / sửa số liệu xuất xưởng (FactoryUI); bảng file .xlsx trên máy + sheet thô ở khối thu gọn
  function renderFactory() {
    return `<section class="panel">${headHTML('XX', 'Số liệu xuất xưởng', FX ? `Đang dùng: ${FX.data.fileName}` : '')}${FactoryUI.render(App)}</section>`;
  }
  function localFactoryHTML() {
    let h = '';
    if (!FX) return '<div class="empty">Chưa nạp file .xlsx trên máy này.</div>';
    const sh = FX.data.sheets;
    h += '<div class="grid-wrap"><table class="grid"><thead><tr><th>File</th><th>Các máy (số chế tạo – pha)</th><th>Cảnh báo</th><th></th></tr></thead><tbody>'
      + FXS.map(x => { const d = x.api.data; return `<tr><th>${esc(x.name)}${x.emb ? ' <span class="badge">nhúng sẵn</span>' : ''}${x.api === FX ? ' <span class="badge st-pass">đang dùng</span>' : ''}</th>`
        + `<td>${esc(d.order.map(sn => `${sn} – ${d.units[sn].phase || '?'}`).join(', '))}</td><td>${d.warnings.length ? `<span title="${esc(d.warnings.join('\n'))}">${d.warnings.length}</span>` : '—'}</td>`
        + `<td class="row-actions">${x.api === FX ? '' : `<button class="btn small" data-act="useFx" data-name="${esc(x.name)}">Dùng file này</button>`}${x.emb ? '' : `<button class="btn small danger" data-act="delFx" data-name="${esc(x.name)}">Bỏ</button>`}</td></tr>`; }).join('')
      + '</tbody></table></div>';
    h += TU().factoryUnits ? TU().factoryUnits(App) : '';
    // số liệu dựng lại từ CSDL (không có file gốc): không có sheet để xem
    if (!sh || !sh.length) return h + `<p class="muted">Số liệu xuất xưởng đang dùng (${esc(FX.data.fileName)}) dựng lại từ CSDL — không có file .xlsx gốc để xem sheet.</p>`;
    h += `<h4>Xem sheet của file đang dùng: ${esc(FX.data.fileName)}</h4>`;
    h += '<div class="tabs" role="tablist" aria-label="Các sheet của file">' + sh.map((s, i) => `<button type="button" role="tab" aria-selected="${i === factoryTab}" data-ftab="${i}" class="${i === factoryTab ? 'on' : ''}">${esc(s.name)}</button>`).join('') + '</div>';
    const rows = (sh[factoryTab] || sh[0]).rows;
    h += '<div class="raw"><table>' + rows.map(r => '<tr>' + (r || []).map(c => `<td title="${esc(c)}">${esc(typeof c === 'number' ? +c.toFixed(6) : c)}</td>`).join('') + '</tr>').join('') + '</table></div>';
    return h;
  }

  // Thêm một file xuất xưởng (.xlsx) vào danh sách trên máy và dùng ngay (nút "Thêm file .xlsx", "Dùng cho biên bản" ở trang XX)
  function addFactoryFile(name, buf, quiet) {
    const entry = { name, api: factoryReader().fromArrayBuffer(buf, name), emb: false };
    if (!entry.api.data.order.length) throw new Error('không xác định được số chế tạo các máy trong file');
    const list = factoryFiles().filter(x => x.name !== name).concat([{ name, b64: abToB64(buf) }]);
    if (!lsSet(LS_FACS, JSON.stringify(list))) toast('File lớn — chỉ dùng trong phiên này', true);
    FXS = FXS.filter(x => x.name !== name).concat([entry]);
    setFactory(entry, true);
    recompute(); renderNav(); renderMain(); persist();
    const D = entry.api.data;
    if (!quiet) toast(`Đã thêm ${name}: ${D.order.length} máy (${D.order.join(', ')})${D.warnings.length ? ' — có cảnh báo, xem mục 0' : ''}`, D.warnings.length > 0);
    return entry;
  }
  // Số liệu xuất xưởng dựng lại từ CSDL (không có file gốc): chỉ dùng trong phiên, không lưu vào máy
  function addFactoryApi(name, api, quiet) {
    if (!api.data.order.length) throw new Error('không có máy nào trong số liệu xuất xưởng');
    const entry = { name, api, emb: false, db: true };
    FXS = FXS.filter(x => x.name !== name).concat([entry]);
    // biên bản có nhiều máy ở nhiều nguồn: dùng nguồn có máy chính
    if (!FX || !FX.has(String(state.v['meta.serial'] || '').trim()) || api.has(String(state.v['meta.serial'] || '').trim())) setFactory(entry, true);
    recompute(); renderNav(); renderMain(); persist();
    if (!quiet) toast(`Dùng số liệu xuất xưởng từ CSDL: ${api.data.order.join(', ')} — không có file gốc nên thiếu điện áp nấc (tỷ số HV:LV), thông số sứ, tổn hao ngắn mạch`);
    return entry;
  }
  // Bỏ một file xuất xưởng khỏi danh sách trên máy (file nhúng sẵn quay lại khi tải lại trang)
  function removeFactory(name) {
    lsSet(LS_FACS, JSON.stringify(factoryFiles().filter(x => x.name !== name)));
    const wasActive = FX && FXS.some(x => x.name === name && x.api === FX);
    FXS = FXS.filter(x => x.name !== name);
    if (wasActive) { if (!pickFactory(true) && FXS.length) setFactory(FXS[FXS.length - 1], true); if (!FXS.length) FX = null; }
    recompute(); renderNav(); renderMain(); persist(); toast(`Đã bỏ file xuất xưởng ${name}`);
  }
  // Chọn file test report (.xlsx) kèm mục đích: trang nhận sự kiện factory:added (FactoryUI: lưu CSDL cho thiết bị; SetupUI: trình khởi tạo)
  let xlsxPurpose = null;
  function pickXlsx(purpose) { xlsxPurpose = purpose || null; $('#fileXlsx').click(); }
  // file gốc đã nạp dưới dạng Blob (lưu kèm số liệu lên CSDL)
  function factoryBlob(name) {
    const b64 = factoryFileB64(name);
    return b64 ? new Blob([Uint8Array.from(atob(b64), ch => ch.charCodeAt(0))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) : null;
  }
  // nội dung gốc của file đã nạp (base64) — để lưu file test report lên CSDL cùng số liệu
  function factoryFileB64(name) {
    const e = FXS.find(x => x.name === name);
    if (e && e.emb) return EMB.factory && EMB.factory.name === name ? EMB.factory.b64 : null;
    const o = factoryFiles().find(x => x.name === name);
    return o ? o.b64 : null;
  }

  function renderMain() {
    TrendInlineUI.prepare({ state, schema, type: T(), res });
    const main = $('#main');
    let html;
    if (current === 'general') html = renderGeneral();
    else if (current === 'model3d') html = MbaModel3DUI.render(schema, res);
    else if (current === 'summary') html = renderSummary();
    else if (current === 'factory') html = renderFactory();
    else if (current === 'db') html = DbUI.renderDb();
    else if (current === 'trend') html = DbUI.renderTrend();
    else if (current === 'catalog') html = Catalog.render();
    else if (current === 'kconf') html = KConf.render();
    else if (current === 'appendix') html = AppendixUI.render(App);
    else if (current === 'criteria') html = CriteriaUI.render();
    else if (current === 'field') html = FieldUI.render();
    else if (current === 'guidecfg') html = GuideUI.renderConfig();
    else if (current === 'standards') html = StandardsUI.render();
    else if (current === 'importReport') html = ImportReportUI.render(App);
    else html = renderSection(schema.sections.find(s => s.id === current));
    const dl = FX ? `<datalist id="dlSerials">${FX.data.order.map(s => `<option value="${esc(s)}">`).join('')}</datalist>` : '';
    if (activePdfReview) html = pdfReviewHTML(html);
    main.innerHTML = html + dl;
    updateComputed();
    DbUI.afterRender(current); // trang khác: chỉ bỏ điểm “biên bản đang nhập” đã gửi sang trang Xu hướng
    if (current === 'model3d') MbaModel3DUI.init(main);
    if (current === 'catalog') Catalog.afterRender();
    if (current === 'general' && (setupStep === 'device' || setupStep === 'specs')) SetupUI.afterRender(App);
    if (current === 'factory') FactoryUI.afterRender(App);
    if (current === 'kconf') KConf.afterRender();
    if (current === 'appendix') AppendixUI.afterRender(App);
    if (current === 'criteria') CriteriaUI.afterRender();
    if (current === 'standards') StandardsUI.afterRender();
    if (window.GuideUI && main.querySelector('[data-gimg]')) GuideUI.afterRender();
    if (current === 'field') FieldUI.afterRender();
    if (current === 'guidecfg') GuideUI.afterRenderConfig();
  }

  function clearPdfReview() {
    if (activePdfReview && activePdfReview.url) URL.revokeObjectURL(activePdfReview.url);
    activePdfReview = null;
  }

  function pdfReviewHTML(formHTML) {
    if (!activePdfReview) return formHTML;
    const importId = state.imported && state.imported.importId;
    const canMarkReviewed = state.imported && state.imported.format === 'pdf' && importId && !state.imported.reviewed;
    return `<div class="pdf-review-shell">
      <div class="pdf-review-toolbar"><div><strong>Đối chiếu BBTN PDF</strong><span>${esc(activePdfReview.fileName || 'Tài liệu PDF')}</span></div>
        <div class="row-actions" style="margin:0">${canMarkReviewed ? `<button class="btn small primary" type="button" data-act="impReviewDone" data-id="${esc(importId)}">Đã soát</button>` : ''}
          <button class="btn small" type="button" data-act="closePdfReview">Đóng soát song song</button></div></div>
      <div class="pdf-review-split"><section class="pdf-review-source" aria-label="Biên bản PDF gốc">
        <iframe title="Biên bản PDF gốc" src="${esc(activePdfReview.url)}"></iframe></section>
        <section class="pdf-review-form" aria-label="Biểu mẫu để soát và nhập số liệu">${formHTML}</section></div>
    </div>`;
  }

  function closePdfReview() {
    const returnTo = activePdfReview && activePdfReview.returnTo || 'general';
    clearPdfReview();
    current = returnTo;
    renderNav();
    renderMain();
    window.scrollTo(0, 0);
  }

  // Xu hướng tại ô: tải lịch sử đo của thiết bị trong biên bản (đã lưu CSDL, đã đăng nhập); không dựng lại trang
  function loadInlineTrend() {
    // lịch sử về (hoặc đổi thiết bị) → đánh giá lại ngay để thấy vi phạm xu hướng tại hiện trường
    TrendInlineUI.load({ state, schema, type: T(), res }, $('#main'), () => { recompute(); renderNav(); renderMain(); })
      .catch(e => console.warn(e));
    autoFactory().catch(e => console.warn('Tự nạp số liệu xuất xưởng:', e.message));
  }

  // ---------------------------------------------------------------- tự nạp số liệu xuất xưởng của biên bản từ CSDL
  // Số chế tạo của biên bản (máy chính, cột pha A/B/C) chưa có trong file xuất xưởng nào trên máy → lấy lần nhập test
  // report (FAT) mới nhất của từng máy trong CSDL: có file .xlsx gốc thì tải file (đủ dữ liệu, lưu trên máy như file
  // nạp tay), không có thì dựng lại từ số đã lưu (Factory.fromRows) và lưu tạm dòng đo trên máy để dùng khi mất mạng.
  const LS_FXDB = 'bbtn-mba.fxdb';
  let autoFxFor = '';
  const recordSerials = () => [...new Set([state.v['meta.serial']].concat(Object.values(state.cfg.ps || {}))
    .map(x => String(x || '').trim()).filter(Boolean))];
  async function autoFactory() {
    if (!state || T().code !== 'MBA' || !factoryReader().fromRows) return;
    const sns = recordSerials();
    if (!sns.length) return;
    const covered = sn => FXS.some(x => x.api.has(sn));
    if (sns.every(covered)) { if (pickFactory(true)) { recompute(); renderMain(); } return; }
    const key = sns.join('|');
    if (autoFxFor === key) return;
    autoFxFor = key;
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem(LS_FXDB) || '{}') || {}; } catch (e) { cache = {}; }
    const missing = sns.filter(sn => !covered(sn));
    const sessions = [];
    let files = 0;
    if (window.DB && DB.user) {
      const fat = await DB.listFactorySessions();
      for (const sn of missing) {
        const ses = fat.filter(s => String(s.serial_no || '').trim() === sn && (s.n_values || 0) > 0)
          .sort((a, b) => String(b.test_date || '').localeCompare(String(a.test_date || '')))[0];
        if (!ses) continue;
        const doc = (await DB.listDocs(ses.id)).find(d => d.kind === 'FACTORY_REPORT' && /\.xlsx?$/i.test(d.file_name || ''));
        if (doc) {
          try {
            const entry = addFactoryFile(doc.file_name, await (await DB.downloadDoc(doc.storage_path)).arrayBuffer(), true);
            files++;
            if (entry.api.has(sn)) continue;
          } catch (e) { console.warn('Tải test report gốc:', e.message); }
        }
        const rows = await DB.factoryMeasurements(ses.id);
        const S = { serial: sn, testDate: ses.test_date, reportNo: ses.report_no || '', rows };
        sessions.push(S);
        cache[sn] = S;
      }
      try { localStorage.setItem(LS_FXDB, JSON.stringify(cache)); } catch (e) { /* đầy bộ nhớ: chỉ dùng trong phiên */ }
    } else {
      missing.forEach(sn => { if (cache[sn] && !covered(sn)) sessions.push(cache[sn]); });
    }
    const todo = sessions.filter(S => !covered(S.serial));
    if (todo.length) {
      const label = `CSDL ${todo.map(S => S.serial).join(', ')}`;
      addFactoryApi(label, factoryReader().fromRows(todo, label), true);
    } else if (files) { pickFactory(true); recompute(); renderMain(); }
    if (todo.length || files) toast(`Đã nạp số liệu xuất xưởng từ CSDL cho ${(todo.map(S => S.serial).concat(files ? ['file gốc'] : [])).join(', ')} — so sánh ΔR với XX`);
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
      // Không đạt: báo cho trình đọc màn hình (kèm dấu ✕ ở góc ô — CSS), không chỉ bằng màu viền
      if (f && f.status === 'fail') el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
      el.title = f ? `${ST_TEXT[f.status]} — ${f.item}${f.loc ? ' · ' + f.loc : ''}\nĐo: ${f.meas || ''}${f.conv ? '\nQuy đổi: ' + f.conv : ''}${f.ref ? '\nTham chiếu: ' + f.ref : ''}${f.dev ? '\nĐộ lệch: ' + f.dev : ''}${f.limit ? '\nGiới hạn: ' + f.limit : ''}${f.note ? '\n' + f.note : ''}\n(${f.basis || ''}${QD.stdOf(f) ? ' · ' + QD.stdOf(f) : ''})` : '';
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
    TrendInlineUI.decorate(main, res);
    if (ac) ac.textContent = T().autoConclusion(res, schema, state) || '(chưa có dữ liệu)';
    $$('[data-fsum]', main).forEach(el => { el.innerHTML = findingsSummary(el.dataset.fsum); });
    const head = $('.panel[data-sec] .panel-head .badge', main);
    const secEl = $('.panel[data-sec]', main);
    if (head && secEl) { const S = res.sec[secEl.dataset.sec]; head.className = `badge ${S.status ? 'st-' + S.status : 'st-none'}`; head.textContent = S.text || 'Chưa nhập'; }
    const flag = $('[data-wfflag]', main);
    if (flag && secEl) { const c = res.sec[secEl.dataset.sec].counts, n = c.fail + c.warn; flag.textContent = n || ''; flag.hidden = !n; }
    renderNav();
    renderRecordChip();
    // trang Nhập hiện trường: trạng thái ô, tiến độ, bản đồ ô (không vẽ lại để giữ bàn phím)
    if (current === 'field' && window.FieldUI) FieldUI.refresh();
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

  async function onInput(e) {
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
      if (el.dataset.k === 'meta.serial' && e.type === 'change') {
        if (state.cfg.topology === 'bank1p') {
          state.cfg.ps.A = el.value.trim();
          onSerialChange();
          schema = T().buildSchema(state.cfg);
          recompute(); renderMain(); persist(); loadInlineTrend(); return;
        }
        onSerialChange();
        oltcFromDb();
        loadInlineTrend(); // lịch sử đo của máy này → đánh giá xu hướng ngay khi nhập (biên bản mới tại hiện trường)
      }
      scheduleEval();
    } else if ((el.dataset.hk || el.dataset.lbl) && e.type === 'change') {
      // đề mục cột / nhãn hàng sửa được (vd mục 6, 8 MBA): lưu vào cấu hình, dựng lại schema mà không vẽ lại trang
      const t = el.value.trim();
      const map = el.dataset.hk ? (state.cfg.hdr = state.cfg.hdr || {}) : (state.cfg[el.dataset.lblcfg] = state.cfg[el.dataset.lblcfg] || {});
      const id = el.dataset.hk || el.dataset.lbl;
      if (t && t !== el.placeholder) map[id] = t; else delete map[id];
      if (el.dataset.lbl) $$(`[data-lblm="${id}"]`).forEach(x => { x.textContent = t || el.placeholder; });
      // cùng khóa ở bảng khác (bảng quy đổi 20 °C, các bảng BCT cùng phía): cập nhật ngay
      if (el.dataset.hk) {
        $$(`[data-hk="${CSS.escape(id)}"]`).forEach(x => { if (x !== el) x.value = t || el.placeholder; });
        $$(`[data-hkm="${CSS.escape(id)}"]`).forEach(x => { x.textContent = t || el.placeholder; });
      }
      if (!t) el.value = el.dataset.hk ? el.placeholder : '';
      schema = T().buildSchema(state.cfg); recompute(); updateComputed(); persist();
    } else if (el.dataset.skipsec && e.type === 'change') {
      // tích / bỏ tích "Thực hiện" của một hạng mục: số liệu giữ nguyên trong biên bản, chỉ ẩn / hiện và đánh giá lại
      const id = el.dataset.skipsec;
      state.cfg.skip = Object.assign({}, state.cfg.skip);
      if (el.checked) delete state.cfg.skip[id]; else state.cfg.skip[id] = true;
      recompute(); renderNav(); renderMain(); persist();
      const s = schema.sections.find(x => x.id === id);
      toast(`${s ? `${s.no}. ${s.title}` : id}: ${el.checked ? 'thực hiện' : 'không thực hiện (ẩn vùng nhập, không đánh giá, không ghi BBTN/CSDL)'}`);
    } else if (el.dataset.cfg && e.type === 'change') {
      const before = schema.layout;
      const previousTopology = el.dataset.cfg === 'topology' ? state.cfg.topology : null;
      setCfg(el.dataset.cfg, el.value);
      clearFlag('cfg.' + el.dataset.cfg, el);
      if (/^ps\.[BC]$/.test(el.dataset.cfg) && state.cfg.topology === 'bank1p') {
        pickFactory(true);
      }
      // số chế tạo máy các pha đổi → tải lịch sử (xu hướng; BBTN riêng từng pha: số liệu 2 pha còn lại)
      if (/^ps\.[ABC]$/.test(el.dataset.cfg)) setTimeout(loadInlineTrend, 0);
      if (el.dataset.cfg === 'topology') {
        const topology = el.value;
        const standard = topology === 'bank1p' ? '3P' : topology === 'threePhase' ? '110' : 'A';
        const requiredLayout = topology === 'bank1p' ? '3P' : topology === 'threePhase' ? '110' : '1P';
        if (state.cfg.template === 'custom' && state.cfg.layout !== requiredLayout) {
          state.cfg.topology = previousTopology;
          toast(`Template tùy chỉnh hiện tại có bố cục ${state.cfg.layout}; nạp template phù hợp trước khi đổi cấu hình.`, true);
        } else {
          if (state.cfg.template !== 'custom') {
            const currentIsSingle = ['A', 'B', 'C'].includes(state.cfg.template);
            state.cfg.template = topology === 'single1p' && currentIsSingle ? state.cfg.template : standard;
          }
          if (topology !== 'bank1p') state.cfg.reportScope = 'combined';
          applyFactoryDefaults(state.cfg);
          if (topology === 'bank1p') {
            state.cfg.ps.A = state.cfg.ps.A || state.v['meta.serial'] || '';
            state.v['meta.serial'] = state.cfg.ps.A;
          }
        }
      } else if (el.dataset.cfg === 'template') {
        const layout = Schema.layoutOf(state.cfg);
        state.cfg.topology = layout === Schema.LAYOUT_3P ? 'bank1p' : layout === Schema.LAYOUT_110 ? 'threePhase' : 'single1p';
        if (state.cfg.topology !== 'bank1p') state.cfg.reportScope = 'combined';
        applyFactoryDefaults(state.cfg);
        if (state.cfg.topology === 'bank1p') {
          state.cfg.ps.A = state.cfg.ps.A || state.v['meta.serial'] || '';
          state.v['meta.serial'] = state.cfg.ps.A;
        }
      }
      if (el.dataset.cfg === 'oltcWinding') {
        // đổi cuộn đặt OLTC: số liệu đã nhập theo cấu hình cũ vẫn giữ trong biên bản (khóa ô khác nhau), chỉ ẩn khỏi biểu mẫu
        toast(state.cfg.oltcWinding === 'MV'
          ? 'OLTC ở cuộn trung áp: R một chiều cuộn trung áp và tỷ số MV:LV nhập theo nấc. Số liệu đã nhập theo cấu hình cũ (nấc cuộn cao áp, HV:LV theo nấc) vẫn lưu trong biên bản nhưng không hiện, không đánh giá và không xuất BBTN — đổi lại cấu hình cũ để xem.'
          : 'OLTC ở cuộn cao áp: R một chiều cuộn cao áp và tỷ số HV:LV nhập theo nấc. Số liệu đã nhập theo cấu hình cũ (nấc cuộn trung áp, MV:LV theo nấc) vẫn lưu trong biên bản nhưng không hiện, không đánh giá và không xuất BBTN — đổi lại cấu hình cũ để xem.');
      }
      if (/^(taps|bctCores|hvMeas|oltcWinding|dcrRefT|template|topology|reportScope|ps\.)/.test(el.dataset.cfg)) {
        if (el.dataset.cfg === 'taps' && state.cfg.taps.length !== 19) toast(`Cần đúng 19 nhãn nấc (đang có ${state.cfg.taps.length}) — tạm dùng mặc định`, true);
        schema = T().buildSchema(state.cfg);
        // đổi giữa mẫu theo pha và mẫu chung 3 pha: biểu mẫu đổi bố cục, lấy giá trị mặc định của template mới cho ô còn trống
        if (['template', 'topology'].includes(el.dataset.cfg) && schema.layout !== before) {
          await fillTemplateDefaults();
          renderNav();
          toast(schema.layout === '3P' ? 'Đã chuyển sang mẫu chung 3 pha: không tải, cách điện, tgδ cuộn dây, ẩm nhập theo từng máy A, B, C'
            : schema.layout === '110' ? 'Đã chuyển sang mẫu MBA 3 pha 110–220 kV (nấc 1…19)' : 'Đã chuyển sang mẫu theo pha máy chính');
        }
      }
      recompute();
      if (/^(template|topology|reportScope|ps\.|bctCores|taps|oltcCharts|hvMeas|oltcWinding|dcrRefT)/.test(el.dataset.cfg)) renderMain(); else updateComputed();
      persist();
    } else if (el.dataset.exportPhase && e.type === 'change') {
      const phase = el.dataset.exportPhase, selected = new Set(state.cfg.reportPhases || []);
      if (el.checked) selected.add(phase); else selected.delete(phase);
      state.cfg.reportPhases = ['A', 'B', 'C'].filter(ph => selected.has(ph));
      persist();
    } else if (el.dataset.fxsel !== undefined && e.type === 'change') {
      const entry = FXS[+el.value];
      if (entry) { setFactory(entry); recompute(); renderNav(); renderMain(); persist(); }
    } else if (el.dataset.sumtick) {
      state.sum.tick[el.dataset.sumtick] = el.checked; persist();
    } else if (el.dataset.sumev !== undefined && e.type === 'change') {
      state.sum.ev[el.dataset.sumev] = el.value; persist();
    }
  }
  function onSerialChange() {
    pickFactory(); // số chế tạo thuộc file xuất xưởng khác (vd AT2) → chuyển sang file đó
    const u = FX && FX.unit(state.v['meta.serial']);
    if (!u) { toast('Số chế tạo không có trong file xuất xưởng — các so sánh với máy chính sẽ thiếu tham chiếu', true); return; }
    const key = T().templateKeyFor ? T().templateKeyFor(state, FX) : null;
    if (key && state.cfg.template !== 'custom' && EMB.templates[key] && state.cfg.template !== key) {
      state.cfg.template = key;
      toast(`Đã chọn template ${EMB.templates[key].name} theo pha ${key}`);
    }
  }

  // Mẫu 110–220 kV: máy đã lưu trong CSDL với cuộn đặt OLTC (equipment.rated.oltc_winding) → chọn sẵn theo CSDL
  async function oltcFromDb() {
    if (schema.layout !== Schema.LAYOUT_110 || !window.DB || !DB.user || !DB.equipmentRated) return;
    const sn = String(state.v['meta.serial'] || '').trim();
    if (!sn) return;
    let rated = null;
    try { rated = await DB.equipmentRated('MBA', sn); } catch (_) { return; } // mất mạng: giữ cấu hình hiện tại
    const w = rated && rated.oltc_winding;
    if (!['HV', 'MV'].includes(w) || w === state.cfg.oltcWinding || String(state.v['meta.serial'] || '').trim() !== sn) return;
    state.cfg.oltcWinding = w;
    schema = T().buildSchema(state.cfg); recompute(); renderMain(); persist();
    toast(`Máy ${sn} trong CSDL có bộ điều áp ở cuộn ${w === 'MV' ? 'trung áp' : 'cao áp'} — đã chọn theo CSDL (đổi ở mục 0 nếu cần)`);
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

  function voiceHTML() {
    return window.VoiceInput ? window.VoiceInput.buttonHTML() : '';
  }

  async function onClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.m3dgo) { App.go(b.dataset.m3dgo); if (b.dataset.m3danchor) document.getElementById(b.dataset.m3danchor)?.scrollIntoView({ block: 'start' }); return; }
    if (b.dataset.nav === 'help') { HelpUI.open(App); return; }
    if (b.dataset.setup) setupStep = b.dataset.setup;
    if (b.dataset.nav) { current = b.dataset.nav; renderNav(); renderMain(); $('#main').scrollTop = 0; window.scrollTo(0, 0); return; }
    if (b.dataset.filter) { filters[b.dataset.fsec] = b.dataset.filter; updateComputed(); return; }
    if (b.dataset.ftab !== undefined) {
      // chỉ vẽ lại khối file trên máy (giữ khối mở, giữ vị trí cuộn); không vẽ lại cả trang XX
      factoryTab = +b.dataset.ftab;
      const body = b.closest('.fx-local-body');
      if (!body) { renderMain(); return; }
      body.innerHTML = localFactoryHTML();
      const on = body.querySelector(`[data-ftab="${factoryTab}"]`); if (on) on.focus({ preventScroll: true });
      return;
    }
    if (b.dataset.wfstep) { Workflow.setStep(b.dataset.sec, b.dataset.wfstep); renderMain(); return; }
    if (b.dataset.newtype) { chooseTypeDone(b.dataset.newtype); return; }
    if (b.dataset.undo) { undoSection(b.dataset.undo); return; }
    if (b.dataset.clearsec) { clearSection(b.dataset.clearsec); return; }
    const act = b.dataset.act;
    try {
      if (act === 'new') openTypeDialog();
      else if (act === 'closePdfReview') closePdfReview();
      else if (act === 'refsToggle') toggleRefs();
      else if (act === 'setupStep') setupGo(b.dataset.step);
      else if (act === 'setupDone') { const first = schema.sections.find(s => !(res.sec[s.id] && res.sec[s.id].skipped)) || schema.sections[0]; App.go(first.id); }
      else if (act && act.startsWith('su')) await track(b.textContent.trim() || act, () => SetupUI.action(act, b));
      else if (act === 'help') HelpUI.open(App);
      else if (act === 'save') await saveJson();
      else if (act === 'open') $('#fileJson').click();
      else if (act === 'loadXlsx') pickXlsx(null);
      else if (act === 'loadDocx') $('#fileDocx').click();
      else if (act === 'useFx') { const e = FXS.find(x => x.name === b.dataset.name); if (e) { setFactory(e); recompute(); renderNav(); renderMain(); persist(); } }
      else if (act === 'delFx') removeFactory(b.dataset.name);
      else if (act === 'docx') await exportDocx();
      else if (act === 'xlsx') exportXlsx();
      else if (act === 'flagsDone') { if (state.att) delete state.att.ocr; renderMain(); persist(); toast('Đã bỏ tô nền các ô đọc từ ảnh'); }
      else if (act === 'autoConclusion') {
        state.v['meta.conclusion'] = T().autoConclusion(res, schema, state);
        renderMain(); persist();
      } else if (act && act.startsWith('fx')) await FactoryUI.action(act, b, App);
      else if (act && act.startsWith('db')) await DbUI.action(act, b);
      else if (act && act.startsWith('appx')) await AppendixUI.action(act, b, App);
      else if (act && act.startsWith('imp')) await ImportReportUI.action(act, b, App);
      else if (act && TU().actions && TU().actions[act]) await track(b.textContent.trim() || act, () => TU().actions[act](b, App));
    } catch (err) {
      console.error(err);
      toast('Lỗi: ' + err.message + errWhere(err), true);
    }
  }
  // Lỗi lập trình (TypeError…): kèm vị trí trong code (tệp:dòng, hàm) để báo lại — lỗi nghiệp vụ (Error) giữ nguyên câu chữ
  function errWhere(err) {
    if (!err || !err.stack || !(err instanceof TypeError || err instanceof ReferenceError || err instanceof RangeError)) return '';
    const m = String(err.stack).split(/\r?\n/).map(l => l.match(/at (?:(\S+) \()?.*?\/(js\/[\w\/.-]+\.js):(\d+)/)).find(Boolean);
    return m ? ` [${m[2]}:${m[3]}${m[1] ? ' ' + m[1] : ''}]` : '';
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
      current = 'general'; setupStep = 'device'; recompute(); renderNav(); renderMain(); persist();
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
    if (cfg.topology === 'bank1p') {
      cfg.ps.A = cfg.ps.A || state.v['meta.serial'] || '';
      if (cfg.ps.A) state.v['meta.serial'] = cfg.ps.A;
    }
    if (st.imported) state.imported = st.imported; // BBTN cũ nhập từ .docx: lưu CSDL với nguồn 'manual'
    EditHistory.reset();
    state.sum.tick = state.sum.tick || {}; state.sum.ev = state.sum.ev || {};
    pickFactory(true);
    applyFactoryDefaults(state.cfg);
    schema = T().buildSchema(state.cfg);
  }
  async function readFile(input, fn) {
    const f = input.files[0];
    input.value = '';
    if (!f) return;
    try { await fn(f); } catch (err) { console.error(err); toast('Lỗi đọc file: ' + err.message, true); }
  }

  // Danh sách file xuất xưởng nạp thêm (chuyển dữ liệu dạng cũ một file sang danh sách)
  function factoryFiles() {
    let list = [];
    try { list = JSON.parse(lsGet(LS_FACS) || '[]'); } catch (e) { list = []; }
    const old = lsGet(LS_FAC);
    if (old) {
      try { const o = JSON.parse(old); if (!list.some(x => x.name === o.name)) list.push(o); } catch (e) { /* bỏ dữ liệu hỏng */ }
      lsSet(LS_FACS, JSON.stringify(list)); lsSet(LS_FAC, null);
    }
    return list;
  }
  // File nhúng sẵn + các file nạp thêm; mặc định dùng file nạp sau cùng, biên bản có số chế tạo thì chọn đúng file chứa máy đó
  function loadFactoryDefault() {
    FXS = [];
    const add = (o, emb) => {
      try { FXS = FXS.filter(x => x.name !== o.name).concat([{ name: o.name, api: factoryReader().fromBase64(o.b64, o.name), emb }]); }
      catch (e) { console.warn('factory', o.name, e); toast(`Không đọc được file xuất xưởng ${o.name}: ${e.message}`, true); }
    };
    if (EMB.factory) add(EMB.factory, true);
    factoryFiles().forEach(o => add(o, false));
    FX = FXS.length ? FXS[FXS.length - 1].api : null;
  }
  // Dùng file xuất xưởng `entry`: cột pha đang trỏ tới máy của file khác thì đặt lại theo các máy của file này
  function setFactory(entry, quiet) {
    FX = entry.api;
    if (state) {
      applyFactoryDefaults(state.cfg);
      schema = T().buildSchema(state.cfg);
    }
    if (!quiet) toast(`Dùng số liệu xuất xưởng ${entry.name} (${FX.data.order.join(', ')})`);
  }
  // Chọn file chứa số chế tạo máy chính (rồi đến các cột pha) của biên bản đang mở
  function pickFactory(quiet) {
    if (!state || FXS.length < 2) return false;
    const sns = [state.v['meta.serial']].concat(state.cfg.topology === 'bank1p' ? Object.values(state.cfg.ps || {}) : [])
      .map(x => String(x || '').trim()).filter(Boolean);
    // file đang dùng đã có số chế tạo (vd vừa nạp bản test report mới) → giữ nguyên
    if (FX && sns.some(sn => FX.has(sn))) return false;
    const hit = sns.map(sn => FXS.find(x => x.api.has(sn))).find(Boolean);
    if (!hit || hit.api === FX) return false;
    setFactory(hit, quiet);
    return true;
  }
  // Bộ đọc Test report xuất xưởng của loại thiết bị (trước khi có biên bản: loại mặc định)
  const factoryReader = () => EquipmentTypes.get(EquipmentTypes.codeOf(state)).factory;
  // ---------------------------------------------------------------- export
  async function exportDocx() {
    recompute();
    if (state.cfg.topology === 'bank1p' && schema.layout !== Schema.LAYOUT_3P) {
      toast('Cấu hình tổ 3 MBA một pha cần mẫu chung 3P trước khi xuất BBTN.', true); return;
    }
    if (state.cfg.topology === 'bank1p' && state.cfg.reportScope === 'separate') {
      const phases = ['A', 'B', 'C'].filter(ph => (state.cfg.reportPhases || []).includes(ph));
      if (!phases.length) { toast('Chọn ít nhất một pha cần xuất BBTN.', true); return; }
      const missing = phases.filter(ph => !String(state.cfg.ps[ph] || '').trim());
      if (missing.length) { toast(`Thiếu số chế tạo pha ${missing.join(', ')}.`, true); return; }
      const R = T().report, docs = [];
      for (const phase of phases) {
        const template = EMB.templates[phase];
        if (!template || !template.b64) { toast(`Không tìm thấy template BBTN pha ${phase}.`, true); return; }
        const cfg = JSON.parse(JSON.stringify(state.cfg));
        cfg.template = phase; cfg.topology = 'bank1p'; cfg.reportScope = 'combined';
        const phaseSchema = T().buildSchema(cfg);
        const phaseState = R.phaseState(state, schema, phaseSchema, phase);
        const serial = phaseState.v['meta.serial'];
        const phaseFX = (FXS.find(entry => entry.api.has(serial)) || {}).api || FX;
        const phaseRes = T().evaluate(phaseState, phaseFX, phaseSchema);
        const phaseApp = Object.assign({}, App, { state: phaseState, res: phaseRes, schema: phaseSchema, FX: phaseFX });
        const assets = Object.assign(
          TU().reportAssets ? await TU().reportAssets(phaseApp) : {},
          await AppendixUI.reportAssets(phaseApp),
        );
        const tpl = await DocxTemplate.load(template.b64);
        if (tpl.tables.length < (phaseSchema.tables || R.stdTables) - 1) toast(`Cảnh báo: template pha ${phase} có ${tpl.tables.length} bảng — kiểm tra vị trí điền.`, true);
        const { cells, miss } = R.fill(tpl, { state: phaseState, res: phaseRes, schema: phaseSchema, assets });
        const blob = await tpl.toBlob();
        const name = `BBTN_${R.filePrefix}_${safeName(serial)}_${safeName(phaseState.v['meta.date'])}_Pha_${phase}.docx`;
        docs.push({ blob, name, serial, cells, miss });
      }
      if (docs.length === 1) download(docs[0].blob, docs[0].name);
      else {
        const zip = new JSZip();
        docs.forEach(doc => zip.file(doc.name, doc.blob));
        const zipName = `BBTN_${R.filePrefix}_Tach_pha_${safeName(state.v['meta.date'])}.zip`;
        download(await zip.generateAsync({ type: 'blob' }), zipName);
      }
      docs.forEach(doc => {
        toast(`Đã xuất ${doc.name} (${doc.cells} ô số liệu)${doc.miss.length ? ` — không định vị được: ${doc.miss.slice(0, 4).join(', ')}${doc.miss.length > 4 ? '…' : ''}` : ''}`, doc.miss.length > 0);
      });
      if (state.db && state.db.sessionId && DB.user && DB.canEdit()) {
        for (const doc of docs) {
          try {
            await DB.uploadDoc(state.db.sessionId, state.db.equipmentId || null, 'BBTN_DOCX', `${doc.serial}/${state.db.sessionId}/${doc.name}`, doc.name, doc.blob);
          } catch (err) { toast(`Đã tải ${doc.name} nhưng chưa lưu được vào CSDL: ${err.message}`, true); }
        }
      }
      return;
    }
    if (state.cfg.topology === 'bank1p' && ['A', 'B', 'C'].some(ph => !String(state.cfg.ps[ph] || '').trim())) {
      toast('BBTN chung cho tổ 3 MBA cần nhập đủ số chế tạo pha A, B và C.', true); return;
    }
    if (state.cfg.topology !== 'bank1p' && !String(state.v['meta.serial'] || '').trim()) {
      toast('Nhập số chế tạo MBA trước khi xuất BBTN.', true); return;
    }
    const data = templateData();
    if (!data) { toast('Chưa có template BBTN — nạp file .docx ở mục 0 “Thông tin chung & cấu hình”', true); return; }
    const tpl = await DocxTemplate.load(data), R = T().report;
    const std = schema.tables || R.stdTables; // mẫu chung 3 pha: 28 bảng
    if (tpl.tables.length < std - 1) toast(`Cảnh báo: template có ${tpl.tables.length} bảng (mẫu chuẩn ${std}) — vị trí điền có thể lệch`, true);
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
    const head = ['Số chế tạo (máy chính)', 'Ngày TN', 'Lý do', 'Hạng mục', 'Nội dung', 'Vị trí / pha / nấc', 'Giá trị đo', 'Giá trị quy đổi', 'Tham chiếu (xuất xưởng / tiêu chuẩn)', 'Độ lệch', 'Giới hạn', 'Đánh giá', 'Điều/Bảng QĐ 1901', 'Ghi chú', 'Tiêu chuẩn QĐ 1901 dẫn chiếu'];
    const rows = [head].concat(res.findings.map(f => [v['meta.serial'], v['meta.date'], v['meta.reason'], secTitle(f.sec), f.item, f.loc || '', f.meas || '', f.conv || '', f.ref || '', f.dev || '', f.limit || '', ST_TEXT[f.status], f.basis || '', f.note || '', QD.stdOf(f)]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [12, 11, 11, 30, 34, 34, 20, 20, 34, 14, 34, 12, 26, 50, 34].map(w => ({ wch: w }));
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
    ImportReportUI.init(App);
    const saved = lsGet(LS_STATE);
    let restored = false;
    if (saved) {
      try { loadState(JSON.parse(saved)); restored = true; } catch (e) { console.warn('saved state invalid', e); }
    }
    if (!restored) { state = null; await newRecord(false, EquipmentTypes.DEFAULT); }
    recompute();
    // biên bản đang nhập dở có số chế tạo: mở thẳng hạng mục đầu; biên bản mới: trình khởi tạo bước ①
    if (restored && String(state.v['meta.serial'] || (state.cfg.ps && state.cfg.ps.A) || '').trim()) { current = schema.sections[0].id; setupStep = 'test'; }
    renderNav();
    renderMain();
    loadInlineTrend(); // lịch sử đo (bản lưu tạm khi mất mạng; tải lại khi đã đăng nhập)
    if (restored && !new URLSearchParams(location.search).has('code')) Notify.show({ type: 'info', msg: 'Đã mở lại biên bản đang nhập dở trên máy này.' });
    // Đăng nhập / đăng xuất / đổi kết nối → làm mới dữ liệu CSDL đang hiển thị
    document.addEventListener('auth:changed', () => {
      DbUI.reset(); Catalog.reset(); KConf.reset(); CriteriaUI.reset(); StandardsUI.reset(); renderNav(); renderMain();
      loadInlineTrend(); // đã đăng nhập: tải mới; chưa: dùng bản lưu tạm trên máy
      // bảng hệ số quy đổi sứ trong CSDL (admin cấu hình) → dựng lại lựa chọn ở mục 5
      if (DB.user) KConf.load(true);
      // bộ tiêu chí đơn vị (admin cấu hình) → đánh giá lại biên bản đang mở
      if (DB.user) CriteriaUI.load(true);
      if (DB.user) StandardsUI.load(true).then(() => App.render()).catch(e => {
        if (/library_docs|does not exist|schema cache/i.test(e.message || '')) Notify.show({ type: 'error', msg: 'Chưa chạy migration 20261114000700 trên Supabase' });
        else console.warn('Không tải được thư viện tiêu chuẩn:', e);
      });
    });
    DB.connect();
    AuthUI.init().catch(e => console.warn(e));

    document.addEventListener('click', onClick);
    $('#main').addEventListener('pointerdown', onRefsPointerDown);
    $('#main').addEventListener('pointermove', onRefsPointerMove);
    $('#main').addEventListener('pointerup', onRefsPointerUp);
    $('#main').addEventListener('pointercancel', onRefsPointerUp);
    $('#main').addEventListener('keydown', onRefsKey);
    $('#main').addEventListener('dblclick', e => { if (e.target.classList && e.target.classList.contains('wf-split')) { refsUi.w = REFS_DEFAULT; applyRefs(); saveRefs(); } });
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
    $('#fileXlsx').addEventListener('change', e => {
      const purpose = xlsxPurpose; xlsxPurpose = null;
      return readFile(e.target, async f => {
        const entry = addFactoryFile(f.name, await f.arrayBuffer());
        document.dispatchEvent(new CustomEvent('factory:added', { detail: { name: f.name, entry, purpose } }));
      });
    });
    $('#fileDocx').addEventListener('change', e => readFile(e.target, async f => {
      const buf = await f.arrayBuffer();
      const t = await DocxTemplate.load(buf);
      // template tùy chỉnh: nhận dạng bố cục theo số bảng (mẫu chung 3 pha 28 bảng, MBA 3 pha 110-220 71 bảng, mẫu theo pha 73 bảng)
      const is3P = t.tables.length >= 26 && t.tables.length <= 32;
      const is110 = t.tables.length === 71;
      if (!is3P && !is110 && t.tables.length < T().report.minTables) toast(`Template có ${t.tables.length} bảng, khác mẫu chuẩn (${T().report.stdTables}) — kiểm tra kỹ file xuất`, true);
      lsSet(LS_TPL, JSON.stringify({ name: f.name, b64: abToB64(buf) }));
      state.cfg.template = 'custom';
      state.cfg.layout = is3P ? '3P' : is110 ? '110' : '1P';
      state.cfg.topology = is3P ? 'bank1p' : is110 ? 'threePhase' : 'single1p';
      if (state.cfg.topology !== 'bank1p') state.cfg.reportScope = 'combined';
      applyFactoryDefaults(state.cfg);
      if (state.cfg.topology === 'bank1p') {
        state.cfg.ps.A = state.cfg.ps.A || state.v['meta.serial'] || '';
        state.v['meta.serial'] = state.cfg.ps.A;
      }
      schema = T().buildSchema(state.cfg); recompute(); renderNav();
      renderMain(); persist(); toast('Đã nạp template ' + f.name + (is3P ? ' (mẫu chung 3 pha)' : is110 ? ' (MBA 3 pha 110–220 kV)' : ''));
    }));
    window.addEventListener('beforeunload', () => lsSet(LS_STATE, JSON.stringify(state)));
  }

  // API cho các trang khác (js/ui/*.js) và phần giao diện riêng của loại thiết bị (TypeUI)
  const App = window.App = {
    get state() { return state; }, get res() { return res; }, get schema() { return schema; }, get FX() { return FX; }, get type() { return T(); }, EMB,
    get factories() { return FXS; }, addFactoryFile, addFactoryApi, factoryFileB64, factoryBlob, pickXlsx, removeFactory, localFactoryHTML,
    applyTemplate, applyHeadFills, setupGo, pickFactory: quiet => pickFactory(quiet),
    useFactory(name) { const e = FXS.find(x => x.name === name); if (e) { setFactory(e); recompute(); renderNav(); renderMain(); persist(); } return e; },
    exportDocx, exportXlsx, toast, esc, download, safeName, persist, recompute, renderMain, fieldHTML, cfgField, readFile, lsGet, lsSet, abToB64, track,
    loadTrend: () => loadInlineTrend(),
    rebuild(schemaChanged) { if (schemaChanged) schema = T().buildSchema(state.cfg); recompute(); renderNav(); renderMain(); persist(); },
    render() { renderNav(); renderMain(); },
    go(id) { current = id; renderNav(); renderMain(); window.scrollTo(0, 0); },
    currentSection() { return current; },
    // mở mục ở bước Nhập số liệu, cuộn tới ô và đặt con trỏ (dùng khi quay lại từ trang Xu hướng)
    focusCell(sec, key) {
      if (typeof Workflow !== 'undefined') Workflow.setStep(sec, 'data');
      App.go(sec);
      const el = document.querySelector(`[data-k="${CSS.escape(key)}"]`);
      if (el) { el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); }
    },
    openState(st, db, pdfReview) {
      clearPdfReview();
      loadState(st); state.db = db;
      if (pdfReview && pdfReview.blob) activePdfReview = {
        url: URL.createObjectURL(pdfReview.blob),
        fileName: pdfReview.fileName || pdfReview.blob.name || 'BBTN.pdf',
        returnTo: pdfReview.returnTo || 'general',
      };
      recompute(); current = 'general'; renderMain(); persist(); loadInlineTrend();
    },
  };
  boot().catch(err => { console.error(err); toast('Lỗi khởi động: ' + err.message, true); });
})();
