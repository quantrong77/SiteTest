// Bước 2 "Hướng dẫn đo" của mỗi hạng mục: nội dung Markdown có hình (mặc định theo loại thiết bị — EquipmentTypes.guide),
// Admin chỉnh cho đơn vị (lưu bảng workflow_guides) và khôi phục mặc định. Hình nằm trong kho file riêng tư của CSDL
// (bucket library, thư mục guide/<loại>/) — Admin nạp từ chính tệp tài liệu (.docx: ảnh nhúng; .pdf: cắt vùng trang)
// hoặc chèn ảnh tự chọn. Giao tiếp CSDL chỉ qua DB.
(function () {
  'use strict';
  const LS = 'bbtn-mba.guides';
  const G = { rows: {}, loaded: '', loading: false, missing: false, urls: {}, edit: null, busy: '' };
  const esc = s => App.esc(s);
  const isAdmin = () => typeof DB !== 'undefined' && DB.role === 'admin';
  const signedIn = () => typeof DB !== 'undefined' && DB.client && DB.user && DB.role !== 'none';
  const classOf = () => EquipmentTypes.codeOf(App.state);
  const typeGuide = () => (App.type || {}).guide || null;
  const keyOf = secId => `${classOf()}|${secId}`;
  const vn = iso => String(iso || '').slice(0, 10).split('-').reverse().join('/');

  try { G.rows = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { G.rows = {}; }
  const cache = () => { try { localStorage.setItem(LS, JSON.stringify(G.rows)); } catch (e) { /* bản lưu tạm tùy chọn */ } };

  async function load(force) {
    const cls = classOf();
    if (!signedIn() || G.loading || (!force && G.loaded === cls)) return false;
    G.loading = true;
    try {
      const rows = await DB.listGuides(cls);
      Object.keys(G.rows).filter(k => k.startsWith(cls + '|')).forEach(k => delete G.rows[k]);
      rows.filter(r => r.kind === 'guide').forEach(r => { G.rows[`${cls}|${r.section_id}`] = { md: r.content_md, at: r.updated_at, note: r.note || '' }; });
      G.loaded = cls; cache();
      return true;
    } catch (e) {
      G.loaded = cls;
      App.toast('Không tải được hướng dẫn đo đơn vị đã chỉnh: ' + e.message + ' — đang dùng nội dung mặc định / bản lưu tạm.', true);
      return false;
    } finally { G.loading = false; }
  }

  const defaultMd = secId => { const T = typeGuide(); return T && T.GUIDE[secId] || ''; };
  const custom = secId => G.rows[keyOf(secId)] || null;
  const has = secId => !!(defaultMd(secId) || custom(secId));
  const pathOf = key => typeGuide().storagePath(classOf(), key);

  // Hình: khung giữ chỗ, afterRender gán link tạm từ kho file
  function figure(alt, src) {
    const m = /^img:([\w./-]+)$/.exec(src);
    if (!m) return `<p class="muted">[Hình không hợp lệ: ${esc(src)}]</p>`;
    const T = typeGuide(), def = T.IMAGES[m[1]];
    const cap = alt || (def && def.caption) || '';
    const srcNote = def ? ` <span class="gd-src">— ${esc(T.DOCS[def.doc].title)}${def.page ? `, trang ${def.page}` : ''}</span>` : '';
    return `<figure class="gd-fig"><div class="gd-img" data-gimg="${esc(pathOf(m[1]))}"><span class="muted">Đang tải hình…</span></div>`
      + `<figcaption>${esc(cap)}${srcNote}</figcaption></figure>`;
  }
  const bodyHTML = md => `<div class="gd-body">${HelpUI.mdToHtml(md, { image: figure })}</div>`;

  function html(secId) {
    if (signedIn() && G.loaded !== classOf() && !G.loading) load(false).then(ok => { if (ok) App.renderMain(); });
    const T = typeGuide(), c = custom(secId), admin = isAdmin();
    if (G.edit && G.edit.secId === secId) return editorHTML(secId);
    const src = c
      ? `<span class="badge st-warn">Đơn vị đã chỉnh${c.at ? ' ' + esc(vn(c.at)) : ''}</span>${c.note ? ` <span class="muted">${esc(c.note)}</span>` : ''}`
      : `<span class="muted">Nguồn: QĐ 1901/QĐ-EVNNPT Chương V · ${esc(T.DOCS.qt.title)} · ${esc(T.DOCS.dt.title)}</span>`;
    let h = `<div class="gd-head">${src}<span class="gd-tools">`;
    if (admin) {
      h += `<button class="btn small" data-gact="edit" data-sec="${secId}">Sửa hướng dẫn</button>`
        + `<button class="btn small" data-gact="import" title="Chọn tệp tài liệu đào tạo (.docx) và / hoặc quy trình QT-KĐMBA (.pdf) — app tách hình và lưu vào kho file riêng tư của CSDL">Nạp hình từ tài liệu…</button>`;
    }
    h += '</span></div>';
    h += `<div class="callout">Hướng dẫn tóm tắt, không thay thế sơ đồ, phương án và quy trình được duyệt. Nguồn từng ý ghi trong ngoặc: QĐ — QĐ 1901; QT — QT-KĐMBA; ĐT — tài liệu đào tạo.</div>`;
    h += bodyHTML(c ? c.md : defaultMd(secId));
    if (G.busy) h += `<div class="callout">${esc(G.busy)}</div>`;
    return `<div class="gd" data-gsec="${secId}">${h}</div>`;
  }

  function editorHTML(secId) {
    const e = G.edit, c = custom(secId);
    return `<div class="gd gd-edit" data-gsec="${secId}"><div class="gd-head"><b>Sửa hướng dẫn đo</b><span class="gd-tools">`
      + `<button class="btn small" data-gact="insert" data-sec="${secId}" title="Chọn ảnh trên máy — lưu vào kho file riêng tư, chèn vào vị trí con trỏ">Chèn ảnh…</button>`
      + `<button class="btn small" data-gact="default" data-sec="${secId}" title="Nạp lại nội dung mặc định của app vào ô soạn (chưa lưu)">Lấy nội dung mặc định</button>`
      + `${c ? `<button class="btn small danger" data-gact="reset" data-sec="${secId}">Khôi phục mặc định</button>` : ''}`
      + `<button class="btn small" data-gact="cancel">Hủy</button><button class="btn small primary" data-gact="save" data-sec="${secId}">Lưu</button></span></div>`
      + `<div class="hint-text">Markdown: <code>### Tiêu đề</code>, <code>1.</code> / <code>-</code> danh sách, <code>**đậm**</code>, <code>*nghiêng*</code>, bảng <code>| A | B |</code>, hình <code>![chú thích](img:khóa)</code> (mỗi hình một dòng). Lưu cho cả đơn vị.</div>`
      + `<label class="field"><span>Ghi chú thay đổi (căn cứ, văn bản…)</span><input id="gdNote" value="${esc(e.note)}"></label>`
      + `<div class="gd-split"><textarea id="gdText" spellcheck="false" aria-label="Nội dung hướng dẫn (Markdown)">${esc(e.text)}</textarea>`
      + `<div class="gd-preview" id="gdPreview" aria-live="polite">${bodyHTML(e.text)}</div></div></div>`;
  }

  // Gán link ảnh (theo lô, 1 giờ); ảnh chưa nạp → giữ chỗ có hướng dẫn
  async function afterRender() {
    const boxes = Array.from(document.querySelectorAll('[data-gimg]'));
    if (!boxes.length) return;
    if (!signedIn()) { boxes.forEach(b => { b.innerHTML = '<span class="muted">Đăng nhập để xem hình (hình lưu trong kho file riêng tư của đơn vị).</span>'; }); return; }
    const now = Date.now();
    const need = [...new Set(boxes.map(b => b.dataset.gimg))].filter(p => !G.urls[p] || G.urls[p].exp < now);
    if (need.length) {
      try {
        const got = await DB.guideImageUrls(need);
        need.forEach(p => { G.urls[p] = { url: got[p] || '', exp: now + 50 * 60 * 1000 }; });
      } catch (e) { boxes.forEach(b => { b.innerHTML = `<span class="muted">Không tải được hình: ${esc(e.message)}</span>`; }); return; }
    }
    let missing = 0;
    boxes.forEach(b => {
      const u = (G.urls[b.dataset.gimg] || {}).url;
      if (u) b.innerHTML = `<img src="${esc(u)}" alt="" loading="lazy">`;
      else { missing += 1; b.innerHTML = `<span class="muted">Hình chưa nạp vào CSDL${isAdmin() ? ' — bấm “Nạp hình từ tài liệu…”' : ' — báo Admin nạp hình'}.</span>`; }
    });
    const box = boxes[0].closest('.gd');
    if (box) box.dataset.missing = String(missing);
  }

  // ---- nạp hình từ tài liệu (Admin)
  const pick = (accept, multiple) => new Promise(res => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; inp.multiple = !!multiple;
    inp.onchange = () => res(Array.from(inp.files || []));
    inp.click();
  });
  async function importDocs(files) {
    const T = typeGuide(), cls = classOf(), report = [];
    for (const f of files) {
      if (/\.docx$/i.test(f.name)) {
        const zip = await JSZip.loadAsync(f);
        let ok = 0, skip = [];
        for (const im of T.imagesOfDoc('dt')) {
          const z = zip.file(im.media);
          const data = z ? await z.async('uint8array') : null;
          // đúng phiên bản tài liệu: ảnh có đúng số byte đã khai báo (tránh gắn nhầm hình khi tài liệu đã sửa)
          if (!data || data.length !== im.size) { skip.push(im.key); continue; }
          await DB.uploadGuideImage(T.storagePath(cls, im.key), new Blob([data], { type: 'image/png' }));
          ok += 1;
        }
        report.push(`${f.name}: ${ok} hình${skip.length ? `, bỏ qua ${skip.length} hình không khớp phiên bản tài liệu` : ''}`);
      } else if (/\.pdf$/i.test(f.name)) {
        const list = T.imagesOfDoc('qt');
        const r = await PdfText.cropRegions(f, list.map(im => ({ key: im.key, page: im.page, rect: im.rect })));
        if (r.pages !== T.DOCS.qt.pages) { report.push(`${f.name}: không phải ${T.DOCS.qt.title} (${r.pages} trang, cần ${T.DOCS.qt.pages}) — không lưu`); continue; }
        for (const x of r.out) await DB.uploadGuideImage(T.storagePath(cls, x.key), x.blob);
        report.push(`${f.name}: ${r.out.length} hình cắt từ trang`);
      } else report.push(`${f.name}: chỉ nhận .docx hoặc .pdf`);
    }
    G.urls = {};
    return report;
  }

  async function action(b) {
    const act = b.dataset.gact, secId = b.dataset.sec;
    if (!isAdmin() && act !== 'cancel') throw new Error('Cần quyền Admin để chỉnh hướng dẫn đo.');
    if (act === 'edit') { const c = custom(secId); G.edit = { secId, text: c ? c.md : defaultMd(secId), note: c ? c.note : '' }; }
    else if (act === 'cancel') G.edit = null;
    else if (act === 'default') { if (!confirm('Thay nội dung đang soạn bằng nội dung mặc định của app?')) return; G.edit.text = defaultMd(G.edit.secId); }
    else if (act === 'save') {
      const text = (document.getElementById('gdText') || {}).value || '';
      const note = ((document.getElementById('gdNote') || {}).value || '').trim();
      if (!text.trim()) throw new Error('Nội dung trống — dùng “Khôi phục mặc định” nếu muốn bỏ nội dung đơn vị đã chỉnh.');
      const row = await DB.saveGuide({ class_code: classOf(), section_id: secId, kind: 'guide', content_md: text, note: note || null });
      G.rows[keyOf(secId)] = { md: row.content_md, at: row.updated_at, note: row.note || '' }; cache();
      G.edit = null; App.toast('Đã lưu hướng dẫn đo cho đơn vị');
    } else if (act === 'reset') {
      if (!confirm('Xóa nội dung đơn vị đã chỉnh và dùng lại nội dung mặc định của app?')) return;
      await DB.deleteGuide(classOf(), secId, 'guide');
      delete G.rows[keyOf(secId)]; cache(); G.edit = null; App.toast('Đã khôi phục hướng dẫn mặc định');
    } else if (act === 'insert') {
      const ta = document.getElementById('gdText'); if (ta) { G.edit.text = ta.value; G.edit.note = (document.getElementById('gdNote') || {}).value || ''; }
      const pos = ta ? ta.selectionStart : G.edit.text.length;
      const [f] = await pick('image/png,image/jpeg,image/webp,image/gif');
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) throw new Error('Ảnh lớn hơn 5 MB — giảm kích thước rồi chèn lại.');
      const ext = (/\.(png|jpe?g|webp|gif)$/i.exec(f.name) || [, 'png'])[1].toLowerCase();
      const base = f.name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'anh';
      const key = `u/${secId}-${Date.now().toString(36)}-${base}.${ext}`;
      await DB.uploadGuideImage(typeGuide().storagePath(classOf(), key), f);
      const ins = `\n![${base.replace(/-/g, ' ')}](img:${key})\n`;
      G.edit.text = G.edit.text.slice(0, pos) + ins + G.edit.text.slice(pos);
      App.toast('Đã lưu ảnh vào kho file — sửa chú thích trong ngoặc vuông nếu cần');
    } else if (act === 'import') {
      const files = await pick('.docx,.pdf', true);
      if (!files.length) return;
      G.busy = 'Đang tách và lưu hình…'; App.renderMain();
      try { const rep = await importDocs(files); App.toast('Nạp hình hướng dẫn: ' + rep.join('; ')); }
      finally { G.busy = ''; }
    }
    App.renderMain();
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-gact]');
    if (!b) return;
    action(b).catch(err => { G.busy = ''; App.toast('Hướng dẫn đo: ' + err.message, true); App.renderMain(); });
  });
  // Xem trước khi soạn (không vẽ lại cả trang để giữ con trỏ)
  let tmr = null;
  document.addEventListener('input', e => {
    if (!G.edit) return;
    if (e.target.id === 'gdNote') { G.edit.note = e.target.value; return; }
    if (e.target.id !== 'gdText') return;
    G.edit.text = e.target.value;
    clearTimeout(tmr);
    tmr = setTimeout(() => { const p = document.getElementById('gdPreview'); if (p) { p.innerHTML = bodyHTML(G.edit.text); afterRender(); } }, 300);
  });

  window.GuideUI = { has, html, afterRender, load, reset() { G.loaded = ''; G.edit = null; G.urls = {}; } };
})();
