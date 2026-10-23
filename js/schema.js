// Ánh xạ biểu mẫu nhập liệu ↔ template BBTN_MBA_500_x.docx.
// Chỉ số bảng (t) là thứ tự bảng cấp thân văn bản trong template; hàng (doc) là chỉ số hàng sau khi
// ghép các bảng bị ngắt trang liền nhau; cột (doc) là chỉ số cột lưới (đã tính gridSpan).
(function () {
  'use strict';

  const DEFAULT_TAPS = ['1', '2', '3', '4', '5', '6', '7', '8', '9a', '9b', '9c', '10', '11', '12', '13', '14', '15', '16', '17'];

  const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  const col = (k, label, doc, o = {}) => Object.assign({ k, label, doc }, o);

  // ---------------- Thông tin chung (bảng 0) ----------------
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
    { k: 'meta.reason', label: 'Lý do thí nghiệm', type: 'select', options: ['Sau lắp đặt', 'Sau sửa chữa', 'Định kỳ', 'Bất thường', 'Dự phòng'], doc: { t: 0, r: 8, c: 0, re: /nghiệm:(?<v>.*)$/ } },
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

  function build(cfg) {
    const taps = (cfg.taps && cfg.taps.length === 19) ? cfg.taps : DEFAULT_TAPS;
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
              { k: 'b.hv.kmode', label: 'Cách quy đổi về 20 °C', type: 'select', options: ['Hitachi Energy (RIP) – theo HD hãng', 'Nhập hệ số K'] },
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
              { k: 'b.mv.kmode', label: 'Cách quy đổi về 20 °C', type: 'select', options: ['Hitachi Energy (RIP) – theo HD hãng', 'Nhập hệ số K'] },
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
              { k: 'b.lv.kmode', label: 'Cách quy đổi về 20 °C', type: 'select', options: ['Hitachi Energy (RIP) – theo HD hãng', 'Nhập hệ số K'] },
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
            id: 'wtgd.meas', title: 'Số liệu đo', tables: [15], rows: wtgdRows, corner: 'Đối tượng đo', editLabels: true,
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
            id: 'hv', title: '7.1 Cuộn cao áp — đo A-N / B-N / C-N (mΩ)',
            fields: [{ k: 'dcr.hv.t', label: 'Nhiệt độ (°C)', num: true, doc: { before: 17, re: /t\s*=(?<v>\s*)oC/ } }],
            grids: [{
              id: 'dcr.hv', title: 'Theo nấc', tables: [17, 18], rows: tapRows(taps),
              cols: [col('A', 'AN', 1, { phase: true }), col('dA', 'ΔR_A vs XX (%)', 2, { calc: true }), col('B', 'BN', 3, { phase: true }), col('dB', 'ΔR_B vs XX (%)', 4, { calc: true }),
                col('C', 'CN', 5, { phase: true }), col('dC', 'ΔR_C vs XX (%)', 6, { calc: true }), col('dP', 'ΔR(A,B,C) (%)', 7, { calc: true })],
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
    ];
    return { sections, taps };
  }

  // Duyệt mọi grid/field của schema
  function eachGrid(schema, fn) {
    schema.sections.forEach(s => {
      (s.grids || []).forEach(g => fn(g, s, null));
      (s.groups || []).forEach(gr => (gr.grids || []).forEach(g => fn(g, s, gr)));
    });
  }
  function eachField(schema, fn) {
    META.concat(CLOSING).forEach(f => fn(f, null));
    schema.sections.forEach(s => {
      (s.fields || []).forEach(f => fn(f, s));
      (s.groups || []).forEach(gr => (gr.fields || []).forEach(f => fn(f, s)));
    });
  }

  window.Schema = { build, eachGrid, eachField, META, CLOSING, SUMMARY_ROWS, DEFAULT_TAPS, BCT_SIDES, BCT_TABLES };
})();
