// Đọc thông tin nhận dạng từ PDF BBTN MBA PTC3/BM.01.
// PDF không có AcroForm; số liệu đo phải được soát trong PDF gốc và nhập/sửa ngay trên biểu mẫu.
(function () {
  'use strict';

  function fold(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim();
  }

  // Tạo chỉ mục từ chuỗi đã bỏ dấu về vị trí trong chuỗi gốc để vẫn giữ nguyên nội dung tiếng Việt.
  function foldedIndex(value) {
    let text = '', map = [];
    for (let i = 0; i < value.length; i++) {
      let chars = value[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi');
      for (const ch of chars) {
        if (/\s/.test(ch)) {
          if (text.endsWith(' ')) continue;
          text += ' '; map.push(i);
        } else { text += ch; map.push(i); }
      }
    }
    return { text: text.trim(), map };
  }

  function between(source, startLabel, endLabel) {
    const idx = foldedIndex(source), start = fold(startLabel), end = endLabel ? fold(endLabel) : '';
    const at = idx.text.indexOf(start);
    if (at < 0) return '';
    let a = at + start.length;
    while (a < idx.text.length && /[\s:=–—-]/.test(idx.text[a])) a++;
    let b = end ? idx.text.indexOf(end, a) : idx.text.length;
    if (b < 0) b = idx.text.length;
    const from = idx.map[a] ?? source.length, to = idx.map[b] ?? source.length;
    return source.slice(from, to).replace(/^[\s:=–—-]+|[\s:=–—-]+$/g, '').replace(/\s+/g, ' ').trim();
  }

  function pageLines(page) {
    const words = (page || []).filter(x => x && String(x.str || '').trim())
      .slice().sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    words.forEach(word => {
      let line = lines.find(x => Math.abs(x.y - word.y) <= 2.5);
      if (!line) { line = { y: word.y, words: [] }; lines.push(line); }
      line.words.push(word);
    });
    return lines.sort((a, b) => b.y - a.y).map(line => line.words.sort((a, b) => a.x - b.x).map(x => x.str).join(' '));
  }

  function normDate(value) {
    const m = String(value || '').match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})/);
    return m ? `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}` : '';
  }

  function number(value) {
    const s = String(value || '').replace(/\s/g, '').replace(/[^\d,.-]/g, '');
    if (!s) return '';
    if (s.includes(',') && s.includes('.')) return s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    return s.replace(',', '.');
  }

  function read(pages, fileName, opts = {}) {
    if (!Array.isArray(pages) || !pages.length || !pages.some(p => p && p.length)) {
      throw new Error(`${fileName}: không có lớp chữ để đọc. PDF scan cần được nhận dạng OCR và soát thủ công.`);
    }
    const lines = pages.map(pageLines);
    const cover = lines[0].join('\n');
    const all = lines.map(x => x.join('\n')).join('\n');
    const folded = fold(all);
    const hasTemplateCode = /ptc3\s*[/\s-]\s*bm\s*\.?\s*0?1/.test(folded);
    if (!hasTemplateCode && !opts.ocr) throw new Error(`${fileName}: chưa nhận dạng được mã mẫu PTC3/BM.01.`);

    const v = {};
    const fields = [
      ['meta.project', 'Tên dự án/tên trạm (Project)', 'Vị trí lắp đặt'],
      ['meta.site', 'Vị trí lắp đặt (Site)', 'Hãng sản xuất'],
      ['meta.manuf', 'Hãng sản xuất (Manufacturer)', 'Số chế tạo'],
      ['meta.serial', 'Số chế tạo (Serial No)', 'Năm sản xuất'],
      ['meta.year', 'Năm sản xuất (Year of manufacture)', 'Kiểu loại'],
      ['meta.type', 'Kiểu loại (Type)', 'Công suất'],
      ['meta.power', 'Công suất (Rated power)', 'Điện áp định mức'],
      ['meta.voltage', 'Điện áp định mức (Rated voltage)', 'Tổ đấu dây'],
      ['meta.vector', 'Tổ đấu dây (Vector group)', 'Dòng định mức'],
      ['meta.current', 'Dòng định mức (Rated current)', 'Lý do'],
      ['meta.reason', 'Lý do kiểm định, thí nghiệm', 'Ngày kiểm định'],
      ['meta.date', 'Ngày kiểm định, thí nghiệm (Date)', 'Điều kiện môi trường'],
    ];
    fields.forEach(([key, start, end]) => { v[key] = between(cover, start, end); });

    // Một số bản ghi dùng nhãn tiếng Anh hoặc biến thể ngắn trên bìa.
    if (!v['meta.reason']) v['meta.reason'] = between(cover, 'Lý do thí nghiệm', 'Ngày thí nghiệm');
    if (!v['meta.date']) v['meta.date'] = between(cover, 'Ngày thí nghiệm (Date)', 'Điều kiện môi trường');
    v['meta.date'] = normDate(v['meta.date']) || v['meta.date'];
    const envLine = lines[0].find(x => fold(x).includes('ambient condition')) || '';
    const temp = envLine.match(/(?:Temp\.)\s*=\s*([\d.,+-]+)/i);
    const humidity = envLine.match(/Humidity\)\s*=\s*([\d.,+-]+)/i);
    if (temp) v['meta.ambT'] = number(temp[1]);
    if (humidity) v['meta.hum'] = number(humidity[1]);

    const report = all.match(/Số\s+biên\s+bản\s*:\s*([\w./-]+)/i);
    const reportNo = report ? report[1] : '';
    const conclusion = between(cover, 'Kết luận (Conclusion)', '((SIGN))');
    if (conclusion) v['meta.conclusion'] = conclusion;

    const cfg = EquipmentTypes.get('MBA').defaultCfg();
    cfg.template = '110'; cfg.layout = '110'; cfg.topology = 'threePhase'; cfg.reportScope = 'combined';
    const state = {
      type: 'MBA', v, cfg, sum: { tick: {}, ev: {} }, att: {}, created: new Date().toISOString(),
      imported: { file: fileName, format: 'pdf', layout: '110', templateVersion: 'PTC3/BM.01', reportNo, at: new Date().toISOString() },
    };
    const warnings = ['PDF này không có trường form; các bảng số liệu cần được đối chiếu và nhập/sửa trong biểu mẫu bên phải.'];
    if (!hasTemplateCode) warnings.push('OCR chưa nhận dạng rõ mã mẫu PTC3/BM.01; ứng dụng đang dùng cấu hình 110–220 kV — xác nhận mẫu trước khi lưu.');
    if (!String(v['meta.serial'] || '').trim()) warnings.push('Chưa đọc được số chế tạo — nhập lại trong biểu mẫu.');
    if (!Common.isoDate(v['meta.date'])) warnings.push('Chưa đọc được ngày thí nghiệm — nhập lại trong biểu mẫu.');
    if (!reportNo) warnings.push('Chưa đọc được số biên bản.');
    if (pages.length !== 20) warnings.push(`Mẫu có ${pages.length} trang, khác bản PTC3/BM.01 tham chiếu 20 trang — cần kiểm tra lại bố cục.`);
    if (!/110|220/.test(fold([v['meta.site'], v['meta.voltage']].join(' ')))) warnings.push('Chưa xác nhận được đây là MBA 110–220 kV; kiểm tra loại MBA và cấu hình trước khi lưu.');
    return { state, layout: '110', count: 0, warnings, reportNo, pages: pages.length };
  }

  window.MbaPdfImportReport = { read, normDate, between };
})();
