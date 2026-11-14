// Xử lý danh mục tài liệu tham khảo; chỉ chứa hàm thuần, không truy cập trình duyệt hay CSDL.
(function () {
  'use strict';
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const clean = s => String(s == null ? '' : s).trim();
  function classCodesOf(group) {
    const g = norm(group);
    return /^(may bien ap|dau cach dien)$/.test(g) ? ['MBA'] : [];
  }
  const keyPart = value => clean(value).replace(/\s+/g, '').toLocaleLowerCase('vi');
  function mergeImport(existing, incoming, sections) {
    const key = d => JSON.stringify([keyPart(d.kind), keyPart(d.code), keyPart(d.edition)]);
    const byKey = new Map((existing || []).map(d => [key(d), d]));
    const rows = [];
    // dòng trùng khóa trong file Excel: dòng sau thay dòng trước, chỉ tính một lần
    const uniq = new Map();
    (incoming || []).forEach(s => uniq.set(key(s), s));
    const duplicates = (incoming || []).length - uniq.size;
    let added = 0, updated = 0, unchanged = 0;
    uniq.forEach(source => {
      const old = byKey.get(key(source));
      const row = Object.assign({}, old || {});
      Object.keys(source).forEach(k => { if (k !== '_sectionsText' && source[k] !== '' && source[k] != null) row[k] = source[k]; });
      row.kind = source.kind;
      ['code', 'edition', 'title', 'scope', 'tcvn', 'note', 'equipment_group'].forEach(k => { if (source[k] != null && clean(source[k])) row[k] = source[k]; });
      if (old && (old.sections || []).length) row.sections = old.sections;
      else row.sections = sectionsFromText(source._sectionsText, sections);
      if (!old || !old.class_codes || !old.class_codes.length) row.class_codes = classCodesOf(source.equipment_group);
      if (old && old.file_path) row.status = old.status;
      else row.status = source.status;
      ['code', 'edition', 'tcvn', 'note', 'scope', 'equipment_group'].forEach(k => { if (row[k] === '') row[k] = null; });
      const signature = JSON.stringify(row);
      if (!old) added++; else if (JSON.stringify(old) === signature) unchanged++; else updated++;
      rows.push(row);
    });
    return { rows, added, updated, unchanged, duplicates };
  }
  function parseCatalog(rows) {
    const headers = ['STT', 'Nhóm thiết bị', 'Ưu tiên', 'Số hiệu', 'Phiên bản', 'Tên tiêu chuẩn', 'Nội dung chính', 'Dùng cho', 'Trạng thái', 'TCVN tương đương', 'Ghi chú'];
    const aliases = [ ['stt'], ['nhom thiet bi'], ['uu tien'], ['so hieu'], ['phien ban'], ['ten tieu chuan', 'ten tieu chuan tieng anh'], ['noi dung chinh'], ['dung cho', 'dung cho hang muc app'], ['trang thai'], ['tcvn tuong duong'], ['ghi chu'] ];
    const headAt = (rows || []).findIndex(r => { const n = (r || []).map(norm); return n.includes('stt') && n.some(x => x.includes('so hieu')) && n.some(x => x.includes('trang thai')); });
    if (headAt < 0) return [];
    const head = (rows[headAt] || []).map(norm), idx = aliases.map(a => head.findIndex(h => a.some(x => h === x || h.startsWith(x + ' '))));
    const out = [];
    (rows || []).slice(headAt + 1).forEach(r => {
      if (!(r || []).some(v => clean(v))) return;
      const get = i => idx[i] < 0 ? '' : clean(r[idx[i]]);
      const priorityText = get(2), stars = (priorityText.match(/★/g) || []).length;
      const status = norm(get(8));
      const st = status.includes('da co ban cu') ? 'old' : status.includes('da co') ? 'have' : status.includes('dang tim') ? 'searching' : 'missing';
      const sectionText = get(7), classText = get(1);
      out.push({ kind: 'standard', equipment_group: classText, priority: stars || (Number(priorityText) >= 1 && Number(priorityText) <= 3 ? Number(priorityText) : 1), code: get(3), edition: get(4), title: get(5), scope: get(6), sections: [], class_codes: classCodesOf(classText), status: st, tcvn: get(9), note: get(10), _sectionsText: sectionText });
    });
    return out.filter(x => x.title || x.code);
  }
  function sectionsFromText(text, sections) {
    const src = norm(text), found = new Set();
    (sections || []).forEach(s => {
      const no = String(s.no == null ? '' : s.no).trim();
      if (no && new RegExp('(?:muc\\s*' + no.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + '|(?:^|\\D)' + no.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + '(?=\\D|$))').test(src)) found.add(s.id);
      const title = norm(s.title); if (title && src.includes(title)) found.add(s.id);
    });
    return Array.from(found);
  }
  // Tài liệu cho khung tham khảo của một hạng mục: tài liệu gắn đúng hạng mục; quy trình / hướng dẫn máy đo không gắn hạng mục nào
  // (dùng chung cho cả loại thiết bị) cũng hiện. Tiêu chuẩn chưa gắn hạng mục chỉ xem ở trang Thư viện (tránh tràn danh sách).
  function forSection(docs, secId, classCode) {
    const matched = (docs || []).filter(d => (d.sections || []).includes(secId)
      || (d.kind !== 'standard' && !(d.sections || []).length && (d.class_codes || []).includes(classCode)));
    matched.sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0) || String(a.code || '').localeCompare(String(b.code || ''), 'vi'));
    return matched.reduce((groups, d) => { (groups[d.kind] || (groups[d.kind] = [])).push(d); return groups; }, {});
  }
  window.Library = { parseCatalog, sectionsFromText, forSection, classCodesOf, mergeImport };
})();
