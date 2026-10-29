// Nhận dạng chữ trên ảnh (OCR) ngay trong trình duyệt bằng Tesseract.js — ảnh không gửi đi đâu.
// Thư viện và dữ liệu ngôn ngữ (tiếng Anh, ~10 MB) chỉ tải khi dùng lần đầu, sau đó trình duyệt lưu đệm.
// Ảnh được phóng to, chuyển xám, giãn độ tương phản trước khi đọc để chữ nhỏ trên nameplate rõ hơn.
(function () {
  'use strict';
  const LIB = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  let libLoading = null, worker = null;

  function loadLib() {
    if (window.Tesseract) return Promise.resolve();
    if (!libLoading) {
      libLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = LIB; s.async = true;
        s.onload = () => resolve();
        s.onerror = () => { libLoading = null; reject(new Error('Không tải được thư viện OCR (cần kết nối mạng lần đầu)')); };
        document.head.appendChild(s);
      });
    }
    return libLoading;
  }

  const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms))]);

  // Ảnh → canvas đã xử lý; rotate: 0 / 90 / 180 / 270 độ
  async function prepare(file, rotate = 0, opts = {}) {
    const bmp = await createImageBitmap(file);
    const long = Math.max(bmp.width, bmp.height);
    // chữ nhỏ cần ảnh lớn; không phóng quá 3 lần và không quá ~24 triệu điểm ảnh (bộ nhớ trình duyệt)
    const want = opts.scale || Math.min(3, Math.max(1, (opts.long || 2600) / long));
    const k = Math.min(want, Math.sqrt(24e6 / (bmp.width * bmp.height)));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const turn = rotate % 180 !== 0;
    const cv = document.createElement('canvas');
    cv.width = turn ? h : w; cv.height = turn ? w : h;
    const g = cv.getContext('2d');
    g.translate(cv.width / 2, cv.height / 2); g.rotate(rotate * Math.PI / 180);
    g.imageSmoothingQuality = 'high';
    g.drawImage(bmp, -w / 2, -h / 2, w, h);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const img = g.getImageData(0, 0, cv.width, cv.height), d = img.data;
    // xám + giãn tương phản theo phân vị 2 % – 98 %
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) { const y = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; d[i] = y; hist[y]++; }
    const n = d.length / 4;
    let lo = 0, hi = 255, acc = 0;
    for (; lo < 255 && (acc += hist[lo]) < n * 0.02; lo++);
    acc = 0;
    for (; hi > 0 && (acc += hist[hi]) < n * 0.02; hi--);
    const span = Math.max(1, hi - lo);
    const W = cv.width, H = cv.height;
    let y8 = new Uint8ClampedArray(W * H);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) y8[j] = (d[i] - lo) * 255 / span;
    if (opts.mode === 'median' || opts.mode === 'binarize') y8 = median3(y8, W, H);
    if (opts.mode === 'binarize') y8 = binarize(y8, W, H);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) d[i] = d[i + 1] = d[i + 2] = y8[j];
    g.putImageData(img, 0, 0);
    return cv;
  }

  // Lọc trung vị 3×3: bỏ hạt nhiễu, vân xước của nameplate kim loại
  function median3(a, W, H) {
    const o = new Uint8ClampedArray(a.length), win = new Array(9);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = Math.min(H - 1, Math.max(0, y + dy)), xx = Math.min(W - 1, Math.max(0, x + dx));
        win[n++] = a[yy * W + xx];
      }
      win.sort((p, q) => p - q);
      o[y * W + x] = win[4];
    }
    return o;
  }
  // Nhị phân hóa thích nghi (trung bình cục bộ, ảnh tích phân): chữ tối hơn nền xung quanh 12 % thành đen
  function binarize(a, W, H) {
    const S = new Float64Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) {
      let row = 0;
      for (let x = 0; x < W; x++) { row += a[y * W + x]; S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + row; }
    }
    const r = Math.max(8, Math.round(Math.min(W, H) / 40)), o = new Uint8ClampedArray(a.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
      const sum = S[y1 * (W + 1) + x1] - S[y0 * (W + 1) + x1] - S[y1 * (W + 1) + x0] + S[y0 * (W + 1) + x0];
      o[y * W + x] = a[y * W + x] < sum / ((x1 - x0) * (y1 - y0)) * 0.88 ? 0 : 255;
    }
    return o;
  }

  // → { text, conf, lines: [{ text, conf, bbox: { x0, y0, x1, y1 }, baseline: { x0, y0, x1, y1 }, words: [{ text, conf }] }] }
  // mode: 'median' (lọc hạt nhiễu, mặc định — tốt nhất khi thử với nameplate kim loại) | 'binarize' | 'none';
  // psm 3 = tự phân khối (tốt với bảng thông số rõ chữ); psm 11 = chữ rải rác (nameplate có sơ đồ, nhiều bảng — dùng cho lượt
  // đọc thứ hai). Bộ phân tích ghép các dòng thành hàng theo toạ độ. long: cạnh dài ảnh sau khi phóng (mặc định 2600 px).
  async function recognize(file, { rotate = 0, onProgress, mode = 'median', psm = '3', scale = 0, long = 0 } = {}) {
    const say = (stage, p) => onProgress && onProgress(stage, p);
    say('Đang tải thư viện OCR…', 0);
    // mạng chập chờn có thể làm việc tải treo không báo lỗi → giới hạn thời gian để người dùng thử lại
    const NET = 'Không tải được bộ nhận dạng chữ — kiểm tra kết nối mạng rồi thử lại (sau lần tải đầu, máy lưu sẵn và dùng được khi mất mạng)';
    await withTimeout(loadLib(), 60000, NET);
    if (!worker) {
      say('Đang tải dữ liệu nhận dạng chữ (lần đầu ~10 MB)…', 0);
      const w = Tesseract.createWorker('eng', 1, {
        logger: m => { if (m.status === 'recognizing text') say('Đang đọc chữ trên ảnh…', m.progress); },
      });
      worker = await withTimeout(w, 120000, NET).catch(e => { w.then(x => x.terminate()).catch(() => {}); throw e; });
    }
    say('Đang xử lý ảnh…', 0);
    const cv = await prepare(file, rotate, { mode, scale, long });
    await worker.setParameters({ tessedit_pageseg_mode: psm });
    const { data } = await worker.recognize(cv);
    const lines = (data.lines || []).map(l => ({
      text: l.text.trim(), conf: l.confidence, bbox: l.bbox, baseline: l.baseline,
      words: (l.words || []).map(w => ({ text: w.text, conf: w.confidence })),
    })).filter(l => l.text);
    return { text: data.text || '', conf: data.confidence, lines, preview: cv.toDataURL('image/jpeg', 0.7) };
  }

  window.Ocr = { recognize };
})();
