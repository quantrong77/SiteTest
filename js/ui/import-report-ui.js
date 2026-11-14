// Trang "Nhập BBTN cũ": chọn nhiều file .docx (hoặc cả thư mục) đã điền số liệu theo các mẫu app hỗ trợ → đọc thành biên bản,
// bảng soát (mẫu, số chế tạo, ngày, số ô đọc được, cảnh báo) → mở từng biên bản để kiểm tra, hoặc lưu thẳng vào CSDL làm chuỗi
// xu hướng (nguồn "manual", kèm file gốc). Đọc file ngay trong trình duyệt; CSDL chỉ qua Records / DB.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  // items: [{ id, file, blob, layout, state, count, warnings, error, saved: { id } }]
  let items = [], busy = false;
  const LAYOUT_NAME = { '1P': 'MBA 500 kV theo pha', '3P': 'MBA 500 kV chung 3 pha', '110': 'MBA 3 pha 110–220 kV' };

  function render(A) {
    const esc = A.esc;
    let h = '<div class="panel-head"><span class="secno">NB</span><h2>Nhập BBTN cũ</h2><span class="en">Import issued reports</span></div>';
    h += `<p class="hint-text">Chọn các BBTN đã ban hành (.docx) theo mẫu ${Object.values(LAYOUT_NAME).join(', ')}. App đọc số liệu theo đúng vị trí ô của mẫu,
      tính lại đánh giá; anh/chị soát rồi lưu vào CSDL để có chuỗi xu hướng theo thiết bị. File chỉ được đọc trên máy này cho đến khi lưu CSDL.</p>`;
    h += `<div class="row-actions"><button class="btn primary" data-act="impFiles">Chọn file .docx…</button><button class="btn" data-act="impFolder">Chọn cả thư mục…</button>
      ${items.length ? '<button class="btn" data-act="impClear">Xóa danh sách</button>' : ''}
      ${items.some(ok) ? `<button class="btn primary" data-act="impSaveAll"${busy ? ' disabled' : ''}>Lưu các biên bản hợp lệ vào CSDL (${items.filter(ok).length})</button>` : ''}</div>`;
    if (!items.length) return `<section class="panel">${h}<p class="wf-none">Chưa chọn file nào.</p></section>`;
    h += '<div class="grid-wrap"><table class="ftable"><thead><tr><th>File</th><th>Mẫu</th><th>Số chế tạo</th><th>Ngày TN</th><th>Lý do</th><th>Ô đọc được</th><th>Soát</th><th></th></tr></thead><tbody>';
    h += items.map(it => {
      if (it.error) return `<tr><td>${esc(it.file)}</td><td colspan="6"><span class="badge st-fail">Lỗi</span> ${esc(it.error)}</td><td><button class="btn small" data-act="impDel" data-id="${it.id}" aria-label="Bỏ ${esc(it.file)}">Bỏ</button></td></tr>`;
      const v = it.state.v;
      const warn = it.warnings.length ? `<span class="badge st-warn">Cần xem</span> ${it.warnings.map(esc).join('<br>')}` : '<span class="badge st-pass">Đủ thông tin</span>';
      const saved = it.saved ? '<span class="badge st-pass">Đã lưu CSDL</span>' : '';
      return `<tr><td>${esc(it.file)}</td><td>${esc(LAYOUT_NAME[it.layout] || it.layout)}</td><td>${esc(v['meta.serial'] || '—')}</td><td>${esc(v['meta.date'] || '—')}</td>
        <td>${esc(v['meta.reason'] || '—')}</td><td>${it.count}</td><td>${warn} ${saved}</td>
        <td class="row-actions"><button class="btn small" data-act="impOpen" data-id="${it.id}">Mở để soát</button>
        ${ok(it) ? `<button class="btn small" data-act="impSave" data-id="${it.id}"${busy ? ' disabled' : ''}>Lưu CSDL</button>` : ''}
        <button class="btn small" data-act="impDel" data-id="${it.id}" aria-label="Bỏ ${esc(it.file)}">Bỏ</button></td></tr>`;
    }).join('');
    return `<section class="panel">${h}</tbody></table></div></section>`;
  }
  // lưu được khi đọc được số chế tạo và ngày, chưa lưu
  const ok = it => !it.error && !it.saved && String(it.state.v['meta.serial'] || '').trim() && Common.isoDate(it.state.v['meta.date']);

  async function readFiles(files, A) {
    const docx = Array.from(files || []).filter(f => /\.docx$/i.test(f.name) && !/^~\$/.test(f.name));
    if (!docx.length) { A.toast('Không có file .docx trong lựa chọn', true); return; }
    let n = 0;
    for (const f of docx) {
      const it = { id: 'imp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), file: f.webkitRelativePath || f.name, blob: f };
      try {
        const tpl = await DocxTemplate.load(await f.arrayBuffer());
        const T = EquipmentTypes.get('MBA');
        Object.assign(it, T.importReport(tpl, f.name));
        n++;
      } catch (e) { it.error = e.message; }
      items.push(it);
    }
    A.render();
    A.toast(`Đã đọc ${n}/${docx.length} file BBTN — soát bảng rồi lưu CSDL`);
  }

  // Đánh giá lại biên bản nhập (dùng file xuất xưởng đang nạp nếu có đúng máy này)
  function evalOf(it, A) {
    const T = EquipmentTypes.get('MBA');
    const schema = T.buildSchema(it.state.cfg);
    const FX = A.FX && A.FX.unit && A.FX.unit(it.state.v['meta.serial']) ? A.FX : null;
    return { schema, res: T.evaluate(it.state, FX, schema) };
  }

  async function save(it, A) {
    const { schema, res } = evalOf(it, A);
    const r = await Records.saveField(it.state, res, schema, 'final');
    it.saved = { id: r.id };
    // giữ file gốc cùng lần thí nghiệm (Storage); lỗi tải file không làm hỏng lần lưu
    try {
      await DB.uploadDoc(r.id, r.equipmentId, 'BBTN_DOCX', `${it.state.v['meta.serial']}/${r.id}/imported/${it.blob.name}`, it.blob.name, it.blob);
    } catch (e) { A.toast(`${it.file}: đã lưu số liệu, chưa lưu được file gốc (${e.message})`, true); }
    return r;
  }

  async function action(act, b, A) {
    const it = items.find(x => x.id === (b && b.dataset.id));
    if (act === 'impFiles') { $('#fileImpDocx').click(); return; }
    if (act === 'impFolder') { $('#dirImpDocx').click(); return; }
    if (act === 'impClear') { items = []; A.render(); return; }
    if (act === 'impDel' && it) { items = items.filter(x => x !== it); A.render(); return; }
    if (act === 'impOpen' && it) {
      const cur = A.state && A.state.v && Object.values(A.state.v).some(x => String(x ?? '').trim());
      if (cur && !confirm('Biên bản đang mở trên máy này sẽ được thay bằng biên bản nhập. Đã lưu .json hoặc CSDL biên bản đang mở chưa? Tiếp tục?')) return;
      A.openState(JSON.parse(JSON.stringify(it.state)), it.saved ? { sessionId: it.saved.id } : null);
      A.toast(`Đã mở ${it.file} để soát — sửa nếu cần rồi bấm “Lưu CSDL”`);
      return;
    }
    if (act === 'impSave' || act === 'impSaveAll') {
      if (!window.DB || !DB.user) { A.toast('Cần đăng nhập CSDL để lưu (trang CSDL – biên bản đã lưu)', true); return; }
      const list = act === 'impSave' ? [it].filter(Boolean) : items.filter(ok);
      busy = true; A.render();
      let n = 0;
      for (const x of list) {
        try { await save(x, A); n++; } catch (e) { A.toast(`${x.file}: ${e.message}`, true); }
      }
      busy = false; A.render();
      A.toast(`Đã lưu ${n}/${list.length} biên bản vào CSDL`);
    }
  }

  function init(A) {
    ['fileImpDocx', 'dirImpDocx'].forEach(id => $('#' + id).addEventListener('change', async e => {
      await readFiles(e.target.files, A);
      e.target.value = '';
    }));
  }

  window.ImportReportUI = { render, action, init };
})();
