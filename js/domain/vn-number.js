(function () {
  'use strict';
  // Hỗ trợ số viết bằng chữ số hoặc đọc tiếng Việt, gồm số âm, hàng nghìn/triệu và phần thập phân.
  const words = new Map([
    ['không', 0], ['một', 1], ['hai', 2], ['ba', 3], ['bốn', 4], ['tư', 4],
    ['năm', 5], ['lăm', 5], ['nhăm', 5], ['sáu', 6], ['bảy', 7], ['tám', 8], ['chín', 9],
  ]);
  const fold = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const digit = s => words.has(s) ? words.get(s) : words.get(fold(s));
  // Đơn vị / từ đệm hay đi kèm khi đọc số ngoài hiện trường ("34 độ", "4500 mê ga", "0,5 phần trăm") — bỏ ở cuối câu
  const UNIT = /(?:(?:(?<=\d)\s*|\s+)(?:%|°\s*c?|độ(?:\s*c|\s*xê)?|phần\s*trăm|mê\s*ga(?:\s*ôm)?|mega(?:\s*ôm)?|gi\s*ga(?:\s*ôm)?|giga(?:\s*ôm)?|ki\s*lô(?:\s*vôn|\s*oát)?|kilo(?:\s*vôn|\s*oát)?|mi\s*li(?:\s*ôm|\s*ampe)?|mili(?:\s*ôm|\s*ampe)?|pi\s*cô(?:\s*fa\s*ra)?|pico(?:\s*fara)?|ôm|ohm|vôn|volt|ampe|oát|watt|[mkgµ]?[ωΩ]|mω|gω|kv|mv|kw|pf|nf|v|a|w|hz|héc)(?![\p{L}\d]))+\s*$/iu;
  function parse(text) {
    let source = String(text || '').normalize('NFC').toLocaleLowerCase('vi-VN').trim().replace(UNIT, '').trim();
    // 1.234,5 / 1 234 (tách nghìn) → 1234,5
    if (/^-?\d{1,3}(?:[. ]\d{3})+(?:,\d+)?$/.test(source)) source = source.replace(/[. ]/g, '');
    if (/^-?\d+(?:[,.]\d+)?$/.test(source)) return source.replace('.', ',');
    let a = source.replace(/(\d),(\d)/g, '$1 phẩy $2').replace(/,/g, ' phẩy ').replace(/(\d)\.(\d)/g, '$1 chấm $2').replace(/\./g, ' chấm ').split(/\s+/).filter(Boolean);
    if (!a.length) return null;
    let neg = false;
    if (a[0] === 'âm' || a[0] === 'am') { neg = true; a.shift(); }
    const p = a.findIndex(w => ['phẩy', 'phay', 'chấm', 'cham'].includes(w));
    const d = p < 0 ? [] : a.slice(p + 1);
    if (p >= 0) a = a.slice(0, p);
    // phần thập phân: chữ số ("2 phẩy 25") hoặc đọc từng chữ số ("phẩy hai lăm")
    const frac = d.flatMap(w => (/^\d+$/.test(w) ? w.split('').map(Number) : [digit(w)]));
    // phần nguyên là chữ số ("2 phẩy năm", "-3")
    if (a.length === 1 && /^\d+$/.test(a[0])) {
      if (p >= 0 && (!frac.length || frac.some(n => n == null))) return null;
      return (neg && (+a[0] || frac.some(x => x)) ? '-' : '') + String(+a[0]) + (p < 0 ? '' : ',' + frac.join(''));
    }
    if (p >= 0 && (!frac.length || frac.some(n => n == null))) return null;
    let total = 0, part = 0, n = null, seen = false;
    for (let i = 0; i < a.length; i++) {
      const w = a[i], v = digit(w);
      if (v != null) { n = v; seen = true; }
      else if (w === 'trăm' || fold(w) === 'tram') { part = (part + (n == null ? 1 : n)) * 100; n = null; seen = true; }
      else if (w === 'mười' || w === 'mươi' || fold(w) === 'muoi') { part += (n == null ? 1 : n) * 10; n = null; seen = true; }
      else if (w === 'lẻ' || w === 'linh' || fold(w) === 'le') { n = n == null ? 0 : n; seen = true; }
      else if (['nghìn', 'ngàn', 'nghin', 'ngan', 'triệu', 'trieu', 'tỷ', 'tỉ', 'ty', 'ti'].includes(w)) {
        const mul = ['tỷ', 'tỉ', 'ty', 'ti'].includes(w) ? 1e9 : w === 'triệu' || w === 'trieu' ? 1e6 : 1000;
        // "ba tỷ hai triệu": cộng phần đã có ở hàng lớn hơn
        total = mul === 1e9 ? (total + part + (n == null ? 0 : n)) * mul : total + (part + (n == null ? 0 : n)) * mul;
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
