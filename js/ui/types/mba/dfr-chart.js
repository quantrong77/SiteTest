// MBA: vẽ đặc tuyến tgδ theo tần số (DFR sứ đầu vào, DIRANA) trên trục tần số logarit — xem trước ở trang Phụ lục
// và ảnh PNG cho phụ lục BBTN. Đồ thị in trên giấy trắng nên dùng màu cố định (không theo giao diện sáng/tối).
(function () {
  'use strict';
  const W = 720, H = 440; // in 8 cm (2 đồ thị/hàng): chữ 26 px ≈ 8 pt
  const COLORS = { A: '#c99700', B: '#2e7d32', C: '#c62828' };
  const INK = '#1b1f24', GRID = '#d5d9de', MINOR = '#eef0f2';
  const FONT = '"Be Vietnam Pro", Arial, sans-serif';
  const F0 = 0.01, DECADES = 6; // 10 mHz – 10 kHz
  const LABELS = [[0.01, '10m'], [0.1, '100m'], [1, '1'], [10, '10'], [100, '100'], [1000, '1k'], [10000, '10k']];
  const PH = ['A', 'B', 'C'];
  const fmt = (x, d) => x.toFixed(d).replace('.', ',');

  // Bước chia trục "đẹp" (1, 2, 5 × 10^n)
  function niceStep(span, n) {
    const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }

  // Điểm đo trong dải trục (tần số đầu của DIRANA ghi 0,0099999998 Hz nên có dung sai)
  const series = m => m.f.map((f, i) => [Number(f), Number(m.tan[i])])
    .filter(([f, y]) => f >= F0 * 0.999 && f <= 1e4 && Number.isFinite(y) && y >= 0);

  // Giá trị tgδ lớn nhất của các phép đo — dùng làm thang chung cho đồ thị riêng và xếp chồng của một phía
  const maxTan = items => Math.max(0, ...(items || []).flatMap(m => series(m).map(p => p[1])));

  // items: phép đo { phase, f, tan }; overlay: có chú giải pha; o: { title, yMax }
  function draw(canvas, items, overlay = false, o = {}) {
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    const data = (items || []).slice().sort((a, b) => PH.indexOf(a.phase) - PH.indexOf(b.phase))
      .map(m => ({ phase: m.phase, pts: series(m) }));
    const top = Math.max(o.yMax || 0, maxTan(items), 0.1);
    const ys = niceStep(top, 5), y1 = Math.ceil(top / ys - 1e-9) * ys;
    const yd = Math.max(0, -Math.floor(Math.log10(ys) + 1e-9));
    const L = 128, R = 30, T = o.title ? 58 : 22, B = 80;
    const px = f => L + Math.log10(Math.max(F0, f) / F0) / DECADES * (W - L - R);
    const py = y => H - B - y / y1 * (H - T - B);

    g.lineWidth = 1;
    // lưới phụ logarit 2…9 × 10^n
    g.strokeStyle = MINOR;
    for (let e = -2; e < 4; e++) for (let n = 2; n <= 9; n++) {
      const x = Math.round(px(n * Math.pow(10, e))) + 0.5;
      g.beginPath(); g.moveTo(x, T); g.lineTo(x, H - B); g.stroke();
    }
    g.font = `500 26px ${FONT}`; g.fillStyle = INK; g.strokeStyle = GRID;
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let y = 0; y <= y1 + ys / 2; y += ys) {
      const yy = Math.round(py(y)) + 0.5;
      g.beginPath(); g.moveTo(L, yy); g.lineTo(W - R, yy); g.stroke();
      g.fillText(fmt(y, yd), L - 10, yy);
    }
    g.textAlign = 'center'; g.textBaseline = 'top';
    LABELS.forEach(([f, t]) => {
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
      const c = COLORS[s.phase] || INK;
      g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2.5;
      g.beginPath();
      s.pts.forEach(([f, y], i) => (i ? g.lineTo(px(f), py(y)) : g.moveTo(px(f), py(y))));
      g.stroke();
      s.pts.forEach(([f, y]) => { g.beginPath(); g.arc(px(f), py(y), 4, 0, Math.PI * 2); g.fill(); });
    });
    g.restore();

    // chú giải (đồ thị xếp chồng) ở góc phải trên, nền trắng để không lẫn với đường
    if (overlay && data.length) {
      g.font = `600 24px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
      const bw = 128, bh = 14 + data.length * 30, bx = W - R - bw - 10, by = T + 10;
      g.fillStyle = 'rgba(255,255,255,0.92)'; g.fillRect(bx, by, bw, bh);
      g.strokeStyle = GRID; g.lineWidth = 1; g.strokeRect(bx + 0.5, by + 0.5, bw, bh);
      data.forEach((s, i) => {
        const yy = by + 22 + i * 30, c = COLORS[s.phase] || INK;
        g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.moveTo(bx + 12, yy); g.lineTo(bx + 42, yy); g.stroke();
        g.fillStyle = INK; g.fillText(`Pha ${s.phase}`, bx + 50, yy);
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

  window.DfrChart = { draw, png, maxTan, COLORS, W, H };
})();
