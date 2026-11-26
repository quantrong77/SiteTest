// MBA: vẽ đặc tuyến tgδ theo tần số (DFR sứ đầu vào, DIRANA) trên trục tần số logarit — xem trước ở trang Phụ lục
// và ảnh PNG cho phụ lục BBTN. Đồ thị in trên giấy trắng nên dùng màu cố định (không theo giao diện sáng/tối).
(function () {
  'use strict';
  const W = 720, H = 440; // in 8 cm (2 đồ thị/hàng): chữ 26 px ≈ 8 pt
  const COLORS = { A: '#c99700', B: '#2e7d32', C: '#c62828' };
  const INK = '#1b1f24', GRID = '#d5d9de', MINOR = '#eef0f2', LINE = '#1f5fa8'; // LINE: phép đo 3 pha chung (không ghi pha)
  const FONT = '"Be Vietnam Pro", Arial, sans-serif';
  const F0 = 0.01, DECADES = 6; // 10 mHz – 10 kHz
  const LABELS = [[0.01, '10m'], [0.1, '100m'], [1, '1'], [10, '10'], [100, '100'], [1000, '1k'], [10000, '10k']];
  const PH = ['A', 'B', 'C'];
  const fmt = (x, d) => x.toFixed(d).replace('.', ',');
  // 10^n chính xác (Math.pow(10, -5) ra 0,000009999… trên một số bản V8, vd Node 22 Linux)
  const p10 = n => Number(`1e${n}`);

  // Bước chia trục "đẹp" (1, 2, 5 × 10^n)
  function niceStep(span, n) {
    const raw = span / n, p = p10(Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }

  // Điểm đo trong dải trục (tần số đầu của DIRANA ghi 0,0099999998 Hz nên có dung sai)
  const series = (m, f0 = F0, f1 = 1e4) => m.f.map((f, i) => [Number(f), Number(m.tan[i])])
    .filter(([f, y]) => f >= f0 * 0.999 && f <= f1 * 1.001 && Number.isFinite(y) && y >= 0);
  // Nhãn tần số: 10µ, 1m, 100m, 1, 10, 1k, 10k
  const fLabel = f => {
    const r = x => String(Math.round(x * 1000) / 1000);
    return f >= 1000 ? `${r(f / 1000)}k` : f >= 1 ? r(f) : f >= 1e-3 ? `${r(f * 1e3)}m` : `${r(f * 1e6)}µ`;
  };
  // Dải tần theo số liệu, làm tròn ra lũy thừa 10 (cách điện cuộn dây đo từ 0,1 mHz trở lên)
  function fRangeOf(items) {
    const fs = (items || []).flatMap(m => (m.f || []).map(Number)).filter(f => f > 0 && Number.isFinite(f));
    if (!fs.length) return [F0, F0 * p10(DECADES)];
    const lo = p10(Math.floor(Math.log10(Math.min(...fs)) + 1e-6)), hi = p10(Math.ceil(Math.log10(Math.max(...fs)) - 1e-6));
    return [lo, Math.max(hi, lo * 10)];
  }

  // Giá trị tgδ lớn nhất của các phép đo — dùng làm thang chung cho đồ thị riêng và xếp chồng của một phía
  const maxTan = items => Math.max(0, ...(items || []).flatMap(m => series(m).map(p => p[1])));

  // items: phép đo { phase, f, tan }; overlay: có chú giải pha
  // o: { title, yMax, logY: trục tgδ logarit (cách điện cuộn dây), fAuto: dải tần theo số liệu thay vì 10 mHz – 10 kHz }
  function draw(canvas, items, overlay = false, o = {}) {
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    const [f0, f1] = o.fAuto ? fRangeOf(items) : [F0, F0 * p10(DECADES)], decades = Math.round(Math.log10(f1 / f0));
    const data = (items || []).slice().sort((a, b) => PH.indexOf(a.phase) - PH.indexOf(b.phase))
      .map(m => ({ phase: m.phase, pts: series(m, f0, f1).filter(p => !o.logY || p[1] > 0) }));
    const top = Math.max(o.yMax || 0, maxTan(items), 0.1);
    const ys = niceStep(top, 5), y1 = Math.ceil(top / ys - 1e-9) * ys;
    const yd = Math.max(0, -Math.floor(Math.log10(ys) + 1e-9));
    // trục log: từ lũy thừa 10 dưới giá trị nhỏ nhất tới lũy thừa 10 trên giá trị lớn nhất
    const pos = data.flatMap(s => s.pts.map(p => p[1])), e0 = pos.length ? Math.floor(Math.log10(Math.min(...pos)) + 1e-9) : -2;
    const e1 = Math.max(e0 + 1, pos.length ? Math.ceil(Math.log10(Math.max(...pos)) - 1e-9) : 0);
    // chú giải (đồ thị xếp chồng): một hàng ngang giữa tiêu đề và khung đồ thị, không đè lên đường đo
    const legend = overlay && data.length, T0 = o.title ? 58 : 22;
    const L = 128, R = 30, T = T0 + (legend ? 40 : 0), B = 80;
    const px = f => L + Math.log10(Math.max(f0, f) / f0) / decades * (W - L - R);
    const py = o.logY ? y => H - B - (Math.log10(y) - e0) / (e1 - e0) * (H - T - B) : y => H - B - y / y1 * (H - T - B);

    g.lineWidth = 1;
    // lưới phụ logarit 2…9 × 10^n
    g.strokeStyle = MINOR;
    const d0 = Math.round(Math.log10(f0));
    for (let e = d0; e < d0 + decades; e++) for (let n = 2; n <= 9; n++) {
      const x = Math.round(px(n * p10(e))) + 0.5;
      g.beginPath(); g.moveTo(x, T); g.lineTo(x, H - B); g.stroke();
    }
    if (o.logY) for (let e = e0; e < e1; e++) for (let n = 2; n <= 9; n++) {
      const y = Math.round(py(n * p10(e))) + 0.5;
      g.beginPath(); g.moveTo(L, y); g.lineTo(W - R, y); g.stroke();
    }
    g.font = `500 26px ${FONT}`; g.fillStyle = INK; g.strokeStyle = GRID;
    g.textAlign = 'right'; g.textBaseline = 'middle';
    const yTicks = o.logY ? Array.from({ length: e1 - e0 + 1 }, (_, i) => [p10(e0 + i), fmt(p10(e0 + i), Math.max(0, -(e0 + i)))])
      : Array.from({ length: Math.round(y1 / ys) + 1 }, (_, i) => [i * ys, fmt(i * ys, yd)]);
    yTicks.forEach(([y, t]) => {
      const yy = Math.round(py(y)) + 0.5;
      g.beginPath(); g.moveTo(L, yy); g.lineTo(W - R, yy); g.stroke();
      g.fillText(t, L - 10, yy);
    });
    g.textAlign = 'center'; g.textBaseline = 'top';
    // nhãn trục tần số: mỗi lũy thừa 10; dải trên 7 decade thì cách một nhãn để chữ không chồng nhau
    const fTicks = o.fAuto ? Array.from({ length: decades + 1 }, (_, i) => p10(d0 + i)).map((f, i) => [f, decades > 7 && i % 2 ? '' : fLabel(f)]) : LABELS;
    fTicks.forEach(([f, t]) => {
      const x = Math.round(px(f)) + 0.5;
      g.beginPath(); g.moveTo(x, T); g.lineTo(x, H - B); g.stroke();
      g.fillText(t, x, H - B + 10);
    });
    g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(L, T, W - L - R, H - T - B);
    g.font = `600 26px ${FONT}`;
    g.fillText('f (Hz)', L + (W - L - R) / 2, H - 40);
    g.save(); g.translate(26, T + (H - T - B) / 2); g.rotate(-Math.PI / 2); g.textBaseline = 'middle'; g.fillText('tgδ (%)', 0, 0); g.restore();
    if (o.title) { g.font = `700 30px ${FONT}`; g.textBaseline = 'top'; g.fillText(o.title, L + (W - L - R) / 2, 12); }

    // đường và điểm đo
    g.save(); g.beginPath(); g.rect(L, T, W - L - R, H - T - B); g.clip();
    g.lineJoin = 'round';
    data.forEach(s => {
      const c = COLORS[s.phase] || LINE;
      g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2.5;
      g.beginPath();
      s.pts.forEach(([f, y], i) => (i ? g.lineTo(px(f), py(y)) : g.moveTo(px(f), py(y))));
      g.stroke();
      // nhiều điểm đo (vd 10 điểm/decade) thì chấm nhỏ để không che đường
      const r = s.pts.length > 50 ? 2.5 : 4;
      s.pts.forEach(([f, y]) => { g.beginPath(); g.arc(px(f), py(y), r, 0, Math.PI * 2); g.fill(); });
    });
    g.restore();

    if (legend) {
      g.font = `600 24px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
      const items = data.map(s => ({ s, t: `Pha ${s.phase}`, w: 40 + g.measureText(`Pha ${s.phase}`).width }));
      const gap = 36, total = items.reduce((a, x) => a + x.w, 0) + gap * (items.length - 1);
      let x = L + (W - L - R - total) / 2;
      const yy = T0 + 18;
      items.forEach(({ s, t, w }) => {
        const c = COLORS[s.phase] || INK;
        g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + 30, yy); g.stroke();
        g.fillStyle = c; g.beginPath(); g.arc(x + 15, yy, 4, 0, Math.PI * 2); g.fill();
        g.fillStyle = INK; g.fillText(t, x + 40, yy);
        x += w + gap;
      });
    }
    return canvas;
  }

  function png(items, overlay = false, o = {}) {
    const c = draw(document.createElement('canvas'), items, overlay, o);
    return new Promise((resolve, reject) => c.toBlob(b => (b
      ? b.arrayBuffer().then(a => resolve({ png: new Uint8Array(a), w: W, h: H }))
      : reject(new Error('Không tạo được đồ thị DFR'))), 'image/png'));
  }

  window.DfrChart = { draw, png, maxTan, fRangeOf, fLabel, COLORS, W, H };
})();
