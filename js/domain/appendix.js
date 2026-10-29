// Phụ lục nối sau BBTN: chụp sóng OLTC (dựng từ số liệu máy đo) và báo cáo SFRA (file .docx xuất từ SFRA Analyzer,
// https://quantrong77.github.io/-Analysis-SFRA/, nối nguyên văn). Đánh số phụ lục, tóm tắt báo cáo SFRA để hiển thị.
(function () {
  'use strict';
  const SFRA_URL = 'https://quantrong77.github.io/-Analysis-SFRA/';

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

  window.Appendix = { SFRA_URL, fraSummary, list, fraHeader };
})();
