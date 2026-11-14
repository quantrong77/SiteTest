// Trang quản lý thư viện tài liệu; giao tiếp CSDL chỉ qua DB.
(function () {
  'use strict';
  const KEY = 'bbtn-mba.library', esc = s => App.esc(s);
  const S = { docs: [], loaded: false, offline: false, edit: null, filter: { kind: '', equipment_group: '', status: '', q: '' } };
  const kindName = { standard: 'Tiêu chuẩn', procedure: 'Quy trình của đơn vị', manual: 'Hướng dẫn máy đo' };
  const statusName = { have: 'Đã có', old: 'Đã có bản cũ', searching: 'Đang tìm', missing: 'Còn thiếu' };
  const cache = () => { try { localStorage.setItem(KEY, JSON.stringify(S.docs)); } catch (_) { /* cache tùy chọn */ } };
  async function load(force) {
    if (!DB.user) return;
    if (!force && S.loaded) return;
    try { S.docs = await DB.listLibrary(); S.loaded = true; S.offline = false; cache(); }
    catch (e) {
      // mất mạng / chưa chạy migration: xem bản lưu tạm (chỉ đọc), báo rõ
      try { S.docs = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { S.docs = []; }
      S.offline = true; S.loaded = true;
      const noTable = /library_docs|relation|schema cache/i.test(e.message || '');
      App.toast(noTable ? 'Thư viện tài liệu: chưa chạy migration 20261114000700 trên Supabase.'
        : `Không tải được thư viện tài liệu (${e.message})${S.docs.length ? ' — đang xem bản lưu tạm trên máy này' : ''}.`, true);
    }
  }
  const val = (d, k) => esc(d[k] || '');
  function filtered() {
    const f = S.filter, q = f.q.toLocaleLowerCase('vi');
    return S.docs.filter(d => (!f.kind || d.kind === f.kind) && (!f.equipment_group || d.equipment_group === f.equipment_group) && (!f.status || d.status === f.status)
      && (!q || [d.code, d.edition, d.title, d.scope, d.tcvn].some(x => String(x || '').toLocaleLowerCase('vi').includes(q))));
  }
  function render() {
    if (!DB.client) return '<section class="panel"><div class="panel-head"><span class="secno">TV</span><h2>Thư viện tài liệu</h2></div><div class="callout warn">Chưa cấu hình CSDL: cần cấu hình URL Supabase và anon key trong triển khai ứng dụng trước khi sử dụng thư viện.</div></section>';
    if (!DB.user || DB.role === 'none') return '<section class="panel"><div class="panel-head"><span class="secno">TV</span><h2>Thư viện tài liệu</h2></div><div class="callout warn">Cần đăng nhập tài khoản đã được cấp quyền xem tài liệu.</div></section>';
    const groups = [...new Set(S.docs.map(d => d.equipment_group).filter(Boolean))];
    let h = '<div class="panel-head"><span class="secno">TV</span><h2>Thư viện tài liệu</h2><span class="en">Tài liệu đơn vị</span></div>';
    h += `<div class="lib-filters"><label class="field"><span>Loại tài liệu</span><select data-lib-filter="kind"><option value="">Tất cả</option>${Object.entries(kindName).map(([k,v]) => `<option value="${k}" ${S.filter.kind===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="field"><span>Nhóm thiết bị</span><select data-lib-filter="equipment_group"><option value="">Tất cả</option>${groups.map(x => `<option ${S.filter.equipment_group===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label class="field"><span>Trạng thái</span><select data-lib-filter="status"><option value="">Tất cả</option>${Object.entries(statusName).map(([k,v]) => `<option value="${k}" ${S.filter.status===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="field"><span>Tìm tài liệu</span><input data-lib-filter="q" value="${esc(S.filter.q)}" placeholder="Số hiệu, tên, nội dung…"></label></div>`;
    if (S.offline) h += '<div class="callout warn">Đang xem bản lưu tạm trên máy này (không tải được từ CSDL). Thêm, sửa, xóa tạm khóa cho đến khi kết nối lại.</div>';
    if (DB.role === 'admin' && !S.offline) h += '<div class="row-actions"><button class="btn primary" data-lib-act="new">Thêm tài liệu</button><button class="btn" data-lib-act="excel">Nhập danh mục từ Excel…</button><input type="file" accept=".xlsx,.xlsm" data-lib-excel hidden></div>';
    h += '<div class="grid-wrap"><table class="ftable"><thead><tr><th>Số hiệu / phiên bản</th><th>Tên tài liệu</th><th>Hạng mục</th><th>Trạng thái</th><th></th></tr></thead><tbody>';
        h += filtered().map(d => {
      const sectionNames = (d.sections || []).map(id => { const x = (App.schema.sections || []).find(s => s.id === id); return x ? `${x.no}. ${x.title}` : ''; }).filter(Boolean).join(', ') || d.equipment_group || 'Chung';
      return `<tr><td>${val(d, 'code')}<br>${val(d, 'edition')}</td><td>${val(d, 'title')}${d.summary_md ? ` <button class="btn small" data-lib-act="summary" data-id="${esc(d.id)}" aria-label="Xem tóm tắt ${esc(d.title)}">Tóm tắt</button>` : ''}</td><td>${esc(sectionNames)}</td><td><span class="badge st-${d.status === 'have' ? 'pass' : d.status === 'old' ? 'warn' : 'missing'}">${statusName[d.status] || ''}</span></td><td class="row-actions">${d.file_path ? `<button class="btn small" data-lib-act="open" data-id="${esc(d.id)}" aria-label="Mở file ${esc(d.title)}">Mở file</button>` : ''}${DB.role === 'admin' ? `<button class="btn small" data-lib-act="edit" data-id="${esc(d.id)}" aria-label="Sửa ${esc(d.title)}">Sửa</button><button class="btn small danger" data-lib-act="delete" data-id="${esc(d.id)}" aria-label="Xóa ${esc(d.title)}">Xóa</button>` : ''}</td></tr>`;
    }).join('') || '<tr><td colspan="5">Chưa có tài liệu phù hợp.</td></tr>';    return `<section class="panel">${h}</tbody></table></div>${S.edit ? formHTML() : ''}</section>`;
  }
  function formHTML() {
    const d = S.edit, sections = App.schema.sections || [];
    const field = (k, label, type = 'text') => `<label class="field"><span>${label}</span><input data-lib-field="${k}" type="${type}" value="${val(d, k)}"></label>`;
    const kinds = Object.entries(kindName).map(([k, v]) => `<option value="${k}" ${d.kind === k ? 'selected' : ''}>${v}</option>`).join('');
    const sectionChecks = sections.map(x => `<label><input type="checkbox" data-lib-section="${esc(x.id)}" ${(d.sections || []).includes(x.id) ? 'checked' : ''}> ${esc(x.no)}. ${esc(x.title)}</label>`).join('');
    const codes = ['MBA'].map(x => `<label><input type="checkbox" data-lib-class="${x}" ${(d.class_codes || []).includes(x) ? 'checked' : ''}> ${x}</label>`).join('');
    return `<div class="lib-form"><h3>${d.id ? 'Sửa tài liệu' : 'Thêm tài liệu'}</h3><div class="lib-fields">
      <label class="field"><span>Loại</span><select data-lib-field="kind">${kinds}</select></label>
      <label class="field"><span>Trạng thái</span><select data-lib-field="status">${Object.entries(statusName).map(([k, v]) => `<option value="${k}" ${d.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      ${field('code', 'Số hiệu')}${field('edition', 'Phiên bản / năm')}${field('title', 'Tên tài liệu')}${field('equipment_group', 'Nhóm thiết bị')}${field('priority', 'Ưu tiên', 'number')}${field('tcvn', 'TCVN tương đương')}
      <label class="field"><span>Nội dung chính</span><input data-lib-field="scope" value="${val(d, 'scope')}"></label>
      <label class="field"><span>Tóm tắt Markdown</span><textarea data-lib-field="summary_md">${val(d, 'summary_md')}</textarea></label>
      <label class="field"><span>Ghi chú</span><input data-lib-field="note" value="${val(d, 'note')}"></label></div>
      <fieldset><legend>Loại thiết bị áp dụng</legend>${codes}</fieldset><fieldset><legend>Hạng mục</legend>${sectionChecks}</fieldset>
      <label class="field"><span>Tệp tài liệu</span><input type="file" data-lib-file accept=".pdf,.doc,.docx,.xlsx,.xls"></label>
      <div class="row-actions"><button class="btn primary" data-lib-act="save">Lưu tài liệu</button><button class="btn" data-lib-act="cancel">Hủy</button></div></div>`;
  }  async function afterRender() { if (!S.loaded && DB.user) { await load(false); App.renderMain(); } }
  async function openDoc(d) { const popup=window.open('', '_blank'); if(!popup) throw new Error('Trình duyệt đã chặn cửa sổ mở tài liệu.'); await Workflow.openLibraryFile(d,popup); }
  async function action(e) {
    const b=e.target.closest('[data-lib-act]'); if(!b)return; const act=b.dataset.libAct, d=S.docs.find(x=>x.id===b.dataset.id);
    try {
      if(act==='new') S.edit={kind:'standard',status:'missing',priority:1,sections:[],class_codes:['MBA']};
      else if(act==='cancel') S.edit=null;
      else if(act==='edit') S.edit=JSON.parse(JSON.stringify(d));
      else if(act==='summary') { const box=document.createElement('div'); box.className='lib-summary'; box.textContent=d.summary_md; b.after(box); b.disabled=true; }
      else if(act==='open') await openDoc(d);
      else if(act==='excel') { document.querySelector('[data-lib-excel]').click(); return; }
      else if(act==='delete') { if(!confirm(`Xóa “${d.title}” và file đã tải lên?`))return; await DB.deleteLibraryDoc(d.id); S.docs=S.docs.filter(x=>x.id!==d.id); cache(); }
      else if(act==='save') {
        if(DB.role!=='admin')throw new Error('Cần quyền Admin để lưu tài liệu.'); if(S.offline)throw new Error('Đang xem bản lưu tạm — kết nối lại CSDL rồi lưu.');
        const row=Object.assign({},S.edit); document.querySelectorAll('[data-lib-field]').forEach(x=>row[x.dataset.libField]=x.value.trim());
        row.priority=Number(row.priority)||1; row.sections=Array.from(document.querySelectorAll('[data-lib-section]:checked')).map(x=>x.dataset.libSection); row.class_codes=Array.from(document.querySelectorAll('[data-lib-class]:checked')).map(x=>x.dataset.libClass);
        if(!row.title)throw new Error('Nhập tên tài liệu trước khi lưu.');
        const saved=await DB.saveLibraryDoc(row); const file=document.querySelector('[data-lib-file]').files[0]; if(file) await DB.uploadLibraryFile(saved.id,file);
        S.edit=null; S.loaded=false; await load(true);
      }
      App.renderMain();
    } catch(err){App.toast('Thư viện tài liệu: '+err.message,true);}
  }
  document.addEventListener('click', action);
  document.addEventListener('change', async event => {
    const target = event.target;
    if (target.matches('[data-lib-filter]')) {
      S.filter[target.dataset.libFilter] = target.value;
      App.renderMain();
      return;
    }
    if (!target.matches('[data-lib-excel]') || !target.files[0]) return;
    try {
      const workbook = XLSX.read(await target.files[0].arrayBuffer());
      const sheet = workbook.Sheets['Danh muc'];
      if (!sheet) throw new Error('Không tìm thấy sheet “Danh muc”.');
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const incoming = Library.parseCatalog(rows);
      const result = Library.mergeImport(S.docs, incoming, App.schema.sections || []);
      if (!confirm(`Xem trước ${result.rows.length} dòng: ${result.added} thêm mới, ${result.updated} cập nhật, ${result.unchanged} không đổi${result.duplicates ? `, ${result.duplicates} dòng trùng số hiệu (lấy dòng sau)` : ''}. Chỉ ghi các dòng có thay đổi. Tiếp tục?`)) return;
      const changed = result.rows.filter(row => !S.docs.some(old => old.id === row.id && JSON.stringify(old) === JSON.stringify(row)));
      for (const row of changed) await DB.saveLibraryDoc(row);
      S.loaded = false;
      await load(true);
      App.renderMain();
    } catch (err) {
      App.toast('Không nhập được danh mục: ' + err.message, true);
    }
  });

  window.StandardsUI = {
    render,
    afterRender,
    load,
    reset() { S.loaded = false; },
    get docs() { return S.docs; },
  };
})();