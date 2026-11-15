// Phụ lục nối sau BBTN: chụp sóng OLTC (dựng từ số liệu máy đo) và báo cáo SFRA (file .docx xuất từ SFRA Analyzer,
// https://quantrong77.github.io/-Analysis-SFRA/, nối nguyên văn). Đánh số phụ lục, tóm tắt báo cáo SFRA để hiển thị.
(function () {
  'use strict';
  const SFRA_URL = 'https://quantrong77.github.io/-Analysis-SFRA/';
  const DGA_URL = 'https://quantrong77.github.io/dga-webapp/';

  function dgaLink(serial) {
    const value = String(serial || '').trim();
    return value ? `${DGA_URL}?serial=${encodeURIComponent(value)}` : DGA_URL;
  }

  function oilSummary(outline) {
    const lines = (outline || []).map(x => String(x.text || '').trim());
    const all = lines.join('\n');
    const title = lines.find(x => /BIÊN BẢN|PHÂN TÍCH KHÍ HÒA TAN/i.test(x)) || '';
    const kind = /PHÂN TÍCH KHÍ HÒA TAN/i.test(all) ? 'dga'
      : /BIÊN BẢN THÍ NGHIỆM DẦU CÁCH ĐIỆN/i.test(all) ? 'oil' : null;
    const after = re => { const line = lines.find(x => re.test(x)); return line ? line.split(':').slice(1).join(':').trim() : ''; };
    const ci = lines.findIndex(x => /KẾT LUẬN\s*\(Conclusion\)/i.test(x));
    const conclusion = [];
    if (ci >= 0) {
      const first = lines[ci].split(':').slice(1).join(':').trim();
      if (first) conclusion.push(first);
      for (let i = ci + 1; i < lines.length; i++) {
        if (/TUQ\.|KẾT QUẢ THÍ NGHIỆM|,\s*ngày\s+.+tháng\s+.+năm/i.test(lines[i])) break;
        if (lines[i]) conclusion.push(lines[i]);
      }
    }
    return { kind, title, serial: after(/Số chế tạo\s*\(Serial No\)/i),
      sampleDate: after(/Ngày lấy mẫu\s*\((?:Date of sampling|Date)\)/i),
      project: after(/Tên dự án\/tên trạm\s*\(Project\)/i), conclusion };
  }

  function serialMatch(fileSerial, serials) {
    const norm = x => String(x || '').toLowerCase().replace(/\s+/g, '');
    const target = norm(fileSerial);
    return !!target && (serials || []).some(x => norm(x) === target);
  }

  // outline: [{ style, text }] các đoạn văn của file → tóm tắt (tiêu đề, số phép đo, kết luận)
  function fraSummary(outline) {
    const isH1 = x => /heading\s*1|^heading1$/i.test(x.style) || /^\d+\.\s+\S/.test(x.text) && !/^\d+\.\d+/.test(x.text) && x.text.length < 80;
    const isH2 = x => /heading\s*2|^heading2$/i.test(x.style) || /^\d+\.\d+\.\s/.test(x.text);
    const ci = outline.findIndex(x => isH1(x) && /kết luận/i.test(x.text));
    const conclusion = [];
    if (ci >= 0) for (let k = ci + 1; k < outline.length && !isH1(outline[k]); k++) conclusion.push(outline[k].text);
    const all = outline.map(x => x.text).join('\n');
    return {
      title: outline.length ? outline[0].text : '',
      measurements: outline.filter(x => isH2(x) && /phép đo/i.test(x.text)).length,
      conclusion,
      isSfra: /SFRA|Rxy|DL\/T\s*911|đáp ứng tần số/i.test(all),
    };
  }

  // Các phụ lục có trong biên bản theo thứ tự; nhiều phụ lục thì đánh số "PHỤ LỤC 1, 2"
  function list(state, has = {}) {
    const att = state.att || {};
    const out = [];
    if (att.oltc && Object.keys(att.oltc).length) out.push({ kind: 'oltc' });
    if (att.fra && has.fra !== false) out.push({ kind: 'fra' });
    if (att.dfr && Array.isArray(att.dfr.items) && att.dfr.items.some(x => x.use)) out.push({ kind: 'dfr' });
    const oilHas = id => has.oil === undefined || (typeof has.oil.has === 'function' ? has.oil.has(id) : !!has.oil[id]);
    (att.oil && att.oil.items || []).filter(x => x.use !== false && oilHas(x.id)).forEach(x => out.push({ kind: 'oil', id: x.id }));
    // mẫu chung 3 pha: biến dòng chân sứ không có bảng trong thân BBTN → phụ lục dựng từ số liệu mục BCT
    if (has.bct) out.push({ kind: 'bct' });
    out.forEach((a, i) => { a.label = out.length > 1 ? `PHỤ LỤC ${i + 1}` : 'PHỤ LỤC'; });
    return out;
  }

  // Phần đầu phụ lục SFRA (trước nội dung báo cáo nối nguyên văn)
  function fraHeader(label, fra) {
    return [
      { type: 'page' },
      { type: 'p', text: label, bold: true, size: 14, align: 'center' },
      { type: 'p', text: 'KẾT QUẢ PHÂN TÍCH ĐÁP ỨNG TẦN SỐ QUÉT (SFRA)', bold: true, size: 13, align: 'center' },
      { type: 'p', text: `Báo cáo xuất từ SFRA Analyzer: ${fra.name}.`, italic: true, size: 10, align: 'center', after: 240 },
    ];
  }

  function oilHeader(label, item) {
    const dga = item.kind === 'dga';
    return [
      { type: 'page' },
      { type: 'p', text: label, bold: true, size: 14, align: 'center' },
      { type: 'p', text: dga ? 'KẾT QUẢ THÍ NGHIỆM PHÂN TÍCH KHÍ HÒA TAN TRONG DẦU (DGA)' : 'KẾT QUẢ THÍ NGHIỆM DẦU CÁCH ĐIỆN', bold: true, size: 13, align: 'center' },
      { type: 'p', text: `Biên bản xuất từ app DGA: ${item.name}.`, italic: true, size: 10, align: 'center', after: 240 },
    ];
  }

  window.Appendix = { SFRA_URL, DGA_URL, dgaLink, oilSummary, serialMatch, fraSummary, list, fraHeader, oilHeader };
})();
