// Đăng ký loại thiết bị Máy biến áp (MBA): biểu mẫu theo template BBTN MBA 500 kV, đánh giá QĐ 1901,
// file Test report xuất xưởng, dòng CSDL và cách ghi BBTN.
(function () {
  'use strict';
  const lastNum = s => { const m = String(s || '').match(/[\d.]+(?=\s*$)/); return m ? m[0] : ''; };

  function defaultCfg() {
    return {
      template: 'A', topology: 'single1p', reportScope: 'combined', reportPhases: ['A', 'B', 'C'],
      ps: { A: '', B: '', C: '' }, taps: Schema.DEFAULT_TAPS.slice(), hvMeas: 'SER+COM', lvMode: 'unit',
      // mẫu 110–220 kV: bộ điều áp dưới tải đặt ở cuộn cao áp ('HV', mặc định) hay trung áp ('MV', MBA 220 kV kiểu Liên Xô cũ)
      oltcWinding: 'HV',
      // hạng mục KHÔNG thực hiện trong lần thí nghiệm này ({ id hạng mục: true }); mặc định thực hiện tất cả
      skip: {},
      // lý do "Sau sửa chữa/đại tu": lấy lần này làm giá trị khởi đầu mới ('' | 'INSULATION' | 'ALL', Schema.BASELINE_RESETS)
      baselineReset: '',
      // kèm phụ lục "Bảng tra cứu tiêu chuẩn" cuối BBTN ('on') hay không ('off', mặc định)
      stdAppendix: 'off',
      // BBTN riêng từng pha của tổ 3 máy 1 pha: lần đo của 2 pha còn lại cách ngày thí nghiệm ≤ N ngày là cùng đợt (MbaPhaseFill)
      campaignDays: 30,
      iLV: '', sLV: '', sR: '', i0Ref: '', bC1Dev: '', bTgdMax: '', bctCores: { hv: 4, mv: 4, lv: 4 },
      ctNo: { hv: '1,2,3,4,5,6', mv: '4,5,6,7,8', n: '8,9,10', lv: '11,12,13,14' }, bctErrLimit: '', decSep: ',',
      hdr: {}, wtgdLabels: {}, wtgdRows: [], oltcCharts: 'all',
      // mẫu 3 pha: số liệu biến dòng chân sứ trong BBTN — 'appendix' (phụ lục cuối BBTN) hoặc 'body' (mục 13)
      bctPlace: 'appendix',
    };
  }

  // Cấu hình đọc từ biên bản đã lưu: bổ sung khóa mới (biên bản cũ) mà không đổi giá trị đã có
  function normalizeCfg(saved) {
    const d = defaultCfg();
    const cfg = Object.assign(d, saved);
    const layout = Schema.layoutOf(saved || d);
    cfg.topology = layout === Schema.LAYOUT_3P ? 'bank1p' : layout === Schema.LAYOUT_110 ? 'threePhase' : 'single1p';
    cfg.reportScope = ['combined', 'separate'].includes(cfg.reportScope) ? cfg.reportScope : 'combined';
    if (cfg.topology !== 'bank1p') cfg.reportScope = 'combined';
    cfg.oltcWinding = cfg.oltcWinding === 'MV' ? 'MV' : 'HV';
    cfg.baselineReset = ['INSULATION', 'ALL'].includes(cfg.baselineReset) ? cfg.baselineReset : '';
    cfg.stdAppendix = cfg.stdAppendix === 'on' ? 'on' : 'off';
    // hạng mục KHÔNG thực hiện ({ id: true }); biên bản cũ: mọi hạng mục thực hiện
    cfg.skip = cfg.skip && typeof cfg.skip === 'object' ? Object.fromEntries(Object.entries(cfg.skip).filter(([, x]) => x === true)) : {};
    cfg.reportPhases = Array.isArray(cfg.reportPhases)
      ? ['A', 'B', 'C'].filter(ph => cfg.reportPhases.includes(ph)) : ['A', 'B', 'C'];
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
    // MBA 3 pha (mẫu 110-220): một máy, không gán số chế tạo theo pha từ file xuất xưởng tổ máy 1 pha
    if (Schema.layoutOf(cfg) !== Schema.LAYOUT_110) D.order.forEach(s => { const ph = D.units[s].phase; if (ph && !cfg.ps[ph]) cfg.ps[ph] = s; });
    if (!cfg.iLV && D.specs.current) cfg.iLV = lastNum(D.specs.current.LV);
    if (!cfg.sLV && D.specs.power) cfg.sLV = lastNum(D.specs.power.LV);
    if (!cfg.sR && D.specs.power) cfg.sR = lastNum(D.specs.power.HV);
    if (!cfg.bC1Dev && D.bushingCriteria.c1) cfg.bC1Dev = String(D.bushingCriteria.c1);
    if (!cfg.bTgdMax && D.bushingCriteria.tgd) cfg.bTgdMax = String(D.bushingCriteria.tgd);
  }

  // Template BBTN theo pha của máy chính (BBTN_MBA_500_A/B/C); null nếu không xác định được
  function templateKeyFor(state, FX) {
    // mẫu chung 3 pha, mẫu MBA 3 pha 110-220: không đổi template theo pha máy chính
    if (Schema.layoutOf(state.cfg) !== '1P') return null;
    const u = FX && FX.unit(state.v['meta.serial']);
    return u && u.phase ? u.phase : null;
  }

  // Hướng dẫn đo rút gọn theo tài liệu đào tạo; không thay thế sơ đồ, phương án và quy trình được duyệt.
  const trainingSource = 'Tài liệu đào tạo thí nghiệm MBA (2026)';
  const procedureCites = {
    visual: 'I.1 — Các hạng mục thí nghiệm MBA theo QĐ 1901',
    noload: 'I.3 — Đo dòng điện và tổn hao không tải',
    ir: 'I.4 — Đo điện trở cách điện cuộn dây, lõi từ và gông từ',
    wtgd: 'I.5 — Đo tgδ và điện dung MBA',
    bushing: 'I.5 — Sứ xuyên; I.9 — Đáp ứng điện môi DFR sứ xuyên',
    dcr: 'Đo điện trở một chiều các cuộn dây MBA',
    vector: 'I.7 — Đo tỉ số biến và tổ đấu dây',
    ratio: 'I.7 — Đo tỉ số biến và tổ đấu dây',
    moisture: 'I.8 — Kiểm tra độ ẩm cách điện cứng',
    oltc: 'I.10 — Chụp sóng điện trở động bộ OLTC',
    shortCircuit: 'I.11 — Thí nghiệm ngắn mạch MBA',
    bct: 'I.12 — Thí nghiệm biến dòng chân sứ',
  };
  const references = Object.fromEntries(Object.entries({
    visual: ['visual'], noload: ['noload'], ir: ['ir', 'core', 'pi'], vector: ['vector'], bushing: ['bushing', 'bushingAC'],
    wtgd: ['wtgd'], dcr: ['dcr'], ratio: ['ratio'], oltc: ['oltc'], moisture: ['moisture'], shortCircuit: ['shortCircuit'], bct: ['bct'],
  }).map(([sec, keys]) => [sec, [
    ...keys.map(k => ({ source: 'QĐ 1901/QĐ-EVNNPT', cite: QD.REF[k] })),
    // tiêu chuẩn IEC/IEEE QĐ 1901 dẫn chiếu (không trùng lặp trong cùng hạng mục)
    ...[...new Map(keys.flatMap(k => QD.STANDARDS[k] || []).map(s => [s.code, s])).values()]
      .sort((a, b) => b.ok - a.ok)
      .map(s => ({ source: s.code, cite: `${s.scope} — ${s.ok ? `QĐ 1901 dẫn chiếu tại ${s.where}` : `cần xác nhận: chỉ có trong ${s.where}`}` })),
    ...(sec === 'shortCircuit' ? [{ source: 'QĐ 1387/QĐ-EVNNPT (25/04/2015)', cite: 'Điều 25–27' }] : []),
    ...(procedureCites[sec] ? [{ source: trainingSource, cite: procedureCites[sec] }] : []),
  ]]));

  // Bước 1 "Chuẩn bị" theo hạng mục; bước 2 "Hướng dẫn đo" lấy từ MbaGuide (guide.js) — Admin chỉnh được theo đơn vị.
  const workflow = {
    shortCircuit: { prep: [
      'Đối chiếu sơ đồ đấu dây, điện áp định mức, dòng định mức, tổ đấu dây và Test Report; xác định cặp cuộn dây, pha, nấc cần thử và phía được cấp nguồn.',
      'Cô lập MBA, kiểm tra hết điện, tiếp địa an toàn và xác nhận các đầu nối/cáp thử chịu được dòng thử; ngắn mạch đúng cuộn theo phương án được duyệt.',
      'Kiểm tra nguồn xoay chiều, tần số định mức, thiết bị đo U–I–P, cảm biến nhiệt độ và thang đo trước khi cấp điện.',
    ] },
  };

  EquipmentTypes.register({
    code: 'MBA', label: 'Máy biến áp', classCode: 'MBA',
    defaultCfg, normalizeCfg, applyFactoryDefaults, templateKeyFor,
    // nhập BBTN cũ (.docx/.pdf) → biên bản của app
    importReport: (tpl, fileName) => MbaImportReport.read(tpl, fileName),
    // nhập BBTN PDF có lớp chữ (PTC3/BM.01, MBA 110–220 kV)
    importPdfReport: (pages, fileName, opts) => MbaPdfImportReport.read(pages, fileName, opts),
    buildSchema: cfg => Schema.build(cfg),
    // opts: { history (lịch sử đo CSDL, xu hướng R60), sessionId }
    evaluate: (state, FX, schema, opts) => Evaluate.evaluate(state, FX, schema, opts),
    autoConclusion: (res, schema, state) => Evaluate.autoConclusion(res, schema, state),
    factory: Factory,
    toRows: MbaRows,
    report: { fill: MbaReport.fill, phaseState: MbaReport.phaseState, filePrefix: 'MBA', minTables: MbaReport.minTables, stdTables: MbaReport.stdTables, defaultReason: 'Sau lắp đặt' },
    references,
    // Số liệu đính kèm biên bản (state.att) thuộc hạng mục nào — để xóa / hoàn tác theo hạng mục
    attSections: Schema.ATT_SECTIONS,
    workflow,
    // Hướng dẫn đo (Markdown, có ảnh) theo QĐ 1901 Chương V, QT-KĐMBA, tài liệu đào tạo — js/domain/types/mba/guide.js
    guide: MbaGuide,
  });
})();
