// MBA: ánh xạ số liệu máy đo Haefely 2293 (đã đọc bằng js/data/instruments/wa2293.js) vào biểu mẫu:
// điện trở một chiều (mục 7, Ω → mΩ), tỷ số biến theo nấc (mục 8), chụp sóng OLTC (mục 9 + phụ lục BBTN).
(function () {
  'use strict';
  const ok = Number.isFinite;

  // Nấc của máy đo → khóa hàng lưới theo nấc (t1..t19). Máy khai cùng số nấc với biểu mẫu thì theo thứ tự;
  // khác thì theo nhãn: nấc 9 ↔ "9" hoặc 9a/9b/9c (mid: 'a' | 'b' | 'c' | 'all').
  function tapKeys(devTap, taps, nDevTaps, mid = 'b') {
    const n = parseInt(devTap, 10);
    if (!ok(n)) return [];
    if (nDevTaps && nDevTaps === taps.length) return n >= 1 && n <= taps.length ? [`t${n}`] : [];
    const exact = taps.indexOf(String(n));
    if (exact >= 0) return [`t${exact + 1}`];
    const subs = taps.map((t, i) => [t, i]).filter(([t]) => new RegExp(`^${n}[a-z]$`, 'i').test(t));
    if (!subs.length) return [];
    if (mid === 'all') return subs.map(([, i]) => `t${i + 1}`);
    const hit = subs.find(([t]) => t.slice(-1).toLowerCase() === mid) || subs[subs.length >> 1];
    return [`t${hit[1] + 1}`];
  }

  // Ω (chuỗi số của máy, vd 0.19753) → mΩ giữ đúng số chữ số có nghĩa (197.53)
  const toMilli = (r, dec) => (r * 1000).toFixed(Math.max(0, (dec || 0) - 3));

  // Điện trở một chiều theo cuộn dây của máy đo: [{ winding, rows, taps (có nấc), t }]
  function rdcGroups(p) {
    const by = {};
    p.rdc.forEach(r => { (by[r.winding] = by[r.winding] || []).push(r); });
    return Object.entries(by).map(([winding, rows]) => ({
      winding, rows, hasTaps: rows.some(r => r.tap !== ''), t: rows.find(r => ok(r.t)) ? rows.find(r => ok(r.t)).t : NaN,
      target: rows.some(r => r.tap !== '') ? 'hv' : 'mv',
    }));
  }

  // Nhóm cuộn có nấc lệch xa trung vị của mọi file (vd máy ghi nhãn HV cho phép đo cuộn khác) → % lệch, để mặc định không điền
  function rdcOutliers(groups, pct = 25) {
    const tapped = groups.filter(g => g.hasTaps);
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
    const all = med(tapped.flatMap(g => g.rows.map(r => r.r)));
    return tapped.map(g => {
      const d = (med(g.rows.map(r => r.r)) - all) / all * 100;
      return { g, dev: d, odd: tapped.length > 1 && Math.abs(d) > pct };
    }).filter(x => x.odd);
  }

  // Quy đổi điện trở cuộn đồng theo nhiệt độ (QĐ 1901 Điều 9): R2 = R1 × (235 + t2) / (235 + t1)
  const atTemp = (r, t1, t2) => (ok(t1) && ok(t2) ? r * (235 + t2) / (235 + t1) : r);

  // Ghi điện trở của một cuộn vào lưới dcr.<target> cột pha `phase`. toT: quy về nhiệt độ này (biểu mẫu chỉ có một ô
  // nhiệt độ cho cả ba pha, các pha đo ở nhiệt độ khác nhau thì phải quy về cùng nhiệt độ trước khi ghi)
  function rdcWrites(group, target, phase, taps, nDevTaps, mid, toT) {
    const out = {};
    const val = r => toMilli(ok(toT) ? atTemp(r.r, r.t, toT) : r.r, r.rDec);
    if (target === 'hv') {
      group.rows.forEach(r => tapKeys(r.tap, taps, nDevTaps, mid).forEach(k => { out[`dcr.hv.${k}.${phase}`] = val(r); }));
    } else {
      const r = group.rows[group.rows.length - 1];
      if (r) out[`dcr.${target}.r.${phase}`] = val(r);
    }
    return out;
  }

  // Nhiệt độ đo khác nhau giữa các pha ghi vào cùng một lưới: [{ target, temps: [{ phase, t }], ref }]
  // ref = nhiệt độ đã có trong biểu mẫu, chưa có thì nhiệt độ của nhóm đầu tiên
  function rdcTempConflicts(items, formT) {
    const by = {};
    items.forEach(({ g, phase }) => { if (ok(g.t)) (by[g.target] = by[g.target] || []).push({ phase, t: g.t }); });
    return Object.entries(by).map(([target, temps]) => {
      const f = formT ? parseFloat(String(formT[target] ?? '').replace(',', '.')) : NaN;
      const ref = ok(f) ? f : temps[0].t;
      return { target, temps, ref };
    }).filter(c => c.temps.some(x => x.t !== c.ref));
  }

  // Tỷ số định mức theo số liệu xuất xưởng (giống mục 8 của Evaluate) để đoán cặp cuộn của phép đo
  function nominals(FX, cfg, tapLabel) {
    if (!FX) return {};
    const bank = cfg.lvMode === 'delta';
    const r = FX.ratioTap(tapLabel), m = FX.data.ratio.mvlv;
    return {
      hm: r ? (r.nominal || r.hvKV / r.mvKV) : NaN,
      hl: r && m ? r.hvKV / Math.sqrt(3) / m.lvKV * (bank ? Math.sqrt(3) : 1) : NaN,
      ml: m ? m.nominal * (bank ? Math.sqrt(3) : 1) : NaN,
    };
  }
  // Máy đo ghi chung "HV/LV" cho mọi cặp cuộn → chọn cặp có tỷ số định mức gần nhất (không có xuất xưởng: < 4 là HV:MV)
  function guessRatioTarget(p, FX, cfg, taps) {
    const rows = p.ratio.filter(r => r.tap !== '');
    if (!rows.length) return 'ml';
    const mid = rows[rows.length >> 1];
    const keys = tapKeys(mid.tap, taps, p.nTaps);
    const label = keys.length ? taps[+keys[0].slice(1) - 1] : mid.tap;
    const nom = nominals(FX, cfg, label);
    const cand = ['hm', 'hl'].filter(k => ok(nom[k]) && nom[k] > 0);
    if (cand.length) return cand.sort((a, b) => Math.abs(Math.log(mid.ratio / nom[a])) - Math.abs(Math.log(mid.ratio / nom[b])))[0];
    return mid.ratio < 4 ? 'hm' : 'hl';
  }

  function ratioWrites(p, target, phase, taps, mid) {
    const out = {};
    p.ratio.forEach(r => {
      const v = r.ratio.toFixed(r.ratioDec || 4);
      if (target === 'ml') out[`ratio.ml.r.${phase}`] = v;
      else tapKeys(r.tap, taps, p.nTaps, mid).forEach(k => { out[`ratio.${target}.${k}.${phase}`] = v; });
    });
    return out;
  }

  // Bản ghi chụp sóng OLTC của một pha (lưu ở state.att.oltc[pha]); waves là dạng sóng đã nén (OltcWave.compact)
  function oltcRecord(p, waves, binFile) {
    const rows = (p ? p.oltc : []).map(r => ({
      tr: r.tr, from: r.from, to: r.to, conn: r.conn, t: r.t, ub: r.ub, ib: r.ib, rb: r.rb, ua: r.ua, ia: r.ia, ra: r.ra,
      tFall: r.tFall, tRise: r.tRise, delta: r.delta,
    }));
    return {
      file: p ? p.file : '', bin: binFile || '', exported: p ? p.exported || p.created : '', dut: p ? p.dut : '',
      device: p ? `${p.device.model} S/N ${p.device.serial}` : 'Haefely 2293',
      rows, waves: waves || [],
    };
  }

  // Chiều chuyển nấc cho ô "Chiều 1/2: từ nấc … đến nấc …"
  function oltcDirections(att) {
    const all = Object.values(att || {}).flatMap(r => r.rows.length ? r.rows : r.waves);
    const span = d => {
      const xs = all.filter(r => OltcWave.dir(r) === d);
      if (!xs.length) return null;
      return { from: xs[0].from, to: xs[xs.length - 1].to };
    };
    return { up: span('up'), down: span('down') };
  }

  const fmtN = (x, d) => (ok(x) ? x.toFixed(d).replace('.', ',') : '—');
  const range = (xs, d) => { const v = xs.filter(x => ok(x) && x > 0); return v.length ? `${fmtN(Math.min(...v), d)}–${fmtN(Math.max(...v), d)}` : '—'; };

  // Tóm tắt cho ô "Kết quả chụp công tắc K" (người thí nghiệm sửa/bổ sung đánh giá)
  function oltcSummary(att) {
    const lines = [];
    Object.keys(att || {}).sort().forEach(ph => {
      const r = att[ph], n = r.rows.length || r.waves.length;
      const up = (r.rows.length ? r.rows : r.waves).filter(x => OltcWave.dir(x) === 'up').length;
      const an = OltcWave.anomalies(r);
      let s = `Pha ${ph}: ${n} lần chuyển nấc (${up} tăng, ${n - up} giảm)`;
      if (r.rows.length) s += `; tFall ${range(r.rows.map(x => x.tFall), 2)} ms; tRise ${range(r.rows.map(x => x.tRise), 2)} ms`;
      s += an.length ? `; cần xem xét: ${an.map(a => a.text).join('; ')}` : (r.waves.length ? '; dòng đo liên tục trong các lần chuyển nấc' : '');
      lines.push(s + '.');
    });
    return lines.length ? `Chụp sóng điện trở động bằng Haefely 2293 (đồ thị ở Phụ lục):\n${lines.join('\n')}` : '';
  }

  // Nhãn dải chuyển nấc: "1→17", đi rồi về "1→17→1"
  function spanLabel(rows) {
    if (!rows.length) return '';
    const turn = rows.findIndex((r, k) => k && OltcWave.dir(r) && OltcWave.dir(r) !== OltcWave.dir(rows[k - 1]));
    return turn > 0 ? `${rows[0].from}→${rows[turn].from}→${rows[rows.length - 1].to}` : `${rows[0].from}→${rows[rows.length - 1].to}`;
  }

  window.Mba2293 = { tapKeys, toMilli, atTemp, rdcGroups, rdcOutliers, rdcTempConflicts, spanLabel, rdcWrites, guessRatioTarget, ratioWrites, oltcRecord, oltcDirections, oltcSummary };
})();
