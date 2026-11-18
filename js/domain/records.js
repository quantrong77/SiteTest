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
  // meta (tùy chọn): { test_date: 'yyyy-mm-dd', report_no } người dùng nhập tay — thay giá trị đọc từ file (file không ghi / đọc sai)
  async function importFactory(state, FX, fileBlob, bayId, serials, meta) {
    const T = typeOf(state);
    if (!T.toRows.factorySessions) throw new Error(`${T.label}: chưa hỗ trợ nhập Test report xuất xưởng vào CSDL`);
    const want = serials && serials.length ? new Set(serials.map(s => String(s).trim().toUpperCase())) : null;
    const packs = T.toRows.factorySessions(FX).filter(p => !want || want.has(String(p.serial).trim().toUpperCase()));
    if (!packs.length) throw new Error('Không có máy nào được chọn để lưu');
    const date = meta && String(meta.test_date || '').trim(), no = meta && String(meta.report_no || '').trim();
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Ngày thí nghiệm “${date}” không hợp lệ`);
    packs.forEach(p => { if (date) p.session.test_date = date; if (no) p.session.report_no = no; });
    if (packs.some(p => !p.session.test_date)) throw new Error('Không đọc được ngày thí nghiệm trong file xuất xưởng — nhập tay ngày thí nghiệm rồi lưu');
    return need().importFactory(packs, FX.data.fileName, fileBlob, bayId);
  }

  window.Records = { setRepo, saveField, importFactory };
})();
