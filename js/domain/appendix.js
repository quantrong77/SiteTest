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
  const STANDARD_LOOKUP = [
    ['Ngoại quan, phụ kiện', 'QĐ 1901 Điều 9, Bảng 1: kiểm tra hiện trạng theo danh mục; không có ngưỡng số chung.', 'IEC 60076-1:2011 — yêu cầu chung và phép thử MBA.', 'IEEE C57.152-2025 — hướng dẫn chẩn đoán tại hiện trường; tổng hợp kết quả và tiêu chí nhà chế tạo.'],
    ['Không tải P0, I0', 'Điều 34: P0 lệch ≤5% NSX (MBA 3 pha ≥110 kV, sau lắp/sửa); ≤10% giá trị gốc (MBA 1 pha ≥110 kV hoặc 3 pha <110 kV); khi vận hành ≤15% giá trị gốc. I0 trung bình 3 pha ≤30% NSX; pha A/C lệch ≤5%, pha B thường cao hơn 25–50% do kết cấu lõi.', 'IEC 60076-1:2011 — đo tổn hao không tải; IEC 60076-19-1:2023 — độ không đảm bảo và hiệu chỉnh phép đo tổn hao.', 'IEEE C57.12.90-2026 (approved draft) — mã thử tổn hao không tải/dòng kích từ; C57.152-2025 — hướng dẫn chẩn đoán hiện trường.'],
    ['Cách điện cuộn dây, R60/PI', 'Điều 9, 29: R60 quy đổi 20 °C không giảm quá 30% so giá trị gốc/lần trước; thiếu giá trị gốc dùng Bảng 44. PI theo IEEE C57.152.', 'Không có giới hạn hiện trường chung; đối chiếu quy định EVNNPT, NSX và giá trị gốc.', 'IEEE C57.152-2025 — hướng dẫn phép đo và diễn giải chẩn đoán; tiêu chí NSX có thể được ưu tiên.'],
    ['Cách điện lõi/gông', 'Điều 9, Bảng 1: >500 MΩ với MBA mới; >100 MΩ với MBA đã vận hành nếu NSX không quy định.', 'Không nêu ngưỡng IEC chung cho phép đo hiện trường này.', 'IEEE C57.152-2025 — hướng dẫn phép đo/đánh giá cách điện tại hiện trường.'],
    ['Cực tính, tổ đấu dây', 'Điều 32: tổ đấu dây đúng tài liệu MBA; cực tính đúng ký hiệu trên mác máy.', 'IEC 60076-1:2011 — ký hiệu đầu cực và yêu cầu chung.', 'IEEE C57.12.90-2026 (approved draft) — phép thử cực tính và quan hệ pha.'],
    ['Sứ: tgδ, điện dung C1, AC', 'Điều 38: tgδ theo NSX/Bảng 51–53; C1 thay đổi ≤5% nếu NSX không quy định; sứ không test tap ≤35 kV thử AC ở 85% giá trị xuất xưởng/Bảng 50 khi lắp hoặc thay sứ. Khi vận hành, tgδ tăng 70–100% cần đánh giá bổ sung; >100% không đạt.', 'IEC 60137:2017 — đặc tính và phép thử sứ cách điện.', 'IEEE C57.19.00-2023 — yêu cầu/phép thử sứ thiết bị; IEEE C57.152-2025 — chẩn đoán sứ trong MBA.'],
    ['Tgδ, điện dung cuộn dây', 'Điều 9, 30: tgδ <1% ở 20 °C được xem là tốt; nếu cao hơn đối chiếu giá trị gốc/Bảng 6, 46; mức tăng cùng nhiệt độ ≤30%; điện dung thay đổi không quá ±5% so giá trị gốc.', 'IEC 60076-3:2013+A1:2018 quy định phép thử điện môi và mức thử; không phải giới hạn tgδ hiện trường độc lập.', 'IEEE C57.152-2025 — hướng dẫn phép đo tgδ và diễn giải xu hướng.'],
    ['Điện trở một chiều cuộn dây', 'Điều 31: sai lệch ≤2% so NSX và pha khác tại cùng nấc, cùng nhiệt độ.', 'IEC 60076-1:2011 — phép đo điện trở cuộn dây.', 'IEEE C57.12.90-2026 (approved draft) — mã thử điện trở cuộn dây.'],
    ['Tỷ số biến', 'Điều 33: sau lắp/sửa, sai lệch ≤0,5% so mác máy và các pha khác tại cùng nấc.', 'IEC 60076-1:2011 — tỷ số và đầu phân áp.', 'IEEE C57.12.90-2026 (approved draft) — phép thử tỷ số biến.'],
    ['Bộ điều áp dưới tải OLTC', 'Điều 37: kiểm tra hành trình/đồ thị; đánh giá theo hướng dẫn NSX, không có ngưỡng số chung.', 'IEC 60214-1:2014 — yêu cầu tính năng và phương pháp thử bộ đổi nấc.', 'IEEE C57.131-2024 — yêu cầu tính năng và phương pháp thử tap-changer.'],
    ['Độ ẩm cách điện cứng', 'Điều 28: <2,2% khô; 2,2–3,7% ẩm trung bình; 3,7–4,8% ẩm; >4,8% nhiễm ẩm cao.', 'IEC 60814:1997 — xác định nước trong giấy/pressboard tẩm dầu; phương pháp đo, không thay thế phân loại QĐ.', 'IEEE C57.152-2025 — hướng dẫn chẩn đoán; IEEE C57.161-2018 — phương pháp DFR cho cách điện MBA dầu.'],
    ['Biến dòng chân sứ BCT', 'Điều 39: R cách điện ≥200 MΩ nếu NSX không quy định; các phép thử khác theo NSX/tiêu chuẩn áp dụng.', 'IEC 61869-2:2012 — yêu cầu bổ sung cho biến dòng điện.', 'IEEE C57.13.1-2017 — thử hiện trường TI dùng cho bảo vệ; C57.13 series cho phép thử tỷ số, cực tính, kích từ và điện trở.'],
    ['Đáp ứng điện môi DFR (nếu đo)', 'Điều 38 ghi dẫn chiếu “IEEE C57.12.200”; giữ nguyên số hiệu theo quy định và xác minh trên bản kiểm soát trước khi viện dẫn.', 'Không nêu ngưỡng chấp nhận DFR chung.', 'IEEE C57.161-2018 — DFR cho cách điện MBA dầu (đang có dự án sửa đổi); C57.152-2025 — diễn giải chẩn đoán.'],
    ['Đáp ứng tần số quét FRA/SFRA', 'QĐ 1901 Điều 9, Bảng 1, mục 23/Điều 44: đối chiếu đường đáp ứng và hồ sơ; không có ngưỡng số chung.', 'IEC 60076-18:2012 — thiết bị và kỹ thuật đo đáp ứng tần số.', 'IEEE C57.149-2024 — hướng dẫn áp dụng/diễn giải FRA, lưu trữ dữ liệu và kết quả.'],
    ['Ngắn mạch: Uk, Pk', 'QĐ 1387 Điều 27: MBA mới, Uk lệch ≤5% mác máy tại nấc chính; sau đại tu/vận hành ≤3% so ban đầu và giữa pha; Pk ≤115% NSX. QĐ 1901 Điều 35: Uk lệch ≤3% mác máy; lệch pha ≤3% trung bình; Pk ≤115% NSX. Áp dụng theo trường hợp của quy trình.', 'IEC 60076-1:2011 và IEC 60076-19-1:2023 cho đo Uk/Pk và độ không đảm bảo; IEC 60076-5:2006 nói về khả năng chịu ngắn mạch, không đặt tiêu chí đo Uk/Pk hiện trường.', 'IEEE C57.12.90-2026 (approved draft) — thử trở kháng/tổn hao tải; C57.164-2021 — hướng dẫn khả năng chịu ngắn mạch.'],
  ];
  const valueOf = value => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const n = Number(String(value).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const pairOf = value => String(value || '').toUpperCase().replace(/[–—−]/g, '-').replace(/\s+/g, '');
  const tapOf = value => String(value || '-').trim().replace(/^Tap\s*/i, '').toUpperCase() || '-';
  const shortCircuitHasData = att => (att && att.rows || []).some(row => ['tempC', 'frequencyHz', 'ratedVoltageKV', 'ratedCurrentA', 'testVoltage', 'testVoltageKV', 'testCurrentA', 'powerKw', 'copperLossKw', 'nameplateUkPct', 'initialUkPct'].some(k => valueOf(row[k]) !== null));

  // Ngưỡng theo bộ tiêu chí đang áp dụng (mặc định QĐ 1901 / QĐ 1387; Admin chỉnh được) — không viết cứng
  const LIM = () => Criteria.limits();
  function shortCircuitResults(state, factory) {
    const L = LIM();
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
      const currentAdequate = testCurrentPct !== null && testCurrentPct >= L.SC_CURRENT_MIN;
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
      const ukStatus = deltaUkPct === null || !conditionsReady ? 'warn' : Math.abs(deltaUkPct) <= L.UK_DEV ? 'pass' : 'fail';
      let uk1387Status = 'warn';
      if (conditionsReady && testCase === 'new') {
        uk1387Status = tapRole !== 'main' ? 'na' : deltaUk1387Pct === null ? 'warn' : Math.abs(deltaUk1387Pct) <= L.UK1387_NEW ? 'pass' : 'fail';
      } else if (conditionsReady && deltaInitialUkPct !== null) uk1387Status = Math.abs(deltaInitialUkPct) <= L.UK1387_INIT ? 'pass' : 'fail';
      const pkStatus = deltaPkPct === null || !conditionsReady ? 'warn' : deltaPkPct <= L.PK_RISE ? 'pass' : 'fail';
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
          // Điều 35: Uk từng pha không lệch quá 3% giá trị trung bình 3 pha → độ lệch lớn nhất của một pha so với trung bình
          phaseDeltaPct = mean ? Math.max(...values.map(v => Math.abs(v - mean))) / mean * 100 : null;
          phaseStatus = phaseDeltaPct === null ? 'warn' : phaseDeltaPct <= L.UK_PHASE ? 'pass' : 'fail';
        } else phaseStatus = 'warn';
      }
      if (is3Phase && ['overhaul', 'operation'].includes(x.testCase) && !['pass', 'fail'].includes(phaseStatus)) x.uk1387Status = 'warn';
      const overallStatuses = [x.ukStatus, x.uk1387Status, x.pkStatus, phaseStatus];
      const overall = overallStatuses.includes('fail') ? 'fail'
        : overallStatuses.every(status => ['pass', 'na'].includes(status)) ? 'pass' : 'warn';
      return Object.assign({}, x, { phaseStatus, phaseDeltaPct, overall });
    });
  }

  // Dòng đánh giá hạng mục Thí nghiệm ngắn mạch (Evaluate gộp vào kết quả chung của biên bản)
  function shortCircuitFindings(state, factory) {
    const L = LIM(), fmt = Common.fmt, out = [];
    const layout = state.cfg && (state.cfg.template === 'custom' ? state.cfg.layout : state.cfg.template);
    const is3Phase = ['3P', '110'].includes(layout), phaseGroups = new Set();
    const add = f => out.push(Object.assign({ sec: 'shortCircuit' }, f));
    shortCircuitResults(state, factory).forEach(x => {
      const loc = [x.serial, x.row.pair, `nấc ${x.row.tap || '—'}`, x.phase && `pha ${x.phase}`].filter(Boolean).join(' · ');
      const conditions = [];
      if (!x.sameFrequency) conditions.push('Tần số thử chưa khớp tần số định mức');
      if (!x.currentAdequate) conditions.push(`Dòng thử cần đạt ít nhất ${L.SC_CURRENT_MIN}% In`);
      const suffix = conditions.length ? `${conditions.join('. ')}.` : '';
      add({ item: 'Trở kháng ngắn mạch Uk so với Test Report', loc,
        meas: x.ukPct == null ? 'Chưa đủ số liệu tính Uk' : `${fmt(x.ukPct, 3)} %`,
        ref: x.ref && x.ref.ukPct != null ? `${fmt(x.ref.ukPct, 3)} % (Test Report)` : '',
        dev: x.deltaUkPct == null ? '' : `${fmt(x.deltaUkPct, 2)} %`, limit: `|ΔUk| ≤${L.UK_DEV}%; f thử = f định mức; I thử ≥${L.SC_CURRENT_MIN}% In`,
        status: x.ukStatus, basis: 'QĐ 1901/QĐ-EVNNPT Điều 35; QĐ 1387/QĐ-EVNNPT Điều 25–26',
        note: [!x.ref && 'Chưa có dữ liệu Test Report tương ứng', suffix].filter(Boolean).join(' ') });
      if (x.uk1387Status !== 'na') {
        const baseUk = x.testCase === 'new' ? x.nameplateUkPct : x.initialUkPct;
        const delta = x.testCase === 'new' ? x.deltaUk1387Pct : x.deltaInitialUkPct;
        add({ item: x.testCase === 'new' ? 'Uk so với nhãn máy' : 'Uk so với giá trị ban đầu', loc,
          meas: x.ukPct == null ? 'Chưa đủ số liệu tính Uk' : `${fmt(x.ukPct, 3)} %`,
          ref: baseUk == null ? '' : `${fmt(baseUk, 3)} %`,
          dev: delta == null ? '' : `${fmt(delta, 2)} %`,
          limit: x.testCase === 'new' ? `|ΔUk| ≤${L.UK1387_NEW}% tại nấc chính` : `|ΔUk| ≤${L.UK1387_INIT}% so với Uk ban đầu`,
          status: x.uk1387Status, basis: 'QĐ 1387/QĐ-EVNNPT Điều 27',
          note: [baseUk == null && (x.testCase === 'new' ? 'Chưa có Uk nhãn máy/Test Report' : 'Cần nhập Uk ban đầu'), suffix].filter(Boolean).join(' ') });
      }
      add({ item: 'Tổn hao có tải Pk so với Test Report', loc,
        meas: x.pkAtReportTempKw == null ? 'Chưa đủ số liệu quy đổi Pk' : `${fmt(x.pkAtReportTempKw, 3)} kW`,
        ref: x.ref && x.ref.pkKw != null ? `${fmt(x.ref.pkKw, 3)} kW (Test Report)` : '',
        dev: x.deltaPkPct == null ? '' : `${fmt(x.deltaPkPct, 2)} %`, limit: `Pk quy đổi ≤${100 + L.PK_RISE}% Test Report`,
        status: x.pkStatus, basis: 'QĐ 1901/QĐ-EVNNPT Điều 35; QĐ 1387/QĐ-EVNNPT Điều 27',
        note: [!x.ref && 'Chưa có dữ liệu Test Report tương ứng', x.pkStatus === 'warn' && 'Thiếu dữ liệu hiệu chỉnh Pk theo nhiệt độ', suffix].filter(Boolean).join(' ') });
      if (is3Phase) {
        const group = `${x.row.pair}|${x.row.tap}`;
        if (!phaseGroups.has(group)) {
          phaseGroups.add(group);
          add({ item: 'Độ lệch Uk giữa các pha', loc: `${x.row.pair} · nấc ${x.row.tap || '—'}`,
            meas: x.phaseDeltaPct == null ? 'Chưa đủ số liệu cả ba pha' : `${fmt(x.phaseDeltaPct, 2)} %`,
            limit: `Độ lệch giữa các pha ≤${L.UK_PHASE}%`, status: x.phaseStatus,
            basis: 'QĐ 1901/QĐ-EVNNPT Điều 35; QĐ 1387/QĐ-EVNNPT Điều 27',
            note: x.phaseDeltaPct == null ? 'Cần đủ Uk của pha A, B và C với điều kiện thử đạt' : '' });
        }
      }
    });
    return out;
  }

  // Nội dung kết quả ngắn mạch dùng chung cho phụ lục và mục cuối thân biên bản; num(n) đánh số tiểu mục (1. / 12.1)
  function shortCircuitBlocks(results, out, num) {
    const blocks = [];
    blocks.push({ type: 'p', text: `${num(1)} Số liệu thí nghiệm`, bold: true, size: 12, keepNext: true });
    const fmt = (x, digits = 2) => x === null || x === undefined || !Number.isFinite(Number(x)) ? '—' : out(Number(x).toFixed(digits));
    const inputRows = results.map(x => [x.row.pair || '', `${x.row.tap || ''}${x.phase ? ` / ${x.phase}` : ''}`, x.testCase === 'new' ? 'Mới' : x.testCase === 'overhaul' ? 'Đại tu' : 'Vận hành', x.tapRole === 'main' ? 'Nấc chính' : 'Nấc khác', fmt(x.tempC, 1), fmt(x.frequencyHz, 2), fmt(x.ratedFrequencyHz, 2), fmt(x.testVoltageInput, 2), x.testVoltageUnit, fmt(x.measuredVoltageKV, 4), fmt(x.ratedVoltageKV, 3), fmt(x.ratedCurrentA, 2), fmt(x.testCurrentA, 2), fmt(x.testCurrentPct, 1), fmt(x.powerKw, 3)]);
    blocks.push({ type: 'table', size: 8, head: ['Cặp cuộn', 'Nấc / pha', 'Trường hợp', 'Vị trí nấc', 'T (°C)', 'f đo', 'fđm (Hz)', 'U đo', 'Đơn vị', 'U quy đổi (kV)', 'Un (kV)', 'In (A)', 'I đo (A)', 'I/In (%)', 'P đo (kW)'],
      widths: [650, 700, 670, 700, 500, 500, 560, 520, 420, 740, 580, 560, 600, 560, 650], rows: inputRows });
    const correctionRows = results.map(x => [x.row.pair || '', `${x.row.tap || ''}${x.phase ? ` / ${x.phase}` : ''}`, fmt(x.copperLossKw, 3), fmt(valueOf(x.row.tempFactor), 0), fmt(x.reportTempC, 1)]);
    blocks.push({ type: 'table', size: 8, head: ['Cặp cuộn', 'Nấc / pha', 'PI²R đo (kW)', 'K vật liệu', 'Nhiệt độ Pk Test Report (°C)'], widths: [1600, 1800, 1200, 900, 2200], rows: correctionRows });
    blocks.push({ type: 'p', text: `${num(2)} So sánh Uk`, bold: true, size: 12, keepNext: true, before: 180 });
    const stateText = s => s === 'pass' ? 'Đạt' : s === 'fail' ? 'Không đạt' : s === 'na' ? '—' : 'Cần xem xét';
    const ukRows = results.map(x => [x.row.pair || '', `${x.row.tap || ''}${x.phase ? ` / ${x.phase}` : ''}`, x.sameFrequency ? 'Đạt' : 'Cần xem xét', x.currentAdequate ? 'Đạt' : 'Cần xem xét', fmt(x.ukPct, 3), fmt(x.nameplateUkPct, 3), fmt(x.deltaUk1387Pct, 2), fmt(x.ref && x.ref.ukPct, 3), fmt(x.deltaUkPct, 2), stateText(x.ukStatus), fmt(x.initialUkPct, 3), fmt(x.deltaInitialUkPct, 2), stateText(x.uk1387Status), fmt(x.phaseDeltaPct, 2), stateText(x.phaseStatus), stateText(x.overall)]);
    blocks.push({ type: 'table', size: 8, head: ['Cặp', 'Nấc / pha', 'f = fđm', 'I ≥ 25% In', 'Uk đo (%)', 'Uk nh\u00e3n m\u00e1y (%)', '\u0394Uk nh\u00e3n (%)', 'Uk Test Report (%)', 'ΔUk Report (%)', 'QĐ1901', 'Uk ban đầu (%)', 'ΔUk ban đầu (%)', 'QĐ1387', 'Lệch pha (%)', '\u0054\u00ecnh tr\u1ea1ng pha', '\u004b\u1ebft lu\u1eadn'],
      widths: [470, 560, 500, 550, 560, 650, 600, 480, 620, 550, 600, 550, 480, 600, 450, 520], rows: ukRows });
    blocks.push({ type: 'p', text: `${num(3)} So sánh Pk`, bold: true, size: 12, keepNext: true, before: 180 });
    const pkRows = results.map(x => [x.row.pair || '', `${x.row.tap || ''}${x.phase ? ` / ${x.phase}` : ''}`, fmt(x.pkAtReportTempKw, 3), fmt(x.ref && x.ref.pkKw, 3), fmt(x.deltaPkPct, 2), x.currentAdequate ? 'Đạt' : 'Cần xem xét', stateText(x.pkStatus)]);
    blocks.push({ type: 'table', size: 8, head: ['Cặp / nấc / pha', 'Pk quy đổi cùng điều kiện (kW)', 'Pk Test Report (kW)', 'ΔPk (%)', 'I ≥ 25% In', 'Pk', 'Kết luận'], widths: [1800, 2200, 1900, 900, 1000, 700, 900], rows: pkRows });
    blocks.push({ type: 'p', text: 'Uk (%) = U / Un × In / I × 100, với U, I, Un và In cùng phía đo; U nhập theo V hoặc kV rồi quy về kV trước tính. Pk quy về dòng định mức: Pk1 = Pđo × (In / I)². Khi nhiệt độ khác Test Report: Pk2 = Pcu1 × (K + t2) / (K + t1) + Pstr1 × (K + t1) / (K + t2), trong đó Pstr1 = Pk1 − Pcu1; K = 235 cho dây đồng, K = 225 cho dây nhôm.', size: 9, before: 120 });
    blocks.push({ type: 'p', text: 'Ph\u1ea1m vi theo Q\u0110 1387: th\u00ed nghi\u1ec7m sau l\u1eafp \u0111\u1eb7t m\u1edbi v\u00e0 \u0111\u1ea1i tu/c\u1ea3i t\u1ea1o; khi \u0111ang v\u1eadn h\u00e0nh, th\u1ef1c hi\u1ec7n sau khi d\u00f2ng ng\u1eafn m\u1ea1ch \u0111\u00e3 qua v\u01b0\u1ee3t 70% d\u00f2ng ch\u1ecbu \u0111\u1ef1ng t\u00ednh to\u00e1n. V\u1edbi OLTC, \u0111o n\u1ea5c ch\u00ednh v\u00e0 hai n\u1ea5c \u0111\u1ea7u/cu\u1ed1i; BCT kh\u00f4ng s\u1eed d\u1ee5ng ph\u1ea3i ng\u1eafn m\u1ea1ch v\u00e0 n\u1ed1i \u0111\u1ea5t.', size: 9 });
    blocks.push({ type: 'p', text: 'Căn cứ QĐ 1387/QĐ-EVNNPT: Điều 26 yêu cầu dòng thử không nhỏ hơn 25% In; khi hiện trường không có điện áp thử theo Test Report, dùng 380 V hoặc điện áp không quá 10 kV và nội suy. Điều 27: MBA mới sai số Uk không quá 5% tại nấc chính; sau đại tu/đang vận hành không quá 3% so với giá trị ban đầu và giữa các pha; Pk quy về cùng điều kiện không lớn hơn 115% số liệu nhà chế tạo. App đồng thời giữ tiêu chí QĐ 1901 Điều 35: Uk sai lệch không quá 3%, Pk không quá 115%, và MBA ba pha kiểm tra lệch pha không quá 3%. Thiếu tham chiếu, sai tần số, dòng thử dưới 25% In hoặc thiếu dữ liệu quy đổi được ghi “Cần xem xét”.', size: 9 });
    return blocks;
  }

  function shortCircuitAppendix(state, results, factoryName, out, label = 'PHỤ LỤC') {
    const v = state.v || {}, blocks = [{ type: 'page' },
      { type: 'p', text: label, bold: true, size: 14, align: 'center' },
      { type: 'p', text: 'KẾT QUẢ THÍ NGHIỆM TỔN THẤT NGẮN MẠCH VÀ ĐIỆN ÁP NGẮN MẠCH MÁY BIẾN ÁP', bold: true, size: 13, align: 'center' }];
    if (v['meta.project'] || v['meta.site']) blocks.push({ type: 'p', text: [v['meta.project'], v['meta.site']].filter(Boolean).join(' – '), align: 'center', size: 12 });
    blocks.push({ type: 'p', text: `Số chế tạo: ${v['meta.serial'] || '—'} · Test Report: ${factoryName || 'chưa nạp'}`, italic: true, size: 10, align: 'center', after: 160 });
    blocks.push({ type: 'p', text: 'Quy trình tham khảo: QĐ 1387/QĐ-EVNNPT (25/04/2015), Điều 25–27; Tài liệu đào tạo thí nghiệm MBA (2026), I.11.', italic: true, size: 9, align: 'center', after: 140 });
    blocks.push(...shortCircuitBlocks(results, out, n => `${n}.`));
    blocks.push({ type: 'p', text: 'Người thí nghiệm', bold: true, size: 12, align: 'right', after: 1200 });
    return blocks;
  }

  function standardsAppendix(label = 'PHỤ LỤC') {
    return [
      { type: 'page' },
      { type: 'p', text: label, bold: true, size: 14, align: 'center' },
      { type: 'p', text: 'BẢNG TRA CỨU TIÊU CHUẨN THÍ NGHIỆM MÁY BIẾN ÁP THEO HẠNG MỤC', bold: true, size: 13, align: 'center' },
      { type: 'p', text: 'Bảng tra cứu phụ lục cuối BBTN: QĐ EVNNPT nêu tiêu chí áp dụng theo quy định; IEC/IEEE ghi các bộ tiêu chuẩn, mã thử và hướng dẫn liên quan. Viện dẫn IEC/IEEE không tự tạo thêm giới hạn đạt/không đạt nếu văn bản không quy định. Khi thiếu ngưỡng chung, đối chiếu Test Report, nhà chế tạo, giá trị gốc và quy trình được duyệt.', size: 9, after: 160 },
      { type: 'table', size: 8, head: ['Hạng mục', 'QĐ EVNNPT — tiêu chí', 'IEC liên quan', 'IEEE liên quan'],
        widths: [1400, 4500, 1650, 1950], rows: STANDARD_LOOKUP },
      { type: 'p', text: 'Tình trạng viện dẫn được rà soát theo danh mục công bố ngày 15/11/2026. IEEE C57.12.90-2026 đang được ghi là approved draft; chỉ áp dụng khi đã được viện dẫn/ban hành trong hồ sơ kiểm soát của dự án. IEEE C57.12.200 được ghi đúng số hiệu như Điều 38 QĐ 1901; cần xác minh số hiệu trên bản quy định được kiểm soát trước khi phát hành.', size: 8, before: 120 },
    ];
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
    // thí nghiệm ngắn mạch: mục cuối thân biên bản (MbaReport.fill); chỉ thành phụ lục khi template không có chỗ chèn
    if (has.shortCircuit && shortCircuitHasData(att.shortCircuit)) out.push({ kind: 'shortCircuit' });
    // mẫu chung 3 pha: biến dòng chân sứ không có bảng trong thân BBTN → phụ lục dựng từ số liệu mục BCT
    if (has.bct) out.push({ kind: 'bct' });
    // phụ lục bảng tra cứu tiêu chuẩn: chỉ khi chọn kèm (cfg.stdAppendix = 'on'); mặc định BBTN như mẫu giấy
    if (state.cfg && state.cfg.stdAppendix === 'on') out.push({ kind: 'standards' });
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

  window.Appendix = { SFRA_URL, DGA_URL, dgaLink, oilSummary, serialMatch, fraSummary, shortCircuitPairs, shortCircuitHasData, shortCircuitResults, shortCircuitFindings, shortCircuitBlocks, shortCircuitAppendix, standardsAppendix, list, fraHeader, oilHeader };
})();
