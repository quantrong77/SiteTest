// Tính toán & đánh giá: quy đổi nhiệt độ, so sánh với số liệu xuất xưởng (tra theo số chế tạo
// của từng hạng mục: số chế tạo MBA theo cột pha, số chế tạo sứ, mã cuộn TI), áp tiêu chí QĐ 1901.
(function () {
  'use strict';

  const RANK = { fail: 5, warn: 4, missing: 3, pass: 2, info: 1 };
  const worst = (...st) => st.filter(Boolean).sort((a, b) => RANK[b] - RANK[a])[0] || null;

  const toNum = s => {
    if (s === null || s === undefined) return NaN;
    const t = String(s).trim().replace(/\s/g, '').replace(',', '.');
    return t === '' ? NaN : Number(t);
  };
  const ok = Number.isFinite;
  function fmt(x, d) {
    if (!ok(x)) return '';
    if (d === undefined) d = Math.abs(x) >= 1000 ? 0 : Math.abs(x) >= 100 ? 1 : Math.abs(x) >= 10 ? 2 : Math.abs(x) >= 1 ? 3 : 4;
    return x.toFixed(d).replace('.', ',');
  }
  const sgn = (x, d = 2) => (ok(x) ? (x > 0 ? '+' : '') + fmt(x, d) : '');
  const devPct = (a, ref) => (ok(a) && ok(ref) && ref !== 0 ? (a - ref) / ref * 100 : NaN);

  function evaluate(state, FX, schema) {
    const v = state.v, cfg = state.cfg, L = QD.LIMITS, R = QD.REF;
    const calc = {}, findings = [], notes = {};
    const val = k => toNum(v[k]);
    const txt = k => (v[k] === undefined || v[k] === null ? '' : String(v[k]).trim());
    const main = txt('meta.serial');
    const reason = txt('meta.reason') || 'Sau lắp đặt';
    const isNew = /lắp đặt|sửa chữa/i.test(reason);
    const serialOf = ph => {
      const p = String(ph || '').toUpperCase();
      return p === 'N' ? main : (cfg.ps[p] || main);
    };
    const F = FX; // API xuất xưởng (có thể null)
    const add = f => findings.push(Object.assign({ status: 'info' }, f));
    const unitLabel = s => (F && F.unit(s) ? `${s} (pha ${F.unit(s).phase})` : s || '—');

    // ================= 1. Kiểm tra bên ngoài =================
    if (txt('visual.text') || txt('visual.eval')) {
      const e = txt('visual.eval');
      add({ sec: 'visual', item: 'Kiểm tra bên ngoài', meas: txt('visual.text') || '—', status: e === 'Đạt' ? 'pass' : e === 'Không đạt' ? 'fail' : 'missing',
        limit: 'Không hư hỏng, rò dầu…', basis: R.visual, note: e ? '' : 'Chưa chọn kết luận', keys: ['visual.eval'] });
    }

    // ================= 2. Không tải =================
    ['nl.lv', 'nl.hv'].forEach(g => {
      const rows = g === 'nl.lv' ? ['ab', 'bc', 'ca'] : ['AB', 'BC', 'CA'];
      const ps = rows.map(r => val(`${g}.${r}.p`));
      if (ps.some(ok)) {
        add({ sec: 'noload', item: g === 'nl.lv' ? 'Po ở điện áp thấp (cuộn hạ áp)' : 'Po ở điện áp thấp (cuộn cao/trung áp)',
          meas: rows.map((r, i) => ok(ps[i]) ? `${r}: ${fmt(ps[i])} W` : null).filter(Boolean).join('; '),
          status: 'info', basis: R.noload, note: 'Số liệu xuất xưởng không có phép đo ở điện áp thấp → lưu làm giá trị khởi đầu cho các lần sau (Bảng 1 ghi chú c).' });
      }
    });
    const iLV = toNum(cfg.iLV), sLV = toNum(cfg.sLV), sR = toNum(cfg.sR);
    ['r0', 'r1'].forEach(r => {
      const p = `nl.rated.${r}`;
      const um = val(`${p}.um`), ur = val(`${p}.ur`), pm = val(`${p}.pm`);
      const cur = ['ia', 'ib', 'ic'].map(c => val(`${p}.${c}`)).filter(ok);
      if (ok(pm) && ok(um) && ok(ur) && um) calc[`${p}.p0`] = fmt(pm * (1 + (um - ur) / um), 2);
      if (cur.length && ok(iLV) && ok(sLV) && ok(sR) && iLV) {
        const io = cur.reduce((a, b) => a + b, 0) / cur.length;
        calc[`${p}.i0`] = fmt(io / iLV * sLV / sR * 100, 4);
      }
      const p0 = ok(val(`${p}.p0`)) ? val(`${p}.p0`) : toNum(calc[`${p}.p0`]);
      if (ok(p0)) {
        const ref = F && F.unit(main) ? F.unit(main).noLoadLoss : null;
        const lim = isNew ? L.NOLOAD_1PH_NEW : L.NOLOAD_OPER;
        const d = devPct(p0, ref);
        add({ sec: 'noload', item: `Tổn hao không tải P0 tại Uđm (${r === 'r0' ? 'lần 1' : 'lần 2'})`, loc: unitLabel(main), meas: `${fmt(p0, 2)} kW`,
          ref: ok(ref) ? `${fmt(ref, 2)} kW (XX)` : '', dev: sgn(d), limit: `±${lim}% giá trị khởi đầu (MBA 1 pha ≥110 kV, ${isNew ? 'sau lắp đặt/sửa chữa' : 'vận hành'})`,
          status: ok(d) ? (Math.abs(d) <= lim ? 'pass' : 'fail') : 'missing', basis: R.noload,
          note: ok(ref) ? 'P0 = Pm(1+d), d=(U′−U)/U′' : 'Không có tổn hao không tải xuất xưởng cho số chế tạo này', keys: [`${p}.p0`, `${p}.pm`] });
      }
      const i0 = ok(val(`${p}.i0`)) ? val(`${p}.i0`) : toNum(calc[`${p}.i0`]);
      const i0ref = toNum(cfg.i0Ref);
      if (ok(i0)) {
        const d = devPct(i0, i0ref);
        add({ sec: 'noload', item: `Dòng không tải I0 (${r === 'r0' ? 'lần 1' : 'lần 2'})`, loc: unitLabel(main), meas: `${fmt(i0, 4)} %`,
          ref: ok(i0ref) ? `${fmt(i0ref, 4)} % (NSX)` : '', dev: sgn(d), limit: ok(i0ref) ? '≤ +30% số liệu NSX (tham khảo)' : '',
          status: ok(d) ? (d <= 30 ? 'pass' : 'warn') : 'info', basis: R.noload,
          note: ok(i0ref) ? 'Tiêu chí 30% QĐ 1901 nêu cho MBA 3 pha — dùng tham khảo' : 'Nhập I0 nameplate ở Cấu hình để so sánh', keys: [`${p}.i0`] });
      }
    });

    // ================= 3. Điện trở cách điện =================
    const tIR = val('ir.t');
    const irRows = schema.sections.find(s => s.id === 'ir').grids[0].rows;
    let k1info = null;
    irRows.forEach(row => {
      const p = `ir.meas.${row.k}`;
      const r15 = val(`${p}.r15`), r60 = val(`${p}.r60`), r600 = val(`${p}.r600`);
      if (!row.core) {
        if (ok(r15) && ok(r60) && r15) calc[`${p}.kht`] = fmt(r60 / r15, 2);
        if (ok(r600) && ok(r60) && r60) calc[`${p}.pi`] = fmt(r600 / r60, 2);
        const c = `ir.c20.${row.k}`;
        if (ok(tIR)) {
          ['r15', 'r60', 'r600'].forEach(x => {
            const m = val(`${p}.${x}`);
            if (ok(m)) { const cv = QD.convIR(m, tIR, 20); calc[`${c}.${x}`] = fmt(cv.val, 0); k1info = cv; }
          });
        }
        calc[`${c}.kht`] = txt(`${p}.kht`) || calc[`${p}.kht`] || '';
        calc[`${c}.pi`] = txt(`${p}.pi`) || calc[`${p}.pi`] || '';
        calc[`${c}.u`] = txt(`${p}.u`);
      }
      if (!ok(r60)) return;
      if (row.core) {
        const lim = isNew ? L.CORE_NEW : L.CORE_OLD;
        const ref = F && row.fcfg ? F.ins(row.fcfg, 'r60', main) : null;
        add({ sec: 'ir', item: `R cách điện ${row.label}`, loc: unitLabel(main), meas: `${fmt(r60, 0)} MΩ`, ref: ok(ref) ? `${fmt(ref, 0)} MΩ (XX)` : '',
          dev: sgn(devPct(r60, ref), 1), limit: `> ${lim} MΩ (${isNew ? 'MBA mới' : 'đã vận hành'})`, status: r60 > lim ? 'pass' : 'fail', basis: R.core,
          note: 'Tiêu chí NSX ưu tiên nếu có; XX ghi “> 600 MΩ” làm tham khảo', keys: [`${p}.r60`] });
        return;
      }
      if (ok(tIR)) {
        const min = QD.irMin(20); // Bảng 5 tại 20 °C
        const cv = QD.convIR(r60, tIR, 20);
        const r20 = cv.val;
        add({ sec: 'ir', item: `R60 ${row.label}`, loc: unitLabel(main), meas: `${fmt(r60, 0)} MΩ @${fmt(tIR, 1)} °C`,
          conv: `${fmt(r20, 0)} MΩ @20 °C (${tIR >= 20 ? '×' : '÷'} K1 = ${fmt(cv.k, 3)})`,
          ref: `${fmt(min, 0)} MΩ (Bảng 5 @20 °C)`, limit: `R60@20 ≥ ${fmt(min, 0)} MΩ`, status: r20 >= min ? 'pass' : 'fail', basis: R.ir,
          note: `K1 theo Bảng 4 với ∆t = ${cv.dt} °C (${cv.expr}).`
            + (cv.dt > 30 ? ' ∆t > 30 °C: vượt Bảng 4, QĐ 1901 không quy định cách tách hệ số — kết quả quy đổi chỉ để tham khảo.' : '')
            + (tIR < 10 || tIR > 40 ? ' Khuyến cáo đo khi nhiệt độ dầu 10–40 °C (Điều 9 mục 4).' : '')
            + ' XX không có R60 tuyệt đối → chưa áp tiêu chí “giảm ≤30%”; lần đo này là giá trị khởi đầu.', keys: [`${p}.r60`] });
      } else {
        add({ sec: 'ir', item: `R60 ${row.label}`, meas: `${fmt(r60, 0)} MΩ`, status: 'missing', basis: R.ir, note: 'Thiếu nhiệt độ đo → chưa quy đổi/so Bảng 5', keys: ['ir.t'] });
      }
      const kht = ok(val(`${p}.kht`)) ? val(`${p}.kht`) : toNum(String(calc[`${p}.kht`] || '').replace(',', '.'));
      if (ok(kht)) {
        const ref = F && row.fcfg ? F.ins(row.fcfg, 'kht', main) : null;
        add({ sec: 'ir', item: `Kht = R60/R15 ${row.label}`, loc: unitLabel(main), meas: fmt(kht, 2), ref: ok(ref) ? `${fmt(ref, 2)} (XX)` : '',
          dev: sgn(devPct(kht, ref), 1), limit: `≥ ${L.KHT_HEALTHY} (MBA không ẩm: 1,3–2 ở 10–30 °C)`, status: kht >= L.KHT_HEALTHY ? 'pass' : 'warn', basis: 'Điều 29',
          note: 'Kht không tiêu chuẩn hóa — so với XX/lần trước', keys: [`${p}.kht`] });
      }
      const pi = ok(val(`${p}.pi`)) ? val(`${p}.pi`) : toNum(String(calc[`${p}.pi`] || '').replace(',', '.'));
      if (ok(pi)) {
        const ref = F && row.fcfg ? F.ins(row.fcfg, 'pi', main) : null;
        const c = QD.classifyPI(pi);
        add({ sec: 'ir', item: `PI = R600/R60 ${row.label}`, loc: unitLabel(main), meas: fmt(pi, 2), ref: ok(ref) ? `${fmt(ref, 2)} (XX)` : '',
          dev: sgn(devPct(pi, ref), 1), limit: 'PI ≥ 1,25 (IEEE C57.152)', status: c.status, basis: R.pi, note: c.text, keys: [`${p}.pi`] });
      }
    });
    if (k1info) notes['ir.k1'] = ` ${fmt(k1info.k, 3)} (Bảng 4 QĐ 1901, ∆t = ${k1info.dt} °C; ${k1info.expr}; R20 = R${ok(tIR) && tIR < 20 ? ' ÷ ' : ' × '}K1)`;

    // ================= 4. Tổ đấu dây =================
    const vg = txt('vector.result');
    if (vg) {
      const ref = txt('meta.vector') || (F && F.data.specs.vector) || '';
      const same = ref && Factory.norm(vg) === Factory.norm(ref);
      add({ sec: 'vector', item: 'Tổ đấu dây', meas: vg, ref: ref ? `${ref} (nameplate)` : '', status: ref ? (same ? 'pass' : 'fail') : 'missing',
        limit: 'Đúng tài liệu nhà máy', basis: R.vector, keys: ['vector.result'] });
    }

    // ================= 5. Sứ đầu vào =================
    const amb = val('meta.ambT');
    const sideGroups = schema.sections.find(s => s.id === 'bushing').groups.filter(g => g.term);
    // Ur mặc định khi test report không có sứ (phân nhóm dung sai Bảng 15 Hitachi)
    const UR_DEFAULT = { hv: 550, mv: 252, N: 126, lv: 40.5 };
    sideGroups.forEach(gr => {
      const side = gr.id, mg = gr.grids[0];
      if (/Nhập/i.test(txt(`b.${side}.kmode`)) || typeof HitachiBushing === 'undefined') return; // chế độ nhập K: xử lý ở khối dưới
      const H = HitachiBushing, HK = H.consts;
      const tOil = val(`b.${side}.t`);
      const mount = txt(`b.${side}.mount`) || 'Đã lắp';
      const tAmb = ok(val(`b.${side}.tamb`)) ? val(`b.${side}.tamb`) : amb;
      const btype = txt(`b.${side}.btype`) || 'RIP';
      calc[`b.${side}.tamb`] = ok(amb) ? fmt(amb, 1) : '';
      const sideF = H.to20({ mount, tAmb, tOil, c1: 1 });
      notes[`b.${side}.btype`] = ' ' + btype;
      notes[`b.${side}.k`] = ok(sideF.fc)
        ? ` ${fmt(1 / sideF.fc, 3)} (fc = ${fmt(sideF.fc, 3)} tại T sứ = ${fmt(sideF.tB, 1)} °C, sứ ${mount.toLowerCase()}; tanδ20 = tanδ/fc, C20 = C·(1−∆T·${String(HK.cCoef).replace('.', ',')}))`
        : (ok(sideF.tB) ? ` — T sứ ${fmt(sideF.tB, 1)} °C ngoài dải 0–80 °C, không quy đổi` : '');
      if (ok(sideF.fc)) calc[`b.${side}.k`] = fmt(1 / sideF.fc, 3);
      const tWarn = !ok(tAmb) ? 'Thiếu nhiệt độ môi trường. ' : (mount === 'Đã lắp' && !ok(tOil) ? 'Sứ đã lắp: cần nhiệt độ dầu để tính T sứ. ' : '');

      mg.cols.filter(c => c.phase).forEach(c => {
        const p = `b.${side}.meas`, q = `b.${side}.c20`;
        ['type', 'manuf', 'serial'].forEach(r => { calc[`${q}.${r}.${c.k}`] = txt(`${p}.${r}.${c.k}`); });
        const m = { mount, tAmb, tOil, c1: val(`${p}.c1.${c.k}`), tgd1: val(`${p}.tgd1.${c.k}`), c2: val(`${p}.c2.${c.k}`), tgd2: val(`${p}.tgd2.${c.k}`) };
        const bs = txt(`${p}.serial.${c.k}`);
        const tr = H.report(bs);
        const urDef = tr && ok(tr.raw.ur) ? tr.raw.ur : UR_DEFAULT[c.k === 'N' ? 'N' : side];
        calc[`${p}.ur.${c.k}`] = fmt(urDef, 1);
        m.ur = ok(val(`${p}.ur.${c.k}`)) ? val(`${p}.ur.${c.k}`) : urDef;
        const f = H.to20(m);
        if (ok(f.tgd1)) calc[`${q}.tgd1.${c.k}`] = fmt(f.tgd1, 3);
        if (ok(f.tgd2)) calc[`${q}.tgd2.${c.k}`] = fmt(f.tgd2, 3);
        if (ok(f.c1)) calc[`${q}.c1.${c.k}`] = fmt(f.c1, 1);
        if (ok(f.c2)) calc[`${q}.c2.${c.k}`] = fmt(f.c2, 1);
        if (![m.c1, m.tgd1, m.c2, m.tgd2].some(ok)) return;

        // Giá trị chuẩn: test report hãng theo S/N; không có thì dùng giá trị nhãn sứ trong hồ sơ MBA
        let ref = tr, refName = tr ? `test report Hitachi (${H.source})` : '';
        if (!ref && F) {
          const fb = F.bushingBySerial(bs);
          if (fb && (ok(fb.c1np) || ok(fb.tdnp))) { ref = { c1: fb.c1np, tgd1: fb.tdnp, c2: NaN, tgd2: NaN }; refName = 'giá trị nhãn sứ trong hồ sơ xuất xưởng MBA (không có test report hãng)'; }
        }
        const cmp = H.compare(f, ref, m.ur);
        const loc = `${gr.title.replace(/^5\.\d\s*/, '').replace('Sứ phía ', '')} – ${c.label}${bs ? ` [${bs}]` : ''}`;
        const grp = `${cmp.group}`;
        const base = { sec: 'bushing', loc, basis: 'HD sứ Hitachi Energy 19.6–19.8 (Bảng 13–15); QĐ 1901 Điều 38.3' };
        const st = (x, has) => (!has ? null : !ref || x.pass === null ? 'missing' : x.pass ? 'pass' : 'fail');
        const noRef = bs ? `Không có test report cho S/N “${bs}”` : 'Chưa nhập S/N sứ — không tra được test report';
        if (ok(m.c1)) add(Object.assign({}, base, { item: 'Điện dung C1 sứ', meas: `${fmt(m.c1, 1)} pF`, keys: [`${p}.c1.${c.k}`],
          conv: ok(f.c1) ? `${fmt(f.c1, 1)} pF @20 °C${f.dC ? ` + ΔC lắp đặt ${fmt(f.dC, 0)} pF = ${fmt(f.c1rel, 1)} pF` : ''}` : '',
          ref: ref && ok(ref.c1) ? `${fmt(ref.c1, 1)} pF @20 °C` : '', dev: ok(cmp.c1.dev) ? `${sgn(cmp.c1.dev * 100)} %` : '',
          limit: `±${fmt(cmp.c1.tol * 100, 0)} % (${grp})`, status: st(cmp.c1, true), note: (ref ? `So với ${refName}` : noRef) + '. ' + tWarn }));
        if (ok(m.tgd1)) {
          // QĐ 1901: trong vận hành tgδ C1 không tăng quá 100% giá trị khởi đầu (70–100% đo thêm 15/400 Hz)
          const rise = ref && ok(ref.tgd1) && ok(f.tgd1) ? devPct(f.tgd1, ref.tgd1) : NaN;
          const stRise = !isNew && ok(rise) ? (rise > L.BUSHING_TGD_RISE_FAIL ? 'fail' : rise >= L.BUSHING_TGD_RISE_WARN ? 'warn' : null) : null;
          const lim52 = QD.BUSHING_TGD_NEW[btype];
          add(Object.assign({}, base, { item: 'tgδ C1 sứ', meas: `${fmt(m.tgd1, 3)} %`, keys: [`${p}.tgd1.${c.k}`],
            conv: ok(f.tgd1) ? `${fmt(f.tgd1, 3)} % @20 °C` : 'chưa quy đổi', ref: ref && ok(ref.tgd1) ? `${fmt(ref.tgd1, 3)} % @20 °C` : '',
            dev: ok(cmp.tgd1.dev) ? `${sgn(cmp.tgd1.dev, 3)} điểm %` : '', limit: `±${fmt(cmp.tgd1.tol, 2)} điểm % (${grp})`,
            status: worst(st(cmp.tgd1, true), stRise),
            note: (ref ? `So với ${refName}` : noRef) + `. Tham khảo Bảng 52 (${btype}) < ${fmt(lim52, 1)} %: ${m.tgd1 < lim52 ? 'thỏa' : 'KHÔNG thỏa'}. ` + tWarn }));
        }
        if (ok(m.c2)) add(Object.assign({}, base, { item: 'Điện dung C2 sứ', meas: `${fmt(m.c2, 1)} pF`, keys: [`${p}.c2.${c.k}`],
          conv: ok(f.c2) ? `${fmt(f.c2, 1)} pF @20 °C` : '', ref: ref && ok(ref.c2) ? `${fmt(ref.c2, 1)} pF @20 °C` : '',
          dev: ok(cmp.c2.dev) ? `${sgn(cmp.c2.dev * 100)} %` : '', limit: `±${fmt(cmp.c2.tol * 100, 0)} % (${grp})`,
          status: st(cmp.c2, true) === 'missing' ? 'info' : st(cmp.c2, true), note: ref && !ok(ref.c2) ? 'Test report không có C2 — lưu làm giá trị tham chiếu' : (ref ? `So với ${refName}` : noRef) }));
        if (ok(m.tgd2)) add(Object.assign({}, base, { item: 'tgδ C2 sứ', meas: `${fmt(m.tgd2, 3)} %`, keys: [`${p}.tgd2.${c.k}`],
          conv: ok(f.tgd2) ? `${fmt(f.tgd2, 3)} % @20 °C` : '', ref: ref && ok(ref.tgd2) ? `${fmt(ref.tgd2, 3)} % @20 °C` : '',
          dev: ok(cmp.tgd2.dev) ? `${sgn(cmp.tgd2.dev, 3)} điểm %` : '', limit: `±${fmt(cmp.tgd2.tol, 2)} điểm % (${grp})`,
          status: st(cmp.tgd2, true) === 'missing' ? 'info' : st(cmp.tgd2, true), note: ref && !ok(ref.tgd2) ? 'Test report không có tgδ2 — lưu làm giá trị tham chiếu' : (ref ? `So với ${refName}` : noRef) }));
        // Kết luận theo HD Hitachi: có mục không đạt → liên hệ hãng; đủ 4 mục đạt → Đạt; còn lại → Chưa đủ dữ liệu
        if (ref) add(Object.assign({}, base, { item: 'Kết luận sứ theo HD Hitachi', meas: cmp.verdict, keys: [],
          status: /Không đạt/.test(cmp.verdict) ? 'fail' : cmp.verdict === 'Đạt' ? 'pass' : 'info',
          note: cmp.verdict === 'Chưa đủ dữ liệu' ? 'Chưa đủ 4 chỉ tiêu C1, tanδ1, C2, tanδ2 để kết luận đầy đủ theo hãng' : '' }));
      });
      mg.cols.filter(c => c.k === 'u' || c.k === 'd').forEach(c => {
        ['tgd1', 'tgd2'].forEach(r => { calc[`b.${side}.c20.${r}.${c.k}`] = txt(`b.${side}.meas.${r}.${c.k}`); });
      });
    });
    sideGroups.forEach(gr => {
      const side = gr.id, mg = gr.grids[0], cg = gr.grids[1];
      const tOil = val(`b.${side}.t`);
      const btype = txt(`b.${side}.btype`) || 'RIP';
      const rip = false; // chế độ nhập hệ số K (Hitachi đã xử lý ở khối trên)
      if (!/Nhập/i.test(txt(`b.${side}.kmode`)) && typeof HitachiBushing !== 'undefined') return;
      let K = NaN, fc = NaN, tB = NaN;
      if (rip && ok(tOil)) {
        tB = ok(amb) ? (2 * amb + tOil) / 3 : tOil;
        fc = QD.ripFc(tB); K = 1 / fc;
        calc[`b.${side}.k`] = fmt(K, 3);
      } else if (!rip) K = val(`b.${side}.k`);
      const cCorr = c => (rip && ok(tB) ? c * (1 - (tB - 20) * 0.0004) : c);
      notes[`b.${side}.k`] = ok(K) ? (rip ? ` ${fmt(K, 3)} (fc = ${fmt(fc, 3)} tại T sứ = ${fmt(tB, 1)} °C)` : ` ${fmt(K, 3)}`) : '';
      notes[`b.${side}.btype`] = ' ' + btype;

      mg.cols.filter(c => c.phase).forEach(c => {
        const p = `b.${side}.meas`, q = `b.${side}.c20`;
        ['type', 'manuf', 'serial'].forEach(r => { calc[`${q}.${r}.${c.k}`] = txt(`${p}.${r}.${c.k}`); });
        const tgd1 = val(`${p}.tgd1.${c.k}`), c1 = val(`${p}.c1.${c.k}`), tgd2 = val(`${p}.tgd2.${c.k}`), c2 = val(`${p}.c2.${c.k}`);
        if (ok(tgd1) && ok(K)) calc[`${q}.tgd1.${c.k}`] = fmt(tgd1 * K, 3);
        if (ok(tgd2) && ok(K)) calc[`${q}.tgd2.${c.k}`] = fmt(tgd2 * K, 3);
        if (ok(c1)) calc[`${q}.c1.${c.k}`] = fmt(cCorr(c1), 1);
        if (ok(c2)) calc[`${q}.c2.${c.k}`] = fmt(cCorr(c2), 1);
        if (!ok(tgd1) && !ok(c1)) return;

        const bs = txt(`${p}.serial.${c.k}`);
        const term = c.k === 'N' ? '2' : gr.term;
        const unitS = serialOf(c.k);
        let fb = F ? F.bushingBySerial(bs) : null, how = 'theo S/N sứ';
        if (!fb && F) { fb = F.bushingByUnit(unitS, term); how = bs ? `S/N “${bs}” không có trong XX → so theo vị trí ${term} của MBA ${unitS}` : `chưa nhập S/N → so theo vị trí ${term} của MBA ${unitS}`; }
        const loc = `${gr.title.replace(/^5\.\d\s*/, '').replace('Sứ phía ', '')} – ${c.label}${bs ? ` [${bs}]` : ''}`;
        const keysT = [`${p}.tgd1.${c.k}`], keysC = [`${p}.c1.${c.k}`];
        // Quy đổi giá trị XX về 20 °C cùng phương pháp để so sánh cùng nhiệt độ
        const fTd20 = fb && ok(fb.td) ? (rip && ok(fb.t) ? fb.td / QD.ripFc(fb.t) : fb.td) : NaN;
        const fC20 = fb && ok(fb.c1) ? (rip && ok(fb.t) ? fb.c1 * (1 - (fb.t - 20) * 0.0004) : fb.c1) : NaN;

        if (ok(tgd1)) {
          const td20 = ok(K) ? tgd1 * K : NaN;
          const lim52 = QD.BUSHING_TGD_NEW[btype];
          const nsx = toNum(cfg.bTgdMax);
          const st52 = tgd1 < lim52 ? 'pass' : 'fail';
          const stN = ok(nsx) && ok(td20) ? (td20 <= nsx ? 'pass' : 'fail') : null;
          const rise = devPct(td20, fTd20);
          let stRise = null;
          if (!isNew && ok(rise)) stRise = rise > L.BUSHING_TGD_RISE_FAIL ? 'fail' : rise >= L.BUSHING_TGD_RISE_WARN ? 'warn' : 'pass';
          const tWarn = ok(tOil) && (tOil < 10 || tOil > 40) ? ' Nhiệt độ ngoài 10–40 °C (IEC 60137).' : '';
          add({ sec: 'bushing', item: 'tgδ C1 sứ', loc, meas: `${fmt(tgd1, 3)} %`, conv: ok(td20) ? `${fmt(td20, 3)} % @20 °C` : 'chưa quy đổi',
            ref: fb ? `${fmt(fb.td, 3)} % @${fmt(fb.t, 1)} °C → ${fmt(fTd20, 3)} % @20 °C (XX)` : '', dev: ok(rise) ? `${sgn(rise, 1)} %` : '',
            limit: `${ok(nsx) ? `NSX ≤ ${fmt(nsx, 2)} %; ` : ''}Bảng 52 (${btype}) < ${fmt(lim52, 1)} %${isNew ? '' : '; vận hành: tăng ≤100% (70–100% cần đo 15/400 Hz)'}`,
            status: worst(st52, stN, stRise) || 'info', basis: R.bushing, note: (fb ? how : 'Không có số liệu XX của sứ này') + tWarn, keys: keysT });
        }
        if (ok(c1)) {
          const c20 = cCorr(c1);
          const lim = ok(toNum(cfg.bC1Dev)) ? toNum(cfg.bC1Dev) : L.BUSHING_C1_DEV;
          const dF = devPct(c20, fC20), dN = devPct(c20, fb ? fb.c1np : NaN);
          const st = !fb ? 'missing' : Math.max(Math.abs(ok(dF) ? dF : 0), Math.abs(ok(dN) ? dN : 0)) <= lim ? 'pass' : 'fail';
          add({ sec: 'bushing', item: 'Điện dung C1 sứ', loc, meas: `${fmt(c1, 1)} pF`, conv: rip && ok(tB) ? `${fmt(c20, 1)} pF @20 °C` : '',
            ref: fb ? `XX ${fmt(fb.c1, 1)} pF${rip && ok(fb.t) ? ` @${fmt(fb.t, 1)} °C → ${fmt(fC20, 1)} pF @20 °C` : ''}; nhãn ${fmt(fb.c1np, 0)} pF` : '', dev: fb ? `${sgn(dF)} % / ${sgn(dN)} %` : '',
            limit: `±${fmt(lim, 1)} % so với XX & nhãn${ok(toNum(cfg.bC1Dev)) ? ' (tiêu chí NSX)' : ' (Điều 38.3.c)'}`, status: st, basis: R.bushing,
            note: fb ? how + (rip ? '. C quy đổi 20 °C: C·(1−∆T·0,0004)' : '') : 'Không tìm thấy sứ trong số liệu XX (kiểm tra S/N)', keys: keysC });
        }
        if (ok(tgd2) || ok(c2)) {
          add({ sec: 'bushing', item: 'tgδ/C2 sứ (Ty sứ – Vỏ)', loc, meas: `${ok(tgd2) ? fmt(tgd2, 3) + ' %' : '—'}; ${ok(c2) ? fmt(c2, 1) + ' pF' : '—'}`,
            status: 'info', basis: 'Điều 38.3.b, d', note: 'Theo NSX; XX không có C2 → lưu làm giá trị tham chiếu vận hành' });
        }
      });
      mg.cols.filter(c => c.k === 'u' || c.k === 'd').forEach(c => {
        ['tgd1', 'tgd2'].forEach(r => { calc[`b.${side}.c20.${r}.${c.k}`] = txt(`b.${side}.meas.${r}.${c.k}`); });
      });
    });
    // 5.4 Thử AC sứ hạ áp
    ['a', 'b', 'c', 'N'].forEach(ph => {
      const p = 'b.ac';
      ['type', 'manuf', 'serial'].forEach(r => {
        if (ph !== 'N' && !txt(`${p}.${r}.${ph}`)) calc[`${p}.${r}.${ph}`] = txt(`b.lv.meas.${r}.${ph}`);
      });
      const u = val(`${p}.u.${ph}`), e = txt(`${p}.eval.${ph}`);
      if (!ok(u) && !e) return;
      const spec = F ? F.bushingSpec(ph === 'N' ? '2' : '3.1') : null;
      const need = spec && ok(spec.ac) ? spec.ac * L.BUSHING_AC_PCT / 100 : NaN;
      const low = ok(u) && ok(need) && u < need * 0.995;
      add({ sec: 'bushing', item: 'Thử AC tăng cao 1 phút', loc: `Sứ ${ph}`, meas: ok(u) ? `${fmt(u, 1)} kV, ${txt(`${p}.dur.${ph}`) || '?'} phút` : '—',
        ref: ok(need) ? `85% × ${fmt(spec.ac, 0)} kV = ${fmt(need, 1)} kV` : '', limit: 'Chịu đựng 1 phút, không phóng điện',
        status: e === 'Đạt' ? (low ? 'warn' : 'pass') : e === 'Không đạt' ? 'fail' : 'missing', basis: R.bushingAC,
        note: (low ? 'Điện áp thử thấp hơn 85% giá trị xuất xưởng. ' : '') + (e ? '' : 'Chưa chọn kết quả.'), keys: [`${p}.u.${ph}`, `${p}.eval.${ph}`] });
    });

    // ================= 6. Tgδ cuộn dây =================
    const tW = val('wtgd.t');
    const tF = F ? F.insT(main) : null;
    let k2info = null;
    schema.sections.find(s => s.id === 'wtgd').grids[0].rows.forEach(row => {
      const p = `wtgd.meas.${row.k}`, q = `wtgd.c20.${row.k}`;
      const tg = val(`${p}.tgd`), C = val(`${p}.c`);
      calc[`${q}.c`] = txt(`${p}.c`); calc[`${q}.u`] = txt(`${p}.u`); calc[`${q}.d`] = txt(`${p}.d`);
      let tg20 = NaN;
      if (ok(tg) && ok(tW)) { const cv = QD.convTgd(tg, tW, 20); tg20 = cv.val; k2info = cv; calc[`${q}.tgd`] = fmt(tg20, 3); }
      if (ok(tg)) {
        const fref = F && row.fcfg ? F.ins(row.fcfg, 'tgd', main) : null;
        let rise = NaN, refStr = '';
        if (ok(fref) && ok(tW) && ok(tF)) {
          rise = devPct(QD.convTgd(tg, tW, tF).val, fref);
          refStr = `${fmt(fref, 3)} % @${fmt(tF, 1)} °C (XX)`;
        }
        let st, note;
        const k2 = ok(tW) ? QD.convTgd(tg, tW, 20) : null;
        if (!ok(tW)) { st = 'missing'; note = 'Thiếu nhiệt độ đo'; }
        else {
          st = tg20 <= L.WINDING_TGD_OK ? 'pass' : 'fail';
          note = `K2 theo Bảng 7 với ∆t = ${k2.dt} °C (${k2.expr}).`
            // QĐ 1901 chỉ nêu "nhân các hệ số tương ứng" (vd 9 = 5 + 4); với ∆t > 16 °C không quy định cách tách
            + (k2.dt > 16 ? ' ∆t > 16 °C: QĐ 1901 không quy định cách tách hệ số, app lấy hệ số lớn nhất trước — kết quả quy đổi chỉ để tham khảo.' : '')
            // Điều 30: tgδ đo ở nhiệt độ cao, sau hiệu chỉnh lớn bất thường → để MBA nguội và đo lại
            + (st === 'fail' && tW > 20 ? ' QĐ 1901 Điều 30: nếu giá trị sau hiệu chỉnh lớn bất thường khi đo ở nhiệt độ cao, nên để MBA nguội đi rồi đo lại.' : '')
            + (tW < 10 || tW > 40 ? ' Khuyến cáo đo khi nhiệt độ dầu 10–40 °C (Điều 9 mục 4).' : '')
            + (ok(rise) ? ` Tham khảo: so với XX cùng nhiệt độ ${sgn(rise, 1)} %.` : '');
        }
        add({ sec: 'wtgd', item: `tgδ cuộn dây ${row.label}`, loc: unitLabel(main), meas: `${fmt(tg, 3)} % @${ok(tW) ? fmt(tW, 1) : '?'} °C`,
          conv: ok(tg20) ? `${fmt(tg20, 3)} % @20 °C (${tW >= 20 ? '÷' : '×'} K2 = ${fmt(k2.k, 3)})` : '', ref: refStr, dev: ok(rise) ? `${sgn(rise, 1)} % (cùng nhiệt độ)` : '',
          limit: 'tgδ@20 °C ≤ 1 %', status: st, basis: R.wtgd, note, keys: [`${p}.tgd`] });
      }
      if (ok(C)) {
        const fref = F && row.fcfg ? F.ins(row.fcfg, 'c', main) : null;
        const d = devPct(C, fref);
        add({ sec: 'wtgd', item: `Điện dung cuộn dây ${row.label}`, loc: unitLabel(main), meas: `${fmt(C, 1)} pF`, ref: ok(fref) ? `${fmt(fref, 0)} pF (XX)` : '',
          dev: sgn(d), limit: `±${L.WINDING_C_DEV}% so với giá trị khởi đầu`, status: ok(d) ? (Math.abs(d) <= L.WINDING_C_DEV ? 'pass' : 'fail') : 'info',
          basis: R.wtgd, note: ok(fref) ? '' : 'Không có điện dung XX cho sơ đồ đo này → lưu làm giá trị khởi đầu', keys: [`${p}.c`] });
      }
    });
    if (k2info) notes['wtgd.k2'] = ` ${fmt(k2info.k, 3)} (Bảng 7 QĐ 1901, ∆t = ${k2info.dt} °C; ${k2info.expr}; tgδ20 = tgδ${ok(tW) && tW < 20 ? ' × ' : ' ÷ '}K2)`;

    // ================= 7. Điện trở một chiều =================
    const dcrGroups = [
      { g: 'dcr.hv', t: 'dcr.hv.t', winding: cfg.hvMeas === 'SER' ? ['SER'] : ['SER', 'COM'], label: 'Cuộn cao áp' },
      { g: 'dcr.mv', t: 'dcr.mv.t', winding: ['COM'], label: 'Cuộn trung áp (chung)' },
      { g: 'dcr.lv', t: 'dcr.lv.t', winding: ['LV'], label: 'Cuộn hạ áp', delta: cfg.lvMode === 'delta' },
    ];
    dcrGroups.forEach(G => {
      const grid = findGrid(schema, G.g);
      const t = val(G.t);
      grid.rows.forEach(row => {
        const vals = [];
        ['A', 'B', 'C'].forEach(ph => {
          const k = `${G.g}.${row.k}.${ph}`;
          const m = val(k);
          vals.push(m);
          if (!ok(m)) return;
          const s = serialOf(ph);
          const parts = F ? G.winding.map(w => F.dcr(w, row.tap, s)) : [];
          const okRef = parts.length && parts.every(Boolean);
          let ref = okRef ? parts.reduce((a, b) => a + b.r75, 0) * 1000 : NaN; // Ω → mΩ
          if (okRef && G.delta) ref *= 2 / 3;
          const refT = okRef ? parts[0].refT : 75;
          const m75 = ok(t) ? QD.convDCR(m, t, refT) : NaN;
          const d = devPct(m75, ref);
          if (ok(d)) calc[`${G.g}.${row.k}.d${ph}`] = fmt(d, 2);
          const tapNote = okRef && row.tap && parts[0].tap && parts[0].tap.toUpperCase() !== String(row.tap).toUpperCase() ? ` (nấc XX ${parts[0].tap})` : '';
          add({ sec: 'dcr', item: `R một chiều ${G.label}`, loc: `${row.tap ? 'Nấc ' + row.tap + tapNote + ' – ' : ''}pha ${ph} – ${s}`,
            meas: `${fmt(m)} mΩ @${ok(t) ? fmt(t, 1) : '?'} °C`, conv: ok(m75) ? `${fmt(m75)} mΩ @${refT} °C` : '',
            ref: okRef ? `${fmt(ref)} mΩ @${refT} °C (XX ${G.winding.join('+')}${G.delta ? ' ×2/3' : ''})` : '', dev: sgn(d),
            limit: `±${L.DCR_DEV}% so với NSX cùng nhiệt độ`, status: !ok(t) ? 'missing' : ok(d) ? (Math.abs(d) <= L.DCR_DEV ? 'pass' : 'fail') : 'info',
            basis: R.dcr, note: !ok(t) ? 'Thiếu nhiệt độ đo' : okRef ? 'R75 = R·(235+75)/(235+t)' : 'Không có số liệu XX tương ứng', keys: [k] });
        });
        const sp = QD.phaseSpread(vals);
        if (sp !== null) {
          calc[`${G.g}.${row.k}.dP`] = fmt(sp, 2);
          add({ sec: 'dcr', item: `Độ lệch R giữa các pha – ${G.label}`, loc: row.tap ? `Nấc ${row.tap}` : '', meas: `${fmt(sp, 2)} %`,
            limit: `≤ ${L.DCR_DEV}% ((Rmax−Rmin)/RTB)`, status: sp <= L.DCR_DEV ? 'pass' : 'fail', basis: R.dcr, keys: [`${G.g}.${row.k}.dP`] });
        }
      });
    });

    // ================= 8. Tỷ số biến =================
    const bank = cfg.lvMode === 'delta';
    const ratioGroups = [
      { g: 'ratio.hm', label: 'HV:MV', nominal: tap => { const r = F && F.ratioTap(tap); return r ? (r.nominal || r.hvKV / r.mvKV) : NaN; },
        ferr: (tap, s) => { const r = F && F.ratioTap(tap); return r ? toNum(r.err[s]) : NaN; } },
      { g: 'ratio.hl', label: 'HV:LV', nominal: tap => { const r = F && F.ratioTap(tap), lv = F && F.data.ratio.mvlv ? F.data.ratio.mvlv.lvKV : NaN; return r && ok(lv) ? r.hvKV / Math.sqrt(3) / lv * (bank ? Math.sqrt(3) : 1) : NaN; },
        ferr: () => NaN },
      { g: 'ratio.ml', label: 'MV:LV', nominal: () => { const m = F && F.data.ratio.mvlv; return m ? m.nominal * (bank ? Math.sqrt(3) : 1) : NaN; },
        ferr: (tap, s) => { const m = F && F.data.ratio.mvlv; return m ? toNum(m.err[s]) : NaN; } },
    ];
    ratioGroups.forEach(G => {
      const grid = findGrid(schema, G.g);
      grid.rows.forEach(row => {
        const vals = [];
        const nom = G.nominal(row.tap);
        ['A', 'B', 'C'].forEach(ph => {
          const k = `${G.g}.${row.k}.${ph}`;
          const m = val(k);
          vals.push(m);
          if (!ok(m)) return;
          const s = serialOf(ph);
          const dAuto = devPct(m, nom);
          if (ok(dAuto)) calc[`${G.g}.${row.k}.d${ph}`] = fmt(dAuto, 3);
          const d = ok(val(`${G.g}.${row.k}.d${ph}`)) ? val(`${G.g}.${row.k}.d${ph}`) : dAuto;
          const fe = G.ferr(row.tap, s);
          add({ sec: 'ratio', item: `Tỷ số biến ${G.label}`, loc: `${row.tap ? 'Nấc ' + row.tap + ' – ' : ''}pha ${ph} – ${s}`, meas: fmt(m, 4),
            ref: ok(nom) ? `Kđm = ${fmt(nom, 4)}${ok(fe) ? `; sai số XX ${sgn(fe, 2)} %` : ''}` : '', dev: ok(d) ? `${sgn(d, 3)} %` : '',
            limit: `±${L.RATIO_DEV}% so với nameplate`, status: ok(d) ? (Math.abs(d) <= L.RATIO_DEV ? 'pass' : 'fail') : 'missing', basis: R.ratio,
            note: ok(fe) && ok(d) ? `Chênh với sai số xuất xưởng: ${sgn(d - fe, 3)} điểm %` : (ok(nom) ? '' : 'Không xác định được tỷ số định mức cho nấc này'),
            keys: [k, `${G.g}.${row.k}.d${ph}`] });
        });
        const sp = QD.phaseSpread(vals);
        if (sp !== null) {
          calc[`${G.g}.${row.k}.dP`] = fmt(sp, 3);
          add({ sec: 'ratio', item: `Độ lệch tỷ số giữa các pha ${G.label}`, loc: row.tap ? `Nấc ${row.tap}` : '', meas: `${fmt(sp, 3)} %`,
            limit: `≤ ${L.RATIO_DEV}%`, status: sp <= L.RATIO_DEV ? 'pass' : 'fail', basis: R.ratio, keys: [`${G.g}.${row.k}.dP`] });
        }
      });
    });

    // ================= 9. OLTC =================
    const ot = txt('oltc.type');
    if (ot) {
      const ref = F ? F.data.specs.oltc : '';
      const same = ref && Factory.norm(ot) === Factory.norm(ref);
      add({ sec: 'oltc', item: 'Kiểu OLTC', meas: ot, ref: ref ? `${ref} (XX)` : '', status: ref ? (same ? 'pass' : 'warn') : 'info', basis: R.oltc,
        note: ref && !same ? 'Ký hiệu khác số liệu XX — đối chiếu lại nameplate OLTC' : '', keys: ['oltc.type'] });
    }
    const oe = txt('oltc.eval');
    if (oe || ['d1', 'd2'].some(d => txt(`oltc.rounds.${d}.k`) || txt(`oltc.rounds.${d}.cyc`))) {
      add({ sec: 'oltc', item: 'Thí nghiệm OLTC (vòng quay, chụp công tắc K)', meas: ['d1', 'd2'].map(d => `${txt(`oltc.rounds.${d}.k`) || '?'} / ${txt(`oltc.rounds.${d}.cyc`) || '?'}`).join('; '),
        status: oe === 'Đạt' ? 'pass' : oe === 'Không đạt' ? 'fail' : 'missing', basis: R.oltc, note: oe ? 'Căn cứ kết quả thí nghiệm & hướng dẫn NSX' : 'Chưa chọn kết luận OLTC', keys: ['oltc.eval'] });
    }

    // ================= 10. Độ ẩm cách điện cứng =================
    const mo = val('moist.val');
    if (ok(mo)) {
      const c = QD.classifyMoisture(mo);
      const ref = F ? F.moisture(main) : null;
      add({ sec: 'moisture', item: 'Độ ẩm cách điện cứng', loc: unitLabel(main), meas: `${fmt(mo, 2)} %`, ref: ok(ref) ? `${fmt(ref, 2)} % (DFR xuất xưởng)` : '',
        dev: ok(ref) ? `${sgn(mo - ref, 2)} điểm %` : '', limit: '< 2,2 %: khô', status: c.status, basis: R.moisture, note: c.text, keys: ['moist.val'] });
    }

    // ================= 11. Biến dòng chân sứ =================
    const tCT = val('bct.t_dcr');
    const bctLim = toNum(cfg.bctErrLimit);
    ['hv', 'mv', 'lv'].forEach(side => {
      const S = Schema.BCT_SIDES[side];
      const ctList = String(cfg.ctNo[side] || '').split(/[,; ]+/).filter(Boolean);
      const ctListN = String(cfg.ctNo.n || '').split(/[,; ]+/).filter(Boolean);
      const ctOf = (w, ph) => ((ph === 'N' ? ctListN : ctList)[w - 1] || String(w));
      const ir = findGrid(schema, `bct.${side}.ir`);
      ir.rows.forEach(row => S.phases.forEach(ph => {
        const k = `bct.${side}.ir.${row.k}.${ph}`, m = val(k);
        if (!ok(m)) return;
        add({ sec: 'bct', item: 'R cách điện TI chân sứ', loc: `${S.label} – pha ${ph} – ${row.label.split(' –')[0]}`, meas: `${fmt(m, 0)} MΩ`,
          limit: `≥ ${L.BCT_IR_MIN} MΩ (Mêgômmet 1000 V)`, status: m >= L.BCT_IR_MIN ? 'pass' : 'fail', basis: R.bct, keys: [k] });
      }));
      const rg = findGrid(schema, `bct.${side}.ratio`);
      rg.rows.forEach(row => S.phases.forEach(ph => {
        const k = `bct.${side}.ratio.${row.k}.${ph}`, m = val(k);
        if (!ok(m)) return;
        const ct = ctOf(row.w, ph), term = `${ct}S1-${ct}S${row.s}`;
        const s = serialOf(side === 'lv' ? ph.toUpperCase() : ph);
        const fb = F ? F.bct(s, term) : null;
        const eAuto = fb && fb.ratio ? devPct(m, fb.ratio) : NaN;
        if (ok(eAuto)) calc[`bct.${side}.ratio.${row.k}.${ph}e`] = fmt(eAuto, 3);
        const e = ok(val(`${k}e`)) ? val(`${k}e`) : eAuto;
        add({ sec: 'bct', item: 'Tỷ số biến TI chân sứ', loc: `${S.label} – pha ${ph} – ${term} – ${s}`, meas: `${fmt(m, 2)}${ok(e) ? ` (sai số ${sgn(e, 3)} %)` : ''}`,
          ref: fb ? `${fb.ratioText}; sai số XX ${sgn(fb.err, 3)} %` : '', dev: fb && ok(e) && ok(fb.err) ? `${sgn(e - fb.err, 3)} điểm %` : '',
          limit: ok(bctLim) ? `|sai số| ≤ ${fmt(bctLim, 2)} % (cấp chính xác)` : 'Đúng tỷ số nhãn mác',
          status: ok(bctLim) && ok(e) ? (Math.abs(e) <= bctLim ? 'pass' : 'fail') : 'info', basis: R.bct,
          note: fb ? '' : `Không có số liệu XX cho ${term} (kiểm tra mã lõi CT ở Cấu hình)`, keys: [k] });
      }));
      const dg = findGrid(schema, `bct.${side}.dcr`);
      dg.rows.forEach(row => S.phases.forEach(ph => {
        const k = `bct.${side}.dcr.${row.k}.${ph}`, m = val(k);
        if (!ok(m)) return;
        const ct = ctOf(row.w, ph), term = `${ct}S1-${ct}S${row.s}`;
        const s = serialOf(side === 'lv' ? ph.toUpperCase() : ph);
        const fb = F ? F.bct(s, term) : null;
        const m75 = ok(tCT) ? QD.convDCR(m, tCT, 75) : NaN;
        const d = fb ? devPct(m75, fb.r75) : NaN;
        add({ sec: 'bct', item: 'R một chiều TI chân sứ', loc: `${S.label} – pha ${ph} – ${term} – ${s}`, meas: `${fmt(m)} Ω @${ok(tCT) ? fmt(tCT, 1) : '?'} °C`,
          conv: ok(m75) ? `${fmt(m75)} Ω @75 °C` : '', ref: fb ? `${fmt(fb.r75)} Ω @75 °C (XX)` : '', dev: sgn(d),
          limit: 'So sánh với NSX (QĐ 1901 không nêu ngưỡng)', status: !ok(tCT) ? 'missing' : 'info', basis: R.bct,
          note: !ok(tCT) ? 'Thiếu nhiệt độ đo' : fb ? '' : `Không có số liệu XX cho ${term}`, keys: [k] });
      }));
    });
    const exCount = Object.keys(v).filter(k => /^bct\.\w+\.ex\./.test(k) && txt(k)).length;
    if (exCount) add({ sec: 'bct', item: 'Đặc tính từ hóa V-A', meas: `${exCount} giá trị`, status: 'info', basis: R.bct, note: 'XX không có đặc tính V-A → lưu làm giá trị khởi đầu, so sánh các pha cùng loại' });
    if (txt('bct.polarity')) add({ sec: 'bct', item: 'Cực tính TI chân sứ', meas: txt('bct.polarity'), ref: 'Subtractive (XX)', status: /sai|ngược|không đúng/i.test(txt('bct.polarity')) ? 'fail' : 'pass', basis: R.bct, keys: ['bct.polarity'] });

    // ================= Tổng hợp theo hạng mục =================
    const sec = {};
    schema.sections.forEach(s => { sec[s.id] = { status: null, counts: { pass: 0, warn: 0, fail: 0, missing: 0, info: 0 } }; });
    findings.forEach(f => { const S = sec[f.sec]; if (!S) return; S.counts[f.status]++; S.status = worst(S.status, f.status); });
    Object.values(sec).forEach(S => {
      S.text = !S.status ? '' : S.status === 'fail' ? 'Không đạt' : S.status === 'warn' ? 'Cần xem xét' : S.status === 'missing' ? 'Thiếu dữ liệu' : 'Đạt';
    });
    return { calc, findings, sec, notes };
  }

  function findGrid(schema, id) {
    let hit = null;
    Schema.eachGrid(schema, g => { if (g.id === id) hit = g; });
    return hit;
  }

  function autoConclusion(res, schema, state) {
    const failed = schema.sections.filter(s => res.sec[s.id].status === 'fail').map(s => `${s.no}. ${s.title}`);
    const warned = schema.sections.filter(s => res.sec[s.id].status === 'warn').map(s => `${s.no}. ${s.title}`);
    const missing = schema.sections.filter(s => res.sec[s.id].status === 'missing').map(s => `${s.no}. ${s.title}`);
    const done = schema.sections.filter(s => res.sec[s.id].status).length;
    if (!done) return '';
    const parts = [];
    if (failed.length) parts.push(`Hạng mục chưa đạt: ${failed.join('; ')}. Đề nghị kiểm tra, thí nghiệm bổ sung và báo cáo người có thẩm quyền xem xét trước khi đóng điện.`);
    if (warned.length) parts.push(`Hạng mục cần theo dõi/xem xét: ${warned.join('; ')}.`);
    if (missing.length) parts.push(`Hạng mục còn thiếu dữ liệu đánh giá: ${missing.join('; ')}.`);
    if (!failed.length && !warned.length && !missing.length) parts.push('Các hạng mục đã thí nghiệm đạt tiêu chuẩn theo QĐ 1901/QĐ-EVNNPT và phù hợp với số liệu xuất xưởng.');
    return parts.join(' ');
  }

  window.Evaluate = { evaluate, autoConclusion, findGrid, fmt, toNum, RANK, worst };
})();
