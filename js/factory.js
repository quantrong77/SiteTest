// Đọc file số liệu xuất xưởng (.xlsx) → cấu trúc tra cứu theo SỐ CHẾ TẠO.
// Định vị theo nhãn/tiêu đề cột thay vì địa chỉ ô cố định, để file sửa đổi nhẹ vẫn đọc được.
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
  const rowsOf = ws => XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  function findSheet(wb, re) {
    const name = wb.SheetNames.find(n => re.test(n));
    return name ? { name, rows: rowsOf(wb.Sheets[name]) } : null;
  }

  // Cột thuộc "Máy N" → số chế tạo
  function machineCols(header, machines) {
    const out = [];
    (header || []).forEach((h, c) => {
      const m = String(h || '').match(/Máy\s*(\d+)/i);
      if (m && machines[m[1]]) out.push({ c, serial: machines[m[1]], text: String(h) });
    });
    return out;
  }

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
        const m = String(c || '').match(/Máy\s*(\d+)\s*\(\s*([A-Za-z0-9\-]+)\s*(?:-\s*Pha\s*([ABC]))?/i);
        if (m) {
          F.machines[m[1]] = m[2];
          F.units[m[2]] = { serial: m[2], machine: +m[1], phase: m[3] || '' };
          F.order.push(m[2]);
        }
      });
      const mc = machineCols(ov.rows[hdrIdx], F.machines);
      for (let r = hdrIdx + 1; r < ov.rows.length; r++) {
        const row = ov.rows[r];
        if (!row || !row[1]) continue;
        const vals = {};
        mc.forEach(({ c, serial }) => { vals[serial] = row[c]; });
        F.overview.push({ label: String(row[1]), unit: row[2], guarantee: row[3], vals });
      }
      const nl = F.overview.find(o => /Tổn hao không tải/i.test(o.label));
      if (nl) Object.entries(nl.vals).forEach(([s, v]) => { F.units[s].noLoadLoss = num(v); });
      const job = F.overview.find(o => /Job/i.test(o.label));
      if (job) Object.entries(job.vals).forEach(([s, v]) => { F.units[s].jobNo = v; });
    } else F.warnings.push('Không tìm thấy dòng tiêu đề "Máy N (số chế tạo)" ở sheet tổng quan.');

    // --- Thông số / nameplate
    const sp = findSheet(wb, /spec|nameplate/i);
    if (sp) sp.rows.forEach(r => {
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
      const h = vr.rows.findIndex(r => r && /Nấc/i.test(String(r[0] || '')));
      const mc = machineCols(vr.rows[h], F.machines);
      for (let r = h + 1; r < vr.rows.length; r++) {
        const row = vr.rows[r];
        if (!row || row[0] === null) continue;
        const err = {};
        mc.forEach(({ c, serial }) => { err[serial] = row[c]; });
        const tap = String(row[0]).trim();
        if (/^\d+[A-Z]?$/i.test(tap)) {
          F.ratio.taps.push({ tap: tap.toUpperCase(), hvKV: num(row[1]), mvKV: num(row[2]), nominal: num(row[3]), err, limit: row[7] });
        } else if (/MV.?LV/i.test(tap)) {
          F.ratio.mvlv = { mvKV: num(row[1]), lvKV: num(row[2]), nominal: num(row[3]), err };
        } else if (/Polar/i.test(tap)) {
          F.ratio.polarity = err;
        }
      }
    } else F.warnings.push('Không có sheet tỷ số biến.');

    // --- Điện trở một chiều
    const dr = findSheet(wb, /DC Resist/i);
    if (dr) {
      const h = dr.rows.findIndex(r => r && r.some(c => /Máy\s*\d/i.test(String(c || ''))));
      const head = dr.rows[h];
      const refM = String(dr.rows[0] && dr.rows[0][0] || '').match(/(\d+)\s*°C/) || head.map(String).join(' ').match(/(\d+)\s*°C/);
      if (refM) F.dcr.refT = +refM[1];
      const meas = {}, conv = {};
      head.forEach((t, c) => {
        const m = String(t || '').match(/Máy\s*(\d+)/i);
        if (!m || !F.machines[m[1]]) return;
        (/Quy đổi/i.test(t) ? conv : meas)[F.machines[m[1]]] = c;
      });
      for (let r = h + 1; r < dr.rows.length; r++) {
        const row = dr.rows[r];
        if (!row || !row[0]) continue;
        const label = String(row[0]);
        const w = /SER/i.test(label) ? 'SER' : /COM/i.test(label) ? 'COM' : /LV/i.test(label) ? 'LV' : null;
        if (!w) continue;
        const tm = label.match(/Tap\s*([0-9]+[A-Z]?)/i);
        const rec = { winding: w, tap: tm ? tm[1].toUpperCase() : null, label, meas: {}, r75: {} };
        Object.entries(meas).forEach(([s, c]) => { rec.meas[s] = num(row[c]); });
        Object.entries(conv).forEach(([s, c]) => { rec.r75[s] = num(row[c]); });
        F.dcr.rows.push(rec);
      }
    } else F.warnings.push('Không có sheet điện trở một chiều.');

    // --- Cách điện, Kht, PI, C, tgδ cuộn dây
    const ins = findSheet(wb, /Insulation|TanDelta/i);
    if (ins) {
      const h = ins.rows.findIndex(r => r && r.some(c => /Máy\s*\d/i.test(String(c || ''))));
      const mc = machineCols(ins.rows[h], F.machines);
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
      const h = bs.rows.findIndex(r => r && r.some(c => /Serial sứ|Bushing Serial/i.test(String(c || ''))));
      if (h >= 0) {
        const head = bs.rows[h].map(x => String(x || ''));
        const col = re => head.findIndex(x => re.test(x));
        const c = {
          mba: col(/Serial MBA/i), term: col(/Vị trí đầu sứ/i), bs: col(/Serial sứ/i), c1np: col(/C1 Mảnh nhãn|Nameplate C1/i),
          tdnp: col(/Tanδ Mảnh nhãn|Nameplate Tan/i), c1: col(/C1 Đo|Measured C1/i), td: col(/Tanδ Đo|Measured Tan/i), t: col(/Nhiệt độ/i),
        };
        for (let r = h + 1; r < bs.rows.length; r++) {
          const row = bs.rows[r];
          if (row && row[0] && /^[IVX]+\./.test(String(row[0]))) break;
          if (!row || !row[c.bs]) { if (row && row[0] && /Tiêu chuẩn/i.test(String(row[0]))) parseBushingCriteria(String(row[0]), F); continue; }
          // tanδ trong file lưu dạng thập phân (0,00336 = 0,336%) — quy về %
          const toPct = v => { const n = num(v); return n === null ? null : (n < 0.05 ? n * 100 : n); };
          const term = String(row[c.term] || '').match(/^([\d.]+)/);
          F.bushings.push({
            mba: String(row[c.mba]).trim(), terminal: term ? term[1] : String(row[c.term]), terminalLabel: String(row[c.term] || ''),
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
        const mc = machineCols(tc.rows[h], F.machines);
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
          mba: m ? m[1] : String(row[0]), position: row[1], ct: String(row[2] || '').replace(/\D/g, ''), terminal: norm(row[3]),
          terminalLabel: row[3], ratioText: row[4], ratio: ratio.length === 2 && ratio[1] ? ratio[0] / ratio[1] : null,
          r75: num(row[5]), err: num(row[6]), polarity: row[7],
        });
      }
    }

    if (!F.order.length) F.warnings.push('Không xác định được số chế tạo các máy trong file xuất xưởng.');
    return F;
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
      ratioTap: tap => matchTap(F.ratio.taps, tap),
      dcr(winding, tap, s) {
        const rows = F.dcr.rows.filter(r => r.winding === winding);
        const r = winding === 'SER' ? matchTap(rows, tap) : rows[0];
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

  window.Factory = {
    fromArrayBuffer(buf, fileName) { return api(parse(XLSX.read(buf, { type: 'array' }), fileName)); },
    fromBase64(b64, fileName) { return api(parse(XLSX.read(b64, { type: 'base64' }), fileName)); },
    norm, num, cfgKey,
  };
})();
