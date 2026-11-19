// Khởi tạo BBTN theo danh mục: nhận dạng thiết bị trong ngăn (tổ 3 máy 1 pha rời / máy đơn) và dựng thông số kỹ thuật điền đầu
// biên bản theo thứ tự nguồn CSDL → test report → nhập tay. Hàm thuần — không gọi CSDL, không đụng DOM.
(function () {
  'use strict';
  const str = x => (x === null || x === undefined ? '' : String(x).trim());
  const PHASES = ['A', 'B', 'C'];

  // Thiết bị gốc (không có parent_id) cùng loại trong một ngăn. Có ≥2 máy mang pha A/B/C khác nhau → tổ 3 máy 1 pha rời.
  // → { bank: { A, B, C } | null, singles: [eq] } (máy của tổ không lặp trong singles)
  // groups (tùy chọn): dòng v_equipment_groups (eq_a, eq_b, eq_c) — tổ máy khai trong CSDL được ưu tiên hơn suy theo pha
  function bayUnits(equipment, bayId, classCode, groups) {
    const roots = (equipment || []).filter(e => e.bay_id === bayId && !e.parent_id && (!classCode || e.class_code === classCode) && e.status !== 'retired');
    const byId = new Map((equipment || []).map(e => [e.id, e]));
    const grp = (groups || []).find(g => g.bay_id === bayId && (!classCode || !g.class_code || g.class_code === classCode));
    let byPhase = {}, group = null;
    if (grp) {
      PHASES.forEach(p => { const e = byId.get(grp[`eq_${p.toLowerCase()}`]); if (e) byPhase[p] = e; });
      group = { id: grp.id, name: grp.name };
    } else roots.forEach(e => { const p = str(e.phase).toUpperCase(); if (PHASES.includes(p) && !byPhase[p]) byPhase[p] = e; });
    if (Object.keys(byPhase).length < 2) { byPhase = {}; group = null; }
    const bank = Object.keys(byPhase).length >= 2 ? Object.assign(byPhase, group ? { group } : {}) : null;
    const inBank = new Set(bank ? PHASES.filter(p => bank[p]).map(p => bank[p].id) : []);
    const singles = roots.filter(e => !inBank.has(e.id))
      .sort((a, b) => str(a.name || a.serial_no).localeCompare(str(b.name || b.serial_no), 'vi', { numeric: true }));
    return { bank, singles };
  }

  // Test report: giá trị theo cuộn { HV, MV, LV } → "HV/MV/LV" như cách ghi trên BBTN
  const joinSides = rec => {
    if (rec === null || rec === undefined) return '';
    if (typeof rec !== 'object') return str(rec);
    return ['HV', 'MV', 'LV'].map(s => str(rec[s])).filter(Boolean).join('/');
  };

  // eq: dòng v_equipment (có thể null — thiết bị mới); fx: FX.data.specs của test report (có thể null);
  // ctx: { substation, bay } (tên trạm, ngăn để điền "Tên dự án / tên trạm", "Vị trí lắp đặt");
  // hist (tùy chọn): BBTN gần nhất của thiết bị trong CSDL { v: app_state.v, date } — nguồn cuối khi CSDL / test report không có
  // → { khóa ô: { value, src: 'CSDL' | 'Test report' | 'BBTN dd/mm/yyyy' } } — chỉ các ô có giá trị
  function headFrom(eq, fx, ctx, hist) {
    eq = eq || {}; fx = fx || {}; ctx = ctx || {};
    const hv = (hist && hist.v) || {};
    const HB = hist ? `BBTN ${String(hist.date || '').slice(0, 10).split('-').reverse().join('/')}`.trim() : '';
    const rated = eq.rated || {};
    const out = {};
    const put = (k, ...cands) => {
      for (const [v, src] of cands) { const s = str(v); if (s) { out[k] = { value: s, src }; return; } }
    };
    const DB = 'CSDL', TR = 'Test report';
    const H = k => [hv[k], HB];
    put('meta.project', [ctx.substation, DB], H('meta.project'));
    put('meta.site', [eq.name, DB], [ctx.bay, DB], H('meta.site'));
    put('meta.manuf', [eq.manufacturer, DB], [fx.manufacturer, TR], H('meta.manuf'));
    put('meta.type', [eq.model, DB], [fx.type, TR], H('meta.type'));
    put('meta.year', [eq.year_made, DB], [fx.year, TR], H('meta.year'));
    put('meta.power', [rated.power_mva, DB], [joinSides(fx.power), TR], H('meta.power'));
    // điện áp, dòng định mức: CSDL chỉ giữ một phần (vd chỉ cuộn cao áp) → test report (đủ HV/MV/LV) trước, rồi BBTN cũ, cuối cùng CSDL
    put('meta.voltage', [joinSides(fx.voltage), TR], H('meta.voltage'), [rated.voltage, DB]);
    put('meta.current', [joinSides(fx.current), TR], H('meta.current'), [rated.current_a, DB]);
    put('meta.vector', [rated.vector_group, DB], [fx.vector, TR], H('meta.vector'));
    return out;
  }

  // Ô nào được ghi: ô trống hoặc ô còn đúng giá trị mặc định của template (tplHead); ô người dùng đã nhập giữ nguyên
  // → { khóa: { value, src } }
  function fillPlan(v, fills, tplHead) {
    v = v || {}; tplHead = tplHead || {};
    const plan = {};
    Object.entries(fills || {}).forEach(([k, f]) => {
      const cur = str(v[k]);
      if (cur === f.value) return;
      if (!cur || cur === str(tplHead[k])) plan[k] = f;
    });
    return plan;
  }

  // các ô đầu biên bản headFrom có thể điền (thông số thiết bị, không gồm số chế tạo / lần thí nghiệm)
  const SPEC_KEYS = ['meta.project', 'meta.site', 'meta.manuf', 'meta.type', 'meta.year', 'meta.power', 'meta.voltage', 'meta.current', 'meta.vector'];

  // Ô thông số không có nguồn nào mà vẫn còn giá trị mẫu của template (số liệu của biên bản khác) → xóa để nhập tay
  function staleKeys(v, fills, tplHead) {
    v = v || {}; tplHead = tplHead || {};
    return SPEC_KEYS.filter(k => !(fills || {})[k] && str(tplHead[k]) && str(v[k]) === str(tplHead[k]));
  }

  window.EquipmentSpecs = { bayUnits, headFrom, fillPlan, staleKeys, joinSides, PHASES, SPEC_KEYS };
})();
