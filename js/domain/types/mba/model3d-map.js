// Ánh xạ bộ phận MBA tới hạng mục có trong schema đang mở.
(function () {
  'use strict';
  const MAP = [
    ['tank', 'Thùng máy / nhãn máy', ['visual']], ['core', 'Lõi từ và gông từ', ['noload', 'ir']],
    ['windings', 'Cuộn dây', ['ir', 'wtgd', 'dcr', 'ratio', 'vector', 'moisture']],
    ['bush-hv', 'Sứ cao áp', ['bushing']], ['bush-mv', 'Sứ trung áp', ['bushing']],
    ['bush-n', 'Sứ trung tính', ['bushing']], ['bush-lv', 'Sứ hạ áp', ['bushing']],
    ['bct', 'Biến dòng chân sứ', ['bct']], ['oltc', 'Bộ điều áp dưới tải và tủ truyền động', ['oltc']],
    ['conservator', 'Bình dầu phụ và dầu cách điện', ['visual']], ['radiator', 'Bộ tản nhiệt và quạt', ['visual']],
    ['control', 'Tủ điều khiển', ['visual']],
  ];
  // Mục ngoài biểu mẫu gắn thêm vào bộ phận (không có kết quả đánh giá): dầu MBA ở trang Phụ lục và app DGA
  const EXTRA = {
    conservator: [
      { extra: true, id: 'appendix', anchor: 'appx-oil', no: 'PL', title: 'Dầu MBA — nạp BBTN DGA, lý hóa dầu' },
      { extra: true, link: 'dga', no: '', title: 'Mở app DGA (phân tích khí hòa tan) ↗' },
    ],
  };
  // Nhóm sứ có cột trung tính N trong bảng tgδ (mẫu 1 pha / 110 kV gộp N vào nhóm 5.2 "trung áp và trung tính")
  const hasNeutralCol = group => (group.grids || []).some(grid => (grid.cols || []).some(c => c.k === 'N') && !String(grid.id || '').startsWith('b.ac'));
  function partsFor(schema) {
    const sections = schema && Array.isArray(schema.sections) ? schema.sections : [];
    const byId = new Map(sections.map(s => [s.id, s]));
    const groups = byId.get('bushing') && byId.get('bushing').groups || [];
    const bushingGroups = new Set(groups.map(g => g.id));
    // Sứ trung tính phần lớn có đầu đo tgδ nên thí nghiệm như sứ cao, trung áp: có nhóm riêng 'n' hoặc cột N trong nhóm khác
    const neutralIn = bushingGroups.has('n') ? null : groups.find(g => g.id !== 'ac' && hasNeutralCol(g));
    if (neutralIn) bushingGroups.add('n');
    const groupForPart = { 'bush-hv': ['hv'], 'bush-mv': ['mv'], 'bush-n': ['n'], 'bush-lv': ['lv', 'lv2'] };
    return MAP.filter(([id]) => !groupForPart[id] || groupForPart[id].some(group => bushingGroups.has(group)))
      // hạng mục xếp theo số thứ tự của mẫu đang mở (các mẫu đánh số khác nhau)
      .map(([id, name, ids]) => ({ id, name, items: ids.map(key => byId.get(key)).filter(Boolean)
        .map(s => ({ id: s.id, no: s.no, title: id === 'bush-n' && neutralIn && s.id === 'bushing' ? `${s.title} — cột N ở ${neutralIn.title}` : s.title }))
        .sort((a, b) => (Number(a.no) || 0) - (Number(b.no) || 0)).concat(EXTRA[id] || []) }))
      .filter(p => p.items.length);
  }
  // Sứ từng pha cho mô hình: mỗi sứ trỏ tới cột pha trong bảng "Số liệu đo" của nhóm sứ (ô tgδ C1 để nhảy tới).
  // Trả { 'bush-hv': [{ k, label, grid, cell }], ... }; sứ N gom cột N (mẫu 1 pha / 110 kV) hoặc cả nhóm 'n' (mẫu 3 pha: N từng máy).
  function bushingPhases(schema) {
    const sections = schema && Array.isArray(schema.sections) ? schema.sections : [];
    const sec = sections.find(s => s.id === 'bushing');
    const out = { 'bush-hv': [], 'bush-mv': [], 'bush-n': [], 'bush-lv': [] };
    const partOf = { hv: 'bush-hv', mv: 'bush-mv', n: 'bush-n', lv: 'bush-lv' };
    (sec && sec.groups || []).forEach(g => {
      const part = partOf[g.id];
      if (!part) return;
      const grid = (g.grids || []).find(gr => /\.meas$/.test(String(gr.id || '')));
      if (!grid) return;
      const row = (grid.rows || []).some(r => r.k === 'tgd1') ? 'tgd1' : (grid.rows || [])[0] && grid.rows[0].k;
      (grid.cols || []).filter(c => c.phase).forEach(c => {
        const target = g.id !== 'n' && c.k === 'N' ? 'bush-n' : part;
        out[target].push({ k: c.k, label: c.label, grid: grid.id, group: g.id, cell: `${grid.id}.${row}.${c.k}` });
      });
    });
    return out;
  }
  window.MbaModel3DMap = { partsFor, bushingPhases };
})();
