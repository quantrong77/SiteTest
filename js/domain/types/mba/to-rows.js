// MBA: chuyển biểu mẫu BBTN và Test report xuất xưởng thành các dòng số liệu (một giá trị một dòng)
// để lưu CSDL & phân tích xu hướng. Hàm thuần: không gọi Supabase (việc ghi do js/data/db.js làm).
(function () {
  'use strict';
  const { RANK, toNum, ok, str, findGrid, eachGrid, kindOf, isoDate } = Common;
  const refKey = (cls, serial) => `${cls}|${String(serial).trim()}`;
  const tapNorm = t => str(t).toUpperCase();

  // Mã sơ đồ đo cách điện / tgδ cuộn dây — trùng khóa với file xuất xưởng để so xu hướng
  const IR_CFG = { r0: 'HV+MV+N-LV+TANK', r1: 'LV-HV+MV+N+TANK', r2: 'HV+MV+N+LV-TANK', r3: 'LV-HV+MV', r4: 'HV+MV-TANK', r5: 'LV-TANK', r6: 'CORE', r7: 'CLAMP', r8: 'CORE-CLAMP' };
  const DCR_CFG = { 'dcr.hv': 'HV', 'dcr.mv': 'MV', 'dcr.lv': 'LV' };
  const RATIO_CFG = { 'ratio.hm': 'HV/MV', 'ratio.hl': 'HV/LV', 'ratio.ml': 'MV/LV' };

  // ======================================================================= biểu mẫu → dòng
  function fieldRows(state, res, schema) {
    const v = state.v, cfg = state.cfg;
    const refs = new Map(), rows = [];
    const statusOf = {};
    res.findings.forEach(f => (f.keys || []).forEach(k => {
      if (!statusOf[k] || RANK[f.status] > RANK[statusOf[k]]) statusOf[k] = f.status;
    }));
    const main = str(v['meta.serial']);
    if (!main) throw new Error('Chưa nhập số chế tạo máy chính (mục 0)');
    const addRef = (cls, serial, o = {}) => {
      const k = refKey(cls, serial);
      const cur = refs.get(k) || { key: k, class_code: cls, serial_no: str(serial) };
      Object.entries(o).forEach(([a, b]) => { if (b !== undefined && b !== null && b !== '' && cur[a] === undefined) cur[a] = b; });
      refs.set(k, cur);
      return k;
    };
    const mainRef = addRef('MBA', main, {
      name: str(v['meta.site']) || undefined, manufacturer: str(v['meta.manuf']) || undefined, model: str(v['meta.type']) || undefined,
      year_made: toNum(v['meta.year']) || undefined,
      rated: { power_mva: str(v['meta.power']), voltage: str(v['meta.voltage']), current_a: str(v['meta.current']), vector_group: str(v['meta.vector']) },
    });
    const unitRef = ph => {
      const p = String(ph || '').toUpperCase();
      const s = p === 'N' ? main : (str(cfg.ps[p]) || main);
      return s === main ? mainRef : addRef('MBA', s, { phase: p });
    };
    const put = (eq, item, param, o) => {
      const value = toNum(o.value);
      const text = str(o.value);
      if (!text && !ok(o.norm)) return;
      rows.push({
        eq, item, param, config: o.config || '', phase: String(o.phase || '').toUpperCase(), tap: tapNorm(o.tap),
        value: ok(value) ? value : null, value_text: ok(value) ? null : text || null, unit: o.unit || null,
        temp_c: ok(o.temp) ? o.temp : null, value_norm: ok(o.norm) ? o.norm : null, norm_temp_c: ok(o.norm) ? o.normT ?? null : null,
        status: (o.key && statusOf[o.key]) || null, note: o.note || null,
      });
    };
    const val = k => str(v[k]) || str(res.calc[k]);

    // 1. Bên ngoài, 4. tổ đấu dây, 10. độ ẩm
    put(mainRef, 'VISUAL', 'RESULT', { value: v['visual.text'] });
    put(mainRef, 'VISUAL', 'EVAL', { value: v['visual.eval'], key: 'visual.eval' });
    put(mainRef, 'VECTOR', 'RESULT', { value: v['vector.result'], key: 'vector.result' });
    put(mainRef, 'MOISTURE', 'WC', { value: v['moist.val'], unit: '%', key: 'moist.val', note: str(v['moist.method']) || null });

    // 2. Không tải
    ['nl.lv', 'nl.hv'].forEach(g => {
      const rowsK = g === 'nl.lv' ? ['ab', 'bc', 'ca'] : ['AB', 'BC', 'CA'];
      rowsK.forEach(r => [['u', 'U', 'kV'], ['i', 'I', 'A'], ['p', 'P', 'W']].forEach(([c, p, u]) =>
        put(mainRef, 'NOLOAD', p, { config: g === 'nl.lv' ? 'LOWV-LV' : 'LOWV-HV', phase: r, value: v[`${g}.${r}.${c}`], unit: u })));
    });
    ['r0', 'r1'].forEach((r, i) => [['um', 'U_MEAN', 'kV'], ['ur', 'U_RMS', 'kV'], ['ia', 'I_A', 'A'], ['ib', 'I_B', 'A'], ['ic', 'I_C', 'A'],
      ['i0', 'I0', '%'], ['pm', 'PM', 'kW'], ['p0', 'P0', 'kW']].forEach(([c, p, u]) => {
      const k = `nl.rated.${r}.${c}`;
      put(mainRef, 'NOLOAD', p, { config: 'RATED', tap: String(i + 1), value: val(k), unit: u, key: k });
    }));

    // 3. Cách điện (R quy đổi 20 °C)
    const tIR = toNum(v['ir.t']);
    Object.entries(IR_CFG).forEach(([rk, code]) => {
      ['r15', 'r60', 'r600'].forEach(c => {
        const k = `ir.meas.${rk}.${c}`, m = toNum(v[k]);
        const norm = ok(m) && ok(tIR) ? QD.convIR(m, tIR, 20).val : NaN;
        put(mainRef, 'IR', c.toUpperCase(), { config: code, value: v[k], unit: 'MΩ', temp: tIR, norm, normT: 20, key: k });
      });
      ['kht', 'pi'].forEach(c => { const k = `ir.meas.${rk}.${c}`; put(mainRef, 'IR', c.toUpperCase(), { config: code, value: val(k), key: k }); });
      put(mainRef, 'IR', 'U_TEST', { config: code, value: v[`ir.meas.${rk}.u`], unit: 'V' });
    });

    // 6. tgδ cuộn dây (quy đổi 20 °C)
    const tW = toNum(v['wtgd.t']);
    // đối tượng đo bổ sung (cfg.wtgdRows) lưu theo nhãn người dùng nhập
    ['r0', 'r1', 'r2', 'r3', 'r4', 'r5'].concat((cfg.wtgdRows || []).map(x => x.k)).forEach(rk => {
      const code = IR_CFG[rk] || `CUSTOM:${str((cfg.wtgdLabels || {})[rk]) || rk}`;
      const kt = `wtgd.meas.${rk}.tgd`, tg = toNum(v[kt]);
      put(mainRef, 'WTGD', 'TGD', { config: code, value: v[kt], unit: '%', temp: tW, norm: ok(tg) && ok(tW) ? QD.convTgd(tg, tW, 20).val : NaN, normT: 20, key: kt });
      put(mainRef, 'WTGD', 'C', { config: code, value: v[`wtgd.meas.${rk}.c`], unit: 'pF', temp: tW, key: `wtgd.meas.${rk}.c` });
    });

    // 5. Sứ — khóa theo số chế tạo sứ; chưa có S/N thì gắn vào MBA của cột pha
    const amb = toNum(v['meta.ambT']);
    [['hv', '1.1', ['A', 'B', 'C']], ['mv', '2.1', ['A', 'B', 'C', 'N']], ['lv', '3.1', ['a', 'b', 'c']]].forEach(([side, term, cols]) => {
      const t = toNum(v[`b.${side}.t`]);
      cols.forEach(c => {
        const p = `b.${side}.meas`, q = `b.${side}.c20`;
        const bs = str(v[`${p}.serial.${c}`]);
        const terminal = c === 'N' ? '2' : term;
        const parent = unitRef(c);
        const eq = bs ? addRef('SU', bs, { parent, position: terminal, phase: c.toUpperCase(), model: str(v[`${p}.type.${c}`]) || undefined, manufacturer: str(v[`${p}.manuf.${c}`]) || undefined }) : parent;
        const tAmbS = ok(toNum(v[`b.${side}.tamb`])) ? toNum(v[`b.${side}.tamb`]) : amb;
        const tB = window.HitachiBushing ? HitachiBushing.bodyTemp(HitachiBushing.isMounted(v[`b.${side}.mount`] || 'Đã lắp'), tAmbS, t)
          : (ok(amb) && ok(t) ? (2 * amb + t) / 3 : t);
        [['tgd1', 'TGD1', '%'], ['c1', 'C1', 'pF'], ['r1', 'R1', 'MΩ'], ['tgd2', 'TGD2', '%'], ['c2', 'C2', 'pF'], ['r2', 'R2', 'MΩ']].forEach(([r, prm, u]) => {
          const k = `${p}.${r}.${c}`;
          const n = toNum(res.calc[`${q}.${r}.${c}`]);
          // Sứ có S/N là thiết bị riêng → không ghi pha để chuỗi xu hướng khớp với Test report
          put(eq, 'BUSHING', prm, { config: terminal, phase: bs ? '' : c, value: v[k], unit: u, temp: tB, norm: n, normT: 20, key: k });
        });
      });
    });
    ['a', 'b', 'c', 'N'].forEach(c => {
      const bs = str(v[`b.ac.serial.${c}`]) || str(res.calc[`b.ac.serial.${c}`]);
      const eq = bs ? addRef('SU', bs, { parent: unitRef(c), position: c === 'N' ? '2' : '3.1' }) : unitRef(c);
      put(eq, 'BUSHING_AC', 'U', { config: c === 'N' ? '2' : '3.1', phase: c, value: v[`b.ac.u.${c}`], unit: 'kV', key: `b.ac.u.${c}` });
      put(eq, 'BUSHING_AC', 'DURATION', { config: c === 'N' ? '2' : '3.1', phase: c, value: v[`b.ac.dur.${c}`], unit: 'min' });
      put(eq, 'BUSHING_AC', 'EVAL', { config: c === 'N' ? '2' : '3.1', phase: c, value: v[`b.ac.eval.${c}`], key: `b.ac.eval.${c}` });
    });

    // 7. Điện trở một chiều (mΩ, quy đổi 75 °C) & 8. tỷ số biến
    Object.entries(DCR_CFG).forEach(([g, code]) => {
      const grid = findGrid(schema, g);
      const t = toNum(v[`${g}.t`]);
      grid.rows.forEach(r => ['A', 'B', 'C'].forEach(ph => {
        const k = `${g}.${r.k}.${ph}`, m = toNum(v[k]);
        put(unitRef(ph), 'DCR', 'R', { config: code, phase: ph, tap: r.tap || '', value: v[k], unit: 'mΩ', temp: t, norm: ok(m) && ok(t) ? QD.convDCR(m, t, 75) : NaN, normT: 75, key: k });
      }));
    });
    Object.entries(RATIO_CFG).forEach(([g, code]) => {
      findGrid(schema, g).rows.forEach(r => ['A', 'B', 'C'].forEach(ph => {
        const k = `${g}.${r.k}.${ph}`;
        if (!str(v[k])) return;
        put(unitRef(ph), 'RATIO', 'K', { config: code, phase: ph, tap: r.tap || '', value: v[k], key: k });
        put(unitRef(ph), 'RATIO', 'ERR', { config: code, phase: ph, tap: r.tap || '', value: val(`${g}.${r.k}.d${ph}`), unit: '%', key: `${g}.${r.k}.d${ph}` });
      }));
    });

    // 9. OLTC
    const os = str(v['oltc.serial']);
    const oeq = os ? addRef('OLTC', os, { parent: mainRef, model: str(v['oltc.type']) || undefined, manufacturer: str(v['oltc.manuf']) || undefined, year_made: toNum(v['oltc.year']) || undefined }) : mainRef;
    put(oeq, 'OLTC', 'TYPE', { value: v['oltc.type'], key: 'oltc.type' });
    ['d1', 'd2'].forEach((d, i) => {
      const dir = `${str(v[`oltc.${d}from`])}→${str(v[`oltc.${d}to`])}`;
      put(oeq, 'OLTC', 'ROUNDS_K', { config: `DIR${i + 1}`, value: v[`oltc.rounds.${d}.k`], note: dir });
      put(oeq, 'OLTC', 'ROUNDS_CYCLE', { config: `DIR${i + 1}`, value: v[`oltc.rounds.${d}.cyc`], note: dir });
    });
    put(oeq, 'OLTC', 'EVAL', { value: v['oltc.eval'], key: 'oltc.eval' });
    put(oeq, 'OLTC', 'OSCILLOGRAPH', { value: v['oltc.osc'] });

    // 11. Biến dòng chân sứ (khóa: phía/đầu cuộn, ví dụ HV/2S1-2S3)
    const tCT = toNum(v['bct.t_dcr']), tCTir = toNum(v['bct.t_ir']);
    put(mainRef, 'BCT', 'POLARITY', { value: v['bct.polarity'], key: 'bct.polarity' });
    put(mainRef, 'BCT', 'VISUAL', { value: v['bct.visual'] });
    ['hv', 'mv', 'lv'].forEach(side => {
      const S = Schema.BCT_SIDES[side], SIDE = side.toUpperCase();
      const ctList = String(cfg.ctNo[side] || '').split(/[,; ]+/).filter(Boolean);
      const ctN = String(cfg.ctNo.n || '').split(/[,; ]+/).filter(Boolean);
      const ctOf = (w, ph) => ((ph === 'N' ? ctN : ctList)[w - 1] || String(w));
      findGrid(schema, `bct.${side}.ir`).rows.forEach(r => S.phases.forEach(ph => {
        const k = `bct.${side}.ir.${r.k}.${ph}`;
        put(unitRef(ph), 'BCT_IR', 'R', { config: `${SIDE}/W${r.k.slice(1)}`, phase: ph, value: v[k], unit: 'MΩ', temp: tCTir, key: k });
      }));
      findGrid(schema, `bct.${side}.ratio`).rows.forEach(r => S.phases.forEach(ph => {
        const k = `bct.${side}.ratio.${r.k}.${ph}`;
        if (!str(v[k])) return;
        const ct = ctOf(r.w, ph), cfgK = `${SIDE}/${ct}S1-${ct}S${r.s}`;
        put(unitRef(ph), 'BCT_RATIO', 'RATIO', { config: cfgK, phase: ph, value: v[k], key: k });
        put(unitRef(ph), 'BCT_RATIO', 'ERR', { config: cfgK, phase: ph, value: val(`${k}e`), unit: '%', key: k });
      }));
      findGrid(schema, `bct.${side}.dcr`).rows.forEach(r => S.phases.forEach(ph => {
        const k = `bct.${side}.dcr.${r.k}.${ph}`, m = toNum(v[k]);
        const ct = ctOf(r.w, ph);
        put(unitRef(ph), 'BCT_DCR', 'R', { config: `${SIDE}/${ct}S1-${ct}S${r.s}`, phase: ph, value: v[k], unit: 'Ω', temp: tCT, norm: ok(m) && ok(tCT) ? QD.convDCR(m, tCT, 75) : NaN, normT: 75, key: k });
      }));
    });
    eachGrid(schema, g => {
      const m = g.id.match(/^bct\.(\w+)\.ex\.(\w)$/);
      if (!m) return;
      g.rows.forEach(r => g.cols.forEach(c => {
        const k = `${g.id}.${r.k}.${c.k}`;
        put(unitRef(m[2]), 'BCT_EXC', (r.k.endsWith('u') ? 'U' : 'I') + c.k.slice(1), { config: `${m[1].toUpperCase()}/${r.label.split(':')[0]}`, phase: m[2], value: v[k], unit: r.k.endsWith('u') ? 'V' : 'mA' });
      }));
    });

    const session = {
      kind: kindOf(v['meta.reason']), test_date: isoDate(v['meta.date']), reason: str(v['meta.reason']) || null,
      ambient_temp_c: ok(amb) ? amb : null, humidity_pct: ok(toNum(v['meta.hum'])) ? toNum(v['meta.hum']) : null,
      source: 'field_app', template_code: cfg.template, conclusion: str(v['meta.conclusion']) || Evaluate.autoConclusion(res, schema, state) || null,
      remark: str(v['meta.remark']) || null,
      summary: Object.fromEntries(Object.entries(res.sec).map(([k, s]) => [k, { status: s.status, text: s.text, counts: s.counts }])),
    };
    const findings = res.findings.map(f => ({
      section: f.sec, item: f.item, location: f.loc || null, measured: f.meas || null, converted: f.conv || null, reference: f.ref || null,
      deviation: f.dev || null, limit_text: f.limit || null, status: f.status, basis: f.basis || null, note: f.note || null,
    }));
    return { mainRef, refs: [...refs.values()], rows: dedupe(rows), session, findings };
  }

  // ======================================================================= Test report xuất xưởng → dòng
  function factorySessions(FX) {
    const D = FX.data, out = [];
    D.order.forEach(s => {
      const u = D.units[s], c = D.conditions[s] || {};
      const refs = new Map(), rows = [];
      const mainRef = refKey('MBA', s);
      refs.set(mainRef, { key: mainRef, class_code: 'MBA', serial_no: s, phase: u.phase, model: D.specs.type || undefined,
        rated: { power_mva: D.specs.power && D.specs.power.HV, voltage: D.specs.voltage && D.specs.voltage.HV, vector_group: D.specs.vector, job_no: u.jobNo } });
      const put = (eq, item, param, o) => {
        if (!ok(o.value) && !str(o.text) && !ok(o.norm)) return;
        rows.push({ eq, item, param, config: o.config || '', phase: String(o.phase || '').toUpperCase(), tap: tapNorm(o.tap), value: ok(o.value) ? o.value : null,
          value_text: o.text || null, unit: o.unit || null, temp_c: ok(o.temp) ? o.temp : null, value_norm: ok(o.norm) ? o.norm : null,
          norm_temp_c: ok(o.norm) ? o.normT ?? null : null, status: null, note: o.note || null });
      };
      put(mainRef, 'NOLOAD', 'P0', { config: 'RATED', tap: '1', value: u.noLoadLoss, unit: 'kW', temp: c.noload });
      put(mainRef, 'MOISTURE', 'WC', { value: c.moisture, unit: '%', temp: c.dfr, note: 'DFR xuất xưởng' });
      put(mainRef, 'VECTOR', 'RESULT', { text: D.specs.vector });
      // Tỷ số biến: K = Kđm·(1+sai số)
      D.ratio.taps.forEach(t => {
        const e = toNum(t.err[s]);
        put(mainRef, 'RATIO', 'ERR', { config: 'HV/MV', phase: u.phase, tap: t.tap, value: e, unit: '%', temp: c.ratio });
        if (ok(e) && ok(t.nominal)) put(mainRef, 'RATIO', 'K', { config: 'HV/MV', phase: u.phase, tap: t.tap, value: +(t.nominal * (1 + e / 100)).toFixed(5), temp: c.ratio });
      });
      if (D.ratio.mvlv) {
        const e = toNum(D.ratio.mvlv.err[s]);
        put(mainRef, 'RATIO', 'ERR', { config: 'MV/LV', phase: u.phase, value: e, unit: '%', temp: c.ratio });
        if (ok(e)) put(mainRef, 'RATIO', 'K', { config: 'MV/LV', phase: u.phase, value: +(D.ratio.mvlv.nominal * (1 + e / 100)).toFixed(5), temp: c.ratio });
      }
      // Điện trở một chiều (Ω → mΩ); thêm HV = SER+COM và MV = COM để so với phép đo hiện trường A-N, Am-N
      const byW = {};
      D.dcr.rows.forEach(r => {
        const m = toNum(r.meas[s]) * 1000, n = toNum(r.r75[s]) * 1000;
        put(mainRef, 'DCR', 'R', { config: r.winding, phase: u.phase, tap: r.tap || '', value: m, unit: 'mΩ', temp: c.dcr, norm: n, normT: D.dcr.refT });
        (byW[r.winding] = byW[r.winding] || []).push({ tap: r.tap, m, n });
      });
      const com = (byW.COM || [])[0];
      if (com) {
        put(mainRef, 'DCR', 'R', { config: 'MV', phase: u.phase, value: com.m, unit: 'mΩ', temp: c.dcr, norm: com.n, normT: D.dcr.refT, note: '= COM' });
        (byW.SER || []).forEach(r => put(mainRef, 'DCR', 'R', { config: 'HV', phase: u.phase, tap: r.tap, value: r.m + com.m, unit: 'mΩ', temp: c.dcr,
          norm: r.n + com.n, normT: D.dcr.refT, note: '= SER + COM' }));
      }
      // Cách điện & tgδ cuộn dây
      Object.entries(D.ins).forEach(([cfgK, params]) => {
        Object.entries(params).forEach(([p, vals]) => {
          const x = toNum(vals[s]);
          if (p === 'kht' || p === 'pi') put(mainRef, 'IR', p.toUpperCase(), { config: cfgK, value: x, temp: c.ins });
          // quy về 20 °C như số liệu hiện trường để so cùng nhiệt độ
          else if (p === 'r60') put(mainRef, 'IR', 'R60', { config: cfgK, value: x, unit: 'MΩ', temp: c.ins, norm: ok(x) && ok(c.ins) ? QD.convIR(x, c.ins, 20).val : NaN, normT: 20,
            note: cfgK === 'CORE' ? 'Core - Clamp + Tank' : 'Clamp - Core + Tank' });
          else if (p === 'c') put(mainRef, 'WTGD', 'C', { config: cfgK, value: x, unit: 'pF', temp: c.ins });
          else if (p === 'tgd') put(mainRef, 'WTGD', 'TGD', { config: cfgK, value: x, unit: '%', temp: c.ins, norm: ok(x) && ok(c.ins) ? QD.convTgd(x, c.ins, 20).val : NaN, normT: 20 });
        });
      });
      // Sứ — mỗi sứ là một thiết bị con theo số chế tạo
      D.bushings.filter(b => b.mba === s).forEach(b => {
        const k = refKey('SU', b.serial);
        const spec = FX.bushingSpec(b.terminal);
        refs.set(k, { key: k, class_code: 'SU', serial_no: b.serial, parent: mainRef, position: b.terminal, phase: u.phase,
          rated: spec ? { ur: spec.ur, ac_kv: spec.ac, li_kv: spec.li, insulation: spec.type, c1_nameplate_pf: b.c1np, tgd1_nameplate_pct: b.tdnp } : { c1_nameplate_pf: b.c1np, tgd1_nameplate_pct: b.tdnp } });
        const fc = ok(b.t) ? QD.ripFc(b.t) : NaN;
        put(k, 'BUSHING', 'C1', { config: b.terminal, value: b.c1, unit: 'pF', temp: b.t, norm: ok(fc) ? b.c1 * (1 - (b.t - 20) * 0.0004) : NaN, normT: 20 });
        put(k, 'BUSHING', 'TGD1', { config: b.terminal, value: b.td, unit: '%', temp: b.t, norm: ok(fc) ? b.td / fc : NaN, normT: 20, note: 'Quy đổi 20 °C theo fc sứ RIP' });
        put(k, 'BUSHING', 'C1_NP', { config: b.terminal, value: b.c1np, unit: 'pF', note: 'Nhãn sứ' });
        put(k, 'BUSHING', 'TGD1_NP', { config: b.terminal, value: b.tdnp, unit: '%', note: 'Nhãn sứ' });
      });
      // Biến dòng chân sứ
      D.bct.filter(b => b.mba === s).forEach(b => {
        const pos = String(b.position || '');
        const side = /HV|Cao/i.test(pos) ? 'HV' : /LV|Hạ/i.test(pos) ? 'LV' : 'MV';
        const phase = /\(N\)|Trung tính/i.test(pos) ? 'N' : u.phase;
        const cfgK = `${side}/${b.terminalLabel}`;
        put(mainRef, 'BCT_RATIO', 'ERR', { config: cfgK, phase, value: b.err, unit: '%', note: `${b.ratioText} – ${pos}` });
        if (ok(b.err) && b.ratio) put(mainRef, 'BCT_RATIO', 'RATIO', { config: cfgK, phase, value: +(b.ratio * (1 + b.err / 100)).toFixed(4) });
        put(mainRef, 'BCT_DCR', 'R', { config: cfgK, phase, value: null, unit: 'Ω', norm: b.r75, normT: 75 });
      });
      out.push({
        serial: s, mainRef, refs: [...refs.values()], rows: dedupe(rows),
        session: { kind: 'FAT', test_date: D.reportDate || null, source: 'factory_import', source_file: D.fileName, reason: 'Thí nghiệm xuất xưởng (Test report)',
          conclusion: (D.overview.find(o => /Kết luận/i.test(o.label)) || { vals: {} }).vals[s] || null },
      });
    });
    return out;
  }

  function dedupe(rows) {
    const seen = new Map();
    rows.forEach(r => seen.set([r.eq, r.item, r.param, r.config, r.phase, r.tap].join('\u0001'), r));
    return [...seen.values()];
  }

  window.MbaRows = { fieldRows, factorySessions, IR_CFG, DCR_CFG, RATIO_CFG };
})();
