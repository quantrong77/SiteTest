// MBA: vẽ đồ thị điện trở động R(t) khi chuyển nấc OLTC lên canvas — xem trước ở mục 9 và ảnh PNG cho phụ lục BBTN.
// Đồ thị in trên giấy trắng nên dùng màu cố định (không theo giao diện sáng/tối).
(function () {
  'use strict';
  const W = 720, H = 440; // in 8 cm (2 đồ thị/hàng): chữ 26 px ≈ 8 pt
  const INK = '#1b1f24', GRID = '#d5d9de', LINE = '#1f4e9a';
  const FONT = '"Be Vietnam Pro", Arial, sans-serif';

  // Bước chia trục "đẹp" (1, 2, 5 × 10^n)
  function niceStep(span, n) {
    const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }
  const dec = step => Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const fmt = (x, d) => x.toFixed(d).replace('.', ',');

  // series: [{ c (bản nén OltcWave), color }]; o: { title, sub }
  function draw(canvas, series, o = {}) {
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    const data = series.map(s => Object.assign({ e: OltcWave.expand(s.c) }, s));
    let yMin = Infinity, yMax = -Infinity, tMax = 0;
    data.forEach(({ e }) => {
      e.lo.forEach(x => { if (Number.isFinite(x)) yMin = Math.min(yMin, x); });
      e.hi.forEach(x => { if (Number.isFinite(x)) yMax = Math.max(yMax, x); });
      tMax = Math.max(tMax, e.t[e.t.length - 1] || 0);
    });
    if (!Number.isFinite(yMin)) { yMin = 0; yMax = 1; }
    const pad = (yMax - yMin) * 0.08 || Math.abs(yMax) * 0.05 || 1;
    const ys = niceStep(yMax - yMin + 2 * pad, 5);
    const y0 = Math.floor((yMin - pad) / ys) * ys, y1 = Math.ceil((yMax + pad) / ys) * ys;
    const xs = niceStep(tMax, 5), x1 = Math.ceil(tMax / xs) * xs;
    const L = 132, R = 36, T = o.title ? 60 : 22, B = 76;
    const px = t => L + t / x1 * (W - L - R), py = y => H - B - (y - y0) / (y1 - y0) * (H - T - B);

    g.font = `500 26px ${FONT}`; g.fillStyle = INK; g.strokeStyle = GRID; g.lineWidth = 1;
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let y = y0; y <= y1 + ys / 2; y += ys) {
      g.beginPath(); g.moveTo(L, Math.round(py(y)) + 0.5); g.lineTo(W - R, Math.round(py(y)) + 0.5); g.stroke();
      g.fillText(fmt(y, dec(ys)), L - 10, py(y));
    }
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (let t = 0; t <= x1 + xs / 2; t += xs) {
      g.beginPath(); g.moveTo(Math.round(px(t)) + 0.5, T); g.lineTo(Math.round(px(t)) + 0.5, H - B); g.stroke();
      g.fillText(fmt(t, dec(xs)), px(t), H - B + 10);
    }
    g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(L, T, W - L - R, H - T - B);
    g.font = `600 26px ${FONT}`;
    g.fillText('t (ms)', L + (W - L - R) / 2, H - 38);
    g.save(); g.translate(24, T + (H - T - B) / 2); g.rotate(-Math.PI / 2); g.textBaseline = 'middle'; g.fillText('R (Ω)', 0, 0); g.restore();
    if (o.title) { g.font = `700 30px ${FONT}`; g.textBaseline = 'top'; g.fillText(o.title, L + (W - L - R) / 2, 14); }

    // Đường bao nhỏ nhất–lớn nhất từng nhóm mẫu (giữ được xung hẹp khi chuyển mạch)
    g.save(); g.beginPath(); g.rect(L, T, W - L - R, H - T - B); g.clip();
    g.lineJoin = 'round';
    data.forEach(({ e, color }) => {
      g.strokeStyle = color || LINE; g.lineWidth = 2.2; g.beginPath();
      let pen = false;
      for (let k = 0; k < e.t.length; k++) {
        if (!Number.isFinite(e.lo[k])) { pen = false; continue; }
        const x = px(e.t[k]);
        if (!pen) { g.moveTo(x, py(e.lo[k])); pen = true; } else g.lineTo(x, py(e.lo[k]));
        if (e.hi[k] !== e.lo[k]) g.lineTo(x, py(e.hi[k]));
      }
      g.stroke();
    });
    g.restore();
    if (o.sub) { g.font = `400 20px ${FONT}`; g.textAlign = 'right'; g.textBaseline = 'top'; g.fillStyle = '#4a525c'; g.fillText(o.sub, W - R - 8, T + 8); }
    return canvas;
  }

  // Màu chồng nhiều lần chuyển nấc: nhạt → đậm theo thứ tự
  function ramp(n) {
    return Array.from({ length: n }, (_, k) => {
      const f = n > 1 ? k / (n - 1) : 1;
      return `hsl(216, ${45 + f * 20}%, ${72 - f * 46}%)`;
    });
  }

  // Nhãn như máy đo ("1->2"): font chữ của trang không có ký tự mũi tên
  const title = w => `${w.from} -> ${w.to}${w.conn ? ` (${w.conn})` : ''}`;

  // Ảnh PNG cho phụ lục
  function png(series, o) {
    const cv = draw(document.createElement('canvas'), series, o);
    return new Promise((resolve, reject) => cv.toBlob(b => (b ? b.arrayBuffer().then(ab => resolve({ png: new Uint8Array(ab), w: W, h: H })) : reject(new Error('Không tạo được ảnh đồ thị'))), 'image/png'));
  }

  window.OltcChart = { draw, png, ramp, title, W, H };
})();
