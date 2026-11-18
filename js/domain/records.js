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
  // serials (tùy chọn): chỉ lưu các máy này (file có nhiều máy của các ngăn khác nhau)
  async function importFactory(state, FX, fileBlob, bayId, serials) {
    const T = typeOf(state);
    if (!T.toRows.factorySessions) throw new Error(`${T.label}: chưa hỗ trợ nhập Test report xuất xưởng vào CSDL`);
    const want = serials && serials.length ? new Set(serials.map(s => String(s).trim().toUpperCase())) : null;
    const packs = T.toRows.factorySessions(FX).filter(p => !want || want.has(String(p.serial).trim().toUpperCase()));
    if (!packs.length) throw new Error('Không có máy nào được chọn để lưu');
    return need().importFactory(packs, FX.data.fileName, fileBlob, bayId);
  }

  window.Records = { setRepo, saveField, importFactory };
})();
