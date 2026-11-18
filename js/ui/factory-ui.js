// Trang XX — số liệu xuất xưởng: cây Trạm → Ngăn → Thiết bị → Số chế tạo, tìm nhanh, danh sách các lần FAT đã lưu CSDL và
// máy trong file .xlsx chỉ nạp trên máy; chuột phải (hoặc nút ⋯, phím ContextMenu / Shift+F10) mở menu Xem · Sửa · Dùng · Tải.
// Sửa tay ghi thẳng CSDL (measurements, test_sessions — RLS editor / admin); số liệu đã sửa dùng cho xu hướng các lần sau.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  let A = null; // App
  const esc = s => A.esc(s);
  const ITEM = () => (window.DbUI && DbUI.ITEM) || {};
  const num = x => (x === null || x === undefined || x === '' || !Number.isFinite(Number(x)) ? '' : String(+Number(x).toPrecision(10)).replace('.', ','));
  const vnDate = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d || ''); };

  const data = { equipment: null, sessions: null, subs: null, bays: null, loading: false, error: '', forUser: null };
  const ui = { query: '', selected: '', open: new Set(), detail: null, menu: null, form: null };

  const signedIn = () => !!(window.DB && DB.client && DB.user);
  const localFiles = () => (A.factories || []).map(f => ({ name: f.name, units: f.api.data.order.map(s => ({ serial: s, phase: (f.api.data.units[s] || {}).phase || '' })) }));
  const fullTree = () => FactoryTree.build(signedIn() ? data.equipment || [] : [], signedIn() ? data.sessions || [] : [], localFiles(),
    signedIn() ? { substations: data.subs || [], bays: data.bays || [] } : {});
  const findNode = (nodes, id) => { for (const n of nodes) { if (n.id === id) return n; const c = findNode(n.children || [], id); if (c) return c; } return null; };
  const parentsOf = (nodes, id, path = []) => {
    for (const n of nodes) { if (n.id === id) return path; const p = parentsOf(n.children || [], id, path.concat(n.id)); if (p) return p; }
    return null;
  };

  // ---------------------------------------------------------------- dữ liệu
  async function load(force) {
    if (!signedIn()) return;
    if (data.loading || (!force && data.sessions && data.forUser === DB.user.id)) return;
    data.loading = true; data.error = '';
    try {
      const [equipment, sessions, subs, bays] = await Promise.all([DB.listEquipment(), DB.listFactorySessions(), DB.listSubstations(), DB.listBays()]);
      Object.assign(data, { equipment, sessions, subs, bays, forUser: DB.user.id });
    } catch (err) { data.error = err.message; }
    data.loading = false;
    if (A.currentSection() === 'factory') A.renderMain();
  }
  function reset() { data.equipment = data.sessions = data.subs = data.bays = null; data.forUser = null; ui.detail = null; }

  // ---------------------------------------------------------------- vẽ
  function render(App) {
    A = App;
    const intro = '<div class="hint-text">Chọn trạm, ngăn, thiết bị hoặc số chế tạo trên cây để lọc danh sách. Chuột phải (hoặc nút ⋯) vào một dòng để '
      + '<b>Xem</b>, <b>Sửa</b>, dùng file test report cho biên bản đang lập hoặc tải file. Đánh giá “so xuất xưởng” trong biên bản dùng file .xlsx đang dùng; '
      + 'số liệu sửa trong CSDL dùng cho <b>xu hướng</b> các lần thí nghiệm sau.</div>';
    const tools = `<div class="fx-tools"><label class="fx-search"><span class="sr-only">Tìm số liệu xuất xưởng</span>`
      + `<input id="fxSearch" type="search" autocomplete="off" placeholder="Tìm trạm, ngăn, tên thiết bị, số chế tạo, số report…" value="${esc(ui.query)}"></label>`
      + `<button class="btn" data-act="loadXlsx">Thêm file .xlsx…</button>${signedIn() ? '<button class="btn" data-act="fxRefresh" title="Tải lại từ CSDL">Tải lại</button>' : ''}</div>`;
    return intro + tools
      + `<div class="fx-layout"><nav class="fx-tree" aria-label="Cây số liệu xuất xưởng" id="fxTreeWrap">${treeHTML()}</nav>`
      + `<div class="fx-body"><div id="fxList">${listHTML()}</div><div id="fxDetail">${detailHTML()}</div></div></div>`
      + `<details class="fx-local"${A.factories.length && !signedIn() ? ' open' : ''}><summary>File .xlsx trên máy này (${A.factories.length}) — chọn file đang dùng, xem sheet gốc</summary>`
      + `<div class="fx-local-body">${A.localFactoryHTML()}</div></details>`;
  }

  function statusHTML() {
    if (!window.DB || !DB.client) return '<div class="callout warn">Chưa cấu hình CSDL — chỉ xem được file .xlsx trên máy này.</div>';
    if (!DB.user) return '<div class="callout">Đăng nhập để xem và sửa số liệu xuất xưởng đã lưu trong CSDL.</div>';
    if (data.error) return `<div class="callout warn">Không tải được số liệu xuất xưởng: ${esc(data.error)}</div>`;
    if (data.loading || !data.sessions) return '<div class="empty">Đang tải số liệu xuất xưởng…</div>';
    return '';
  }

  function treeHTML() {
    const { tree, open } = FactoryTree.filter(fullTree(), ui.query);
    const st = statusHTML();
    if (!tree.length) return `${st}<div class="empty">${ui.query ? 'Không có kết quả phù hợp.' : 'Chưa có số liệu xuất xưởng.'}</div>`;
    const isOpen = n => open.has(n.id) || ui.open.has(n.id);
    const node = (n, level) => {
      const kids = n.children || [];
      const exp = kids.length ? isOpen(n) : null;
      const ctx = (n.type === 'serial' || n.type === 'equipment') && n.noFat ? `nofat:${n.equipmentId}`
        : n.type === 'serial' ? `session:${n.sessionId}|${n.equipmentId}` : n.type === 'localunit' ? `local:${n.file}|${n.serial}` : n.type === 'equipment' ? `session:${n.sessionId}|` : '';
      return `<li role="none"><div class="fx-row${ui.selected === n.id ? ' on' : ''}" style="--lvl:${level}">`
        + (kids.length ? `<button type="button" class="fx-caret" data-act="fxTog" data-node="${esc(n.id)}" tabindex="-1" aria-hidden="true">${exp ? '▾' : '▸'}</button>` : '<span class="fx-caret" aria-hidden="true"></span>')
        + `<button type="button" class="fx-node t-${n.type}" role="treeitem" data-act="fxSel" data-node="${esc(n.id)}" aria-level="${level}" `
        + `aria-selected="${ui.selected === n.id}"${exp === null ? '' : ` aria-expanded="${exp}"`}${ctx ? ` data-fxctx="${esc(ctx)}"` : ''}>`
        + `<span class="fx-label">${esc(n.label)}</span>${n.sub ? `<span class="fx-sub">${esc(n.sub)}</span>` : ''}</button></div>`
        + (kids.length && exp ? `<ul role="group">${kids.map(c => node(c, level + 1)).join('')}</ul>` : '') + '</li>';
    };
    return `${st}<ul role="tree" class="fx-treelist" aria-label="Trạm, ngăn, thiết bị, số chế tạo">${tree.map(n => node(n, 1)).join('')}</ul>`;
  }

  // dòng danh sách: các lần FAT trong CSDL + máy trong file chưa lưu CSDL, lọc theo nút đang chọn và ô tìm
  function listRows() {
    const tree = fullTree();
    const sel = ui.selected && findNode(tree, ui.selected);
    const leaves = sel ? FactoryTree.leaves(sel) : null;
    const eqOk = leaves && new Set(leaves.filter(l => l.rootId || l.equipmentId).map(l => l.rootId || l.equipmentId));
    const localOk = leaves && new Set(leaves.filter(l => l.type === 'localunit').map(l => `${l.file}|${l.serial}`));
    const q = FactoryTree.fold(ui.query);
    const match = s => !q || FactoryTree.fold(s).includes(q);
    const eqById = new Map((data.equipment || []).map(e => [e.id, e]));
    const rows = [];
    if (signedIn()) (data.sessions || []).forEach(s => {
      if (eqOk && !eqOk.has(s.equipment_id)) return;
      const e = eqById.get(s.equipment_id) || {};
      const kids = (data.equipment || []).filter(c => c.parent_id === s.equipment_id).map(c => c.serial_no).join(' ');
      const text = [e.serial_no || s.serial_no, e.name || s.equipment_name, e.substation_name || s.substation_name, e.bay_code || s.bay_code, e.bay_name, s.report_no, kids].join(' ');
      if (!match(text)) return;
      // số chế tạo / tên / vị trí theo bản ghi thiết bị (đã sửa ở menu ngữ cảnh), thiếu thì theo lần thí nghiệm
      rows.push({ ctx: `session:${s.id}|`, serial: e.serial_no || s.serial_no, name: e.name || s.equipment_name || e.class_name || '',
        where: [e.substation_name || s.substation_name, e.bay_code || s.bay_code].filter(Boolean).join(' · ') || FactoryTree.UNASSIGNED,
        date: vnDate(s.test_date), report: s.report_no || '', n: s.n_values, src: s.source === 'factory_import' ? 'Test report' : 'Nhập tay', sessionId: s.id });
    });
    localFiles().forEach(f => {
      const inDb = new Set((data.sessions || []).map(s => String(s.serial_no || '').toUpperCase()));
      f.units.forEach(u => {
        if (signedIn() && inDb.has(String(u.serial).toUpperCase())) return;
        if (localOk && !localOk.has(`${f.name}|${u.serial}`)) return;
        if (leaves && !localOk.size) return;
        if (!match(`${u.serial} ${f.name}`)) return;
        rows.push({ ctx: `local:${f.name}|${u.serial}`, serial: u.serial, name: u.phase ? `pha ${u.phase}` : '', where: '—', date: '', report: '', n: '', src: 'Chưa lưu CSDL', file: f.name, local: true });
      });
    });
    return rows;
  }

  function listHTML() {
    const rows = listRows();
    const sel = ui.selected && findNode(fullTree(), ui.selected);
    const head = `<div class="fx-list-head"><h3>Số liệu xuất xưởng${sel ? ` — ${esc(sel.label)}` : ''}</h3><span class="muted">${rows.length} dòng</span>`
      + (sel ? '<button class="btn small" data-act="fxSel" data-node="">Bỏ lọc</button>' : '') + '</div>';
    if (!rows.length && sel && sel.noFat) {
      return head + '<div class="callout">Thiết bị này <b>chưa có số liệu xuất xưởng</b> trong CSDL. Nạp file test report (.xlsx), sau đó chuột phải máy ở nhóm '
        + '<b>Chưa lưu CSDL</b> → <b>Lưu lên CSDL</b>.<div class="row-actions"><button class="btn" data-act="loadXlsx">Thêm file test report (.xlsx)…</button></div></div>';
    }
    if (!rows.length) return head + '<div class="empty">Không có số liệu xuất xưởng phù hợp.</div>';
    return head + '<div class="grid-wrap"><table class="grid fx-table"><thead><tr><th>Số chế tạo</th><th>Thiết bị</th><th>Trạm · Ngăn</th><th>Ngày TN</th>'
      + '<th>Số report</th><th>Số giá trị</th><th>Nguồn</th><th><span class="sr-only">Thao tác</span></th></tr></thead><tbody>'
      + rows.map(r => `<tr class="fx-item${r.local ? ' is-local' : ''}${ui.detail && ui.detail.sessionId === r.sessionId ? ' on' : ''}" data-fxctx="${esc(r.ctx)}" tabindex="0">`
        + `<th>${esc(r.serial)}</th><td>${esc(r.name)}</td><td>${esc(r.where)}</td><td>${esc(r.date)}</td><td>${esc(r.report)}</td><td class="num">${esc(r.n)}</td>`
        + `<td>${r.local ? `<span class="badge st-warn" title="${esc(r.file)}">${esc(r.src)}</span>` : esc(r.src)}</td>`
        + `<td class="fx-act"><button type="button" class="btn small fx-more" data-act="fxMenu" data-ctx="${esc(r.ctx)}" aria-haspopup="menu" aria-label="Thao tác với ${esc(r.serial)}">⋯</button></td></tr>`).join('')
      + '</tbody></table></div>';
  }

  // ---------------------------------------------------------------- chi tiết: xem / sửa
  // ---------------------------------------------------------------- sửa thông tin thiết bị / gán trạm, ngăn (bảng equipment)
  const eqById = id => (data.equipment || []).find(e => e.id === id) || null;
  function formHTML() {
    const f = ui.form, e = eqById(f.eqId) || {};
    const head = `<div class="fx-detail-head"><h3>${f.kind === 'eq' ? 'Sửa thông tin thiết bị' : (e.bay_id ? 'Đổi trạm / ngăn' : 'Gán trạm / ngăn')} — ${esc(e.serial_no || '')}</h3><span class="spacer"></span>`
      + '<button class="btn primary" data-act="fxFormSave">Lưu</button><button class="btn" data-act="fxFormCancel">Hủy</button></div>';
    let body = '';
    if (f.kind === 'eq') {
      body = '<div class="fields">'
        + `<div class="field"><label for="fxEqSerial">Số chế tạo</label><input id="fxEqSerial" data-fxform="serial_no" value="${esc(f.values.serial_no)}"></div>`
        + `<div class="field"><label for="fxEqName">Tên thiết bị</label><input id="fxEqName" data-fxform="name" value="${esc(f.values.name)}" placeholder="vd AT1 pha A"></div></div>`
        + '<div class="hint-text">Số chế tạo dùng để tra xu hướng và chọn file xuất xưởng — chỉ sửa khi nhập sai. Mọi lần thí nghiệm của thiết bị đi theo số mới.</div>';
    } else {
      const subs = data.subs || [], bays = (data.bays || []).filter(b => b.substation_id === f.values.sub);
      const opt = (v, t, s) => `<option value="${esc(v)}" ${s ? 'selected' : ''}>${esc(t)}</option>`;
      body = '<div class="fields">'
        + `<div class="field"><label for="fxEqSub">Trạm</label><select id="fxEqSub" data-fxform="sub">${opt('', '— Chọn trạm —', !f.values.sub)}${subs.map(s => opt(s.id, s.name, s.id === f.values.sub)).join('')}</select></div>`
        + `<div class="field"><label for="fxEqBay">Ngăn</label><select id="fxEqBay" data-fxform="bay_id" ${f.values.sub ? '' : 'disabled'}>${opt('', f.values.sub && !bays.length ? 'Trạm chưa có ngăn' : '— Chọn ngăn —', !f.values.bay_id)}`
        + `${bays.map(b => opt(b.id, `${b.code}${b.name ? ` — ${b.name}` : ''}`, b.id === f.values.bay_id)).join('')}</select></div></div>`
        + `<div class="hint-text">Các thành phần (sứ, TI chân sứ) tự đi theo ngăn của máy chính. Chưa có trạm / ngăn: thêm ở <button class="btn small" data-nav="catalog">Trạm – Ngăn – Thiết bị</button>.`
        + `${e.bay_id ? ' Bỏ gán: chọn “— Chọn ngăn —” rồi Lưu.' : ''}</div>`;
    }
    return `<div class="fx-detail fx-form" id="fxDetailBox">${head}${body}</div>`;
  }
  function openForm(kind, eqId) {
    const e = eqById(eqId);
    if (!e) throw new Error('Không tìm thấy thiết bị trong danh mục (tải lại trang)');
    const bay = (data.bays || []).find(b => b.id === e.bay_id);
    ui.form = { kind, eqId, values: kind === 'eq' ? { serial_no: e.serial_no || '', name: e.name || '' } : { sub: bay ? bay.substation_id : '', bay_id: e.bay_id || '' } };
    ui.detail = null;
    refresh('detail');
    const box = $('#fxDetailBox'); if (box) { box.scrollIntoView({ block: 'nearest' }); const first = box.querySelector('input, select'); if (first) first.focus(); }
  }
  async function saveForm() {
    const f = ui.form, e = eqById(f.eqId);
    if (!e) throw new Error('Không tìm thấy thiết bị');
    let payload, msg;
    if (f.kind === 'eq') {
      const serial = String(f.values.serial_no || '').trim();
      if (!serial) throw new Error('Số chế tạo không được để trống');
      payload = {};
      if (serial !== (e.serial_no || '')) payload.serial_no = serial;
      if (String(f.values.name || '').trim() !== (e.name || '')) payload.name = String(f.values.name || '').trim() || null;
      msg = `Đã sửa thiết bị ${serial}`;
    } else {
      payload = f.values.bay_id ? { bay_id: f.values.bay_id } : { bay_id: null, substation_id: null };
      if ((payload.bay_id || null) === (e.bay_id || null)) payload = {};
      const b = (data.bays || []).find(x => x.id === f.values.bay_id);
      msg = b ? `Đã gán ${e.serial_no} vào ngăn ${b.code}` : `Đã bỏ gán trạm / ngăn của ${e.serial_no}`;
    }
    if (!Object.keys(payload).length) { ui.form = null; refresh('detail'); A.toast('Không có thay đổi'); return; }
    await A.track('Lưu thiết bị', () => DB.crud('update', 'equipment', payload, e.id));
    A.toast(msg);
    ui.form = null;
    if (window.Catalog) Catalog.reset();
    data.sessions = null; await load(true);
  }

  function detailHTML() {
    if (ui.form) return formHTML();
    const d = ui.detail;
    if (!d) return '';
    if (d.loading) return '<div class="fx-detail"><div class="empty">Đang tải số liệu…</div></div>';
    const s = d.session || {};
    const editing = d.mode === 'edit';
    const eqs = [...new Map(d.rows.map(r => [r.equipment_id, r])).values()];
    const items = [...new Set(d.rows.map(r => r.item))];
    const rows = d.rows.filter(r => (!d.eq || r.equipment_id === d.eq) && (!d.item || r.item === d.item));
    const label = ITEM();
    let h = `<div class="fx-detail" id="fxDetailBox"><div class="fx-detail-head"><h3>${editing ? 'Sửa' : 'Xem'} số liệu xuất xưởng — ${esc(s.serial_no || '')}</h3>`
      + `<span class="muted">${esc(vnDate(s.test_date))}${s.report_no ? ` · report ${esc(s.report_no)}` : ''} · ${d.rows.length} giá trị</span><span class="spacer"></span>`
      + (editing ? '<button class="btn primary" data-act="fxSave">Lưu thay đổi</button><button class="btn" data-act="fxCancel">Hủy</button>'
        : `<button class="btn" data-act="fxEdit" data-ctx="session:${esc(s.id)}|${esc(d.eq || '')}" ${window.DB && DB.canEdit() ? '' : 'disabled title="Tài khoản chỉ xem"'}>Sửa</button>`
          + '<button class="btn" data-act="fxClose">Đóng</button>')
      + '</div>';
    if (editing) {
      h += `<div class="fields"><div class="field"><label for="fxDate">Ngày thí nghiệm xuất xưởng</label><input id="fxDate" type="date" data-fxmeta="test_date" value="${esc(d.meta.test_date || '')}"></div>`
        + `<div class="field"><label for="fxReport">Số test report</label><input id="fxReport" data-fxmeta="report_no" value="${esc(d.meta.report_no || '')}"></div></div>`;
    }
    if (d.confirm) {
      h += `<div class="callout warn fx-confirm" role="alert"><b>Lưu ${d.confirm.n} thay đổi vào CSDL?</b><ul>${d.confirm.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`
        + '<div class="row-actions"><button class="btn primary" data-act="fxConfirm">Xác nhận lưu</button><button class="btn" data-act="fxBack">Quay lại sửa</button></div></div>';
    }
    if (d.errors && d.errors.length) h += `<div class="callout bad" role="alert">${d.errors.length} giá trị không hợp lệ — ô tô đỏ.</div>`;
    h += '<div class="fx-filters">'
      + `<label>Thiết bị <select data-fxfilter="eq"><option value="">Tất cả (${eqs.length})</option>${eqs.map(r => `<option value="${esc(r.equipment_id)}" ${d.eq === r.equipment_id ? 'selected' : ''}>${esc(r.serial_no)}${r.position ? ` · ${esc(r.position)}` : ''}</option>`).join('')}</select></label>`
      + `<label>Hạng mục <select data-fxfilter="item"><option value="">Tất cả</option>${items.map(i => `<option value="${esc(i)}" ${d.item === i ? 'selected' : ''}>${esc(label[i] || i)}</option>`).join('')}</select></label></div>`;
    const err = new Map((d.errors || []).map(e => [String(e.id), e.msg]));
    h += '<div class="grid-wrap fx-values"><table class="grid"><thead><tr><th>Hạng mục</th><th>Đại lượng</th><th>Sơ đồ / vị trí</th><th>Pha</th><th>Nấc</th><th>Thiết bị</th>'
      + '<th>Giá trị</th><th>Đơn vị</th><th>Nhiệt độ (°C)</th><th>Quy đổi</th><th>Ghi chú</th></tr></thead><tbody>'
      + rows.map(r => {
        const cur = Object.prototype.hasOwnProperty.call(d.edits, r.id) ? d.edits[r.id] : (num(r.value) || r.value_text || '');
        const changed = Object.prototype.hasOwnProperty.call(d.edits, r.id) && d.edits[r.id] !== (num(r.value) || r.value_text || '');
        const val = editing
          ? `<td class="${changed ? 'fx-changed' : ''}${err.has(String(r.id)) ? ' fx-err' : ''}"><input data-fxedit="${esc(r.id)}" value="${esc(cur)}" aria-label="${esc(`${label[r.item] || r.item} ${r.param} ${r.config} ${r.phase} ${r.tap}`)}"${err.has(String(r.id)) ? ` title="${esc(err.get(String(r.id)))}"` : ''}></td>`
          : `<td class="num">${esc(num(r.value) || r.value_text || '')}</td>`;
        return `<tr><td>${esc(label[r.item] || r.item)}</td><td>${esc(r.param)}</td><td>${esc(r.config)}</td><td>${esc(r.phase)}</td><td>${esc(r.tap)}</td>`
          + `<td>${esc(r.serial_no)}${r.position ? ` <span class="muted">${esc(r.position)}</span>` : ''}</td>${val}<td>${esc(r.unit || '')}</td>`
          + `<td class="num">${esc(num(r.temp_c))}</td><td class="num">${r.value_norm !== null && r.value_norm !== undefined ? `${esc(num(r.value_norm))}${r.norm_temp_c !== null && r.norm_temp_c !== undefined ? ` @${esc(num(r.norm_temp_c))} °C` : ''}` : ''}</td>`
          + `<td class="fx-note">${esc(r.note || '')}</td></tr>`;
      }).join('')
      + '</tbody></table></div>';
    if (editing) h += '<div class="hint-text">Nhiệt độ đo chỉ đọc. Giá trị quy đổi được tính lại theo tỷ lệ giá trị mới / cũ. Mỗi giá trị sửa được ghi chú ngày và người sửa.</div>';
    return h + '</div>';
  }

  function refresh(part) {
    const map = { tree: ['#fxTreeWrap', treeHTML], list: ['#fxList', listHTML], detail: ['#fxDetail', detailHTML] };
    (part ? [part] : Object.keys(map)).forEach(k => { const el = $(map[k][0]); if (el) el.innerHTML = map[k][1](); });
  }

  // ---------------------------------------------------------------- menu ngữ cảnh
  // thiết bị gắn với ngữ cảnh: phiên FAT → máy (hoặc thành phần chọn trên cây); nofat → thiết bị
  function eqIdOf(ctx) {
    const p = ctxParts(ctx);
    if (p.kind === 'nofat') return p.a;
    if (p.kind === 'session') { if (p.b) return p.b; const s = (data.sessions || []).find(x => x.id === p.a); return s ? s.equipment_id : ''; }
    return '';
  }
  function equipmentItems(ctx, can) {
    const e = eqById(eqIdOf(ctx));
    if (!e) return [];
    const why = can ? '' : 'Tài khoản chỉ xem';
    const items = [['fxEqEdit', 'Sửa số chế tạo, tên thiết bị…', why]];
    // thành phần (sứ…) đi theo ngăn của máy chính
    if (!e.parent_id) items.push(['fxEqBay', e.bay_id ? 'Đổi trạm / ngăn…' : 'Gán trạm / ngăn…', why]);
    return items;
  }
  function menuItems(ctx) {
    const kind = ctx.slice(0, ctx.indexOf(':'));
    const can = window.DB && DB.canEdit();
    if (kind === 'session') {
      const s = (data.sessions || []).find(x => x.id === ctxParts(ctx).a);
      return [
        ['fxView', 'Xem số liệu', ''], ['fxEdit', `Sửa giá trị đo${s && s.n_values ? ` (${s.n_values} giá trị)` : ''}…`, can ? '' : 'Tài khoản chỉ xem'],
      ].concat(equipmentItems(ctx, can)).concat([
        ['fxUse', 'Dùng cho biên bản đang lập', 'Tải file test report gốc từ CSDL'], ['fxDownload', 'Tải file test report', ''],
      ]);
    }
    if (kind === 'nofat') return [['loadXlsx', 'Thêm file test report (.xlsx)…', 'Nạp xong: chuột phải máy ở nhóm “Chưa lưu CSDL” → Lưu lên CSDL']].concat(equipmentItems(ctx, can));
    if (kind === 'local') return [
      ['fxLocalView', 'Xem sheet gốc', ''], ['fxLocalUse', 'Dùng file này cho biên bản', ''],
      ['fxLocalSave', 'Lưu lên CSDL', signedIn() ? (can ? '' : 'Tài khoản chỉ xem') : 'Cần đăng nhập'],
    ];
    return [];
  }
  function openMenu(ctx, x, y, returnFocus) {
    closeMenu();
    const items = menuItems(ctx);
    if (!items.length) return;
    const m = document.createElement('div');
    m.className = 'ctx-menu'; m.setAttribute('role', 'menu'); m.id = 'fxCtxMenu';
    // mục cần quyền ghi: "why" là lý do bị khóa; các mục khác: "why" là dòng gợi ý
    const gated = act => ['fxEdit', 'fxLocalSave', 'fxEqEdit', 'fxEqBay'].includes(act);
    m.innerHTML = items.map(([act, text, why]) => `<button type="button" role="menuitem" class="ctx-item" data-act="${act}" data-ctx="${esc(ctx)}"`
      + `${gated(act) ? (why ? ` disabled title="${esc(why)}"` : '') : ''}>${esc(text)}${why && !gated(act) ? `<span class="ctx-hint">${esc(why)}</span>` : ''}</button>`).join('');
    document.body.appendChild(m);
    const r = m.getBoundingClientRect();
    m.style.left = `${Math.max(4, Math.min(x, window.innerWidth - r.width - 4))}px`;
    m.style.top = `${Math.max(4, Math.min(y, window.innerHeight - r.height - 4))}px`;
    ui.menu = { el: m, returnFocus };
    const first = m.querySelector('button:not([disabled])'); if (first) first.focus();
  }
  function closeMenu(restore) {
    if (!ui.menu) return;
    const { el, returnFocus } = ui.menu; ui.menu = null; el.remove();
    if (restore && returnFocus && document.contains(returnFocus)) returnFocus.focus();
  }

  // ---------------------------------------------------------------- hành động
  const ctxParts = ctx => { const i = ctx.indexOf(':'); const [a, b] = ctx.slice(i + 1).split('|'); return { kind: ctx.slice(0, i), a, b: b || '' }; };
  async function openDetail(sessionId, eq, mode) {
    ui.detail = { sessionId, eq: eq || '', item: '', mode: mode || 'view', loading: true, rows: [], edits: {}, meta: {} };
    refresh('list'); refresh('detail');
    const session = (data.sessions || []).find(s => s.id === sessionId) || (await DB.loadSession(sessionId));
    const rows = await DB.factoryMeasurements(sessionId);
    Object.assign(ui.detail, { loading: false, session, rows, meta: { test_date: session.test_date || '', report_no: session.report_no || '' } });
    refresh('detail');
    const box = $('#fxDetailBox'); if (box) box.scrollIntoView({ block: 'nearest' });
  }
  async function factoryDoc(sessionId) {
    const docs = await DB.listDocs(sessionId);
    const doc = docs.find(d => d.kind === 'FACTORY_REPORT');
    if (!doc) throw new Error('Lần nhập này không có file test report gốc trong CSDL');
    return { doc, blob: await DB.downloadDoc(doc.storage_path) };
  }
  function buildConfirm() {
    const d = ui.detail;
    const { updates, errors } = FactoryTree.editDiff(d.rows, d.edits, { who: DB.user && DB.user.email, date: new Date().toISOString().slice(0, 10) });
    d.errors = errors;
    const meta = {};
    if ((d.meta.test_date || '') !== (d.session.test_date || '')) meta.test_date = d.meta.test_date || null;
    if ((d.meta.report_no || '') !== (d.session.report_no || '')) meta.report_no = d.meta.report_no || null;
    if (errors.length) { d.confirm = null; refresh('detail'); A.toast(`${errors.length} giá trị không hợp lệ`, true); return; }
    if (!updates.length && !Object.keys(meta).length) { A.toast('Chưa có thay đổi nào'); return; }
    const label = ITEM(), byId = new Map(d.rows.map(r => [r.id, r]));
    const lines = updates.slice(0, 12).map(u => { const r = byId.get(u.id); return `${r.serial_no} · ${label[r.item] || r.item} ${r.param} ${[r.config, r.phase, r.tap].filter(Boolean).join(' ')}: ${num(r.value) || r.value_text} → ${u.value !== null ? num(u.value) : u.value_text}`; });
    if (updates.length > 12) lines.push(`… và ${updates.length - 12} giá trị khác`);
    if (meta.test_date !== undefined) lines.push(`Ngày thí nghiệm: ${vnDate(d.session.test_date)} → ${vnDate(meta.test_date)}`);
    if (meta.report_no !== undefined) lines.push(`Số report: ${d.session.report_no || '—'} → ${meta.report_no || '—'}`);
    d.confirm = { n: updates.length + Object.keys(meta).length, updates, meta, lines };
    refresh('detail');
    const c = $('.fx-confirm'); if (c) { c.scrollIntoView({ block: 'nearest' }); const b = c.querySelector('[data-act="fxConfirm"]'); if (b) b.focus(); }
  }

  async function action(act, btn) {
    const ctx = btn.dataset.ctx || '';
    const p = ctx ? ctxParts(ctx) : {};
    if (act !== 'fxMenu') closeMenu();
    if (act === 'fxMenu') { const r = btn.getBoundingClientRect(); openMenu(ctx, r.left, r.bottom + 4, btn); return; }
    if (act === 'fxTog' || act === 'fxSel') {
      const id = btn.dataset.node || '';
      if (act === 'fxTog') { if (ui.open.has(id)) ui.open.delete(id); else ui.open.add(id); }
      else { ui.selected = ui.selected === id ? '' : id; if (id) ui.open.add(id); }
      refresh('tree'); refresh('list');
      const again = $(`.fx-node[data-node="${CSS.escape(id)}"]`); if (again) again.focus();
      return;
    }
    if (act === 'fxRefresh') { reset(); A.renderMain(); await load(true); return; }
    if (act === 'fxEqEdit' || act === 'fxEqBay') {
      if (!DB.canEdit()) throw new Error('Tài khoản chỉ xem — không sửa được thiết bị');
      openForm(act === 'fxEqEdit' ? 'eq' : 'bay', eqIdOf(ctx)); return;
    }
    if (act === 'fxFormSave') { await saveForm(); return; }
    if (act === 'fxFormCancel') { ui.form = null; refresh('detail'); return; }
    if (act === 'fxView' || act === 'fxEdit') {
      ui.form = null;
      if (act === 'fxEdit' && !DB.canEdit()) throw new Error('Tài khoản chỉ xem — không sửa được số liệu');
      if (ui.detail && ui.detail.sessionId === p.a && !ui.detail.loading) { ui.detail.mode = act === 'fxEdit' ? 'edit' : 'view'; ui.detail.eq = p.b || ui.detail.eq; ui.detail.confirm = null; refresh('detail'); return; }
      await openDetail(p.a, p.b, act === 'fxEdit' ? 'edit' : 'view'); return;
    }
    if (act === 'fxClose') { ui.detail = null; refresh('detail'); refresh('list'); return; }
    if (act === 'fxCancel') { Object.assign(ui.detail, { mode: 'view', edits: {}, errors: [], confirm: null, meta: { test_date: ui.detail.session.test_date || '', report_no: ui.detail.session.report_no || '' } }); refresh('detail'); return; }
    if (act === 'fxSave') { buildConfirm(); return; }
    if (act === 'fxBack') { ui.detail.confirm = null; refresh('detail'); return; }
    if (act === 'fxConfirm') {
      const d = ui.detail, c = d.confirm;
      await A.track('Lưu số liệu xuất xưởng', async () => {
        const n = await DB.updateFactory(d.sessionId, c.meta, c.updates);
        A.toast(`Đã lưu ${n} giá trị${Object.keys(c.meta).length ? ' và thông tin lần thí nghiệm' : ''} vào CSDL`);
      });
      const keep = { eq: d.eq, item: d.item };
      data.sessions = null; await load(true);
      await openDetail(d.sessionId, keep.eq, 'view'); ui.detail.item = keep.item; refresh('detail');
      return;
    }
    if (act === 'fxUse' || act === 'fxDownload') {
      await A.track(act === 'fxUse' ? 'Tải test report' : 'Tải file', async () => {
        const { doc, blob } = await factoryDoc(p.a);
        if (act === 'fxDownload') { A.download(blob, doc.file_name); return; }
        A.addFactoryFile(doc.file_name, await blob.arrayBuffer());
      });
      return;
    }
    if (act === 'fxLocalUse' || act === 'fxLocalView') {
      const e = A.useFactory(p.a);
      if (!e) throw new Error('Không còn file này trên máy');
      if (act === 'fxLocalView') { const det = $('details.fx-local'); if (det) { det.open = true; det.scrollIntoView({ block: 'start' }); } }
      else A.toast(`Đang dùng ${p.a} cho biên bản`);
      return;
    }
    if (act === 'fxLocalSave') {
      if (!signedIn() || !DB.canEdit()) throw new Error('Cần đăng nhập tài khoản có quyền ghi');
      const e = (A.factories || []).find(x => x.name === p.a);
      if (!e) throw new Error('Không còn file này trên máy');
      const b64 = A.factoryFileB64(p.a);
      const blob = b64 ? new Blob([Uint8Array.from(atob(b64), ch => ch.charCodeAt(0))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) : null;
      await A.track('Lưu số liệu xuất xưởng lên CSDL', async () => {
        const out = await Records.importFactory(A.state, e.api, blob, A.state.cfg.bayId || null);
        A.toast(`Đã lưu lên CSDL: ${out.map(o => `${o.serial} (${o.n} giá trị)`).join(', ')}`);
      });
      if (window.Catalog) Catalog.reset();
      reset(); A.renderMain(); await load(true);
    }
  }

  function afterRender(App) { A = App; load(); }

  // ---------------------------------------------------------------- sự kiện (ủy quyền, gắn một lần)
  document.addEventListener('input', e => {
    if (!A) return;
    const t = e.target;
    if (t.id === 'fxSearch') { ui.query = t.value; refresh('tree'); refresh('list'); return; }
    if (t.dataset && t.dataset.fxedit !== undefined && ui.detail) {
      ui.detail.edits[t.dataset.fxedit] = t.value; ui.detail.confirm = null;
      const r = ui.detail.rows.find(x => String(x.id) === t.dataset.fxedit);
      t.parentElement.classList.toggle('fx-changed', !!r && t.value !== (num(r.value) || r.value_text || ''));
      const c = $('.fx-confirm'); if (c) c.remove();
      return;
    }
    if (t.dataset && t.dataset.fxmeta && ui.detail) { ui.detail.meta[t.dataset.fxmeta] = t.value; ui.detail.confirm = null; }
    if (t.dataset && t.dataset.fxform && ui.form && t.tagName === 'INPUT') ui.form.values[t.dataset.fxform] = t.value;
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset && t.dataset.fxfilter && ui.detail) { ui.detail[t.dataset.fxfilter] = t.value; refresh('detail'); const s = $(`[data-fxfilter="${t.dataset.fxfilter}"]`); if (s) s.focus(); }
    if (t.dataset && t.dataset.fxform && ui.form && t.tagName === 'SELECT') {
      ui.form.values[t.dataset.fxform] = t.value;
      if (t.dataset.fxform === 'sub') { ui.form.values.bay_id = ''; refresh('detail'); const s = $('#fxEqSub'); if (s) s.focus(); }
    }
  });
  document.addEventListener('contextmenu', e => {
    const host = e.target.closest && e.target.closest('[data-fxctx]');
    if (!host || !A) return;
    e.preventDefault();
    openMenu(host.dataset.fxctx, e.clientX, e.clientY, host);
  });
  document.addEventListener('keydown', e => {
    if (ui.menu) {
      const items = $$('.ctx-item:not([disabled])', ui.menu.el);
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); const i = items.indexOf(document.activeElement);
        (items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length] || items[0]).focus(); return;
      }
      if (e.key === 'Tab') { closeMenu(); return; }
    }
    const host = e.target.closest && e.target.closest('[data-fxctx]');
    if (host && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) {
      e.preventDefault(); const r = host.getBoundingClientRect(); openMenu(host.dataset.fxctx, r.left + 12, r.bottom, host); return;
    }
    if (host && host.matches('tr.fx-item') && e.key === 'Enter') { e.preventDefault(); const p = ctxParts(host.dataset.fxctx); if (p.kind === 'session') openDetail(p.a, p.b, 'view').catch(err => A.toast('Lỗi: ' + err.message, true)); return; }
    // cây: ↑ ↓ di chuyển, → mở / vào nhánh con, ← đóng / về nhánh cha
    const node = e.target.closest && e.target.closest('.fx-node');
    if (!node || !['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const all = $$('#fxTreeWrap .fx-node'), i = all.indexOf(node), id = node.dataset.node;
    if (e.key === 'ArrowDown' && all[i + 1]) all[i + 1].focus();
    else if (e.key === 'ArrowUp' && all[i - 1]) all[i - 1].focus();
    else if (e.key === 'Home') all[0].focus();
    else if (e.key === 'End') all[all.length - 1].focus();
    else if (e.key === 'ArrowRight') {
      if (node.getAttribute('aria-expanded') === 'false') { ui.open.add(id); refresh('tree'); const n = $(`.fx-node[data-node="${CSS.escape(id)}"]`); if (n) n.focus(); }
      else if (node.getAttribute('aria-expanded') === 'true' && all[i + 1]) all[i + 1].focus();
    } else if (e.key === 'ArrowLeft') {
      if (node.getAttribute('aria-expanded') === 'true') { ui.open.delete(id); refresh('tree'); const n = $(`.fx-node[data-node="${CSS.escape(id)}"]`); if (n) n.focus(); }
      else { const par = (parentsOf(fullTree(), id) || []).pop(); const n = par && $(`.fx-node[data-node="${CSS.escape(par)}"]`); if (n) n.focus(); }
    }
  });
  document.addEventListener('pointerdown', e => { if (ui.menu && !ui.menu.el.contains(e.target)) closeMenu(); }, true);
  // mục menu không thuộc FactoryUI (vd loadXlsx do app.js xử lý): đóng menu sau khi bấm
  document.addEventListener('click', e => { if (ui.menu && e.target.closest && e.target.closest('.ctx-item')) setTimeout(() => closeMenu(), 0); });
  window.addEventListener('scroll', () => closeMenu(), true);
  window.addEventListener('resize', () => closeMenu());
  document.addEventListener('auth:changed', () => { reset(); if (A && A.currentSection() === 'factory') { A.renderMain(); load(true); } });

  window.FactoryUI = { render, afterRender, action, reset };
})();
