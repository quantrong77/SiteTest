// Lấy chữ kèm tọa độ từ file PDF ngay trong trình duyệt bằng pdf.js — file không gửi đi đâu.
// Thư viện (~1 MB) chỉ tải khi dùng lần đầu, sau đó trình duyệt lưu đệm. Chỉ đọc PDF có lớp chữ
// (báo cáo in từ phần mềm), không nhận dạng ảnh quét.
(function () {
  'use strict';
  const BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
  let loading = null;

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

  // File PDF → mảng trang, mỗi trang là mảng { str, x, y, w } (y tính từ đáy trang)
  async function extract(file) {
    const lib = await loadLib();
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await lib.getDocument({ data, isEvalSupported: false }).promise;
    const pages = [];
    try {
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const tc = await page.getTextContent();
        pages.push(tc.items.filter(it => it.str && it.str.trim())
          .map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width })));
      }
    } finally { pdf.destroy(); }
    if (!pages.some(p => p.length)) throw new Error(`${file.name}: PDF không có lớp chữ (có thể là ảnh quét)`);
    return pages;
  }

  window.PdfText = { extract };
})();
