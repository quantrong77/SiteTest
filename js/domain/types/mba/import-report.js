// MBA: đọc ngược BBTN cũ (.docx đã điền số liệu theo các mẫu app hỗ trợ) thành biên bản của app để soát và lưu CSDL làm
// chuỗi xu hướng. Dùng đúng ánh xạ ô (bảng, hàng, cột) của schema dùng để xuất BBTN; ô tự tính bỏ qua (app tính lại).
// tpl là DocxTemplate đã nạp file BBTN; không truy cập giao diện hay CSDL.
(function () {
  'use strict';
  const { eachGrid } = Common;

  // Mẫu BBTN theo số bảng cấp thân văn bản: mẫu chung 3 pha 28 (26–32), MBA 3 pha 110-220 71, mẫu theo pha 73 (≥ 72)
  function detectLayout(nTables) {
    if (nTables >= 26 && nTables <= 32) return Schema.LAYOUT_3P;
    if (nTables === 71) return Schema.LAYOUT_110;
    if (nTables >= 72 && nTables <= 74) return '1P';
    return null;
  }
  const TEMPLATE_OF = { '1P': 'A', '3P': '3P', '110': '110' };

  // Ngày trong ô "Ngày thí nghiệm": dd/mm/yyyy, dd.mm.yyyy, "ngày 14 tháng 11 năm 2026" → dd/mm/yyyy
  function normDate(s) {
    const t = String(s || '');
    let m = t.match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})/);
    if (!m) m = t.match(/ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/i);
    return m ? `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}` : '';
  }

  // Số ô có số liệu của các lưới khớp mẫu id (đếm trên giá trị đã đọc)
  const filled = (v, re) => Object.keys(v).filter(k => re.test(k) && String(v[k]).trim()).length;

  // Số cuộn thứ cấp biến dòng chân sứ của từng phía: thử từng cấu hình, chọn cấu hình đọc được nhiều ô nhất
  function detectBct(tpl, cfg) {
    const T = EquipmentTypes.get('MBA');
    const out = Object.assign({}, cfg.bctCores);
    Object.entries({ hv: [4, 5, 6], mv: [4, 5], lv: [4] }).forEach(([side, opts]) => {
      let best = { n: out[side], cnt: -1 };
      opts.forEach(n => {
        const c = Object.assign({}, cfg, { bctCores: Object.assign({}, out, { [side]: n }) });
        const s = T.buildSchema(c);
        if (!s.sections.some(x => x.id === 'bct' && x.groups && x.groups.some(g => g.grids.some(gr => gr.tables)))) return; // mẫu 3 pha: phụ lục
        const cnt = filled(Report.readValues(tpl, s), new RegExp(`^bct\\.${side}\\.(ir|ratio|dcr)\\.`));
        if (cnt > best.cnt) best = { n, cnt };
      });
      out[side] = best.n;
    });
    return out;
  }

  // Mẫu 110–220 kV: đề mục đứng trước bảng nấc R một chiều ghi cuộn trung áp ("Cuộn dây trung áp, ( M.V Winding )")
  // → OLTC đặt ở cuộn trung áp (MBA 220 kV kiểu Liên Xô cũ, BBTN xuất từ app hoặc đơn vị tự đổi nhãn)
  function detectOltcWinding(tpl, schema) {
    const dcr = schema.sections.find(s => s.id === 'dcr');
    const hv = dcr && dcr.groups && dcr.groups.find(g => g.id === 'hv');
    const t = hv && hv.grids[0].tables && hv.grids[0].tables[0];
    if (t === undefined || !tpl.paraBefore || !tpl.paraText) return 'HV';
    const p = tpl.paraBefore(t, /Winding/i);
    return p && /M\.?\s*V\.?\s+Winding|trung\s+(?:áp|thế)/i.test(tpl.paraText(p)) ? 'MV' : 'HV';
  }

  // Một file BBTN → { state, layout, count, warnings }; lỗi khi không nhận ra mẫu
  function read(tpl, fileName) {
    const T = EquipmentTypes.get('MBA');
    const n = tpl.bodyTableCount ? tpl.bodyTableCount() : tpl.tables.length;
    const layout = detectLayout(n);
    if (!layout) throw new Error(`${fileName}: phần biên bản có ${n} bảng — không khớp mẫu BBTN MBA nào (mẫu theo pha 73, MBA 3 pha 110–220 kV 71, mẫu chung 3 pha 28)`);
    const cfg = T.defaultCfg();
    cfg.template = TEMPLATE_OF[layout];
    cfg.bctCores = detectBct(tpl, cfg);
    if (layout === Schema.LAYOUT_110) cfg.oltcWinding = detectOltcWinding(tpl, T.buildSchema(cfg));
    const schema = T.buildSchema(cfg);
    const v = Report.readValues(tpl, schema, { all: true });
    if (v['meta.date']) v['meta.date'] = normDate(v['meta.date']) || v['meta.date'];
    // mẫu 3 pha: ô "Số chế tạo" ghi số chế tạo cả 3 máy "S1; S2; S3" → máy chính là số đầu, cột pha theo thứ tự A, B, C
    if (layout === Schema.LAYOUT_3P && /;/.test(v['meta.serial'] || '')) {
      const sn = v['meta.serial'].split(';').map(x => x.trim()).filter(Boolean);
      ['A', 'B', 'C'].forEach((ph, i) => { if (sn[i]) cfg.ps[ph] = sn[i]; });
      v['meta.serial'] = sn[0] || '';
    }
    let count = 0;
    eachGrid(schema, g => { if (g.tables) count += filled(v, new RegExp(`^${g.id.replace(/\./g, '\\.')}\\.`)); });
    const warnings = [];
    if (!String(v['meta.serial'] || '').trim()) warnings.push('Không đọc được số chế tạo — nhập tay trước khi lưu CSDL');
    if (!Common.isoDate(v['meta.date'])) warnings.push(`Không đọc được ngày thí nghiệm${v['meta.date'] ? ` (“${v['meta.date']}”)` : ''} — cần dạng dd/mm/yyyy`);
    if (count < 5) warnings.push(`Chỉ đọc được ${count} ô số liệu — kiểm tra file có đúng mẫu không`);
    const state = {
      type: 'MBA', v, cfg, sum: { tick: {}, ev: {} }, att: {}, created: new Date().toISOString(),
      imported: { file: fileName, layout, at: new Date().toISOString() },
    };
    return { state, layout, count, warnings };
  }

  window.MbaImportReport = { detectLayout, detectOltcWinding, normDate, read };
})();
