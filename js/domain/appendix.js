// Phụ lục nối sau BBTN: chụp sóng OLTC (dựng từ số liệu máy đo) và báo cáo SFRA (file .docx xuất từ SFRA Analyzer,
// https://quantrong77.github.io/-Analysis-SFRA/, nối nguyên văn). Đánh số phụ lục, tóm tắt báo cáo SFRA để hiển thị.
(function () {
  'use strict';
  const SFRA_URL = 'https://quantrong77.github.io/-Analysis-SFRA/';
  const DGA_URL = 'https://quantrong77.github.io/dga-webapp/';

  function dgaLink(serial) {
    const value = String(serial || '').trim();
    return value ? `${DGA_URL}?serial=${encodeURIComponent(value)}` : DGA_URL;
  }

  function oilSummary(outline) {
    const lines = (outline || []).map(x => String(x.text || '').trim());
    const all = lines.join('\n');
    const title = lines.find(x => /BIÊN BẢN|PHÂN TÍCH KHÍ HÒA TAN/i.test(x)) || '';
    const kind = /PHÂN TÍCH KHÍ HÒA TAN/i.test(all) ? 'dga'
      : /BIÊN BẢN THÍ NGHIỆM DẦU CÁCH ĐIỆN/i.test(all) ? 'oil' : null;
    const after = re => { const line = lines.find(x => re.test(x)); return line ? line.split(':').slice(1).join(':').trim() : ''; };
    const ci = lines.findIndex(x => /KẾT LUẬN\s*\(Conclusion\)/i.test(x));
    const conclusion = [];
    if (ci >= 0) {
      const first = lines[ci].split(':').slice(1).join(':').trim();
      if (first) conclusion.push(first);
      for (let i = ci + 1; i < lines.length; i++) {
        if (/TUQ\.|KẾT QUẢ THÍ NGHIỆM|,\s*ngày\s+.+tháng\s+.+năm/i.test(lines[i])) break;
        if (lines[i]) conclusion.push(lines[i]);
      }
    }
    return { kind, title, serial: after(/Số chế tạo\s*\(Serial No\)/i),
      sampleDate: after(/Ngày lấy mẫu\s*\((?:Date of sampling|Date)\)/i),
      project: after(/Tên dự án\/tên trạm\s*\(Project\)/i), conclusion };
  }

  function serialMatch(fileSerial, serials) {
    const norm = x => String(x || '').toLowerCase().replace(/\s+/g, '');
    const target = norm(fileSerial);
    return !!target && (serials || []).some(x => norm(x) === target);
  }

  // outline: [{ style, text }] các đoạn văn của file → tóm tắt (tiêu đề, số phép đo, kết luận)
  function fraSummary(outline) {
    const isH1 = x => /heading\s*1|^heading1$/i.test(x.style) || /^\d+\.\s+\S/.test(x.text) && !/^\d+\.\d+/.test(x.text) && x.text.length < 80;
    const isH2 = x => /heading\s*2|^heading2$/i.test(x.style) || /^\d+\.\d+\.\s/.test(x.text);
    const ci = outline.findIndex(x => isH1(x) && /kết luận/i.test(x.text));
    const conclusion = [];
    if (ci >= 0) for (let k = ci + 1; k < outline.length && !isH1(outline[k]); k++) conclusion.push(outline[k].text);
    const all = outline.map(x => x.text).join('\n');
    return {
      title: outline.length ? outline[0].text : '',
      measurements: outline.filter(x => isH2(x) && /phép đo/i.test(x.text)).length,
      conclusion,
      isSfra: /SFRA|Rxy|DL\/T\s*911|đáp ứng tần số/i.test(all),
    };
  }

  const shortCircuitPairs = ['HV-MV', 'HV-LV', 'MV-LV'];
  const valueOf = value => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const n = Number(String(value).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const pairOf = value => String(value || '').toUpperCase().replace(/[–—−]/g, '-').replace(/\s+/g, '');
  const tapOf = value => String(value || '-').trim().replace(/^Tap\s*/i, '').toUpperCase() || '-';
  const shortCircuitHasData = att => (att && att.rows || []).some(row => ['tempC', 'frequencyHz', 'ratedVoltageKV', 'ratedCurrentA', 'testVoltage', 'testVoltageKV', 'testCurrentA', 'powerKw', 'copperLossKw', 'nameplateUkPct', 'initialUkPct'].some(k => valueOf(row[k]) !== null));

  function shortCircuitResults(state, factory) {
    const att = state.att && state.att.shortCircuit || {}, rows = att.rows || [];
    const layout = state.cfg && (state.cfg.template === 'custom' ? state.cfg.layout : state.cfg.template) || '1P';
    const is3Phase = ['3P', '110'].includes(layout);
    const reason = String(state.v['meta.reason'] || '').toLowerCase();
    const inferredCase = /đại tu|sửa chữa/.test(reason) ? 'overhaul' : /định kỳ|bất thường|dự phòng|vận hành/.test(reason) ? 'operation' : 'new';
    const measured = rows.map(row => {
      const phase = String(row.phase || '').toUpperCase();
      const serial = layout === '3P' ? (phase && state.cfg.ps && state.cfg.ps[phase] || '') : state.v['meta.serial'] || '';
      const refs = factory && factory.shortCircuitFor ? factory.shortCircuitFor(serial) : [];
      const refRows = refs.filter(x => pairOf(x.pair) === pairOf(row.pair) && tapOf(x.tap) === tapOf(row.tap));
      const ref = refRows.find(x => !phase || !x.phase || String(x.phase).toUpperCase() === phase) || (refRows.length === 1 ? refRows[0] : null);
      const testCase = ['new', 'overhaul', 'operation'].includes(row.testCase) ? row.testCase : inferredCase;
      const tapRole = row.tapRole || 'main';
      const tempC = valueOf(row.tempC), frequencyHz = valueOf(row.frequencyHz), ratedFrequencyHz = valueOf(row.ratedFrequencyHz), ratedVoltageKV = valueOf(row.ratedVoltageKV);
      const ratedCurrentA = valueOf(row.ratedCurrentA), testCurrentA = valueOf(row.testCurrentA);
      const testVoltageInput = valueOf(row.testVoltage ?? row.testVoltageKV);
      const testVoltageUnit = row.testVoltageUnit || (row.testVoltageKV !== undefined ? 'kV' : 'V');
      const measuredVoltageKV = testVoltageInput === null ? null : testVoltageUnit === 'V' ? testVoltageInput / 1000 : testVoltageInput;
      const powerKw = valueOf(row.powerKw), copperLossKw = valueOf(row.copperLossKw), factor = valueOf(row.tempFactor);
      const ratio = ratedCurrentA > 0 && testCurrentA > 0 ? ratedCurrentA / testCurrentA : null;
      const testCurrentPct = ratedCurrentA > 0 && testCurrentA !== null ? testCurrentA / ratedCurrentA * 100 : null;
      const currentAdequate = testCurrentPct !== null && testCurrentPct >= 25;
      const ukPct = ratedVoltageKV > 0 && measuredVoltageKV !== null && ratio !== null ? measuredVoltageKV / ratedVoltageKV * ratio * 100 : null;
      const pkAtRatedKw = powerKw !== null && ratio !== null ? powerKw * ratio * ratio : null;
      const reportTempC = valueOf(row.reportTempC) ?? valueOf(ref && ref.pkTempC);
      let pkAtReportTempKw = null;
      if (pkAtRatedKw !== null && tempC !== null && reportTempC !== null) {
        if (Math.abs(tempC - reportTempC) < 0.01) pkAtReportTempKw = pkAtRatedKw;
        else if (copperLossKw !== null && copperLossKw >= 0 && copperLossKw <= powerKw && [225, 235].includes(factor)) {
          const copperAtRated = copperLossKw * ratio * ratio;
          const strayAtRated = (powerKw - copperLossKw) * ratio * ratio;
          pkAtReportTempKw = copperAtRated * (factor + reportTempC) / (factor + tempC)
            + strayAtRated * (factor + tempC) / (factor + reportTempC);
        }
      }
      const deltaUkPct = ukPct !== null && ref && ref.ukPct > 0 ? (ukPct - ref.ukPct) / ref.ukPct * 100 : null;
      const deltaPkPct = pkAtReportTempKw !== null && ref && ref.pkKw > 0 ? (pkAtReportTempKw - ref.pkKw) / ref.pkKw * 100 : null;
      const nameplateUkPct = valueOf(row.nameplateUkPct) ?? valueOf(ref && ref.ukPct);
      const deltaUk1387Pct = ukPct !== null && nameplateUkPct > 0 ? (ukPct - nameplateUkPct) / nameplateUkPct * 100 : null;
      const initialUkPct = valueOf(row.initialUkPct);
      const deltaInitialUkPct = ukPct !== null && initialUkPct > 0 ? (ukPct - initialUkPct) / initialUkPct * 100 : null;
      const sameFrequency = frequencyHz !== null && ratedFrequencyHz !== null && frequencyHz === ratedFrequencyHz;
      const conditionsReady = sameFrequency && currentAdequate;
      const ukStatus = deltaUkPct === null || !conditionsReady ? 'warn' : Math.abs(deltaUkPct) <= 3 ? 'pass' : 'fail';
      let uk1387Status = 'warn';
      if (conditionsReady && testCase === 'new') {
        uk1387Status = tapRole !== 'main' ? 'na' : deltaUk1387Pct === null ? 'warn' : Math.abs(deltaUk1387Pct) <= 5 ? 'pass' : 'fail';
      } else if (conditionsReady && deltaInitialUkPct !== null) uk1387Status = Math.abs(deltaInitialUkPct) <= 3 ? 'pass' : 'fail';
      const pkStatus = deltaPkPct === null || !conditionsReady ? 'warn' : deltaPkPct <= 15 ? 'pass' : 'fail';
      return { row, phase, serial, ref, tempC, frequencyHz, ratedFrequencyHz, sameFrequency, ratedVoltageKV, ratedCurrentA,
        testVoltageInput, testVoltageUnit, measuredVoltageKV, testCurrentA, testCurrentPct, currentAdequate, testCase, tapRole,
        powerKw, copperLossKw, factor, ukPct, pkAtRatedKw, pkAtReportTempKw, reportTempC, deltaUkPct,
        deltaPkPct, nameplateUkPct, deltaUk1387Pct, initialUkPct, deltaInitialUkPct, ukStatus, uk1387Status, pkStatus };
    });
    const groups = new Map();
    measured.forEach(x => {
      const key = `${pairOf(x.row.pair)}|${tapOf(x.row.tap)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(x);
    });
    return measured.map(x => {
      let phaseStatus = 'na', phaseDeltaPct = null;
      if (is3Phase) {
        const phases = new Map();
        (groups.get(`${pairOf(x.row.pair)}|${tapOf(x.row.tap)}`) || []).forEach(y => { if (['A', 'B', 'C'].includes(y.phase) && y.ukPct !== null && y.sameFrequency && y.currentAdequate) phases.set(y.phase, y.ukPct); });
        if (phases.size === 3) {
          const mean = Array.from(phases.values()).reduce((a, b) => a + b, 0) / 3;
          const values = Array.from(phases.values());
          phaseDeltaPct = mean ? (Math.max(...values) - Math.min(...values)) / mean * 100 : null;
          phaseStatus = phaseDeltaPct === null ? 'warn' : phaseDeltaPct <= 3 ? 'pass' : 'fail';
        } else phaseStatus = 'warn';
      }
      if (is3Phase && ['overhaul', 'operation'].includes(x.testCase) && !['pass', 'fail'].includes(phaseStatus)) x.uk1387Status = 'warn';
      const overallStatuses = [x.ukStatus, x.uk1387Status, x.pkStatus, phaseStatus];
      const overall = overallStatuses.includes('fail') ? 'fail'
        : overallStatuses.every(status => ['pass', 'na'].includes(status)) ? 'pass' : 'warn';
      return Object.assign({}, x, { phaseStatus, phaseDeltaPct, overall });
    });
  }

  function shortCircuitAppendix(state, results, factoryName, out, label = 'PHỤ LỤC') {
    const v = state.v || {}, blocks = [{ type: 'page' },
      { type: 'p', text: label, bold: true, size: 14, align: 'center' },
      { type: 'p', text: 'KẾT QUẢ THÍ NGHIỆM TỔN THẤT NGẮN MẠCH VÀ ĐIỆN ÁP NGẮN MẠCH MÁY BIẾN ÁP', bold: true, size: 13, align: 'center' }];
    if (v['meta.project'] || v['meta.site']) blocks.push({ type: 'p', text: [v['meta.project'], v['meta.site']].filter(Boolean).join(' – '), align: 'center', size: 12 });
    blocks.push({ type: 'p', text: `Số chế tạo: ${v['meta.serial'] || '—'} · Test Report: ${factoryName || 'chưa nạp'}`, italic: true, size: 10, align: 'center', after: 160 });
    blocks.push({ type: 'p', text: 'Quy trình tham khảo: QĐ 1387/QĐ-EVNNPT (25/04/2015), Điều 25–27; Tài liệu đào tạo thí nghiệm MBA (2026), I.11.', italic: true, size: 9, align: 'center', after: 140 });
    blocks.push({ type: 'p', text: '1. Số liệu thí nghiệm', bold: true, size: 12, keepNext: true });
    const fmt = (x, digits = 2) => x === null || x === undefined || !Number.isFinite(Number(x)) ? '—' : out(Number(x).toFixed(digits));
    const inputRows = results.map(x => [x.row.pair || '', `${x.row.tap || ''}${x.phase ? ` / ${x.phase}` : ''}`, x.testCase === 'new' ? 'Mới' : x.testCase === 'overhaul' ? 'Đại tu' : 'Vận hành', x.tapRole === 'main' ? 'Nấc chính' : 'Nấc khác', fmt(x.tempC, 1), fmt(x.frequencyHz, 2), fmt(x.ratedFrequencyHz, 2), fmt(x.testVoltageInput, 2), x.testVoltageUnit, fmt(x.measuredVoltageKV, 4), fmt(x.ratedVoltageKV, 3), fmt(x.ratedCurrentA, 2), fmt(x.testCurrentA, 2), fmt(x.testCurrentPct, 1), fmt(x.powerKw, 3)]);
    blocks.push({ type: 'table', size: 8, head: ['Cặp cuộn', 'Nấc / pha', 'Trường hợp', 'Vị trí nấc', 'T (°C)', 'f đo', 'fđm (Hz)', 'U đo', 'Đơn vị', 'U quy đổi (kV)', 'Un (kV)', 'In (A)', 'I đo (A)', 'I/In (%)', 'P đo (kW)'],
      widths: [650, 700, 670, 700, 500, 500, 560, 520, 420, 740, 580, 560, 600, 560, 650], rows: inputRows });
    const correctionRows = results.map(x => [x.row.pair || '', `${x.row.tap || ''}${x.phase ? ` / ${x.phase}` : ''}`, fmt(x.copperLossKw, 3), fmt(valueOf(x.row.tempFactor), 0), fmt(x.reportTempC, 1)]);
    blocks.push({ type: 'table', size: 8, head: ['Cặp cuộn', 'Nấc / pha', 'PI²R đo (kW)', 'K vật liệu', 'Nhiệt độ Pk Test Report (°C)'], widths: [1600, 1800, 1200, 900, 2200], rows: correctionRows });
    blocks.push({ type: 'p', text: '2. So sánh Uk', bold: true, size: 12, keepNext: true, before: 180 });
    const stateText = s => s === 'pass' ? 'Đạt' : s === 'fail' ? 'Không đạt' : s === 'na' ? '—' : 'Cần xem xét';
    const ukRows = results.map(x => [x.row.pair || '', `${x.row.tap || ''}${x.phase ? ` / ${x.phase}` : ''}`, x.sameFrequency ? 'Đạt' : 'Cần xem xét', x.currentAdequate ? 'Đạt' : 'Cần xem xét', fmt(x.ukPct, 3), fmt(x.nameplateUkPct, 3), fmt(x.deltaUk1387Pct, 2), fmt(x.ref && x.ref.ukPct, 3), fmt(x.deltaUkPct, 2), stateText(x.ukStatus), fmt(x.initialUkPct, 3), fmt(x.deltaInitialUkPct, 2), stateText(x.uk1387Status), fmt(x.phaseDeltaPct, 2), stateText(x.phaseStatus), stateText(x.overall)]);
    blocks.push({ type: 'table', size: 8, head: ['Cặp', 'Nấc / pha', 'f = fđm', 'I ≥ 25% In', 'Uk đo (%)', 'Uk nh\u00e3n m\u00e1y (%)', '\u0394Uk nh\u00e3n (%)', 'Uk Test Report (%)', 'ΔUk Report (%)', 'QĐ1901', 'Uk ban đầu (%)', 'ΔUk ban đầu (%)', 'QĐ1387', 'Lệch pha (%)', '\u0054\u00ecnh tr\u1ea1ng pha', '\u004b\u1ebft lu\u1eadn'],
      widths: [470, 560, 500, 550, 560, 650, 600, 480, 620, 550, 600, 550, 480, 600, 450, 520], rows: ukRows });
    blocks.push({ type: 'p', text: '3. So sánh Pk', bold: true, size: 12, keepNext: true, before: 180 });
    const pkRows = results.map(x => [x.row.pair || '', `${x.row.tap || ''}${x.phase ? ` / ${x.phase}` : ''}`, fmt(x.pkAtReportTempKw, 3), fmt(x.ref && x.ref.pkKw, 3), fmt(x.deltaPkPct, 2), x.currentAdequate ? 'Đạt' : 'Cần xem xét', stateText(x.pkStatus)]);
    blocks.push({ type: 'table', size: 8, head: ['Cặp / nấc / pha', 'Pk quy đổi cùng điều kiện (kW)', 'Pk Test Report (kW)', 'ΔPk (%)', 'I ≥ 25% In', 'Pk', 'Kết luận'], widths: [1800, 2200, 1900, 900, 1000, 700, 900], rows: pkRows });
    blocks.push({ type: 'p', text: 'Uk (%) = U / Un × In / I × 100, với U, I, Un và In cùng phía đo; U nhập theo V hoặc kV rồi quy về kV trước tính. Pk quy về dòng định mức: Pk1 = Pđo × (In / I)². Khi nhiệt độ khác Test Report: Pk2 = Pcu1 × (K + t2) / (K + t1) + Pstr1 × (K + t1) / (K + t2), trong đó Pstr1 = Pk1 − Pcu1; K = 235 cho dây đồng, K = 225 cho dây nhôm.', size: 9, before: 120 });
    blocks.push({ type: 'p', text: 'Ph\u1ea1m vi theo Q\u0110 1387: th\u00ed nghi\u1ec7m sau l\u1eafp \u0111\u1eb7t m\u1edbi v\u00e0 \u0111\u1ea1i tu/c\u1ea3i t\u1ea1o; khi \u0111ang v\u1eadn h\u00e0nh, th\u1ef1c hi\u1ec7n sau khi d\u00f2ng ng\u1eafn m\u1ea1ch \u0111\u00e3 qua v\u01b0\u1ee3t 70% d\u00f2ng ch\u1ecbu \u0111\u1ef1ng t\u00ednh to\u00e1n. V\u1edbi OLTC, \u0111o n\u1ea5c ch\u00ednh v\u00e0 hai n\u1ea5c \u0111\u1ea7u/cu\u1ed1i; BCT kh\u00f4ng s\u1eed d\u1ee5ng ph\u1ea3i ng\u1eafn m\u1ea1ch v\u00e0 n\u1ed1i \u0111\u1ea5t.', size: 9 });
    blocks.push({ type: 'p', text: 'Căn cứ QĐ 1387/QĐ-EVNNPT: Điều 26 yêu cầu dòng thử không nhỏ hơn 25% In; khi hiện trường không có điện áp thử theo Test Report, dùng 380 V hoặc điện áp không quá 10 kV và nội suy. Điều 27: MBA mới sai số Uk không quá 5% tại nấc chính; sau đại tu/đang vận hành không quá 3% so với giá trị ban đầu và giữa các pha; Pk quy về cùng điều kiện không lớn hơn 115% số liệu nhà chế tạo. App đồng thời giữ tiêu chí QĐ 1901 Điều 35: Uk sai lệch không quá 3%, Pk không quá 115%, và MBA ba pha kiểm tra lệch pha không quá 3%. Thiếu tham chiếu, sai tần số, dòng thử dưới 25% In hoặc thiếu dữ liệu quy đổi được ghi “Cần xem xét”.', size: 9 });
    blocks.push({ type: 'p', text: 'Người thí nghiệm', bold: true, size: 12, align: 'right', after: 1200 });
    return blocks;
  }

  // Các phụ lục có trong biên bản theo thứ tự; nhiều phụ lục thì đánh số "PHỤ LỤC 1, 2"
  function list(state, has = {}) {
    const att = state.att || {};
    const out = [];
    if (att.oltc && Object.keys(att.oltc).length) out.push({ kind: 'oltc' });
    if (att.fra && has.fra !== false) out.push({ kind: 'fra' });
    if (att.dfr && Array.isArray(att.dfr.items) && att.dfr.items.some(x => x.use)) out.push({ kind: 'dfr' });
    const oilHas = id => has.oil === undefined || (typeof has.oil.has === 'function' ? has.oil.has(id) : !!has.oil[id]);
    (att.oil && att.oil.items || []).filter(x => x.use !== false && oilHas(x.id)).forEach(x => out.push({ kind: 'oil', id: x.id }));
    if (shortCircuitHasData(att.shortCircuit)) out.push({ kind: 'shortCircuit' });
    // mẫu chung 3 pha: biến dòng chân sứ không có bảng trong thân BBTN → phụ lục dựng từ số liệu mục BCT
    if (has.bct) out.push({ kind: 'bct' });
    out.forEach((a, i) => { a.label = out.length > 1 ? `PHỤ LỤC ${i + 1}` : 'PHỤ LỤC'; });
    return out;
  }

  // Phần đầu phụ lục SFRA (trước nội dung báo cáo nối nguyên văn)
  function fraHeader(label, fra) {
    return [
      { type: 'page' },
      { type: 'p', text: label, bold: true, size: 14, align: 'center' },
      { type: 'p', text: 'KẾT QUẢ PHÂN TÍCH ĐÁP ỨNG TẦN SỐ QUÉT (SFRA)', bold: true, size: 13, align: 'center' },
      { type: 'p', text: `Báo cáo xuất từ SFRA Analyzer: ${fra.name}.`, italic: true, size: 10, align: 'center', after: 240 },
    ];
  }

  function oilHeader(label, item) {
    const dga = item.kind === 'dga';
    return [
      { type: 'page' },
      { type: 'p', text: label, bold: true, size: 14, align: 'center' },
      { type: 'p', text: dga ? 'KẾT QUẢ THÍ NGHIỆM PHÂN TÍCH KHÍ HÒA TAN TRONG DẦU (DGA)' : 'KẾT QUẢ THÍ NGHIỆM DẦU CÁCH ĐIỆN', bold: true, size: 13, align: 'center' },
      { type: 'p', text: `Biên bản xuất từ app DGA: ${item.name}.`, italic: true, size: 10, align: 'center', after: 240 },
    ];
  }

  window.Appendix = { SFRA_URL, DGA_URL, dgaLink, oilSummary, serialMatch, fraSummary, shortCircuitPairs, shortCircuitHasData, shortCircuitResults, shortCircuitAppendix, list, fraHeader, oilHeader };
})();
