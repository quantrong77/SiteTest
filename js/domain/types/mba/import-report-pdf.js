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
    if (s.includes(',') && s.includes('.')) return s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    return s.replace(',', '.');
  }
  function pageWidth(page) {
    if (Number(page && page.pageWidth) > 0) return Number(page.pageWidth);
    const maxX = Math.max(0, ...(page || []).map(x => Number(x.x || 0) + Number(x.w || 0)));
    return maxX ? maxX * 1.075 : 595;
  }
  const centerX = item => Number(item.x || 0) + Number(item.w || 0) / 2;
  const fallbackCenters = (width, ratios) => ratios.map(r => width * r);

  function headerCenters(lines, aliases, from, to, fallback) {
    return aliases.map((opts, index) => {
      const keys = Array.isArray(opts) ? opts : [opts];
      for (let n = Math.max(0, from || 0); n < Math.min(lines.length, to == null ? lines.length : to); n++) {
        for (const item of lines[n].items) {
          const value = compact(item.str);
          if (keys.some(key => value === key || (key.length > 2 && value.startsWith(key)))) return centerX(item);
        }
      }
      return fallback[index];
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
        } else if (line.items.some(item => compact(item.str).startsWith('r15')) && line.items.some(item => compact(item.str).startsWith('r60'))) {
          centers = headerCenters(lines, ['r15', 'r60', 'r600', 'kht', 'pi', 'dcvoltage'], i, Math.min(lines.length, i + 8), fallback);
        }
        if (corrected || !centers) return;
        const label = leftText(line, centers);
        let row = terminalRow(label) || coreRow(label);
        if (opts.ocr && legacyOcr) {
          if (row === 'r0') r0AnchorY = line.y;
          const first = cellNumber(page, line.y, centers, 0), second = cellNumber(page, line.y, centers, 1);
          const voltage = cellNumber(page, line.y, centers, 3);
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
          putNumber(v, 'ir.meas.' + row + '.' + col, cellNumber(page, line.y, centers, index));
        });
        putNumber(v, 'ir.meas.' + row + '.u', cellNumber(page, line.y, centers, 5));
      });
    });
  }

  function phaseHeaderIndex(lines, start) {
    for (let i = Math.max(0, start); i < Math.min(lines.length, start + 5); i++) {
      if (lines[i].items.some(item => ['pha', 'phase'].includes(compact(item.str)))) return i;
    }
    return -1;
  }
  function parseBushings(linesByPage, v, opts) {
    opts = opts || {};
    let ctx = null, legacyTemp = '';
    linesByPage.forEach((lines, pageIndex) => {
      const page = linesByPage.pages[pageIndex], width = pageWidth(page);
      lines.forEach((line, i) => {
        const f = fold(line.text), c = compact(line.text);
        if (opts.ocr && ctx && ctx.legacy && (c.includes('cuonday') || c.includes('windings') || c.includes('windingresistance'))) { ctx = null; return; }
        if ((c.includes('5.1') || c.startsWith('51')) && c.includes('caoap')) ctx = { side: 'hv', raw: true, centers: null, tgRows: 0 };
        else if ((c.includes('5.2') || c.startsWith('52')) && (c.includes('trungap') || c.includes('neutral'))) ctx = { side: 'mv', raw: true, centers: null, tgRows: 0 };
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
        if (h >= 0 && !ctx.centers) ctx.centers = phaseCenters(lines, h, ctx.side, width, Boolean(opts.ocr && ctx.legacy));
        if (!ctx.centers) return;
        const label = compact(leftText(line, ctx.centers)), phases = ctx.side === 'hv' ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'N'];
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
        phases.forEach((phase, index) => {
          const key = prefix + 'meas.' + row + '.' + phase;
          const value = ['type', 'manuf', 'serial'].includes(row) ? cellText(page, line.y, ctx.centers, index, 13) : cellNumber(page, line.y, ctx.centers, index);
          if (['type', 'manuf', 'serial'].includes(row)) putText(v, key, value);
          else putMeasurementNumber(v, key, value, Boolean(opts.ocr));
        });
        if (row === 'tgd1' || row === 'tgd2') {
          putMeasurementNumber(v, prefix + 'meas.' + row + '.u', cellNumber(page, line.y, ctx.centers, phases.length), Boolean(opts.ocr));
          if (!(opts.ocr && ctx.legacy)) putText(v, prefix + 'meas.' + row + '.d', cellText(page, line.y, ctx.centers, phases.length + 1));
        }
      });
    });
  }

  function parseWindingTgd(linesByPage, v) {
    let active = false, corrected = false, centers = null;
    const fallback = fallbackCenters(595, [0.505, 0.630, 0.755, 0.880]);
    linesByPage.forEach((lines, pageIndex) => {
      const page = linesByPage.pages[pageIndex];
      lines.forEach((line, i) => {
        const f = fold(line.text), c = compact(line.text);
        if (c.includes('trisotgdelta') && c.includes('cuonday')) { active = true; corrected = false; centers = null; }
        if (!active) return;
        if (c.includes('quydoive20') || c.includes('correctedto20')) corrected = true;
        if (c.includes('dienromotchieu') || c.includes('windingresistance')) { active = false; return; }
        if (f.includes('do o nhiet do') || f.includes('measure at temperature')) {
          const t = parseTemperature(line.text);
          if (t) putNumber(v, 'wtgd.t', t);
        }
        if (c.includes('k2')) {
          const m = line.text.match(/k2\s*=\s*([+-]?\d+(?:[.,]\d+)?)/i);
          if (m) putNumber(v, 'wtgd.k2', m[1]);
        }
        if (line.items.some(item => compact(item.str).startsWith('tgdelta')) && line.items.some(item => compact(item.str) === 'c')) {
          centers = headerCenters(lines, [['tgdelta', 'tg'], 'c', 'kv', 'diagram'], i, Math.min(lines.length, i + 9), fallback);
        }
        if (corrected || !centers) return;
        const row = terminalRow(leftText(line, centers));
        if (!row) return;
        putNumber(v, 'wtgd.meas.' + row + '.tgd', cellNumber(page, line.y, centers, 0));
        putNumber(v, 'wtgd.meas.' + row + '.c', cellNumber(page, line.y, centers, 1));
        putNumber(v, 'wtgd.meas.' + row + '.u', cellNumber(page, line.y, centers, 2));
        putText(v, 'wtgd.meas.' + row + '.d', cellText(page, line.y, centers, 3));
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
        if (line.items.some(item => compact(item.str).startsWith('uo')) && line.items.some(item => compact(item.str).startsWith('io'))) {
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

  function parseDcr(linesByPage, v) {
    let active = false, side = '', centers = null;
    const aliases = {
      mv: ['amn', 'bmn', 'cmn'],
      hv: [['an', 'ao', 'aam'], ['bn', 'bo', 'bbm'], ['cn', 'co', 'ccm']],
      lv: ['ab', 'bc', 'ca'],
    };
    const fallback = fallbackCenters(595, [0.350, 0.500, 0.650]);
    linesByPage.forEach((lines, pageIndex) => {
      const page = linesByPage.pages[pageIndex], width = pageWidth(page);
      lines.forEach((line, i) => {
        const f = fold(line.text), c = compact(line.text);
        if (c.includes('dienromotchieu') || c.includes('windingresistance')) { active = true; side = ''; centers = null; }
        if (!active) return;
        if (c.includes('tysobien') || c.includes('voltageratio') || c.includes('onloadtap')) { active = false; side = ''; centers = null; return; }
        if (c.includes('cuondaytrungthe') || c.includes('mvwinding')) side = 'mv';
        else if (c.includes('cuondaycaothe') || c.includes('hvwinding')) side = 'hv';
        else if (c.includes('cuondayhath') || c.includes('lvwinding')) side = 'lv';
        if (!side) return;
        const t = parseTemperature(line.text);
        if (t && (f.includes('nhietdo') || f.includes('temperature'))) putNumber(v, 'dcr.' + side + '.t', t);
        if (line.items.some(item => aliases[side].some(alias => (Array.isArray(alias) ? alias : [alias]).includes(compact(item.str))))) {
          centers = headerCenters(lines, aliases[side], i, Math.min(lines.length, i + 10), fallback);
        }
        if (!centers) return;
        const rowLabel = leftText(line, centers);
        const tapText = line.items.filter(item => centerX(item) < width * 0.23).map(item => item.str).join(' ').trim();
        const tapMatch = tapText.match(/^\s*(\d{1,2})\s*$/);
        const tap = tapMatch ? Number(tapMatch[1]) : null;
        let row = '';
        if (side === 'hv') row = tap ? 't' + tap : 't1';
        else if (side === 'mv') { if (!tap || tap === 9) row = 'r'; }
        else row = 'r';
        if (!row) return;
        ['A', 'B', 'C'].forEach((phase, index) => putNumber(v, 'dcr.' + side + '.' + row + '.' + phase, cellNumber(page, line.y, centers, index)));
      });
    });
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
    fields.forEach(([key, start, end]) => { v[key] = between(cover, start, end); });
    if (!v['meta.reason']) v['meta.reason'] = between(cover, 'Lý do thí nghiệm', 'Ngày thí nghiệm');
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
    cfg.template = '110'; cfg.layout = '110'; cfg.topology = 'threePhase'; cfg.reportScope = 'combined';
    parseIR(positioned, v, opts);
    parseBushings(positioned, v, opts);
    parseWindingTgd(positioned, v);
    parseNoLoad(positioned, v);
    parseDcr(positioned, v);

    const count = measurementCount(v);
    const state = {
      type: 'MBA', v, cfg, sum: { tick: {}, ev: {} }, att: {}, created: new Date().toISOString(),
      imported: { file: fileName, format: 'pdf', layout: '110', templateVersion: 'PTC3/NPTS BM.01', reportNo, at: new Date().toISOString() },
    };
    const warnings = [];
    if (opts.ocr) warnings.push('PDF scan đã được OCR; cần đối chiếu từng số liệu nhận dạng với bản gốc trước khi lưu.');
    if (!hasTemplateCode) warnings.push('OCR chưa nhận dạng rõ mã mẫu; xác nhận đây là BBTN MBA 110–220 kV trước khi lưu.');
    if (!String(v['meta.serial'] || '').trim()) warnings.push('Chưa đọc được số chế tạo — nhập lại trong biểu mẫu.');
    if (!Common.isoDate(v['meta.date'])) warnings.push('Chưa đọc được ngày thí nghiệm — nhập lại trong biểu mẫu.');
    if (!reportNo) warnings.push('Chưa đọc được số biên bản.');
    if (count) warnings.push('Đã tự nhận dạng ' + count + ' ô số liệu đo. Đối chiếu lại với PDF gốc trước khi lưu.');
    else warnings.push('Đã nhận dạng phần bìa nhưng chưa lấy được số liệu đo; nhập/soát số liệu trong biểu mẫu bên phải.');
    if (!/110|220/.test(fold([v['meta.project'], v['meta.site'], v['meta.type'], v['meta.voltage']].join(' ')))) warnings.push('Chưa xác nhận được đây là MBA 110–220 kV; kiểm tra loại MBA và cấu hình trước khi lưu.');
    return { state, layout: '110', count, warnings, reportNo, pages: pages.length };
  }

  window.MbaPdfImportReport = { read, normDate, between, pageLines, terminalRow };
})();
