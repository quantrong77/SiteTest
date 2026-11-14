// Trang hướng dẫn trong ứng dụng; bộ chuyển đổi Markdown nhỏ chỉ nhận cú pháp trong tài liệu dự án.
(function () {
  'use strict';
  const GITHUB = 'https://github.com/quantrong77/SiteTest/blob/main/docs/HUONG_DAN_SU_DUNG.md';
  const CONTEXT = {
    general: 'Mục 0', visual: 'Mục 1', noload: 'Mục 2', ir: 'Mục 3', vector: 'Mục 4', bushing: 'Mục 5',
    wtgd: 'Mục 6', dcr: 'Mục 7', ratio: 'Mục 8', oltc: 'Mục 9', moisture: 'Mục 10', bct: 'Mục 11',
    summary: 'Tổng hợp', appendix: 'Phụ lục', db: 'CSDL', trend: 'Xu hướng', importReport: 'Nhập BBTN cũ',
    standards: 'Thư viện', criteria: 'Bộ tiêu chí', kconf: 'hệ số quy đổi sứ'
  };
  const NAV_CONTEXT = {
    factory: 'Mục 0', catalog: 'CSDL'
  };
  const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function inline(text) {
    let s = esc(text);
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, raw) => {
      const href = raw.trim();
      if (/^https?:\/\//i.test(href) || /^(?:\.\.\/|\.\/|\/)?[\w.-]+(?:\/[\w.-]+)*(?:#[\w-]+)?$/i.test(href) && !/\.md(?:$|#)/i.test(href)) {
        return `<a href="${esc(href)}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
      }
      return label;
    });
    return s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  function mdToHtml(markdown) {
    const lines = String(markdown || '').replace(/\r/g, '').split('\n');
    const out = []; let para = [], list = '', table = false, headingCount = {};
    const flushPara = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
    const closeList = () => { if (list) { out.push(`</${list}>`); list = ''; } };
    const closeTable = () => { if (table) { out.push('</tbody></table></div>'); table = false; } };
    const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(x => x.trim());
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*\|.*\|\s*$/.test(line)) {
        flushPara(); closeList();
        const row = cells(line);
        if (row.every(x => /^:?-{3,}:?$/.test(x))) continue;
        if (!table) {
          const next = lines[i + 1] || '';
          const isHeader = /^\s*\|.*\|\s*$/.test(next) && cells(next).every(x => /^:?-{3,}:?$/.test(x));
          out.push('<div class="help-table-wrap"><table class="ftable">');
          if (isHeader) { out.push('<thead><tr>' + row.map(x => `<th>${inline(x)}</th>`).join('') + '</tr></thead><tbody>'); i++; }
          else out.push('<tbody>');
          table = true;
        } else out.push('<tr>' + row.map(x => `<td>${inline(x)}</td>`).join('') + '</tr>');
        continue;
      }
      closeTable();
      const h = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
      if (h) {
        flushPara(); closeList();
        const title = h[2], base = slug(title) || 'muc', n = (headingCount[base] || 0) + 1; headingCount[base] = n;
        out.push(`<h${h[1].length} id="${base}${n > 1 ? '-' + n : ''}">${inline(title)}</h${h[1].length}>`);
        continue;
      }
      const ol = /^\s*\d+\.\s+(.+)$/.exec(line), ul = /^\s*[-*]\s+(.+)$/.exec(line);
      if (ol || ul) {
        flushPara(); const nextList = ol ? 'ol' : 'ul';
        if (list && list !== nextList) closeList();
        if (!list) { list = nextList; out.push(`<${list}>`); }
        out.push(`<li>${inline((ol || ul)[1])}</li>`); continue;
      }
      closeList();
      if (!line.trim()) flushPara(); else para.push(line.trim());
    }
    flushPara(); closeList(); closeTable();
    return out.join('\n');
  }
  const titleText = el => (el && el.textContent || '').trim();
  function findHeading(title) {
    const wanted = title.toLocaleLowerCase('vi');
    return Array.from(document.querySelectorAll('#helpContent h1,#helpContent h2,#helpContent h3'))
      .find(h => titleText(h).toLocaleLowerCase('vi').includes(wanted));
  }
  function contextFor(app, id) {
    id = id || (app && app.currentSection ? app.currentSection() : '');
    return CONTEXT[id] || NAV_CONTEXT[id] || '';
  }
  // Tên trang để quay lại: tiêu đề hạng mục của biểu mẫu hoặc tên trang chung
  const PAGE = { general: 'Thông tin chung', summary: 'Tổng hợp', appendix: 'Phụ lục BBTN', factory: 'Số liệu xuất xưởng', db: 'CSDL',
    catalog: 'Trạm – Ngăn – Thiết bị', trend: 'Xu hướng', kconf: 'Hệ số quy đổi sứ', criteria: 'Bộ tiêu chí', standards: 'Thư viện tài liệu',
    importReport: 'Nhập BBTN cũ' };
  function pageName(app, id) {
    const s = app && app.schema && app.schema.sections.find(x => x.id === id);
    return s ? `mục ${s.no} – ${s.title}` : (PAGE[id] || 'trang trước');
  }
  function open(app) {
    if (!document.getElementById('helpPanel')) {
      const main = document.getElementById('main');
      if (!main) return;
      const prior = main.innerHTML;
      main.dataset.helpPrior = prior;
      main.dataset.helpReturnId = app && app.currentSection ? app.currentSection() : '';
      main.innerHTML = `<section id="helpPanel" class="panel help-panel"><div class="panel-head"><h2>Hướng dẫn sử dụng</h2><span class="spacer"></span><button class="btn help-back" data-help-back>Quay lại ${esc(pageName(app, app && app.currentSection ? app.currentSection() : ''))}</button></div><div class="fields"><div class="field"><label for="helpSearch">Tìm trong hướng dẫn</label><input id="helpSearch" type="search" placeholder="Nhập từ cần tìm"></div></div><div id="helpStatus" class="callout" aria-live="polite">Đang tải hướng dẫn…</div><div class="help-layout"><nav id="helpToc" class="help-toc" aria-label="Mục lục hướng dẫn"></nav><article id="helpContent" class="help-content"></article></div></section>`;
      HelpUI.returnSection = main.dataset.helpReturnId;
    }
    const main = document.getElementById('main');
    HelpUI.target = contextFor(app, main && main.dataset.helpReturnId);
    load().then(() => { render(); jump(HelpUI.target); }).catch(() => renderError());
  }
  let markdownPromise;
  function render() {
    const content = document.getElementById('helpContent'); if (!content) return;
    content.innerHTML = mdToHtml(HelpUI.markdown || '');
    const headings = Array.from(content.querySelectorAll('h2'));
    document.getElementById('helpToc').innerHTML = headings.map(h => `<a href="#${esc(h.id)}">${esc(titleText(h))}</a>`).join('');
    const status = document.getElementById('helpStatus'); if (status) status.hidden = true;
    const search = document.getElementById('helpSearch');
    search.oninput = () => {
      const q = search.value.trim().toLocaleLowerCase('vi');
      content.querySelectorAll('.help-result').forEach(el => el.classList.remove('help-result'));
      if (!q) return;
      content.querySelectorAll('p,li,td,th,h2,h3').forEach(el => { if (el.textContent.toLocaleLowerCase('vi').includes(q)) el.classList.add('help-result'); });
    };
  }
  function load() {
    if (!markdownPromise) markdownPromise = fetch('docs/HUONG_DAN_SU_DUNG.md').then(r => { if (!r.ok) throw new Error('Không tải được tài liệu'); return r.text(); }).then(md => { HelpUI.markdown = md; return md; });
    return markdownPromise;
  }
  function jump(title) {
    if (!title) return;
    const h = findHeading(title); if (h) h.scrollIntoView({ block: 'start' });
  }
  function renderError() {
    const status = document.getElementById('helpStatus');
    if (status) { status.hidden = false; status.innerHTML = `Không tải được hướng dẫn. Hãy mở ứng dụng qua HTTP/HTTPS và kiểm tra kết nối mạng. <a href="${GITHUB}" target="_blank" rel="noopener noreferrer">Xem hướng dẫn trên GitHub</a>.`; }
  }
  function close(app) {
    const main = document.getElementById('main'); if (!main || !main.dataset.helpPrior) return;
    const prior = main.dataset.helpPrior, section = HelpUI.returnSection;
    delete main.dataset.helpPrior; delete main.dataset.helpReturnId;
    if (app && app.go && section) app.go(section);
    else main.innerHTML = prior;
    HelpUI.returnSection = '';
  }
  const HelpUI = { mdToHtml, open, close, CONTEXT, markdown: '', returnSection: '', target: '' };
  window.HelpUI = HelpUI;
  document.addEventListener('click', e => {
    if (e.target.closest('[data-help-back]')) { close(window.App); return; }
    const a = e.target.closest('#helpToc a'); if (a) { e.preventDefault(); const h = document.getElementById(decodeURIComponent(a.hash.slice(1))); if (h) h.scrollIntoView({ block: 'start' }); }
  });
  document.addEventListener('keydown', e => {
    const t = e.target, typing = t && (t.matches('input,textarea,select,[contenteditable="true"]') || t.closest('input,textarea,select,[contenteditable="true"]'));
    if (e.key === 'Escape' && document.querySelector('.help-panel')) { e.preventDefault(); close(window.App); return; }
    if (!typing && (e.key === 'F1' || (e.shiftKey && e.key === '?'))) { e.preventDefault(); open(window.App); }
  });
})();
