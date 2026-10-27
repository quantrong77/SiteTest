// Đăng ký loại thiết bị Máy biến áp (MBA): biểu mẫu theo template BBTN MBA 500 kV, đánh giá QĐ 1901,
// file Test report xuất xưởng, dòng CSDL và cách ghi BBTN.
(function () {
  'use strict';
  const lastNum = s => { const m = String(s || '').match(/[\d.]+(?=\s*$)/); return m ? m[0] : ''; };

  function defaultCfg() {
    return {
      template: 'A', ps: { A: '', B: '', C: '' }, taps: Schema.DEFAULT_TAPS.slice(), hvMeas: 'SER+COM', lvMode: 'unit',
      iLV: '', sLV: '', sR: '', i0Ref: '', bC1Dev: '', bTgdMax: '', bctCores: { hv: 4, mv: 4, lv: 4 },
      ctNo: { hv: '1,2,3,4,5,6', mv: '4,5,6,7,8', n: '8,9,10', lv: '11,12,13,14' }, bctErrLimit: '', decSep: ',',
      hdr: {}, wtgdLabels: {}, wtgdRows: [], oltcCharts: 'all',
    };
  }

  // Cấu hình đọc từ biên bản đã lưu: bổ sung khóa mới (biên bản cũ) mà không đổi giá trị đã có
  function normalizeCfg(saved) {
    const d = defaultCfg();
    const cfg = Object.assign(d, saved);
    cfg.ps = Object.assign(defaultCfg().ps, saved.ps || {});
    cfg.ctNo = Object.assign(defaultCfg().ctNo, saved.ctNo || {});
    cfg.bctCores = Object.assign(defaultCfg().bctCores, saved.bctCores || {});
    cfg.hdr = cfg.hdr || {}; cfg.wtgdLabels = cfg.wtgdLabels || {}; cfg.wtgdRows = cfg.wtgdRows || [];
    return cfg;
  }

  // Điền các thông số còn trống từ file xuất xưởng (số chế tạo theo pha, dòng/công suất, tiêu chí sứ)
  function applyFactoryDefaults(cfg, FX) {
    if (!FX) return;
    const D = FX.data;
    D.order.forEach(s => { const ph = D.units[s].phase; if (ph && !cfg.ps[ph]) cfg.ps[ph] = s; });
    if (!cfg.iLV && D.specs.current) cfg.iLV = lastNum(D.specs.current.LV);
    if (!cfg.sLV && D.specs.power) cfg.sLV = lastNum(D.specs.power.LV);
    if (!cfg.sR && D.specs.power) cfg.sR = lastNum(D.specs.power.HV);
    if (!cfg.bC1Dev && D.bushingCriteria.c1) cfg.bC1Dev = String(D.bushingCriteria.c1);
    if (!cfg.bTgdMax && D.bushingCriteria.tgd) cfg.bTgdMax = String(D.bushingCriteria.tgd);
  }

  // Template BBTN theo pha của máy chính (BBTN_MBA_500_A/B/C); null nếu không xác định được
  function templateKeyFor(state, FX) {
    const u = FX && FX.unit(state.v['meta.serial']);
    return u && u.phase ? u.phase : null;
  }

  // Tài liệu tham khảo theo hạng mục: trích dẫn QĐ 1901 (quy trình đơn vị, HD máy đo sẽ thêm khi có)
  const references = Object.fromEntries(Object.entries({
    visual: ['visual'], noload: ['noload'], ir: ['ir', 'core', 'pi'], vector: ['vector'], bushing: ['bushing', 'bushingAC'],
    wtgd: ['wtgd'], dcr: ['dcr'], ratio: ['ratio'], oltc: ['oltc'], moisture: ['moisture'], bct: ['bct'],
  }).map(([sec, keys]) => [sec, keys.map(k => ({ source: 'QĐ 1901/QĐ-EVNNPT', cite: QD.REF[k] }))]));

  EquipmentTypes.register({
    code: 'MBA', label: 'Máy biến áp', classCode: 'MBA',
    defaultCfg, normalizeCfg, applyFactoryDefaults, templateKeyFor,
    buildSchema: cfg => Schema.build(cfg),
    evaluate: (state, FX, schema) => Evaluate.evaluate(state, FX, schema),
    autoConclusion: (res, schema, state) => Evaluate.autoConclusion(res, schema, state),
    factory: Factory,
    toRows: MbaRows,
    report: { fill: MbaReport.fill, filePrefix: 'MBA', minTables: MbaReport.minTables, stdTables: MbaReport.stdTables, defaultReason: 'Sau lắp đặt' },
    references,
    // Số liệu đính kèm biên bản (state.att) thuộc hạng mục nào — để xóa / hoàn tác theo hạng mục
    attSections: { oltc: 'oltc', oscAuto: 'oltc' },
    // Nội dung bước Chuẩn bị / Hướng dẫn đo theo hạng mục: cấu hình sau (quy trình đơn vị, HD máy đo)
    workflow: {},
  });
})();
