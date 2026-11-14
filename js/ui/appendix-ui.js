// Trang phụ lục BBTN: quản lý đồ thị OLTC, báo cáo SFRA và phép đo DFR.
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
    const dfr = att.dfr && att.dfr.items || [];
    h += `<section class="appx-card"><div class="appx-head"><h3>Đáp ứng tần số điện môi sứ đầu vào (DFR)</h3>${labels.dfr ? `<span class="badge st-pass">${labels.dfr}</span>` : '<span class="badge st-none">Chưa có</span>'}</div>
      <p>Nạp file CSV DIRANA; chỉ trình bày số liệu đo, không đánh giá đạt/không đạt.</p><div class="row-actions"><button class="btn" data-act="dfrFiles">Nạp file .csv…</button><button class="btn" data-act="dfrFolder">Nạp cả thư mục…</button>${dfr.length ? '<button class="btn small danger" data-act="dfrClear">Bỏ phụ lục DFR</button>' : ''}</div>
      ${dfr.length ? `<div class="ftable-wrap"><table class="ftable"><thead><tr><th>Phép đo</th><th>Ngày đo</th><th>Phía</th><th>Pha</th><th>15 Hz: tan / C</th><th>400 Hz: tan / C</th><th>Dùng</th><th></th></tr></thead><tbody>${dfr.slice().sort((a,b)=>{const rank=x=>({HV:0,MV:1,N:2,LV1:3,LV2:4}[x]??5);return rank(a.side)-rank(b.side)||Dfr.PHASES.indexOf(a.phase)-Dfr.PHASES.indexOf(b.phase)||Dfr.dateKey(a.date).localeCompare(Dfr.dateKey(b.date));}).map(m=>{const a=Dfr.at(m,15),b=Dfr.at(m,400), id=esc(m.id); const dec=x=>Number(x).toFixed(2).replace('.', (A.state.cfg.decSep||',')==='.'?'.':',');return `<tr><td>${esc(m.name)}</td><td>${esc(m.date)}</td><td><select aria-label="Phía của ${esc(m.name)}" data-dfr="side" data-id="${id}"><option value="">—</option>${Dfr.SIDES.map(x=>`<option ${m.side===x?'selected':''}>${x}</option>`).join('')}</select></td><td><select aria-label="Pha của ${esc(m.name)}" data-dfr="phase" data-id="${id}"><option value="">—</option>${Dfr.PHASES.map(x=>`<option ${m.phase===x?'selected':''}>${x}</option>`).join('')}</select></td><td>${a?`${dec(a.tan)} / ${dec(a.c)}`:'—'}</td><td>${b?`${dec(b.tan)} / ${dec(b.c)}`:'—'}</td><td><input type="checkbox" aria-label="Dùng phép đo ${esc(m.name)}" data-dfr="use" data-id="${id}" ${m.use?'checked':''}></td><td><button class="btn small danger" data-act="dfrDelete" data-id="${id}" aria-label="Xóa phép đo">×</button></td></tr>`}).join('')}</tbody></table></div><div class="dfr-preview">${Dfr.SIDES.filter(s=>Dfr.table(dfr).some(row=>row.side===s)).map(s=>`<div><b>Đồ thị xếp chồng — ${s}</b><canvas data-dfr-preview="${s}" aria-label="Đồ thị DFR phía ${s}"></canvas></div>`).join('')}</div>` : '<p>Chưa nạp phép đo DFR.</p>'}</section>`;
    return `<section class="panel appx">${h}</section>`;
  }

  // Sau khi vẽ: kiểm tra file báo cáo còn trong kho của trình duyệt
  async function afterRender(A) {
    const fra = A.state.att && A.state.att.fra, el = $('[data-frafile]');
    if (fra && el) { const rec = await FileStore.get(fra.id).catch(() => null); el.className = `badge ${rec ? 'st-pass' : 'st-warn'}`; el.textContent = rec ? 'File có trên máy này' : 'Thiếu file trên máy này — nạp lại báo cáo'; }
    const used = ((A.state.att || {}).dfr || {}).items || [];
    document.querySelectorAll('[data-dfr-preview]').forEach(cv => DfrChart.draw(cv, Dfr.table(used).filter(row=>row.side===cv.dataset.dfrPreview).map(row=>row.m), true));
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
    if (act === 'dfrFiles') $('#fileDirana').click();
    if (act === 'dfrFolder') $('#diranaFolder').click();
    if (act === 'dfrDelete' || act === 'dfrClear') {
      if (act === 'dfrClear' && !confirm('Bỏ phụ lục DFR khỏi biên bản? Các phép đo đã nạp sẽ bị xóa khỏi biên bản.')) return;
      const xs = st.att.dfr.items;
      if (act === 'dfrDelete') st.att.dfr.items = xs.filter(m => m.id !== b.dataset.id);
      else delete st.att.dfr;
      A.persist(); A.render(); A.toast('Đã cập nhật phép đo DFR');
    }
  }

  async function loadDirana(files, A) {
    const list = Array.isArray(files) ? files : [files];
    const att = A.state.att || (A.state.att = {}), items = (att.dfr && att.dfr.items) || [];
    const before = items.slice(), parsedNew = [], errors = [];
    for (const file of list.filter(f => /\.csv$/i.test(f.name))) {
      try {
        const parsed = Dirana.parse(await file.text(), file.name);
        parsed.forEach(m => parsedNew.push(m));
      } catch (e) {
        if (!/không phải CSV DIRANA/.test(e.message || '')) errors.push(`${file.name}: ${e.message}`);
      }
    }
    if (!parsedNew.length) {
      if (errors.length) A.toast(errors.join('\n'), true);
      else A.toast('Không tìm thấy phép đo DIRANA trong các file đã chọn.', true);
      return;
    }
    const newId = () => `dfr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    att.dfr = { items: Dirana.merge(before, parsedNew, newId) };
    A.persist(); A.render();
    A.toast(`Đã nạp ${parsedNew.length} phép đo từ ${new Set(parsedNew.map(m => m.file)).size} file`);
    if (errors.length) A.toast(errors.join('\n'), true);
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
    ['fileDirana','diranaFolder'].forEach(id => $('#' + id).addEventListener('change', async e => { await loadDirana(Array.from(e.target.files || []), A); e.target.value = ''; }));
    document.addEventListener('change', e => {
      const el = e.target;
      if (!el.dataset.dfr) return;
      const items = A.state.att.dfr.items, m = items.find(x => x.id === el.dataset.id);
      if (!m) return;
      m[el.dataset.dfr] = el.type === 'checkbox' ? el.checked : el.value;
      // chỉnh tay: phía/pha không bị xếp hạng lại khi nạp thêm file; lựa chọn "Dùng" giữ cho cả nhóm phía|pha
      if (el.dataset.dfr === 'side' || el.dataset.dfr === 'phase') m.sideManual = true;
      if (el.dataset.dfr === 'use') items.forEach(x => { if (x.side === m.side && x.phase === m.phase) x.useManual = true; });
      if (m.use) items.forEach(x => { if (x.id !== m.id && x.side === m.side && x.phase === m.phase) x.use = false; });
      A.persist(); A.render();
    });
  }

  window.AppendixUI = { render, afterRender, action, reportAssets, filesFor, restoreFiles, afterDbSave, ensureFiles, init };
})();
