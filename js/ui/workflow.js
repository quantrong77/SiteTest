// Khung quy trình của một biên bản: tiến trình các hạng mục, 4 bước của mỗi hạng mục (Chuẩn bị · Hướng dẫn đo ·
// Nhập số liệu · Đánh giá) và khung Tài liệu tham khảo. Nội dung bước và tài liệu do loại thiết bị khai báo
// (EquipmentTypes: workflow, references); chưa có thì báo rõ, không chặn việc nhập số liệu.
(function () {
  'use strict';
  const LS_STEP = 'bbtn-mba.wfStep';
  const STEPS = [['prep', 'Chuẩn bị'], ['guide', 'Hướng dẫn đo'], ['data', 'Nhập số liệu'], ['eval', 'Đánh giá']];
  const EMPTY_DOC = 'Hiện chưa có quy trình / tài liệu hướng dẫn cho hạng mục này.';

  // Bước đang mở của từng hạng mục (nhớ trên máy người dùng; mặc định Nhập số liệu)
  let steps = {};
  try { steps = JSON.parse(localStorage.getItem(LS_STEP) || '{}') || {}; } catch (e) { steps = {}; }
  const stepOf = secId => (STEPS.some(([k]) => k === steps[secId]) ? steps[secId] : 'data');
  function setStep(secId, step) {
    steps[secId] = step;
    try { localStorage.setItem(LS_STEP, JSON.stringify(steps)); } catch (e) { /* bỏ qua */ }
  }

  // Trạng thái hạng mục theo kết quả đánh giá: chưa làm / đang làm / đã nhập / đạt / cần xem xét / không đạt
  const STATE = {
    todo: 'Chưa làm', doing: 'Đang làm', entered: 'Đã nhập', pass: 'Đạt', warn: 'Cần xem xét', fail: 'Không đạt', skip: 'Không thực hiện',
  };
  function stateOf(S, isCurrent) {
    if (S && S.skipped) return 'skip';
    const st = S && S.status;
    if (!st) return isCurrent ? 'doing' : 'todo';
    if (st === 'missing') return 'doing';
    if (st === 'info') return 'entered';
    return st;
  }

  // Thanh tiến trình đầu thanh điều hướng
  function progressHTML(sections, sec, esc) {
    // chỉ đếm hạng mục thực hiện (bỏ tích "Thực hiện" thì không tính)
    sections = sections.filter(s => !(sec[s.id] && sec[s.id].skipped));
    const n = sections.length;
    const done = sections.filter(s => sec[s.id] && sec[s.id].status && sec[s.id].status !== 'missing').length;
    const fail = sections.filter(s => sec[s.id] && sec[s.id].status === 'fail').length;
    const pct = n ? Math.round(done / n * 100) : 0;
    return `<div class="wf-progress" role="group" aria-label="Tiến trình biên bản">
      <div class="wf-progress-t"><b>${done}/${n}</b> hạng mục đã nhập${fail ? ` · <span class="wf-fail">${fail} không đạt</span>` : ''}</div>
      <div class="wf-meter" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${done}" aria-label="${esc(`${done}/${n} hạng mục`)}"><span style="width:${pct}%"></span></div></div>`;
  }

  // Thanh 4 bước đầu mỗi hạng mục; bước Đánh giá kèm số mục cần chú ý
  function stepsHTML(secId, S) {
    const cur = stepOf(secId);
    const flag = S && S.counts ? S.counts.fail + S.counts.warn : 0;
    return `<nav class="wf-steps" aria-label="Các bước của hạng mục">${STEPS.map(([k, t], i) => `<button class="wf-step ${k === cur ? 'on' : ''}" data-wfstep="${k}" data-sec="${secId}" ${k === cur ? 'aria-current="step"' : ''}>`
      + `<span class="wf-n">${i + 1}</span><span>${t}</span>${k === 'eval' && flag ? `<span class="wf-badge" data-wfflag>${flag}</span>` : (k === 'eval' ? '<span class="wf-badge" data-wfflag hidden></span>' : '')}</button>`).join('')}</nav>`;
  }

  // Bước Chuẩn bị / Hướng dẫn đo: nội dung cấu hình của loại thiết bị, chưa có thì báo rõ
  function procedureHTML(T, secId, kind, esc, isAdmin) {
    const items = ((T.workflow || {})[secId] || {})[kind] || [];
    const title = kind === 'prep' ? 'Chuẩn bị' : 'Hướng dẫn đo';
    if (!items.length) {
      return `<div class="wf-empty"><p><b>${title}.</b> ${EMPTY_DOC}</p>
        ${kind === 'prep' ? '<p>Trước khi đo: kiểm tra điều kiện an toàn, trạng thái thiết bị và máy đo dùng cho hạng mục theo quy trình của đơn vị.</p>' : ''}
        ${isAdmin ? '<p class="wf-admin">Admin: nội dung bước này sẽ cấu hình được (quy trình thí nghiệm của đơn vị, hướng dẫn sử dụng máy đo) khi có thư viện tài liệu.</p>' : ''}
        <div class="row-actions"><button class="btn primary" data-wfstep="data" data-sec="${secId}">Sang bước Nhập số liệu</button></div></div>`;
    }
    return `<ol class="wf-list">${items.map(x => `<li>${esc(x.text || x)}</li>`).join('')}</ol>`;
  }

  // Khung Tài liệu tham khảo bên phải hạng mục
  function referencesHTML(T, secId, esc, libraryDocs = [], classCode = '', openFile = null) {
    const refs = (T.references || {})[secId] || [];
    const std = refs.length
      ? `<ul class="wf-refs-list">${refs.map(r => `<li><span class="wf-src">${esc(r.source)}</span>${esc(r.cite)}</li>`).join('')}</ul>`
      : '';
    const grouped = window.Library ? Library.forSection(libraryDocs, secId, classCode) : {};
    const items = kind => { const list = grouped[kind] || []; return list.length ? `<ul class="wf-refs-list">${list.map(d => `<li><span class="wf-src">${esc(d.code || kindName(kind))}${d.edition ? ' · ' + esc(d.edition) : ''}</span>${esc(d.title)}${d.file_path ? `<button class="btn small" data-lib-open="${esc(d.id)}" aria-label="Mở ${esc(d.title)}">Mở</button>` : ''}</li>`).join('')}</ul>` : `<p class="wf-none">${EMPTY_DOC}</p>`; };
    const stdLibrary = (grouped.standard || []).length ? items('standard') : '';
    const stdEmpty = !refs.length && !stdLibrary ? `<p class="wf-none">${EMPTY_DOC}</p>` : '';
    const kindName = kind => ({ standard: 'Tiêu chuẩn', procedure: 'Quy trình', manual: 'Hướng dẫn máy đo' }[kind] || kind);
    return `<aside class="wf-refs" aria-label="Tài liệu tham khảo"><h3>Tài liệu tham khảo</h3>
      <h4>Tiêu chuẩn đánh giá</h4>${std}${stdLibrary}${stdEmpty}
      <h4>Quy trình thí nghiệm của đơn vị</h4>${items('procedure')}
      <h4>Hướng dẫn sử dụng máy đo</h4>${items('manual')}</aside>`;
  }

  async function openLibraryFile(doc, popup) {
    try { const r = await DB.libraryFileUrl(doc.file_path); popup.opener = null; popup.location = r.signedUrl; }
    catch (err) { if (popup) popup.close(); throw err; }
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-lib-open]'); if (!b) return;
    const popup = window.open('', '_blank');
    if (!popup) { Notify.show({ type: 'error', msg: 'Trình duyệt đã chặn cửa sổ mở tài liệu.' }); return; }
    try { const d = (window.StandardsUI.docs || []).find(x => x.id === b.dataset.libOpen); if (d && d.file_path) await openLibraryFile(d, popup); else { popup.close(); Notify.show({ type: 'error', msg: 'Không tìm thấy file của tài liệu này — mở trang Thư viện tài liệu để tải lại danh mục.' }); } }
    catch (err) { Notify.show({ type: 'error', msg: 'Không mở được tài liệu: ' + err.message }); }
  });

  window.Workflow = { STEPS, STATE, stepOf, setStep, stateOf, progressHTML, stepsHTML, procedureHTML, referencesHTML, openLibraryFile };
})();
