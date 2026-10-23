// Tiêu chí & phép quy đổi theo QĐ 1901/QĐ-EVNNPT (29/09/2025).
// Mọi ngưỡng ở đây đều trích từ văn bản gốc; chỗ nào QĐ dẫn về nhà sản xuất thì
// ngưỡng NSX được đọc từ file xuất xưởng / cấu hình, không tự tạo.
(function () {
  'use strict';

  // Bảng 45 — Hệ số quy đổi điện trở cách điện K1 theo hiệu nhiệt độ (Điều 29)
  const K1 = [[1, 1.04], [2, 1.08], [3, 1.13], [4, 1.17], [5, 1.22], [10, 1.5], [15, 1.84], [20, 2.25], [25, 2.75], [30, 3.4]];
  // Bảng 47 (≡ Bảng 7) — Hệ số quy đổi tgδ K2 theo hiệu nhiệt độ (Điều 30)
  const K2 = [[1, 1.05], [2, 1.10], [3, 1.15], [4, 1.20], [5, 1.25], [10, 1.55], [15, 1.95], [16, 2.4]];

  // Hiệu nhiệt độ không có trong bảng: nhân các hệ số tương ứng (vd ∆t=9 → K(5)×K(4)).
  // ∆t lẻ được làm tròn về số nguyên gần nhất; cách phân tích được trả về để hiển thị.
  function tableFactor(table, dt) {
    let rest = Math.round(Math.abs(dt));
    const parts = [];
    let k = 1;
    while (rest > 0) {
      let pick = table[0];
      for (const row of table) if (row[0] <= rest) pick = row;
      k *= pick[1];
      parts.push(pick[0]);
      rest -= pick[0];
    }
    return { k, dt: Math.round(Math.abs(dt)), expr: parts.length ? parts.map(p => `K(${p})`).join('×') : '1' };
  }

  // Điện trở cách điện: giảm khi nhiệt độ tăng. Quy về nhiệt độ thấp hơn → nhân K1.
  // (Ghi chú cuối Bảng 45 viết R(t2)=R(t1)/K1 khi t2<t1 — ngược chiều vật lý của điện trở
  //  cách điện; app áp dụng chiều vật lý và hiển thị rõ K1 để người đánh giá kiểm tra.)
  function convIR(r, tFrom, tTo) {
    const f = tableFactor(K1, tTo - tFrom);
    const val = tTo < tFrom ? r * f.k : r / f.k;
    return { val, k: f.k, expr: f.expr, dt: f.dt };
  }

  // tgδ: tgδ(t2) = K2 × tgδ(t1) khi t2>t1; tgδ(t2) = tgδ(t1)/K2 khi t2<t1 (Điều 30).
  function convTgd(v, tFrom, tTo) {
    const f = tableFactor(K2, tTo - tFrom);
    const val = tTo > tFrom ? v * f.k : v / f.k;
    return { val, k: f.k, expr: f.expr, dt: f.dt };
  }

  // Điện trở một chiều: R2 = R1 (235 + t2)/(235 + t1) (Điều 9 mục 7, Điều 31)
  function convDCR(r, t1, t2) { return r * (235 + t2) / (235 + t1); }

  function interp(xs, ys, x) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
    for (let i = 1; i < xs.length; i++) {
      if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
    }
    return ys[ys.length - 1];
  }
  const T10_70 = [10, 20, 30, 40, 50, 60, 70];

  // Bảng 5 — R cách điện tối thiểu (MΩ), MBA 110 kV trở lên mọi công suất.
  const IR_MIN_110 = [900, 600, 400, 260, 180, 120, 80];
  const irMin = t => interp(T10_70, IR_MIN_110, t);

  // Bảng 46 — tgδ lớn nhất cho phép cuộn dây MBA ngâm dầu (dùng khi không có giá trị khởi đầu)
  const TGD_MAX = { '110-220': [0.8, 1, 1.3, 1.7, 2.3, 3, 4], '330-500': [0.8, 1.0, 1.3, 1.7, 2.2, 2.9, 3.8] };
  const tgdMax = (t, cls) => interp(T10_70, TGD_MAX[cls || '330-500'], t);

  // Bảng 52 — tgδ cho phép sứ mới ở 10–40 °C (Điều 38)
  const BUSHING_TGD_NEW = { OIP: 0.7, RIP: 0.7, RIS: 0.7, RBP: 1.5, GIF: 0.5 };

  // Hệ số hiệu chỉnh fc cho sứ RIP (HD vận hành sứ Hitachi Energy, Bảng 13) — tanδ20 = tanδ/fc
  const RIP_FC = { t: [0, 10, 20, 30, 40, 50, 60, 70, 80], fc: [1.45, 1.20, 1.00, 0.85, 0.77, 0.75, 0.77, 0.82, 0.90] };
  const ripFc = t => interp(RIP_FC.t, RIP_FC.fc, t);

  // Điều 29 — Hệ số phân cực PI
  function classifyPI(pi) {
    if (pi < 1) return { status: 'fail', text: 'PI<1: Nguy hiểm' };
    if (pi < 1.1) return { status: 'fail', text: '1≤PI<1,1: Kém' };
    if (pi < 1.25) return { status: 'warn', text: '1,1≤PI<1,25: Có vấn đề' };
    if (pi <= 2) return { status: 'pass', text: '1,25≤PI≤2: Tương đối tốt' };
    return { status: 'pass', text: 'PI>2: Tốt' };
  }

  // Điều 28 — Độ ẩm cách điện cứng
  function classifyMoisture(m) {
    if (m < 2.2) return { status: 'pass', text: '<2,2%: cách điện khô' };
    if (m <= 3.7) return { status: 'warn', text: '2,2–3,7%: độ ẩm trung bình (có dấu hiệu nhiễm ẩm)' };
    if (m <= 4.8) return { status: 'fail', text: '3,7–4,8%: cách điện bị ẩm' };
    return { status: 'fail', text: '>4,8%: cách điện bị nhiễm ẩm cao' };
  }

  // Độ lệch pha ∆R(%) = (Rmax − Rmin)/RTB × 100 (Điều 9 mục 7) — dùng chung cho tỷ số biến
  function phaseSpread(vals) {
    const v = vals.filter(x => Number.isFinite(x));
    if (v.length < 2) return null;
    const max = Math.max(...v), min = Math.min(...v), avg = v.reduce((a, b) => a + b, 0) / v.length;
    return (max - min) / avg * 100;
  }

  window.QD = {
    K1, K2, tableFactor, convIR, convTgd, convDCR, irMin, tgdMax, BUSHING_TGD_NEW, ripFc, classifyPI,
    classifyMoisture, phaseSpread,
    LIMITS: {
      DCR_DEV: 2,          // Điều 9 mục 7 — ±2% so với pha khác & số liệu NSX cùng nhiệt độ
      RATIO_DEV: 0.5,      // Điều 9 mục 6, Điều 33 — 0,5%
      WINDING_C_DEV: 5,    // Điều 9 mục 5 — điện dung cuộn dây ±5% so với khởi đầu
      WINDING_TGD_OK: 1,   // tgδ hiện trường ≤1% (quy về 20 °C) coi là đạt
      WINDING_TGD_RISE: 30,// Điều 30 — tgδ quy đổi cùng nhiệt độ không tăng quá 30%
      IR_DROP: 30,         // Điều 9 mục 4 — R60@20°C không giảm quá 30%
      BUSHING_C1_DEV: 5,   // Điều 38.3.c — C1 không thay đổi quá 5% (khi NSX không quy định)
      BUSHING_TGD_RISE_FAIL: 100, BUSHING_TGD_RISE_WARN: 70, // Điều 38.3.a — trong vận hành
      CORE_NEW: 500, CORE_OLD: 100, // Điều 9 Bảng 1 ghi chú a
      NOLOAD_1PH_NEW: 10,  // Điều 34 — MBA 1 pha ≥110 kV sau lắp đặt/sửa chữa: ±10% giá trị khởi đầu
      NOLOAD_OPER: 15,     // Điều 34 — trong vận hành: ±15%
      BCT_IR_MIN: 200,     // Điều 39 — TI chân sứ ≥200 MΩ (khi NSX không quy định)
      BUSHING_AC_PCT: 85,  // Điều 38 — thử AC 1 phút = 85% giá trị xuất xưởng
      KHT_HEALTHY: 1.3,    // Điều 29 — MBA không ẩm: R60/R15 từ 1,3–2 (10–30 °C)
    },
    REF: {
      visual: 'Điều 9 Bảng 1',
      noload: 'Điều 34 mục 3',
      ir: 'Điều 9 mục 4, Bảng 5; Điều 29',
      core: 'Điều 9 Bảng 1 ghi chú a',
      pi: 'Điều 29 (PI); Điều 9 ghi chú d',
      vector: 'Điều 32 mục 3',
      bushing: 'Điều 38 mục 3, Bảng 52',
      bushingAC: 'Điều 38 mục 2, Bảng 50',
      wtgd: 'Điều 9 mục 5; Điều 30 mục 3, Bảng 46–47',
      dcr: 'Điều 9 mục 7; Điều 31',
      ratio: 'Điều 9 mục 6; Điều 33 mục 3',
      oltc: 'Điều 37 mục 3',
      moisture: 'Điều 28 mục 3',
      bct: 'Điều 39',
    },
  };
})();
