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

  // equipment: dòng v_equipment; sessions: dòng v_session_list kind = 'FAT'; localFiles: [{ name, units: [{ serial, phase }] }];
  // cat: { substations, bays } — danh mục đầy đủ (trạm, ngăn chưa có thiết bị vẫn hiện)
  // → [{ id, type: 'station'|'bay'|'equipment'|'serial'|'group'|'file'|'localunit', label, sub, children, ... }]
  // Mọi thiết bị gốc trong danh mục đều hiện; thiết bị chưa có lần FAT: noFat = true, sessionId rỗng.
  function build(equipment, sessions, localFiles, cat) {
    equipment = equipment || []; sessions = sessions || []; localFiles = localFiles || []; cat = cat || {};
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
    const bayNode = (st, code, name, bayId) => {
      if (!st.bays.has(code)) {
        const bay = { id: `bay:${st.label}|${code}`, type: 'bay', label: code, sub: name || '', bayId: bayId || '', children: [] };
        st.bays.set(code, bay); st.children.push(bay);
      }
      const b = st.bays.get(code);
      if (!b.sub && name) b.sub = name;
      if (!b.bayId && bayId) b.bayId = bayId;
      return b;
    };
    // khung danh mục: mọi trạm, ngăn (kể cả chưa có thiết bị)
    const subName = new Map((cat.substations || []).map(s => [s.id, s.name]));
    (cat.substations || []).forEach(s => stationNode(s.name));
    (cat.bays || []).forEach(b => { const n = b.substation_name || subName.get(b.substation_id); if (n) bayNode(stationNode(n), b.code, b.name, b.id); });
    const fatSerials = new Set();
    // thiết bị gốc: trong danh mục (không có parent_id) + thiết bị có lần FAT mà danh sách thiết bị chưa có
    const rootIds = [...new Set(equipment.filter(e => !e.parent_id).map(e => e.id).concat([...fatOf.keys()]))];
    rootIds.forEach(eqId => {
      const e = eqById.get(eqId) || { id: eqId };
      const s = fatOf.get(eqId) || null;
      const serial = e.serial_no || (s && s.serial_no) || '';
      if (s) fatSerials.add(serialKey(serial));
      const st = stationNode(e.substation_name || (s && s.substation_name) || '');
      const bayCode = e.bay_code || (s && s.bay_code) || '';
      const parent = bayCode ? bayNode(st, bayCode, e.bay_name, e.bay_id) : st;
      const name = e.name || (s && s.equipment_name) || '';
      const sid = s ? s.id : '';
      const eqNode = {
        id: `eq:${eqId}`, type: 'equipment', label: name || `${e.class_name || e.class_code || 'Thiết bị'} ${serial}`.trim(),
        sub: [e.class_name || e.class_code, e.phase ? `pha ${e.phase}` : '', s ? '' : 'chưa có test report'].filter(Boolean).join(' · '),
        equipmentId: eqId, sessionId: sid, noFat: !s, children: [],
      };
      eqNode.children.push({ id: `sn:${eqId}`, type: 'serial', label: serial, sub: 'Máy chính', equipmentId: eqId, rootId: eqId, sessionId: sid, noFat: !s, children: [] });
      // thiết bị con đang lắp trước, đã tháo (thay sứ…) sau — vẫn hiện để tra lịch sử
      (childrenOf.get(eqId) || []).slice().sort((a, b) => (!!a.removed_on - !!b.removed_on)
        || String(a.position || a.serial_no).localeCompare(String(b.position || b.serial_no), 'vi', { numeric: true }))
        .forEach(c => eqNode.children.push({
          id: `sn:${c.id}`, type: 'serial', label: c.serial_no, removed: !!c.removed_on,
          sub: [c.class_name || c.class_code, c.position ? `đầu ${c.position}` : '', c.phase ? `pha ${c.phase}` : '',
            c.removed_on ? `đã tháo ${String(c.removed_on).slice(0, 10).split('-').reverse().join('/')}` : ''].filter(Boolean).join(' · '),
          equipmentId: c.id, rootId: eqId, sessionId: sid, noFat: !s, children: [],
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

  // Lưu test report (.xlsx) lên CSDL: tình trạng từng máy trong file so với danh mục và các lần FAT đã lưu.
  // units: [{ serial, phase }]; equipment: danh mục (máy chính); sessions: các lần FAT; opts: { bayId (ngăn của ngữ cảnh), target (số chế tạo cần nhập) }
  // → { rows: [{ serial, phase, eqId, name, bayId, where, hasFat, fatDate, pick }], bayId (ngăn đề xuất cho máy mới / chưa gắn), missingTarget }
  // Mặc định chọn máy chưa có FAT (máy đã có: lưu lại sẽ ghi đè lần FAT cũ, kể cả giá trị đã sửa tay) và máy đang nhập cho ngữ cảnh.
  function importPlan(units, equipment, sessions, opts) {
    opts = opts || {};
    const up = s => String(s || '').trim().toUpperCase();
    const target = up(opts.target);
    const rows = (units || []).map(u => {
      const e = (equipment || []).find(x => !x.parent_id && up(x.serial_no) === up(u.serial)) || null;
      const fats = (sessions || []).filter(s => (e && s.equipment_id === e.id) || up(s.serial_no) === up(u.serial))
        .sort((a, b) => String(b.test_date || '').localeCompare(String(a.test_date || '')));
      const where = e ? [e.substation_name, e.bay_code].filter(Boolean).join(' · ') : '';
      return { serial: u.serial, phase: u.phase || '', eqId: e ? e.id : '', name: e ? e.name || '' : '', bayId: e ? e.bay_id || '' : '', where,
        hasFat: fats.length > 0, fatDate: fats.length ? fats[0].test_date || '' : '', pick: !fats.length || (!!target && up(u.serial) === target) };
    });
    const known = rows.find(r => r.bayId);
    return { rows, bayId: opts.bayId || (known ? known.bayId : ''), missingTarget: !!target && !rows.some(r => up(r.serial) === target) };
  }

  window.FactoryTree = { build, filter, leaves, editDiff, fold, importPlan, UNASSIGNED };
})();
