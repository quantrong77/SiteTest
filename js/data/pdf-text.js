// Đọc PDF trong trình duyệt bằng PDF.js — file không gửi đi đâu. PDF scan được render rồi OCR
// bằng Tesseract.js tải theo yêu cầu; PDF và ảnh từng trang không được gửi lên dịch vụ OCR.
(function () {
  'use strict';
  const BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
  const OCR_SCRIPT = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
  let loading = null;
  let ocrLoading = null;

  function loadLib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = BASE + 'pdf.min.js'; s.async = true;
        s.onload = () => {
          if (!window.pdfjsLib) { loading = null; reject(new Error('Thư viện đọc PDF không khởi động được')); return; }
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = BASE + 'pdf.worker.min.js';
          resolve(window.pdfjsLib);
        };
        s.onerror = () => { loading = null; reject(new Error('Không tải được thư viện đọc PDF (cần kết nối mạng lần đầu)')); };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  function loadOcrLib() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!ocrLoading) {
      ocrLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = OCR_SCRIPT; s.async = true;
        s.onload = () => {
          if (window.Tesseract) resolve(window.Tesseract);
          else { ocrLoading = null; reject(new Error('Tesseract.js không khởi động được')); }
        };
        s.onerror = () => { ocrLoading = null; reject(new Error('Không tải được Tesseract.js từ CDN')); };
        document.head.appendChild(s);
      });
    }
    return ocrLoading;
  }

  function withTimeout(promise, ms, message) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); }),
    ]).finally(() => clearTimeout(timer));
  }

  async function readTextPages(file) {
    const lib = await loadLib();
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await lib.getDocument({ data, isEvalSupported: false }).promise;
    const pages = [];
    try {
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const viewport = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        const items = tc.items.filter(it => it.str && it.str.trim())
          .map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width }));
        items.pageWidth = viewport.width;
        items.pageHeight = viewport.height;
        pages.push(items);
      }
    } finally { await pdf.destroy(); }
    return pages;
  }

  // File PDF có lớp chữ → mảng trang, mỗi trang là mảng { str, x, y, w }.
  async function extract(file) {
    const pages = await readTextPages(file);
    if (!pages.some(p => p.length)) throw new Error(`${file.name}: PDF không có lớp chữ (có thể là ảnh quét)`);
    return pages;
  }

  // OCR từng trang chưa có lớp chữ; PDF.js dựng ảnh, Tesseract.js nhận dạng ngay trên trình duyệt.
  async function extractWithOcr(file, onProgress) {
    const pages = await readTextPages(file);
    const missing = pages.map((page, index) => page.length ? -1 : index).filter(index => index >= 0);
    if (!missing.length) return { pages, ocrPages: 0, confidence: null };

    if (onProgress) onProgress({ status: 'Đang tải OCR', page: 0, total: missing.length, progress: 0 });
    const lib = await withTimeout(loadOcrLib(), 60000, 'Không tải được thư viện OCR trong 60 giây; kiểm tra kết nối mạng rồi thử lại.');
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await window.pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
    let worker = null, completed = 0;
    const confidences = [];
    try {
      const workerPromise = lib.createWorker(['vie', 'eng'], 1, {
        logger: m => {
          if (!onProgress) return;
          onProgress({ status: m.status || 'Đang nhận dạng', page: completed + 1, total: missing.length, progress: m.progress || 0 });
        },
      });
      try {
        worker = await withTimeout(workerPromise, 120000, 'Tải engine hoặc dữ liệu OCR quá 120 giây; kiểm tra kết nối rồi thử lại.');
      } catch (error) {
        workerPromise.then(lateWorker => lateWorker.terminate()).catch(() => {});
        throw error;
      }
      for (const index of missing) {
        const pageNo = index + 1;
        if (onProgress) onProgress({ status: 'Đang dựng ảnh trang', page: pageNo, total: missing.length, progress: 0 });
        const page = await pdf.getPage(pageNo);
        const viewport = page.getViewport({ scale: 2.2 });
        const canvas = document.createElement('canvas');
        try {
          canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) throw new Error('Trình duyệt không hỗ trợ dựng trang PDF để OCR.');
          await page.render({ canvasContext: context, viewport }).promise;
          // Tesseract.js 6+ chỉ trả text mặc định; yêu cầu blocks để lấy lại bbox của từng từ.
          const result = await worker.recognize(canvas, {}, { text: true, blocks: true });
          const words = (result.data.words || []).filter(word => word.text && word.text.trim() && word.bbox)
            .map(word => ({
              str: word.text, x: word.bbox.x0, y: viewport.height - word.bbox.y1,
              w: Math.max(0, word.bbox.x1 - word.bbox.x0),
            }));
          function addBox(box) {
            if (!box || !box.text || !box.text.trim() || !box.bbox) return;
            words.push({
              str: box.text, x: box.bbox.x0, y: viewport.height - box.bbox.y1,
              w: Math.max(0, box.bbox.x1 - box.bbox.x0),
            });
          }
          function visitBlock(node) {
            if (!node) return;
            if (Array.isArray(node)) { node.forEach(visitBlock); return; }
            if (Array.isArray(node.words) && node.words.length) { node.words.forEach(addBox); return; }
            if (Array.isArray(node.lines) && node.lines.length) { node.lines.forEach(visitBlock); return; }
            if (Array.isArray(node.paragraphs) && node.paragraphs.length) { node.paragraphs.forEach(visitBlock); return; }
            addBox(node);
          }
          if (!words.length) visitBlock(result.data.blocks || []);
          if (!words.length) {
            (result.data.lines || []).forEach(line => {
              if (!line.text || !line.text.trim() || !line.bbox) return;
              words.push({
                str: line.text, x: line.bbox.x0, y: viewport.height - line.bbox.y1,
                w: Math.max(0, line.bbox.x1 - line.bbox.x0),
              });
            });
          }
          if (!words.length && String(result.data.text || '').trim()) {
            String(result.data.text).split(/\r?\n/).map(x => x.trim()).filter(Boolean).forEach((line, row) => {
              words.push({ str: line, x: 0, y: viewport.height - (row + 1) * 18, w: viewport.width });
            });
          }
          words.pageWidth = viewport.width;
          words.pageHeight = viewport.height;
          pages[index] = words;
          if (Number.isFinite(result.data.confidence)) confidences.push(result.data.confidence);
        } finally {
          page.cleanup();
          canvas.width = 0; canvas.height = 0;
        }
        completed++;
        if (onProgress) onProgress({ status: 'Đã nhận dạng trang', page: pageNo, total: missing.length, progress: 1 });
      }
    } finally {
      try { if (worker) await worker.terminate(); }
      finally { await pdf.destroy(); }
    }
    const confidence = confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null;
    return { pages, ocrPages: missing.length, confidence };
  }

  window.PdfText = { extract, extractWithOcr };
})();
