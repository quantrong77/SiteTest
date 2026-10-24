// Lưu biên bản và Test report xuất xưởng: mô-đun loại thiết bị dựng các dòng số liệu, rồi giao cho kho dữ liệu
// (repo, mặc định js/data/db.js) ghi. Lớp nghiệp vụ chỉ biết giao tiếp của repo, không biết Supabase.
(function () {
  'use strict';
  let repo = null;
  const need = () => { if (!repo) throw new Error('Chưa gắn kho dữ liệu'); return repo; };
  const typeOf = state => EquipmentTypes.get(EquipmentTypes.codeOf(state));

  // repo: { saveField(pack, state, status), importFactory(packs, fileName, fileBlob, bayId) }
  function setRepo(r) { repo = r; }

  // Biên bản hiện trường → dòng CSDL → lưu (nháp hoặc đã chốt)
  async function saveField(state, res, schema, status) {
    const pack = typeOf(state).toRows.fieldRows(state, res, schema);
    return need().saveField(pack, state, status);
  }

  // File Test report xuất xưởng → mỗi máy một lần thí nghiệm FAT
  async function importFactory(state, FX, fileBlob, bayId) {
    const T = typeOf(state);
    if (!T.toRows.factorySessions) throw new Error(`${T.label}: chưa hỗ trợ nhập Test report xuất xưởng vào CSDL`);
    return need().importFactory(T.toRows.factorySessions(FX), FX.data.fileName, fileBlob, bayId);
  }

  window.Records = { setRepo, saveField, importFactory };
})();
