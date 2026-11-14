(function () {
  'use strict';
  // Hỗ trợ số viết bằng chữ số hoặc đọc tiếng Việt, gồm số âm, hàng nghìn/triệu và phần thập phân.
  const words = new Map([
    ['không', 0], ['một', 1], ['hai', 2], ['ba', 3], ['bốn', 4], ['tư', 4],
    ['năm', 5], ['lăm', 5], ['nhăm', 5], ['sáu', 6], ['bảy', 7], ['tám', 8], ['chín', 9],
  ]);
  const fold = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const digit = s => words.has(s) ? words.get(s) : words.get(fold(s));
  function parse(text) {
    const source = String(text || '').normalize('NFC').toLocaleLowerCase('vi-VN').trim();
    if (/^-?\d+(?:[,.]\d+)?$/.test(source)) return source.replace('.', ',');
    let a = source.replace(/,/g, ' phẩy ').replace(/\./g, ' chấm ').split(/\s+/).filter(Boolean);
    if (!a.length) return null;
    let neg = false;
    if (a[0] === 'âm' || a[0] === 'am') { neg = true; a.shift(); }
    const p = a.findIndex(w => ['phẩy', 'phay', 'chấm', 'cham'].includes(w));
    const d = p < 0 ? [] : a.slice(p + 1);
    if (p >= 0) a = a.slice(0, p);
    const frac = d.map(digit);
    if (p >= 0 && (!frac.length || frac.some(n => n == null))) return null;
    let total = 0, part = 0, n = null, seen = false;
    for (let i = 0; i < a.length; i++) {
      const w = a[i], v = digit(w);
      if (v != null) { n = v; seen = true; }
      else if (w === 'trăm' || fold(w) === 'tram') { part = (part + (n == null ? 1 : n)) * 100; n = null; seen = true; }
      else if (w === 'mười' || w === 'mươi' || fold(w) === 'muoi') { part += (n == null ? 1 : n) * 10; n = null; seen = true; }
      else if (w === 'lẻ' || w === 'linh' || fold(w) === 'le') { n = n == null ? 0 : n; seen = true; }
      else if (['nghìn', 'ngàn', 'nghin', 'ngan', 'triệu', 'trieu'].includes(w)) {
        total += (part + (n == null ? 0 : n)) * (w === 'triệu' || w === 'trieu' ? 1000000 : 1000);
        part = 0; n = null; seen = true;
      } else if (w === 'mốt' && i > 0 && (a[i - 1] === 'mươi' || a[i - 1] === 'mười')) { n = 1; seen = true; }
      else return null;
    }
    if (!seen && p < 0) return null;
    const value = total + part + (n == null ? 0 : n), decimal = frac.join('');
    return (neg && (value || /[1-9]/.test(decimal)) ? '-' : '') + value + (p < 0 ? '' : ',' + decimal);
  }
  window.VnNumber = { parse };
})();
