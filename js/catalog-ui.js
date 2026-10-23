// Danh mục Trạm → Ngăn lộ → Thiết bị: xem dạng 3 cột, thêm/sửa/xóa.
// Ô nhập có danh sách gợi ý (giá trị mặc định + giá trị đã có trong CSDL), vẫn gõ tự do được.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => App.esc(s);

  const C = { subs: null, bays: null, eqs: null, classes: null, selSub: '', selBay: '', selEq: '', form: null, loading: false };

  const uniq = arr => [...new Set(arr.filter(x => x !== null && x !== undefined && String(x).trim() !== '').map(String))];
  const from = (list, k) => () => (list() || []).map(r => r[k]);
  const STATUS_EQ = [['in_service', 'Đang vận hành'], ['spare', 'Dự phòng'], ['retired', 'Đã thanh lý']];
  const STATUS_BAY = [['in_service', 'Đang vận hành'], ['construction', 'Đang xây dựng'], ['retired', 'Ngừng sử dụng']];

  // type: text | number | date | textarea | select ; list: gợi ý mặc định ; dyn: gợi ý từ dữ liệu đã có
  const FORMS = {
    substations: {
      title: 'Trạm biến áp', fields: [
        { k: 'name', label: 'Tên trạm *', req: true, dyn: from(() => C.subs, 'name'), list: ['TBA 500kV ', 'TBA 220kV '] },
        { k: 'code', label: 'Mã trạm', dyn: from(() => C.subs, 'code') },
        { k: 'voltage_kv', label: 'Cấp điện áp cao nhất (kV)', type: 'number', list: [500, 220, 110] },
        { k: 'owner_unit', label: 'Đơn vị quản lý', list: ['Công ty Truyền tải điện 1', 'Công ty Truyền tải điện 2', 'Công ty Truyền tải điện 3', 'Công ty Truyền tải điện 4'], dyn: from(() => C.subs, 'owner_unit') },
        { k: 'region', label: 'Truyền tải điện khu vực', dyn: from(() => C.subs, 'region') },
        { k: 'address', label: 'Địa chỉ', dyn: from(() => C.subs, 'address') },
        { k: 'commissioned_on', label: 'Ngày đóng điện', type: 'date' },
        { k: 'notes', label: 'Ghi chú', type: 'textarea' },
      ],
    },
    bays: {
      title: 'Ngăn lộ', fields: [
        { k: 'substation_id', label: 'Thuộc trạm *', type: 'select', req: true, options: () => (C.subs || []).map(s => [s.id, s.name]) },
        { k: 'code', label: 'Tên/mã vận hành *', req: true, list: ['AT1', 'AT2', 'T1', 'T2', 'KH1', 'TBK1'], dyn: from(() => C.bays, 'code') },
        { k: 'name', label: 'Tên đầy đủ', dyn: from(() => C.bays, 'name') },
        { k: 'bay_type', label: 'Loại ngăn', list: ['MBA', 'Đường dây', 'Kháng điện', 'Tụ bù dọc', 'Tụ bù ngang', 'Phân đoạn thanh cái', 'Liên lạc thanh cái', 'Máy cắt vòng', 'Tự dùng', 'TU thanh cái'], dyn: from(() => C.bays, 'bay_type') },
        { k: 'voltage_kv', label: 'Cấp điện áp (kV)', type: 'number', list: [500, 220, 110, 35, 22] },
        { k: 'status', label: 'Trạng thái', type: 'select', options: () => STATUS_BAY },
        { k: 'notes', label: 'Ghi chú', type: 'textarea' },
      ],
    },
    equipment: {
      title: 'Thiết bị', fields: [
        { k: 'bay_id', label: 'Thuộc ngăn lộ *', type: 'select', req: true, options: () => (C.bays || []).map(b => [b.id, `${b.substation_name} · ${b.code}${b.name ? ' – ' + b.name : ''}`]) },
        { k: 'class_code', label: 'Loại thiết bị *', type: 'select', req: true, options: () => (C.classes || []).map(c => [c.code, `${c.code} – ${c.name_vi}`]) },
        { k: 'parent_id', label: 'Thuộc thiết bị (sứ, OLTC, BCT…)', type: 'select', options: () => [['', '— thiết bị chính —']].concat(eqOfBay(C.form && C.form.data.bay_id).filter(e => !e.parent_id && e.id !== (C.form && C.form.id)).map(e => [e.id, `${e.class_code} · ${e.serial_no}${e.name ? ' – ' + e.name : ''}`])) },
        { k: 'serial_no', label: 'Số chế tạo *', req: true },
        { k: 'name', label: 'Tên / ký hiệu vận hành', list: ['AT1 pha A', 'AT1 pha B', 'AT1 pha C'], dyn: from(() => C.eqs, 'name') },
        { k: 'phase', label: 'Pha', list: ['A', 'B', 'C', 'ABC', 'N'] },
        { k: 'position', label: 'Vị trí lắp đặt / đầu sứ', list: ['1.1', '2.1', '2', '3.1', '3.2'], dyn: from(() => C.eqs, 'position') },
        { k: 'manufacturer', label: 'Hãng sản xuất', list: ['ABB', 'Hitachi Energy', 'Siemens Energy', 'GE Vernova', 'Changzhou Dongzhi Transformer', 'TBEA', 'Hyosung', 'HICO', 'EEMC – Đông Anh', 'Toshiba'], dyn: from(() => C.eqs, 'manufacturer') },
        { k: 'model', label: 'Kiểu loại', dyn: from(() => C.eqs, 'model') },
        { k: 'voltage_kv', label: 'Điện áp định mức (kV)', type: 'number', list: [500, 220, 110, 35, 22] },
        { k: 'year_made', label: 'Năm sản xuất', type: 'number' },
        { k: 'commissioned_on', label: 'Ngày đóng điện', type: 'date' },
        { k: 'status', label: 'Trạng thái', type: 'select', options: () => STATUS_EQ },
        { k: 'notes', label: 'Ghi chú', type: 'textarea' },
      ],
    },
  };

  const eqOfBay = bayId => (C.eqs || []).filter(e => e.bay_id === bayId);

  async function load(force) {
    if (C.loading || (!force && C.subs)) return;
    C.loading = true;
    try {
      [C.subs, C.bays, C.eqs, C.classes] = await Promise.all([DB.listSubstations(), DB.listBays(), DB.listEquipment(), DB.listClasses()]);
      if (C.selSub && !C.subs.some(s => s.id === C.selSub)) C.selSub = '';
      if (!C.selSub && C.subs.length) C.selSub = C.subs[0].id;
      if (C.selBay && !C.bays.some(b => b.id === C.selBay)) C.selBay = '';
    } catch (e) { App.toast('Lỗi tải danh mục: ' + e.message, true); C.subs = C.subs || []; }
    finally { C.loading = false; }
  }

  // ------------------------------------------------------------------ render
  function render() {
    let h = `<div class="panel-head"><span class="secno">≡</span><h2>Danh mục Trạm – Ngăn lộ – Thiết bị</h2><span class="en">Substation · Bay · Equipment</span></div>`;
    if (!DB.user) return `<section class="panel">${h}<div class="empty">Kết nối và đăng nhập CSDL ở trang “CSDL” để quản lý danh mục.</div></section>`;
    h += `<div class="cat-cols" id="catCols">${colsHTML()}</div><div id="catForm">${formHTML()}</div>`;
    return `<section class="panel">${h}</section>`;
  }

  function colsHTML() {
    if (!C.subs) return '<div class="empty">Đang tải…</div>';
    const edit = DB.canEdit();
    const subs = C.subs, bays = (C.bays || []).filter(b => b.substation_id === C.selSub);
    const eqs = eqOfBay(C.selBay);
    const col = (title, type, items, addLabel, disabledAdd) => `<div class="cat-col"><div class="cat-col-head"><b>${title}</b>
      ${edit ? `<button class="btn small" data-cat="add" data-type="${type}" ${disabledAdd ? 'disabled' : ''}>+ ${addLabel}</button>` : ''}</div>
      <div class="cat-list">${items || '<div class="empty">Chưa có.</div>'}</div></div>`;
    const subItems = subs.map(s => item('substations', s.id, s.name, `${s.voltage_kv ? s.voltage_kv + ' kV · ' : ''}${s.n_bays} ngăn`, C.selSub === s.id)).join('');
    const bayItems = bays.map(b => item('bays', b.id, b.code + (b.name ? ' – ' + b.name : ''), `${b.bay_type || ''}${b.voltage_kv ? ' · ' + b.voltage_kv + ' kV' : ''} · ${b.n_equipment} TB`, C.selBay === b.id)).join('');
    const mains = eqs.filter(e => !e.parent_id);
    const eqItems = mains.map(e => item('equipment', e.id, `${e.class_code} · ${e.serial_no}`, [e.name, e.phase && 'pha ' + e.phase, e.n_sessions + ' lần TN'].filter(Boolean).join(' · '), C.selEq === e.id)
      + eqs.filter(c => c.parent_id === e.id).map(c => item('equipment', c.id, `↳ ${c.class_code} · ${c.serial_no}`, [c.position, c.n_sessions ? c.n_sessions + ' lần TN' : ''].filter(Boolean).join(' · '), C.selEq === c.id, true)).join('')).join('');
    return col(`Trạm (${subs.length})`, 'substations', subItems, 'Trạm')
      + col(`Ngăn lộ (${bays.length})`, 'bays', C.selSub ? bayItems : '<div class="empty">Chọn trạm.</div>', 'Ngăn', !C.selSub)
      + col(`Thiết bị (${mains.length})`, 'equipment', C.selBay ? eqItems : '<div class="empty">Chọn ngăn lộ.</div>', 'Thiết bị', !C.selBay);
  }
  const item = (type, id, title, sub, active, child) => `<button class="cat-item ${active ? 'active' : ''} ${child ? 'child' : ''}" data-cat="select" data-type="${type}" data-id="${id}">
    <span class="t">${esc(title)}</span><span class="s">${esc(sub)}</span></button>`;

  function formHTML() {
    const F = C.form;
    if (!F) return '<div class="hint-text">Chọn một mục để xem/sửa, hoặc bấm “+” để thêm mới.</div>';
    const def = FORMS[F.type], edit = DB.canEdit();
    let h = `<h3>${F.id ? 'Sửa' : 'Thêm'} ${def.title.toLowerCase()}</h3><form id="catFormEl" class="fields" autocomplete="off">`;
    def.fields.forEach(f => {
      const v = F.data[f.k] ?? '';
      const id = `cf_${f.k}`;
      let ctrl;
      if (f.type === 'select') {
        ctrl = `<select id="${id}" name="${f.k}" ${edit ? '' : 'disabled'}>${(f.req ? [] : [['', '']]).concat(f.options()).filter((o, i, a) => a.findIndex(x => x[0] === o[0]) === i)
          .map(([val, t]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
      } else if (f.type === 'textarea') {
        ctrl = `<textarea id="${id}" name="${f.k}" ${edit ? '' : 'readonly'}>${esc(v)}</textarea>`;
      } else {
        const opts = uniq((f.list || []).concat(f.dyn ? f.dyn() : []));
        const dl = opts.length ? `<datalist id="dl_${id}">${opts.map(o => `<option value="${esc(o)}">`).join('')}</datalist>` : '';
        ctrl = `<input id="${id}" name="${f.k}" type="${f.type === 'date' ? 'date' : 'text'}" ${f.type === 'number' ? 'inputmode="decimal"' : ''} value="${esc(v)}"
          ${opts.length ? `list="dl_${id}"` : ''} ${edit ? '' : 'readonly'} ${f.req ? 'required' : ''}>${dl}`;
      }
      h += `<div class="field ${f.type === 'textarea' ? 'wide' : ''}"><label for="${id}">${esc(f.label)}</label>${ctrl}</div>`;
    });
    h += '</form>';
    if (F.type === 'equipment' && F.id) {
      const e = (C.eqs || []).find(x => x.id === F.id);
      if (e) h += `<div class="callout">${esc(e.class_name || '')} · ${e.n_sessions} lần thí nghiệm trong CSDL${Object.keys(e.rated || {}).length ? ` · Thông số: ${esc(Object.entries(e.rated).filter(([, x]) => x !== null && x !== '').map(([k, x]) => `${k}=${x}`).join('; '))}` : ''}
        <div class="row-actions"><button class="btn small" data-act="dbTrendOf" data-eq="${e.parent_id || e.id}">Xem xu hướng</button></div></div>`;
    }
    if (edit) {
      h += `<div class="row-actions"><button class="btn primary" data-cat="save">${F.id ? 'Lưu thay đổi' : 'Thêm mới'}</button>
        <button class="btn" data-cat="cancel">Hủy</button>${F.id ? '<button class="btn danger" data-cat="delete">Xóa</button>' : ''}</div>`;
    }
    return h;
  }

  function refresh() {
    const c = $('#catCols'); if (c) c.innerHTML = colsHTML();
    const f = $('#catForm'); if (f) f.innerHTML = formHTML();
  }

  function readForm() {
    const def = FORMS[C.form.type], out = {};
    for (const f of def.fields) {
      let v = $(`#cf_${f.k}`).value.trim();
      if (f.req && !v) throw new Error(`Chưa nhập “${f.label.replace(' *', '')}”`);
      if (f.type === 'number') {
        if (v === '') v = null;
        else { const n = Number(v.replace(',', '.')); if (!Number.isFinite(n)) throw new Error(`“${f.label}” phải là số`); v = n; }
      } else if (v === '') v = null;
      out[f.k] = v;
    }
    return out;
  }

  // ------------------------------------------------------------------ hành động
  async function onClick(e) {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    const act = b.dataset.cat, type = b.dataset.type;
    try {
      if (act === 'select') {
        const list = type === 'substations' ? C.subs : type === 'bays' ? C.bays : C.eqs;
        const row = list.find(x => x.id === b.dataset.id);
        if (type === 'substations') { C.selSub = row.id; C.selBay = ''; C.selEq = ''; }
        if (type === 'bays') { C.selBay = row.id; C.selEq = ''; }
        if (type === 'equipment') C.selEq = row.id;
        C.form = { type, id: row.id, data: Object.assign({}, row) };
      } else if (act === 'add') {
        const data = type === 'bays' ? { substation_id: C.selSub, status: 'in_service' }
          : type === 'equipment' ? { bay_id: C.selBay, class_code: 'MBA', status: 'in_service' } : {};
        C.form = { type, id: null, data };
      } else if (act === 'cancel') {
        C.form = null;
      } else if (act === 'save') {
        const data = readForm();
        if (C.form.type === 'equipment' && C.form.id && data.parent_id === C.form.id) throw new Error('Thiết bị không thể thuộc chính nó');
        const saved = C.form.id ? (await DB.crud('update', C.form.type, data, C.form.id))[0] : await DB.crud('insert', C.form.type, data);
        App.toast(C.form.id ? 'Đã lưu thay đổi' : 'Đã thêm mới');
        await load(true);
        if (C.form.type === 'substations') C.selSub = saved.id;
        if (C.form.type === 'bays') { C.selSub = saved.substation_id; C.selBay = saved.id; }
        if (C.form.type === 'equipment') { const r = C.eqs.find(x => x.id === saved.id); if (r) { C.selSub = r.substation_id; C.selBay = r.bay_id; C.selEq = r.id; } }
        const list = C.form.type === 'substations' ? C.subs : C.form.type === 'bays' ? C.bays : C.eqs;
        const row = list.find(x => x.id === saved.id);
        C.form = row ? { type: C.form.type, id: row.id, data: Object.assign({}, row) } : null;
      } else if (act === 'delete') {
        const def = FORMS[C.form.type];
        if (!confirm(`Xóa ${def.title.toLowerCase()} này? Chỉ xóa được khi không còn dữ liệu phụ thuộc.`)) return;
        await DB.crud('delete', C.form.type, null, C.form.id);
        App.toast('Đã xóa');
        if (C.form.type === 'substations') C.selSub = '';
        if (C.form.type === 'bays') C.selBay = '';
        C.selEq = ''; C.form = null;
        await load(true);
      }
      refresh();
      if (act === 'select' || act === 'add') { const f = $('#catForm'); if (f) f.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    } catch (err) { App.toast(err.message, true); }
  }

  // Đổi ngăn trong form thiết bị → cập nhật danh sách thiết bị cha
  function onChange(e) {
    if (e.target.id === 'cf_bay_id' && C.form) {
      C.form.data = Object.assign(C.form.data, readFormLoose(), { bay_id: e.target.value, parent_id: '' });
      const f = $('#catForm'); if (f) f.innerHTML = formHTML();
    }
  }
  function readFormLoose() {
    const out = {};
    FORMS[C.form.type].fields.forEach(f => { const el = $(`#cf_${f.k}`); if (el) out[f.k] = el.value; });
    return out;
  }

  async function afterRender() {
    if (!DB.user) return;
    await load(false);
    refresh();
  }

  // Chọn trạm/ngăn để gắn thiết bị khi lưu biên bản hoặc nhập Test report
  function bayPickerHTML() {
    if (!C.subs) return '<div class="empty">Đang tải danh mục…</div>';
    const cur = App.state.cfg.bayId || '';
    const bay = (C.bays || []).find(b => b.id === cur);
    const sub = bay ? bay.substation_id : (App.state.cfg.pickSub || C.selSub || '');
    return `<div class="fields"><div class="field"><label for="pkSub">Trạm</label><select id="pkSub"><option value=""></option>${(C.subs || []).map(s => `<option value="${s.id}" ${s.id === sub ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="pkBay">Ngăn lộ</label><select id="pkBay"><option value=""></option>${(C.bays || []).filter(b => b.substation_id === sub).map(b => `<option value="${b.id}" ${b.id === cur ? 'selected' : ''}>${esc(b.code)}${b.name ? ' – ' + esc(b.name) : ''}</option>`).join('')}</select></div>
      <div class="field"><label>&nbsp;</label><button class="btn" data-act="dbGoCatalog">Quản lý danh mục…</button></div></div>`;
  }
  function bindBayPicker() {
    const s = $('#pkSub'), b = $('#pkBay');
    if (!s) return;
    s.onchange = () => { App.state.cfg.pickSub = s.value; App.state.cfg.bayId = ''; App.persist(); const w = $('#bayPicker'); if (w) { w.innerHTML = bayPickerHTML(); bindBayPicker(); } };
    b.onchange = () => { App.state.cfg.bayId = b.value; App.persist(); };
  }

  document.addEventListener('click', e => { if (e.target.closest('[data-cat]')) onClick(e); });
  document.addEventListener('change', onChange);

  window.Catalog = { render, afterRender, load, bayPickerHTML, bindBayPicker, get data() { return C; }, reset() { C.subs = null; C.form = null; } };
})();
