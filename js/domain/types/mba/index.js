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
    ...(sec === 'shortCircuit' ? [{ source: 'QĐ 1387/QĐ-EVNNPT (25/04/2015)', cite: 'Điều 25–27' }] : []),
    ...(procedureCites[sec] ? [{ source: trainingSource, cite: procedureCites[sec] }] : []),
  ]]));

  const workflow = {
    visual: { guide: [
      'Đối chiếu hiện trạng MBA với danh mục kiểm tra bên ngoài trong biên bản.',
      'Kiểm tra tổng thể sứ, đầu nối, thùng và các phụ kiện; ghi riêng vị trí, dấu hiệu bất thường và tình trạng rò dầu nếu có.',
      'Nhập nhận xét theo kết quả quan sát thực tế để người đánh giá xem xét từng nội dung.',
    ] },
    noload: { guide: [
      'Theo tài liệu đào tạo, sắp xếp phép đo không tải trước phép đo điện trở một chiều và điện trở cách điện cuộn dây để hạn chế ảnh hưởng từ dư.',
      'Cô lập MBA, kiểm tra sơ đồ đấu nối và thiết bị đo; chọn cách cấp nguồn, điện áp thử và phía đo theo phương án được duyệt.',
      'Tăng điện áp theo trình tự của thiết bị đo; ghi điện áp, dòng không tải và tổn hao cho từng pha cùng điều kiện thí nghiệm.',
      'Ghi rõ nếu dùng điện áp thấp; chỉ so sánh hoặc quy đổi theo tiêu chí áp dụng và điều kiện tương ứng.',
    ] },
    ir: { guide: [
      'Cô lập MBA, tháo các đấu nối ngoài cần thiết và phóng điện, tiếp địa an toàn trước khi đấu máy đo.',
      'Chọn từng sơ đồ giữa các cuộn dây với nhau, cuộn dây với vỏ, và lõi từ/gông từ theo cấu hình MBA và hướng dẫn áp dụng.',
      'Đo theo thời gian yêu cầu; ghi điện trở ở các mốc thời gian, điện áp thử, nhiệt độ và cấu hình đấu đo.',
      'Sau mỗi phép đo, xả điện tích và tiếp địa lại; hoàn trả nối đất lõi/gông từ trước khi kết thúc công việc.',
    ] },
    vector: { guide: [
      'Xác định đúng tên đầu cực, thứ tự pha và sơ đồ đấu dây trên nhãn máy trước khi nối thiết bị.',
      'Dùng thiết bị đo phù hợp để kiểm tra quan hệ pha, cực tính và tổ đấu dây; nếu dùng phương pháp điện áp, đấu và đo theo sơ đồ của tài liệu.',
      'Đối chiếu kết quả với sơ đồ, tài liệu xuất xưởng và thông tin trên nhãn máy; ghi nhận pha hoặc đầu cực có dấu hiệu sai khác.',
    ] },
    bushing: { guide: [
      'Kiểm tra loại sứ và tình trạng núm đo; vệ sinh bề mặt, xác nhận sứ đã cách ly và tiếp địa an toàn trước khi đấu máy.',
      'Đo tgδ và điện dung C1/C2 theo sơ đồ phù hợp với cấu tạo sứ; ghi điện áp thử, nhiệt độ, tần số và sơ đồ đo.',
      'Khi thực hiện DFR, dùng trình tự và dải tần của thiết bị chuyên dụng; lưu đường cong cùng điều kiện đo để đối chiếu với dữ liệu gốc.',
      'Sau phép đo, xả và tiếp địa núm đo theo hướng dẫn thiết bị trước khi hoàn trả đấu nối.',
    ] },
    wtgd: { guide: [
      'Cô lập MBA, vệ sinh các đầu cực và chọn sơ đồ đo theo cấu hình hai hoặc ba cuộn dây.',
      'Đấu lần lượt các tổ hợp cuộn dây–cuộn dây và cuộn dây–vỏ theo sơ đồ GST/UST phù hợp; bảo đảm các đầu còn lại ở đúng trạng thái quy định.',
      'Ghi tgδ, điện dung, điện áp thử, tần số và nhiệt độ cho từng sơ đồ; giữ cùng điều kiện khi so sánh với số liệu gốc hoặc lần đo trước.',
      'Xả điện tích và tiếp địa cuộn dây sau khi hoàn tất từng nhóm phép đo.',
    ] },
    dcr: { guide: [
      'Thực hiện sau phép đo không tải theo trình tự nêu trong tài liệu; cô lập MBA và xác định cuộn dây, pha, đầu cực, nấc cần đo.',
      'Đấu thiết bị đo điện trở một chiều theo sơ đồ phù hợp; đo lần lượt các pha, cuộn dây và tất cả các nấc phân áp.',
      'Chỉ ghi kết quả khi dòng đã ổn định; ghi nhiệt độ cuộn dây, nấc, dòng đo và điện trở tương ứng.',
      'Không tháo dây khi dòng thử chưa xả hết; sau phép đo thực hiện khử từ dư theo hướng dẫn thiết bị và quy trình được duyệt.',
    ] },
    ratio: { guide: [
      'Xác nhận sơ đồ MBA, vector group, đầu cực và vị trí nấc hiện tại; nhập đúng dữ liệu nhãn máy vào thiết bị đo.',
      'Đo từng pha tại tất cả các nấc phân áp theo sơ đồ tương ứng; ghi tỷ số đo, nấc và pha.',
      'Đối chiếu tỷ số với giá trị danh định ở đúng nấc và kiểm tra kết quả tổ đấu dây/cực tính; làm rõ sai khác trước khi kết luận.',
    ] },
    moisture: { guide: [
      'Ổn định nhiệt MBA theo điều kiện của phương pháp; ghi nhiệt độ dầu/cuộn dây và chuẩn bị thiết bị đo FDS/DFR hoặc PDC.',
      'Đấu sơ đồ đo cách điện chính theo cấu hình MBA; kiểm tra dây cao áp, dây đo, dây guard và tiếp địa an toàn.',
      'Thu dữ liệu theo toàn bộ trình tự của thiết bị, tránh thao tác đóng cắt và nguồn nhiễu trong thời gian đo.',
      'Lưu kết quả độ ẩm cùng dữ liệu đường cong, nhiệt độ và điều kiện đo; đối chiếu thêm độ ẩm dầu, điện trở cách điện và PI khi đánh giá.',
    ] },
    oltc: { guide: [
      'Xác định kiểu OLTC, nấc bắt đầu và sơ đồ đấu thiết bị chụp sóng/điện trở động; kiểm tra tình trạng dây đo và nguồn ghi.',
      'Ghi dạng sóng trong từng lần chuyển nấc theo trình tự của thiết bị; đánh dấu chiều chuyển, nấc và pha/bộ tiếp điểm tương ứng.',
      'Lặp lại các vị trí cần kiểm tra theo quy trình áp dụng; so sánh hình dạng, thời gian chuyển tiếp và tính đồng đều giữa các pha.',
      'Lưu tệp dạng sóng cùng cấu hình đo để phục vụ đối chiếu hoặc lập phụ lục biên bản.',
    ] },
    shortCircuit: { prep: [
      'Đối chiếu sơ đồ đấu dây, điện áp định mức, dòng định mức, tổ đấu dây và Test Report; xác định cặp cuộn dây, pha, nấc cần thử và phía được cấp nguồn.',
      'Cô lập MBA, kiểm tra hết điện, tiếp địa an toàn và xác nhận các đầu nối/cáp thử chịu được dòng thử; ngắn mạch đúng cuộn theo phương án được duyệt.',
      'Kiểm tra nguồn xoay chiều, tần số định mức, thiết bị đo U–I–P, cảm biến nhiệt độ và thang đo trước khi cấp điện.',
    ], guide: [
      'Cô lập MBA, kiểm tra hết điện và thực hiện tiếp địa an toàn; chọn cặp cuộn dây, nấc phân áp và sơ đồ đấu theo phương án được duyệt.',
      'Theo Điều 26 QĐ 1387, thí nghiệm sau lắp đặt mới và đại tu/cải tạo; khi MBA đang vận hành thì thực hiện sau khi dòng ngắn mạch đã qua vượt 70% dòng chịu đựng tính toán. Ngắn mạch và nối đất các BCT không sử dụng theo phương án.',
      'Nối ngắn mạch cuộn dây theo sơ đồ; cấp điện áp xoay chiều ở tần số định mức vào cuộn còn lại, tăng dòng thử đến ít nhất 25% dòng định mức.',
      'Khi hiện trường không có điện áp thử theo Test Report, dùng 380 V hoặc điện áp không quá 10 kV rồi nội suy. Nhập điện áp thử theo V hoặc kV; app quy đổi theo Un và In.',
      'Với OLTC, đo tại nấc chính và hai nấc đầu/cuối theo Điều 26; lập phép đo riêng cho từng cặp cuộn dây và từng nấc.',
      'Ghi cặp cuộn, nấc, pha, nhiệt độ, tần số, điện áp, dòng điện và công suất đo; ghi riêng thành phần PI²R nếu quy trình/thiết bị cung cấp.',
      'Dùng U, I, Un và In cùng phía được cấp nguồn; quy đổi Uk theo dòng định mức và Pk theo bình phương tỷ số dòng. Chỉ hiệu chỉnh Pk theo nhiệt độ khi có đủ thành phần tổn hao và vật liệu dây dẫn.',
      'So sánh với Test Report ở cùng cặp cuộn, nấc, tần số, dòng định mức và nhiệt độ quy đổi; thực hiện lại tiếp địa trước khi tháo đấu nối.',
    ] },
    bct: { guide: [
      'Xác định số lõi, tỷ số, cực tính, đầu dây thứ cấp và sơ đồ đấu của từng TI chân sứ; bảo đảm mạch thứ cấp được xử lý an toàn.',
      'Thực hiện lần lượt đo cách điện, tỷ số biến, điện trở một chiều cuộn thứ cấp và đặc tính từ hóa theo cấu hình lõi.',
      'Ghi kết quả riêng theo pha, lõi và đầu cuộn; đối chiếu tỷ số, cực tính và đường cong từ hóa với tài liệu thiết kế/xuất xưởng.',
      'Hoàn trả đấu nối và xác nhận trạng thái mạch thứ cấp trước khi kết thúc công việc.',
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
    evaluate: (state, FX, schema) => Evaluate.evaluate(state, FX, schema),
    autoConclusion: (res, schema, state) => Evaluate.autoConclusion(res, schema, state),
    factory: Factory,
    toRows: MbaRows,
    report: { fill: MbaReport.fill, phaseState: MbaReport.phaseState, filePrefix: 'MBA', minTables: MbaReport.minTables, stdTables: MbaReport.stdTables, defaultReason: 'Sau lắp đặt' },
    references,
    // Số liệu đính kèm biên bản (state.att) thuộc hạng mục nào — để xóa / hoàn tác theo hạng mục
    attSections: { oltc: 'oltc', oscAuto: 'oltc' },
    // Hướng dẫn đo rút gọn từ tài liệu đào tạo; sơ đồ và thao tác chi tiết theo quy trình được duyệt.
    workflow,
  });
})();
