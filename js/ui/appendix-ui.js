// Trang "Phụ lục BBTN": chụp sóng OLTC (từ mục 9) và báo cáo SFRA — mở SFRA Analyzer để phân tích, tải báo cáo Word
// về rồi nạp vào đây; khi xuất BBTN báo cáo được nối nguyên văn thành phụ lục. File báo cáo giữ trong kho file của
// trình duyệt (FileStore), đi kèm file .json khi lưu và lên Storage khi lưu CSDL.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  let opened = { id: null, doc: null }; // báo cáo SFRA đã mở (DocxTemplate)

  const kb = n => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} kB`);
  const when = iso => { const d = new Date(iso); return Number.isNaN(+d) ? '' : d.toLocaleString('vi-VN'); };
  const storagePath = (st, id) => `${st.v['meta.serial'] || 'MBA'}/${st.db.sessionId}/appendix/${id}.docx`;

  function render(A) {
    const st = A.state, esc = A.esc, att = st.att || {}, fra = att.fra, osc = att.oltc || {};
    const labels = Object.fromEntries(Appendix.list(st).map(a => [a.kind, a.label]));
    const phases = Object.keys(osc).sort();
    let h = '<div class="panel-head"><span class="secno">PL</span><h2>Phụ lục BBTN</h2><span class="en">Appendices</span></div>';
    h += '<p class="hint-text">Khi xuất BBTN .docx, các phụ lục dưới đây được nối sau biên bản; mỗi phụ lục bắt đầu trang mới và đánh số trang riêng.</p>';

    h += `<section class="appx-card"><div class="appx-head"><h3>Chụp sóng OLTC</h3>${labels.oltc ? `<span class="badge st-pass">${labels.oltc}</span>` : '<span class="badge st-none">Chưa có</span>'}</div>`
      + (phases.length
        ? `<p>${phases.map(ph => `Pha ${ph}: ${osc[ph].rows.length || osc[ph].waves.length} lần chuyển nấc`).join(' · ')}. Bảng số liệu và đồ thị dựng từ file Haefely 2293.</p>`
        : '<p>Nhập file .csv và .bin của Haefely 2293 ở mục 9 để có phụ lục chụp sóng.</p>')
      + '<div class="row-actions"><button class="btn" data-nav="oltc">Mở mục 9 – OLTC</button></div></section>';

    h += `<section class="appx-card"><div class="appx-head"><h3>Đáp ứng tần số quét (SFRA)</h3>${fra ? `<span class="badge st-pass">${labels.fra}</span>` : '<span class="badge st-none">Chưa có</span>'}</div>
      <ol class="appx-steps">
        <li><div><b>Phân tích trên SFRA Analyzer.</b> Nạp file đo baseline và lần đo (.frax, .sfra, .csv), bấm <i>Xác nhận và tính</i>, rồi ở mục <i>Báo cáo</i> tải báo cáo Word (.docx). Số liệu đo được xử lý ngay trong trình duyệt, không tải lên máy chủ.</div>
          <a class="btn primary" href="${Appendix.SFRA_URL}" target="_blank" rel="noopener">Mở SFRA Analyzer</a></li>
        <li><div><b>Nạp báo cáo vào BBTN.</b> Chọn file .docx vừa tải; nội dung báo cáo (bảng tổng hợp, giản đồ Bode, kết luận) được nối nguyên văn thành phụ lục.</div>
          <button class="btn${fra ? '' : ' primary'}" data-act="appxLoadFra">${fra ? 'Thay báo cáo SFRA…' : 'Nạp báo cáo SFRA (.docx)…'}</button></li>
      </ol>`;
    if (fra) {
      h += `<div class="appx-file"><div class="appx-file-head"><b>${esc(fra.name)}</b><span>${kb(fra.size)} · nạp lúc ${esc(when(fra.importedAt))}</span><span data-frafile class="badge st-none">Đang kiểm tra file…</span>
          <span class="spacer"></span><button class="btn small danger" data-act="appxDelFra">Bỏ phụ lục SFRA</button></div>
        <dl class="kv"><dt>Tiêu đề báo cáo</dt><dd>${esc(fra.title || '—')}</dd><dt>Số phép đo</dt><dd>${fra.measurements || '—'}</dd>
        <dt>Kết luận</dt><dd>${fra.conclusion && fra.conclusion.length ? fra.conclusion.map(esc).join('<br>') : '—'}</dd></dl></div>`;
    }
    h += '</section>';
    return `<section class="panel appx">${h}</section>`;
  }

  // Sau khi vẽ: kiểm tra file báo cáo còn trong kho của trình duyệt
  async function afterRender(A) {
    const fra = A.state.att && A.state.att.fra, el = $('[data-frafile]');
    if (!fra || !el) return;
    const rec = await FileStore.get(fra.id).catch(() => null);
    el.className = `badge ${rec ? 'st-pass' : 'st-warn'}`;
    el.textContent = rec ? 'File có trên máy này' : 'Thiếu file trên máy này — nạp lại báo cáo';
  }

  async function loadFile(f, A) {
    const buf = await f.arrayBuffer();
    let doc;
    try { doc = await DocxTemplate.load(buf); } catch (e) { throw new Error(`${f.name}: không phải file Word .docx`); }
    const sum = Appendix.fraSummary(doc.outline());
    if (!sum.isSfra && !confirm(`${f.name} không giống báo cáo SFRA (không thấy SFRA / Rxy / DL/T 911). Vẫn dùng file này làm phụ lục?`)) return;
    const st = A.state, old = st.att && st.att.fra;
    const id = 'fra-' + Date.now().toString(36);
    await FileStore.put(id, { name: f.name, type: f.type, bytes: buf });
    if (old) FileStore.del(old.id).catch(() => {});
    st.att = st.att || {};
    st.att.fra = { id, name: f.name, size: f.size, importedAt: new Date().toISOString(), title: sum.title, measurements: sum.measurements, conclusion: sum.conclusion };
    opened = { id, doc };
    A.persist(); A.render();
    A.toast(`Đã nạp báo cáo SFRA ${f.name}${sum.measurements ? ` (${sum.measurements} phép đo)` : ''} — sẽ nối thành phụ lục khi xuất BBTN`);
  }

  async function action(act, b, A) {
    const st = A.state;
    if (act === 'appxLoadFra') $('#fileFra').click();
    if (act === 'appxDelFra' && st.att && st.att.fra) {
      if (!confirm('Bỏ phụ lục SFRA khỏi biên bản? File báo cáo gốc trên máy của anh/chị không bị xóa.')) return;
      FileStore.del(st.att.fra.id).catch(() => {});
      delete st.att.fra;
      opened = { id: null, doc: null };
      A.persist(); A.render(); A.toast('Đã bỏ phụ lục SFRA');
    }
  }

  // Báo cáo SFRA đã mở cho phụ lục khi xuất BBTN; thiếu file thì báo và xuất không có phụ lục này
  async function reportAssets(A) {
    const fra = A.state.att && A.state.att.fra;
    if (!fra) return {};
    if (opened.id !== fra.id) {
      const rec = await FileStore.get(fra.id).catch(() => null);
      if (!rec) { A.toast(`Thiếu file báo cáo SFRA “${fra.name}” trên máy này — BBTN xuất không có phụ lục SFRA. Nạp lại ở trang Phụ lục.`, true); return {}; }
      opened = { id: fra.id, doc: await DocxTemplate.load(rec.bytes) };
    }
    return { fraDoc: opened.doc };
  }

  // ---- đi kèm biên bản: .json (base64), CSDL (Storage)
  async function filesFor(st) {
    const fra = st.att && st.att.fra, out = {};
    const rec = fra ? await FileStore.get(fra.id).catch(() => null) : null;
    if (rec) out[fra.id] = { name: rec.name, type: rec.type, b64: App.abToB64(rec.bytes) };
    return out;
  }
  async function restoreFiles(files) {
    for (const [id, f] of Object.entries(files || {})) {
      const bytes = Uint8Array.from(atob(f.b64), c => c.charCodeAt(0)).buffer;
      await FileStore.put(id, { name: f.name, type: f.type, bytes });
    }
  }
  async function afterDbSave(st) {
    const fra = st.att && st.att.fra;
    if (!fra || !st.db || !st.db.sessionId) return;
    const rec = await FileStore.get(fra.id).catch(() => null);
    if (!rec) return;
    const blob = new Blob([rec.bytes], { type: rec.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    await DB.uploadDoc(st.db.sessionId, st.db.equipmentId || null, 'OTHER', storagePath(st, fra.id), fra.name, blob);
  }
  // Mở biên bản từ CSDL trên máy khác: tải báo cáo SFRA từ Storage về kho file của trình duyệt
  async function ensureFiles(st) {
    const fra = st.att && st.att.fra;
    if (!fra || !st.db || !st.db.sessionId || await FileStore.get(fra.id).catch(() => null)) return;
    const docs = await DB.listDocs(st.db.sessionId);
    const d = docs.find(x => String(x.storage_path).includes(`/appendix/${fra.id}.docx`));
    if (!d) return;
    const blob = await DB.downloadDoc(d.storage_path);
    await FileStore.put(fra.id, { name: fra.name, type: blob.type, bytes: await blob.arrayBuffer() });
  }

  function init(A) {
    $('#fileFra').addEventListener('change', e => A.readFile(e.target, f => loadFile(f, A)));
  }

  window.AppendixUI = { render, afterRender, action, reportAssets, filesFor, restoreFiles, afterDbSave, ensureFiles, init };
})();
