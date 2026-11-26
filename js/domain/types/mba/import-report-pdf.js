// Đọc BBTN MBA PTC3/NPTS BM.01 (PDF có lớp chữ hoặc đã OCR) thành dữ liệu biểu mẫu.
// Chỉ nhập trị số đo gốc; các trị số quy đổi trong PDF được bỏ qua để app tự tính lại.
(function () {
  'use strict';

  function fold(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim();
  }
  function compact(value) { return fold(value).replace(/δ/g, 'delta').replace(/[^a-z0-9]+/g, ''); }
  function foldedIndex(value) {
    let text = '', map = [];
    for (let i = 0; i < value.length; i++) {
      const chars = value[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi');
      for (const ch of chars) {
        if (/\s/.test(ch)) {
          if (text.endsWith(' ')) continue;
          text += ' '; map.push(i);
        } else { text += ch; map.push(i); }
      }
    }
    return { text: text.trim(), map };
  }
  function between(source, startLabel, endLabel) {
    const idx = foldedIndex(source), start = fold(startLabel), end = endLabel ? fold(endLabel) : '';
    const at = idx.text.indexOf(start);
    if (at < 0) return '';
    let a = at + start.length;
    while (a < idx.text.length && /[\s:=–—-]/.test(idx.text[a])) a++;
    let b = end ? idx.text.indexOf(end, a) : idx.text.length;
    if (b < 0) b = idx.text.length;
    const from = idx.map[a] ?? source.length, to = idx.map[b] ?? source.length;
    return source.slice(from, to).replace(/^[\s:=–—-]+|[\s:=–—-]+$/g, '').replace(/\s+/g, ' ').trim();
  }

  // Như between() nhưng dừng ở nhãn gần nhất trong danh sách (bìa BBTN 2 cột: các nhãn xen nhau khi ghép dòng)
  function betweenAny(source, startLabel, endLabels) {
    const idx = foldedIndex(source), start = fold(startLabel);
    const at = idx.text.indexOf(start);
    if (at < 0) return '';
    let a = at + start.length;
    while (a < idx.text.length && /[\s:=–—-]/.test(idx.text[a])) a++;
    let b = idx.text.length;
    endLabels.forEach(l => { const k = idx.text.indexOf(fold(l), a); if (k >= 0 && k < b) b = k; });
    const from = idx.map[a] ?? source.length, to = idx.map[b] ?? source.length;
    return source.slice(from, to).replace(/^[\s:=–—-]+|[\s:=–—-]+$/g, '').replace(/\s+/g, ' ').trim();
  }

  function positionedLines(page) {
    const words = (page || []).filter(x => x && String(x.str || '').trim()).slice()
      .sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    words.forEach(word => {
      let line = lines.find(x => Math.abs(x.y - word.y) <= 4);
      if (!line) { line = { y: word.y, words: [] }; lines.push(line); }
      line.words.push(word);
      line.y = line.words.reduce((sum, x) => sum + Number(x.y || 0), 0) / line.words.length;
    });
    return lines.sort((a, b) => b.y - a.y).map(line => {
      const items = line.words.sort((a, b) => a.x - b.x);
      return { y: line.y, items, text: items.map(x => x.str).join(' ').replace(/\s+/g, ' ').trim() };
    });
  }
  function pageLines(page) { return positionedLines(page).map(line => line.text); }
  function normDate(value) {
    const m = String(value || '').match(/(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{4})/);
    return m ? m[1].padStart(2, '0') + '/' + m[2].padStart(2, '0') + '/' + m[3] : '';
  }
  function number(value) {
    const s = String(value || '').replace(/\s/g, '').replace(/[^\d,.-]/g, '');
    if (!s) return '';
    const normalized = s.includes(',') && s.includes('.')
      ? (s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''))
      : s.replace(',', '.');
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized) ? normalized : '';
  }
  function pageWidth(page) {
    if (Number(page && page.pageWidth) > 0) return Number(page.pageWidth);
    const maxX = Math.max(0, ...(page || []).map(x => Number(x.x || 0) + Number(x.w || 0)));
    return maxX ? maxX * 1.075 : 595;
  }
  const centerX = item => Number(item.x || 0) + Number(item.w || 0) / 2;
  const fallbackCenters = (width, ratios) => ratios.map(r => width * r);

  // PDF.js/OCR thường tách ký tự chỉ số dưới thành item riêng (U + o, R + 15).
  function headerGroups(line) {
    const items = line.items;
    const out = [];
    for (let i = 0; i < items.length; i++) {
      let text = '', last = null;
      for (let j = i; j < Math.min(items.length, i + 4); j++) {
        const item = items[j];
        if (last && Number(item.x || 0) - (Number(last.x || 0) + Number(last.w || 0)) > 7) break;
        text += item.str;
        out.push({ text, item: { x: items[i].x, w: Number(item.x || 0) + Number(item.w || 0) - Number(items[i].x || 0) } });
        last = item;
      }
    }
    return out;
  }
  function headerMatch(lines, from, to, keys) {
    const opts = Array.isArray(keys) ? keys : [keys];
    for (let n = Math.max(0, from || 0); n < Math.min(lines.length, to == null ? lines.length : to); n++) {
      for (const g of headerGroups(lines[n])) {
        const value = compact(g.text);
        if (opts.some(key => value === key || (key.length > 2 && (value.startsWith(key) || value.includes(key))))) return centerX(g.item);
      }
    }
    return null;
  }

  function headerCenters(lines, aliases, from, to, fallback) {
    return aliases.map((opts, index) => {
      return headerMatch(lines, from, to, opts) ?? fallback[index];
    });
  }
  function phaseCenters(lines, start, side, width, ocrLegacy) {
    const labels = side === 'hv' ? ['a', 'b', 'c'] : ['am', 'bm', 'cm', 'n'];
    const fallback = side === 'hv'
      ? fallbackCenters(width, ocrLegacy ? [0.420, 0.550, 0.680] : [0.385, 0.507, 0.630])
      : fallbackCenters(width, ocrLegacy ? [0.420, 0.540, 0.660, 0.780] : [0.370, 0.480, 0.590, 0.700]);
    const found = {};
    for (let i = Math.max(0, start - 1); i < Math.min(lines.length, start + 7); i++) {
      for (const item of lines[i].items) {
        const key = labels.find(x => compact(item.str) === x);
        if (key && found[key] == null) found[key] = centerX(item);
      }
      if (labels.every(x => found[x] != null)) break;
    }
    const out = labels.map((label, i) => found[label] == null ? fallback[i] : found[label]);
    const extras = side === 'hv' ? [0.750, 0.880] : [0.805, 0.895];
    const xy = headerCenters(lines, [['kv'], ['diagram']], Math.max(0, start - 1), Math.min(lines.length, start + 7), fallbackCenters(width, extras));
    return out.concat(xy);
  }
  function columnBounds(centers, index, width) {
    const x = centers[index];
    const before = index ? (centers[index - 1] + x) / 2 : x - (centers[1] - x) / 2;
    const after = index < centers.length - 1 ? (x + centers[index + 1]) / 2 : x + (x - centers[index - 1]) / 2;
    return [Math.max(0, before - 2), Math.min(width, after + 2)];
  }
  function cellItem(page, y, centers, index, tolerance) {
    const width = pageWidth(page), bounds = columnBounds(centers, index, width), target = centers[index];
    const candidates = (page || []).filter(item => Math.abs(Number(item.y || 0) - y) <= (tolerance || 10)
      && centerX(item) >= bounds[0] && centerX(item) <= bounds[1]);
    candidates.sort((a, b) => Math.abs(Number(a.y || 0) - y) - Math.abs(Number(b.y || 0) - y)
      || Math.abs(centerX(a) - target) - Math.abs(centerX(b) - target));
    return candidates[0] || null;
  }
  function cellNumber(page, y, centers, index) {
    const item = cellItem(page, y, centers, index, 10);
    return item ? number(item.str) : '';
  }
  function nearbyText(lines, y, centers, maxY) {
    return lines.filter(line => Math.abs(line.y - y) <= maxY)
      .sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))
      .map(line => leftText(line, centers)).filter(Boolean).join(' ');
  }
  function nearestCellNumber(page, y, centers, index, maxY) {
    const item = cellItem(page, y, centers, index, maxY || 16);
    return item ? number(item.str) : '';
  }
  function cellText(page, y, centers, index, tolerance) {
    const width = pageWidth(page), bounds = columnBounds(centers, index, width);
    return (page || []).filter(item => Math.abs(Number(item.y || 0) - y) <= (tolerance || 10)
      && centerX(item) >= bounds[0] && centerX(item) <= bounds[1])
      .sort((a, b) => Math.abs(Number(a.y || 0) - y) - Math.abs(Number(b.y || 0) - y))
      .map(item => String(item.str || '').trim()).filter(x => x && x !== '/').join(' ').trim();
  }
  function leftText(line, centers) {
    const left = centers[0] - Math.abs(centers[1] - centers[0]) / 2;
    return line.items.filter(item => centerX(item) < left).map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
  }
  function putNumber(v, key, value) {
    const n = number(value);
    if (!n || String(v[key] || '').trim()) return false;
    v[key] = n; return true;
  }
  function putMeasurementNumber(v, key, value, ocr) {
    const n = Number(number(value));
    if (!Number.isFinite(n)) return false;
    if (ocr) {
      if (/\.tgd[12]?(?:\.|$)|\.tgd(?:\.|$)/i.test(key) && (n < 0 || n > 10)) return false;
      if (/\.c[12](?:\.|$)/i.test(key) && (n < 0 || n > 10000)) return false;
      if (/^wtgd\..*\.c$/i.test(key) && (n < 0 || n > 200000)) return false;
      if (/^dcr\./i.test(key) && (n < 0 || n > 3000)) return false;
    }
    return putNumber(v, key, value);
  }
  function putText(v, key, value) {
    const s = String(value || '').replace(/\s+/g, ' ').trim();
    if (!s || s === '/' || String(v[key] || '').trim()) return false;
    v[key] = s; return true;
  }
  function terminalRow(value) {
    const s = fold(value).replace(/[()]/g, ' ');
    if (/^cao\s*\/\s*ha.*vo/.test(s)) return 'r0';
    if (/^ha\s*\/\s*cao.*vo/.test(s)) return 'r1';
    if (/^cao.*trung.*~\s*ha.*vo/.test(s)) return 'r0';
    if (/^ha.*~\s*cao.*trung.*vo/.test(s)) return 'r1';
    if (/^cao.*trung.*ha\s*~\s*vo/.test(s)) return 'r2';
    if (/^ha.*~\s*cao.*trung/.test(s)) return 'r3';
    if (/^cao.*trung.*~\s*vo/.test(s)) return 'r4';
    if (/^ha.*~\s*vo/.test(s)) return 'r5';
    return '';
  }
  function coreRow(value) {
    const s = compact(value);
    if (s.includes('loituvo') || s.includes('coreearth')) return 'r6';
    if (s.includes('gongtuvo') || s.includes('clampearth')) return 'r7';
    if (s.includes('loitugongtu') || s.includes('coreclamp')) return 'r8';
    return '';
  }
  // Đề mục "8. …" / "8.2 …": số mục rồi đến chữ — không nhầm với dòng số liệu như "8.25 0.2 8.257"
  const SEC8 = /^\s*8\s*\.(?!\s*\d)/;
  // mục con "8.2 …" hoặc "8.2. …" (có dấu chấm sau số); không khớp số liệu "8.25", "8.257"
  const SUB_HEAD = { 1: /^\s*[89]\s*\.\s*1\.?(?![\d,])\s*\D/, 2: /^\s*[89]\s*\.\s*2\.?(?![\d,])\s*\D/, 3: /^\s*[89]\s*\.\s*3\.?(?![\d,])\s*\D/ };
  const subHead = (f, n) => SUB_HEAD[n].test(f);
  function parseTemperature(value) {
    const text = String(value || '');
    const m = text.match(/(?:nhiệt\s*độ|temperature)[^0-9+-]*([+-]?\d+(?:[.,]\d+)?)/i)
      || text.match(/(?:t|temp(?:erature)?\.?)\s*=?\s*([+-]?\d+(?:[.,]\d+)?)/i);
    return m ? number(m[1]) : '';
  }

  function parseIR(linesByPage, v, opts) {
    opts = opts || {};
    let active = false, corrected = false, centers = null, legacyOcr = false, r0AnchorY = null;
    const fallback = fallbackCenters(595, [0.400, 0.495, 0.590, 0.685, 0.777, 0.900]);
    linesByPage.forEach((lines, pageIndex) => {
      const page = linesByPage.pages[pageIndex];
      lines.forEach((line, i) => {
        const f = fold(line.text), c = compact(line.text);
        if (c.includes('dienrocachdien') || c.includes('insulationresistance')) { active = true; corrected = false; centers = null; legacyOcr = false; r0AnchorY = null; }
        if (!active) return;
        if (c.includes('vectorgroup') || /^4\s*todau day/.test(f)) { active = false; return; }
        if (c.includes('quydoive20') || c.includes('correctedto20')) corrected = true;
        if (c.includes('temperature') || f.includes('do o nhiet do')) {
          const t = parseTemperature(line.text);
          if (t) putNumber(v, 'ir.t', t);
        }
        if (c.includes('k1')) {
          const m = line.text.match(/k1\s*=\s*([+-]?\d+(?:[.,]\d+)?)/i);
          if (m) putNumber(v, 'ir.k1', m[1]);
        }
        if (opts.ocr && c.includes('dcvoltage') && !line.items.some(item => compact(item.str).startsWith('r15'))) {
          legacyOcr = true;
          centers = fallbackCenters(pageWidth(page), [0.425, 0.560, 0.700, 0.840]);
        } else if (headerMatch(lines, i, Math.min(lines.length, i + 3), ['r15']) != null
          && headerMatch(lines, i, Math.min(lines.length, i + 3), ['r60']) != null) {
          centers = headerCenters(lines, ['r15', 'r60', 'r600', 'kht', 'pi', 'dcvoltage'], i, Math.min(lines.length, i + 8), fallback);
        }
        if (corrected || !centers) return;
        const label = nearbyText(lines, line.y, centers, 12);
        let row = terminalRow(label) || coreRow(label);
        if (opts.ocr && legacyOcr) {
          if (row === 'r0') r0AnchorY = line.y;
          const first = nearestCellNumber(page, line.y, centers, 0, 16), second = nearestCellNumber(page, line.y, centers, 1, 16);
          const voltage = nearestCellNumber(page, line.y, centers, 3, 16);
          if (!row && r0AnchorY != null && r0AnchorY - line.y >= 25 && first && second) row = 'r1';
          if (!row || (!first && !second && !voltage)) return;
          putMeasurementNumber(v, 'ir.meas.' + row + '.r15', first, true);
          putMeasurementNumber(v, 'ir.meas.' + row + '.r60', second, true);
          putMeasurementNumber(v, 'ir.meas.' + row + '.u', voltage, true);
          return;
        }
        if (!row) return;
        ['r15', 'r60', 'r600'].forEach((col, index) => {
          if ((row === 'r6' || row === 'r7' || row === 'r8') && col !== 'r60') return;
          putNumber(v, 'ir.meas.' + row + '.' + col, nearestCellNumber(page, line.y, centers, index, 16));
        });
        putNumber(v, 'ir.meas.' + row + '.u', nearestCellNumber(page, line.y, centers, 5, 16));
      });
    });
  }

  function phaseHeaderIndex(lines, start) {
    for (let i = Math.max(0, start); i < Math.min(lines.length, start + 5); i++) {
      if (lines[i].items.some(item => ['pha', 'phase'].includes(compact(item.str)))) return i;
    }
    return -1;
  }
  // Nhãn cột sứ trên tiêu đề "Pha (Phase) | A | B | C | Điện áp đo…" → khóa cột của biểu mẫu.
  // BBTN cũ theo pha xóa bớt cột (chỉ "A"; "Am | N"; hạ áp "3.1 | 3.2"). perUnit: mẫu theo pha (cột hạ áp a = sứ thứ nhất, b = thứ hai).
  const BUSH_LABEL = /^(?:[abc]m?|n|\d\.\d|lv\d|hv\d?|mv\d?|x|y|z)$/i;
  // Một mục chữ của PDF có thể gồm nhiều từ ("A (kV)") → tách từng từ, vị trí ước theo số ký tự
  function splitWords(items) {
    const out = [];
    items.forEach(item => {
      const s = String(item.str || ''), w = Number(item.w || 0), x0 = Number(item.x || 0);
      const parts = s.split(/(\s+)/);
      if (parts.filter(p => p.trim()).length < 2 || !s.length) { out.push(item); return; }
      let pos = 0;
      parts.forEach(p => {
        if (p.trim()) out.push(Object.assign({}, item, { str: p, x: x0 + w * pos / s.length, w: w * p.length / s.length }));
        pos += p.length;
      });
    });
    return out;
  }
  function bushingHeaderCols(lines, h, side, perUnit, unitPhase) {
    const items = [];
    let stopX = Infinity;
    for (let n = h; n < Math.min(lines.length, h + 3); n++) {
      splitWords(lines[n].items).forEach(item => {
        const c = compact(item.str);
        if ((c.startsWith('dienapdo') || c === 'kv' || c.startsWith('testvoltage')) && centerX(item) < stopX) stopX = centerX(item);
      });
    }
    for (let n = h; n < Math.min(lines.length, h + 3); n++) {
      splitWords(lines[n].items).forEach(item => {
        const s = String(item.str || '').trim();
        if (BUSH_LABEL.test(s) && centerX(item) < stopX && !items.some(x => Math.abs(centerX(x.item) - centerX(item)) < 8)) items.push({ s, item });
      });
    }
    items.sort((a, b) => centerX(a.item) - centerX(b.item));
    if (!items.length) return null;
    const used = new Set();
    const cols = items.map((x, i) => {
      const L = x.s, l = L.toLowerCase();
      let key = '';
      if (side === 'hv') key = /^[abc]$/.test(l) ? l.toUpperCase() : (perUnit && unitPhase && items.length === 1 ? unitPhase : ['A', 'B', 'C'][i]);
      else if (side === 'mv') key = l === 'n' ? 'N' : /^[abc]m$/.test(l) ? l[0].toUpperCase() : (perUnit && unitPhase && i === 0 ? unitPhase : ['A', 'B', 'C', 'N'][i]);
      else key = perUnit ? ['a', 'b', 'c'][i] : (/^[abc]$/.test(l) ? l : ['a', 'b', 'c'][i]);
      if (!key || used.has(key)) return null;
      used.add(key);
      return { key, label: L, x: centerX(x.item) };
    }).filter(Boolean);
    return cols.length ? cols : null;
  }
  function parseBushings(linesByPage, v, opts) {
    opts = opts || {};
    const hdr = opts.hdr || {};
    let ctx = null, legacyTemp = '';
    linesByPage.forEach((lines, pageIndex) => {
      const page = linesByPage.pages[pageIndex], width = pageWidth(page);
      lines.forEach((line, i) => {
        const f = fold(line.text), c = compact(line.text);
        if (opts.ocr && ctx && ctx.legacy && (c.includes('cuonday') || c.includes('windings') || c.includes('windingresistance'))) { ctx = null; return; }
        if ((c.includes('5.1') || c.startsWith('51')) && c.includes('caoap')) ctx = { side: 'hv', raw: true, centers: null, tgRows: 0 };
        else if ((c.includes('5.2') || c.startsWith('52')) && (c.includes('trungap') || c.includes('neutral'))) ctx = { side: 'mv', raw: true, centers: null, tgRows: 0 };
        else if ((c.includes('5.3') || c.startsWith('53')) && (c.includes('haap') || c.includes('lvbushings'))) ctx = { side: 'lv', raw: true, centers: null, tgRows: 0 };
        else if (ctx && !ctx.legacy && (/^5\.4/.test(f) || c.startsWith('54') || c.includes('achighvoltagetesting') && !c.includes('bushings'))) ctx = null;
        else if (opts.ocr && c.includes('220kv') && c.includes('bushings')) ctx = { side: 'hv', raw: true, centers: null, tgRows: 0, legacy: true };
        else if (opts.ocr && c.includes('110kv') && c.includes('bushings')) ctx = { side: 'mv', raw: true, centers: null, tgRows: 0, legacy: true };
        if (opts.ocr && c.includes('sudauvao')) {
          legacyTemp = parseTemperature(line.text);
          if (legacyTemp) { putNumber(v, 'b.hv.t', legacyTemp); putNumber(v, 'b.mv.t', legacyTemp); }
        }
        if (!ctx) return;
        const prefix = 'b.' + ctx.side + '.';
        if (ctx.legacy && legacyTemp) putNumber(v, prefix + 't', legacyTemp);
        if (c.includes('quydoive20') || c.includes('correctedto20')) ctx.raw = false;
        if (f.includes('su phia') || f.includes('bushings')) {
          const t = parseTemperature(line.text);
          if (t) putNumber(v, prefix + 't', t);
        }
        if (c.includes('loaisu')) {
          const type = line.text.match(/loại\s*sứ\s*:\s*([a-z]+)/i);
          const k = line.text.match(/\bK\s*=\s*([+-]?\d+(?:[.,]\d+)?)/i);
          if (type) putText(v, prefix + 'btype', type[1].toUpperCase());
          if (k) putNumber(v, prefix + 'k', k[1]);
        }
        if (!ctx.raw) return;
        const h = phaseHeaderIndex(lines, i);
        if (h >= 0 && !ctx.centers) {
          // cột theo nhãn tiêu đề (bảng đã xóa bớt cột); không nhận ra thì vị trí cố định của mẫu
          const hc = !(opts.ocr && ctx.legacy) && bushingHeaderCols(lines, h, ctx.side, opts.perUnit, opts.unitPhase);
          if (hc) {
            const xy = headerCenters(lines, [['kv'], ['diagram']], Math.max(0, h - 1), Math.min(lines.length, h + 7),
              fallbackCenters(width, [0.805, 0.895]));
            ctx.centers = hc.map(x => x.x).concat(xy);
            ctx.keys = hc.map(x => x.key);
            hc.forEach(x => { hdr[`b.${ctx.side}.meas.${x.key}`] = x.label; });
          } else if (ctx.side !== 'lv') ctx.centers = phaseCenters(lines, h, ctx.side, width, Boolean(opts.ocr && ctx.legacy));
        }
        if (!ctx.centers) return;
        // cột theo nhãn: vùng nhãn hàng kết thúc ngay trước cột số đầu (bảng chỉ còn cột "A" sát nhãn hàng)
        const label = compact(ctx.keys
          ? line.items.filter(item => centerX(item) < ctx.centers[0] - 28).map(item => item.str).join(' ')
          : leftText(line, ctx.centers));
        const phases = ctx.keys || (ctx.side === 'hv' ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'N']);
        let row = '';
        if (label.includes('kieuloai') || label.includes('type')) row = 'type';
        else if (label.includes('hangsanxuat') || label.includes('manufacturer')) row = 'manuf';
        else if (label.includes('sochtao') || label.includes('serial')) row = 'serial';
        else if (label.includes('c1')) row = 'c1';
        else if (label.includes('c2')) row = 'c2';
        else if (label.includes('rcd')) row = ctx.tgRows <= 1 ? 'r1' : 'r2';
        else if (label.includes('tgdelta') || (label.includes('tg') && label.includes('percent')) || (opts.ocr && ctx.legacy && /tg[o0]/.test(label))) row = ctx.tgRows++ === 0 ? 'tgd1' : 'tgd2';
        if (!row && opts.ocr && ctx.legacy) {
          const values = phases.slice(0, 3).map((_, index) => Number(cellNumber(page, line.y, ctx.centers, index))).filter(Number.isFinite);
          if (values.some(value => value >= 100 && value <= 10000)) row = 'c1';
          else if (values.some(value => value > 0 && value <= 2)) row = 'tgd1';
        }
        if (!row) return;
        if (opts.ocr && ctx.legacy && ['type', 'manuf', 'serial'].includes(row)) return;
        // cột theo nhãn: thêm một cột ảo bên trái để vùng cột đầu không lấn vào nhãn hàng
        const off = ctx.keys ? 1 : 0, CC = ctx.keys ? [ctx.centers[0] - 56].concat(ctx.centers) : ctx.centers;
        phases.forEach((phase, index) => {
          const key = prefix + 'meas.' + row + '.' + phase;
          const value = ['type', 'manuf', 'serial'].includes(row) ? cellText(page, line.y, CC, index + off, 13) : cellNumber(page, line.y, CC, index + off);
          // kiểu sứ ngắt dòng sau gạch nối ("ETA-550/1600-" + "4") → ghép lại
          if (['type', 'manuf', 'serial'].includes(row)) putText(v, key, row === 'type' ? String(value || '').replace(/-\s+(?=\S)/g, '-') : value);
          else putMeasurementNumber(v, key, value, Boolean(opts.ocr));
        });
        if (row === 'tgd1' || row === 'tgd2') {
          putMeasurementNumber(v, prefix + 'meas.' + row + '.u', cellNumber(page, line.y, CC, phases.length + off), Boolean(opts.ocr));
          if (!(opts.ocr && ctx.legacy)) putText(v, prefix + 'meas.' + row + '.d', cellText(page, line.y, CC, phases.length + 1 + off));
        }
      });
    });
  }

  function parseWindingTgd(linesByPage, v, schema) {
    let active = false, corrected = false, centers = null, headerY = null, headerPage = -1;
    const grid = Common.findGrid(schema, 'wtgd.meas');
    if (!grid) return;
    const fallback = fallbackCenters(595, [0.505, 0.630, 0.755, 0.880]);
    const aliases = [['tgdelta', 'tg'], ['cpf', 'capacitance'], ['testvoltage', 'kv'], ['diagram']];
    const anchors = [];
    const headerCenter = (source, from, to, keys) => {
      const options = Array.isArray(keys) ? keys : [keys];
      for (let n = Math.max(0, from); n < Math.min(source.length, to); n++) {
        for (const group of headerGroups(source[n])) {
          const value = compact(group.text);
          if (options.some(key => value === key || value.startsWith(key))) return centerX(group.item);
        }
      }
      return null;
    };
    const rowForLabel = label => {
      const code = terminalRow(label);
      return code ? grid.rows.find(row => terminalRow(row.label) === code) || null : null;
    };
    linesByPage.forEach((lines, pageIndex) => {
      const page = linesByPage.pages[pageIndex];
      lines.forEach((line, i) => {
        const f = fold(line.text), c = compact(line.text);
        if (c.includes('trisotgdelta') && c.includes('cuonday')) {
          active = true; corrected = false; centers = null; headerY = null; headerPage = -1; anchors.length = 0;
        }
        if (!active) return;
        if (c.includes('quydoive20') || c.includes('correctedto20')) { corrected = true; centers = null; return; }
        if (c.includes('dienromotchieu') || c.includes('windingresistance')) { active = false; return; }
        if (f.includes('do o nhiet do') || f.includes('measure at temperature')) {
          const t = parseTemperature(line.text);
          if (t) putNumber(v, 'wtgd.t', t);
        }
        if (c.includes('k2')) {
          const m = line.text.match(/k2\s*=\s*([+-]?\d+(?:[.,]\d+)?)/i);
          if (m) putNumber(v, 'wtgd.k2', m[1]);
        }
        if (!centers) {
          const cHeader = headerCenter(lines, i, i + 1, aliases[1]);
          const start = Math.max(0, i - 2), end = Math.min(lines.length, i + 10);
          const found = cHeader == null ? [] : aliases.map(keys => headerCenter(lines, start, end, keys));
          if (cHeader != null && found.length === aliases.length && found.every(x => x != null)) {
            centers = found;
            const inHeader = lines.slice(i, Math.min(lines.length, i + 10)).filter(candidate =>
              aliases.some(keys => headerCenter([candidate], 0, 1, keys) != null));
            headerY = inHeader.length ? Math.min(...inHeader.map(x => x.y)) : line.y;
            headerPage = pageIndex;
          }
        }
        if (corrected || !centers || (pageIndex === headerPage && line.y >= headerY - 2)) return;

        const labelRow = rowForLabel(leftText(line, centers));
        if (labelRow) anchors.push({ key: labelRow.k, y: line.y, pageIndex });
        const values = centers.slice(0, 3).map((_, index) => nearestCellNumber(page, line.y, centers, index, 12));
        if (!values.some(value => value && Number.isFinite(Number(value)))) return;
        const anchor = anchors.filter(item => item.pageIndex <= pageIndex && pageIndex - item.pageIndex <= 1
          && item.y >= line.y - 2 && item.y - line.y <= 40)
          .sort((a, b) => (a.y - line.y) - (b.y - line.y))[0];
        if (!anchor) return;
        const prefix = grid.id + '.' + anchor.key + '.';
        ['tgd', 'c', 'u'].forEach((col, index) => putNumber(v, prefix + col, values[index]));
        putText(v, prefix + 'd', cellText(page, line.y, centers, 3, 12));
      });
    });
  }

  function parseNoLoad(linesByPage, v) {
    let active = '', centers = null;
    const fallback = fallbackCenters(595, [0.400, 0.550, 0.690, 0.850]);
    linesByPage.forEach((lines, pageIndex) => {
      const page = linesByPage.pages[pageIndex], width = pageWidth(page);
      lines.forEach((line, i) => {
        const f = fold(line.text), c = compact(line.text);
        if (/2\.1/.test(f) && (c.includes('dienapthap') || c.includes('lowvoltage'))) { active = 'nl.lv'; centers = null; }
        if (/2\.2/.test(f) && (c.includes('dienapthap') || c.includes('lowvoltage'))) { active = 'nl.hv'; centers = null; }
        if (/2\.3/.test(f) || c.includes('dienrocachdien') || c.includes('insulationresistance')) { active = ''; centers = null; }
        if (!active) return;
        if (headerMatch(lines, i, Math.min(lines.length, i + 3), ['uo']) != null
          && headerMatch(lines, i, Math.min(lines.length, i + 3), ['io']) != null) {
          centers = headerCenters(lines, ['uo', 'io', 'po', 'short'], i, Math.min(lines.length, i + 8), fallback);
        }
        if (!centers) return;
        const match = leftText(line, centers).match(/^\s*(AB|BC|CA)\s*$/i);
        if (!match) return;
        const phase = active === 'nl.lv' ? match[1].toLowerCase() : match[1].toUpperCase();
        ['u', 'i', 'p'].forEach((col, index) => putNumber(v, active + '.' + phase + '.' + col, cellNumber(page, line.y, centers, index)));
        putText(v, active + '.' + phase + '.s', cellText(page, line.y, centers, 3));
      });
    });
  }

  function dcrAliases() {
    return {
      mv: ['amn', 'bmn', 'cmn'],
      hv: [['an', 'ao', 'aam'], ['bn', 'bo', 'bbm'], ['cn', 'co', 'ccm']],
      lv: [['ab', 'a1a2'], ['bc', 'b1b2'], ['ca', 'c1c2']],
    };
  }
  function dcrHeaderCenters(lines, side, from, to) {
    const aliases = dcrAliases()[side].map(x => Array.isArray(x) ? x : [x]);
    return aliases.map(options => {
      for (let i = Math.max(0, from || 0); i < Math.min(lines.length, to == null ? lines.length : to); i++) {
        for (const group of headerGroups(lines[i])) {
          const value = compact(group.text);
          if (options.some(key => value === key || (!value.startsWith('delta') && value.startsWith(key)))) return centerX(group.item);
        }
      }
      return null;
    });
  }
  function schemaRowForTap(schema, gridId, tap) {
    const grid = Common.findGrid(schema, gridId);
    if (!grid || !grid.rows || !grid.rows.length) return '';
    if (grid.rows.length === 1) return grid.rows[0].k;
    const wanted = String(tap);
    // nhãn nấc trước (mẫu theo pha: hàng t12 là nấc "10"), số trong khóa hàng sau cùng
    const row = grid.rows.find(item => String(item.tap || '').toLowerCase() === wanted.toLowerCase())
      || grid.rows.find(item => String(item.tap || '').replace(/\D/g, '') === wanted)
      || grid.rows.find(item => String(item.label || '').match(/\d+/)?.[0] === wanted)
      || grid.rows.find(item => !item.tap && String(item.k || '').match(/\d+/)?.[0] === wanted);
    return row ? row.k : '';
  }
  function voltageTokens(value) {
    return (String(value || '').match(/\d+(?:[.,]\d+)?/g) || []).map(x => Number(x.replace(',', '.'))).filter(Number.isFinite);
  }
  function dcrVoltage(line) {
    const match = String(line || '').match(/(\d+(?:[.,]\d+)?)\s*k\s*v/i);
    return match ? Number(match[1].replace(',', '.')) : null;
  }
  function nearestVoltageRank(value, levels) {
    const unique = [...new Set(levels.filter(Number.isFinite))].sort((a, b) => b - a);
    if (unique.length < 2) return '';
    let nearest = 0;
    unique.forEach((v, i) => {
      if (Math.abs(Math.log(value / v)) < Math.abs(Math.log(value / unique[nearest]))) nearest = i;
    });
    if (nearest === 0) return 'HV';
    if (nearest === unique.length - 1 && unique.length > 2) return 'LV';
    return 'MV';
  }
  function detectDcrWinding(linesByPage, ratedVoltage) {
    let active = false, current = null;
    const blocks = [];
    linesByPage.forEach(lines => lines.forEach((line, i) => {
      const f = fold(line.text), c = compact(line.text);
      if (/^\s*7\s*\./.test(f) && (c.includes('dienromotchieu') || c.includes('windingresistance'))) active = true;
      if (!active) return;
      if (SEC8.test(f) || c.includes('tysobien') || c.includes('voltageratio')) { active = false; current = null; return; }
      if (/^\s*7\.\d/.test(f)) {
        current = { heading: f, lines: [], voltage: null, tapped: false, columnSide: '' };
        blocks.push(current);
      }
      if (!current) return;
      current.lines.push(line.text);
      const voltage = dcrVoltage(line.text);
      if (voltage != null) current.voltage = voltage;
      if (!c.includes('nac') && !c.includes('tap')) return;
      const nearby = lines.slice(i, Math.min(lines.length, i + 4));
      const has = side => dcrHeaderCenters(nearby, side, 0, nearby.length).every(x => x != null);
      const columnSide = has('mv') ? 'MV' : has('hv') ? 'HV' : '';
      if (columnSide) { current.tapped = true; current.columnSide = columnSide; }
    }));

    const tapped = blocks.find(block => block.tapped);
    if (!tapped) return { winding: '', conflict: false, tappedHeading: '', warning: '' };
    const vi = tapped.heading;
    const vn = /trung\s*(?:the|ap)/.test(vi) ? 'MV' : /cao\s*(?:the|ap)/.test(vi) ? 'HV' : '';
    const en = /m\.?\s*v\.?\s*winding/.test(vi) ? 'MV' : /h\.?\s*v\.?\s*winding/.test(vi) ? 'HV' : '';
    const rated = voltageTokens(ratedVoltage);
    const subheadings = blocks.map(block => block.voltage).filter(Number.isFinite);
    let byVoltage = '';
    if (tapped.voltage != null) {
      const occurrences = subheadings.filter(x => Math.abs(x - tapped.voltage) / tapped.voltage < 0.03).length;
      if (new Set(subheadings).size > 1 && occurrences === 1) byVoltage = nearestVoltageRank(tapped.voltage, subheadings);
      if (!byVoltage) byVoltage = nearestVoltageRank(tapped.voltage, rated);
      if (!byVoltage && rated.length && tapped.voltage < Math.max(...rated)) byVoltage = 'MV';
    }
    const winding = byVoltage || vn || en || tapped.columnSide || '';
    const disagreement = [vn, en, tapped.columnSide].filter(Boolean).some(side => side !== winding);
    let warning = '';
    if (disagreement) {
      const vnText = vn ? (vn === 'MV' ? 'trung áp/trung thế' : 'cao áp/cao thế') : 'không ghi rõ phía';
      const voltageText = tapped.voltage == null ? '' : ` và ${String(tapped.voltage).replace('.', ',')} kV`;
      // nhãn tiếng Anh và tên cột cùng một phía thì chỉ ghi một lần
      const labels = [...new Set([en, tapped.columnSide].filter(Boolean))].map(side => side === 'MV' ? 'M.V/AmN' : 'H.V/AN').join(', ');
      warning = `Đề mục ghi '${vnText}'${voltageText} nhưng nhãn tiếng Anh/cột ghi ${labels} — đã nhận là cuộn ${winding === 'MV' ? 'trung áp' : 'cao áp'}; kiểm tra lại.`;
    }
    return { winding, conflict: disagreement, tappedHeading: tapped.heading, warning };
  }
  function parseDcr(linesByPage, v, warnings, schema, windingInfo) {
    let active = false, side = '', centers = null, headerY = null, headerPage = -1, seen75 = false;
    const aliases = dcrAliases();
    linesByPage.forEach((lines, pageIndex) => {
      const page = linesByPage.pages[pageIndex];
      lines.forEach((line, i) => {
        const f = fold(line.text), c = compact(line.text);
        if (/^\s*7\s*\./.test(f) && (c.includes('dienromotchieu') || c.includes('windingresistance'))) {
          active = true; side = ''; centers = null; headerY = null; headerPage = -1;
        }
        if (!active) return;
        if (SEC8.test(f) || c.includes('tysobien') || c.includes('voltageratio') || c.includes('onloadtap')) {
          active = false; side = ''; centers = null; headerY = null; headerPage = -1; return;
        }
        const nextSide = c.includes('mvwinding') || (c.includes('cuondaytrungthe') && !c.includes('hvwinding')) ? 'mv'
          : c.includes('hvwinding') || c.includes('cuondaycaothe') ? 'hv'
            : c.includes('cuondayhath') || c.includes('lvwinding') ? 'lv' : '';
        if (nextSide) {
          side = fold(line.text) === windingInfo.tappedHeading && windingInfo.winding ? windingInfo.winding.toLowerCase() : nextSide;
          centers = null; headerY = null; headerPage = -1;
        }
        if (!side) return;

        // Chỉ ghi nhiệt độ được in kèm phía đo; không lấy con số ở dòng này làm trị số đo.
        if ((f.includes('nhiet do') || f.includes('temperature')) && /\bt\s*=/.test(f)) {
          const t = parseTemperature(line.text);
          if (t) {
            putNumber(v, 'dcr.' + side + '.t', t);
            if (Number(t) === 75) seen75 = true;
          }
        }

        let cols = aliases[side];
        if (!centers) {
          let found;
          if (side === 'lv') {
            const labels = ['ab', 'bc', 'ca'];
            found = labels.map(label => {
              for (let n = i; n < Math.min(lines.length, i + 4); n++) {
                const item = lines[n].items.find(x => fold(x.str).replace(/\s+/g, '') === 'pha' + label);
                if (item) return centerX(item);
              }
              return null;
            });
            // BBTN máy 1 pha: "a1-a2 | b1-b2 | c1-c2"
            if (found.some(x => x == null)) {
              const alt = ['a1a2', 'b1b2', 'c1c2'].map(label => {
                for (let n = i; n < Math.min(lines.length, i + 4); n++) {
                  const item = lines[n].items.find(x => compact(x.str) === label);
                  if (item) return centerX(item);
                }
                return null;
              });
              if (alt.every(x => x != null)) found = alt;
            }
          } else found = dcrHeaderCenters(lines, side, i, Math.min(lines.length, i + 4));
          if (found.some(x => x == null) && (c.includes('nac') || c.includes('tap'))) {
            const hv = dcrHeaderCenters(lines, 'hv', i, Math.min(lines.length, i + 4));
            const mv = dcrHeaderCenters(lines, 'mv', i, Math.min(lines.length, i + 4));
            if (hv.every(x => x != null)) { cols = aliases.hv; found = hv; }
            else if (mv.every(x => x != null)) { cols = aliases.mv; found = mv; }
          }
          if (found.every(x => x != null)) {
            centers = found;
            const header = side === 'lv'
              ? lines.slice(i, Math.min(lines.length, i + 4)).find(candidate =>
                ['ab', 'bc', 'ca'].every(label => candidate.items.some(x => fold(x.str).replace(/\s+/g, '') === 'pha' + label))
                || ['a1a2', 'b1b2', 'c1c2'].every(label => candidate.items.some(x => compact(x.str) === label)))
              : lines.slice(i, Math.min(lines.length, i + 4)).find(candidate =>
                dcrHeaderCenters([candidate], side, 0, 1).every(x => x != null));
            headerY = header ? header.y : line.y;
            headerPage = pageIndex;
            return;
          }
        }
        if (!centers || (pageIndex === headerPage && line.y >= headerY - 2)) return;
        // Chỉ nhận hàng số liệu bên dưới tiêu đề, trong cùng tiểu mục và loại bỏ nhiệt độ/điện áp/quy đổi.
        if (/nhiet\s*do|temperature|\bkv\b|quy\s*doi|corrected|%/.test(f)) return;
        let tap = null;
        if (side === 'mv' || side === 'hv') {
          const first = centers[0];
          const tapItem = line.items.find(item => centerX(item) < first - 20 && /^\d{1,2}$/.test(String(item.str || '').trim()));
          // cuộn trung áp có nấc (OLTC ở trung áp): bỏ hàng không có số nấc; một hàng (mẫu theo pha) thì nhận
          const gridRows = (Common.findGrid(schema, 'dcr.' + side) || { rows: [] }).rows.length;
          if (!tapItem && side === 'mv' && gridRows > 1) return;
          if (tapItem) {
            tap = Number(tapItem.str);
            if (tap < 1 || tap > 19) return;
          }
        }
        const values = centers.map((_, index) => cellNumber(page, line.y, centers, index));
        if (!values.every(value => value && Number.isFinite(Number(value)))) return;
        const gridId = 'dcr.' + side;
        const grid = Common.findGrid(schema, gridId);
        const row = tap == null
          ? schemaRowForTap(schema, gridId, grid && grid.rows.length === 1 ? 0 : 1)
          : schemaRowForTap(schema, gridId, tap);
        if (!row) return;
        const phaseCols = (grid.cols || []).filter(col => col.phase && !col.calc && !col.auto).slice(0, 3);
        phaseCols.forEach((col, index) => putMeasurementNumber(v, `dcr.${side}.${row}.${col.k}`, values[index], false));
      });
    });
    if (seen75) warnings.push('R một chiều trong PDF ghi ở 75 °C — kiểm tra đây là giá trị đo hay đã quy đổi');
  }

  function parseRatio(linesByPage, v, schema) {
    let side = '', centers = null, headerY = null, headerPage = -1;
    const ratioCols = {
      hm: [['uabuambm'], ['ubcubmcm'], ['ucaucmam']],
      hl: [['uabuab'], ['ubcubc'], ['ucauca']],
      ml: [['uambmuab'], ['ubmcmubc'], ['ucmamuca']],
    };
    const fallback = fallbackCenters(595, [0.37, 0.55, 0.73]);
    linesByPage.forEach((lines, pageIndex) => {
      const page = linesByPage.pages[pageIndex], width = pageWidth(page);
      lines.forEach((line, i) => {
        const f = fold(line.text), c = compact(line.text);
        if (subHead(f, 1) || c.includes('hv:mv')) { side = 'hm'; centers = null; headerY = null; headerPage = -1; }
        else if (subHead(f, 2) || c.includes('hv:lv')) { side = 'hl'; centers = null; headerY = null; headerPage = -1; }
        else if (subHead(f, 3) || c.includes('mv:lv')) { side = 'ml'; centers = null; headerY = null; headerPage = -1; }
        if (!side) return;
        if (c.includes('onloadtap') || c.includes('oltc') || c.includes('bo dieu ap duoi tai')) { side = ''; centers = null; return; }
        const aliases = ratioCols[side];
        const found = aliases.map(keys => headerMatch(lines, i, Math.min(lines.length, i + 3), keys));
        if (found.every(x => x != null)) { centers = found; headerY = line.y; headerPage = pageIndex; }
        else if (!centers && (c.includes('nac') || c.includes('tap'))) {
          const detected = headerCenters(lines, aliases, i, Math.min(lines.length, i + 10), fallback);
          if (detected.some((x, j) => x !== fallback[j])) centers = detected;
        }
        if (!centers || (pageIndex === headerPage && line.y >= headerY - 2)) return;
        const tapText = line.items.filter(item => centerX(item) < (centers[0] + width * 0.20) / 2).map(item => item.str).join(' ').trim();
        const match = tapText.match(/^\s*(\d{1,2})\s*$/);
        const gridId = 'ratio.' + side, grid = Common.findGrid(schema, gridId);
        const tap = match ? Number(match[1]) : null;
        if (tap != null && (tap < 1 || tap > 19)) return;
        if (tap == null && (!grid || grid.rows.length !== 1)) return;
        const row = schemaRowForTap(schema, gridId, tap == null ? 0 : tap);
        if (!row) return;
        const phaseCols = (grid.cols || []).filter(col => col.phase && !col.calc && !col.auto).slice(0, 3);
        phaseCols.forEach((col, index) => putNumber(v, 'ratio.' + side + '.' + row + '.' + col.k,
          nearestCellNumber(page, line.y, centers, index, 12)));
      });
    });
  }

  function parseBctInsulation(linesByPage, v, out) {
    out = out || {};
    let side = '', cores = 4, active = false, centers = null, phasesAt = null;
    linesByPage.forEach((lines, pageIndex) => {
      const page = linesByPage.pages[pageIndex];
      lines.forEach(line => {
        const f = fold(line.text), c = compact(line.text);
        if (c.includes('bushingtypecurrenttransformertesting')) { active = true; side = ''; centers = null; }
        if (!active) return;
        if (c.includes('excitationcurve') || c.includes('verificationofterminal') || /11\.5|11\.6/.test(f)) { active = false; return; }
        if (/11\.2\.1/.test(f) || c.includes('hv') && c.includes('caoap')) { side = 'hv'; cores = 4; centers = null; phasesAt = null; }
        else if (/11\.2\.2/.test(f) || c.includes('mvandneutral')) { side = 'mv'; cores = 4; centers = null; phasesAt = null; }
        else if (/11\.2\.3/.test(f) || c.includes('lv') && c.includes('hath')) { side = 'lv'; cores = 4; centers = null; phasesAt = null; }
        if (!side) return;
        const count = f.match(/co\s*(?:≤\s*)?(4|5|6)\s*cuon/);
        if (count) cores = Number(count[1]);
        // tiêu đề cột "Pha A | Pha B | …" hoặc chỉ "Pha A" (BBTN theo pha), có thể kèm "N" / "Pha N"
        const phaseItems = line.items.filter(item => /^(?:pha\s*)?(a|b|c|n)(?:\s*\((?:phase|neutral)[^)]*\))?$/i.test(fold(item.str))
          && (/^pha/i.test(fold(item.str)) || line.items.some(x => /^pha\s*[abc]/i.test(fold(x.str)))));
        if (phaseItems.length && line.items.some(x => /^pha\s*[abcn]/i.test(fold(x.str)))) {
          const keyOf = s => { const m = fold(s).match(/(?:pha\s*)?([abcn])/i); const k = m ? m[1].toUpperCase() : ''; return k === 'N' ? 'N' : side === 'lv' ? k.toLowerCase() : k; };
          const keys = phaseItems.map(x => keyOf(x.str));
          if (keys.every(Boolean) && new Set(keys).size === keys.length) { centers = phaseItems.map(centerX); phasesAt = keys; }
        }
        if (!centers) return;
        const left = line.items.filter(item => centerX(item) < centers[0] - 30).map(item => item.str).join(' ');
        const rowMatch = left.match(/(?:thứ\s*cấp|winding)\s*(\d+)/i);
        if (!rowMatch || Number(rowMatch[1]) > cores) return;
        const row = 'w' + rowMatch[1];
        const phases = phasesAt || (side === 'lv' ? ['a', 'b', 'c'] : side === 'mv' && centers.length === 4 ? ['A', 'B', 'C', 'N'] : ['A', 'B', 'C']);
        const singleCol = centers.length === 1 ? [centers[0], centers[0] + 120] : centers;
        let got = false;
        // chỉ nhận ô là số (nhãn hàng "(TC 2, 3, 4 + Vỏ)" có thể lấn sang vùng cột đầu)
        const numAt = index => {
          const width = pageWidth(page), bounds = columnBounds(singleCol, index, width);
          const hit = (page || []).filter(item => Math.abs(Number(item.y || 0) - line.y) <= 18 && centerX(item) >= bounds[0] && centerX(item) <= bounds[1] && number(item.str) !== '')
            .sort((a, b) => Math.abs(Number(a.y || 0) - line.y) - Math.abs(Number(b.y || 0) - line.y))[0];
          return hit ? number(hit.str) : '';
        };
        phases.forEach((phase, index) => { if (putNumber(v, `bct.${side}.ir.${row}.${phase}`, numAt(index))) got = true; });
        // số cuộn thứ cấp của bảng có số liệu → cấu hình biến dòng của phía
        if (got) out[side] = Math.max(out[side] || 0, cores);
      });
    });
  }

  function parseCoverResults(linesByPage, v) {
    const cover = (linesByPage[0] || []).map(x => x.text).join(' ');
    const vector = cover.match(/(?:tổ\s*đấu\s*dây\s*\(vector\s*group\)|vector\s*group)\s*[:：]?\s*([a-z0-9-]+)/i);
    if (vector) putText(v, 'meta.vector', vector[1]);
    const visual = cover.match(/1\s*\.\s*kiểm\s*tra\s*bên\s*ngoài[\s\S]{0,100}?(Đạt|Không\s+đạt|Bình\s+thường)/i);
    return visual ? visual[1] : '';
  }

  function parseTextFields(linesByPage, v) {
    const all = linesByPage.flat().map(x => x.text).join('\n');
    const bctAt = all.search(/(?:bushing\s*type\s*current\s*transformer|biến\s*dòng\s*chân\s*sứ)/i);
    const bctText = bctAt < 0 ? '' : all.slice(bctAt);
    const visual = bctText.match(/(?:general\s*inspection)[^\n:]{0,30}[:：]\s*([^\n]+)/i);
    if (visual) putText(v, 'bct.visual', visual[1]);
    const moistAt = all.search(/(?:hàm\s*lượng\s*ẩm|moisture\s*content)/i);
    const moistText = moistAt < 0 ? '' : all.slice(moistAt, bctAt > moistAt ? bctAt : undefined);
    const moisture = moistText.match(/(?:độ\s*ẩm|moisture\s*(?:content)?)[^\n:]{0,30}[:=]\s*([\d]+(?:[.,]\d+)?)/i);
    if (moisture) putNumber(v, 'moist.val', moisture[1]);
    const method = moistText.match(/(?:phương\s*pháp|method|thiết\s*bị\s*đo)[^\n:]{0,20}[:：]\s*([^\n]+)/i);
    if (method) putText(v, 'moist.method', method[1]);
    const polarity = bctText.match(/\(S2,?3,?4,?5\)\s*[–-]\s*([^\n]+)/i);
    // ô kết quả để trống: dòng kế tiếp là đề mục "11.5 …" — không lấy
    if (polarity && !/^\s*\d+\.\d/.test(polarity[1])) putText(v, 'bct.polarity', polarity[1]);
    const oltcAt = all.search(/(?:bộ\s*điều\s*áp\s*dưới\s*tải|on[- ]load\s*tap\s*changer)/i);
    const oltcText = oltcAt < 0 ? '' : all.slice(oltcAt, moistAt > oltcAt ? moistAt : undefined);
    const oltc = Boolean(oltcText);
    if (oltc) {
      const type = oltcText.match(/\(Type\)\s*[:：]\s*([^\n]+)/i);
      const serial = oltcText.match(/\(Serial\s*No\)\s*[:：]\s*([^\n]+)/i);
      const oscillograph = oltcText.match(/\(Oscillograph\s*result\)\s*[:：]\s*([^\n]+)/i);
      if (type) putText(v, 'oltc.type', type[1]);
      if (serial) putText(v, 'oltc.serial', serial[1]);
      if (oscillograph) putText(v, 'oltc.osc', oscillograph[1]);
    }
  }

  function measurementCount(v) {
    const re = /^(?:ir\.meas|b\.(?:hv|mv|lv)\.meas|wtgd\.meas|nl\.(?:lv|hv|rated)|dcr\.(?:hv|mv|lv)|ratio)\./;
    return Object.entries(v).filter(([key, value]) => re.test(key) && number(value) !== '' && Number.isFinite(Number(number(value)))).length;
  }

  function read(pages, fileName, opts) {
    opts = opts || {};
    if (!Array.isArray(pages) || !pages.length || !pages.some(p => p && p.length)) {
      throw new Error(fileName + ': không có lớp chữ để đọc. PDF scan cần được nhận dạng OCR và soát thủ công.');
    }
    const positioned = pages.map(positionedLines);
    positioned.pages = pages;
    const lines = positioned.map(x => x.map(y => y.text));
    const cover = lines[0].join('\n'), all = lines.map(x => x.join('\n')).join('\n');
    const folded = fold(all);
    const hasTemplateCode = /(?:ptc3|npts)\s*[\/\s-]\s*bm\s*\.?\s*0?1/.test(folded);
    if (!hasTemplateCode && !opts.ocr) throw new Error(fileName + ': chưa nhận dạng được mã mẫu PTC3/BM.01 hoặc NPTS/BM.01.');

    const v = {};
    const fields = [
      ['meta.project', 'Tên dự án/tên trạm (Project)', 'Vị trí lắp đặt'],
      ['meta.site', 'Vị trí lắp đặt (Site)', 'Hãng sản xuất'],
      ['meta.manuf', 'Hãng sản xuất (Manufacturer)', 'Số chế tạo'],
      ['meta.serial', 'Số chế tạo (Serial No)', 'Năm sản xuất'],
      ['meta.year', 'Năm sản xuất (Year of manufacture)', 'Kiểu loại'],
      ['meta.type', 'Kiểu loại (Type)', 'Công suất'],
      ['meta.power', 'Công suất (Rated power)', 'Điện áp định mức'],
      ['meta.voltage', 'Điện áp định mức (Rated voltage)', 'Tổ đấu dây'],
      ['meta.vector', 'Tổ đấu dây (Vector group)', 'Dòng định mức'],
      ['meta.current', 'Dòng định mức (Rated current)', 'Lý do'],
      ['meta.reason', 'Lý do kiểm định, thí nghiệm', 'Ngày kiểm định'],
      ['meta.date', 'Ngày kiểm định, thí nghiệm (Date)', 'Điều kiện môi trường'],
    ];
    const allLabels = fields.map(f => f[2]).concat(['Điều kiện môi trường', 'Các hạng mục']);
    fields.forEach(([key, start, end]) => { v[key] = betweenAny(cover, start, allLabels.filter(l => fold(start).indexOf(fold(l)) !== 0)) || between(cover, start, end); });
    // bìa 2 cột: giá trị điện áp xuống dòng dưới nhãn → dính vào sau công suất "300/300/60 MVA (500/√3…)/35kV"
    if (/c[oô]ng\s*su[aấ]t|rated\s*power/i.test(v['meta.voltage'] || '')) v['meta.voltage'] = '';
    const pv = String(v['meta.power'] || '').match(/^(.*?MVA)\s+(.*\d\s*kV)\s*$/i);
    if (pv && !/\d/.test(v['meta.voltage'] || '')) { v['meta.power'] = pv[1].trim(); v['meta.voltage'] = pv[2].trim(); }
    if (!v['meta.reason']) v['meta.reason'] = between(cover, 'Lý do thí nghiệm', 'Ngày thí nghiệm');
    if (v['meta.reason']) v['meta.reason'] = Common.optionOf(v['meta.reason'], Schema.REASONS);
    if (!v['meta.date']) v['meta.date'] = between(cover, 'Ngày thí nghiệm (Date)', 'Điều kiện môi trường');
    if (opts.ocr && !String(v['meta.serial'] || '').trim()) {
      const serialLine = cover.split(/\r?\n/).find(line => /số\s*chế|serial/i.test(line));
      const serial = serialLine && serialLine.match(/(?:^|\D)([A-Z]?\d{5,8})(?:\D|$)/i);
      if (serial) v['meta.serial'] = serial[1];
    }
    v['meta.date'] = normDate(v['meta.date']) || v['meta.date'];
    const envLine = lines[0].find(x => fold(x).includes('ambient condition')) || '';
    const temp = envLine.match(/(?:Temp\.)\s*=\s*([\d.,+-]+)/i);
    const humidity = envLine.match(/Humidity\)\s*=\s*([\d.,+-]+)/i);
    if (temp) v['meta.ambT'] = number(temp[1]);
    if (humidity) v['meta.hum'] = number(humidity[1]);
    const report = all.match(/Số\s+biên\s+bản\s*:\s*([\w./-]+)/i), reportNo = report ? report[1] : '';
    const conclusion = between(cover, 'Kết luận (Conclusion)', '((SIGN))');
    if (conclusion) v['meta.conclusion'] = conclusion;

    const cfg = EquipmentTypes.get('MBA').defaultCfg();
    // BBTN máy 1 pha 500 kV (mẫu theo pha): "Vị trí lắp đặt … (Pha A)", điện áp 500/√3 hoặc sứ phía 500 kV
    const unitPhase = (String(v['meta.site'] || '').match(/\bpha\s*([abc])\b/i) || [])[1];
    const is500 = /500\s*\/\s*√?\s*3|500\s*kv/i.test([v['meta.voltage'], v['meta.type'], all].join(' '));
    const perUnit = Boolean(unitPhase && is500);
    const layout = perUnit ? '1P' : '110';
    if (perUnit) { cfg.template = unitPhase.toUpperCase(); cfg.topology = 'single1p'; cfg.reportScope = 'combined'; cfg.unitPhase = cfg.template; }
    else { cfg.template = '110'; cfg.layout = '110'; cfg.topology = 'threePhase'; cfg.reportScope = 'combined'; }
    const winding = detectDcrWinding(positioned, v['meta.voltage']);
    if (winding.winding && !perUnit) cfg.oltcWinding = winding.winding;
    const schema = EquipmentTypes.get('MBA').buildSchema(cfg);
    const parserWarnings = [];
    if (!winding.winding) parserWarnings.push('Chưa xác định được cuộn đặt OLTC từ bảng R một chiều; giữ cấu hình cao áp, cần kiểm tra PDF.');
    if (winding.warning) parserWarnings.push(winding.warning);
    const visualResult = parseCoverResults(positioned, v);
    parseTextFields(positioned, v);
    parseIR(positioned, v, opts);
    const hdr = {};
    parseBushings(positioned, v, Object.assign({}, opts, { perUnit, unitPhase: perUnit ? cfg.template : '', hdr }));
    // nhãn cột sứ khác mẫu (vd hạ áp "3.1 | 3.2" đã là mặc định của mẫu theo pha) → giữ để BBTN hiện / xuất đúng như bản gốc
    const defLabels = {};
    Common.eachGrid(schema, g => { if (/^b\.\w+\.meas$/.test(g.id)) g.cols.forEach(c => { if (c.hk) defLabels[c.hk] = c.defLabel; }); });
    Object.entries(hdr).forEach(([k, l]) => { if (defLabels[k] !== undefined && l !== defLabels[k]) cfg.hdr[k] = l; });
    parseWindingTgd(positioned, v, schema);
    parseNoLoad(positioned, v);
    parseDcr(positioned, v, parserWarnings, schema, winding);
    parseRatio(positioned, v, schema);
    const bctCores = {};
    parseBctInsulation(positioned, v, bctCores);
    Object.entries(bctCores).forEach(([side, n]) => { if ((Schema.BCT_SIDES[side] || { cores: [] }).cores.includes(n)) cfg.bctCores[side] = n; });

    const count = measurementCount(v);
    const state = {
      type: 'MBA', v, cfg, sum: { tick: {}, ev: visualResult ? { visual: visualResult } : {} }, att: {}, created: new Date().toISOString(),
      imported: { file: fileName, format: 'pdf', layout, templateVersion: 'PTC3/NPTS BM.01', reportNo, at: new Date().toISOString() },
    };
    const warnings = parserWarnings.slice();
    if (opts.ocr) warnings.push('PDF scan đã được OCR; cần đối chiếu từng số liệu nhận dạng với bản gốc trước khi lưu.');
    if (!hasTemplateCode) warnings.push('OCR chưa nhận dạng rõ mã mẫu; xác nhận đây là BBTN MBA 110–220 kV trước khi lưu.');
    if (!String(v['meta.serial'] || '').trim()) warnings.push('Chưa đọc được số chế tạo — nhập lại trong biểu mẫu.');
    if (!Common.isoDate(v['meta.date'])) warnings.push('Chưa đọc được ngày thí nghiệm — nhập lại trong biểu mẫu.');
    if (!reportNo) warnings.push('Chưa đọc được số biên bản.');
    if (count) warnings.push('Đã tự nhận dạng ' + count + ' ô số liệu đo. Đối chiếu lại với PDF gốc trước khi lưu.');
    else warnings.push('Đã nhận dạng phần bìa nhưng chưa lấy được số liệu đo; nhập/soát số liệu trong biểu mẫu bên phải.');
    if (perUnit) warnings.push(`Nhận dạng BBTN máy 1 pha 500 kV — pha ${cfg.template} (mẫu theo pha); sứ và biến dòng chân sứ thuộc máy này.`);
    else if (!/110|220/.test(fold([v['meta.project'], v['meta.site'], v['meta.type'], v['meta.voltage']].join(' ')))) warnings.push('Chưa xác nhận được đây là MBA 110–220 kV; kiểm tra loại MBA và cấu hình trước khi lưu.');
    return { state, layout, count, warnings, reportNo, pages: pages.length };
  }

  window.MbaPdfImportReport = { read, normDate, between, pageLines, terminalRow };
})();
