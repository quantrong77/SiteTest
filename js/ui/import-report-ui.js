// Nhập BBTN cũ theo lô. Dữ liệu được lưu nháp tự động; PDF có thể soát cạnh sau.
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
    if (!it || it.error || (it.saved && it.saved.status !== 'draft') || !it.reviewed || !st) return false;
    if (!String(st.v['meta.serial'] || '').trim() || !Common.isoDate(st.v['meta.date'])) return false;
    return true;
  }

  function canSaveDraft(it, A) {
    const st = activeState(it, A);
    return Boolean(it && !it.error && !it.saved && !it.processing && st
      && String(st.v['meta.serial'] || '').trim() && Common.isoDate(st.v['meta.date']));
  }

  function render(A) {
    const esc = A.esc;
    let h = '<div class="panel-head"><span class="secno">NB</span><h2>Nhập BBTN cũ</h2><span class="en">Import reports</span></div>';
    h += `<p class="hint-text">Chọn một/nhiều BBTN hoặc cả thư mục (.docx, .pdf). Số liệu đọc được sẽ vào hạng mục tương ứng và tự lưu ở trạng thái nháp để soát sau. PDF scan được OCR tiếng Việt + tiếng Anh ngay trên máy này; lần đầu cần Internet để tải engine và dữ liệu ngôn ngữ. Mở “Soát cạnh PDF” để đối chiếu, bổ sung số liệu rồi xác nhận. Cần đăng nhập tài khoản có quyền nhập liệu; file thiếu số chế tạo hoặc ngày thí nghiệm sẽ chờ bổ sung trước khi lưu.</p>`;
    h += `<div class="row-actions"><button class="btn primary" data-act="impFiles">Chọn file BBTN…</button><button class="btn" data-act="impFolder">Chọn cả thư mục…</button>
      ${items.length ? '<button class="btn" data-act="impClear">Ẩn danh sách</button>' : ''}
      ${items.some(it => canSaveDraft(it, A)) ? `<button class="btn" data-act="impSaveDraftAll"${busy ? ' disabled' : ''}>Lưu nháp chưa lưu (${items.filter(it => canSaveDraft(it, A)).length})</button>` : ''}
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
        : it.saving ? '<span class="badge st-info">Đang lưu bản nháp</span>'
        : it.error ? '<span class="badge st-fail">Lỗi đọc</span>'
        : it.saved ? `<span class="badge ${it.saved.status === 'final' ? 'st-pass' : 'st-info'}">${it.saved.status === 'final' ? 'Đã lưu · đã soát' : it.reviewed ? 'Đã soát · chờ cập nhật' : 'Đã lưu nháp · chờ soát'}</span>`
          : it.reviewed ? '<span class="badge st-info">Đã soát</span>' : '<span class="badge st-warn">Cần soát</span>';
      const notes = [...(it.warnings || []), ...(it.saveNotice ? [it.saveNotice] : [])];
      const warnings = it.error ? `<div class="note">${esc(it.error)}</div>`
        : notes.length ? `<div class="note">${notes.map(esc).join('<br>')}</div>` : '';
      const format = it.format === 'pdf' ? `PDF · ${esc(LAYOUT_NAME[it.layout] || it.layout || 'chưa nhận dạng')}` : `DOCX · ${esc(LAYOUT_NAME[it.layout] || it.layout || 'chưa nhận dạng')}`;
      return `<tr><td>${esc(it.file)}</td><td>${format}</td><td>${esc(v['meta.serial'] || '—')}</td><td>${esc(v['meta.date'] || '—')}</td><td>${esc(it.reportNo || st && st.imported && st.imported.reportNo || '—')}</td>
        <td class="num">${Number(it.count) || 0}</td><td>${status}${warnings}</td><td><div class="row-actions" style="margin:0">
        ${it.state && !it.error && !it.processing ? `<button class="btn small" data-act="impOpen" data-id="${it.id}">${it.format === 'pdf' ? 'Soát cạnh PDF' : 'Mở để soát'}</button>` : ''}
        ${it.state && !it.error && !it.processing && !it.reviewed ? `<button class="btn small" data-act="impReviewDone" data-id="${it.id}">Đã soát</button>` : ''}
        ${canSaveDraft(it, A) ? `<button class="btn small" data-act="impSaveDraft" data-id="${it.id}"${busy ? ' disabled' : ''}>Lưu nháp</button>` : ''}
        ${canSave(it, A) ? `<button class="btn small primary" data-act="impSave" data-id="${it.id}"${busy ? ' disabled' : ''}>Lưu &amp; chốt</button>` : ''}
        <button class="btn small" data-act="impDel" data-id="${it.id}" aria-label="Ẩn ${esc(it.file)}">Ẩn</button></div></td></tr>`;
    }).join('');
    return `<section class="panel">${h}</tbody></table></div></section>`;
  }

  async function readFiles(files, A) {
    const reports = Array.from(files || []).filter(f => /\.(docx|pdf)$/i.test(f.name) && !/^~\$/.test(f.name));
    if (!reports.length) { A.toast('Không có file .docx hoặc .pdf trong lựa chọn', true); return; }
    let n = 0, saved = 0;
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
        it.reviewed = false;
        n++;
      } catch (e) { it.error = e.message; }
      it.processing = false;
      it.progress = null;
      if (!it.error && await autoSaveDraft(it, A)) saved++;
      A.render();
    }
    A.toast(`Đã đọc ${n}/${reports.length} file BBTN; tự lưu ${saved}/${n} bản nháp. Mở từng file để soát sau.`);
  }

  async function autoSaveDraft(it, A) {
    if (!it || !it.state || it.error || it.saved) return false;
    const state = it.state;
    const missing = [];
    if (!String(state.v['meta.serial'] || '').trim()) missing.push('số chế tạo');
    if (!Common.isoDate(state.v['meta.date'])) missing.push('ngày thí nghiệm');
    if (missing.length) {
      it.saveNotice = 'Chưa tự lưu: cần bổ sung ' + missing.join(' và ') + ' trong biểu mẫu.';
      return false;
    }
    if (!window.DB || !DB.user || !DB.canEdit()) {
      it.saveNotice = 'Chưa tự lưu: đăng nhập bằng tài khoản có quyền nhập liệu để lưu vào CSDL.';
      return false;
    }
    it.saving = true; busy = true; A.render();
    try {
      await save(it, A, 'draft');
      return true;
    } catch (e) {
      it.saveNotice = 'Chưa lưu vào CSDL: ' + e.message;
      return false;
    } finally {
      it.saving = false; busy = false; A.render();
    }
  }

  function evalOf(it, A) {
    const T = EquipmentTypes.get('MBA'), state = activeState(it, A);
    const schema = T.buildSchema(state.cfg);
    const FX = A.FX && A.FX.unit && A.FX.unit(state.v['meta.serial']) ? A.FX : null;
    return { state, schema, res: T.evaluate(state, FX, schema) };
  }

  async function save(it, A, status) {
    const { state, schema, res } = evalOf(it, A);
    status = status || 'final';
    it.saveNotice = '';
    const r = await Records.saveField(state, res, schema, status);
    state.db = { sessionId: r.id, equipmentId: r.equipmentId, savedAt: new Date().toISOString() };
    it.state = JSON.parse(JSON.stringify(state));
    it.count = r.n;
    it.saved = { id: r.id, status };
    if (A.state.imported && A.state.imported.importId === it.id) A.persist();
    try {
      const kind = it.format === 'pdf' ? 'BBTN_PDF' : 'BBTN_DOCX';
      await DB.uploadDoc(r.id, r.equipmentId, kind, `${state.v['meta.serial']}/${r.id}/imported/${it.blob.name}`, it.blob.name, it.blob);
    } catch (e) {
      it.saveNotice = `Đã lưu số liệu nhưng chưa lưu được file gốc (${e.message}).`;
      A.toast(`${it.file}: ${it.saveNotice}`, true);
    }
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
    if (act === 'impReviewDone') {
      if (it) {
        if (!A.state.imported || A.state.imported.importId !== it.id) { A.toast('Mở biểu mẫu cạnh BBTN gốc, kiểm tra số liệu rồi đánh dấu đã soát.', true); return; }
        it.state = JSON.parse(JSON.stringify(A.state));
        try { it.count = measuredCount(it.state); } catch (e) { A.toast('Chưa thể kiểm tra số liệu: ' + e.message, true); return; }
        it.reviewed = true;
        A.state.imported.reviewed = true;
        it.state.imported.reviewed = true;
        A.persist();
        if (!window.DB || !DB.user || !DB.canEdit()) {
          it.saveNotice = 'Đã soát tại máy này; cần quyền nhập liệu để cập nhật trạng thái vào CSDL.';
          A.render();
          A.toast('Đã soát, nhưng chưa cập nhật được CSDL. Đăng nhập bằng tài khoản có quyền nhập liệu để lưu.', true);
          return;
        }
        busy = true; A.render();
        try {
          await save(it, A, 'final');
          A.toast(`Đã soát và cập nhật ${it.file}: ${it.count} dòng số liệu`);
        } catch (e) {
          it.saveNotice = 'Đã soát nhưng chưa cập nhật được CSDL: ' + e.message;
          A.toast(it.saveNotice, true);
        } finally { busy = false; A.render(); }
        return;
      }
      const state = A.state;
      if (!state.imported || state.imported.importId !== (b && b.dataset.id) || !state.db || !state.db.sessionId) {
        A.toast('Không tìm thấy biên bản đã lưu để cập nhật.', true); return;
      }
      if (!window.DB || !DB.user || !DB.canEdit()) { A.toast('Cần tài khoản có quyền nhập liệu để cập nhật trạng thái đã soát trong CSDL.', true); return; }
      state.imported.reviewed = true;
      A.persist(); busy = true; A.render();
      try {
        const r = await Records.saveField(state, A.res, A.schema, 'final');
        state.db = { sessionId: r.id, equipmentId: r.equipmentId, savedAt: new Date().toISOString() };
        A.persist();
        A.toast('Đã soát và cập nhật biên bản trong CSDL');
      } catch (e) {
        state.imported.reviewed = false; A.persist();
        A.toast('Đã soát nhưng chưa cập nhật được CSDL: ' + e.message, true);
      } finally { busy = false; A.render(); }
      return;
    }
    if (act === 'impSaveDraft' || act === 'impSaveDraftAll') {
      if (!window.DB || !DB.user || !DB.canEdit()) { A.toast('Cần đăng nhập bằng tài khoản có quyền nhập liệu để lưu vào CSDL.', true); return; }
      const list = act === 'impSaveDraft' ? [it].filter(x => x && canSaveDraft(x, A)) : items.filter(x => canSaveDraft(x, A));
      if (!list.length) { A.toast('Chưa có biên bản đủ số chế tạo và ngày thí nghiệm để lưu nháp.', true); return; }
      busy = true; A.render();
      let n = 0;
      for (const x of list) {
        try { await save(x, A, 'draft'); n++; } catch (e) { x.saveNotice = 'Chưa lưu vào CSDL: ' + e.message; A.toast(`${x.file}: ${e.message}`, true); }
      }
      busy = false; A.render();
      A.toast(`Đã lưu nháp ${n}/${list.length} biên bản vào CSDL`);
      return;
    }
    if (act === 'impSave' || act === 'impSaveAll') {
      if (!window.DB || !DB.user || !DB.canEdit()) { A.toast('Cần đăng nhập bằng tài khoản có quyền nhập liệu để lưu vào CSDL.', true); return; }
      const list = act === 'impSave' ? [it].filter(x => x && canSave(x, A)) : items.filter(x => canSave(x, A));
      if (!list.length) { A.toast('Chưa có biên bản hợp lệ đã soát để lưu hoặc cập nhật.', true); return; }
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
