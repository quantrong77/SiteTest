// Dự báo xu hướng số liệu thí nghiệm (hàm thuần) — chuyển từ dga-webapp (src/domain/dga-logic-forecast.js, cùng tác giả),
// bỏ phần riêng của khí DGA (lọc dầu → thay bằng mốc giá trị khởi đầu; không cắt tại 0; ngưỡng hai chiều).
// Mô hình thống kê CHUẨN:
//   (1) Hồi quy tuyến tính OLS — sai số chuẩn, kiểm định t cho độ dốc, KHOẢNG DỰ BÁO 95% (Student t, n − 2 bậc tự do);
//   (2) Độ dốc Sen (Theil–Sen) + kiểm định Mann–Kendall (phi tham số, hiệu chỉnh giá trị trùng) — chuỗi lấy mẫu không đều,
//       ít điểm, có điểm bất thường (Sen 1968; Mann 1945; Kendall 1975; Gilbert 1987);
//   (3) Sen + Mann–Kendall trên GIAI ĐOẠN GẦN ĐÂY (3 năm gần nhất, tối thiểu 5 lần đo).
// QUAN TRỌNG: CHỈ là công cụ THAM KHẢO hỗ trợ ra quyết định — KHÔNG PHẢI kết luận theo QĐ 1901 (Điều 3 yêu cầu đánh giá tổng hợp).
// Giả định tuyến tính: tốc độ thay đổi giữ nguyên — sai khi có sự cố, sửa chữa, lọc sấy dầu. Vì vậy dự báo lấy từ ĐƯỜNG ĐÃ KHỚP,
// kèm khoảng dự báo / khoảng tin cậy 95%, chỉ coi là "có xu hướng" khi kiểm định có ý nghĩa (p < 0,05).
(function () {
  'use strict';
  const MS_PER_DAY = 86400000;
  const DAYS_PER_YEAR = 365.25;
  const ALPHA = 0.05;
  const MK_MIN_N = 4;
  // Cửa sổ "giai đoạn gần đây": các lần đo trong 3 năm gần nhất (≈ chu kỳ 3 năm, Điều 3 QĐ 1901), không ít hơn 5 lần đo —
  // n = 5 là cỡ mẫu nhỏ nhất để Mann–Kendall hai phía có thể đạt p < 0,05.
  const RECENT_YEARS = 3;
  const RECENT_MIN_N = 5;

  // ---------------------------- Hàm phân phối -----------------------------------
  /** Hàm phân phối chuẩn tắc Φ(z) — xấp xỉ erf của Abramowitz & Stegun 7.1.26 (sai số < 1,5e-7). */
  function normalCdf(z) {
    const sign = z < 0 ? -1 : 1;
    const x = Math.abs(z) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
  }

  /** Nghịch đảo Φ — thuật toán Acklam (sai số tương đối < 1,2e-9). */
  function normalQuantile(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    let q;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - pl) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    q = p - 0.5;
    const r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  /** ln Γ(x) — xấp xỉ Lanczos (g = 7, 9 hệ số). */
  function logGamma(x) {
    const g = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
      12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
    x -= 1;
    let s = g[0];
    for (let i = 1; i < 9; i++) s += g[i] / (x + i);
    const t = x + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(s);
  }

  /** Hàm beta không đầy đủ chuẩn hóa I_x(a, b) — phân số liên tục (Lentz), như Numerical Recipes betacf. */
  function regularizedIncompleteBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    const cf = (xx, aa, bb) => {
      const TINY = 1e-300;
      let c = 1;
      let d = 1 - ((aa + bb) * xx) / (aa + 1);
      if (Math.abs(d) < TINY) d = TINY;
      d = 1 / d;
      let h = d;
      for (let m = 1; m <= 300; m++) {
        const m2 = 2 * m;
        let num = (m * (bb - m) * xx) / ((aa + m2 - 1) * (aa + m2));
        d = 1 + num * d; if (Math.abs(d) < TINY) d = TINY;
        c = 1 + num / c; if (Math.abs(c) < TINY) c = TINY;
        d = 1 / d; h *= d * c;
        num = (-(aa + m) * (aa + bb + m) * xx) / ((aa + m2) * (aa + m2 + 1));
        d = 1 + num * d; if (Math.abs(d) < TINY) d = TINY;
        c = 1 + num / c; if (Math.abs(c) < TINY) c = TINY;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < 1e-14) break;
      }
      return h;
    };
    return x < (a + 1) / (a + b + 2) ? (front * cf(x, a, b)) / a : 1 - (front * cf(1 - x, b, a)) / b;
  }

  /** Hàm phân phối Student t với df bậc tự do: P(T ≤ t). */
  function studentTCdf(t, df) {
    const x = df / (df + t * t);
    const tail = 0.5 * regularizedIncompleteBeta(x, df / 2, 0.5);
    return t >= 0 ? 1 - tail : tail;
  }

  /** Phân vị Student t: t sao cho P(T ≤ t) = p (chia đôi — studentTCdf đơn điệu). */
  function studentTQuantile(p, df) {
    if (p === 0.5) return 0;
    let lo = -1e3;
    let hi = 1e3;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (studentTCdf(mid, df) < p) lo = mid; else hi = mid;
      if (hi - lo < 1e-10) break;
    }
    return (lo + hi) / 2;
  }

  function median(arr) {
    const s = arr.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // ---------------------------- (1) OLS -----------------------------------------
  /**
   * Hồi quy tuyến tính bình phương tối thiểu y = intercept + slope·x. Ngoài slope/intercept/r2/n
   * trả thêm (khi n ≥ 3): s (sai số chuẩn của phần dư, n − 2 bậc tự do), seSlope, tSlope,
   * pSlope (kiểm định t hai phía H0: slope = 0), meanX, sxx — dùng cho khoảng dự báo
   * (olsPredictionInterval). Trả về null nếu < 2 điểm hoặc mọi x giống nhau.
   * @param {Array<{x:number, y:number}>} points
   */
  function linearRegression(points) {
    const n = points.length;
    if (n < 2) return null;
    const meanX = points.reduce((s, p) => s + p.x, 0) / n;
    const meanY = points.reduce((s, p) => s + p.y, 0) / n;
    let sxy = 0;
    let sxx = 0;
    points.forEach((p) => {
      sxy += (p.x - meanX) * (p.y - meanY);
      sxx += (p.x - meanX) * (p.x - meanX);
    });
    if (sxx === 0) return null;
    const slope = sxy / sxx;
    const intercept = meanY - slope * meanX;
    const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
    const ssRes = points.reduce((s, p) => s + (p.y - (intercept + slope * p.x)) ** 2, 0);
    const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
    const out = { slope, intercept, r2, n, meanX, sxx, df: n - 2, s: null, seSlope: null, tSlope: null, pSlope: null };
    if (n >= 3) {
      const s = Math.sqrt(ssRes / (n - 2));
      const seSlope = s / Math.sqrt(sxx);
      out.s = s;
      out.seSlope = seSlope;
      if (seSlope > 0) {
        out.tSlope = slope / seSlope;
        out.pSlope = 2 * (1 - studentTCdf(Math.abs(out.tSlope), n - 2));
      } else {
        out.tSlope = slope === 0 ? 0 : Infinity;
        out.pSlope = slope === 0 ? 1 : 0; // khớp hoàn hảo
      }
    }
    return out;
  }

  /** Khoảng dự báo (prediction interval) 1 − α cho 1 lần đo MỚI tại x0:
   *  ŷ ± t(1−α/2, n−2) · s · √(1 + 1/n + (x0 − x̄)² / Sxx). Null nếu n < 3. */
  function olsPredictionInterval(reg, x0, alpha = ALPHA) {
    if (!reg || reg.s === null || reg.df < 1) return null;
    const yhat = reg.intercept + reg.slope * x0;
    const tq = studentTQuantile(1 - alpha / 2, reg.df);
    const half = tq * reg.s * Math.sqrt(1 + 1 / reg.n + (x0 - reg.meanX) ** 2 / reg.sxx);
    return { lower: yhat - half, upper: yhat + half };
  }

  // ---------------------------- (2) Sen + Mann–Kendall -------------------------
  /** Độ dốc Theil–Sen = trung vị độ dốc mọi cặp điểm (i < j, x_i ≠ x_j). Null nếu không có cặp nào. */
  function theilSenSlope(points) {
    const slopes = pairwiseSlopes(points);
    return slopes.length === 0 ? null : median(slopes);
  }

  function pairwiseSlopes(points) {
    const slopes = [];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[j].x - points[i].x;
        if (dx !== 0) slopes.push((points[j].y - points[i].y) / dx);
      }
    }
    return slopes;
  }

  /**
   * Kiểm định xu hướng Mann–Kendall (hai phía) trên chuỗi đã sắp theo thời gian.
   * S = Σ sign(y_j − y_i) (i < j, bỏ cặp cùng thời điểm); Var(S) hiệu chỉnh nhóm giá trị trùng:
   * [n(n−1)(2n+5) − Σ t(t−1)(2t+5)] / 18; Z có hiệu chỉnh liên tục (S ∓ 1)/√Var; p = 2(1 − Φ(|Z|));
   * tau = S / (n(n−1)/2). direction: 'increasing' | 'decreasing' | 'none' (p ≥ α) | 'insufficient' (n < 4).
   * @param {Array<{x:number, y:number}>} points ĐÃ sắp tăng dần theo x
   */
  function mannKendallTest(points, alpha = ALPHA) {
    const n = points.length;
    let S = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (points[j].x === points[i].x) continue;
        const d = points[j].y - points[i].y;
        S += d > 0 ? 1 : d < 0 ? -1 : 0;
      }
    }
    const groups = {};
    points.forEach((p) => { groups[p.y] = (groups[p.y] || 0) + 1; });
    const tieTerm = Object.values(groups).reduce((s, t) => s + (t > 1 ? t * (t - 1) * (2 * t + 5) : 0), 0);
    const varS = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;
    let z = 0;
    if (varS > 0) z = S > 0 ? (S - 1) / Math.sqrt(varS) : S < 0 ? (S + 1) / Math.sqrt(varS) : 0;
    const p = varS > 0 ? 2 * (1 - normalCdf(Math.abs(z))) : 1;
    const tau = n > 1 ? S / ((n * (n - 1)) / 2) : 0;
    let direction = 'none';
    if (n < MK_MIN_N) direction = 'insufficient';
    else if (p < alpha) direction = S > 0 ? 'increasing' : 'decreasing';
    return { n, S, varS, z, p, tau, direction, alpha };
  }

  /** Sen's slope + intercept (median(y) − slope·median(x), như scipy.stats.theilslopes) + khoảng tin
   *  cậy 1 − α của độ dốc theo Gilbert (1987): C = z(1−α/2)·√Var(S), M1 = (N′ − C)/2, M2 = (N′ + C)/2. */
  function senSlopeEstimate(points, varS, alpha = ALPHA) {
    const slopes = pairwiseSlopes(points).sort((a, b) => a - b);
    if (slopes.length === 0) return null;
    const slope = median(slopes);
    const intercept = median(points.map((p) => p.y)) - slope * median(points.map((p) => p.x));
    let lower = null;
    let upper = null;
    if (varS > 0) {
      const C = normalQuantile(1 - alpha / 2) * Math.sqrt(varS);
      const N = slopes.length;
      const m1 = Math.round((N - C) / 2);
      const m2 = Math.round((N + C) / 2) + 1;
      if (m1 >= 1 && m2 <= N) {
        lower = slopes[m1 - 1];
        upper = slopes[m2 - 1];
      }
    }
    return { slope, intercept, lower, upper };
  }

  // ---------------------------- (3) Cửa sổ giai đoạn gần đây -------------------
  /** Chỉ số đầu của cửa sổ 'giai đoạn gần đây' trên chuỗi ĐÃ sắp theo x (đơn vị ngày): lần đo đầu tiên
   *  trong RECENT_YEARS năm tính tới lần đo cuối, lùi thêm nếu cần để có ≥ RECENT_MIN_N
   *  lần đo. Trả về 0 khi cửa sổ trùm cả chuỗi (khi đó không tách được giai đoạn gần). */
  function recentWindowStart(points, years = RECENT_YEARS, minN = RECENT_MIN_N) {
    const n = points.length;
    if (n === 0) return 0;
    const fromX = points[n - 1].x - years * DAYS_PER_YEAR;
    let start = points.findIndex((p) => p.x >= fromX);
    if (start < 0) start = n - 1;
    return Math.max(0, Math.min(start, n - minN));
  }

  // ---------------------------- (4) Tốc độ 2 lần đo gần nhất --------------------
  /** Tốc độ (đơn vị y / đơn vị x) giữa 2 lần đo gần nhất có thời điểm khác nhau — cách tính tốc độ tăng
   *  của Bảng 65 QĐ1901. Null nếu không có 2 thời điểm khác nhau. points ĐÃ sắp tăng dần theo x. */
  function latestPairSlope(points) {
    const last = points[points.length - 1];
    for (let i = points.length - 2; i >= 0; i--) {
      const dx = last.x - points[i].x;
      if (dx !== 0) return (last.y - points[i].y) / dx;
    }
    return null;
  }

  // ---------------------------- Dự báo một chuỗi số liệu -------------------------
  const METHOD_LABELS = {
    ols: 'Hồi quy tuyến tính (khoảng dự báo 95%)',
    sen: 'Độ dốc Sen + kiểm định Mann–Kendall',
    recent: 'Độ dốc Sen + Mann–Kendall — giai đoạn gần đây',
  };

  // Ngưỡng dự báo theo QĐ 1901, tính từ giá trị khởi đầu (cùng tiêu chí xu hướng của mục đánh giá):
  //  drop — giảm tối đa (R60@20 cách điện cuộn dây, Điều 9 mục 4); rise — tăng tối đa (tgδ cuộn dây Điều 30, tgδ sứ Điều 38 mục 3a);
  //  abs — lệch hai chiều (điện dung cuộn dây Điều 9 mục 5, C1 sứ Điều 38 mục 3c, R một chiều Điều 9 mục 7, P0 trong vận hành Điều 34).
  // Đại lượng không có ngưỡng → chỉ vẽ đường xu hướng, không dự báo thời điểm chạm ngưỡng.
  const LIMIT_RULES = {
    'IR:R60': [['IR_DROP', 'drop']],
    'WTGD:TGD': [['WINDING_TGD_RISE', 'rise']],
    'WTGD:C': [['WINDING_C_DEV', 'abs']],
    'BUSHING:C1': [['BUSHING_C1_DEV', 'abs']],
    'BUSHING:TGD1': [['BUSHING_TGD_RISE_FAIL', 'rise']],
    'DCR:R': [['DCR_DEV', 'abs']],
    'NOLOAD:P0': [['NOLOAD_OPER', 'abs']],
  };
  // → [{ value, dir: 'up' | 'down', pct, key }] (ngưỡng tuyệt đối theo giá trị khởi đầu base)
  function limitsFor(item, param, base, L) {
    const rules = LIMIT_RULES[`${item}:${param}`];
    const b = Number(base);
    if (!rules || !Number.isFinite(b) || b === 0 || !L) return [];
    const out = [];
    rules.forEach(([key, kind]) => {
      const pct = Number(L[key]);
      if (!Number.isFinite(pct)) return;
      if (kind === 'drop' || kind === 'abs') out.push({ value: b * (1 - pct / 100), dir: 'down', pct: -pct, key });
      if (kind === 'rise' || kind === 'abs') out.push({ value: b * (1 + pct / 100), dir: 'up', pct, key });
    });
    return out;
  }

  /**
   * history: [{ date: 'yyyy-mm-dd', value }] (không cần sắp); years: số năm dự báo; limits: limitsFor(...);
   * options.sinceDate: chỉ dùng các lần đo từ mốc này (giá trị khởi đầu sau sửa chữa — số liệu cũ không cùng "chuỗi").
   * → { ok, n, lastValue, lastDate, trend (Mann–Kendall), methods: { ols, sen, recent }, recentWindow, rateChange, sinceDate, nBefore }
   *   method: { label, ratePerYear, fittedAtLast, forecastValue, forecastDate, interval, r2, pValue, significant, crossing }
   *   crossing: null (không ngưỡng) | { status: 'already_exceeded', limit } | { status: 'not_toward' }
   *             | { status: 'predicted', limit, date, withinHorizon, yearsFromLast, significant }
   */
  function forecast(history, years, limits, options = {}) {
    const all = (history || [])
      .filter(h => h && h.value !== null && h.value !== undefined && h.value !== '' && h.date)
      .map(h => ({ date: new Date(String(h.date).slice(0, 10) + 'T00:00:00Z'), value: Number(h.value) }))
      .filter(h => Number.isFinite(h.value) && !Number.isNaN(h.date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const sinceT = options.sinceDate ? new Date(String(options.sinceDate).slice(0, 10) + 'T00:00:00Z').getTime() : NaN;
    const since = Number.isFinite(sinceT) ? new Date(sinceT).toISOString().slice(0, 10) : null;
    const pts = since ? all.filter(p => p.date.getTime() >= sinceT) : all;
    const nBefore = all.length - pts.length;
    if (pts.length < 2) return { ok: false, reason: 'not_enough_data', n: pts.length, sinceDate: since, nBefore };

    const t0 = pts[0].date.getTime();
    const xy = pts.map(p => ({ x: (p.date.getTime() - t0) / MS_PER_DAY, y: p.value }));
    const lastPoint = pts[pts.length - 1];
    const lastX = xy[xy.length - 1].x;
    const horizonDays = years * DAYS_PER_YEAR;
    const horizonX = lastX + horizonDays;
    const iso = ms => new Date(ms).toISOString().slice(0, 10);
    const forecastDate = iso(lastPoint.date.getTime() + horizonDays * MS_PER_DAY);

    const ols = linearRegression(xy);
    const mk = mannKendallTest(xy);
    const sen = senSlopeEstimate(xy, mk.varS);
    if (!ols && !sen) return { ok: false, reason: 'same_date', n: pts.length, sinceDate: since, nBefore };
    const lims = (limits || []).filter(l => l && Number.isFinite(Number(l.value)));

    // Thời điểm chạm ngưỡng theo ĐƯỜNG ĐÃ KHỚP y = a + b·x; "đã vượt" xét theo giá trị đo thực tế gần nhất.
    // Nhiều ngưỡng (lệch hai chiều): lấy ngưỡng đường khớp đi tới.
    function crossingFor(a, b, significant) {
      if (!lims.length) return null;
      const over = lims.find(l => (l.dir === 'up' ? lastPoint.value >= l.value : lastPoint.value <= l.value));
      if (over) return { status: 'already_exceeded', limit: over };
      const toward = lims.filter(l => (l.dir === 'up' ? b > 0 : b < 0));
      if (!toward.length) return { status: 'not_toward' };
      const hits = toward.map(l => ({ l, days: Math.max(0, (Number(l.value) - a) / b - lastX) })).sort((p, q) => p.days - q.days);
      const h = hits[0];
      return { status: 'predicted', limit: h.l, date: iso(lastPoint.date.getTime() + h.days * MS_PER_DAY),
        withinHorizon: h.days <= horizonDays, yearsFromLast: h.days / DAYS_PER_YEAR, significant };
    }

    const methods = { ols: null, sen: null, recent: null };
    if (ols) {
      const pi = olsPredictionInterval(ols, horizonX);
      const significant = ols.pSlope === null ? null : ols.pSlope < ALPHA;
      methods.ols = {
        label: METHOD_LABELS.ols, ratePerYear: ols.slope * DAYS_PER_YEAR, intercept: ols.intercept, slopePerDay: ols.slope,
        fittedAtLast: ols.intercept + ols.slope * lastX, forecastValue: ols.intercept + ols.slope * horizonX, forecastDate,
        interval: pi, r2: ols.r2, pValue: ols.pSlope, significant, crossing: crossingFor(ols.intercept, ols.slope, significant),
        reg: ols, // để vẽ dải khoảng dự báo (olsPredictionInterval theo x = số ngày kể từ firstDate)
      };
    }
    function senMethod(label, est, test) {
      const significant = test.direction === 'insufficient' ? null : test.p < ALPHA;
      return {
        label, ratePerYear: est.slope * DAYS_PER_YEAR, intercept: est.intercept, slopePerDay: est.slope,
        fittedAtLast: est.intercept + est.slope * lastX, forecastValue: est.intercept + est.slope * horizonX, forecastDate,
        interval: est.lower === null ? null : { lower: est.lower * DAYS_PER_YEAR, upper: est.upper * DAYS_PER_YEAR },
        r2: null, pValue: test.direction === 'insufficient' ? null : test.p, significant,
        crossing: crossingFor(est.intercept, est.slope, significant),
      };
    }
    if (sen) methods.sen = senMethod(METHOD_LABELS.sen, sen, mk);

    let recentWindow = null, rateChange = null;
    const start = recentWindowStart(xy);
    if (start > 0) {
      const win = xy.slice(start);
      const mkR = mannKendallTest(win);
      const senR = senSlopeEstimate(win, mkR.varS);
      if (senR) {
        methods.recent = senMethod(METHOD_LABELS.recent, senR, mkR);
        recentWindow = { n: win.length, fromDate: iso(pts[start].date.getTime()) };
        const ci = methods.sen && methods.sen.interval;
        if (ci) {
          const r = methods.recent.ratePerYear;
          rateChange = r > ci.upper ? 'faster' : r < ci.lower ? 'slower' : 'consistent';
        }
      }
    }
    return { ok: true, n: pts.length, firstDate: iso(t0), lastValue: lastPoint.value, lastDate: iso(lastPoint.date.getTime()),
      limits: lims, trend: mk, methods, recentWindow, rateChange, sinceDate: since, nBefore, years };
  }

  /**
   * Cảnh báo dự báo (tham khảo): { status: 'exceeded' } khi lần đo gần nhất đã vượt ngưỡng;
   * { status: 'predicted', method, date, yearsFromLast, pValue, limit } khi xu hướng CÓ Ý NGHĨA thống kê (Sen + Mann–Kendall,
   * thiếu thì OLS) đi về phía ngưỡng và mốc chạm ngưỡng trong số năm dự báo. Còn lại null.
   */
  function warning(fc) {
    if (!fc || !fc.ok || !fc.limits.length) return null;
    const m = fc.methods || {};
    for (const k of ['sen', 'ols']) { const c = m[k] && m[k].crossing; if (c && c.status === 'already_exceeded') return { status: 'exceeded', limit: c.limit }; }
    for (const k of ['sen', 'ols']) {
      const c = m[k] && m[k].crossing;
      if (c && c.status === 'predicted' && c.significant === true && c.withinHorizon) {
        return { status: 'predicted', method: k, date: c.date, yearsFromLast: c.yearsFromLast, pValue: m[k].pValue, limit: c.limit };
      }
    }
    return null;
  }

  window.TrendForecast = {
    forecast, warning, limitsFor, LIMIT_RULES, METHOD_LABELS, ALPHA, RECENT_YEARS, RECENT_MIN_N, DAYS_PER_YEAR,
    linearRegression, olsPredictionInterval, mannKendallTest, senSlopeEstimate, theilSenSlope, recentWindowStart,
    normalCdf, normalQuantile, studentTCdf, studentTQuantile,
  };
})();
