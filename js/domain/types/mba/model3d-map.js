// Ánh xạ bộ phận MBA tới hạng mục có trong schema đang mở.
(function () {
  'use strict';
  const MAP = [
    ['tank', 'Thùng máy / nhãn máy', ['visual']], ['core', 'Lõi từ và gông từ', ['noload', 'ir']],
    ['windings', 'Cuộn dây', ['ir', 'wtgd', 'dcr', 'ratio', 'vector', 'moisture']],
    ['bush-hv', 'Sứ cao áp', ['bushing']], ['bush-mv', 'Sứ trung áp', ['bushing']],
    ['bush-n', 'Sứ trung tính', ['bushing']], ['bush-lv', 'Sứ hạ áp', ['bushing']],
    ['bct', 'Biến dòng chân sứ', ['bct']], ['oltc', 'Bộ điều áp dưới tải và tủ truyền động', ['oltc']],
    ['conservator', 'Bình dầu phụ', ['visual']], ['radiator', 'Bộ tản nhiệt và quạt', ['visual']],
    ['control', 'Tủ điều khiển', ['visual']],
  ];
  function partsFor(schema) {
    const sections = schema && Array.isArray(schema.sections) ? schema.sections : [];
    const byId = new Map(sections.map(s => [s.id, s]));
    const bushingGroups = new Set((byId.get('bushing') && byId.get('bushing').groups || []).map(g => g.id));
    const groupForPart = { 'bush-hv': ['hv'], 'bush-mv': ['mv'], 'bush-n': ['n'], 'bush-lv': ['lv', 'lv2'] };
    return MAP.filter(([id]) => !groupForPart[id] || groupForPart[id].some(group => bushingGroups.has(group)))
      .map(([id, name, ids]) => ({ id, name, items: ids.map(key => byId.get(key)).filter(Boolean).map(s => ({ id: s.id, no: s.no, title: s.title })) }))
      .filter(p => p.items.length);
  }
  window.MbaModel3DMap = { partsFor };
})();
