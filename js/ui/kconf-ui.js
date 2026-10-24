// Cấu hình bảng hệ số quy đổi tgδ sứ xuyên về 20 °C (QĐ 1901 và theo hãng). Chỉ admin được thêm/sửa/xóa.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => App.esc(s);
  const TYPES = ['OIP', 'RIP', 'RIS', 'RBP', 'GIF'];

  const K = { sel: null, form: null, loading: false, loaded: false };
  const isAdmin = () => typeof DB !== 'undefined' && DB.role === 'admin';
  const num = v => { const s = String(v ?? '').trim().replace(',', '.'); return s === '' ? null : Number(s); };
  const fmtK = v => (v === null || v === undefined || v === '' ? '' : String(v).replace('.', ','));
  const clone = t => JSON.parse(JSON.stringify(t));

  async function load(force) {
    if (K.loading || (K.loaded && !force)) return;
    K.loading = true;
    try {
      if (await BushingKRepo.load()) App.rebuild(true);
      K.loaded = true;
    } catch (e) { App.toast('Lỗi tải bảng hệ số sứ: ' + e.message, true); }
    finally { K.loading = false; }
  }

  // ------------------------------------------------------------------ render
  function render() {
    let h = '<div class="panel-head"><span class="secno">K</span><h2>Hệ số quy đổi tgδ sứ về 20 °C</h2><span class="en">Bushing tgδ correction</span></div>';
    const src = { db: 'CSDL', cache: 'bản sao lưu trên máy (lần tải gần nhất từ CSDL)', builtin: 'bảng QĐ 1901 có sẵn trong app' }[BushingK.source];
    h += `<div class="callout">Mục 5 “Cách quy đổi về 20 °C” chọn được: theo HD Hitachi, <b>theo QĐ 1901</b>, <b>theo bảng của hãng</b> cấu hình ở đây, hoặc nhập K.
      Bảng K tra theo loại cách điện sứ và nhiệt độ sứ (sứ đã lắp: nhiệt độ dầu MBA – Điều 38; sứ chưa lắp: nhiệt độ môi trường). Đang dùng: ${esc(src)}.</div>`;
    if (!DB.user) h += '<div class="callout warn">Chưa đăng nhập: chỉ xem. Đăng nhập tài khoản Admin để thêm, sửa bảng hệ số.</div>';
    else if (!isAdmin()) h += '<div class="callout warn">Tài khoản của bạn chỉ được xem. Thêm, sửa bảng hệ số cần quyền Admin.</div>';
    h += `<div class="k-layout"><div class="k-list" id="kList">${listHTML()}</div><div class="k-edit" id="kEdit">${formHTML()}</div></div>`;
    return `<section class="panel">${h}</section>`;
  }

  function listHTML() {
    const items = BushingK.all().map(t => `<button class="cat-item ${K.sel === t.id ? 'active' : ''}" data-kc="select" data-id="${esc(t.id)}">
      <span class="t">${esc(t.name)}</span><span class="s">${t.basis === 'QD1901' ? 'QĐ 1901' : 'Theo hãng' + (t.manufacturer ? ': ' + esc(t.manufacturer) : '')}
      · ${esc(t.columns.join(', '))} · ${t.rows.length} dòng${t.active === false ? ' · đang tắt' : ''}</span></button>`).join('');
    return `<div class="cat-col-head"><b>Bảng hệ số (${BushingK.all().length})</b>${isAdmin() ? '<button class="btn small" data-kc="add">+ Bảng theo hãng</button>' : ''}</div>
      <div class="cat-list">${items}</div>`;
  }

  function formHTML() {
    const F = K.form;
    if (!F) return '<div class="hint-text">Chọn một bảng để xem chi tiết.</div>';
    const ed = isAdmin(), ro = ed ? '' : 'disabled';
    const sel = (id, opts, v) => `<select id="${id}" ${ro}>${opts.map(([val, t]) => `<option value="${val}" ${val === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    let h = `<h3>${F.id ? esc(F.name) : 'Bảng mới'}</h3><div class="fields">
      <div class="field"><label for="kf_name">Tên bảng</label><input id="kf_name" value="${esc(F.name)}" ${ro}></div>
      <div class="field"><label for="kf_basis">Căn cứ</label>${sel('kf_basis', [['QD1901', 'QĐ 1901'], ['MANUFACTURER', 'Theo hãng sứ']], F.basis)}</div>
      <div class="field"><label for="kf_mfr">Hãng sứ</label><input id="kf_mfr" value="${esc(F.manufacturer || '')}" list="dlKMfr" ${ro}>
        <datalist id="dlKMfr">${['Hitachi Energy', 'ABB', 'Siemens Energy', 'GE Vernova', 'Trench', 'HSP', 'Nanjing Electric', 'Xi\'an XD', 'Passoni & Villa', 'Hyosung'].map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="field"><label for="kf_cols">Loại cách điện (thứ tự cột K)</label><input id="kf_cols" value="${esc(F.columns.join(', '))}" list="dlKTypes" ${ro}>
        <datalist id="dlKTypes">${TYPES.map(x => `<option value="${x}">`).join('')}</datalist></div>
      <div class="field"><label for="kf_formula">Công thức quy đổi</label>${sel('kf_formula', [['MUL', 'tgδ20 = tgδ(t) × K'], ['DIV', 'tgδ20 = tgδ(t) ÷ K']], F.formula)}</div>
      <div class="field"><label for="kf_lookup">Cách tra nhiệt độ</label>${sel('kf_lookup', [['NEAREST', 'Dòng gần nhất (bảng theo từng °C)'], ['LINEAR', 'Nội suy tuyến tính giữa hai dòng']], F.lookup)}</div>
      <div class="field"><label for="kf_active">Trạng thái</label>${sel('kf_active', [['1', 'Đang dùng'], ['0', 'Tắt (không hiện ở mục 5)']], F.active === false ? '0' : '1')}</div>
      <div class="field wide"><label for="kf_note">Ghi chú / nguồn</label><input id="kf_note" value="${esc(F.note || '')}" ${ro}></div></div>`;
    h += `<div class="grid-wrap k-grid"><table class="grid"><thead><tr><th>t (°C)</th>${F.columns.map(c => `<th>K – ${esc(c)}</th>`).join('')}${ed ? '<th></th>' : ''}</tr></thead><tbody>`;
    F.rows.forEach((r, i) => {
      h += `<tr><td><input data-kr="${i}" data-kcol="0" value="${fmtK(r[0])}" inputmode="decimal" ${ed ? '' : 'readonly'}></td>`;
      F.columns.forEach((c, j) => { h += `<td><input data-kr="${i}" data-kcol="${j + 1}" value="${fmtK(r[j + 1])}" inputmode="decimal" ${ed ? '' : 'readonly'}></td>`; });
      if (ed) h += `<td class="k-del"><button class="row-del" data-kc="delRow" data-i="${i}" title="Xóa dòng" aria-label="Xóa dòng">×</button></td>`;
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    if (ed) {
      h += `<div class="row-actions"><button class="btn small" data-kc="addRow">+ Thêm dòng</button><button class="btn small" data-kc="import">Nhập từ Excel…</button></div>
        <div class="hint-text">File Excel: cột 1 là nhiệt độ (°C), các cột sau là hệ số K; tên loại sứ lấy từ tiêu đề cột (vd “Correction to 20°C OIP”). Nhập sẽ thay toàn bộ các dòng của bảng đang sửa.</div>
        <div class="row-actions"><button class="btn primary" data-kc="save">${F.id && !F.builtin ? 'Lưu thay đổi' : 'Lưu vào CSDL'}</button><button class="btn" data-kc="cancel">Hủy</button>
        ${F.id && !F.builtin ? '<button class="btn danger" data-kc="delete">Xóa bảng</button>' : ''}</div>`;
    }
    return h;
  }

  function refresh() {
    const l = $('#kList'); if (l) l.innerHTML = listHTML();
    const f = $('#kEdit'); if (f) f.innerHTML = formHTML();
  }

  // Đọc form vào K.form (không kiểm tra), giữ số liệu đang gõ khi thêm/xóa dòng
  function readLoose() {
    const F = K.form;
    if (!F || !$('#kf_name')) return;
    F.name = $('#kf_name').value.trim();
    F.basis = $('#kf_basis').value;
    F.manufacturer = $('#kf_mfr').value.trim() || null;
    F.formula = $('#kf_formula').value;
    F.lookup = $('#kf_lookup').value;
    F.active = $('#kf_active').value === '1';
    F.note = $('#kf_note').value.trim() || null;
    $$('[data-kr]').forEach(el => { const r = F.rows[+el.dataset.kr]; if (r) r[+el.dataset.kcol] = el.value.trim(); });
    const cols = $('#kf_cols').value.split(/[,;]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
    if (cols.length && cols.join() !== F.columns.join()) {
      // đổi danh sách cột: giữ K của cột cùng tên
      F.rows = F.rows.map(r => [r[0]].concat(cols.map(c => { const j = F.columns.indexOf(c); return j >= 0 ? r[j + 1] : ''; })));
      F.columns = cols;
    }
  }

  function validated() {
    readLoose();
    const F = K.form;
    if (!F.name) throw new Error('Chưa nhập tên bảng');
    if (!F.columns.length) throw new Error('Chưa khai báo loại cách điện (cột K)');
    if (new Set(F.columns).size !== F.columns.length) throw new Error('Loại cách điện bị trùng');
    if (F.basis === 'MANUFACTURER' && !F.manufacturer) throw new Error('Bảng theo hãng cần nhập tên hãng sứ');
    const rows = F.rows.map((r, i) => {
      const t = num(r[0]);
      if (!Number.isFinite(t)) throw new Error(`Dòng ${i + 1}: nhiệt độ không hợp lệ`);
      return [t].concat(F.columns.map((c, j) => {
        const k = num(r[j + 1]);
        if (k === null) return null;
        if (!Number.isFinite(k) || k <= 0) throw new Error(`Dòng ${i + 1}, cột ${c}: K phải là số dương`);
        return k;
      }));
    }).sort((a, b) => a[0] - b[0]);
    if (!rows.length) throw new Error('Bảng chưa có dòng số liệu');
    rows.forEach((r, i) => { if (i && r[0] === rows[i - 1][0]) throw new Error(`Nhiệt độ ${r[0]} °C bị trùng`); });
    const clash = BushingK.all().find(t => t.name === F.name && t.id !== F.id && !t.builtin);
    if (clash) throw new Error('Đã có bảng cùng tên');
    return { name: F.name, basis: F.basis, manufacturer: F.basis === 'QD1901' ? null : F.manufacturer, columns: F.columns, rows,
      formula: F.formula, lookup: F.lookup, active: F.active, note: F.note };
  }

  function pickXlsx() {
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.xlsx,.xls';
      inp.onchange = () => resolve(inp.files[0] || null);
      inp.click();
    });
  }

  async function onClick(e) {
    const b = e.target.closest('[data-kc]');
    if (!b) return;
    const act = b.dataset.kc;
    try {
      if (act === 'select') {
        const t = BushingK.all().find(x => x.id === b.dataset.id);
        K.sel = t.id; K.form = clone(t);
      } else if (act === 'add') {
        K.sel = null;
        K.form = { id: null, name: '', basis: 'MANUFACTURER', manufacturer: '', columns: ['OIP', 'RIP'], rows: [[20, 1, 1]], formula: 'MUL', lookup: 'LINEAR', active: true, note: '' };
      } else if (act === 'cancel') {
        K.form = K.sel ? clone(BushingK.all().find(x => x.id === K.sel)) : null;
      } else if (act === 'addRow') {
        readLoose();
        const last = K.form.rows[K.form.rows.length - 1];
        K.form.rows.push([last && Number.isFinite(num(last[0])) ? num(last[0]) + 1 : 20].concat(K.form.columns.map(() => '')));
      } else if (act === 'delRow') {
        readLoose();
        K.form.rows.splice(+b.dataset.i, 1);
      } else if (act === 'import') {
        readLoose();
        const f = await pickXlsx();
        if (!f) return;
        const t = BushingK.fromArrayBuffer(await f.arrayBuffer());
        K.form.columns = t.columns; K.form.rows = t.rows;
        if (!K.form.name) K.form.name = f.name.replace(/\.xlsx?$/i, '');
        App.toast(`Đã đọc ${t.rows.length} dòng, cột ${t.columns.join(', ')} từ ${f.name} — kiểm tra rồi bấm Lưu`);
      } else if (act === 'save') {
        if (!isAdmin()) throw new Error('Cần quyền Admin');
        const data = validated();
        const saved = K.form.id && !K.form.builtin
          ? (await DB.crud('update', 'bushing_k_tables', data, K.form.id))[0]
          : await DB.crud('insert', 'bushing_k_tables', data);
        await load(true);
        K.sel = saved.id; K.form = clone(BushingK.all().find(x => x.id === saved.id) || saved);
        App.toast('Đã lưu bảng hệ số ' + saved.name);
      } else if (act === 'delete') {
        if (!confirm(`Xóa bảng “${K.form.name}”? Biên bản đang chọn bảng này ở mục 5 sẽ không quy đổi được nữa.`)) return;
        await DB.crud('delete', 'bushing_k_tables', null, K.form.id);
        K.sel = null; K.form = null;
        await load(true);
        App.toast('Đã xóa bảng hệ số');
      }
      refresh();
    } catch (err) { App.toast(err.message, true); }
  }

  async function afterRender() {
    if (!K.form) { const t = BushingK.qd1901(); K.sel = t.id; K.form = clone(t); refresh(); }
    if (DB.user && !K.loaded) {
      await load(false);
      if (K.sel && !BushingK.all().some(t => t.id === K.sel)) { const t = BushingK.qd1901(); K.sel = t.id; K.form = clone(t); }
      refresh();
    }
  }

  document.addEventListener('click', e => { if (e.target.closest('[data-kc]')) onClick(e); });

  window.KConf = { render, afterRender, load, reset() { K.loaded = false; K.form = null; K.sel = null; } };
})();
