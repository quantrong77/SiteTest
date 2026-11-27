// Đọc file số liệu xuất xưởng (.xlsx) → cấu trúc tra cứu theo SỐ CHẾ TẠO.
// Định vị theo nhãn/tiêu đề cột thay vì địa chỉ ô cố định, để file sửa đổi nhẹ vẫn đọc được.
// Nhận hai bố cục: cột theo "Máy N (số chế tạo)" (vd test report AT1) và cột theo "Pha A (số chế tạo)" với nấc, cuộn dây,
// sứ ghi từng dòng (vd test report máy 2). Phần nào không có trong file thì ghi cảnh báo, không làm hỏng cả file.
(function () {
  'use strict';

  const num = v => {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return v;
    const m = String(v).replace(',', '.').match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  };
  const pct = v => (v === null || v === undefined) ? null : (typeof v === 'string' && v.includes('%') ? num(v) : num(v));
  const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Khóa sơ đồ đo cách điện, giữ dấu +/- để phân biệt "HV+MV+N-LV+TANK" và "HV+MV+N+LV-TANK"
  const cfgKey = s => String(s || '').toUpperCase().replace(/\s/g, '');
  // Ghép lần đo không tải với mức điện áp xuất xưởng (quy tắc ghép, không phải ngưỡng đánh giá):
  // U lệch ≤ 5 % coi là cùng mức → so và đánh giá; lệch hơn nhưng ≤ 25 % → ghép mức kV gần nhất để tham khảo (không đánh giá)
  const NOLOAD_U_MATCH = 5, NOLOAD_U_NEAR = 25;
  const rowsOf = ws => XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  function findSheet(wb, re) {
    const name = wb.SheetNames.find(n => re.test(n));
    return name ? { name, rows: rowsOf(wb.Sheets[name]) } : null;
  }

  // Cột số liệu của từng máy → số chế tạo: tiêu đề "Máy N…", có ghi số chế tạo, hoặc "Pha A/B/C…".
  // skip: bỏ cột phụ (vd "Pha A Đánh giá").
  function unitCols(header, F, skip) {
    const out = [];
    (header || []).forEach((h, c) => {
      const t = String(h || '');
      if (!t || (skip && skip.test(t))) return;
      const m = t.match(/Máy\s*(\d+)/i);
      let serial = m && F.machines[m[1]] ? F.machines[m[1]] : null;
      if (!serial) serial = F.order.find(sn => t.includes(sn)) || null;
      if (!serial) {
        // "Pha A" (chữ pha viết hoa, đứng riêng) — không nhầm "Độ lệch pha cực đại"
        const p = t.match(/[Pp][Hh][Aa]\s*([ABC])(?!\p{L})/u);
        if (p) serial = F.order.find(sn => F.units[sn].phase === p[1].toUpperCase()) || null;
      }
      if (serial) out.push({ c, serial, text: t });
    });
    return out;
  }
  // "SN001 - Pha A" | "Pha A - SN001" → { serial, phase }
  function unitOf(inner) {
    const phase = ((inner.match(/Pha\s*([ABC])/i) || [])[1] || '').toUpperCase();
    const serial = inner.replace(/Pha\s*[ABC]/i, '').replace(/^[\s\-–]+|[\s\-–]+$/g, '').trim();
    return { serial, phase };
  }
  const serialIn = v => (String(v || '').match(/[A-Z]{1,3}\d{5,}[A-Z0-9-]*/i) || [String(v || '').trim()])[0];

  function parse(wb, fileName) {
    const F = {
      fileName, units: {}, machines: {}, order: [], overview: [], specs: {}, ratio: { taps: [], mvlv: null, polarity: {} },
      dcr: { rows: [], refT: 75 }, ins: {}, bushings: [], bushingCriteria: {}, bushingSpecs: [], conditions: {}, bct: [],
      losses: [], warnings: [], sheets: wb.SheetNames.map(n => ({ name: n, rows: rowsOf(wb.Sheets[n]) })),
    };

    // --- Tổng quan: map Máy N ↔ số chế tạo ↔ pha
    const ov = findSheet(wb, /overview|tổng/i) || { rows: rowsOf(wb.Sheets[wb.SheetNames[0]]) };
    let hdrIdx = ov.rows.findIndex(r => r && r.some(c => /Máy\s*\d+\s*\(/i.test(String(c || ''))));
    if (hdrIdx >= 0) {
      ov.rows[hdrIdx].forEach(c => {
        const m = String(c || '').match(/Máy\s*(\d+)\s*\(([^)]*)\)/i);
        if (!m) return;
        const u = unitOf(m[2]);
        if (!u.serial) return;
        F.machines[m[1]] = u.serial;
        F.units[u.serial] = { serial: u.serial, machine: +m[1], phase: u.phase };
        F.order.push(u.serial);
      });
      const mc = unitCols(ov.rows[hdrIdx], F);
      // cột nhãn: "Hạng mục…" (cột 1 nếu có cột STT, cột 0 nếu không)
      const lc = Math.max(0, ov.rows[hdrIdx].findIndex(x => /Hạng mục/i.test(String(x || ''))));
      for (let r = hdrIdx + 1; r < ov.rows.length; r++) {
        const row = ov.rows[r];
        if (!row || !row[lc]) continue;
        const vals = {};
        mc.forEach(({ c, serial }) => { vals[serial] = row[c]; });
        F.overview.push({ label: String(row[lc]), unit: row[lc + 1], guarantee: row[lc + 2], vals });
      }
      const nl = F.overview.find(o => /Tổn hao không tải/i.test(o.label));
      if (nl) Object.entries(nl.vals).forEach(([s, v]) => { F.units[s].noLoadLoss = num(v); });
      const job = F.overview.find(o => /Job/i.test(o.label));
      if (job) Object.entries(job.vals).forEach(([s, v]) => { F.units[s].jobNo = v; });
    } else F.warnings.push('Không tìm thấy dòng tiêu đề "Máy N (số chế tạo)" ở sheet tổng quan.');

    // --- Thông số / nameplate
    const sp = findSheet(wb, /spec|nameplate/i);
    // bố cục theo pha: mỗi dòng một thông số, các cột là pha A/B/C (lấy giá trị pha A); phía HV/MV/LV ghi trong nhãn
    const spPerPhase = sp && sp.rows.some(r => r && r.slice(2).some(c => /Pha\s*[ABC]\b/i.test(String(c || ''))));
    if (sp && spPerPhase) sp.rows.forEach(r => {
      if (!r || !r[0] || r[2] === null || r[2] === undefined) return;
      const label = String(r[0]), val = r[2];
      const side = /\(HV\)|\bHV\b|Cao áp/i.test(label) ? 'HV' : /\(MV\)|\bMV\b|Trung áp/i.test(label) ? 'MV' : /\(LV\)|\bLV\b|Hạ áp/i.test(label) ? 'LV' : null;
      const put = key => { F.specs[key] = F.specs[key] || { label: label.replace(/\s*(HV|MV|LV|cuộn.*)$/i, ''), unit: r[1] }; if (side) F.specs[key][side] = val; };
      if (/^Kiểu máy/i.test(label)) F.specs.type = val;
      else if (/OLTC/i.test(label)) { if (!F.specs.oltc && !/Dòng|Mức cách điện/i.test(label)) F.specs.oltc = val; }
      else if (/Dung lượng/i.test(label)) put('power');
      else if (/Điện áp định mức/i.test(label)) put('voltage');
      else if (/Dòng điện định mức/i.test(label)) put('current');
      else if (/Tổ đấu dây/i.test(label)) F.specs.vector = val;
      else if (/Nhà sản xuất/i.test(label)) F.specs.manufacturer = val;
    });
    else if (sp) sp.rows.forEach(r => {
      if (!r || !r[0]) return;
      const label = String(r[0]);
      const rec = { label, unit: r[1], HV: r[2], MV: r[3], LV: r[4], note: r[5] };
      if (/^Kiểu máy/i.test(label)) F.specs.type = r[2];
      else if (/Dung lượng/i.test(label)) F.specs.power = rec;
      else if (/Điện áp định mức/i.test(label)) F.specs.voltage = rec;
      else if (/Dòng điện định mức/i.test(label)) F.specs.current = rec;
      else if (/Tổ đấu dây/i.test(label)) F.specs.vector = r[2];
      else if (/OLTC|điều chỉnh điện áp/i.test(label)) F.specs.oltc = r[2];
      else if (/Mức cách điện/i.test(label)) F.specs.insLevel = rec;
    });

    // --- Tỷ số biến
    const vr = findSheet(wb, /ratio/i);
    if (vr) {
      // dòng tiêu đề cột: ô đầu "Nấc…" và có cột số liệu của các máy (bỏ qua dòng tên bảng "…17 NẤC PHÂN ÁP")
      let h = vr.rows.findIndex(r => r && /Nấc/i.test(String(r[0] || '')) && unitCols(r, F).length >= 2);
      if (h < 0) h = vr.rows.findIndex(r => r && /Nấc/i.test(String(r[0] || '')));
      const head = (vr.rows[h] || []).map(x => String(x || ''));
      const mc = unitCols(head, F, /Đánh giá|Evaluation|Cực tính|Polarity/i);
      const limC = head.findIndex(x => /Giới hạn|Limit/i.test(x)), polC = head.findIndex(x => /Cực tính|Polarity/i.test(x));
      for (let r = h + 1; h >= 0 && r < vr.rows.length; r++) {
        const row = vr.rows[r];
        if (!row || row[0] === null) continue;
        const err = {};
        mc.forEach(({ c, serial }) => { err[serial] = row[c]; });
        const tap = String(row[0]).trim().replace(/^Tap\s*/i, '');
        // cột cực tính theo từng nấc (bố cục theo pha): lấy làm cực tính chung của các máy
        if (polC >= 0 && row[polC] && !Object.keys(F.ratio.polarity).length) F.order.forEach(sn => { F.ratio.polarity[sn] = row[polC]; });
        if (/^\d+[A-Z]?$/i.test(tap)) {
          F.ratio.taps.push({ tap: tap.toUpperCase(), hvKV: num(row[1]), mvKV: num(row[2]), nominal: num(row[3]), err, limit: limC >= 0 ? row[limC] : null });
        } else if (/MV\s*[-–]?\s*LV/i.test(tap)) {
          F.ratio.mvlv = { mvKV: num(row[1]), lvKV: num(row[2]), nominal: num(row[3]), err };
        } else if (/Polar/i.test(tap)) {
          F.ratio.polarity = err;
        }
      }
    } else F.warnings.push('Không có sheet tỷ số biến.');

    // --- Điện trở một chiều
    const dr = findSheet(wb, /DC Resist/i);
    if (dr) {
      const h = dr.rows.findIndex(r => r && unitCols(r, F).length >= 2); // ≥ 2 cột máy: bỏ qua dòng tên bảng "…3 PHA A, B, C"
      const head = (dr.rows[h] || []).map(x => String(x || ''));
      const refM = String(dr.rows[0] && dr.rows[0][0] || '').match(/(\d+)\s*°C/) || head.join(' ').match(/(\d+)\s*°C/);
      if (refM) F.dcr.refT = +refM[1];
      const meas = {}, conv = {};
      // cột "Quy đổi 75°C" / "75°C" là giá trị quy đổi; "Đo" / "Đo thực" là giá trị đo
      unitCols(head, F).forEach(({ c, serial, text }) => { (/Quy đổi|\d+\s*°C/i.test(text) && !/Đo thực/i.test(text) ? conv : meas)[serial] = c; });
      // nấc ở cột riêng ("Vị trí nấc") hoặc trong nhãn ("Cuộn SER - Tap 1")
      const tapC = head.findIndex((x, i) => i > 0 && /nấc|^Tap/i.test(x));
      for (let r = h + 1; h >= 0 && r < dr.rows.length; r++) {
        const row = dr.rows[r];
        if (!row || !row[0]) continue;
        const label = String(row[0]);
        const w = /SER/i.test(label) ? 'SER' : /COM/i.test(label) ? 'COM' : /LV/i.test(label) ? 'LV' : null;
        if (!w) continue;
        const tc = tapC >= 0 ? String(row[tapC] ?? '').trim().replace(/^Tap\s*/i, '') : '';
        const tm = /^\d+[A-Z]?$/i.test(tc) ? [null, tc] : label.match(/Tap\s*([0-9]+[A-Z]?)/i);
        const rec = { winding: w, tap: tm ? tm[1].toUpperCase() : null, label: tm && tapC >= 0 ? `${label} - Tap ${tm[1]}` : label, meas: {}, r75: {} };
        Object.entries(meas).forEach(([s, c]) => { rec.meas[s] = num(row[c]); });
        Object.entries(conv).forEach(([s, c]) => { rec.r75[s] = num(row[c]); });
        F.dcr.rows.push(rec);
      }
      if (h < 0) F.warnings.push('Sheet điện trở một chiều: không nhận được cột số liệu của các máy.');
    } else F.warnings.push('Không có sheet điện trở một chiều.');

    // --- Cách điện, Kht, PI, C, tgδ cuộn dây
    const ins = findSheet(wb, /Insulation|TanDelta/i);
    const insH = ins ? ins.rows.findIndex(r => r && unitCols(r, F).length >= 2) : -1;
    const insPerRow = insH >= 0 && !/Thông số/i.test(String(ins.rows[insH][1] || ''));
    if (ins && insPerRow) {
      // bố cục theo pha: mỗi dòng một đại lượng của một sơ đồ đo, vd "R60 cuộn HV+MV+N đến LV+Tank", "Tan Delta LV đến HV+MV+N+Tank"
      const head = ins.rows[insH].map(x => String(x || ''));
      const mc = unitCols(head, F, /Đánh giá/i), limC = head.findIndex(x => /Tiêu chuẩn|Giới hạn/i.test(x));
      const cfgOf = t => cfgKey(String(t).replace(/\s*(đến|→|->)\s*/i, '-'));
      const MAIN = 'HV+MV+N-LV+TANK'; // Kht, PI chỉ ghi một dòng chung → gán cho sơ đồ cao, trung ~ hạ, vỏ
      for (let r = insH + 1; r < ins.rows.length; r++) {
        const row = ins.rows[r];
        if (!row || !row[0]) continue;
        const a = String(row[0]);
        let param = null, cfg = null;
        const paren = (a.match(/\(([^)]*[+-][^)]*)\)\s*$/) || [])[1];
        if (/Core|Clamp|Mạch từ|Gông từ/i.test(a)) {
          const k = cfgKey(paren || '');
          param = 'r60'; cfg = /^CORE-CLAMP\+/.test(k) ? 'CORE' : /^CLAMP-CORE/.test(k) ? 'CLAMP' : k === 'CORE-CLAMP' ? 'CORE-CLAMP' : null;
        } else if (/^R60/i.test(a)) { param = 'r60'; cfg = cfgOf(a.replace(/^R60\s*(cuộn)?\s*/i, '')); }
        else if (/Kht|hấp thụ/i.test(a)) { param = 'kht'; cfg = MAIN; }
        else if (/\bPI\b|cực hóa/i.test(a)) { param = 'pi'; cfg = MAIN; }
        else if (/^Điện dung|Capacitance/i.test(a)) { param = 'c'; cfg = cfgOf(a.replace(/^Điện dung\s*(cuộn dây)?\s*/i, '')); }
        else if (/Tan\s*Delta|Tan\s*δ|tgδ/i.test(a)) { param = 'tgd'; cfg = cfgOf(a.replace(/^.*?(Tan\s*Delta|Tan\s*δ|tgδ)\s*/i, '')); }
        if (!param || !cfg) continue;
        F.ins[cfg] = F.ins[cfg] || {};
        F.ins[cfg][param] = {};
        mc.forEach(({ c, serial }) => { F.ins[cfg][param][serial] = param === 'tgd' ? pct(row[c]) : num(row[c]); });
        F.ins[cfg][param].limit = limC >= 0 ? row[limC] : null;
      }
    } else if (ins) {
      const h = insH;
      const mc = unitCols(ins.rows[h], F);
      for (let r = h + 1; r < ins.rows.length; r++) {
        const row = ins.rows[r];
        if (!row || !row[0]) continue;
        const a = String(row[0]), b = String(row[1] || '');
        let param, cfg;
        if (/R60\/R15|K_ht|hấp thụ/i.test(b)) param = 'kht';
        else if (/PI|R600/i.test(b)) param = 'pi';
        else if (/^Core/i.test(b)) { param = 'r60'; cfg = 'CORE'; }
        else if (/^Clamp/i.test(b)) { param = 'r60'; cfg = 'CLAMP'; }
        else if (/Capacitance|Điện dung/i.test(a)) param = 'c';
        else if (/Tan/i.test(a)) param = 'tgd';
        if (!param) continue;
        if (!cfg) {
          const src = param === 'kht' || param === 'pi' ? (/\(([^)]*[+-][^)]*)\)/.exec(a) || [])[1] : b.replace(/\((pF|%|MΩ)\)/, '');
          cfg = cfgKey(src || b);
        }
        F.ins[cfg] = F.ins[cfg] || {};
        F.ins[cfg][param] = {};
        mc.forEach(({ c, serial }) => { F.ins[cfg][param][serial] = param === 'tgd' ? pct(row[c]) : num(row[c]); });
        F.ins[cfg][param].limit = row[5];
      }
    }

    // --- Tổn hao & trở kháng (chỉ để xem)
    const ls = findSheet(wb, /Losses|Impedance/i);
    if (ls) F.losses = ls.rows;
    noLoadLevels(F, ls);

    // --- Sứ xuyên
    const bs = findSheet(wb, /Bushing|Sứ/i);
    if (bs) {
      const specH = bs.rows.findIndex(r => r && /Vị trí/i.test(String(r[0] || '')) && /Cấp điện áp/i.test(String(r[1] || '')));
      if (specH >= 0) {
        for (let r = specH + 1; r < bs.rows.length; r++) {
          const row = bs.rows[r];
          if (!row || !row[0] || /^[IVX]+\./.test(String(row[0]))) break;
          const term = String(row[0]).match(/^([\d.]+)/);
          F.bushingSpecs.push({ terminal: term ? term[1] : String(row[0]), label: String(row[0]), ur: row[1], ac: num(row[3]), li: num(row[4]), type: row[6] });
        }
      }
      const h = bs.rows.findIndex(r => r && r.some(c => /Serial sứ|Bushing Serial|Bushing SN|Mã hiệu sứ/i.test(String(c || ''))));
      if (h >= 0) {
        const head = bs.rows[h].map(x => String(x || ''));
        const col = re => head.findIndex(x => re.test(x));
        const c = {
          mba: col(/Serial MBA|Pha\s*\/\s*Máy/i), term: col(/Vị trí đầu sứ|Vị trí sứ/i), bs: col(/Serial sứ|Bushing Serial|Bushing SN|Mã hiệu sứ/i),
          c1np: col(/C1 Mảnh nhãn|Nameplate C1|C1 Nhãn/i), tdnp: col(/Tanδ Mảnh nhãn|Nameplate Tan|Tanδ Nhãn/i), c1: col(/C1 Đo|Measured C1/i),
          td: col(/Tanδ Đo|Measured Tan/i), t: col(/Nhiệt độ/i),
        };
        for (let r = h + 1; r < bs.rows.length; r++) {
          const row = bs.rows[r];
          if (row && row[0] && /^[IVX]+\./.test(String(row[0]))) break;
          if (!row || !row[c.bs]) { if (row && row[0] && /Tiêu chuẩn/i.test(String(row[0]))) parseBushingCriteria(String(row[0]), F); continue; }
          // tanδ trong file lưu dạng thập phân (0,00336 = 0,336%) — quy về %
          const toPct = v => { const n = num(v); return n === null ? null : (n < 0.05 ? n * 100 : n); };
          const term = String(row[c.term] || '').match(/^([\d.]+)/);
          F.bushings.push({
            mba: F.order.find(sn => String(row[c.mba] || '').includes(sn)) || serialIn(row[c.mba]), terminal: term ? term[1] : String(row[c.term]), terminalLabel: String(row[c.term] || ''),
            serial: String(row[c.bs]).trim(), c1np: num(row[c.c1np]), tdnp: toPct(row[c.tdnp]), c1: num(row[c.c1]), td: toPct(row[c.td]), t: num(row[c.t]),
          });
        }
      }
      if (!F.bushingCriteria.c1) bs.rows.forEach(r => { if (r && r[0] && /Tiêu chuẩn đánh giá/i.test(String(r[0]))) parseBushingCriteria(String(r[0]), F); });
    }

    // --- Điều kiện thí nghiệm (nhiệt độ dầu theo hạng mục, độ ẩm DFR)
    const tc = findSheet(wb, /Conditions|FRA/i);
    if (tc) {
      const h = tc.rows.findIndex(r => r && r.some(c => /Nhiệt độ dầu Máy/i.test(String(c || ''))));
      if (h >= 0) {
        const mc = unitCols(tc.rows[h], F);
        for (let r = h + 1; r < tc.rows.length; r++) {
          const row = tc.rows[r];
          if (!row || !row[0]) continue;
          const label = String(row[0]);
          if (/^[IVX]+\./.test(label)) break;
          // Ngày thí nghiệm xuất xưởng: lấy ngày muộn nhất dạng dd/mm/yyyy trong cột ghi chú
          (String(row[6] || '').match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || []).forEach(d => {
            const [dd, mm, yy] = d.split('/').map(Number);
            const iso = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
            if (!F.reportDate || iso > F.reportDate) F.reportDate = iso;
          });
          const key = /tỷ số/i.test(label) ? 'ratio' : /một chiều/i.test(label) ? 'dcr' : /cách điện|TanDelta/i.test(label) ? 'ins'
            : /không tải/i.test(label) ? 'noload' : /DFR/i.test(label) ? 'dfr' : null;
          if (!key) continue;
          mc.forEach(({ c, serial }) => {
            const s = String(row[c] || '');
            F.conditions[serial] = F.conditions[serial] || {};
            F.conditions[serial][key] = num(s);
            const mo = s.match(/Moisture\s*([\d.]+)\s*%/i);
            if (mo) F.conditions[serial].moisture = parseFloat(mo[1]);
          });
        }
      }
    }

    // --- Biến dòng chân sứ (BCT)
    const bct = findSheet(wb, /BCT|Biến dòng/i);
    if (bct) {
      const h = bct.rows.findIndex(r => r && /Pha\s*\/\s*Máy/i.test(String(r[0] || '')));
      for (let r = h + 1; h >= 0 && r < bct.rows.length; r++) {
        const row = bct.rows[r];
        if (!row || !row[0] || !row[3]) continue;
        const m = String(row[0]).match(/([A-Z]\d{5,})/);
        const ratio = String(row[4] || '').split('/').map(Number);
        F.bct.push({
          mba: F.order.find(sn => String(row[0]).includes(sn)) || (m ? m[1] : String(row[0])), position: row[1], ct: String(row[2] || '').replace(/\D/g, ''), terminal: norm(row[3]),
          terminalLabel: row[3], ratioText: row[4], ratio: ratio.length === 2 && ratio[1] ? ratio[0] / ratio[1] : null,
          r75: num(row[5]), err: num(row[6]), polarity: row[7],
        });
      }
    }

    if (F.order.length && !Object.keys(F.conditions).length) F.warnings.push('File không có bảng điều kiện thí nghiệm (nhiệt độ dầu theo hạng mục, độ ẩm DFR): so sánh cần nhiệt độ hoặc độ ẩm xuất xưởng sẽ thiếu tham chiếu.');
    if (F.order.length && !F.bushingSpecs.length) F.warnings.push('File không có thông số chịu đựng của sứ (AC, LI): mục thử AC sứ không có giá trị tham chiếu.');
    if (!F.order.length) F.warnings.push('Không xác định được số chế tạo các máy trong file xuất xưởng.');
    return F;
  }

  // Mức điện áp ghi trong nhãn: "(100% Ur)", "(90 % Un)", "(10 kV)", "(380 V)". Không ghi → null.
  // MBA 3 pha đo ở điện áp thấp theo cặp pha: "nguồn ab", "(BC)" → pair 'ab' | 'bc' | 'ca'; cuộn đặt nguồn: hạ áp → 'lv', cao / trung áp → 'hv'.
  function levelOf(label) {
    const s = String(label || '').replace(/,/g, '.');
    const pu = s.match(/(\d+(?:\.\d+)?)\s*%\s*U/i);
    const kv = s.match(/(?:^|[\s(@=])(\d+(?:\.\d+)?)\s*(kV|V)(?![A-Za-z])/);
    const out = { pu: pu ? +pu[1] : null, kv: kv ? +kv[1] / (kv[2] === 'V' ? 1000 : 1) : null };
    const pr = s.match(/(?:^|[^A-Za-zÀ-ỹ])(ab|bc|ca|ac)(?![A-Za-zÀ-ỹ])/i);
    if (pr) out.pair = pr[1].toLowerCase() === 'ac' ? 'ca' : pr[1].toLowerCase();
    if (/hạ\s*áp|\bLV\b/i.test(s)) out.side = 'lv'; else if (/cao\s*áp|trung\s*áp|\b[HM]V\b/i.test(s)) out.side = 'hv';
    return out;
  }
  // Giá trị không tải: P → kW, I0 → % hoặc A theo đơn vị trong ô / cột đơn vị
  function nlValue(v, unitHint, kind) {
    const n = num(v);
    if (n === null) return null;
    const u = (typeof v === 'string' && /[a-z%]/i.test(v) ? v : String(unitHint || '')).replace(/\s/g, '');
    if (kind === 'p') return /(^|[^k])W/.test(u) && !/kW/i.test(u) ? { p0: n / 1000 } : { p0: n };
    if (/mA/.test(u)) return { i0A: n / 1000 };
    if (/A/.test(u) && !/%/.test(u)) return { i0A: n };
    return { i0: n };
  }
  // Tổn hao / dòng không tải xuất xưởng theo từng mức điện áp đo → F.units[s].noLoad = [{ pu, kv, p0 (kW), i0 (%), i0A (A) }].
  // Nguồn: bảng tổng quan (không ghi mức → 100 % Ur) và sheet tổn hao (nhãn ghi mức). Dùng để so lần đo hiện trường cùng mức điện áp.
  function noLoadLevels(F, ls) {
    const add = (s, lv, val) => {
      const u = F.units[s];
      if (!u || !val) return;
      const list = u.noLoad = u.noLoad || [];
      const same = x => (lv.kv != null ? x.kv === lv.kv : x.kv == null && x.pu === lv.pu) && x.pair === lv.pair && x.side === lv.side;
      let e = list.find(same);
      if (!e) { e = Object.assign({}, lv); list.push(e); }
      Object.keys(val).forEach(k => { if (e[k] == null) e[k] = val[k]; });
    };
    const kindOf = label => (/kh[ôo]ng\s*t[ảa]i|no.?load/i.test(label) && !/ngắn mạch|mức\s*ồn|độ\s*ồn|noise|sound/i.test(label)
      ? (/tổn hao|loss|\bP0\b|\bPo\b/i.test(label) ? 'p' : /dòng|current|\bI0\b|\bIo\b/i.test(label) ? 'i' : null) : null);
    if (ls) {
      const h = ls.rows.findIndex(r => r && unitCols(r, F, /Đánh giá|Bảo đảm|Guarantee/i).length);
      const mc = h >= 0 ? unitCols(ls.rows[h], F, /Đánh giá|Bảo đảm|Guarantee/i) : [];
      for (let r = h + 1; h >= 0 && r < ls.rows.length; r++) {
        const row = ls.rows[r];
        const label = String(row && row[0] || ''), kind = kindOf(label);
        if (!kind) continue;
        const lv = levelOf(label);
        if (lv.pu == null && lv.kv == null) lv.pu = 100;
        mc.forEach(({ c, serial }) => add(serial, lv, nlValue(row[c], null, kind)));
      }
    }
    F.overview.forEach(o => {
      const kind = kindOf(o.label);
      if (!kind) return;
      const lv = levelOf(o.label);
      if (lv.pu == null && lv.kv == null) lv.pu = 100;
      Object.entries(o.vals).forEach(([s, v]) => add(s, lv, nlValue(v, o.unit, kind)));
    });
  }

  function parseBushingCriteria(text, F) {
    const c1 = text.match(/C1[^±]*±\s*([\d.,]+)\s*%/i);
    const td = text.match(/Tan\S*\s*≤\s*([\d.,]+)\s*%/i);
    if (c1) F.bushingCriteria.c1 = parseFloat(c1[1].replace(',', '.'));
    if (td) F.bushingCriteria.tgd = parseFloat(td[1].replace(',', '.'));
    F.bushingCriteria.text = text.trim();
  }

  // ---------- API tra cứu ----------
  function api(F) {
    const tapKey = t => String(t || '').trim().toUpperCase();
    const pairKey = value => {
      const s = String(value || '').toUpperCase().replace(/[–—−]/g, '-').replace(/\s+/g, ' ');
      if (/HV\s*-\s*MV|CAO\s*[-–]\s*TRUNG|\bC\s*-\s*T\b/.test(s)) return 'HV-MV';
      if (/HV\s*-\s*LV|CAO\s*[-–]\s*HẠ|CAO\s*[-–]\s*HA|\bC\s*-\s*H\b/.test(s)) return 'HV-LV';
      if (/MV\s*-\s*LV|TRUNG\s*[-–]\s*HẠ|TRUNG\s*[-–]\s*HA|\bT\s*-\s*H\b/.test(s)) return 'MV-LV';
      return null;
    };
    function shortCircuitFor(serial) {
      const sn = String(serial || '').trim();
      if (!sn || !F.losses.length) return [];
      const headerAt = F.losses.findIndex(r => r && r.some(c => /Cặp cuộn dây|Winding Pair/i.test(String(c || ''))));
      if (headerAt < 0) return [];
      const head = F.losses[headerAt].map(x => String(x || ''));
      const snKey = norm(sn), directCol = head.findIndex(x => norm(x).includes(snKey));
      const unit = F.units[sn], machine = unit && unit.machine || F.order.indexOf(sn) + 1;
      const machineCol = kind => head.findIndex(x => new RegExp(`(?:Máy|Machine)\\s*${machine}\\b`, 'i').test(x) && new RegExp(kind, 'i').test(x));
      const lossCol = machineCol('Loss|Tổn hao|\\bPk\\b'), ukCol = machineCol('%IZ|Uk|Impedance');
      const byKey = new Map();
      const get = (row, pair, tap) => {
        const key = `${pair}|${tap}`;
        if (!byKey.has(key)) byKey.set(key, { pair, tap, serial: sn, phase: unit && unit.phase || '', pkKw: null, ukPct: null, pkTempC: null });
        return byKey.get(key);
      };
      for (let i = headerAt + 1; i < F.losses.length; i++) {
        const row = F.losses[i];
        if (!row) continue;
        const label = String(row[0] || ''), pair = pairKey(label);
        if (!pair) continue;
        const tap = tapKey(String(row[1] || '-').replace(/^Tap\\s*/i, '')) || '-';
        const entry = get(row, pair, tap);
        if (lossCol >= 0 && ukCol >= 0) {
          const loss = num(row[lossCol]), uk = num(row[ukCol]);
          if (loss !== null) {
            entry.pkKw = loss;
            const tm = label.match(/\(?\s*(\d+(?:[.,]\d+)?)\s*°\s*C\s*\)?/i);
            if (tm) entry.pkTempC = Number(tm[1].replace(',', '.'));
          }
          if (uk !== null) entry.ukPct = uk;
          continue;
        }
        if (directCol < 0) continue;
        const pk = /(tổn\s*hao|loss|\bPk\b)/i.test(label) && !/(không\s*tải|no.?load)/i.test(label);
        const uk = /(trở\s*kháng|điện\s*áp|impedance|%IZ|\bUk\b)/i.test(label) && !/(không\s*tải|no.?load)/i.test(label);
        if (pk) {
          entry.pkKw = num(row[directCol]);
          const tm = label.match(/\(?\s*(\d+(?:[.,]\d+)?)\s*°\s*C\s*\)?/i);
          if (tm) entry.pkTempC = Number(tm[1].replace(',', '.'));
          const phase = label.match(/Pha\s*([ABC])\b/i);
          if (phase) entry.phase = phase[1].toUpperCase();
        }
        if (uk) entry.ukPct = num(row[directCol]);
      }
      return Array.from(byKey.values()).filter(x => x.pkKw !== null || x.ukPct !== null);
    }
    // Nấc hiện trường (vd 9a/9b/9c) → nấc trong biên bản xuất xưởng (9A)
    function matchTap(list, tap) {
      const k = tapKey(tap);
      if (!k) return null;
      let hit = list.find(x => x.tap === k);
      if (hit) return hit;
      const n = k.match(/^(\d+)/);
      if (!n) return null;
      return list.find(x => x.tap === n[1] + 'A') || list.find(x => x.tap === n[1]) || null;
    }
    return {
      data: F,
      has: s => !!F.units[s],
      unit: s => F.units[s] || null,
      // Số liệu không tải xuất xưởng cùng mức điện áp với lần đo: { kv: U rms đo (kV), pu: %Uđm }.
      // Cùng mức: U lệch ≤ NOLOAD_U_MATCH % (theo kV khi xuất xưởng ghi kV, theo %Uđm khi ghi %Ur). Không có → null.
      noLoadAt(s, at) {
        // at.pair / at.side: MBA 3 pha đo ở điện áp thấp theo cặp pha — chỉ ghép cùng cặp, cùng cuộn (khi xuất xưởng ghi cuộn)
        const list = ((F.units[s] && F.units[s].noLoad) || []).filter(x => (x.pair || '') === ((at && at.pair) || '') && (!x.side || !at || !at.side || x.side === at.side));
        const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && b > 0 && Math.abs(a - b) / b * 100 <= NOLOAD_U_MATCH;
        return list.find(x => x.kv != null && close(at && at.kv, x.kv))
          || list.find(x => x.kv == null && x.pu != null && close(at && at.pu, x.pu)) || null;
      },
      // Mức kV gần nhất (cùng cặp pha / cuộn) khi không có mức trùng: { level, du (% U đo lệch so với mức), near: du ≤ NOLOAD_U_NEAR }
      noLoadNear(s, at) {
        const kv = at && at.kv;
        if (!Number.isFinite(kv)) return null;
        const list = ((F.units[s] && F.units[s].noLoad) || []).filter(x => x.kv > 0 && (x.pair || '') === ((at && at.pair) || '') && (!x.side || !at.side || x.side === at.side));
        if (!list.length) return null;
        const level = list.reduce((a, b) => (Math.abs(b.kv - kv) < Math.abs(a.kv - kv) ? b : a)), du = (kv - level.kv) / level.kv * 100;
        return { level, du, near: Math.abs(du) <= NOLOAD_U_NEAR };
      },
      NOLOAD_U_MATCH, NOLOAD_U_NEAR,
      shortCircuitFor,
      ratioTap: tap => matchTap(F.ratio.taps, tap),
      // opts.byTap: cuộn có bộ điều áp không phải cuộn nối tiếp (OLTC ở cuộn trung áp) — chỉ trả giá trị khi file XX có
      // số liệu theo nấc của cuộn đó (không so mọi nấc với một giá trị)
      dcr(winding, tap, s, opts) {
        const rows = F.dcr.rows.filter(r => r.winding === winding);
        // cuộn nối tiếp không có nấc (OLTC ở cuộn trung áp, cuộn cao áp một giá trị): dùng khi file XX chỉ có một hàng
        const r = opts && opts.byTap ? (rows.length > 1 ? matchTap(rows, tap) : null)
          : winding === 'SER' ? (tap ? matchTap(rows, tap) : (rows.length === 1 ? rows[0] : null)) : rows[0];
        if (!r || r.r75[s] == null) return null;
        return { r75: r.r75[s], meas: r.meas[s], tap: r.tap, refT: F.dcr.refT, measT: (F.conditions[s] || {}).dcr };
      },
      ins(cfg, param, s) { const v = F.ins[cfg] && F.ins[cfg][param]; return v && v[s] != null ? v[s] : null; },
      insT: s => (F.conditions[s] || {}).ins ?? null,
      bushingBySerial(bs) { const k = norm(bs); return k ? F.bushings.find(b => norm(b.serial) === k) || null : null; },
      bushingByUnit: (s, term) => F.bushings.find(b => b.mba === s && b.terminal === term) || null,
      bushingSpec: term => F.bushingSpecs.find(b => b.terminal === term) || null,
      bct: (s, terminal) => F.bct.find(b => b.mba === s && b.terminal === norm(terminal)) || null,
      moisture: s => (F.conditions[s] || {}).moisture ?? null,
    };
  }

  // Dựng lại số liệu xuất xưởng từ các dòng đo đã lưu CSDL (lần nhập test report không còn file .xlsx gốc).
  // Ngược với MbaRows.factorySessions: DCR SER/COM/LV theo nấc (Ω), tỷ số HV/MV theo nấc + MV/LV (Kđm = K/(1+sai số)),
  // cách điện / tgδ cuộn dây, sứ (thiết bị con SU), biến dòng chân sứ, P0, độ ẩm, nhiệt độ đo.
  // Không có trong CSDL: điện áp nấc (hvKV, mvKV, lvKV — tỷ số HV:LV không so được), thông số chịu đựng sứ, bảng tổn hao ngắn mạch.
  // sessions: [{ serial, phase, testDate, rows: [{ serial_no, item, param, config, phase, tap, value, value_text, temp_c, value_norm, norm_temp_c }] }]
  function fromRows(sessions, label) {
    const F = {
      fileName: label || 'CSDL', units: {}, machines: {}, order: [], overview: [], specs: {}, ratio: { taps: [], mvlv: null, polarity: {} },
      dcr: { rows: [], refT: 75 }, ins: {}, bushings: [], bushingCriteria: {}, bushingSpecs: [], conditions: {}, bct: [],
      losses: [], warnings: [], sheets: [], reportDate: null, fromDb: true,
    };
    const fin = x => typeof x === 'number' && Number.isFinite(x);
    const n = x => (x === null || x === undefined || x === '' ? NaN : Number(x));
    const dcrRow = new Map(), tapRow = new Map();
    const IRP = { R60: 'r60', KHT: 'kht', PI: 'pi' }, WTP = { C: 'c', TGD: 'tgd' };
    const setIns = (cfgK, p, s, v) => { const g = F.ins[cfgK] = F.ins[cfgK] || {}; (g[p] = g[p] || {})[s] = v; };
    (sessions || []).forEach((S, i) => {
      const s = String(S.serial || '').trim();
      if (!s || F.units[s]) return;
      const main = (S.rows || []).filter(r => !r.serial_no || r.serial_no === s);
      const phase = S.phase || (main.find(r => /^[ABC]$/.test(r.phase || '')) || {}).phase || '';
      const c = F.conditions[s] = {};
      const p0 = main.find(r => r.item === 'NOLOAD' && r.param === 'P0');
      F.units[s] = { serial: s, machine: i + 1, phase, noLoadLoss: p0 ? n(p0.value) : null };
      F.order.push(s);
      if (!F.reportDate && S.testDate) F.reportDate = S.testDate;
      if (p0 && fin(n(p0.temp_c))) c.noload = n(p0.temp_c);
      // không tải theo mức điện áp (MbaRows.factorySessions: RATED = 100 % Ur, LEVEL[-LV|-HV] nấc "90%" | "10KV", pha = cặp pha)
      main.filter(r => r.item === 'NOLOAD' && (r.config === 'RATED' || /^LEVEL(-LV|-HV)?$/.test(r.config)) && fin(n(r.value))).forEach(r => {
        const k = { P0: 'p0', I0: 'i0', I0_A: 'i0A' }[r.param];
        if (!k) return;
        const lvl = r.config !== 'RATED', t = String(r.tap || '').toUpperCase(), kv = lvl && /KV$/.test(t) ? parseFloat(t) : null;
        const pu = !lvl ? 100 : kv == null ? parseFloat(t) : null;
        const pair = lvl && /^(AB|BC|CA)$/i.test(r.phase || '') ? r.phase.toLowerCase() : undefined;
        const side = (r.config.match(/-(LV|HV)$/) || [])[1];
        const lv = { pu, kv };
        if (pair) lv.pair = pair;
        if (side) lv.side = side.toLowerCase();
        const list = F.units[s].noLoad = F.units[s].noLoad || [];
        let e = list.find(x => x.kv === kv && x.pu === pu && x.pair === lv.pair && x.side === lv.side);
        if (!e) { e = lv; list.push(e); }
        e[k] = n(r.value);
      });
      main.forEach(r => {
        const v = n(r.value), t = n(r.temp_c);
        if (r.item === 'MOISTURE' && r.param === 'WC') { if (fin(v)) c.moisture = v; if (fin(t)) c.dfr = t; }
        else if (r.item === 'VECTOR' && r.param === 'RESULT') F.specs.vector = F.specs.vector || r.value_text || undefined;
        else if (r.item === 'DCR' && r.param === 'R' && ['SER', 'COM', 'LV'].includes(r.config)) {
          // cấu hình HV (= SER+COM), MV (= COM) chỉ là dòng tổng hợp khi lưu — bỏ qua
          const tap = String(r.tap || '').toUpperCase(), key = `${r.config}|${tap}`;
          if (!dcrRow.has(key)) {
            const row = { winding: r.config, tap, label: `Cuộn ${r.config}${tap ? ` - Tap ${tap}` : ''}`, meas: {}, r75: {} };
            dcrRow.set(key, row); F.dcr.rows.push(row);
          }
          const row = dcrRow.get(key);
          if (fin(v)) row.meas[s] = v / 1000;
          if (fin(n(r.value_norm))) row.r75[s] = n(r.value_norm) / 1000;
          if (fin(n(r.norm_temp_c))) F.dcr.refT = n(r.norm_temp_c);
          if (fin(t)) c.dcr = t;
        } else if (r.item === 'RATIO' && (r.param === 'ERR' || r.param === 'K')) {
          if (fin(t)) c.ratio = t;
          if (r.config === 'MV/LV') {
            const m = F.ratio.mvlv = F.ratio.mvlv || { nominal: null, err: {}, k: {} };
            if (fin(v)) m[r.param === 'ERR' ? 'err' : 'k'][s] = v;
          } else if (r.config === 'HV/MV') {
            const tk = String(r.tap || '').toUpperCase();
            if (!tapRow.has(tk)) { const row = { tap: tk, hvKV: null, mvKV: null, nominal: null, err: {}, k: {} }; tapRow.set(tk, row); F.ratio.taps.push(row); }
            if (fin(v)) tapRow.get(tk)[r.param === 'ERR' ? 'err' : 'k'][s] = v;
          }
        } else if (r.item === 'IR' && IRP[r.param]) {
          setIns(r.config, IRP[r.param], s, v);
          if (fin(t)) c.ins = t;
        } else if (r.item === 'WTGD' && WTP[r.param]) {
          setIns(r.config, WTP[r.param], s, v);
          if (fin(t) && c.ins === undefined) c.ins = t;
        } else if ((r.item === 'BCT_RATIO' || r.item === 'BCT_DCR') && r.config) {
          const [side, ...rest] = String(r.config).split('/');
          const termLabel = rest.join('/'), terminal = norm(termLabel), ph = r.phase || phase;
          let b = F.bct.find(x => x.mba === s && x.terminal === terminal && x.phase === ph);
          if (!b) { b = { mba: s, position: side, ct: '', terminal, terminalLabel: termLabel, ratioText: '', ratio: null, r75: null, err: null, polarity: '', phase: ph }; F.bct.push(b); }
          if (r.item === 'BCT_RATIO' && r.param === 'ERR' && fin(v)) b.err = v;
          if (r.item === 'BCT_RATIO' && r.param === 'RATIO' && fin(v)) b.k = v;
          if (r.item === 'BCT_DCR' && fin(n(r.value_norm))) b.r75 = n(r.value_norm);
        }
      });
      // sứ: thiết bị con (SU) trong cùng lần nhập
      const bs = new Map();
      (S.rows || []).filter(r => r.item === 'BUSHING' && r.serial_no && r.serial_no !== s).forEach(r => {
        if (!bs.has(r.serial_no)) bs.set(r.serial_no, { mba: s, terminal: r.config || '', terminalLabel: r.config || '', serial: r.serial_no, c1np: null, tdnp: null, c1: null, td: null, t: null });
        const b = bs.get(r.serial_no), v = n(r.value), t = n(r.temp_c);
        if (r.param === 'C1' && fin(v)) b.c1 = v;
        if (r.param === 'TGD1' && fin(v)) b.td = v;
        if ((r.param === 'C1' || r.param === 'TGD1') && fin(t)) b.t = t;
        if (r.param === 'C1_NP' && fin(v)) b.c1np = v;
        if (r.param === 'TGD1_NP' && fin(v)) b.tdnp = v;
      });
      F.bushings.push(...bs.values());
    });
    // tỷ số định mức = K/(1 + sai số)
    const nominalOf = (k, err) => {
      const s = Object.keys(k || {}).find(x => Number.isFinite(k[x]) && Number.isFinite(err[x]));
      return s ? +(k[s] / (1 + err[s] / 100)).toFixed(5) : null;
    };
    F.ratio.taps.forEach(t => { t.nominal = nominalOf(t.k, t.err); });
    if (F.ratio.mvlv) F.ratio.mvlv.nominal = nominalOf(F.ratio.mvlv.k, F.ratio.mvlv.err);
    F.bct.forEach(b => { if (Number.isFinite(b.k) && Number.isFinite(b.err)) b.ratio = +(b.k / (1 + b.err / 100)).toFixed(4); });
    if (F.order.length) F.warnings.push('Số liệu dựng lại từ CSDL (không có file test report gốc): thiếu điện áp các nấc (không so được tỷ số HV:LV), thông số chịu đựng sứ, bảng tổn hao ngắn mạch.');
    return api(F);
  }

  window.Factory = {
    fromRows,
    fromArrayBuffer(buf, fileName) { return api(parse(XLSX.read(buf, { type: 'array' }), fileName)); },
    fromBase64(b64, fileName) { return api(parse(XLSX.read(b64, { type: 'base64' }), fileName)); },
    norm, num, cfgKey,
  };
})();
