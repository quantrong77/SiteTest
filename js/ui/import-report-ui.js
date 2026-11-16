// Nhập BBTN cũ theo lô. PDF được đọc trên máy người dùng và soát trong cùng màn hình với biểu mẫu.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  let items = [], busy = false;
  const LAYOUT_NAME = { '1P': 'MBA 500 kV theo pha', '3P': 'MBA 500 kV chung 3 pha', '110': 'MBA 3 pha 110–220 kV' };

  function activeState(it, A) {
    return it && A.state && A.state.imported && A.state.imported.importId === it.id ? A.state : it && it.state;
  }

  function measuredCount(state) {
    const T = EquipmentTypes.get('MBA'), schema = T.buildSchema(state.cfg), res = T.evaluate(state, null, schema);
    return T.toRows.fieldRows(state, res, schema).rows.filter(r => r.value !== null).length;
  }

  function canSave(it, A) {
    const st = activeState(it, A);
    if (!it || it.error || it.saved || !it.reviewed || !st) return false;
    if (!String(st.v['meta.serial'] || '').trim() || !Common.isoDate(st.v['meta.date'])) return false;
    if (it.format === 'pdf' && !(it.count > 0)) return false;
    return true;
  }

  function render(A) {
    const esc = A.esc;
    let h = '<div class="panel-head"><span class="secno">NB</span><h2>Nhập BBTN cũ</h2><span class="en">Import reports</span></div>';
    h += `<p class="hint-text">Chọn một/nhiều BBTN hoặc cả thư mục (.docx, .pdf). PDF scan sẽ được OCR tiếng Việt + tiếng Anh ngay trên máy này; lần đầu cần Internet để tải engine và dữ liệu ngôn ngữ. Mở “Soát cạnh PDF” để kiểm tra nội dung, đối chiếu và nhập/sửa số liệu bên cạnh. Chỉ file được lưu mới tải lên CSDL.</p>`;
    h += `<div class="row-actions"><button class="btn primary" data-act="impFiles">Chọn file BBTN…</button><button class="btn" data-act="impFolder">Chọn cả thư mục…</button>
      ${items.length ? '<button class="btn" data-act="impClear">Xóa danh sách</button>' : ''}
      ${items.some(it => canSave(it, A)) ? `<button class="btn primary" data-act="impSaveAll"${busy ? ' disabled' : ''}>Lưu các biên bản đã soát (${items.filter(it => canSave(it, A)).length})</button>` : ''}</div>`;
    if (!items.length) return `<section class="panel">${h}<p class="wf-none">Chưa chọn file nào.</p></section>`;
    h += '<div class="grid-wrap"><table class="ftable"><thead><tr><th>File</th><th>Định dạng / mẫu</th><th>Số chế tạo</th><th>Ngày TN</th><th>Số biên bản</th><th>Ô số liệu</th><th>Trạng thái</th><th></th></tr></thead><tbody>';
    h += items.map(it => {
      const st = activeState(it, A), v = st && st.v || {};
      const progressStatus = String(it.progress && it.progress.status || 'Đang xử lý');
      const progressLabel = /recogniz/i.test(progressStatus) ? 'Đang nhận dạng OCR' : /loading/i.test(progressStatus) ? 'Đang tải OCR' : /initializ/i.test(progressStatus) ? 'Đang khởi tạo OCR' : progressStatus;
      const progressPct = it.progress && it.progress.progress > 0 ? ` · ${Math.round(it.progress.progress * 100)}%` : '';
      const progress = it.progress ? `${esc(progressLabel)} ${it.progress.page ? `${it.progress.page}/${it.progress.total}` : ''}${progressPct}` : 'Đang xử lý';
      const status = it.processing ? `<span class="badge st-info">${progress}</span>`
        : it.error ? '<span class="badge st-fail">Lỗi đọc</span>'
        : it.saved ? '<span class="badge st-pass">Đã lưu CSDL</span>'
          : it.reviewed ? '<span class="badge st-info">Đã soát</span>' : '<span class="badge st-warn">Cần soát</span>';
      const warnings = it.error ? `<div class="note">${esc(it.error)}</div>`
        : it.warnings && it.warnings.length ? `<div class="note">${it.warnings.map(esc).join('<br>')}</div>` : '';
      const format = it.format === 'pdf' ? `PDF · ${esc(LAYOUT_NAME[it.layout] || it.layout || 'chưa nhận dạng')}` : `DOCX · ${esc(LAYOUT_NAME[it.layout] || it.layout || 'chưa nhận dạng')}`;
      return `<tr><td>${esc(it.file)}</td><td>${format}</td><td>${esc(v['meta.serial'] || '—')}</td><td>${esc(v['meta.date'] || '—')}</td><td>${esc(it.reportNo || st && st.imported && st.imported.reportNo || '—')}</td>
        <td class="num">${Number(it.count) || 0}</td><td>${status}${warnings}</td><td><div class="row-actions" style="margin:0">
        ${it.state && !it.error && !it.processing ? `<button class="btn small" data-act="impOpen" data-id="${it.id}">${it.format === 'pdf' ? 'Soát cạnh PDF' : 'Mở để soát'}</button>` : ''}
        ${it.format === 'pdf' && it.state && !it.error && !it.processing && !it.reviewed ? `<button class="btn small" data-act="impReviewDone" data-id="${it.id}">Đã soát</button>` : ''}
        ${canSave(it, A) ? `<button class="btn small primary" data-act="impSave" data-id="${it.id}"${busy ? ' disabled' : ''}>Lưu CSDL</button>` : ''}
        <button class="btn small" data-act="impDel" data-id="${it.id}" aria-label="Bỏ ${esc(it.file)}">Bỏ</button></div></td></tr>`;
    }).join('');
    return `<section class="panel">${h}</tbody></table></div></section>`;
  }

  async function readFiles(files, A) {
    const reports = Array.from(files || []).filter(f => /\.(docx|pdf)$/i.test(f.name) && !/^~\$/.test(f.name));
    if (!reports.length) { A.toast('Không có file .docx hoặc .pdf trong lựa chọn', true); return; }
    let n = 0;
    for (const f of reports) {
      const format = /\.pdf$/i.test(f.name) ? 'pdf' : 'docx';
      const it = { id: 'imp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), file: f.webkitRelativePath || f.name, blob: f, format, reviewed: format === 'docx', processing: true };
      items.push(it);
      A.render();
      try {
        const T = EquipmentTypes.get('MBA');
        let parsed;
        if (format === 'pdf') {
          let lastUpdate = 0;
          const extracted = await PdfText.extractWithOcr(f, progress => {
            it.progress = progress;
            if (Date.now() - lastUpdate > 250 || progress.progress >= 1) { lastUpdate = Date.now(); A.render(); }
          });
          parsed = T.importPdfReport(extracted.pages, f.name, { ocr: extracted.ocrPages > 0 });
          it.ocrPages = extracted.ocrPages;
          it.ocrConfidence = extracted.confidence;
          if (it.ocrPages) {
            const quality = Number.isFinite(it.ocrConfidence) ? ` Độ tin cậy trung bình: ${Math.round(it.ocrConfidence)}%.` : '';
            parsed.warnings.push(`Đã OCR ${it.ocrPages} trang bằng tiếng Việt + tiếng Anh.${quality} Soát lại từng trường theo PDF gốc.`);
          }
        } else parsed = T.importReport(await DocxTemplate.load(await f.arrayBuffer()), f.name);
        Object.assign(it, parsed);
        it.reportNo = it.reportNo || (it.state.imported && it.state.imported.reportNo) || '';
        it.state.imported = Object.assign({}, it.state.imported, { importId: it.id, format, reportNo: it.reportNo });
        it.reviewed = format === 'docx';
        n++;
      } catch (e) { it.error = e.message; }
      it.processing = false;
      it.progress = null;
      A.render();
    }
    A.toast(`Đã đọc ${n}/${reports.length} file BBTN — mở từng file để soát trước khi lưu`);
  }

  function evalOf(it, A) {
    const T = EquipmentTypes.get('MBA'), state = activeState(it, A);
    const schema = T.buildSchema(state.cfg);
    const FX = A.FX && A.FX.unit && A.FX.unit(state.v['meta.serial']) ? A.FX : null;
    return { state, schema, res: T.evaluate(state, FX, schema) };
  }

  async function save(it, A) {
    const { state, schema, res } = evalOf(it, A);
    const r = await Records.saveField(state, res, schema, 'final');
    state.db = { sessionId: r.id, equipmentId: r.equipmentId, savedAt: new Date().toISOString() };
    it.state = JSON.parse(JSON.stringify(state));
    it.count = r.n;
    it.saved = { id: r.id };
    if (A.state.imported && A.state.imported.importId === it.id) A.persist();
    try {
      const kind = it.format === 'pdf' ? 'BBTN_PDF' : 'BBTN_DOCX';
      await DB.uploadDoc(r.id, r.equipmentId, kind, `${state.v['meta.serial']}/${r.id}/imported/${it.blob.name}`, it.blob.name, it.blob);
    } catch (e) { A.toast(`${it.file}: đã lưu số liệu, chưa lưu được file gốc (${e.message})`, true); }
    return r;
  }

  async function action(act, b, A) {
    const it = items.find(x => x.id === (b && b.dataset.id));
    if (act === 'impFiles') { $('#fileImpDocx').click(); return; }
    if (act === 'impFolder') { $('#dirImpDocx').click(); return; }
    if (act === 'impClear') { items = []; A.render(); return; }
    if (act === 'impDel' && it) { items = items.filter(x => x !== it); A.render(); return; }
    if (act === 'impOpen' && it && !it.error) {
      const cur = A.state && A.state.v && Object.values(A.state.v).some(x => String(x ?? '').trim());
      if (cur && A.state.imported?.importId !== it.id && !confirm('Biên bản đang mở sẽ được thay bằng biên bản nhập. Đã lưu dữ liệu đang làm chưa? Tiếp tục?')) return;
      const st = JSON.parse(JSON.stringify(activeState(it, A)));
      if (it.format === 'pdf') A.openState(st, st.db || null, { blob: it.blob, fileName: it.file, returnTo: 'importReport' });
      else A.openState(st, st.db || null);
      A.toast(it.format === 'pdf' ? `Đã mở ${it.file} cạnh biểu mẫu — sửa dữ liệu ở khung bên phải` : `Đã mở ${it.file} để soát`);
      return;
    }
    if (act === 'impReviewDone' && it) {
      if (!A.state.imported || A.state.imported.importId !== it.id) { A.toast('Mở “Soát cạnh PDF”, kiểm tra và nhập số liệu trước khi đánh dấu đã soát.', true); return; }
      it.state = JSON.parse(JSON.stringify(A.state));
      try { it.count = measuredCount(it.state); } catch (e) { A.toast('Chưa thể kiểm tra số liệu: ' + e.message, true); return; }
      if (!it.count) { A.toast('Chưa có ô số liệu đo nào. Nhập ít nhất một số liệu trong biểu mẫu rồi soát lại.', true); return; }
      it.reviewed = true;
      A.state.imported.reviewed = true;
      it.state.imported.reviewed = true;
      A.persist();
      A.render();
      A.toast(`Đã soát ${it.file}: ${it.count} dòng số liệu`);
      return;
    }
    if (act === 'impSave' || act === 'impSaveAll') {
      if (!window.DB || !DB.user || !DB.canEdit()) { A.toast('Cần đăng nhập bằng tài khoản có quyền nhập liệu để lưu vào CSDL.', true); return; }
      const list = act === 'impSave' ? [it].filter(x => x && canSave(x, A)) : items.filter(x => canSave(x, A));
      if (!list.length) { A.toast('Chưa có biên bản hợp lệ đã soát để lưu.', true); return; }
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
