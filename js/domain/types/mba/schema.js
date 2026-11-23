// Ánh xạ biểu mẫu nhập liệu ↔ template BBTN_MBA_500_x.docx.
// Chỉ số bảng (t) là thứ tự bảng cấp thân văn bản trong template; hàng (doc) là chỉ số hàng sau khi
// ghép các bảng bị ngắt trang liền nhau; cột (doc) là chỉ số cột lưới (đã tính gridSpan).
(function () {
  'use strict';

  const DEFAULT_TAPS = ['1', '2', '3', '4', '5', '6', '7', '8', '9a', '9b', '9c', '10', '11', '12', '13', '14', '15', '16', '17'];

  const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  const col = (k, label, doc, o = {}) => Object.assign({ k, label, doc }, o);

  // ---------------- Thông tin chung (bảng 0) ----------------
  // Loại thí nghiệm (ô "Lý do thí nghiệm"); giá trị cũ khác danh sách vẫn giữ nguyên trong biên bản
  // Lần sau sửa chữa / đại tu lấy làm giá trị khởi đầu mới cho các lần thí nghiệm sau (test_sessions.baseline_reset)
  const BASELINE_RESETS = [
    ['', 'Không — giữ giá trị khởi đầu cũ'],
    ['INSULATION', 'Có lọc dầu, sấy chân không — lấy số liệu cách điện cuộn dây lần này (R cách điện, tgδ, điện dung) làm giá trị khởi đầu'],
    ['ALL', 'Thay cuộn dây / thay đổi kết cấu cách điện — lấy mọi số liệu lần này làm giá trị khởi đầu (QĐ 1901 Điều 2)'],
  ];
  const REASONS = ['Sau lắp đặt', '1 năm sau lắp đặt', 'Định kỳ 1 năm', 'Định kỳ 3 năm', 'Định kỳ 6 năm', 'Tăng cường', 'Đột xuất', 'Sau sửa chữa/đại tu'];
  const META = [
    { k: 'meta.project', label: 'Tên dự án / tên trạm', doc: { t: 0, r: 2, c: 0, re: /\(Project\):(?<v>.*)$/ } },
    { k: 'meta.site', label: 'Vị trí lắp đặt', doc: { t: 0, r: 3, c: 0, re: /\(Site\):(?<v>.*)$/ } },
    { k: 'meta.manuf', label: 'Hãng sản xuất', doc: { t: 0, r: 4, c: 0, re: /\(Manufacturer\):(?<v>.*)$/ } },
    { k: 'meta.serial', label: 'Số chế tạo (máy chính)', doc: { t: 0, r: 4, c: 2, re: /\(Serial No\):(?<v>.*)$/ }, serial: true },
    { k: 'meta.year', label: 'Năm sản xuất', doc: { t: 0, r: 5, c: 0, re: /manufacture\):(?<v>.*)$/ } },
    { k: 'meta.type', label: 'Kiểu loại', doc: { t: 0, r: 5, c: 2, re: /\(Type\):(?<v>.*)$/ } },
    { k: 'meta.power', label: 'Công suất (MVA)', doc: { t: 0, r: 6, c: 0, re: /power\):(?<v>.*)$/ } },
    { k: 'meta.voltage', label: 'Điện áp định mức', doc: { t: 0, r: 6, c: 2, re: /voltage\):(?<v>.*)$/, joinNext: true } },
    { k: 'meta.vector', label: 'Tổ đấu dây', doc: { t: 0, r: 7, c: 0, re: /group\):(?<v>.*)$/ } },
    { k: 'meta.current', label: 'Dòng định mức (A)', doc: { t: 0, r: 7, c: 2, re: /current\):(?<v>.*)$/ } },
    { k: 'meta.reason', label: 'Lý do thí nghiệm', type: 'select', options: REASONS, doc: { t: 0, r: 8, c: 0, re: /nghiệm:(?<v>.*)$/ } },
    { k: 'meta.date', label: 'Ngày thí nghiệm', doc: { t: 0, r: 8, c: 2, re: /\(Date\):(?<v>.*)$/ } },
    { k: 'meta.ambT', label: 'Nhiệt độ môi trường (°C)', num: true, doc: { t: 0, r: 9, c: 0, re: /\(Temp\.\)\s*=(?<v>[^º°]*)/ } },
    { k: 'meta.hum', label: 'Độ ẩm (%)', num: true, doc: { t: 0, r: 9, c: 0, re: /\(Humidity\)\s*=(?<v>[^%]*)/ } },
  ];
  const CLOSING = [
    { k: 'meta.remark', label: 'Ghi chú (Remark)', type: 'textarea', doc: { t: 0, r: 22, c: 0, re: /\(Remark\):(?<v>.*)$/ } },
    { k: 'meta.conclusion', label: 'Kết luận (Conclusion)', type: 'textarea', doc: { t: 0, r: 23, c: 0, re: /\(Conclusion\):(?<v>.*)$/ } },
  ];

  // Hàng tổng hợp hạng mục trong bảng 0 (cột 3: ✓, cột 4: Đánh giá)
  const SUMMARY_ROWS = { visual: 11, noload: 12, ir: 13, vector: 14, bushing: 15, wtgd: 16, dcr: 17, ratio: 18, oltc: 19, moisture: 20, bct: 21 };

  // ---------------- Grids ----------------
  const IR_ROWS = [
    { k: 'r0', label: 'Cao, Trung ~ Hạ, Vỏ (HV,MV~LV&E)', fcfg: 'HV+MV+N-LV+TANK' },
    { k: 'r1', label: 'Hạ ~ Cao, Trung, Vỏ (LV~HV,MV&E)', fcfg: 'LV-HV+MV+N+TANK' },
    { k: 'r2', label: 'Cao, Trung, Hạ ~ Vỏ (HV,MV,LV~E)', fcfg: 'HV+MV+N+LV-TANK' },
    { k: 'r3', label: 'Hạ ~ Cao, Trung (LV~HV,MV)' },
    { k: 'r4', label: 'Cao, Trung ~ Vỏ (HV,MV~E)' },
    { k: 'r5', label: 'Hạ ~ Vỏ (LV~E)' },
  ];
  const CORE_ROWS = [
    { k: 'r6', label: 'Lõi từ – Vỏ (Core–Earth)', fcfg: 'CORE', core: true },
    { k: 'r7', label: 'Gông từ – Vỏ (Clamp–Earth)', fcfg: 'CLAMP', core: true },
    { k: 'r8', label: 'Lõi từ – Gông từ (Core–Clamp)', core: true },
  ];
  const IR_COLS = [
    col('r15', 'R15″ (MΩ)', 1), col('r60', 'R60″ (MΩ)', 2), col('r600', 'R600″ (MΩ)', 3),
    col('kht', 'Kht = R60/R15', 4, { auto: true }), col('pi', 'PI = R600/R60', 5, { auto: true }), col('u', 'Điện áp đo (V)', 6, { text: true }),
  ];

  const WTGD_ROWS = IR_ROWS.map(r => ({ k: r.k, label: r.label.replace('&E', ',E'), fcfg: r.fcfg && r.fcfg !== 'HV+MV+N+LV-TANK' ? r.fcfg : undefined }));

  function bushingGrid(side, phases, tables, serialCols, identityRows) {
    // phases: [{k, label, doc}] ; identityRows: doc rows of type/manuf when cmap differs (MV side)
    const rows = [
      { k: 'type', label: 'Kiểu loại (Type)', doc: 1, text: true },
      { k: 'manuf', label: 'Hãng sản xuất', doc: 2, text: true },
      { k: 'serial', label: 'Số chế tạo sứ (Serial)', doc: 3, text: true, serial: true },
      { k: 'ur', label: 'Ur sứ (kV) – nhóm dung sai', nodoc: true, auto: true },
      { k: 'tgd1', label: 'C1: tgδ (%)', doc: 4 },
      { k: 'c1', label: 'C1 (pF)', doc: 5 },
      { k: 'r1', label: 'C1: Rcđ (MΩ)', doc: 6 },
      { k: 'tgd2', label: 'C2: tgδ (%)', doc: 7 },
      { k: 'c2', label: 'C2 (pF)', doc: 8 },
      { k: 'r2', label: 'C2: Rcđ (MΩ)', doc: 9 },
    ];
    if (identityRows) rows.slice(0, 2).forEach(r => { r.cmap = identityRows; });
    const cols = phases.map(p => col(p.k, p.label, p.doc, { phase: true }))
      .concat([col('u', 'U đo (kV)', serialCols.u, { text: true }), col('d', 'Sơ đồ đo', serialCols.d, { text: true })]);
    const skip = (r, c) => (c === 'u' && !['tgd1', 'r1', 'tgd2', 'r2'].includes(r)) || (c === 'd' && !['tgd1', 'tgd2'].includes(r));
    return { id: `b.${side}.meas`, title: 'Số liệu đo', tables, rows, cols, skip, transposed: true };
  }
  function bushingC20Grid(side, phases, table, serialCols) {
    const rows = [
      { k: 'type', label: 'Kiểu loại (Type)', doc: 1, text: true }, { k: 'manuf', label: 'Hãng sản xuất', doc: 2, text: true },
      { k: 'serial', label: 'Số chế tạo sứ', doc: 3, text: true }, { k: 'tgd1', label: 'C1: tgδ@20 °C (%)', doc: 4 },
      { k: 'c1', label: 'C1@20 °C (pF)', doc: 5 }, { k: 'tgd2', label: 'C2: tgδ@20 °C (%)', doc: 6 }, { k: 'c2', label: 'C2@20 °C (pF)', doc: 7 },
    ];
    const cols = phases.map(p => col(p.k, p.label, p.doc, { calc: true }))
      .concat([col('u', 'U đo (kV)', serialCols.u, { calc: true }), col('d', 'Sơ đồ đo', serialCols.d, { calc: true })]);
    const skip = (r, c) => (c === 'u' || c === 'd') && !['tgd1', 'tgd2'].includes(r);
    return { id: `b.${side}.c20`, title: 'Quy đổi về 20 °C (tự tính)', tables: [table], rows, cols, skip, transposed: true, readonly: true };
  }

  // Bảng hàng nấc 1..19 cho điện trở một chiều & tỷ số biến
  const tapRows = taps => taps.map((t, i) => ({ k: `t${i + 1}`, label: t, tap: t, doc: i + 1 }));

  // ---------------- Biến dòng chân sứ ----------------
  // Bảng trong template theo số cuộn thứ cấp. ex: bảng đặc tính từ hóa theo pha.
  const BCT_TABLES = {
    hv: {
      4: { ir: [26], ex: [[33], [34], [35]], ratio: [54, 55], dcr: [63, 64] },
      5: { ir: [27], ex: [[36], [37, 38], [39]], ratio: [56], dcr: [65] },
      6: { ir: [28, 29], ex: [[40], [41, 42], [43]], ratio: [57, 58], dcr: [66, 67] },
    },
    mv: {
      4: { ir: [30], ex: [[44], [45], [46]], ratio: [59], dcr: [68] },
      5: { ir: [31], ex: [[47], [48], [49]], ratio: [60, 61], dcr: [69] },
    },
    n: { 3: { ex: [[50]] } },
    lv: { 4: { ir: [32], ex: [[51], [52], [53]], ratio: [62], dcr: [70, 71] } },
  };
  const BCT_SIDES = {
    hv: { label: 'Phía cao áp (HV)', phases: ['A', 'B', 'C'], cores: [4, 5, 6] },
    mv: { label: 'Phía trung áp & trung tính (MV, N)', phases: ['A', 'B', 'C', 'N'], cores: [4, 5] },
    lv: { label: 'Phía hạ áp (LV)', phases: ['a', 'b', 'c'], cores: [4] },
  };
  // Hàng tỷ số/điện trở: cuộn 1..n-1 có S1-S2..S1-S5, cuộn n chỉ có S1-S2 (đúng như template)
  function bctTapRows(n, firstDoc) {
    const rows = [];
    for (let w = 1; w <= n; w++) {
      const taps = w < n ? [2, 3, 4, 5] : [2];
      taps.forEach(k => rows.push({ k: `w${w}s${k}`, w, s: k, label: `${w} · S1-S${k}`, doc: firstDoc + rows.length }));
    }
    return rows;
  }
  function bctGrids(side, cores) {
    const S = BCT_SIDES[side], T = BCT_TABLES[side][cores];
    const ph = S.phases;
    const grids = [];
    grids.push({
      id: `bct.${side}.ir`, title: `Điện trở cách điện (MΩ) — TI có ${cores} cuộn thứ cấp`, tables: T.ir,
      rows: range(cores, i => ({ k: `w${i + 1}`, label: `Thứ cấp ${i + 1} – (TC khác + Vỏ)`, doc: i + 1 })),
      cols: ph.map((p, i) => col(p, `Pha ${p}`, i + 1, { phase: true })),
    });
    grids.push({
      id: `bct.${side}.ratio`, title: 'Tỷ số biến (đo) & sai số (%)', tables: T.ratio, rows: bctTapRows(cores, 2),
      cols: ph.flatMap((p, i) => [col(`${p}`, `${p}: tỷ số đo`, 2 + 2 * i, { phase: true }), col(`${p}e`, `${p}: sai số %`, 3 + 2 * i, { auto: true })]),
    });
    grids.push({
      id: `bct.${side}.dcr`, title: 'Điện trở một chiều (Ω)', tables: T.dcr, rows: bctTapRows(cores, 1),
      cols: ph.map((p, i) => col(p, `Pha ${p}`, 2 + i, { phase: true })),
    });
    const exPhases = side === 'mv' ? ['A', 'B', 'C'] : ph;
    T.ex.forEach((tables, i) => grids.push(exGrid(`bct.${side}.ex.${exPhases[i]}`, `Đặc tính từ hóa — Pha ${exPhases[i]}`, tables, cores, side === 'lv' ? 3 : 4)));
    return grids;
  }
  function exGrid(id, title, tables, cores, lastS) {
    const rows = [];
    for (let w = 1; w <= cores; w++) {
      rows.push({ k: `w${w}u`, label: `${w}S1-${w}S${lastS}: U (V)`, doc: 2 * (w - 1) });
      rows.push({ k: `w${w}i`, label: `${w}S1-${w}S${lastS}: I (mA)`, doc: 2 * (w - 1) + 1 });
    }
    // 25 / 50 / 75 % và điểm khuỷu; cột khuỷu (lưới 4) không có trong template — được chèn thêm khi xuất BBTN
    return { id, title, tables, rows, ex: true, cols: [col('p1', 'Mốc 25 %', 1), col('p2', 'Mốc 50 %', 2), col('p3', 'Mốc 75 %', 3), col('p4', 'Khuỷu (Uk / Ik)', 4)] };
  }

  // Sơ đồ đo tgδ (cột "Sơ đồ đo" mục 6)
  const TGD_MODES = ['UST', 'GAR', 'GND'];

  // Cách đo R một chiều cuộn cao áp: A-N (cuộn nối tiếp + cuộn chung) hoặc A-Am (chỉ cuộn nối tiếp)
  const HV_MEAS = [['SER+COM', 'A-N, B-N, C-N (nối tiếp + chung)'], ['SER', 'A-Am, B-Bm, C-Cm (nối tiếp)']];

  // ======================================================================= Template chung 3 pha
  // "BBTN MBA 500kV 3 pha chung": một biên bản cho tổ 3 máy 1 pha A, B, C. Hạng mục theo từng máy (không tải, cách điện,
  // tgδ cuộn dây) lặp lại cho mỗi pha với nhiệt độ riêng; sứ 5 nhóm; R một chiều mΩ, 17 nấc; ẩm và OLTC theo pha.
  // Biến dòng chân sứ không có bảng trong thân biên bản → xuất thành phụ lục.
  const LAYOUT_3P = '3P';
  // "Mau BBTN MBA 110-220": MBA 3 pha 220/110/22 kV — cùng biểu mẫu với mẫu theo pha (PTC3/BM.01), chỉ khác chỗ ngắt bảng qua trang
  const LAYOUT_110 = '110';
  const layoutOf = cfg => {
    const k = cfg && (cfg.template === 'custom' ? cfg.layout : cfg.template);
    return k === LAYOUT_3P ? LAYOUT_3P : k === LAYOUT_110 ? LAYOUT_110 : '1P';
  };
  const PH3 = ['A', 'B', 'C'];
  const TAPS_17 = range(17, i => String(i + 1));
  // Hàng tổng hợp hạng mục ở bảng 0 của từng mẫu: cột ✓ và Đánh giá theo mẫu.
  const SUMMARY = {
    '1P': { rows: SUMMARY_ROWS, tick: 3, ev: 4 },
    '3P': { rows: { visual: 11, noload: 12, ir: [13, 14], vector: 15, bushing: 16, wtgd: 17, dcr: 18, ratio: 19, oltc: 20, moisture: 21, bct: 23 }, fra: 22, tick: 6, ev: 7 },
  };
  const VISUAL_ITEMS = ['Sứ xuyên 500kV, 220kV, 35kV và trung tính', 'Các kẹp cực', 'Hàng kẹp đấu dây nhị thứ', 'Rơ le bảo vệ nội bộ', 'Đồng hồ nhiệt độ dầu, cuộn dây',
    'Đồng hồ chỉ thị mức dầu', 'Cánh tản nhiệt', 'Độ kín', 'Tiếp địa'];
  const IR3_ROWS = IR_ROWS.slice(0, 4).concat([
    { k: 'r6', label: 'Lõi từ ~ Gông từ + Vỏ (Core–Clamp+E)', fcfg: 'CORE', core: true },
    { k: 'r7', label: 'Gông từ ~ Lõi từ + Vỏ (Clamp–Core+E)', fcfg: 'CLAMP', core: true },
    { k: 'r8', label: 'Lõi từ + Gông từ ~ Vỏ (Core+Clamp)', core: true },
  ]);
  const IR3_COLS = [
    col('r15', 'R15″ (MΩ)', 1), col('r60', 'R60″ (MΩ)', 2), col('r180', 'R180″ (MΩ)', 3), col('r360', 'R360″ (MΩ)', 4), col('r600', 'R600″ (MΩ)', 5),
    col('kht', 'Kht = R60/R15', 6, { auto: true }), col('pi', 'PI = R600/R60', 7, { auto: true }), col('u', 'Điện áp đo (V)', 8, { text: true }),
  ];
  // Thứ tự hàng bảng tgδ cuộn dây của mẫu 3 pha (khóa hàng giữ như mẫu theo pha để so xuất xưởng/xu hướng)
  const WTGD3_ORDER = ['r4', 'r0', 'r1', 'r5', 'r3', 'r2'];
  const BUSHING3 = [
    { id: 'hv', title: 'a. Sứ phía cao áp (HV)', term: '1.1', table: 11, phases: [['A', 'A'], ['B', 'B'], ['C', 'C']] },
    { id: 'mv', title: 'b. Sứ phía trung áp (MV)', term: '2.1', table: 12, phases: [['A', 'Am'], ['B', 'Bm'], ['C', 'Cm']] },
    { id: 'n', title: 'c. Sứ trung tính (N của từng máy)', term: '2', table: 13, phases: [['A', 'N (máy A)'], ['B', 'N (máy B)'], ['C', 'N (máy C)']] },
    { id: 'lv', title: 'd. Sứ hạ áp a, b, c', term: '3.1', table: 14, phases: [['a', 'a'], ['b', 'b'], ['c', 'c']] },
    { id: 'lv2', title: 'e. Sứ hạ áp x, y, z', term: '3.2', table: 15, phases: [['a', 'x'], ['b', 'y'], ['c', 'z']] },
  ];
  function bushing3Grid(B) {
    const rows = [
      { k: 'serial', label: 'Số chế tạo (Serial)', doc: 0, text: true, serial: true }, { k: 'type', label: 'Kiểu loại (Type)', doc: 1, text: true },
      { k: 'code', label: 'Mã hiệu (Code)', doc: 2, text: true }, { k: 'ur', label: 'Điện áp định mức (kV)', doc: 3, auto: true },
      { k: 'ir', label: 'Dòng điện định mức (A)', doc: 4, text: true },
      // nhiệt độ đo riêng từng sứ: template không có hàng này → chèn khi xuất (ensureRow); trống thì dùng nhiệt độ chung của mục 5
      { k: 't', label: 'Nhiệt độ đo (°C)', doc: 5 },
      { k: 'tgd1', label: 'C1: tgδ (%)', doc: 6 }, { k: 'c1', label: 'C1 (pF)', doc: 7 }, { k: 'tgd2', label: 'C2: tgδ (%)', doc: 8 }, { k: 'c2', label: 'C2 (pF)', doc: 9 },
    ];
    const cols = B.phases.map(([k, label], i) => col(k, label, 2 + i, { phase: true }))
      .concat([col('u', 'U đo (kV)', 5, { text: true }), col('d', 'Sơ đồ đo', 6, { text: true })]);
    const first = B.phases[0][0];
    // kiểu loại: một ô gộp cho cả 3 pha (ghi ở cột pha đầu); U đo, sơ đồ đo chỉ ở hàng tgδ
    const skip = (r, c) => (r === 'type' && c !== first && c !== 'u' && c !== 'd') || ((c === 'u' || c === 'd') && !['tgd1', 'tgd2'].includes(r));
    return { id: `b.${B.id}.meas`, title: 'Số liệu đo', tables: [B.table], rows, cols, skip, transposed: true,
      ensureRow: { after: 4, label: 'Nhiệt độ đo (°C)\n(Temperature)', match: /Nhiệt độ|Temperature/i } };
  }
  function bushing3C20(B) {
    const rows = [{ k: 'tgd1', label: 'C1: tgδ@20 °C (%)', doc: 1 }, { k: 'c1', label: 'C1@20 °C (pF)', doc: 2 }, { k: 'tgd2', label: 'C2: tgδ@20 °C (%)', doc: 3 }, { k: 'c2', label: 'C2@20 °C (pF)', doc: 4 }];
    return { id: `b.${B.id}.c20`, title: 'Quy đổi về 20 °C (tự tính, không ghi vào BBTN mẫu 3 pha)', rows, cols: B.phases.map(([k, label]) => col(k, label, undefined, { calc: true })),
      transposed: true, readonly: true };
  }

  function build3P(cfg) {
    const taps = TAPS_17;
    const ps = cfg.ps || {};
    const unitTitle = ph => `Pha ${ph}${ps[ph] ? ` — máy ${ps[ph]}` : ''}`;
    const hvSer = cfg.hvMeas === 'SER';
    const hvPairs = PH3.map(ph => ({ ph, app: hvSer ? `${ph}-${ph}m` : `${ph}-N`, doc: hvSer ? `${ph}${ph}m` : `${ph}N` }));
    const KMODES = typeof BushingK !== 'undefined' ? BushingK.modeOptions() : ['Hitachi Energy (RIP) – theo HD hãng', 'Nhập hệ số K'];
    const hdr = (gid, cols) => cols.map(c => Object.assign({}, c, { label: (cfg.hdr || {})[`${gid}.${c.k}`] || c.label, defLabel: c.label }));
    const wtgdRows = WTGD3_ORDER.map((k, i) => Object.assign({}, WTGD_ROWS.find(r => r.k === k), { doc: i + 1 }));
    // R một chiều / tỷ số: cột ΔR, ΔK so xuất xưởng của từng pha chỉ hiện trong app (mẫu 3 pha không có cột này)
    const phaseCols = (labels, firstDoc, devLabel, devOpt) => PH3.flatMap((ph, i) => [
      col(ph, labels[i], firstDoc + i, { phase: true }), col('d' + ph, devLabel(labels[i]), undefined, Object.assign({ nodoc: true }, devOpt)),
    ]);
    const sections = [
      {
        id: 'visual', no: 1, title: 'Kiểm tra bên ngoài', en: 'Visual inspection',
        fields: [
          { k: 'visual.text', label: 'Ghi chú kiểm tra', type: 'textarea' },
          { k: 'visual.eval', label: 'Đánh giá chung', type: 'select', options: ['', 'Đạt', 'Không đạt'] },
        ],
        grids: [{
          id: 'visual.items', title: 'Hạng mục kiểm tra', tables: [1], rows: VISUAL_ITEMS.map((t, i) => ({ k: `i${i + 1}`, label: t, doc: i + 1 })),
          cols: [col('e', 'Đánh giá', 2, { text: true, options: ['Đạt/Pass', 'Không đạt/Fail'] })],
        }],
      },
      {
        id: 'noload', no: 2, title: 'Dòng điện và tổn hao không tải ở điện áp định mức', en: 'No-load current & loss',
        groups: PH3.map((ph, i) => ({
          id: ph, title: unitTitle(ph),
          grids: [{
            id: `nl.${ph}.rated`, title: 'Đưa điện áp vào phía hạ áp', tables: [2 + i],
            rows: [{ k: 'r0', label: 'Lần 1', doc: 1 }, { k: 'r1', label: 'Lần 2', doc: 2 }],
            cols: [col('pu', '%Uđm', 0, { text: true }), col('um', "U' mean (kV)", 1), col('ur', 'U rms (kV)', 2), col('ia', 'I0 (A)', 3), col('i0', 'I0 (%)', 4, { auto: true }),
              col('pm', 'Pmean (kW)', 5), col('p0', 'P0 (kW)', 6, { auto: true })],
          }],
        })),
      },
      {
        id: 'ir', no: 3, title: 'Điện trở cách điện cuộn dây, lõi từ, gông từ', en: 'Insulation resistance',
        groups: PH3.map((ph, i) => ({
          id: ph, title: unitTitle(ph),
          fields: [{ k: `ir.${ph}.t`, label: 'Nhiệt độ đo (°C)', num: true, doc: { before: 5 + 2 * i, re: /temperature\)\s*\/(?<v>\s*)oC/ } }],
          grids: [
            { id: `ir.${ph}.meas`, title: 'Số liệu đo', tables: [5 + 2 * i], rows: IR3_ROWS.map((r, j) => Object.assign({ doc: j + 1 }, r)), cols: IR3_COLS,
              skip: (r, c) => ['r6', 'r7', 'r8'].includes(r) && !['r60', 'u'].includes(c) },
            { id: `ir.${ph}.c20`, title: 'Quy đổi về 20 °C (tự tính)', tables: [6 + 2 * i], readonly: true,
              rows: IR3_ROWS.filter(r => !r.core).map((r, j) => Object.assign({ doc: j + 1 }, r)), cols: IR3_COLS.map(c => Object.assign({}, c, { calc: true, auto: false })) },
          ],
        })),
        extraDoc: PH3.flatMap((ph, i) => [
          { k: `ir.${ph}.k1`, label: `Hệ số quy đổi K1 pha ${ph} (ghi vào BBTN)`, doc: { before: 6 + 2 * i, re: /K1\s*=(?<v>\s*)\(/ } },
          { k: `ir.${ph}.sn`, label: `Số chế tạo máy pha ${ph} (ghi vào BBTN)`, doc: { before: 5 + 2 * i, re: /N0:(?<v>\s*)\)/ } },
        ]),
      },
      {
        id: 'vector', no: 4, title: 'Kiểm tra tổ đấu dây', en: 'Vector group',
        fields: [{ k: 'vector.result', label: 'Tổ đấu dây đo được', doc: { before: 11, re: /group\)\s*\/(?<v>.*)$/ } }],
      },
      {
        id: 'bushing', no: 5, title: 'Tgδ và điện dung các sứ đầu vào', en: 'Bushings',
        groups: BUSHING3.map((B, i) => ({
          id: B.id, title: B.title, term: B.term,
          fields: [
            { k: `b.${B.id}.t`, label: i ? 'Nhiệt độ chung (°C) — trống: lấy theo nhóm sứ cao áp' : 'Nhiệt độ chung khi đo sứ (°C) — sứ không nhập nhiệt độ riêng', num: true,
              doc: i ? undefined : { before: 11, re: /t\s*=(?<v>\s*)oC/ } },
            { k: `b.${B.id}.btype`, label: 'Loại cách điện sứ', type: 'select', options: ['RIP', 'OIP', 'RIS', 'RBP', 'GIF'] },
            { k: `b.${B.id}.kmode`, label: 'Cách quy đổi về 20 °C', type: 'select', options: KMODES },
            { k: `b.${B.id}.mount`, label: 'Trạng thái sứ khi đo', type: 'select', options: ['Đã lắp', 'Chưa lắp'] },
            { k: `b.${B.id}.tamb`, label: 'Nhiệt độ môi trường khi đo sứ (°C)', num: true, placeholder: 'mặc định: nhiệt độ môi trường ở mục 0' },
            { k: `b.${B.id}.k`, label: 'Hệ số K (tgδ20 = tgδ × K)', num: true },
          ],
          grids: [bushing3Grid(B), bushing3C20(B)],
        })),
      },
      {
        id: 'wtgd', no: 7, title: 'Tgδ và điện dung các cuộn dây', en: 'Winding tgδ',
        groups: PH3.map((ph, i) => ({
          id: ph, title: unitTitle(ph),
          fields: [{ k: `wtgd.${ph}.t`, label: 'Nhiệt độ cuộn dây/dầu (°C)', num: true, doc: { before: 16 + i, re: /t\s*=(?<v>\s*)oC/ } }],
          grids: [{
            id: `wtgd.${ph}.meas`, title: 'Số liệu đo', tables: [16 + i], rows: wtgdRows, corner: 'Đối tượng đo',
            cols: [col('tgd', 'tgδ (%) ở t đo', 1), col('t20', 'tgδ (%) ở 20 °C', 2, { calc: true }), col('c', 'C (pF)', 3), col('u', 'U đo (kV)', 4, { text: true }),
              col('d', 'Sơ đồ đo', 5, { text: true, options: TGD_MODES })],
          }],
        })),
        extraDoc: PH3.flatMap((ph, i) => [
          { k: `wtgd.${ph}.k2`, label: `Hệ số quy đổi K2 pha ${ph} (ghi vào BBTN)`, doc: { before: 16 + i, re: /k\s*=(?<v>.*)$/ } },
          { k: `wtgd.${ph}.th`, label: `Nhiệt độ ở tiêu đề cột bảng pha ${ph}`, doc: { t: 16 + i, r: 0, c: 1, re: /ở(?<v>\s*)oC/ } },
        ]),
      },
      {
        id: 'dcr', no: 8, title: 'Điện trở một chiều các cuộn dây', en: 'Winding resistance (mΩ)',
        groups: [
          {
            id: 'hv', title: `8a. Cuộn cao áp — đo ${hvPairs.map(p => p.app).join(' / ')} (mΩ)`,
            fields: [{ k: 'cfg.hvMeas', cfg: 'hvMeas', label: 'Phép đo cuộn cao áp', options: HV_MEAS }]
              .concat(PH3.map(ph => ({ k: `dcr.${ph}.t`, label: `Nhiệt độ đo máy pha ${ph} (°C)`, num: true,
                doc: { before: 19, re: new RegExp(`Pha ${ph}:\\s*t\\s*=(?<v>\\s*)oC`) } }))),
            grids: [{
              id: 'dcr.hv', title: 'Theo nấc', tables: [19], rows: tapRows(taps),
              cols: hvPairs.flatMap((p, i) => [
                col(p.ph, p.app, 1 + i, { phase: true, docLabel: p.doc }), col('d' + p.ph, `ΔR ${p.app} vs XX (%)`, undefined, { calc: true, nodoc: true }),
              ]).concat([col('dP', 'ΔR(A,B,C) (%)', 4, { calc: true })]),
            }],
          },
          {
            id: 'mv', title: '8b. Cuộn trung áp — Am-N / Bm-N / Cm-N (mΩ)',
            grids: [{ id: 'dcr.mv', title: '', tables: [20], rows: [{ k: 'r', label: 'Giá trị', doc: 1 }],
              cols: phaseCols(['AmN', 'BmN', 'CmN'], 0, () => 'ΔR vs XX (%)', { calc: true }).concat([col('dP', 'ΔR(A,B,C) (%)', 3, { calc: true })]) }],
          },
          {
            id: 'lv', title: '8c. Cuộn hạ áp — a-x / b-y / c-z (mΩ)',
            grids: [{ id: 'dcr.lv', title: '', tables: [21], rows: [{ k: 'r', label: 'Giá trị', doc: 1 }],
              cols: phaseCols(['ax', 'by', 'cz'], 0, () => 'ΔR vs XX (%)', { calc: true }).concat([col('dP', 'ΔR(ax,by,cz) (%)', 3, { calc: true })]) }],
          },
        ],
      },
      {
        id: 'ratio', no: 9, title: 'Tỷ số biến', en: 'Voltage ratio',
        groups: [
          { id: 'hm', title: '9a. HV : MV', grids: [{ id: 'ratio.hm', title: 'Theo nấc', tables: [22], rows: tapRows(taps), corner: 'Nấc', editHdr: true,
            cols: hdr('ratio.hm', phaseCols(['UAN/UAmN', 'UBN/UBmN', 'UCN/UCmN'], 1, () => 'ΔK so Kđm (%)', { auto: true }).concat([col('dP', 'ΔKmax (%)', 4, { calc: true })])) }] },
          { id: 'hl', title: '9b. HV : LV', grids: [{ id: 'ratio.hl', title: 'Theo nấc', tables: [23], rows: tapRows(taps), corner: 'Nấc', editHdr: true,
            cols: hdr('ratio.hl', phaseCols(['UAN/Uax', 'UBN/Uby', 'UCN/Ucz'], 1, () => 'ΔK so Kđm (%)', { auto: true }).concat([col('dP', 'ΔKmax (%)', 4, { calc: true })])) }] },
          { id: 'ml', title: '9c. MV : LV (nấc 9)', grids: [{ id: 'ratio.ml', title: '', tables: [24], rows: [{ k: 'r', label: 'Nấc 9', doc: 1 }], editHdr: true,
            cols: hdr('ratio.ml', phaseCols(['UAmN/Uax', 'UBmN/Uby', 'UCmN/Ucz'], 1, () => 'ΔK so Kđm (%)', { auto: true }).concat([col('dP', 'ΔKmax (%)', 4, { calc: true })])) }] },
        ],
      },
      {
        id: 'moisture', no: 10, title: 'Hàm lượng ẩm trong cách điện cứng', en: 'Moisture in solid insulation',
        fields: [{ k: 'moist.method', label: 'Phương pháp / thiết bị', placeholder: 'vd: FDS/PDC – Omicron Dirana' }],
        grids: [{ id: 'moist', title: 'Theo pha', tables: [25], rows: [{ k: 'r', label: 'Hàm lượng ẩm (%)', doc: 1 }],
          cols: PH3.map((ph, i) => col(ph, `CHL${ph} (%)`, i, { phase: true })) }],
      },
      {
        id: 'oltc', no: 11, title: 'Kiểm tra bộ điều áp dưới tải', en: 'OLTC',
        fields: [
          { k: 'oltc.type', label: 'Kiểu (Type)', doc: { t: 26, r: 0, c: 0, re: /\(Type\):(?<v>.*)$/ } },
          { k: 'oltc.serial', label: 'Số chế tạo', doc: { t: 26, r: 0, c: 1, re: /\(Serial No\):(?<v>.*)$/ } },
          { k: 'oltc.manuf', label: 'Hãng sản xuất', doc: { t: 26, r: 1, c: 0, re: /\(Manufacturer\):(?<v>.*)$/ } },
          { k: 'oltc.year', label: 'Năm sản xuất', doc: { t: 26, r: 1, c: 1, re: /manufacture\):(?<v>.*)$/ } },
          { k: 'oltc.osc', label: 'Kết quả chụp công tắc K', type: 'textarea', doc: { before: 27, re: /\(Oscillograph\s*result\):(?<v>.*)$/ } },
          { k: 'oltc.eval', label: 'Đánh giá OLTC', type: 'select', options: ['', 'Đạt', 'Không đạt'] },
        ],
        grids: [{
          id: 'oltc.r', title: 'Số vòng quay theo pha', tables: [26],
          rows: range(6, i => ({ k: `up${i + 1}`, label: `Tăng nấc ${i + 1}`, doc: 4 + i })).concat(range(6, i => ({ k: `dn${i + 1}`, label: `Giảm nấc ${i + 1}`, doc: 12 + i }))),
          cols: [col('tap', 'Nấc đến', 0, { text: true, slot: /Nấc đến:(?<v>[^(]*)/ })]
            .concat(PH3.map((ph, i) => col('k' + ph, `K tác động – ${ph}`, 1 + i, { text: true })))
            .concat(PH3.map((ph, i) => col('c' + ph, `Hết chu trình – ${ph}`, 4 + i, { text: true }))),
        }],
      },
      {
        id: 'bct', no: 13, title: 'Biến dòng chân sứ (phụ lục)', en: 'Bushing CT',
        fields: [
          { k: 'bct.visual', label: 'Kiểm tra bên ngoài' },
          { k: 'bct.t_ir', label: 'Nhiệt độ đo cách điện (°C)', num: true },
          { k: 'bct.polarity', label: 'Kết quả kiểm tra cực tính', placeholder: 'vd: Đúng cực tính (giảm)' },
          { k: 'bct.t_dcr', label: 'Nhiệt độ đo điện trở 1 chiều (°C)', num: true },
        ],
        // không có bảng trong thân BBTN mẫu 3 pha: số liệu xuất thành Phụ lục biến dòng chân sứ
        groups: ['hv', 'mv', 'lv'].map(side => ({ id: side, title: BCT_SIDES[side].label, bct: side, grids: bctGrids(side, +cfg.bctCores[side]).map(noDoc) }))
          .concat([{ id: 'n', title: 'Phía trung tính — đặc tính từ hóa', grids: [noDoc(exGrid('bct.n.ex.N', 'Đặc tính từ hóa — Trung tính', [50], 3, 4))] }]),
      },
      {
        // Thí nghiệm ngắn mạch: mục cuối biên bản (mẫu Word không có — app thêm chỉ mục và bảng khi xuất BBTN)
        id: 'shortCircuit', no: 14, title: 'Thí nghiệm ngắn mạch máy biến áp', en: 'Short-circuit impedance & load loss',
      },
    ];
    return { sections, taps, head: META_3P, tail: CLOSING_3P, layout: LAYOUT_3P, summary: SUMMARY[LAYOUT_3P], tables: 28 };
  }
  const noDoc = g => Object.assign({}, g, { tables: undefined });
  // Thông tin chung mẫu 3 pha (bảng 0: cột phải bắt đầu ở cột lưới 3; "Serial N0" ghi số 0)
  const META_3P = META.map(f => {
    const d = Object.assign({}, f.doc);
    if (d.c === 2) d.c = 3;
    if (f.k === 'meta.project') d.re = /\(\s*Project\):(?<v>.*)$/;
    if (f.k === 'meta.year') d.re = /[Mm]anufacture\):(?<v>.*)$/;
    if (f.k === 'meta.serial') d.re = /\(Serial N[0O]\):(?<v>.*)$/;
    if (f.k === 'meta.type') d.re = /\(Type\):(?<v>.*)$/;
    if (f.k === 'meta.power') d.re = /\(MVA\):(?<v>.*)$/;
    if (f.k === 'meta.voltage') { d.re = /\(kV\):(?<v>.*)$/; delete d.joinNext; }
    if (f.k === 'meta.current') d.re = /\(A\):(?<v>.*)$/;
    if (f.k === 'meta.reason') d.re = /test\):(?<v>.*)$/;
    if (f.k === 'meta.ambT') d.re = /\(Temp[,.]?\):(?<v>\s*)[0o]C/;
    if (f.k === 'meta.hum') d.re = /\(Humidity\):(?<v>\s*)%/;
    return Object.assign({}, f, { doc: d }, f.k === 'meta.serial' ? { label: 'Số chế tạo máy chính (ghi vào BBTN cùng số chế tạo 3 pha)' } : {});
  });
  const CLOSING_3P = [
    { k: 'meta.remark', label: 'Ghi chú (Remark)', type: 'textarea', doc: { t: 0, r: 24, c: 0, re: /\(Remark\):(?<v>.*)$/ } },
    { k: 'meta.conclusion', label: 'Kết luận (Conclusion)', type: 'textarea', doc: { t: 0, r: 25, c: 0, re: /\(Conclusion\):(?<v>.*)$/ } },
  ];

  // Chỉ số bảng mẫu theo pha (73 bảng) → mẫu 110-220 (71 bảng). Bảng ngắt trang ở chỗ khác: một bảng có thể ứng với
  // hai bảng (vd đặc tính từ hóa) hoặc không bảng nào (đã gộp vào bảng trước, vd tỷ số HV:MV 21+22 → 21). Số hàng sau khi
  // ghép các bảng của từng nhóm bằng nhau ở hai mẫu (kiểm tra trong test/mba-110.test.js với template thật nếu có).
  const MAP_110 = (() => {
    const m = {};
    for (let i = 0; i <= 20; i++) m[i] = [i];
    Object.assign(m, {
      21: [21], 22: [], 23: [22], 24: [23], 25: [24], 26: [25], 27: [26], 28: [27], 29: [], 30: [28], 31: [29], 32: [30],
      33: [31, 32], 34: [33], 35: [34], 36: [35], 37: [36], 38: [37], 39: [38], 40: [39], 41: [40], 42: [], 43: [41, 42],
      44: [43], 45: [44], 46: [45], 47: [46, 47], 48: [48], 49: [49], 50: [50], 51: [51, 52], 52: [53], 53: [54],
      54: [55], 55: [56], 56: [57], 57: [58], 58: [59], 59: [60], 60: [61], 61: [62], 62: [63], 63: [64], 64: [], 65: [65], 66: [66], 67: [],
      68: [67], 69: [68], 70: [69], 71: [70],
    });
    return m;
  })();
  const TAPS_19 = range(19, i => String(i + 1));
  function remapTables(schema, map) {
    const tbl = ts => ts.flatMap(i => map[i]);
    const doc = d => {
      if (!d) return d;
      const o = Object.assign({}, d);
      if (o.before !== undefined) o.before = map[o.before][0];
      if (o.t !== undefined) o.t = map[o.t][0];
      return o;
    };
    const field = f => (f.doc ? Object.assign({}, f, { doc: doc(f.doc) }) : f);
    // sứ trung áp: mẫu theo pha có hàng kiểu loại / hãng ở bảng lưới 7 cột (cột riêng, cmap); mẫu 110-220 cùng lưới 8 cột với các hàng khác
    const grid = g => (g.tables ? Object.assign({}, g, { tables: tbl(g.tables) },
      g.id === 'b.mv.meas' ? { rows: g.rows.map(r => { const o = Object.assign({}, r); delete o.cmap; return o; }) } : {}) : g);
    const sec = s => Object.assign({}, s, {
      fields: s.fields && s.fields.map(field), extraDoc: s.extraDoc && s.extraDoc.map(field), grids: s.grids && s.grids.map(grid),
      groups: s.groups && s.groups.map(gr => Object.assign({}, gr, { fields: gr.fields && gr.fields.map(field), grids: gr.grids && gr.grids.map(grid) })),
    });
    return Object.assign({}, schema, { sections: schema.sections.map(sec), head: schema.head.map(field), tail: schema.tail.map(field) });
  }

  // Điện trở một chiều: nhiệt độ đo riêng từng pha của từng cuộn dây (mỗi pha đo vào thời điểm khác nhau) và cột R
  // quy đổi về 75 °C (tự tính, chỉ hiện trong app) cạnh mỗi cột pha.
  // Nhiệt độ dùng quy đổi: ô pha của cuộn → ô chung của cuộn → (mẫu 3 pha) nhiệt độ đo của máy pha đó.
  function dcrTemp(num, g, ph, is3P) {
    const fin = x => typeof x === 'number' && Number.isFinite(x);
    const own = num(`${g}.t${ph}`);
    if (fin(own)) return own;
    const common = num(`${g}.t`);
    if (fin(common)) return common;
    return is3P ? num(`dcr.${ph}.t`) : NaN;
  }
  const DCR_WINDING = { hv: 'cao áp', mv: 'trung áp', lv: 'hạ áp' };
  // Nhiệt độ quy đổi R một chiều (cfg.dcrRefT, chọn ở mục điện trở một chiều); trống / không hợp lệ → 75 °C
  function dcrRefOf(cfg) {
    const n = parseFloat(String((cfg && cfg.dcrRefT) ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 75;
  }
  const tTxt = t => String(t).replace('.', ',');
  function withDcr75(schema, cfg) {
    const is3P = schema.layout === LAYOUT_3P;
    const T = tTxt(dcrRefOf(cfg));
    const refField = { k: 'cfg.dcrRefT', cfg: 'dcrRefT', num: true, label: 'Quy đổi R về nhiệt độ (°C) — mặc định 75; ghi vào BBTN' };
    const sections = schema.sections.map(s => (s.id !== 'dcr' ? s : Object.assign({}, s, {
      groups: s.groups.map((g, gi) => {
        const grid = (g.grids || [])[0];
        const w = grid && String(grid.id).split('.')[1];
        if (!DCR_WINDING[w]) return g;
        const tk = `dcr.${w}.t`;
        const name = `Nhiệt độ chung cuộn ${DCR_WINDING[w]} (°C) — dùng cho pha để trống${is3P ? '; trống: nhiệt độ máy từng pha' : ''}`;
        const fields = (gi ? [] : [refField]).concat((g.fields || []).map(f => (f.k === tk ? Object.assign({}, f, { label: name }) : f)));
        if (!fields.some(f => f.k === tk)) fields.push({ k: tk, label: name, num: true });
        // ô nhiệt độ đo riêng từng pha, đặt ngay sau ô chung
        const at = fields.findIndex(f => f.k === tk) + 1;
        const phaseFields = grid.cols.filter(c => c.phase).map(c => ({ k: `${tk}${c.k}`, label: `Nhiệt độ đo ${c.label} (°C)`, num: true }));
        fields.splice(at, 0, ...phaseFields);
        const grids = g.grids.map(gr => Object.assign({}, gr, {
          // nấc trung gian 9b, 9c chạy bypass khi chuyển nấc (vận hành dùng 9a): không nhập, không đánh giá, không ghi BBTN
          // (giữ chỉ số hàng Word của các nấc còn lại; hàng 9b, 9c của mẫu để trống)
          rows: gr.rows.filter(r => !/^\d+[bc]$/i.test(String(r.tap || ''))),
          // khóa r75<pha> giữ tên cũ; giá trị là R quy về nhiệt độ quy đổi đang chọn (mặc định 75 °C)
          cols: gr.cols.flatMap(c => (c.phase ? [c, col(`r75${c.k}`, `${c.label} @${T} °C`, undefined, { calc: true, nodoc: true, r75: true })] : [c])),
        }));
        return Object.assign({}, g, { fields, grids });
      }),
    })));
    return Object.assign({}, schema, { sections });
  }

  // Biên bản nhập trước khi ẩn nấc 9b, 9c (vd file máy đo ghi nấc 9 vào 9b): các ô R một chiều có số ở hàng 9b / 9c
  // mà hàng 9a cùng cột trống → [{ from, to }] để chuyển về 9a (ưu tiên 9b rồi 9c)
  function dcrMidMoves(v, cfg) {
    const taps = (cfg && cfg.taps && cfg.taps.length === 19 ? cfg.taps : DEFAULT_TAPS).map(t => String(t).toLowerCase());
    const has = k => String(v[k] ?? '').trim() !== '';
    const out = [];
    taps.forEach((t, i) => {
      const m = t.match(/^(\d+)a$/);
      if (!m) return;
      const subs = ['b', 'c'].map(x => taps.indexOf(m[1] + x)).filter(j => j >= 0);
      ['dcr.hv', 'dcr.mv'].forEach(g => ['A', 'B', 'C'].forEach(ph => {
        const to = `${g}.t${i + 1}.${ph}`;
        if (has(to)) return;
        const j = subs.find(x => has(`${g}.t${x + 1}.${ph}`));
        if (j !== undefined) out.push({ from: `${g}.t${j + 1}.${ph}`, to });
      }));
    });
    return out;
  }

  function build(cfg) {
    return withDcr75(buildRaw(cfg), cfg);
  }
  function buildRaw(cfg) {
    const layout = layoutOf(cfg);
    if (layout === LAYOUT_3P) return build3P(cfg);
    if (layout === LAYOUT_110) {
      // nấc đánh số 1…19 (mẫu theo pha: 9a/9b/9c); người dùng đã đặt danh sách nấc riêng thì giữ
      const custom = cfg.taps && cfg.taps.length === 19 && cfg.taps.join() !== DEFAULT_TAPS.join();
      const s = build1P(Object.assign({}, cfg, { taps: custom ? cfg.taps : TAPS_19 }));
      const s110 = withOltcField(Object.assign(remapTables(s, MAP_110), { layout: LAYOUT_110, tables: 71 }));
      return cfg.oltcWinding === 'MV' ? oltcOnMV(s110, cfg) : s110;
    }
    return build1P(cfg);
  }

  // ---------------------------------------------------------------- OLTC đặt ở cuộn nào (chỉ mẫu 110–220 kV)
  // MBA 220 kV kiểu Liên Xô cũ đặt OLTC ở cuộn trung áp 110 kV: R một chiều cuộn trung áp và tỷ số MV:LV theo nấc,
  // cuộn cao áp và tỷ số HV:LV một giá trị. Dùng lại bảng nấc / bảng một hàng sẵn có của template: đổi bảng giữa hai
  // lưới, ghi lại hàng tiêu đề cột (docLabel) và đổi nhãn đề mục khi xuất (schema.docSwaps, MbaReport.fill).
  // Số liệu đính kèm biên bản (state.att) thuộc hạng mục nào — xóa / hoàn tác / bỏ tích "Thực hiện" theo hạng mục
  const ATT_SECTIONS = { oltc: 'oltc', oscAuto: 'oltc', shortCircuit: 'shortCircuit' };
  const OLTC_WINDINGS = [['HV', 'Cuộn cao áp (mặc định)'], ['MV', 'Cuộn trung áp 110 kV (MBA 220 kV kiểu Liên Xô cũ)']];
  const findIn = (sec, id) => sec.groups.find(g => g.id === id);
  function withOltcField(schema) {
    const sections = schema.sections.map(s => (s.id !== 'dcr' ? s : Object.assign({}, s, {
      groups: s.groups.map((g, i) => (i ? g : Object.assign({}, g, {
        fields: [{ k: 'cfg.oltcWinding', cfg: 'oltcWinding', label: 'Bộ điều áp dưới tải (OLTC) đặt ở cuộn', options: OLTC_WINDINGS }].concat(g.fields || []),
      }))),
    })));
    return Object.assign({}, schema, { sections });
  }
  // Lưới mới dùng bảng / hàng của lưới khác; cột dời chỉ số cột Word (bảng nấc có cột "Nấc" ở đầu) và ghi tiêu đề cột
  // theo docLabels (người dùng đã sửa tiêu đề — editHdr — thì giữ chữ của người dùng)
  function moveGrid(g, onto, rows, shift, docLabels, extra) {
    const cols = g.cols.map((c, i) => Object.assign({}, c, {
      doc: c.doc === undefined ? undefined : c.doc + shift,
      docLabel: c.defLabel && c.label !== c.defLabel ? c.label : docLabels[i],
    }));
    return Object.assign({}, g, { tables: onto.tables, rows, cols }, extra || {});
  }
  function oltcOnMV(schema, cfg) {
    const ser = cfg.hvMeas === 'SER';
    const hvDoc = PH3.map(ph => (ser ? `${ph}${ph}m` : `${ph}N`));
    const hvApp = PH3.map(ph => (ser ? `${ph}-${ph}m` : `${ph}-N`));
    const one = [{ k: 'r', label: 'Giá trị', doc: 1 }];
    const swaps = [];
    const sections = schema.sections.map(s => {
      if (s.id === 'dcr') {
        const hv = findIn(s, 'hv'), mv = findIn(s, 'mv'), lv = findIn(s, 'lv');
        const hvG = hv.grids[0], mvG = mv.grids[0];
        swaps.push({ kind: 'winding', a: hvG.tables[0], b: mvG.tables[0] });
        // nhiệt độ đo ghi vào đoạn đề mục đứng trước bảng mới của lưới
        const field = (f, before) => (f.doc ? Object.assign({}, f, { doc: Object.assign({}, f.doc, { before }) }) : f);
        const mvGrid = moveGrid(mvG, hvG, hvG.rows, 1,
          ['AmN', 'ΔRAmN(%)', 'BmN', '∆RBmN(%)', 'CmN', '∆RCmN(%)', '∆R(A,B,C)(%)'], { title: 'Theo nấc', corner: 'Nấc' });
        const hvGrid = moveGrid(hvG, mvG, one, -1,
          [hvDoc[0], `ΔR${hvDoc[0]}(%)`, hvDoc[1], `∆R${hvDoc[1]}(%)`, hvDoc[2], `∆R${hvDoc[2]}(%)`, '∆R(A,B,C)(%)'], { title: '' });
        delete hvGrid.corner;
        const n = s.no;
        return Object.assign({}, s, { groups: [
          Object.assign({}, mv, { title: `${n}.1 Cuộn trung áp — theo nấc OLTC — Am-N / Bm-N / Cm-N (mΩ)`,
            fields: hv.fields.filter(f => f.cfg === 'oltcWinding').concat((mv.fields || []).map(f => field(f, hvG.tables[0]))), grids: [mvGrid] }),
          Object.assign({}, hv, { title: `${n}.2 Cuộn cao áp — đo ${hvApp.join(' / ')} (mΩ)`,
            fields: hv.fields.filter(f => f.cfg !== 'oltcWinding').map(f => field(f, mvG.tables[0])), grids: [hvGrid] }),
          Object.assign({}, lv, { title: lv.title.replace(/^\d+\.\d+/, `${n}.3`) }),
        ] });
      }
      if (s.id === 'ratio') {
        const hm = findIn(s, 'hm'), hl = findIn(s, 'hl'), ml = findIn(s, 'ml');
        const hlG = hl.grids[0], mlG = ml.grids[0];
        swaps.push({ kind: 'ratio', a: hlG.tables[0], b: mlG.tables[0] });
        const mlGrid = moveGrid(mlG, hlG, hlG.rows, 1,
          ['UAmBm/Uab', '∆KAmBm/ab(%)', 'UBmCm/Ubc', '∆KBmCm/bc(%)', 'UCmAm/Uca', '∆KCmAm/ca(%)', '∆K(A,B,C)(%)'], { title: 'Theo nấc', corner: 'Nấc' });
        const hlGrid = moveGrid(hlG, mlG, one, -1,
          ['UAB/Uab', '∆KAB/ab(%)', 'UBC/Ubc', '∆KBC/bc(%)', 'UCA/Uca', '∆KCA/ca(%)', '∆K(A,B,C)(%)'], { title: '' });
        delete hlGrid.corner;
        const n = s.no;
        return Object.assign({}, s, { groups: [
          hm,
          Object.assign({}, ml, { title: `${n}.2 Cuộn MV : LV — theo nấc OLTC`, grids: [mlGrid] }),
          Object.assign({}, hl, { title: `${n}.3 Cuộn HV : LV`, grids: [hlGrid] }),
        ] });
      }
      return s;
    });
    return Object.assign({}, schema, { sections, oltcWinding: 'MV', docSwaps: swaps });
  }
  function build1P(cfg) {
    const taps = (cfg.taps && cfg.taps.length === 19) ? cfg.taps : DEFAULT_TAPS;
    // Đầu đo theo pha cho bảng 7.1: app hiện "A-N" / "A-Am"; template ghi liền "AN" / "AAm"
    const hvSer = cfg.hvMeas === 'SER';
    const hvPairs = ['A', 'B', 'C'].map(ph => ({ ph, app: hvSer ? `${ph}-${ph}m` : `${ph}-N`, doc: hvSer ? `${ph}${ph}m` : `${ph}N` }));
    // Cách quy đổi tgδ sứ: HD Hitachi, bảng QĐ 1901, bảng theo hãng (admin cấu hình), nhập K
    const KMODES = typeof BushingK !== 'undefined' ? BushingK.modeOptions() : ['Hitachi Energy (RIP) – theo HD hãng', 'Nhập hệ số K'];
    // Đề mục cột người dùng sửa (cfg.hdr), đối tượng đo mục 6 sửa/thêm dòng (cfg.wtgdLabels, cfg.wtgdRows)
    const hdr = (gid, cols) => cols.map(c => Object.assign({}, c, { label: (cfg.hdr || {})[`${gid}.${c.k}`] || c.label, defLabel: c.label }));
    const wtgdRows = WTGD_ROWS.map(r => Object.assign({}, r, { label: (cfg.wtgdLabels || {})[r.k] || r.label, defLabel: r.label }))
      .concat((cfg.wtgdRows || []).map(x => ({ k: x.k, label: (cfg.wtgdLabels || {})[x.k] || '', defLabel: '', extra: true })))
      .map((r, i) => Object.assign(r, { doc: i + 1 }));
    const sections = [
      {
        id: 'visual', no: 1, title: 'Kiểm tra bên ngoài', en: 'Visual inspection',
        fields: [
          { k: 'visual.text', label: 'Kết quả kiểm tra', type: 'textarea', doc: { before: 1, re: /\(Visual\s*inspection\)\s*:(?<v>.*)$/ } },
          { k: 'visual.eval', label: 'Đánh giá', type: 'select', options: ['', 'Đạt', 'Không đạt'] },
        ],
      },
      {
        id: 'noload', no: 2, title: 'Dòng điện và tổn hao không tải', en: 'No-load current & loss',
        grids: [
          {
            id: 'nl.lv', title: '2.1 Đo ở điện áp thấp — trên cuộn hạ áp', tables: [1],
            rows: ['ab', 'bc', 'ca'].map((p, i) => ({ k: p, label: p, doc: i + 1 })),
            cols: [col('u', 'Uo (kV)', 1), col('i', 'Io (A)', 2), col('p', 'Po (W)', 3), col('s', 'Nối tắt', 4, { text: true })],
          },
          {
            id: 'nl.hv', title: '2.2 Đo ở điện áp thấp — trên cuộn cao/trung áp', tables: [2],
            rows: ['AB', 'BC', 'CA'].map((p, i) => ({ k: p, label: p, doc: i + 1 })),
            cols: [col('u', 'Uo (kV)', 1), col('i', 'Io (A)', 2), col('p', 'Po (W)', 3), col('s', 'Nối tắt', 4, { text: true })],
          },
          {
            id: 'nl.rated', title: '2.3 Đo ở điện áp định mức', tables: [3],
            rows: [{ k: 'r0', label: 'Uđm (lần 1)', doc: 1 }, { k: 'r1', label: 'Uđm (lần 2)', doc: 2 }],
            cols: [col('um', "U' mean (kV)", 1), col('ur', 'U rms (kV)', 2), col('ia', 'Iax (A)', 3), col('ib', 'Iby (A)', 4), col('ic', 'Icz (A)', 5),
              col('i0', 'I0 (%)', 6, { auto: true }), col('pm', 'Pm (kW)', 7), col('p0', 'P0 (kW)', 8, { auto: true })],
          },
        ],
      },
      {
        id: 'ir', no: 3, title: 'Điện trở cách điện cuộn dây, lõi từ, gông từ', en: 'Insulation resistance',
        fields: [{ k: 'ir.t', label: 'Nhiệt độ đo (°C)', num: true, doc: { before: 4, re: /temperature\):(?<v>\s*)oC/ } }],
        grids: [
          {
            id: 'ir.meas', title: 'Số liệu đo', tables: [4], rows: IR_ROWS.concat(CORE_ROWS).map((r, i) => Object.assign({ doc: i + 1 }, r)), cols: IR_COLS,
            skip: (r, c) => ['r6', 'r7', 'r8'].includes(r) && !['r60', 'u'].includes(c),
          },
          {
            id: 'ir.c20', title: 'Quy đổi về 20 °C (tự tính)', tables: [5, 6], readonly: true,
            rows: IR_ROWS.map((r, i) => Object.assign({ doc: i + 1 }, r)), cols: IR_COLS.map(c => Object.assign({}, c, { calc: true, auto: false })),
          },
        ],
        extraDoc: [{ k: 'ir.k1', doc: { before: 5, re: /K1\s*=(?<v>.*)$/ } }],
      },
      {
        id: 'vector', no: 4, title: 'Kiểm tra tổ đấu dây', en: 'Vector group',
        fields: [{ k: 'vector.result', label: 'Tổ đấu dây đo được', doc: { before: 7, re: /\(Vector\s*group\)\s*:(?<v>.*)$/ } }],
      },
      {
        id: 'bushing', no: 5, title: 'Tgδ, điện dung và thử AC sứ đầu vào', en: 'Bushings',
        groups: [
          {
            id: 'hv', title: '5.1 Sứ phía cao áp (HV)', term: '1.1',
            fields: [
              { k: 'b.hv.t', label: 'Nhiệt độ dầu (°C)', num: true, doc: { before: 7, re: /t=(?<v>\s*)oC/ } },
              { k: 'b.hv.btype', label: 'Loại cách điện sứ', type: 'select', options: ['RIP', 'OIP', 'RIS', 'RBP', 'GIF'], doc: { before: 8, re: /Loại\s*sứ:(?<v>)/ } },
              { k: 'b.hv.kmode', label: 'Cách quy đổi về 20 °C', type: 'select', options: KMODES },
              { k: 'b.hv.mount', label: 'Trạng thái sứ khi đo', type: 'select', options: ['Đã lắp', 'Chưa lắp'] },
              { k: 'b.hv.tamb', label: 'Nhiệt độ môi trường khi đo sứ (°C)', num: true, placeholder: 'mặc định: nhiệt độ môi trường ở mục 0' },
              { k: 'b.hv.k', label: 'Hệ số K (tgδ20 = tgδ × K)', num: true, doc: { before: 8, re: /quy đổi K\s*=(?<v>.*)$/ } },
            ],
            grids: [
              bushingGrid('hv', [{ k: 'A', label: 'A', doc: 2 }, { k: 'B', label: 'B', doc: 3 }, { k: 'C', label: 'C', doc: 4 }], [7], { u: 5, d: 6 }),
              bushingC20Grid('hv', [{ k: 'A', label: 'A', doc: 2 }, { k: 'B', label: 'B', doc: 3 }, { k: 'C', label: 'C', doc: 4 }], 8, { u: 5, d: 6 }),
            ],
          },
          {
            id: 'mv', title: '5.2 Sứ phía trung áp và trung tính (MV, N)', term: '2.1',
            fields: [
              { k: 'b.mv.t', label: 'Nhiệt độ dầu (°C)', num: true, doc: { before: 9, re: /t=(?<v>\s*)oC/ } },
              { k: 'b.mv.btype', label: 'Loại cách điện sứ', type: 'select', options: ['RIP', 'OIP', 'RIS', 'RBP', 'GIF'], doc: { before: 11, re: /Loại\s*sứ:(?<v>)/ } },
              { k: 'b.mv.kmode', label: 'Cách quy đổi về 20 °C', type: 'select', options: KMODES },
              { k: 'b.mv.mount', label: 'Trạng thái sứ khi đo', type: 'select', options: ['Đã lắp', 'Chưa lắp'] },
              { k: 'b.mv.tamb', label: 'Nhiệt độ môi trường khi đo sứ (°C)', num: true, placeholder: 'mặc định: nhiệt độ môi trường ở mục 0' },
              { k: 'b.mv.k', label: 'Hệ số K (tgδ20 = tgδ × K)', num: true, doc: { before: 11, re: /quy đổi K\s*=(?<v>.*)$/ } },
            ],
            grids: [
              bushingGrid('mv', [{ k: 'A', label: 'Am', doc: 2 }, { k: 'B', label: 'Bm', doc: 3 }, { k: 'C', label: 'Cm', doc: 4 }, { k: 'N', label: 'N', doc: 5 }], [9, 10], { u: 6, d: 7 },
                { A: 1, B: 2, C: 3, N: 4 }),
              bushingC20Grid('mv', [{ k: 'A', label: 'Am', doc: 2 }, { k: 'B', label: 'Bm', doc: 3 }, { k: 'C', label: 'Cm', doc: 4 }, { k: 'N', label: 'N', doc: 5 }], 11, { u: 6, d: 7 }),
            ],
          },
          {
            id: 'lv', title: '5.3 Sứ phía hạ áp (LV)', term: '3.1',
            fields: [
              { k: 'b.lv.t', label: 'Nhiệt độ dầu (°C)', num: true, doc: { before: 12, re: /t=(?<v>\s*)oC/ } },
              { k: 'b.lv.btype', label: 'Loại cách điện sứ', type: 'select', options: ['RIP', 'OIP', 'RIS', 'RBP', 'GIF'], doc: { before: 13, re: /Loại\s*sứ:(?<v>)/ } },
              { k: 'b.lv.kmode', label: 'Cách quy đổi về 20 °C', type: 'select', options: KMODES },
              { k: 'b.lv.mount', label: 'Trạng thái sứ khi đo', type: 'select', options: ['Đã lắp', 'Chưa lắp'] },
              { k: 'b.lv.tamb', label: 'Nhiệt độ môi trường khi đo sứ (°C)', num: true, placeholder: 'mặc định: nhiệt độ môi trường ở mục 0' },
              { k: 'b.lv.k', label: 'Hệ số K (tgδ20 = tgδ × K)', num: true, doc: { before: 13, re: /quy đổi K\s*=(?<v>.*)$/ } },
            ],
            grids: [
              bushingGrid('lv', [{ k: 'a', label: 'a', doc: 2 }, { k: 'b', label: 'b', doc: 3 }, { k: 'c', label: 'c', doc: 4 }], [12], { u: 5, d: 6 }),
              bushingC20Grid('lv', [{ k: 'a', label: 'a', doc: 2 }, { k: 'b', label: 'b', doc: 3 }, { k: 'c', label: 'c', doc: 4 }], 13, { u: 5, d: 6 }),
            ],
          },
          {
            id: 'ac', title: '5.4 Thử điện áp xoay chiều tăng cao (sứ hạ áp)',
            grids: [{
              id: 'b.ac', title: 'Thử AC 1 phút', tables: [14], transposed: true,
              rows: [
                { k: 'type', label: 'Kiểu loại', doc: 1, text: true }, { k: 'manuf', label: 'Hãng sản xuất', doc: 2, text: true },
                { k: 'serial', label: 'Số chế tạo', doc: 3, text: true }, { k: 'u', label: 'Điện áp thử (kV AC)', doc: 4 },
                { k: 'dur', label: 'Thời gian thử (phút)', doc: 5 }, { k: 'eval', label: 'Đánh giá', doc: 6, select: ['', 'Đạt', 'Không đạt'] },
              ],
              cols: [col('a', 'a', 1, { phase: true }), col('b', 'b', 2, { phase: true }), col('c', 'c', 3, { phase: true }), col('N', 'N', 4, { phase: true })],
            }],
          },
        ],
      },
      {
        id: 'wtgd', no: 6, title: 'Tgδ và điện dung các cuộn dây', en: 'Winding tgδ',
        fields: [{ k: 'wtgd.t', label: 'Nhiệt độ cuộn dây/dầu (°C)', num: true, doc: { before: 15, re: /nhiệt độ:(?<v>\s*)oC/ } }],
        grids: [
          {
            id: 'wtgd.meas', title: 'Số liệu đo', tables: [15], rows: wtgdRows, corner: 'Đối tượng đo', editLabels: true, labelCfg: 'wtgdLabels',
            addRow: { act: 'addWtgdRow', del: 'delWtgdRow', label: '+ Thêm dòng đối tượng đo' },
            cols: [col('tgd', 'tgδ (%)', 1), col('c', 'C (pF)', 2), col('u', 'U đo (kV)', 3, { text: true }), col('d', 'Sơ đồ đo', 4, { text: true, options: TGD_MODES })],
          },
          {
            id: 'wtgd.c20', title: 'Quy đổi về 20 °C (tự tính)', tables: [16], readonly: true, rows: wtgdRows, corner: 'Đối tượng đo', mirrorLabels: true,
            cols: [col('tgd', 'tgδ@20 °C (%)', 1, { calc: true }), col('c', 'C (pF)', 2, { calc: true }), col('u', 'U đo (kV)', 3, { calc: true }), col('d', 'Sơ đồ đo', 4, { calc: true })],
          },
        ],
        extraDoc: [{ k: 'wtgd.k2', doc: { before: 16, re: /K2\s*=(?<v>.*)$/ } }],
      },
      {
        id: 'dcr', no: 7, title: 'Điện trở một chiều các cuộn dây', en: 'Winding resistance (mΩ)',
        groups: [
          {
            id: 'hv', title: `7.1 Cuộn cao áp — đo ${hvPairs.map(p => p.app).join(' / ')} (mΩ)`,
            fields: [
              // Cách đo cuộn cao áp (cấu hình chung với mục 0): A-N (nối tiếp + chung) hoặc A-Am (chỉ cuộn nối tiếp)
              { k: 'cfg.hvMeas', cfg: 'hvMeas', label: 'Phép đo cuộn cao áp', options: HV_MEAS },
              { k: 'dcr.hv.t', label: 'Nhiệt độ (°C)', num: true, doc: { before: 17, re: /t\s*=(?<v>\s*)oC/ } },
            ],
            grids: [{
              id: 'dcr.hv', title: 'Theo nấc', tables: [17, 18], rows: tapRows(taps),
              // đề mục cột theo cách đo; docLabel: chữ ghi vào hàng tiêu đề bảng của template (mẫu ghi "AN", "ΔRAN(%)")
              cols: hvPairs.flatMap((p, i) => [
                col(p.ph, p.app, 1 + i * 2, { phase: true, docLabel: hvSer ? p.doc : undefined }),
                col('d' + p.ph, `ΔR ${p.app} vs XX (%)`, 2 + i * 2, { calc: true, docLabel: hvSer ? `ΔR${p.doc}(%)` : undefined }),
              ]).concat([col('dP', 'ΔR(A,B,C) (%)', 7, { calc: true })]),
            }],
          },
          {
            id: 'mv', title: '7.2 Cuộn trung áp — Am-N / Bm-N / Cm-N (mΩ)',
            fields: [{ k: 'dcr.mv.t', label: 'Nhiệt độ (°C)', num: true, doc: { before: 19, re: /t\s*=(?<v>\s*)oC/ } }],
            grids: [{
              id: 'dcr.mv', title: '', tables: [19], rows: [{ k: 'r', label: 'Giá trị', doc: 1 }],
              cols: [col('A', 'AmN', 0, { phase: true }), col('dA', 'ΔR vs XX (%)', 1, { calc: true }), col('B', 'BmN', 2, { phase: true }), col('dB', 'ΔR vs XX (%)', 3, { calc: true }),
                col('C', 'CmN', 4, { phase: true }), col('dC', 'ΔR vs XX (%)', 5, { calc: true }), col('dP', 'ΔR(A,B,C) (%)', 6, { calc: true })],
            }],
          },
          {
            id: 'lv', title: '7.3 Cuộn hạ áp — ab / bc / ca (mΩ)',
            fields: [{ k: 'dcr.lv.t', label: 'Nhiệt độ (°C)', num: true, doc: { before: 20, re: /t=(?<v>\s*)oC/ } }],
            grids: [{
              id: 'dcr.lv', title: '', tables: [20], rows: [{ k: 'r', label: 'Giá trị', doc: 1 }],
              cols: [col('A', 'ab', 0, { phase: true }), col('dA', 'ΔR vs XX (%)', 1, { calc: true }), col('B', 'bc', 2, { phase: true }), col('dB', 'ΔR vs XX (%)', 3, { calc: true }),
                col('C', 'ca', 4, { phase: true }), col('dC', 'ΔR vs XX (%)', 5, { calc: true }), col('dP', 'ΔR(ab,bc,ca) (%)', 6, { calc: true })],
            }],
          },
        ],
      },
      {
        id: 'ratio', no: 8, title: 'Tỷ số biến', en: 'Voltage ratio',
        groups: [
          {
            id: 'hm', title: '8.1 Cuộn HV : MV', grids: [{
              id: 'ratio.hm', title: 'Theo nấc', tables: [21, 22], rows: tapRows(taps), corner: 'Nấc', editHdr: true,
              cols: hdr('ratio.hm', [col('A', 'UAB/UAmBm', 1, { phase: true }), col('dA', 'ΔK_A (%)', 2, { auto: true }), col('B', 'UBC/UBmCm', 3, { phase: true }), col('dB', 'ΔK_B (%)', 4, { auto: true }),
                col('C', 'UCA/UCmAm', 5, { phase: true }), col('dC', 'ΔK_C (%)', 6, { auto: true }), col('dP', 'ΔK(A,B,C) (%)', 7, { calc: true })]),
            }],
          },
          {
            id: 'hl', title: '8.2 Cuộn HV : LV', grids: [{
              id: 'ratio.hl', title: 'Theo nấc', tables: [23], rows: tapRows(taps), corner: 'Nấc', editHdr: true,
              cols: hdr('ratio.hl', [col('A', 'UAB/Uab', 1, { phase: true }), col('dA', 'ΔK_A (%)', 2, { auto: true }), col('B', 'UBC/Ubc', 3, { phase: true }), col('dB', 'ΔK_B (%)', 4, { auto: true }),
                col('C', 'UCA/Uca', 5, { phase: true }), col('dC', 'ΔK_C (%)', 6, { auto: true }), col('dP', 'ΔK(A,B,C) (%)', 7, { calc: true })]),
            }],
          },
          {
            id: 'ml', title: '8.3 Cuộn MV : LV', grids: [{
              id: 'ratio.ml', title: '', tables: [24], rows: [{ k: 'r', label: 'Giá trị', doc: 1 }], editHdr: true,
              cols: hdr('ratio.ml', [col('A', 'UAmBm/Uab', 0, { phase: true }), col('dA', 'ΔK (%)', 1, { auto: true }), col('B', 'UBmCm/Ubc', 2, { phase: true }), col('dB', 'ΔK (%)', 3, { auto: true }),
                col('C', 'UCmAm/Uca', 4, { phase: true }), col('dC', 'ΔK (%)', 5, { auto: true }), col('dP', 'ΔK(A,B,C) (%)', 6, { calc: true })]),
            }],
          },
        ],
      },
      {
        id: 'oltc', no: 9, title: 'Kiểm tra bộ điều áp dưới tải', en: 'OLTC',
        fields: [
          { k: 'oltc.type', label: 'Kiểu (Type)', doc: { t: 25, r: 0, c: 0, re: /\(Type\):(?<v>.*)$/ } },
          { k: 'oltc.serial', label: 'Số chế tạo', doc: { t: 25, r: 0, c: 2, re: /\(Serial No\):(?<v>.*)$/ } },
          { k: 'oltc.manuf', label: 'Hãng sản xuất', doc: { t: 25, r: 1, c: 0, re: /\(Manufacturer\):(?<v>.*)$/ } },
          { k: 'oltc.year', label: 'Năm sản xuất', doc: { t: 25, r: 1, c: 2, re: /manufacture\):(?<v>.*)$/ } },
          { k: 'oltc.d1from', label: 'Chiều 1: từ nấc', doc: { t: 25, r: 3, c: 0, re: /Nấc(?<v>)\s*đến/ }, pad: true },
          { k: 'oltc.d1to', label: 'Chiều 1: đến nấc', doc: { t: 25, r: 3, c: 0, re: /đến(?<v>)\s*$/ }, pad: true },
          { k: 'oltc.d2from', label: 'Chiều 2: từ nấc', doc: { t: 25, r: 4, c: 0, re: /Nấc(?<v>)\s*đến/ }, pad: true },
          { k: 'oltc.d2to', label: 'Chiều 2: đến nấc', doc: { t: 25, r: 4, c: 0, re: /đến(?<v>)\s*$/ }, pad: true },
          { k: 'oltc.osc', label: 'Kết quả chụp công tắc K', type: 'textarea', doc: { before: 26, re: /\(Oscillograph\s*result\):(?<v>.*)$/ } },
          { k: 'oltc.eval', label: 'Đánh giá OLTC', type: 'select', options: ['', 'Đạt', 'Không đạt'] },
        ],
        grids: [{
          id: 'oltc.rounds', title: 'Số vòng quay', tables: [25],
          rows: [{ k: 'd1', label: 'Chiều 1', doc: 3 }, { k: 'd2', label: 'Chiều 2', doc: 4 }],
          cols: [col('k', 'Số vòng khi K tác động', 1, { text: true }), col('cyc', 'Số vòng kết thúc 1 chu trình', 3, { text: true })],
        }],
      },
      {
        id: 'moisture', no: 10, title: 'Hàm lượng ẩm trong cách điện cứng', en: 'Moisture in solid insulation',
        fields: [
          { k: 'moist.val', label: 'Độ ẩm cách điện cứng (%)', num: true, doc: { before: 26, re: /Độ ẩm:(?<v>\s*)%/ } },
          { k: 'moist.method', label: 'Phương pháp / thiết bị', placeholder: 'vd: FDS/PDC – Omicron Dirana' },
        ],
      },
      {
        id: 'bct', no: 11, title: 'Biến dòng chân sứ', en: 'Bushing CT',
        fields: [
          { k: 'bct.visual', label: 'Kiểm tra bên ngoài', doc: { before: 26, re: /\(General\s*inspection\)\s*:(?<v>.*)$/ } },
          { k: 'bct.t_ir', label: 'Nhiệt độ đo cách điện (°C)', num: true, doc: { before: 26, re: /t\s*=(?<v>\s*)oC/ } },
          { k: 'bct.polarity', label: 'Kết quả kiểm tra cực tính', placeholder: 'vd: Đúng cực tính (giảm)', doc: { before: 54, re: /S2,3,4,5\)\s*–(?<v>.*)$/ } },
          { k: 'bct.t_dcr', label: 'Nhiệt độ đo điện trở 1 chiều (°C)', num: true, doc: { before: 63, re: /t=(?<v>\s*)oC/ } },
        ],
        groups: ['hv', 'mv', 'lv'].map(side => ({ id: side, title: BCT_SIDES[side].label, bct: side, grids: bctGrids(side, +cfg.bctCores[side]) }))
          .concat([{ id: 'n', title: 'Phía trung tính — đặc tính từ hóa', grids: [exGrid('bct.n.ex.N', 'Đặc tính từ hóa — Trung tính', [50], 3, 4)] }]),
      },
      {
        // Thí nghiệm ngắn mạch: mục cuối biên bản (mẫu Word không có — app thêm chỉ mục và bảng khi xuất BBTN)
        id: 'shortCircuit', no: 12, title: 'Thí nghiệm ngắn mạch máy biến áp', en: 'Short-circuit impedance & load loss',
      },
    ];
    return { sections, taps, head: META, tail: CLOSING, layout: '1P', summary: SUMMARY['1P'], tables: 73 };
  }

  // Duyệt mọi grid/field của schema
  // Duyệt biểu mẫu: hàm chung ở js/domain/common.js (trường đầu/cuối biên bản lấy từ schema.head/tail)
  const { eachGrid, eachField } = Common;

  window.Schema = { dcrTemp, dcrRefOf, dcrMidMoves, HV_MEAS, OLTC_WINDINGS, BASELINE_RESETS, ATT_SECTIONS, REASONS, LAYOUT_3P, LAYOUT_110, MAP_110, TAPS_19, layoutOf, TAPS_17, build, eachGrid, eachField, META, CLOSING, SUMMARY_ROWS, DEFAULT_TAPS, BCT_SIDES, BCT_TABLES };
})();
