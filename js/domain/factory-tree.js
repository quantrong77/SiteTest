// Số liệu xuất xưởng (lần thí nghiệm FAT trong CSDL + file .xlsx chỉ nạp trên máy): cây Trạm → Ngăn → Thiết bị → Số chế tạo,
// tìm nhanh không dấu, và tính các dòng cần cập nhật khi sửa tay giá trị đo. Hàm thuần — không gọi CSDL, không đụng DOM.
(function () {
  'use strict';
  const { toNum, ok } = Common;
  const fold = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
  const serialKey = s => String(s || '').trim().toUpperCase();
  const byLabel = (a, b) => String(a.label).localeCompare(String(b.label), 'vi', { numeric: true });
  const UNASSIGNED = 'Chưa gắn trạm / ngăn';

  // equipment: dòng v_equipment; sessions: dòng v_session_list kind = 'FAT'; localFiles: [{ name, units: [{ serial, phase }] }]
  // → [{ id, type: 'station'|'bay'|'equipment'|'serial'|'group'|'file'|'localunit', label, sub, children, ... }]
  function build(equipment, sessions, localFiles) {
    equipment = equipment || []; sessions = sessions || []; localFiles = localFiles || [];
    const eqById = new Map(equipment.map(e => [e.id, e]));
    // lần FAT mới nhất của từng máy chính
    const fatOf = new Map();
    sessions.forEach(s => {
      const cur = fatOf.get(s.equipment_id);
      if (!cur || String(s.test_date || '') > String(cur.test_date || '')) fatOf.set(s.equipment_id, s);
    });
    const childrenOf = new Map();
    equipment.forEach(e => { if (e.parent_id) (childrenOf.get(e.parent_id) || childrenOf.set(e.parent_id, []).get(e.parent_id)).push(e); });

    const stations = new Map();
    const stationNode = name => {
      const key = name || '';
      if (!stations.has(key)) stations.set(key, { id: `st:${key || '-'}`, type: 'station', label: name || UNASSIGNED, unassigned: !name, children: [], bays: new Map() });
      return stations.get(key);
    };
    const fatSerials = new Set();
    [...fatOf.keys()].forEach(eqId => {
      const e = eqById.get(eqId) || { id: eqId };
      const s = fatOf.get(eqId);
      const serial = e.serial_no || s.serial_no || '';
      fatSerials.add(serialKey(serial));
      const st = stationNode(e.substation_name || s.substation_name || '');
      const bayCode = e.bay_code || s.bay_code || '';
      let parent = st;
      if (bayCode) {
        if (!st.bays.has(bayCode)) {
          const bay = { id: `bay:${st.label}|${bayCode}`, type: 'bay', label: bayCode, sub: e.bay_name || '', children: [] };
          st.bays.set(bayCode, bay); st.children.push(bay);
        }
        parent = st.bays.get(bayCode);
      }
      const name = e.name || s.equipment_name || '';
      const eqNode = {
        id: `eq:${eqId}`, type: 'equipment', label: name || `${e.class_name || e.class_code || 'Thiết bị'} ${serial}`.trim(),
        sub: [e.class_name || e.class_code, e.phase ? `pha ${e.phase}` : ''].filter(Boolean).join(' · '), equipmentId: eqId, sessionId: s.id, children: [],
      };
      eqNode.children.push({ id: `sn:${eqId}`, type: 'serial', label: serial, sub: 'Máy chính', equipmentId: eqId, rootId: eqId, sessionId: s.id, children: [] });
      (childrenOf.get(eqId) || []).slice().sort((a, b) => String(a.position || a.serial_no).localeCompare(String(b.position || b.serial_no), 'vi', { numeric: true }))
        .forEach(c => eqNode.children.push({
          id: `sn:${c.id}`, type: 'serial', label: c.serial_no, sub: [c.class_name || c.class_code, c.position ? `đầu ${c.position}` : '', c.phase ? `pha ${c.phase}` : ''].filter(Boolean).join(' · '),
          equipmentId: c.id, rootId: eqId, sessionId: s.id, children: [],
        }));
      parent.children.push(eqNode);
    });
    const tree = [...stations.values()].sort((a, b) => (a.unassigned - b.unassigned) || byLabel(a, b)).map(st => {
      st.children.sort(byLabel); st.children.forEach(c => c.children && c.type === 'bay' && c.children.sort(byLabel));
      delete st.bays; return st;
    });
    // file .xlsx trên máy: chỉ các máy chưa có số liệu xuất xưởng trong CSDL
    const local = localFiles.map(f => ({
      id: `file:${f.name}`, type: 'file', label: f.name, file: f.name, children: (f.units || []).filter(u => !fatSerials.has(serialKey(u.serial)))
        .map(u => ({ id: `lu:${f.name}|${u.serial}`, type: 'localunit', label: u.serial, sub: u.phase ? `pha ${u.phase}` : '', file: f.name, serial: u.serial, children: [] })),
    })).filter(f => f.children.length);
    if (local.length) tree.push({ id: 'local', type: 'group', label: 'Chưa lưu CSDL (file trên máy này)', local: true, children: local });
    return tree;
  }

  // Tìm không phân biệt hoa thường / dấu trên nhãn và mô tả. Nút khớp giữ nguyên các nút con; trả về cây đã lọc + id các nút cần mở.
  function filter(tree, query) {
    const q = fold(query);
    if (!q) return { tree, open: new Set() };
    const open = new Set();
    const walk = nodes => nodes.map(n => {
      const self = fold(`${n.label} ${n.sub || ''}`).includes(q);
      if (self) return n;
      const kids = walk(n.children || []);
      if (kids.length) { open.add(n.id); return Object.assign({}, n, { children: kids }); }
      return null;
    }).filter(Boolean);
    const out = walk(tree);
    return { tree: out, open };
  }

  // Các dòng lá (Số chế tạo / máy trong file) dưới một nút — để lọc danh sách theo nút đang chọn
  function leaves(node) {
    if (!node) return [];
    if (!node.children || !node.children.length) return [node];
    return node.children.flatMap(leaves);
  }

  const vnDate = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d || ''); };
  const showVal = r => (ok(r.value) || (r.value !== null && r.value !== undefined && r.value !== '') ? String(r.value) : (r.value_text || '—'));

  // rows: dòng measurements đang có ({ id, value, value_text, value_norm, note }); edits: { id: chuỗi người nhập }
  // → { updates: [{ id, value, value_text, value_norm, note }], errors: [{ id, msg }] }
  // value_norm co giãn theo tỷ lệ mới / cũ: các quy đổi nhiệt độ trong app đều nhân hệ số ở cùng nhiệt độ đo.
  function editDiff(rows, edits, opts) {
    opts = opts || {};
    const who = opts.who || 'không rõ', date = vnDate(opts.date || new Date().toISOString().slice(0, 10));
    const updates = [], errors = [];
    (rows || []).forEach(r => {
      if (!edits || !Object.prototype.hasOwnProperty.call(edits, r.id)) return;
      const text = String(edits[r.id] == null ? '' : edits[r.id]).trim();
      const oldNum = r.value === null || r.value === undefined || r.value === '' ? NaN : Number(r.value);
      const wasNum = Number.isFinite(oldNum);
      if (!text) { errors.push({ id: r.id, msg: 'Không để trống giá trị xuất xưởng' }); return; }
      let value = null, valueText = null;
      if (wasNum) {
        const n = toNum(text);
        if (!ok(n)) { errors.push({ id: r.id, msg: `“${text}” không phải số` }); return; }
        if (n === oldNum) return;
        value = n;
      } else {
        const n = toNum(text);
        if (ok(n) && /^[\s\d.,+-]+$/.test(text)) value = n; else valueText = text;
        if (valueText !== null && valueText === (r.value_text || '')) return;
      }
      let norm = r.value_norm === null || r.value_norm === undefined || r.value_norm === '' ? null : Number(r.value_norm);
      if (norm !== null) norm = wasNum && oldNum !== 0 && value !== null ? Math.round(norm * value / oldNum * 1e9) / 1e9 : null;
      const mark = `Sửa tay ${date} – ${who}: ${showVal(r)} → ${value !== null ? value : valueText}`;
      updates.push({ id: r.id, value, value_text: valueText, value_norm: norm, note: r.note ? `${r.note}; ${mark}` : mark });
    });
    return { updates, errors };
  }

  window.FactoryTree = { build, filter, leaves, editDiff, fold, UNASSIGNED };
})();
