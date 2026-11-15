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
  function partsFor(schema) {
    const sections = schema && Array.isArray(schema.sections) ? schema.sections : [];
    const byId = new Map(sections.map(s => [s.id, s]));
    const bushingGroups = new Set((byId.get('bushing') && byId.get('bushing').groups || []).map(g => g.id));
    const groupForPart = { 'bush-hv': ['hv'], 'bush-mv': ['mv'], 'bush-n': ['n'], 'bush-lv': ['lv', 'lv2'] };
    return MAP.filter(([id]) => !groupForPart[id] || groupForPart[id].some(group => bushingGroups.has(group)))
      // hạng mục xếp theo số thứ tự của mẫu đang mở (các mẫu đánh số khác nhau)
      .map(([id, name, ids]) => ({ id, name, items: ids.map(key => byId.get(key)).filter(Boolean).map(s => ({ id: s.id, no: s.no, title: s.title }))
        .sort((a, b) => (Number(a.no) || 0) - (Number(b.no) || 0)).concat(EXTRA[id] || []) }))
      .filter(p => p.items.length);
  }
  window.MbaModel3DMap = { partsFor };
})();
