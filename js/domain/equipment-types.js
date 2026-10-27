// Đăng ký loại thiết bị. Mỗi loại khai báo biểu mẫu, cách đánh giá, đọc file xuất xưởng, chuyển sang dòng CSDL
// và cách ghi BBTN; lõi app (giao diện, CSDL, xuất file) dùng chung cho mọi loại qua giao tiếp này.
(function () {
  'use strict';

  const DEFAULT = 'MBA'; // biên bản cũ không ghi loại thiết bị là MBA
  const types = new Map();

  // Các khóa bắt buộc của một loại thiết bị
  const REQUIRED = {
    code: 'string', label: 'string', classCode: 'string',
    defaultCfg: 'function', normalizeCfg: 'function', buildSchema: 'function', evaluate: 'function', autoConclusion: 'function',
    toRows: 'object', report: 'object',
  };

  function register(def) {
    Object.entries(REQUIRED).forEach(([k, t]) => {
      if (typeof def[k] !== t) throw new Error(`Loại thiết bị ${def.code || '?'}: thiếu hoặc sai kiểu “${k}” (cần ${t})`);
    });
    if (typeof def.toRows.fieldRows !== 'function') throw new Error(`Loại thiết bị ${def.code}: thiếu toRows.fieldRows`);
    if (typeof def.report.fill !== 'function') throw new Error(`Loại thiết bị ${def.code}: thiếu report.fill`);
    types.set(def.code, Object.freeze(Object.assign({ factory: null, workflow: {}, references: {}, attSections: {} }, def)));
  }

  const codeOf = state => (state && state.type) || DEFAULT;
  function get(code) {
    const t = types.get(code || DEFAULT);
    if (!t) throw new Error(`Chưa hỗ trợ loại thiết bị “${code}”`);
    return t;
  }
  const has = code => types.has(code);
  const list = () => [...types.values()];

  window.EquipmentTypes = { register, get, has, list, codeOf, DEFAULT };
})();
