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

  const data = { equipment: null, sessions: null, subs: null, bays: null, groups: null, loading: false, error: '', forUser: null };
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
      const [equipment, sessions, subs, bays, groups] = await Promise.all([DB.listEquipment(), DB.listFactorySessions(), DB.listSubstations(), DB.listBays(),
        DB.listGroups ? DB.listGroups().catch(() => []) : []]);
      Object.assign(data, { equipment, sessions, subs, bays, groups, forUser: DB.user.id });
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
      + `<button class="btn" data-act="fxImport" title="Nạp file test report (.xlsx); đã đăng nhập: chọn máy, trạm / ngăn rồi lưu lên CSDL">Nhập test report (.xlsx)…</button>${bushingBtn()}${signedIn() ? '<button class="btn" data-act="fxRefresh" title="Tải lại từ CSDL">Tải lại</button>' : ''}</div>`;
    return intro + tools
      + `<div class="fx-layout"><nav class="fx-tree" aria-label="Cây số liệu xuất xưởng" id="fxTreeWrap">${treeHTML()}</nav>`
      + `<div class="fx-body"><div id="fxList">${listHTML()}</div><div id="fxDetail">${detailHTML()}</div></div></div>`
      + `<details class="fx-local"${A.factories.length && !signedIn() ? ' open' : ''}><summary>File .xlsx trên máy này (${A.factories.length}) — chọn file đang dùng, xem sheet gốc</summary>`
      + `<div class="fx-local-body">${A.localFactoryHTML()}</div></details>`;
  }

  // test report sứ của hãng (MBA: sứ Hitachi, tra theo S/N sứ khi đánh giá mục 5) — chỉ dùng trên máy này, không lưu CSDL
  function bushingBtn() {
    const U = window.TypeUI && TypeUI[EquipmentTypes.codeOf(A.state)];
    if (!U || !U.actions || !U.actions.loadHitachi) return '';
    const HB = window.HitachiBushing, n = HB && HB.reports ? HB.reports.length : 0;
    return `<button class="btn" data-act="loadHitachi" title="Test report sứ xuyên của hãng (.xlsx, sheet TestReport + TraCuu) — đang có ${n} sứ; dùng để so C1, tanδ ở mục 5">Nhập test report sứ (.xlsx)…</button>`
      + (n && signedIn() ? `<button class="btn" data-act="fxBushingDb" title="Lưu số liệu test report sứ (${n} sứ đã nạp) làm giá trị khởi đầu trong CSDL">Lưu test report sứ lên CSDL…</button>` : '');
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
        : n.type === 'serial' ? `session:${n.sessionId}|${n.equipmentId}` : n.type === 'localunit' ? `local:${n.file}|${n.serial}` : n.type === 'equipment' ? `session:${n.sessionId}|`
          : n.type === 'bay' && n.bayId ? `bay:${n.bayId}` : '';
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
      return head + '<div class="callout">Thiết bị này <b>chưa có số liệu xuất xưởng</b> trong CSDL. Nhập file test report (.xlsx) để lưu làm '
        + '<b>giá trị khởi đầu</b> — BBTN sau lắp đặt, định kỳ sẽ lấy thông số và so sánh với số liệu này.'
        + `<div class="row-actions"><button class="btn" data-act="fxImportFor" data-ctx="nofat:${esc(sel.equipmentId)}">Nhập test report cho thiết bị này (.xlsx)…</button></div></div>`;
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
    const f = ui.form;
    if (f.kind === 'import') return importFormHTML();
    if (f.kind === 'replace') return replaceFormHTML();
    if (f.kind === 'bushing') return bushingHTML();
    if (f.kind === 'loc') return locationsHTML();
    if (f.kind === 'group') return groupHTML();
    if (f.kind === 'delete') return deleteFormHTML();
    const e = eqById(f.eqId) || {};
    const head = `<div class="fx-detail-head"><h3>${f.kind === 'eq' ? 'Sửa thông tin thiết bị' : (e.bay_id ? 'Đổi trạm / ngăn' : 'Gán trạm / ngăn')} — ${esc(e.serial_no || '')}</h3><span class="spacer"></span>`
      + '<button class="btn primary" data-act="fxFormSave">Lưu</button><button class="btn" data-act="fxFormCancel">Hủy</button></div>';
    let body = '';
    if (f.kind === 'eq') {
      body = '<div class="fields">'
        + `<div class="field"><label for="fxEqSerial">Số chế tạo</label><input id="fxEqSerial" data-fxform="serial_no" value="${esc(f.values.serial_no)}"></div>`
        + `<div class="field"><label for="fxEqName">Tên thiết bị</label><input id="fxEqName" data-fxform="name" value="${esc(f.values.name)}" placeholder="vd AT1 pha A"></div></div>`
        + '<div class="hint-text">Số chế tạo dùng để tra xu hướng và chọn file xuất xưởng — chỉ sửa khi nhập sai. Mọi lần thí nghiệm của thiết bị đi theo số mới.</div>';
    } else {
      body = `<div class="fields">${bayFields(f.values)}</div>`
        + `<div class="hint-text">Các thành phần (sứ, TI chân sứ) tự đi theo ngăn của máy chính. Chưa có trạm / ngăn: thêm ở <button class="btn small" data-nav="catalog">Trạm – Ngăn – Thiết bị</button>.`
        + `${e.bay_id ? ' Bỏ gán: chọn “— Chọn ngăn —” rồi Lưu.' : ''}</div>`;
    }
    return `<div class="fx-detail fx-form" id="fxDetailBox">${head}${body}</div>`;
  }
  // ---------------------------------------------------------------- lưu test report (.xlsx) lên CSDL: chọn máy, trạm / ngăn
  const opt = (v, t, s) => `<option value="${esc(v)}" ${s ? 'selected' : ''}>${esc(t)}</option>`;
  function bayFields(values) {
    const subs = data.subs || [], bays = (data.bays || []).filter(b => b.substation_id === values.sub);
    return `<div class="field"><label for="fxEqSub">Trạm</label><select id="fxEqSub" data-fxform="sub">${opt('', '— Chọn trạm —', !values.sub)}${subs.map(s => opt(s.id, s.name, s.id === values.sub)).join('')}</select></div>`
      + `<div class="field"><label for="fxEqBay">Ngăn</label><select id="fxEqBay" data-fxform="bay_id" ${values.sub ? '' : 'disabled'}>${opt('', values.sub && !bays.length ? 'Trạm chưa có ngăn' : '— Chọn ngăn —', !values.bay_id)}`
      + `${bays.map(b => opt(b.id, `${b.code}${b.name ? ` — ${b.name}` : ''}`, b.id === values.bay_id)).join('')}</select></div>`;
  }
  function importFormHTML() {
    const f = ui.form, rows = f.plan.rows;
    const n = rows.filter(r => f.values.pick[r.serial]).length;
    let h = `<div class="fx-detail-head"><h3>Lưu test report lên CSDL — ${esc(f.file)}</h3><span class="spacer"></span>`
      + `<button class="btn primary" data-act="fxImportSave" ${n ? '' : 'disabled'}>Lưu ${n} máy</button><button class="btn" data-act="fxFormCancel">Hủy</button></div>`;
    if (f.plan.missingTarget) h += `<div class="callout warn" role="alert">File không có số chế tạo <b>${esc(f.target)}</b> của thiết bị đã chọn — kiểm tra lại file.</div>`;
    h += '<div class="grid-wrap"><table class="grid fx-table"><thead><tr><th>Lưu</th><th>Số chế tạo</th><th>Pha</th><th>Trong danh mục</th><th>Số liệu xuất xưởng</th></tr></thead><tbody>'
      + rows.map(r => `<tr><td><input type="checkbox" data-fximp="${esc(r.serial)}" ${f.values.pick[r.serial] ? 'checked' : ''} aria-label="Lưu máy ${esc(r.serial)}"></td>`
        + `<th>${esc(r.serial)}</th><td>${esc(r.phase)}</td>`
        + `<td>${r.eqId ? `${esc(r.name || 'Đã có')}${r.where ? ` · ${esc(r.where)}` : ' · <span class="muted">chưa gắn ngăn</span>'}` : '<span class="badge st-warn">Thiết bị mới</span>'}</td>`
        + `<td>${r.hasFat ? `<span class="badge st-warn" title="Lưu lại sẽ ghi đè lần FAT này, kể cả giá trị đã sửa tay">Đã có FAT ${esc(vnDate(r.fatDate))} — ghi đè</span>` : 'Chưa có'}</td></tr>`).join('')
      + '</tbody></table></div>';
    const noDate = !f.fileDate;
    h += '<h4>Lần thí nghiệm xuất xưởng</h4>'
      + (noDate ? '<div class="callout warn" role="alert">Không đọc được <b>ngày thí nghiệm</b> trong file — nhập tay để lưu. Các mục khác không đọc được thì bỏ trống; sửa sau bằng chuột phải → <b>Sửa giá trị đo</b>.</div>' : '')
      + `<div class="fields"><div class="field${noDate ? ' flag-missing' : ''}"><label for="fxImpDate">Ngày thí nghiệm${noDate ? ' (nhập tay)' : ''}</label><input id="fxImpDate" type="date" data-fxform="test_date" value="${esc(f.values.test_date)}"${noDate ? ' required' : ''}></div>`
      + `<div class="field"><label for="fxImpNo">Số test report</label><input id="fxImpNo" data-fxform="report_no" value="${esc(f.values.report_no)}" placeholder="không bắt buộc"></div></div>`;
    h += `<h4>Trạm / ngăn (vị trí lắp đặt) cho thiết bị mới hoặc chưa gắn</h4><div class="fields">${bayFields(f.values)}</div>`
      + '<div class="hint-text">Thiết bị đã gắn ngăn giữ nguyên ngăn. Để trống: thiết bị nằm ở nhóm “Chưa gắn trạm / ngăn”, gán sau bằng menu chuột phải. '
      + 'Thiết bị chưa vận hành: số liệu lưu làm <b>giá trị khởi đầu</b> — khi khởi tạo BBTN (sau lắp đặt, định kỳ), chọn thiết bị ở bước ① để tự lấy thông số và so sánh.</div>';
    return `<div class="fx-detail fx-form" id="fxDetailBox">${h}</div>`;
  }
  function openImport(fileName, ctx) {
    const entry = (A.factories || []).find(x => x.name === fileName);
    if (!entry) throw new Error('Không còn file này trên máy');
    const D = entry.api.data;
    const units = D.order.map(sn => ({ serial: sn, phase: (D.units[sn] || {}).phase || '' }));
    const tgt = ctx && ctx.eqId ? eqById(ctx.eqId) : null;
    const plan = FactoryTree.importPlan(units, data.equipment || [], data.sessions || [], { bayId: tgt ? tgt.bay_id || '' : '', target: tgt ? tgt.serial_no : '' });
    const bay = (data.bays || []).find(b => b.id === plan.bayId);
    ui.form = { kind: 'import', file: fileName, target: tgt ? tgt.serial_no : '', plan, fileDate: D.reportDate || '',
      values: { sub: bay ? bay.substation_id : '', bay_id: plan.bayId, test_date: D.reportDate || '', report_no: '', pick: Object.fromEntries(plan.rows.map(r => [r.serial, r.pick])) } };
    ui.detail = null;
    refresh('detail');
    const box = $('#fxDetailBox'); if (box) { box.scrollIntoView({ block: 'nearest' }); const b = box.querySelector('[data-act="fxImportSave"]:not([disabled]), select'); if (b) b.focus(); }
  }
  async function saveImport() {
    const f = ui.form;
    if (!DB.canEdit()) throw new Error('Cần đăng nhập tài khoản có quyền ghi');
    const entry = (A.factories || []).find(x => x.name === f.file);
    if (!entry) throw new Error('Không còn file này trên máy');
    const serials = f.plan.rows.filter(r => f.values.pick[r.serial]).map(r => r.serial);
    if (!serials.length) throw new Error('Chọn ít nhất một máy để lưu');
    if (!f.values.test_date) { const d = $('#fxImpDate'); if (d) d.focus(); throw new Error('Nhập ngày thí nghiệm xuất xưởng (file không ghi hoặc không đọc được)'); }
    await A.track('Lưu test report lên CSDL', async () => {
      const meta = { test_date: f.values.test_date !== f.fileDate ? f.values.test_date : '', report_no: f.values.report_no };
      const out = await Records.importFactory(A.state, entry.api, A.factoryBlob(f.file), f.values.bay_id || null, serials, meta);
      A.toast(`Đã lưu lên CSDL: ${out.map(o => `${o.serial} (${o.n} giá trị)`).join(', ')}`);
    });
    ui.form = null;
    if (window.Catalog) Catalog.reset();
    reset(); A.renderMain(); await load(true);
  }

  // ---------------------------------------------------------------- xóa: lần FAT trong CSDL (admin) / file .xlsx trên máy
  function deleteFormHTML() {
    const f = ui.form, local = f.target === 'local';
    let lines = [];
    if (local) {
      const entry = (A.factories || []).find(x => x.name === f.name);
      lines = [`File ${f.name}: ${entry ? entry.api.data.order.join(', ') : ''}`, 'Chỉ bỏ khỏi máy này (trình duyệt); số liệu đã lưu CSDL không bị ảnh hưởng.'];
      if (entry && entry.emb) lines.push('File nhúng sẵn trong app — tải lại trang sẽ có lại.');
    } else {
      const s = (data.sessions || []).find(x => x.id === f.id) || {}, e = eqById(s.equipment_id) || {};
      lines = [`${e.serial_no || s.serial_no || ''}${e.name ? ` — ${e.name}` : ''} · FAT ${vnDate(s.test_date)}${s.report_no ? ` · report ${s.report_no}` : ''} · ${s.n_values || 0} giá trị đo`,
        'Xóa toàn bộ giá trị đo và file test report gốc của lần này khỏi CSDL. Thiết bị vẫn giữ trong danh mục.',
        'BBTN sau sẽ không còn số liệu xuất xưởng (giá trị khởi đầu) để so sánh cho tới khi nhập lại test report. Không thể hoàn tác.'];
    }
    return `<div class="fx-detail fx-form" id="fxDetailBox"><div class="callout bad fx-confirm" role="alert"><b>${local ? 'Bỏ file test report khỏi máy này?' : 'Xóa số liệu xuất xưởng khỏi CSDL?'}</b>`
      + `<ul>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul><div class="row-actions"><button class="btn danger" data-act="fxDeleteConfirm">${local ? 'Bỏ file' : 'Xác nhận xóa'}</button>`
      + '<button class="btn" data-act="fxFormCancel">Hủy</button></div></div></div>';
  }
  function openDelete(target, idOrName) {
    ui.form = target === 'local' ? { kind: 'delete', target, name: idOrName } : { kind: 'delete', target, id: idOrName };
    ui.detail = null;
    refresh('detail');
    const box = $('#fxDetailBox'); if (box) { box.scrollIntoView({ block: 'nearest' }); const b = box.querySelector('[data-act="fxFormCancel"]'); if (b) b.focus(); }
  }
  async function confirmDelete() {
    const f = ui.form;
    ui.form = null;
    if (f.target === 'local') { A.removeFactory(f.name); return; }
    if (DB.role !== 'admin') throw new Error('Chỉ admin xóa được số liệu xuất xưởng đã lưu');
    await A.track('Xóa số liệu xuất xưởng', async () => {
      const r = await DB.deleteFactory(f.id);
      A.toast(r.fileError ? `Đã xóa số liệu; chưa xóa được file gốc trên Storage: ${r.fileError}` : `Đã xóa số liệu xuất xưởng${r.files ? ' và file test report gốc' : ''}`, !!r.fileError);
    });
    if (window.Catalog) Catalog.reset();
    if (A.state.db && A.state.db.sessionId === f.id) { A.state.db = null; A.persist(); }
    reset(); A.renderMain(); await load(true);
  }

  // ---------------------------------------------------------------- G2: thay thiết bị con, lịch sử vị trí, tổ máy
  const today = () => new Date().toISOString().slice(0, 10);
  const vn = d => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
  const formHead = (title, canSave, saveText) => `<div class="fx-detail-head"><h3>${title}</h3><span class="spacer"></span>`
    + (canSave ? `<button class="btn primary" data-act="fxFormSave">${saveText || 'Lưu'}</button>` : '') + `<button class="btn" data-act="fxFormCancel">${canSave ? 'Hủy' : 'Đóng'}</button></div>`;
  const showForm = () => { ui.detail = null; refresh('detail'); const box = $('#fxDetailBox'); if (box) { box.scrollIntoView({ block: 'nearest' }); const first = box.querySelector('input, select'); if (first) first.focus(); } };
  const afterSave = async msg => { A.toast(msg); ui.form = null; if (window.Catalog) Catalog.reset(); data.sessions = null; await load(true); };
  const groupOfBay = bayId => (data.groups || []).find(g => g.bay_id === bayId) || null;

  // Thay sứ / OLTC / TI chân sứ (replace_component): tháo cái cũ (giữ lịch sử thí nghiệm), lắp cái mới cùng vị trí
  function openReplace(eqId) {
    const e = eqById(eqId);
    if (!e || !e.parent_id) throw new Error('Chỉ thay được thiết bị con (sứ, OLTC, TI chân sứ)');
    ui.form = { kind: 'replace', eqId, values: { serial: '', date: today(), oldStatus: 'retired', model: e.model || '', manufacturer: e.manufacturer || '', note: '' } };
    showForm();
  }
  function replaceFormHTML() {
    const f = ui.form, e = eqById(f.eqId) || {}, v = f.values;
    const opt = (val, t) => `<option value="${val}" ${v.oldStatus === val ? 'selected' : ''}>${t}</option>`;
    return `<div class="fx-detail fx-form" id="fxDetailBox">${formHead(`Thay ${e.class_code === 'SU' ? 'sứ' : 'thiết bị'} ${esc(e.serial_no || '')}${e.position ? ` — đầu ${esc(e.position)}` : ''} của ${esc(e.parent_serial || '')}`, true, 'Thay')}`
      + '<div class="fields">'
      + `<div class="field"><label for="fxRpSerial">Số chế tạo ${e.class_code === 'SU' ? 'sứ' : 'thiết bị'} mới</label><input id="fxRpSerial" data-fxform="serial" value="${esc(v.serial)}" required></div>`
      + `<div class="field"><label for="fxRpDate">Ngày thay</label><input id="fxRpDate" type="date" data-fxform="date" value="${esc(v.date)}"></div>`
      + `<div class="field"><label for="fxRpOld">Cái cũ sau khi tháo</label><select id="fxRpOld" data-fxform="oldStatus">${opt('retired', 'Thanh lý')}${opt('spare', 'Dự phòng (dùng lại sau)')}</select></div>`
      + `<div class="field"><label for="fxRpModel">Kiểu loại</label><input id="fxRpModel" data-fxform="model" value="${esc(v.model)}"></div>`
      + `<div class="field"><label for="fxRpMfr">Hãng sản xuất</label><input id="fxRpMfr" data-fxform="manufacturer" value="${esc(v.manufacturer)}"></div>`
      + `<div class="field wide"><label for="fxRpNote">Ghi chú</label><input id="fxRpNote" data-fxform="note" value="${esc(v.note)}" placeholder="vd sứ nứt, rò dầu"></div></div>`
      + '<div class="hint-text">Cái cũ ghi ngày tháo, vẫn hiện trên cây (đã tháo) để tra lịch sử thí nghiệm. Cái mới lắp cùng vị trí, có giá trị khởi đầu riêng: '
      + 'nhập test report của nó (sứ Hitachi: nút <b>Nhập test report sứ</b>) hoặc lấy lần thí nghiệm sau lắp đặt. Số chế tạo đã có trong danh mục (dự phòng) thì dùng lại bản ghi đó.</div></div>';
  }
  async function saveReplace() {
    const f = ui.form, v = f.values, e = eqById(f.eqId) || {};
    if (!String(v.serial || '').trim()) { const i = $('#fxRpSerial'); if (i) i.focus(); throw new Error('Nhập số chế tạo thiết bị mới'); }
    await A.track('Thay thiết bị', () => DB.replaceComponent(f.eqId, { serial: String(v.serial).trim(), date: v.date || today(), oldStatus: v.oldStatus,
      model: v.model, manufacturer: v.manufacturer, note: v.note }));
    await afterSave(`Đã thay ${e.serial_no} bằng ${String(v.serial).trim()}`);
  }

  // Test report sứ của hãng (Hitachi) → lần FAT của từng sứ trong CSDL (giá trị khởi đầu cho xu hướng C1, tgδ sứ)
  function openBushing(fileName) {
    const H = window.HitachiBushing;
    if (!H || !H.reports.length) throw new Error('Chưa nạp test report sứ — bấm Nhập test report sứ (.xlsx)');
    const plan = H.dbPlan(data.equipment || [], data.sessions || []);
    ui.form = { kind: 'bushing', fileName: fileName || H.source || '', plan, values: { date: '', pick: Object.fromEntries(plan.map(r => [r.serial, r.pick])) } };
    showForm();
  }
  function bushingHTML() {
    const f = ui.form, v = f.values, can = DB.canEdit();
    const picked = f.plan.filter(r => v.pick[r.serial]);
    const noDate = picked.some(r => !r.date);
    let h = formHead(`Lưu test report sứ lên CSDL — ${esc(f.fileName)}`, can && picked.length, `Lưu ${picked.length} sứ`);
    h += '<div class="grid-wrap"><table class="grid fx-table"><thead><tr><th>Lưu</th><th>S/N sứ</th><th>Ngày TN</th><th>Trong danh mục</th><th>Số liệu xuất xưởng</th></tr></thead><tbody>'
      + f.plan.map(r => `<tr><td><input type="checkbox" data-fxbu="${esc(r.serial)}" ${v.pick[r.serial] ? 'checked' : ''} ${r.reason || !can ? 'disabled' : ''} aria-label="Lưu sứ ${esc(r.serial)}"></td>`
        + `<th>${esc(r.serial)}</th><td>${esc(vn(r.date)) || '<span class="muted">không ghi</span>'}</td>`
        + `<td>${r.eq ? esc(r.where || 'Đã có') : `<span class="badge st-warn" title="${esc(r.reason)}">Chưa có</span>`}${r.eq && r.reason ? ` <span class="muted">${esc(r.reason)}</span>` : ''}</td>`
        + `<td>${r.hasFat ? '<span class="badge st-warn" title="Lưu lại sẽ ghi đè lần FAT này, kể cả giá trị đã sửa tay">Đã có — ghi đè</span>' : 'Chưa có'}</td></tr>`).join('')
      + '</tbody></table></div>';
    if (noDate) h += `<div class="fields"><div class="field flag-missing"><label for="fxBuDate">Ngày thí nghiệm (nhập tay — file không ghi ngày)</label><input id="fxBuDate" type="date" data-fxform="date" value="${esc(v.date)}"></div></div>`;
    h += '<div class="hint-text">Chỉ lưu được sứ <b>đã có trong danh mục</b> (gắn vào MBA, có vị trí đầu sứ) để chuỗi xu hướng khớp số đo hiện trường. '
      + 'Mỗi sứ một lần thí nghiệm xuất xưởng: C1, tanδ1, C2, tanδ2 (quy về 20 °C theo HD Hitachi, như số đo hiện trường) — làm <b>giá trị khởi đầu</b> cho xu hướng sứ.</div>';
    return `<div class="fx-detail fx-form" id="fxDetailBox">${h}</div>`;
  }
  async function saveBushing() {
    const f = ui.form, v = f.values;
    const serials = f.plan.filter(r => v.pick[r.serial]).map(r => r.serial);
    if (!serials.length) throw new Error('Chọn ít nhất một sứ');
    if (f.plan.some(r => v.pick[r.serial] && !r.date) && !v.date) { const d = $('#fxBuDate'); if (d) d.focus(); throw new Error('Nhập ngày thí nghiệm (file không ghi ngày)'); }
    const packs = HitachiBushing.factoryPacks(serials, { equipment: data.equipment || [], fileName: f.fileName, date: v.date });
    await A.track('Lưu test report sứ', async () => {
      const out = await Records.importPacks(packs, f.fileName, null);
      A.toast(`Đã lưu test report ${out.length} sứ: ${out.map(o => `${o.serial} (${o.n} giá trị)`).join(', ')}`);
    });
    ui.form = null; data.sessions = null; await load(true);
  }

  // Lịch sử vị trí lắp đặt (equipment_location): ghi tự động khi đổi ngăn; sửa ngày / ghi chú
  async function openLocations(eqId) {
    const e = eqById(eqId);
    if (!e) throw new Error('Không tìm thấy thiết bị');
    ui.form = { kind: 'loc', eqId, rows: null, edits: {} };
    showForm();
    ui.form.rows = await DB.listLocations(eqId);
    refresh('detail');
  }
  function locationsHTML() {
    const f = ui.form, e = eqById(f.eqId) || {}, can = DB.canEdit();
    let h = formHead(`Lịch sử vị trí lắp đặt — ${esc(e.serial_no || '')}${e.name ? ` (${esc(e.name)})` : ''}`, can && f.rows && f.rows.length, 'Lưu thay đổi');
    if (!f.rows) return `<div class="fx-detail fx-form" id="fxDetailBox">${h}<div class="empty">Đang tải…</div></div>`;
    if (!f.rows.length) h += '<div class="callout">Chưa có lịch sử vị trí (CSDL chưa chạy migration G2, hoặc thiết bị chưa gắn ngăn).</div>';
    else {
      const val = (r, k) => (Object.prototype.hasOwnProperty.call(f.edits, `${r.id}|${k}`) ? f.edits[`${r.id}|${k}`] : (r[k] || ''));
      const inp = (r, k, type) => (can ? `<input ${type ? `type="${type}"` : ''} data-fxloc="${esc(r.id)}|${k}" value="${esc(String(val(r, k)).slice(0, type ? 10 : 500))}" aria-label="${k}">` : esc(type ? vn(r[k]) : r[k] || ''));
      h += '<div class="grid-wrap"><table class="grid fx-table"><thead><tr><th>Trạm</th><th>Ngăn</th><th>Từ ngày</th><th>Đến ngày</th><th>Ghi chú</th></tr></thead><tbody>'
        + f.rows.map(r => `<tr><td>${esc(r.substation_name)}</td><th>${esc(r.bay_code)}${r.to_date ? '' : ' <span class="badge st-pass">đang lắp</span>'}</th>`
          + `<td>${inp(r, 'from_date', 'date')}</td><td>${r.to_date ? inp(r, 'to_date', 'date') : '—'}</td><td>${inp(r, 'note')}</td></tr>`).join('')
        + '</tbody></table></div>';
    }
    h += '<div class="hint-text">Đổi ngăn (cùng trạm hoặc khác trạm) bằng menu <b>Đổi trạm / ngăn…</b>: vị trí cũ đóng, vị trí mới mở với ngày hôm nay — sửa lại ngày thực tế ở đây. '
      + 'Mỗi lần thí nghiệm ghi ngăn tại thời điểm thí nghiệm; xu hướng vẫn theo số chế tạo.</div>';
    return `<div class="fx-detail fx-form" id="fxDetailBox">${h}</div>`;
  }
  async function saveLocations() {
    const f = ui.form, by = {};
    Object.entries(f.edits).forEach(([k, v]) => { const [id, col] = k.split('|'); (by[id] = by[id] || {})[col] = v === '' ? null : v; });
    const ids = Object.keys(by).filter(id => { const r = f.rows.find(x => String(x.id) === id); return r && Object.entries(by[id]).some(([c, v]) => (r[c] || null) !== v); });
    if (!ids.length) { A.toast('Không có thay đổi'); return; }
    for (const id of ids) {
      const p = by[id];
      if (p.from_date === null) throw new Error('Không để trống ngày bắt đầu');
      await A.track('Lưu lịch sử vị trí', () => DB.updateLocation(id, p));
    }
    A.toast(`Đã lưu ${ids.length} dòng lịch sử vị trí`);
    f.edits = {}; f.rows = await DB.listLocations(f.eqId); refresh('detail');
  }

  // Tổ máy 3 pha (equipment_groups): khai tổ cho ngăn, thay máy một pha (replace_group_member — giữ lịch sử thành viên)
  const mbaRoots = cls => (data.equipment || []).filter(e => !e.parent_id && e.class_code === cls && e.status !== 'retired');
  async function openGroup(bayId) {
    const g = groupOfBay(bayId), bay = (data.bays || []).find(b => b.id === bayId) || {};
    const roots = mbaRoots(g ? g.class_code || 'MBA' : 'MBA');
    const cur = g ? { A: g.eq_a || '', B: g.eq_b || '', C: g.eq_c || '' }
      : Object.fromEntries(['A', 'B', 'C'].map(p => [p, (roots.find(e => e.bay_id === bayId && String(e.phase || '').toUpperCase() === p) || {}).id || '']));
    ui.form = { kind: 'group', bayId, groupId: g ? g.id : '', cur, history: null,
      values: Object.assign({ name: g ? g.name : `Tổ MBA ${bay.code || ''}`.trim(), date: today(), note: '' }, Object.fromEntries(['A', 'B', 'C'].map(p => [`m_${p}`, cur[p]]))) };
    showForm();
    if (g) { ui.form.history = await DB.listGroupMembers(g.id); refresh('detail'); }
  }
  function groupHTML() {
    const f = ui.form, v = f.values, can = DB.canEdit(), bay = (data.bays || []).find(b => b.id === f.bayId) || {};
    const roots = mbaRoots('MBA').sort((a, b) => ((b.bay_id === f.bayId) - (a.bay_id === f.bayId)) || String(a.serial_no).localeCompare(String(b.serial_no)));
    const label = e => `${e.serial_no}${e.name ? ` — ${e.name}` : ''}${e.phase ? ` (pha ${e.phase})` : ''}${e.bay_id === f.bayId ? '' : e.bay_code ? ` · ${e.bay_code}` : ' · chưa gắn ngăn'}${e.status === 'spare' ? ' · dự phòng' : ''}`;
    let h = formHead(f.groupId ? `Tổ máy 3 pha — ${esc(v.name)}` : `Khai tổ máy 3 pha — ngăn ${esc(bay.code || '')}`, can, f.groupId ? 'Lưu thay đổi' : 'Tạo tổ');
    h += '<div class="fields">';
    if (!f.groupId) h += `<div class="field wide"><label for="fxGrName">Tên tổ</label><input id="fxGrName" data-fxform="name" value="${esc(v.name)}"></div>`;
    ['A', 'B', 'C'].forEach(p => {
      h += `<div class="field"><label for="fxGr${p}">Máy pha ${p}</label><select id="fxGr${p}" data-fxform="m_${p}" ${can ? '' : 'disabled'}>`
        + `<option value="">— Chưa có —</option>${roots.map(e => `<option value="${esc(e.id)}" ${v[`m_${p}`] === e.id ? 'selected' : ''}>${esc(label(e))}</option>`).join('')}</select></div>`;
    });
    if (f.groupId) h += `<div class="field"><label for="fxGrDate">Ngày thay máy</label><input id="fxGrDate" type="date" data-fxform="date" value="${esc(v.date)}"></div>`
      + `<div class="field wide"><label for="fxGrNote">Ghi chú thay máy</label><input id="fxGrNote" data-fxform="note" value="${esc(v.note)}" placeholder="vd máy pha B sự cố, lắp máy dự phòng"></div>`;
    h += '</div>';
    if (f.history && f.history.length) {
      h += '<h4>Lịch sử thành viên</h4><div class="grid-wrap"><table class="grid fx-table"><thead><tr><th>Pha</th><th>Số chế tạo</th><th>Từ ngày</th><th>Đến ngày</th><th>Ghi chú</th></tr></thead><tbody>'
        + f.history.map(m => `<tr><th>${esc(m.phase)}</th><td>${esc(m.serial_no)}${m.to_date ? '' : ' <span class="badge st-pass">đang lắp</span>'}</td><td>${esc(vn(m.from_date))}</td><td>${esc(vn(m.to_date))}</td><td>${esc(m.note || '')}</td></tr>`).join('')
        + '</tbody></table></div>';
    }
    h += '<div class="hint-text">Tổ 3 MBA 1 pha rời: trình khởi tạo BBTN lấy máy các pha theo tổ này (không đoán theo ngăn). '
      + 'Thay máy một pha (vd lắp máy dự phòng): chọn máy mới cho pha đó, nhập ngày → máy cũ rời tổ, lịch sử thí nghiệm giữ theo số chế tạo. Nhớ đổi ngăn của máy mới / máy cũ nếu cần.</div>';
    return `<div class="fx-detail fx-form" id="fxDetailBox">${h}</div>`;
  }
  async function saveGroup() {
    const f = ui.form, v = f.values;
    const picked = ['A', 'B', 'C'].filter(p => v[`m_${p}`]);
    const ids = picked.map(p => v[`m_${p}`]);
    if (new Set(ids).size !== ids.length) throw new Error('Một máy không thể ở hai pha');
    if (!f.groupId) {
      if (picked.length < 2) throw new Error('Tổ máy cần ít nhất 2 pha');
      await A.track('Tạo tổ máy', () => DB.createGroup({ kind: 'BANK_1P', class_code: 'MBA', name: String(v.name || '').trim() || 'Tổ MBA', bay_id: f.bayId },
        Object.fromEntries(picked.map(p => [p, v[`m_${p}`]]))));
      await afterSave(`Đã tạo ${v.name}`); return;
    }
    const changed = ['A', 'B', 'C'].filter(p => v[`m_${p}`] && v[`m_${p}`] !== f.cur[p]);
    if (!changed.length) { A.toast('Không có thay đổi (bỏ chọn một pha không xóa máy khỏi tổ)'); return; }
    for (const p of changed) await A.track(`Thay máy pha ${p}`, () => DB.replaceGroupMember(f.groupId, p, v[`m_${p}`], v.date || today(), v.note));
    await afterSave(`Đã thay máy pha ${changed.join(', ')}`);
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
    if (!e.parent_id) items.push(['fxEqBay', e.bay_id ? 'Đổi trạm / ngăn…' : 'Gán trạm / ngăn…', why], ['fxLocHist', 'Lịch sử vị trí lắp đặt…', '']);
    // thiết bị con đang lắp (sứ, OLTC, TI chân sứ): thay bằng thiết bị khác, giữ lịch sử cái cũ
    else if (!e.removed_on) items.push(['fxReplace', `Thay ${e.class_code === 'SU' ? 'sứ' : 'thiết bị'} này…`, why]);
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
        ['fxDelete', 'Xóa số liệu xuất xưởng…', DB.role === 'admin' ? '' : 'Chỉ admin xóa được số liệu đã lưu'],
      ]);
    }
    if (kind === 'nofat') {
      const e = eqById(eqIdOf(ctx));
      // sứ: test report sứ của hãng (file riêng); máy chính: test report MBA
      const first = e && e.parent_id && e.class_code === 'SU' ? ['loadHitachi', 'Nhập test report sứ (.xlsx)…', 'Lưu làm giá trị khởi đầu cho sứ']
        : ['fxImportFor', 'Nhập test report (.xlsx)…', 'Lưu làm giá trị khởi đầu cho thiết bị này'];
      return [first].concat(equipmentItems(ctx, can));
    }
    if (kind === 'bay') {
      const g = groupOfBay(ctxParts(ctx).a);
      return [['fxGroup', g ? `Tổ máy 3 pha: ${g.name}…` : 'Khai tổ máy 3 pha (máy pha A, B, C rời)…', g ? 'Xem thành viên, thay máy một pha' : '']];
    }
    if (kind === 'local') return [
      ['fxLocalView', 'Xem sheet gốc', ''], ['fxLocalUse', 'Dùng file này cho biên bản', ''],
      ['fxLocalSave', 'Lưu lên CSDL…', signedIn() ? (can ? '' : 'Tài khoản chỉ xem') : 'Cần đăng nhập'],
      ['fxLocalDel', 'Bỏ file khỏi máy này…', ''],
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
    const gated = act => ['fxEdit', 'fxLocalSave', 'fxEqEdit', 'fxEqBay', 'fxDelete', 'fxReplace'].includes(act);
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
    if (act === 'fxImport' || act === 'fxImportFor') { A.pickXlsx({ page: 'factory', eqId: act === 'fxImportFor' ? eqIdOf(ctx) : '' }); return; }
    if (act === 'fxImportSave') { await saveImport(); return; }
    if (act === 'fxDelete') { if (DB.role !== 'admin') throw new Error('Chỉ admin xóa được số liệu xuất xưởng đã lưu'); openDelete('session', p.a); return; }
    if (act === 'fxLocalDel') { openDelete('local', p.a); return; }
    if (act === 'fxDeleteConfirm') { await confirmDelete(); return; }
    if (act === 'fxReplace') { if (!DB.canEdit()) throw new Error('Tài khoản chỉ xem'); openReplace(eqIdOf(ctx)); return; }
    if (act === 'fxLocHist') { await openLocations(eqIdOf(ctx)); return; }
    if (act === 'fxGroup') { await openGroup(p.a); return; }
    if (act === 'fxFormSave' && ui.form && ui.form.kind === 'replace') { await saveReplace(); return; }
    if (act === 'fxFormSave' && ui.form && ui.form.kind === 'bushing') { await saveBushing(); return; }
    if (act === 'fxBushingDb') { if (!data.sessions) await load(true); openBushing(''); return; }
    if (act === 'fxFormSave' && ui.form && ui.form.kind === 'loc') { await saveLocations(); return; }
    if (act === 'fxFormSave' && ui.form && ui.form.kind === 'group') { await saveGroup(); return; }
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
      if (!data.sessions) await load(true);
      openImport(p.a, null);
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
    if (t.dataset && t.dataset.fxloc && ui.form && ui.form.kind === 'loc') ui.form.edits[t.dataset.fxloc] = t.value;
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset && t.dataset.fxbu !== undefined && ui.form && ui.form.kind === 'bushing') { ui.form.values.pick[t.dataset.fxbu] = t.checked; refresh('detail'); const c = $(`[data-fxbu="${CSS.escape(t.dataset.fxbu)}"]`); if (c) c.focus(); return; }
    if (t.dataset && t.dataset.fximp !== undefined && ui.form && ui.form.kind === 'import') { ui.form.values.pick[t.dataset.fximp] = t.checked; refresh('detail'); const c = $(`[data-fximp="${CSS.escape(t.dataset.fximp)}"]`); if (c) c.focus(); return; }
    if (t.dataset && t.dataset.fxfilter && ui.detail) { ui.detail[t.dataset.fxfilter] = t.value; refresh('detail'); const s = $(`[data-fxfilter="${t.dataset.fxfilter}"]`); if (s) s.focus(); }
    if (t.dataset && t.dataset.fxform && ui.form && t.tagName === 'SELECT') {
      ui.form.values[t.dataset.fxform] = t.value;
      if (t.dataset.fxform === 'sub' && ui.form.values.bay_id !== undefined) { ui.form.values.bay_id = ''; refresh('detail'); const s = $('#fxEqSub'); if (s) s.focus(); }
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
  // test report sứ vừa nạp khi đang ở trang XX → khung lưu lên CSDL (đăng nhập, quyền ghi)
  document.addEventListener('bushingtr:added', e => {
    if (!A || A.currentSection() !== 'factory' || !signedIn() || !DB.canEdit()) return;
    (data.sessions ? Promise.resolve() : load(true)).then(() => openBushing((e.detail || {}).name)).catch(err => A.toast('Lỗi: ' + err.message, true));
  });
  // file test report vừa nạp từ trang XX (nút Nhập test report / menu thiết bị) → mở khung lưu CSDL
  document.addEventListener('factory:added', e => {
    const d = e.detail || {}, pur = d.purpose;
    if (!A || !pur || pur.page !== 'factory' || A.currentSection() !== 'factory') return;
    if (!signedIn() || !DB.canEdit()) { A.toast(signedIn() ? 'Tài khoản chỉ xem — file chỉ dùng trên máy này' : 'Đăng nhập để lưu test report lên CSDL; file chỉ dùng trên máy này'); return; }
    (data.sessions ? Promise.resolve() : load(true)).then(() => openImport(d.name, { eqId: pur.eqId })).catch(err => A.toast('Lỗi: ' + err.message, true));
  });
  document.addEventListener('auth:changed', () => { reset(); if (A && A.currentSection() === 'factory') { A.renderMain(); load(true); } });

  window.FactoryUI = { render, afterRender, action, reset };
})();
