// Tính toán & đánh giá: quy đổi nhiệt độ, so sánh với số liệu xuất xưởng (tra theo số chế tạo
// của từng hạng mục: số chế tạo MBA theo cột pha, số chế tạo sứ, mã cuộn TI), áp tiêu chí QĐ 1901.
(function () {
  'use strict';

  const { RANK, worst, toNum, ok, fmt, sgn, devPct, findGrid } = Common;

  // QĐ 1901 Điều 29 mục 3 (Điều 9 mục 4): R60@20 cuộn dây giảm quá 30% so với giá trị khởi đầu hoặc lần trước → hướng xử lý.
  // Bước có căn cứ ghi rõ điều khoản; bước còn lại là gợi ý kỹ thuật, không phải quy định.
  const IR_DROP_ACTIONS = 'Hướng xử lý: (1) Kiểm tra điều kiện đo theo Điều 29 mục 2 — nhiệt độ dầu/cuộn dây dùng quy đổi (∆t, K1), '
    + 'vệ sinh và làm khô bề mặt sứ, độ ẩm / ô nhiễm (dùng vòng màn chắn), Mêgôm ≥2500 V, cùng điện áp và sơ đồ đo với lần trước, '
    + 'nối đất cuộn dây đủ thời gian — rồi đo lại. (2) Đo hệ số phân cực PI (Điều 9 ghi chú d), đánh giá theo IEEE C57.152. '
    + '(3) Gợi ý: đối chiếu Kht, tgδ và điện dung cuộn dây, hàm lượng ẩm cách điện cứng, BBTN dầu (DGA, lý hóa). '
    + '(4) Nếu các hạng mục khác đạt tiêu chuẩn vận hành: báo cáo người có thẩm quyền quyết định đóng điện MBA (Điều 29 mục 3).';
  const IR_DROP_BASIS = 'QĐ 1901 Điều 29 mục 3 (Điều 9 mục 4)';
  const REPORT_UP = 'Báo cáo người có thẩm quyền xem xét.';
  // Ghi chú dòng so XX khi chưa có giá trị khởi đầu (text); CSDL đã có giá trị khởi đầu → đổi sang withHistory (trỏ dòng xu hướng)
  const INIT_NOTE = {
    r60: { text: ' XX không có R60 tuyệt đối → chưa áp tiêu chí “giảm ≤30%”; lần đo này là giá trị khởi đầu.', withHistory: ' Đã có giá trị khởi đầu trong CSDL: xem dòng xu hướng.' },
    cap: { text: 'Không có điện dung XX cho sơ đồ đo này → lưu làm giá trị khởi đầu', withHistory: 'Không có điện dung XX; đã có giá trị khởi đầu trong CSDL: xem dòng xu hướng' },
  };

  // Tiêu chí xu hướng QĐ 1901 (so với giá trị khởi đầu / lần trước, theo lịch sử CSDL) — khóa "ITEM:PARAM" của dòng CSDL.
  // judge(ctx) → { status, limit, actions } hoặc null (không áp dụng). ctx: { fromBase, fromPrevious, base, cur, L, isNew, layout, c1Lim }
  // norm: chỉ so giá trị quy về 20 °C (lịch sử cmp_basis = norm). Mốc "khởi đầu": sau sửa chữa (đặt lại) → xuất xưởng → sau lắp đặt
  // → lần đo sớm nhất (QĐ 1901 Điều 2 — định nghĩa; TrendInline.series).
  const fin = d => d !== null && d !== undefined && Number.isFinite(d);
  const TREND_RULES = {
    'IR:R60': {
      name: 'R60@20', unit: 'MΩ', digits: 0, rowLabel: true, basis: IR_DROP_BASIS, both: true, norm: true,
      judge: c => ({ status: [c.fromBase, c.fromPrevious].some(d => fin(d) && d < -c.L.IR_DROP) ? 'fail' : 'pass',
        limit: `giảm ≤ ${c.L.IR_DROP}% so với giá trị khởi đầu và lần trước`, actions: IR_DROP_ACTIONS }),
    },
    'WTGD:TGD': {
      name: 'tgδ cuộn dây (20 °C)', unit: '%', digits: 3, rowLabel: true, basis: 'QĐ 1901 Điều 30 mục 3 (Điều 9 mục 5)', norm: true,
      // tgδ20 < 1% coi là tốt, không cần so với giá trị khởi đầu (Điều 30 mục 3)
      judge: c => (c.cur <= c.L.WINDING_TGD_OK || !fin(c.fromBase) ? null : {
        status: c.fromBase > c.L.WINDING_TGD_RISE ? 'fail' : 'pass',
        limit: `tăng ≤ ${c.L.WINDING_TGD_RISE}% so với giá trị khởi đầu (tgδ20 ≤ ${c.L.WINDING_TGD_OK}% coi là tốt)`,
        actions: 'Hướng xử lý: (1) Xét các yếu tố làm tăng kết quả đo (Điều 30 mục 2): độ ẩm cao, môi trường ô nhiễm, sứ đầu ra bẩn, nhiễu của thiết bị mang điện ở gần — loại trừ rồi đo lại. '
          + '(2) Đo ở nhiệt độ cao mà giá trị sau quy đổi lớn bất thường: để MBA nguội rồi đo lại (Điều 30). (3) Gợi ý: đối chiếu R60/Kht/PI, hàm lượng ẩm cách điện cứng, BBTN dầu. (4) ' + REPORT_UP }),
    },
    'WTGD:C': {
      name: 'điện dung cuộn dây', unit: 'pF', digits: 1, rowLabel: true, basis: 'QĐ 1901 Điều 9 mục 5',
      judge: c => (!fin(c.fromBase) ? null : {
        status: Math.abs(c.fromBase) > c.L.WINDING_C_DEV ? 'fail' : 'pass', limit: `±${c.L.WINDING_C_DEV}% so với giá trị khởi đầu`,
        actions: 'Hướng xử lý: (1) Gợi ý: kiểm tra sơ đồ đo, điện áp đo cùng với lần khởi đầu, đo lại. (2) Gợi ý: đối chiếu đáp ứng tần số quét (SFRA), điện áp ngắn mạch, tỷ số biến. (3) ' + REPORT_UP }),
    },
    'BUSHING:C1': {
      name: 'điện dung C1 sứ', unit: 'pF', digits: 1, basis: 'QĐ 1901 Điều 38 mục 3c',
      judge: c => (!fin(c.fromBase) ? null : {
        status: Math.abs(c.fromBase) > c.c1Lim ? 'fail' : 'pass', limit: `thay đổi ≤ ${c.c1Lim}% so với giá trị khởi đầu (khi NSX không quy định)`,
        actions: 'Hướng xử lý: (1) Đánh giá theo quy định của nhà sản xuất nếu có (Điều 38 mục 3c). (2) Gợi ý: vệ sinh sứ, kiểm tra sơ đồ đo (đầu đo test tap), đo lại. (3) ' + REPORT_UP }),
    },
    'BUSHING:TGD1': {
      name: 'tgδ C1 sứ (20 °C)', unit: '%', digits: 3, basis: 'QĐ 1901 Điều 38 mục 3a', norm: true,
      // chỉ áp dụng trong vận hành (không áp dụng cho lần sau lắp đặt / sửa chữa)
      judge: c => (c.isNew || !fin(c.fromBase) ? null : {
        status: c.fromBase > c.L.BUSHING_TGD_RISE_FAIL ? 'fail' : c.fromBase >= c.L.BUSHING_TGD_RISE_WARN ? 'warn' : 'pass',
        limit: `trong vận hành tăng ≤ ${c.L.BUSHING_TGD_RISE_FAIL}% so với giá trị khởi đầu (${c.L.BUSHING_TGD_RISE_WARN}–${c.L.BUSHING_TGD_RISE_FAIL}%: đo thêm)`,
        actions: 'Hướng xử lý: đo tgδ ở tần số 15 Hz và 400 Hz để có thêm cơ sở đánh giá (Điều 38 mục 3a, tham khảo Bảng 53); nếu tgδ ở 15 Hz, 50 Hz, 400 Hz chênh lệch lớn, '
          + 'cách điện sứ có dấu hiệu nhiễm ẩm, cần tăng cường theo dõi. ' + REPORT_UP }),
    },
    'NOLOAD:P0': {
      name: 'tổn hao không tải P0', unit: 'kW', digits: 2, rowLabel: true, basis: 'QĐ 1901 Điều 34 mục 3',
      judge: c => {
        if (!fin(c.fromBase)) return null;
        // MBA 3 pha ≥110 kV sau lắp đặt / sửa chữa: so với giá trị xuất xưởng; MBA 1 pha ≥110 kV và vận hành: so với giá trị khởi đầu
        const three = c.layout === Schema.LAYOUT_110;
        if (c.isNew && three && c.base.kind !== 'FAT') return null;
        const lim = c.isNew ? (three ? c.L.NOLOAD_3PH_NEW : c.L.NOLOAD_1PH_NEW) : c.L.NOLOAD_OPER;
        return {
          status: Math.abs(c.fromBase) > lim ? 'fail' : 'pass',
          limit: `±${lim}% ${c.isNew && three ? 'giá trị xuất xưởng' : 'giá trị khởi đầu'} (${c.isNew ? 'sau lắp đặt / sửa chữa' : 'vận hành'})`,
          actions: 'Hướng xử lý: (1) Gợi ý: kiểm tra điện áp đặt (U′mean / Urms), sơ đồ đo, khử từ dư lõi thép (sau đo R một chiều) rồi đo lại. (2) ' + REPORT_UP,
        };
      },
    },
  };
  const isoToVn = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d || '?'); };

  // opts.history: dòng v_trend_delta của thiết bị (lịch sử đo, nếu có); opts.sessionId: lần thí nghiệm đang mở (loại ra khi so)
  function evaluate(state, FX, schema, opts) {
    opts = opts || {};
    // hạng mục bỏ tích "Thực hiện": không đánh giá số liệu của hạng mục đó (số liệu vẫn giữ trong biên bản)
    state = Report.performed(state, schema, Schema.ATT_SECTIONS);
    // Ngưỡng theo bộ tiêu chí đang áp dụng (mặc định = QĐ 1901; Admin có thể chỉnh theo đơn vị)
    const v = state.v, cfg = state.cfg, L = Criteria.limits(), R = QD.REF;
    const calc = {}, findings = [], notes = {};
    const val = k => toNum(v[k]);
    const txt = k => (v[k] === undefined || v[k] === null ? '' : String(v[k]).trim());
    const main = txt('meta.serial');
    const reason = txt('meta.reason') || 'Sau lắp đặt';
    // MBA mới (ngưỡng "sau lắp đặt / sửa chữa" của QĐ 1901): Sau lắp đặt, Sau sửa chữa/đại tu. "1 năm sau lắp đặt" là máy đã vận hành.
    const isNew = /^\s*sau\s+lắp\s+đặt|sửa\s+chữa|đại\s+tu/i.test(reason);
    const serialOf = ph => {
      const p = String(ph || '').toUpperCase();
      // cột pha B, C (mẫu theo pha, mẫu chung 3 pha) là máy B, C của tổ khi có số chế tạo; MBA 3 pha 110–220 kV chỉ có một máy
      return p === 'N' || schema.layout === Schema.LAYOUT_110 ? main : (cfg.ps[p] || main);
    };
    const F = FX; // API xuất xưởng (có thể null)
    const add = f => findings.push(Object.assign({ status: 'info' }, f));
    // Mẫu chung 3 pha: hạng mục theo máy (không tải, cách điện, tgδ cuộn dây, ẩm) lặp cho từng pha A, B, C
    const is3P = schema.layout === Schema.LAYOUT_3P;
    const PH3 = ['A', 'B', 'C'];
    const sectionOf = id => schema.sections.find(s => s.id === id);
    // Lịch sử đo của thiết bị trong CSDL (v_trend_delta) → tiêu chí xu hướng QĐ 1901 (cuối hàm, trendFindings)
    const history = Array.isArray(opts.history) ? opts.history : [];
    const testDate = Common.isoDate(txt('meta.date')) || '';
    const unitLabel = s => (F && F.unit(s) ? `${s} (pha ${F.unit(s).phase})` : s || '—');

    // ================= 1. Kiểm tra bên ngoài =================
    if (txt('visual.text') || txt('visual.eval')) {
      const e = txt('visual.eval');
      add({ sec: 'visual', item: 'Kiểm tra bên ngoài', meas: txt('visual.text') || '—', status: e === 'Đạt' ? 'pass' : e === 'Không đạt' ? 'fail' : 'missing',
        limit: 'Không hư hỏng, rò dầu…', basis: R.visual, note: e ? '' : 'Chưa chọn kết luận', keys: ['visual.eval'] });
    }

    if (is3P) {
      const vg = findGrid(schema, 'visual.items');
      const ev = vg.rows.map(r => ({ r, e: txt(`visual.items.${r.k}.e`) }));
      const done = ev.filter(x => x.e);
      if (done.length) {
        const bad = done.filter(x => /Không/i.test(x.e));
        add({ sec: 'visual', item: 'Kiểm tra bên ngoài theo hạng mục', meas: `${done.length}/${ev.length} hạng mục đã đánh giá`,
          status: bad.length ? 'fail' : done.length === ev.length ? 'pass' : 'missing', limit: 'Không hư hỏng, rò dầu…', basis: R.visual,
          note: bad.length ? `Không đạt: ${bad.map(x => x.r.label).join('; ')}` : done.length < ev.length ? 'Còn hạng mục chưa đánh giá' : '',
          keys: ev.map(x => `visual.items.${x.r.k}.e`) });
      }
    }

    // ================= 2. Không tải =================
    if (!is3P) ['nl.lv', 'nl.hv'].forEach(g => {
      const rows = g === 'nl.lv' ? ['ab', 'bc', 'ca'] : ['AB', 'BC', 'CA'];
      const ps = rows.map(r => val(`${g}.${r}.p`));
      if (ps.some(ok)) {
        add({ sec: 'noload', item: g === 'nl.lv' ? 'Po ở điện áp thấp (cuộn hạ áp)' : 'Po ở điện áp thấp (cuộn cao/trung áp)',
          meas: rows.map((r, i) => ok(ps[i]) ? `${r}: ${fmt(ps[i])} W` : null).filter(Boolean).join('; '),
          status: 'info', basis: R.noload, note: 'Số liệu xuất xưởng không có phép đo ở điện áp thấp → lưu làm giá trị khởi đầu cho các lần sau (Bảng 1 ghi chú c).' });
      }
      // MBA 3 pha (Điều 34 mục 3): Po, Io khi nguồn bc (ngắn mạch pha a) và nguồn ab (ngắn mạch pha c) lệch ≤5%;
      // nguồn ca (ngắn mạch pha b) thường lớn hơn 25–50% do kết cấu lõi thép → chỉ ghi để tham khảo.
      // Độ lệch = |X1 − X2| / trung bình × 100 (cùng cách tính độ lệch pha của Điều 9).
      if (schema.layout === Schema.LAYOUT_110) [['p', 'Po', 'W'], ['i', 'Io', 'A']].forEach(([c, name, u]) => {
        const [ab, bc, ca] = rows.map(r => val(`${g}.${r}.${c}`));
        if (!ok(ab) || !ok(bc)) return;
        const mean2 = (ab + bc) / 2;
        const d = mean2 ? Math.abs(ab - bc) / mean2 * 100 : NaN;
        const mid = ok(ca) && mean2 ? (ca - mean2) / mean2 * 100 : NaN;
        add({ sec: 'noload', item: `Lệch ${name} giữa các pha — đo ở điện áp thấp (${g === 'nl.lv' ? 'cuộn hạ áp' : 'cuộn cao/trung áp'})`,
          meas: `${rows[0]}: ${fmt(ab)} ${u}; ${rows[1]}: ${fmt(bc)} ${u}`, dev: ok(d) ? `${fmt(d, 2)} %` : '',
          limit: `${rows[0]} và ${rows[1]} lệch ≤ ${L.NOLOAD_LV_PHASE}%`, status: ok(d) ? (d <= L.NOLOAD_LV_PHASE ? 'pass' : 'fail') : 'missing', basis: 'QĐ 1901 Điều 34 mục 3',
          note: `Độ lệch = |${rows[0]} − ${rows[1]}| / trung bình. `
            + (ok(mid) ? `${rows[2]} (ngắn mạch pha giữa) lớn hơn ${fmt(mid, 1)} % so với trung bình hai pha kia — thường lớn hơn 25–50% do kết cấu lõi thép.` : ''),
          keys: rows.slice(0, 2).map(r => `${g}.${r}.${c}`) });
      });
    });
    const iLV = toNum(cfg.iLV), sLV = toNum(cfg.sLV), sR = toNum(cfg.sR);
    // %Uđm của lần đo: ô %Uđm (mẫu 3 pha); không có thì U rms / Uđm hạ áp của máy 1 pha (S/I hạ áp ở mục 0).
    // Đo dưới Uđm (vd 380 V, 2 kV bằng máy tgδ): P0, I0 xuất xưởng cho tại Uđm → không so, chỉ ghi nhận làm giá trị khởi đầu.
    const uLVkV = schema.layout !== Schema.LAYOUT_110 && ok(sLV) && ok(iLV) && iLV ? sLV * 1000 / iLV : NaN;
    const puOf = p => { const x = val(`${p}.pu`); if (ok(x)) return x; const ur = val(`${p}.ur`); return ok(ur) && ok(uLVkV) && uLVkV ? ur / uLVkV * 100 : NaN; };
    // base: 'nl.rated' (mẫu theo pha) | 'nl.A.rated' (mẫu 3 pha); curCols: cột dòng không tải; unit: số chế tạo máy
    const noloadRated = (base, curCols, unit) => ['r0', 'r1'].forEach(r => {
      const p = `${base}.${r}`;
      const um = val(`${p}.um`), ur = val(`${p}.ur`), pm = val(`${p}.pm`);
      const cur = curCols.map(c => val(`${p}.${c}`)).filter(ok);
      if (ok(pm) && ok(um) && ok(ur) && um) calc[`${p}.p0`] = fmt(pm * (1 + (um - ur) / um), 2);
      if (cur.length && ok(iLV) && ok(sLV) && ok(sR) && iLV) {
        const io = cur.reduce((a, b) => a + b, 0) / cur.length;
        calc[`${p}.i0`] = fmt(io / iLV * sLV / sR * 100, 4);
      }
      const p0 = ok(val(`${p}.p0`)) ? val(`${p}.p0`) : toNum(calc[`${p}.p0`]);
      const pu = puOf(p), low = ok(pu) && Math.round(pu) < 100;
      const lan = r === 'r0' ? 'lần 1' : 'lần 2';
      // Đo dưới Uđm: so với số liệu xuất xưởng / khởi đầu ở cùng điện áp đo (cột "XX cùng mức"); không có thì chỉ ghi nhận.
      // P0 lệch ≤ 10 % (MBA 1 pha ≥110 kV sau lắp đặt/sửa chữa) / ≤ 15 % (vận hành) giá trị khởi đầu — Điều 34 mục 3;
      // I0 ≤ +30 % số liệu NSX (Điều 34 nêu cho MBA 3 pha — tham khảo, như ở Uđm).
      // Số liệu đối chiếu cùng mức điện áp: nhập tay (cột "XX cùng mức") trước; không có thì test report xuất xưởng
      // ở mức điện áp trùng U đo / %Uđm (FX.noLoadAt — vd "P0 (100% Ur)", "P0 (10 kV)"); tại Uđm còn P0 tổng quan và I0 nameplate.
      const uref = val(`${p}.uref`), pref = val(`${p}.pref`), iref = val(`${p}.iref`);
      const fl = F && F.noLoadAt ? F.noLoadAt(unit, { kv: ur, pu: ok(pu) ? pu : 100 }) : null;
      const flU = fl ? (fl.kv != null ? `${fmt(fl.kv, 3)} kV` : `${fmt(fl.pu, 1)} % Ur`) : '';
      const flNote = fl ? ` Test report xuất xưởng có số liệu ở ${flU} — cùng mức điện áp với lần đo (U lệch ≤ 2 %).` : '';
      const uTxt = ok(uref) ? ` ở ${fmt(uref, 3)} kV` : '';
      const uNote = ok(uref) && ok(ur) ? ` U đo ${fmt(ur, 3)} kV / U xuất xưởng ${fmt(uref, 3)} kV${uref ? ` (${sgn(devPct(ur, uref), 1)} %)` : ''} — chỉ so khi cùng mức điện áp.` : '';
      const lowNote = low ? `Đo ở ${fmt(pu, pu < 10 ? 2 : 1)} % Uđm — số liệu xuất xưởng tại Uđm không so được; so với số liệu xuất xưởng / khởi đầu ở cùng điện áp (Bảng 1 ghi chú c).` : '';
      const lim = isNew ? L.NOLOAD_1PH_NEW : L.NOLOAD_OPER;
      const cur2 = curCols.map(c => val(`${p}.${c}`)).filter(ok), io = cur2.length ? cur2.reduce((a, b) => a + b, 0) / cur2.length : NaN;
      if (ok(p0) && low) {
        const refP = ok(pref) ? pref : fl && ok(fl.p0) ? fl.p0 : NaN, fromFl = !ok(pref) && ok(refP);
        const d = ok(refP) ? devPct(p0, refP) : NaN;
        if (ok(d)) calc[`${p}.dp`] = sgn(d, 2);
        add({ sec: 'noload', item: `Tổn hao không tải P0 (${lan}) — đo dưới Uđm`, loc: unitLabel(unit), meas: `${fmt(p0 * 1000, 2)} W`,
          ref: ok(refP) ? `${fmt(refP * 1000, 2)} W${fromFl ? ` ở ${flU}` : uTxt} (XX)` : '', dev: ok(d) ? sgn(d) : '',
          limit: ok(d) ? `±${lim}% giá trị khởi đầu cùng điện áp (MBA 1 pha ≥110 kV, ${isNew ? 'sau lắp đặt/sửa chữa' : 'vận hành'})` : '',
          status: ok(d) ? (Math.abs(d) <= lim ? 'pass' : 'fail') : 'info', basis: R.noload,
          note: ok(d) ? lowNote + (fromFl ? flNote : uNote) : `${lowNote} Nhập P0 xuất xưởng ở cùng điện áp (cột “P0 XX”) để so sánh; không có thì lưu làm giá trị khởi đầu cho các lần sau.`,
          keys: [`${p}.p0`, `${p}.pm`, `${p}.pref`] });
      }
      // I0 cùng mức điện áp: theo A (nhập tay / test report) hoặc theo % (test report)
      const i0 = ok(val(`${p}.i0`)) ? val(`${p}.i0`) : toNum(calc[`${p}.i0`]);
      const refA = ok(iref) ? iref : fl && ok(fl.i0A) ? fl.i0A : NaN;
      const refPct = !ok(refA) && fl && ok(fl.i0) ? fl.i0 : NaN;
      const i0Row = (meas, ref, d, note, keys) => {
        add({ sec: 'noload', item: `Dòng không tải I0 (${lan})${low ? ' — đo dưới Uđm' : ''}`, loc: unitLabel(unit), meas, ref, dev: sgn(d),
          limit: '≤ +30% số liệu NSX (tham khảo)', status: d <= 30 ? 'pass' : 'warn', basis: R.noload,
          note: `${lowNote}${note} Tiêu chí 30% QĐ 1901 nêu cho MBA 3 pha — dùng tham khảo.`.trim(), keys });
      };
      let i0Done = false;
      if (ok(io) && ok(refA)) {
        const d = devPct(io, refA);
        calc[`${p}.di`] = sgn(d, 2);
        i0Row(`${fmt(io, 5)} A`, `${fmt(refA, 5)} A${ok(iref) ? uTxt : ` ở ${flU}`} (XX)`, d, ok(iref) ? uNote : flNote, curCols.map(c => `${p}.${c}`).concat([`${p}.iref`]));
        i0Done = true;
      } else if (ok(i0) && ok(refPct)) {
        const d = devPct(i0, refPct);
        calc[`${p}.di`] = sgn(d, 2);
        i0Row(`${fmt(i0, 4)} %`, `${fmt(refPct, 4)} % ở ${flU} (XX)`, d, flNote, [`${p}.i0`]);
        i0Done = true;
      }
      // tại Uđm: so với P0 xuất xưởng (test report)
      if (ok(p0) && !low) {
        const ref = fl && ok(fl.p0) ? fl.p0 : F && F.unit(unit) ? F.unit(unit).noLoadLoss : null;
        const d = devPct(p0, ref);
        if (ok(d)) calc[`${p}.dp`] = sgn(d, 2);
        add({ sec: 'noload', item: `Tổn hao không tải P0 tại Uđm (${lan})`, loc: unitLabel(unit), meas: `${fmt(p0, 2)} kW`,
          ref: ok(ref) ? `${fmt(ref, 2)} kW (XX)` : '', dev: sgn(d), limit: `±${lim}% giá trị khởi đầu (MBA 1 pha ≥110 kV, ${isNew ? 'sau lắp đặt/sửa chữa' : 'vận hành'})`,
          status: ok(d) ? (Math.abs(d) <= lim ? 'pass' : 'fail') : 'missing', basis: R.noload,
          note: ok(ref) ? 'P0 = Pm(1+d), d=(U′−U)/U′' : 'Không có tổn hao không tải xuất xưởng cho số chế tạo này', keys: [`${p}.p0`, `${p}.pm`] });
      }
      const i0ref = toNum(cfg.i0Ref);
      if (i0Done) { /* đã so với xuất xưởng cùng mức điện áp */ }
      else if (ok(i0) && low) {
        // I0 % ở điện áp thấp chỉ ghi nhận khi không có số liệu xuất xưởng cùng điện áp
        add({ sec: 'noload', item: `Dòng không tải I0 (${lan}) — đo dưới Uđm`, loc: unitLabel(unit), meas: `${fmt(i0, 4)} %`,
          status: 'info', basis: R.noload, note: `${lowNote} Nhập I0 xuất xưởng ở cùng điện áp (cột “I0 XX”, A) để so sánh.`, keys: [`${p}.i0`] });
      } else if (ok(i0)) {
        const d = devPct(i0, i0ref);
        add({ sec: 'noload', item: `Dòng không tải I0 (${lan})`, loc: unitLabel(unit), meas: `${fmt(i0, 4)} %`,
          ref: ok(i0ref) ? `${fmt(i0ref, 4)} % (NSX)` : '', dev: sgn(d), limit: ok(i0ref) ? '≤ +30% số liệu NSX (tham khảo)' : '',
          status: ok(d) ? (d <= 30 ? 'pass' : 'warn') : 'info', basis: R.noload,
          note: ok(i0ref) ? 'Tiêu chí 30% QĐ 1901 nêu cho MBA 3 pha — dùng tham khảo' : 'Nhập I0 nameplate ở Cấu hình để so sánh', keys: [`${p}.i0`] });
      }
    });
    if (is3P) PH3.forEach(ph => noloadRated(`nl.${ph}.rated`, ['ia'], serialOf(ph)));
    else noloadRated('nl.rated', ['ia', 'ib', 'ic'], main);

    // ================= 3. Điện trở cách điện =================
    // base: 'ir' (mẫu theo pha) | 'ir.A' (mẫu 3 pha); unit: số chế tạo máy được đo
    const irBlock = (base, irRows, unit) => {
    const tIR = val(`${base}.t`);
    const main = unit;
    let k1info = null;
    const convCols = findGrid(schema, `${base}.meas`).cols.some(c => c.k === 'r180') ? ['r15', 'r60', 'r180', 'r360', 'r600'] : ['r15', 'r60', 'r600'];
    irRows.forEach(row => {
      const p = `${base}.meas.${row.k}`;
      const r15 = val(`${p}.r15`), r60 = val(`${p}.r60`), r600 = val(`${p}.r600`);
      if (!row.core) {
        if (ok(r15) && ok(r60) && r15) calc[`${p}.kht`] = fmt(r60 / r15, 2);
        if (ok(r600) && ok(r60) && r60) calc[`${p}.pi`] = fmt(r600 / r60, 2);
        const c = `${base}.c20.${row.k}`;
        if (ok(tIR)) {
          convCols.forEach(x => {
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
            + INIT_NOTE.r60.text, keys: [`${p}.r60`] });
      } else {
        add({ sec: 'ir', item: `R60 ${row.label}`, meas: `${fmt(r60, 0)} MΩ`, status: 'missing', basis: R.ir, note: 'Thiếu nhiệt độ đo → chưa quy đổi/so Bảng 5', keys: [`${base}.t`] });
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
    if (k1info) notes[`${base}.k1`] = ` ${fmt(k1info.k, 3)} (Bảng 4 QĐ 1901, ∆t = ${k1info.dt} °C; ${k1info.expr}; R20 = R${ok(tIR) && tIR < 20 ? ' ÷ ' : ' × '}K1)`;
    };
    if (is3P) PH3.forEach(ph => {
      notes[`ir.${ph}.sn`] = cfg.ps[ph] ? ` ${cfg.ps[ph]}` : '';
      irBlock(`ir.${ph}`, findGrid(schema, `ir.${ph}.meas`).rows, serialOf(ph));
    });
    else irBlock('ir', sectionOf('ir').grids[0].rows, main);

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
    // BBTN theo pha tách từ mẫu 3 pha (cfg.splitFrom): sứ trung tính (cột N bảng trung áp) có kiểu sứ, cách quy đổi, nhiệt độ
    // riêng (b.n.*, b.n.meas.*.<pha>) → tính như một nhóm sứ riêng giống mẫu 3 pha; kết quả ghi vào cột N
    const mvGr = !is3P && cfg.splitFrom === '3P' && PH3.includes(cfg.template) ? sideGroups.find(g => g.id === 'mv') : null;
    const mvN = mvGr && mvGr.grids[0].cols.find(c => c.k === 'N');
    if (mvN) sideGroups.push({ id: 'n', term: '2', title: mvGr.title, grids: [{ id: 'b.n.meas', cols: [Object.assign({}, mvN, { k: cfg.template })] }, { id: 'b.n.c20' }] });
    const sideCols = (side, mg) => mg.cols.filter(c => c.phase && !(mvN && side === 'mv' && c.k === 'N'));
    // nhiệt độ đo riêng từng sứ: mẫu 3 pha, nhóm sứ trung tính tách từ mẫu 3 pha
    const perT = side => is3P || side === 'n';
    // Ur mặc định khi test report không có sứ (phân nhóm dung sai Bảng 15 Hitachi)
    const UR_DEFAULT = { hv: 550, mv: 252, N: 126, n: 126, lv: 40.5, lv2: 40.5 };
    // mẫu 3 pha ghi một nhiệt độ cho mọi nhóm sứ: nhóm để trống lấy nhiệt độ của sứ cao áp
    const tOilOf = side => (perT(side) && !ok(val(`b.${side}.t`)) ? val('b.hv.t') : val(`b.${side}.t`));
    const bLoc = (gr, c, bs) => `${gr.title.replace(/^5\.\d\s*/, '').replace(/^[a-e]\.\s*/, '').replace('Sứ phía ', '')} – ${c.label}${bs ? ` [${bs}]` : ''}`;
    // Cách quy đổi của từng phía: hitachi | table (QĐ 1901 / theo hãng) | manual
    const kmodeOf = side => (typeof BushingK !== 'undefined' ? BushingK.resolve(txt(`b.${side}.kmode`))
      : { kind: /Nhập/i.test(txt(`b.${side}.kmode`)) ? 'manual' : 'hitachi' });
    sideGroups.forEach(gr => {
      const side = gr.id, mg = gr.grids[0];
      if (kmodeOf(side).kind !== 'hitachi' || typeof HitachiBushing === 'undefined') return; // bảng K / nhập K: xử lý ở khối dưới
      const H = HitachiBushing, HK = H.consts;
      const tOil = tOilOf(side);
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

      sideCols(side, mg).forEach(c => {
        const p = `b.${side}.meas`, q = `b.${side}.c20`;
        ['type', 'manuf', 'serial'].forEach(r => { calc[`${q}.${r}.${c.k}`] = txt(`${p}.${r}.${c.k}`); });
        // mẫu 3 pha: nhiệt độ đo riêng của sứ thay nhiệt độ chung (đã lắp: nhiệt độ dầu; chưa lắp: nhiệt độ môi trường)
        const tC = perT(side) ? val(`${p}.t.${c.k}`) : NaN;
        const unm = mount === 'Chưa lắp';
        const m = { mount, tAmb: ok(tC) && unm ? tC : tAmb, tOil: ok(tC) && !unm ? tC : tOil,
          c1: val(`${p}.c1.${c.k}`), tgd1: val(`${p}.tgd1.${c.k}`), c2: val(`${p}.c2.${c.k}`), tgd2: val(`${p}.tgd2.${c.k}`) };
        const bs = txt(`${p}.serial.${c.k}`);
        const tr = H.report(bs);
        const urDef = tr && ok(tr.raw.ur) ? tr.raw.ur : UR_DEFAULT[c.k === 'N' ? 'N' : side];
        // mẫu 3 pha ghi Ur vào BBTN: chỉ điền sẵn cho sứ đã có số liệu đo hoặc S/N
        if (!is3P || bs || [m.c1, m.tgd1, m.c2, m.tgd2].some(ok)) calc[`${p}.ur.${c.k}`] = fmt(urDef, 1);
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
        const loc = bLoc(gr, c, bs);
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
      const tOil = tOilOf(side);
      const btype = txt(`b.${side}.btype`) || 'RIP';
      const rip = false; // quy đổi C theo HD Hitachi chỉ dùng ở khối trên
      const mode = kmodeOf(side);
      if (mode.kind === 'hitachi' && typeof HitachiBushing !== 'undefined') return;
      const tbl = mode.kind === 'table' ? mode.table : null;
      const mount = txt(`b.${side}.mount`) || 'Đã lắp';
      const tAmbS = ok(val(`b.${side}.tamb`)) ? val(`b.${side}.tamb`) : amb;
      // QĐ 1901 Điều 38: nhiệt độ sứ lấy bằng nhiệt độ dầu MBA; sứ chưa lắp lấy nhiệt độ môi trường
      const tB = mode.kind === 'table' ? (mount === 'Chưa lắp' ? tAmbS : tOil) : NaN;
      let K = NaN, kWhy = '';
      if (mode.kind === 'table') {
        const lk = BushingK.lookup(tbl, btype, tB);
        K = lk.k; kWhy = lk.why || (mode.missing ? `Không còn bảng “${mode.missing}”` : '');
        calc[`b.${side}.tamb`] = ok(amb) ? fmt(amb, 1) : '';
        if (ok(K)) calc[`b.${side}.k`] = fmt(K, 3);
        notes[`b.${side}.k`] = ok(K)
          ? ` ${fmt(K, 3)} (${tbl.name}, sứ ${btype}, t sứ = ${fmt(tB, 1)} °C${lk.interp ? ', nội suy' : ''}; tgδ20 = tgδ ${tbl.formula === 'MUL' ? '×' : '÷'} K)`
          : (kWhy ? ` — ${kWhy}` : '');
      } else {
        K = val(`b.${side}.k`);
        notes[`b.${side}.k`] = ok(K) ? ` ${fmt(K, 3)}` : '';
      }
      const to20 = x => (!ok(K) || !ok(x) ? NaN : tbl ? BushingK.convert(tbl, x, K) : x * K);
      const cCorr = c => c;
      notes[`b.${side}.btype`] = ' ' + btype;

      sideCols(side, mg).forEach(c => {
        const p = `b.${side}.meas`, q = `b.${side}.c20`;
        // mẫu 3 pha: sứ có nhiệt độ đo riêng → tra K theo nhiệt độ đó (bảng K); trống thì dùng K của nhiệt độ chung
        const tC = perT(side) ? val(`${p}.t.${c.k}`) : NaN;
        let Kc = K, kWhyC = kWhy, tBc = tB;
        if (ok(tC) && mode.kind === 'table') { const lk = BushingK.lookup(tbl, btype, tC); Kc = lk.k; kWhyC = lk.why || ''; tBc = tC; }
        const to20c = x => (!ok(Kc) || !ok(x) ? NaN : tbl ? BushingK.convert(tbl, x, Kc) : x * Kc);
        ['type', 'manuf', 'serial'].forEach(r => { calc[`${q}.${r}.${c.k}`] = txt(`${p}.${r}.${c.k}`); });
        const tgd1 = val(`${p}.tgd1.${c.k}`), c1 = val(`${p}.c1.${c.k}`), tgd2 = val(`${p}.tgd2.${c.k}`), c2 = val(`${p}.c2.${c.k}`);
        if (ok(tgd1) && ok(Kc)) calc[`${q}.tgd1.${c.k}`] = fmt(to20c(tgd1), 3);
        if (ok(tgd2) && ok(Kc)) calc[`${q}.tgd2.${c.k}`] = fmt(to20c(tgd2), 3);
        if (ok(c1)) calc[`${q}.c1.${c.k}`] = fmt(cCorr(c1), 1);
        if (ok(c2)) calc[`${q}.c2.${c.k}`] = fmt(cCorr(c2), 1);
        if (!ok(tgd1) && !ok(c1)) return;

        const bs = txt(`${p}.serial.${c.k}`);
        // mẫu theo pha: cột là sứ của máy đang lập, vị trí đầu sứ theo cột (hạ áp: 3.1, 3.2)
        const term = c.term || (c.k === 'N' ? '2' : gr.term);
        const unitS = c.own ? main : serialOf(c.k);
        let fb = F ? F.bushingBySerial(bs) : null, how = 'theo S/N sứ';
        if (!fb && F) { fb = F.bushingByUnit(unitS, term); how = bs ? `S/N “${bs}” không có trong XX → so theo vị trí ${term} của MBA ${unitS}` : `chưa nhập S/N → so theo vị trí ${term} của MBA ${unitS}`; }
        const loc = bLoc(gr, c, bs);
        const keysT = [`${p}.tgd1.${c.k}`], keysC = [`${p}.c1.${c.k}`];
        // Quy đổi giá trị XX về 20 °C cùng phương pháp để so sánh cùng nhiệt độ
        // bảng K: quy đổi giá trị XX bằng chính bảng đó tại nhiệt độ đo xuất xưởng
        const fK = tbl && fb && ok(fb.t) ? BushingK.lookup(tbl, btype, fb.t).k : NaN;
        const fTd20 = fb && ok(fb.td) ? (ok(fK) ? BushingK.convert(tbl, fb.td, fK) : fb.td) : NaN;
        const fC20 = fb && ok(fb.c1) ? (rip && ok(fb.t) ? fb.c1 * (1 - (fb.t - 20) * 0.0004) : fb.c1) : NaN;

        if (ok(tgd1)) {
          const td20 = to20c(tgd1);
          const lim52 = QD.BUSHING_TGD_NEW[btype];
          const nsx = toNum(cfg.bTgdMax);
          const st52 = tgd1 < lim52 ? 'pass' : 'fail';
          const stN = ok(nsx) && ok(td20) ? (td20 <= nsx ? 'pass' : 'fail') : null;
          const rise = devPct(td20, fTd20);
          let stRise = null;
          if (!isNew && ok(rise)) stRise = rise > L.BUSHING_TGD_RISE_FAIL ? 'fail' : rise >= L.BUSHING_TGD_RISE_WARN ? 'warn' : 'pass';
          const tW = ok(tC) ? tC : tOil;
          const tWarn = (ok(tW) && (tW < 10 || tW > 40) ? ' Nhiệt độ ngoài 10–40 °C (IEC 60137).' : '')
            + (tbl && ok(Kc) ? ` K = ${fmt(Kc, 3)} theo ${tbl.name}${ok(tC) ? ` tại nhiệt độ sứ ${fmt(tC, 1)} °C` : ''}.` : '') + (kWhyC ? ` Chưa quy đổi: ${kWhyC}.` : '');
          add({ sec: 'bushing', item: 'tgδ C1 sứ', loc, meas: `${fmt(tgd1, 3)} %`, conv: ok(td20) ? `${fmt(td20, 3)} % @20 °C` : 'chưa quy đổi',
            ref: fb ? `${fmt(fb.td, 3)} % @${fmt(fb.t, 1)} °C${ok(fK) ? ` → ${fmt(fTd20, 3)} % @20 °C` : ''} (XX)` : '', dev: ok(rise) ? `${sgn(rise, 1)} %` : '',
            limit: `${ok(nsx) ? `NSX ≤ ${fmt(nsx, 2)} %; ` : ''}Bảng 52 (${btype}) < ${fmt(lim52, 1)} %${isNew ? '' : '; vận hành: tăng ≤100% (70–100% cần đo 15/400 Hz)'}`,
            status: worst(st52, stN, stRise) || 'info', basis: R.bushing, note: (fb ? how : 'Không có số liệu XX của sứ này') + tWarn, keys: keysT });
        }
        if (ok(c1)) {
          const c20 = cCorr(c1);
          const lim = ok(toNum(cfg.bC1Dev)) ? toNum(cfg.bC1Dev) : L.BUSHING_C1_DEV;
          const dF = devPct(c20, fC20), dN = devPct(c20, fb ? fb.c1np : NaN);
          const st = !fb ? 'missing' : Math.max(Math.abs(ok(dF) ? dF : 0), Math.abs(ok(dN) ? dN : 0)) <= lim ? 'pass' : 'fail';
          add({ sec: 'bushing', item: 'Điện dung C1 sứ', loc, meas: `${fmt(c1, 1)} pF`, conv: rip && ok(tBc) ? `${fmt(c20, 1)} pF @20 °C` : '',
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
    if (mvN) {
      const ph = cfg.template;
      ['type', 'manuf', 'serial', 'tgd1', 'c1', 'tgd2', 'c2'].forEach(r => { if (calc[`b.n.c20.${r}.${ph}`] !== undefined) calc[`b.mv.c20.${r}.N`] = calc[`b.n.c20.${r}.${ph}`]; });
      // dòng hệ số K phía trung áp của BBTN ghi thêm K của sứ trung tính khi sứ N có số liệu
      if (['tgd1', 'tgd2'].some(r => ok(val(`b.n.meas.${r}.${ph}`))) && String(notes['b.n.k'] || '').trim())
        notes['b.mv.kN'] = `sứ trung tính (N, ${txt('b.n.btype') || 'RIP'}): K =${notes['b.n.k']}`;
    }
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
    // base: 'wtgd' (mẫu theo pha: bảng quy đổi riêng wtgd.c20) | 'wtgd.A' (mẫu 3 pha: cột tgδ@20 °C ngay trong bảng đo)
    const wtgdBlock = (base, rows, unit) => {
    const main = unit;
    const tW = val(`${base}.t`);
    const tF = F ? F.insT(main) : null;
    let k2info = null;
    rows.forEach(row => {
      const p = `${base}.meas.${row.k}`, q = is3P ? null : `${base}.c20.${row.k}`;
      const tg = val(`${p}.tgd`), C = val(`${p}.c`);
      if (q) { calc[`${q}.c`] = txt(`${p}.c`); calc[`${q}.u`] = txt(`${p}.u`); calc[`${q}.d`] = txt(`${p}.d`); }
      let tg20 = NaN;
      if (ok(tg) && ok(tW)) { const cv = QD.convTgd(tg, tW, 20); tg20 = cv.val; k2info = cv; calc[q ? `${q}.tgd` : `${p}.t20`] = fmt(tg20, 3); }
      if (ok(tg)) {
        const fref = F && row.fcfg ? F.ins(row.fcfg, 'tgd', main) : null;
        let rise = NaN, refStr = '';
        if (ok(fref) && ok(tW) && ok(tF)) {
          rise = devPct(QD.convTgd(tg, tW, tF).val, fref);
          refStr = `${fmt(fref, 3)} % @${fmt(tF, 1)} °C (XX)`;
        }
        let st, note, limit = 'tgδ@20 °C ≤ 1 %', judged = '';
        const k2 = ok(tW) ? QD.convTgd(tg, tW, 20) : null;
        if (!ok(tW)) { st = 'missing'; note = 'Thiếu nhiệt độ đo'; }
        else {
          // Điều 9 mục 5, Điều 30 mục 3: tgδ20 ≤ 1 % → tốt, không cần so với giá trị khởi đầu.
          // Lớn hơn: so với giá trị khởi đầu (quy cùng nhiệt độ, tăng ≤ 30 %); không có giá trị khởi đầu → tham khảo Bảng 46.
          if (tg20 <= L.WINDING_TGD_OK) st = 'pass';
          else if (ok(rise)) {
            st = rise > L.WINDING_TGD_RISE ? 'fail' : 'pass';
            limit = `tgδ@20 °C > ${L.WINDING_TGD_OK} % → tăng ≤ ${L.WINDING_TGD_RISE}% so với giá trị khởi đầu (cùng nhiệt độ)`;
            judged = ` tgδ20 > ${L.WINDING_TGD_OK} %: so với giá trị khởi đầu (XX) cùng nhiệt độ ${sgn(rise, 1)} % (Điều 30 mục 3).`;
          } else {
            const kv = toNum(String(txt('meta.voltage')).split(/[/;,]/)[0]);
            const cls = ok(kv) && kv >= 300 ? '330-500' : ok(kv) && kv >= 100 ? '110-220' : '';
            if (cls) {
              const b = QD.tgdTable46(tg, tW, cls);
              st = b.ok ? 'pass' : 'fail';
              limit = `tgδ@20 °C > ${L.WINDING_TGD_OK} %, không có giá trị khởi đầu → Bảng 46: ≤ ${fmt(b.max, 2)} % @${b.t2} °C (${cls.replace('-', '÷')} kV)`;
              const how = b.dt ? `quy về ${b.t2} °C bằng K2 = ${fmt(b.k, 3)} (Bảng 47, ∆t = ${b.dt} °C; ${b.expr}; tgδ(${b.t2}) = tgδ(${fmt(tW, 1)})${b.t2 > tW ? ' × ' : ' ÷ '}K2) được ${fmt(b.val, 3)} %`
                : `đo đúng nhiệt độ cột ${b.t2} °C`;
              judged = ` tgδ20 > ${L.WINDING_TGD_OK} %, không có giá trị khởi đầu: tham khảo Bảng 46 — tgδ đo ${fmt(tg, 3)} % @${fmt(tW, 1)} °C, ${how}, so với ${fmt(b.max, 2)} % (Điều 30 mục 3).`;
            } else {
              st = 'warn';
              limit = `tgδ@20 °C > ${L.WINDING_TGD_OK} % → so với giá trị khởi đầu (Điều 30 mục 3)`;
              judged = ` tgδ20 > ${L.WINDING_TGD_OK} %: chưa có giá trị khởi đầu; Bảng 46 cần điện áp cao áp (ô Điện áp định mức) để tra.`;
            }
            judged += ' Nếu CSDL có giá trị khởi đầu thì đánh giá theo dòng Xu hướng.';
          }
          note = (judged ? judged.trim() + ' ' : '') + `K2 theo Bảng 7 với ∆t = ${k2.dt} °C (${k2.expr}).`
            // QĐ 1901 chỉ nêu "nhân các hệ số tương ứng" (vd 9 = 5 + 4); với ∆t > 16 °C không quy định cách tách
            + (k2.dt > 16 ? ' ∆t > 16 °C: K2 = tích các cột 1…15 của Bảng 7 (không dùng cột 16), theo quy ước đơn vị.' : '')
            // Điều 30: tgδ đo ở nhiệt độ cao, sau hiệu chỉnh lớn bất thường → để MBA nguội và đo lại
            + (st === 'fail' && tW > 20 ? ' QĐ 1901 Điều 30: nếu giá trị sau hiệu chỉnh lớn bất thường khi đo ở nhiệt độ cao, nên để MBA nguội đi rồi đo lại.' : '')
            + (tW < 10 || tW > 40 ? ' Khuyến cáo đo khi nhiệt độ dầu 10–40 °C (Điều 9 mục 4).' : '')
            + (ok(rise) && !judged ? ` Tham khảo: so với XX cùng nhiệt độ ${sgn(rise, 1)} %.` : '');
        }
        add({ sec: 'wtgd', item: `tgδ cuộn dây ${row.label || 'đối tượng bổ sung'}`, loc: unitLabel(main), meas: `${fmt(tg, 3)} % @${ok(tW) ? fmt(tW, 1) : '?'} °C`,
          conv: ok(tg20) ? `${fmt(tg20, 3)} % @20 °C (${tW >= 20 ? '÷' : '×'} K2 = ${fmt(k2.k, 3)})` : '', ref: refStr, dev: ok(rise) ? `${sgn(rise, 1)} % (cùng nhiệt độ)` : '',
          limit, status: st, basis: R.wtgd, note, keys: [`${p}.tgd`], ...(st !== 'missing' && tg20 > L.WINDING_TGD_OK && !ok(rise) ? { tgdNoInit: true } : {}) });
      }
      if (ok(C)) {
        const fref = F && row.fcfg ? F.ins(row.fcfg, 'c', main) : null;
        const cc = TestItems.capacitance({ c: C, ref: fref, lim: L.WINDING_C_DEV });
        add({ sec: 'wtgd', item: `Điện dung cuộn dây ${row.label || 'đối tượng bổ sung'}`, loc: unitLabel(main), meas: `${fmt(C, 1)} pF`, ref: ok(fref) ? `${fmt(fref, 0)} pF (XX)` : '',
          dev: sgn(cc.dev), limit: `±${L.WINDING_C_DEV}% so với giá trị khởi đầu`, status: cc.status,
          basis: R.wtgd, note: ok(fref) ? '' : INIT_NOTE.cap.text, keys: [`${p}.c`] });
      }
    });
    if (k2info) notes[`${base}.k2`] = ` ${fmt(k2info.k, 3)} (Bảng 7 QĐ 1901, ∆t = ${k2info.dt} °C; ${k2info.expr}; tgδ20 = tgδ${ok(tW) && tW < 20 ? ' × ' : ' ÷ '}K2)`;
    if (is3P) notes[`${base}.th`] = ok(tW) ? ` ${fmt(tW, 1)}` : '';
    };
    if (is3P) PH3.forEach(ph => wtgdBlock(`wtgd.${ph}`, findGrid(schema, `wtgd.${ph}.meas`).rows, serialOf(ph)));
    else wtgdBlock('wtgd', sectionOf('wtgd').grids[0].rows, main);

    // ================= 7. Điện trở một chiều =================
    // mẫu 110–220 kV, OLTC ở cuộn trung áp: cuộn trung áp so XX theo nấc (khi file XX có), cuộn cao áp một giá trị
    const oltcMV = schema.oltcWinding === 'MV';
    // OLTC ở cuộn trung áp: U cao áp không đổi theo nấc → tỷ số HV:LV (một hàng) lấy theo một nấc bất kỳ của bảng tỷ số XX,
    // chỉ khi mọi nấc cùng U cao áp (file XX đúng loại máy); không thì không có định mức
    const fixedHvTap = () => {
      const taps = F && F.data.ratio && F.data.ratio.taps || [];
      if (!oltcMV || !taps.length) return null;
      const hv = taps.map(x => x.hvKV).filter(ok);
      return hv.length === taps.length && hv.every(x => Math.abs(x - hv[0]) < 1e-6) ? taps[0] : null;
    };
    const dcrGroups = [
      { g: 'dcr.hv', t: 'dcr.hv.t', winding: cfg.hvMeas === 'SER' ? ['SER'] : ['SER', 'COM'], label: 'Cuộn cao áp' },
      { g: 'dcr.mv', t: 'dcr.mv.t', winding: ['COM'], label: oltcMV ? 'Cuộn trung áp (OLTC)' : 'Cuộn trung áp (chung)', byTap: oltcMV },
      { g: 'dcr.lv', t: 'dcr.lv.t', winding: ['LV'], label: 'Cuộn hạ áp', delta: cfg.lvMode === 'delta' },
    ];
    const dcrRef = Schema.dcrRefOf(cfg);
    dcrGroups.forEach(G => {
      const grid = findGrid(schema, G.g);
      grid.rows.forEach(row => {
        const vals = [], vals75 = [];
        ['A', 'B', 'C'].forEach(ph => {
          // nhiệt độ đo của pha đó trong cuộn dây → nhiệt độ chung của cuộn → (mẫu 3 pha) nhiệt độ máy pha đó
          const t = Schema.dcrTemp(val, G.g, ph, is3P);
          const k = `${G.g}.${row.k}.${ph}`;
          const m = val(k);
          // R quy về nhiệt độ quy đổi đã chọn (mặc định 75 °C) — hiển thị và ghi BBTN; so XX vẫn ở nhiệt độ của XX.
          // vals / vals75 luôn cùng vị trí pha A, B, C (ô trống → NaN) để so độ lệch đúng pha
          const r75 = ok(m) && ok(t) ? QD.convDCR(m, t, dcrRef) : NaN;
          vals.push(m);
          vals75.push(r75);
          if (!ok(m)) return;
          if (ok(r75)) calc[`${G.g}.${row.k}.r75${ph}`] = fmt(r75);
          const s = serialOf(ph);
          // nấc trung gian 9b, 9c: chạy bypass khi chuyển nấc, vận hành chỉ dùng 9a — chỉ 9a so với nấc 9A xuất xưởng
          const bypass = /^\d+[BC]$/i.test(String(row.tap || ''));
          const parts = F && !bypass ? G.winding.map(w => F.dcr(w, row.tap, s, G.byTap ? { byTap: true } : undefined)) : [];
          const okRef = parts.length && parts.every(Boolean);
          let ref = okRef ? parts.reduce((a, b) => a + b.r75, 0) * 1000 : NaN; // Ω → mΩ
          if (okRef && G.delta) ref *= 2 / 3;
          const refT = okRef ? parts[0].refT : 75;
          const rd = TestItems.dcr({ m, t, ref, refT, lim: L.DCR_DEV });
          const m75 = rd.atRef, d = rd.dev;
          if (ok(d)) calc[`${G.g}.${row.k}.d${ph}`] = fmt(d, 2);
          const tapNote = okRef && row.tap && parts[0].tap && parts[0].tap.toUpperCase() !== String(row.tap).toUpperCase() ? ` (nấc XX ${parts[0].tap})` : '';
          add({ sec: 'dcr', item: `R một chiều ${G.label}`, loc: `${row.tap ? 'Nấc ' + row.tap + tapNote + ' – ' : ''}pha ${ph} – ${s}`,
            meas: `${fmt(m)} mΩ @${ok(t) ? fmt(t, 1) : '?'} °C`, conv: ok(m75) ? `${fmt(m75)} mΩ @${refT} °C` : '',
            ref: okRef ? `${fmt(ref)} mΩ @${refT} °C (XX ${G.winding.join('+')}${G.delta ? ' ×2/3' : ''})` : '', dev: sgn(d),
            limit: `±${L.DCR_DEV}% so với NSX cùng nhiệt độ`, status: rd.status,
            basis: R.dcr, note: !ok(t) ? 'Thiếu nhiệt độ đo' : okRef ? 'R75 = R·(235+75)/(235+t)'
              : bypass ? `Nấc ${row.tap} chạy bypass khi chuyển nấc (vận hành dùng ${String(row.tap).replace(/[BC]$/i, 'a')}) — không so với XX` : 'Không có số liệu XX tương ứng', keys: [k] });
        });
        // các pha đo ở nhiệt độ khác nhau: so sánh sau khi quy về cùng nhiệt độ quy đổi (QĐ 1901 Điều 31);
        // thiếu nhiệt độ ở pha có số đo thì so trên giá trị đo như trước
        const all75 = vals.every((m, i) => !ok(m) || ok(vals75[i]));
        const sp = TestItems.spread(all75 ? vals75 : vals, L.DCR_DEV);
        if (sp) {
          calc[`${G.g}.${row.k}.dP`] = fmt(sp.sp, 2);
          add({ sec: 'dcr', item: `Độ lệch R giữa các pha – ${G.label}`, loc: row.tap ? `Nấc ${row.tap}` : '', meas: `${fmt(sp.sp, 2)} %`,
            limit: `≤ ${L.DCR_DEV}% ((Rmax−Rmin)/RTB)`, status: sp.status, basis: R.dcr, keys: [`${G.g}.${row.k}.dP`] });
        }
      });
    });

    // ================= 8. Tỷ số biến =================
    const bank = cfg.lvMode === 'delta';
    const ratioGroups = [
      { g: 'ratio.hm', label: 'HV:MV', nominal: tap => { const r = F && F.ratioTap(tap); return r ? (r.nominal || r.hvKV / r.mvKV) : NaN; },
        ferr: (tap, s) => { const r = F && F.ratioTap(tap); return r ? toNum(r.err[s]) : NaN; } },
      { g: 'ratio.hl', label: 'HV:LV', nominal: tap => { const r = F && (tap ? F.ratioTap(tap) : fixedHvTap()), lv = F && F.data.ratio.mvlv ? F.data.ratio.mvlv.lvKV : NaN; return r && ok(lv) ? r.hvKV / Math.sqrt(3) / lv * (bank ? Math.sqrt(3) : 1) : NaN; },
        ferr: () => NaN },
      { g: 'ratio.ml', label: 'MV:LV', nominal: tap => {
          const m = F && F.data.ratio.mvlv;
          if (!m) return NaN;
          // OLTC ở cuộn trung áp: tỷ số MV:LV theo nấc = tỷ số định mức × U trung áp của nấc / U trung áp định mức (theo file XX)
          if (oltcMV && tap) { const r = F.ratioTap(tap); return r && ok(r.mvKV) && ok(m.mvKV) ? m.nominal * r.mvKV / m.mvKV * (bank ? Math.sqrt(3) : 1) : NaN; }
          return m.nominal * (bank ? Math.sqrt(3) : 1);
        },
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
          const rr = TestItems.ratio({ m, nominal: nom, manualDev: val(`${G.g}.${row.k}.d${ph}`), lim: L.RATIO_DEV });
          if (ok(rr.devAuto)) calc[`${G.g}.${row.k}.d${ph}`] = fmt(rr.devAuto, 3);
          const d = rr.dev;
          const fe = G.ferr(row.tap, s);
          add({ sec: 'ratio', item: `Tỷ số biến ${G.label}`, loc: `${row.tap ? 'Nấc ' + row.tap + ' – ' : ''}pha ${ph} – ${s}`, meas: fmt(m, 4),
            ref: ok(nom) ? `Kđm = ${fmt(nom, 4)}${ok(fe) ? `; sai số XX ${sgn(fe, 2)} %` : ''}` : '', dev: ok(d) ? `${sgn(d, 3)} %` : '',
            limit: `±${L.RATIO_DEV}% so với nameplate`, status: rr.status, basis: R.ratio,
            note: ok(fe) && ok(d) ? `Chênh với sai số xuất xưởng: ${sgn(d - fe, 3)} điểm %` : (ok(nom) ? '' : 'Không xác định được tỷ số định mức cho nấc này'),
            keys: [k, `${G.g}.${row.k}.d${ph}`] });
        });
        const sp = TestItems.spread(vals, L.RATIO_DEV);
        if (sp) {
          calc[`${G.g}.${row.k}.dP`] = fmt(sp.sp, 3);
          add({ sec: 'ratio', item: `Độ lệch tỷ số giữa các pha ${G.label}`, loc: row.tap ? `Nấc ${row.tap}` : '', meas: `${fmt(sp.sp, 3)} %`,
            limit: `≤ ${L.RATIO_DEV}%`, status: sp.status, basis: R.ratio, keys: [`${G.g}.${row.k}.dP`] });
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
    if (is3P) {
      // mẫu 3 pha: bảng số vòng theo pha (oltc.r), 6 lần tăng + 6 lần giảm nấc
      const og = findGrid(schema, 'oltc.r');
      const filled = og.rows.filter(r => PH3.some(ph => txt(`oltc.r.${r.k}.k${ph}`) || txt(`oltc.r.${r.k}.c${ph}`)));
      if (oe || filled.length) add({ sec: 'oltc', item: 'Thí nghiệm OLTC (vòng quay, chụp công tắc K)', meas: `${filled.length} lần chuyển nấc có số vòng quay`,
        status: oe === 'Đạt' ? 'pass' : oe === 'Không đạt' ? 'fail' : 'missing', basis: R.oltc, note: oe ? 'Căn cứ kết quả thí nghiệm & hướng dẫn NSX' : 'Chưa chọn kết luận OLTC', keys: ['oltc.eval'] });
    } else if (oe || ['d1', 'd2'].some(d => txt(`oltc.rounds.${d}.k`) || txt(`oltc.rounds.${d}.cyc`))) {
      add({ sec: 'oltc', item: 'Thí nghiệm OLTC (vòng quay, chụp công tắc K)', meas: ['d1', 'd2'].map(d => `${txt(`oltc.rounds.${d}.k`) || '?'} / ${txt(`oltc.rounds.${d}.cyc`) || '?'}`).join('; '),
        status: oe === 'Đạt' ? 'pass' : oe === 'Không đạt' ? 'fail' : 'missing', basis: R.oltc, note: oe ? 'Căn cứ kết quả thí nghiệm & hướng dẫn NSX' : 'Chưa chọn kết luận OLTC', keys: ['oltc.eval'] });
    }
    // Chụp sóng điện trở động (nhập từ máy đo): QĐ 1901 không nêu ngưỡng → chỉ báo bất thường máy đo ghi nhận
    const osc = (state.att && state.att.oltc) || {};
    Object.keys(osc).sort().forEach(ph => {
      const r = osc[ph], n = r.rows.length || r.waves.length, an = OltcWave.anomalies(r);
      add({ sec: 'oltc', item: 'Chụp sóng điện trở động OLTC', loc: `Pha ${ph}`, meas: `${n} lần chuyển nấc`, status: an.length ? 'warn' : 'info', basis: R.oltc,
        note: (an.length ? an.map(a => a.text).join('; ') + '. ' : '') + 'Đồ thị ở Phụ lục BBTN; đánh giá theo hướng dẫn NSX OLTC', keys: ['oltc.osc'] });
    });

    // ================= 10. Độ ẩm cách điện cứng =================
    // mẫu 3 pha: ẩm theo từng máy (moist.r.A/B/C); mẫu theo pha: một giá trị của máy chính
    const moistOf = (key, unit) => {
      const mo = val(key);
      if (!ok(mo)) return;
      const c = QD.classifyMoisture(mo);
      const ref = F ? F.moisture(unit) : null;
      add({ sec: 'moisture', item: 'Độ ẩm cách điện cứng', loc: unitLabel(unit), meas: `${fmt(mo, 2)} %`, ref: ok(ref) ? `${fmt(ref, 2)} % (DFR xuất xưởng)` : '',
        dev: ok(ref) ? `${sgn(mo - ref, 2)} điểm %` : '', limit: '< 2,2 %: khô', status: c.status, basis: R.moisture, note: c.text, keys: [key] });
    };
    if (is3P) PH3.forEach(ph => moistOf(`moist.r.${ph}`, serialOf(ph)));
    else moistOf('moist.val', main);

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
        const s = schema.unitOwn ? main : serialOf(side === 'lv' ? ph.toUpperCase() : ph);
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
        const s = schema.unitOwn ? main : serialOf(side === 'lv' ? ph.toUpperCase() : ph);
        const fb = F ? F.bct(s, term) : null;
        const rd = TestItems.dcr({ m, t: tCT, ref: fb ? fb.r75 : NaN, refT: 75, lim: Infinity });
        const m75 = rd.atRef, d = rd.dev;
        add({ sec: 'bct', item: 'R một chiều TI chân sứ', loc: `${S.label} – pha ${ph} – ${term} – ${s}`, meas: `${fmt(m)} Ω @${ok(tCT) ? fmt(tCT, 1) : '?'} °C`,
          conv: ok(m75) ? `${fmt(m75)} Ω @75 °C` : '', ref: fb ? `${fmt(fb.r75)} Ω @75 °C (XX)` : '', dev: sgn(d),
          limit: 'So sánh với NSX (QĐ 1901 không nêu ngưỡng)', status: !ok(tCT) ? 'missing' : 'info', basis: R.bct,
          note: !ok(tCT) ? 'Thiếu nhiệt độ đo' : fb ? '' : `Không có số liệu XX cho ${term}`, keys: [k] });
      }));
    });
    const exCount = Object.keys(v).filter(k => /^bct\.\w+\.ex\./.test(k) && txt(k)).length;
    if (exCount) add({ sec: 'bct', item: 'Đặc tính từ hóa V-A', meas: `${exCount} giá trị`, status: 'info', basis: R.bct, note: 'XX không có đặc tính V-A → lưu làm giá trị khởi đầu, so sánh các pha cùng loại' });
    if (txt('bct.polarity')) add({ sec: 'bct', item: 'Cực tính TI chân sứ', meas: txt('bct.polarity'), ref: 'Subtractive (XX)', status: /sai|ngược|không đúng/i.test(txt('bct.polarity')) ? 'fail' : 'pass', basis: R.bct, keys: ['bct.polarity'] });

    // ================= Tiêu chí xu hướng QĐ 1901 theo lịch sử CSDL =================
    // Dòng CSDL của biên bản đang nhập (cùng khóa như khi lưu) ↔ lịch sử v_trend_delta của cùng thiết bị; đại lượng có tiêu chí
    // so với giá trị khởi đầu / lần trước → dòng "Xu hướng …" (bổ sung, không thay đánh giá so với xuất xưởng).
    const trendFindings = () => {
      if (!history.length || typeof TrendInline === 'undefined' || typeof MbaRows === 'undefined') return;
      let pack;
      // kết quả tạm cho fieldRows (chỉ cần khóa và giá trị; fieldRows còn gọi autoConclusion nên cần đủ hạng mục)
      const blank = Object.fromEntries(schema.sections.map(s => [s.id, { status: null, text: '', counts: { pass: 0, warn: 0, fail: 0, missing: 0, info: 0 } }]));
      try { pack = MbaRows.fieldRows(state, { calc, findings: [], sec: blank }, schema, { withKey: true }); } catch (_) { return; }
      const serialOfRef = new Map(pack.refs.map(r => [r.key, r.serial_no]));
      const secOf = Common.sectionOfKey(schema);
      const rowLabelOf = new Map();
      Common.eachGrid(schema, g => g.rows.forEach(r => g.cols.forEach(cl => rowLabelOf.set(`${g.id}.${r.k}.${cl.k}`, r.label))));
      const hostOf = new Map();
      findings.forEach(fd => (fd.keys || []).forEach(k => { if (!hostOf.has(k)) hostOf.set(k, fd); }));
      const c1Lim = ok(toNum(cfg.bC1Dev)) ? toNum(cfg.bC1Dev) : L.BUSHING_C1_DEV;
      // nhóm lịch sử theo khóa so khớp của TrendInline (item, param, config, phase, tap) — mỗi dòng chỉ quét nhóm của nó
      const keyOf = r => TrendInline.KEY.map(k => String(r[k] ?? '')).join('|');
      const byKey = new Map();
      history.forEach(h => { if (!TREND_RULES[`${h.item}:${h.param}`]) return; const k = keyOf(h); (byKey.get(k) || byKey.set(k, []).get(k)).push(h); });
      pack.rows.forEach(row => {
        const rule = TREND_RULES[`${row.item}:${row.param}`];
        if (!rule || !row.key) return;
        const norm = Number.isFinite(row.value_norm) ? row.value_norm : null;
        // tiêu chí quy về 20 °C: thiếu nhiệt độ / hệ số quy đổi → không so số thô ở nhiệt độ khác nhau
        if (rule.norm && norm === null) return;
        const cur = norm !== null ? norm : row.value;
        if (!ok(cur)) return;
        const group = byKey.get(keyOf(row));
        if (!group) return;
        const s = TrendInline.series(group, Object.assign({}, row, { serial_no: serialOfRef.get(row.eq), value_cmp: cur, cmp_basis: norm !== null ? 'norm' : 'raw' }),
          { sessionId: opts.sessionId, testDate });
        if (!s) return;
        const j = rule.judge({ fromBase: s.fromBase, fromPrevious: s.fromPrevious, base: s.base, cur, L, isNew, layout: schema.layout, c1Lim });
        if (!j) return;
        const pc = d => `${sgn(d, 1)} %`, val = x => `${fmt(+x, rule.digits)} ${rule.unit}`;
        const baseName = TrendInline.baseInfo(s.base, row.item).name;
        const refs = [`${baseName} ${isoToVn(s.base.test_date)}: ${val(s.base.value_cmp)} (${pc(s.fromBase)})`]
          .concat(s.fromPrevious !== null ? [`lần trước ${isoToVn(s.previous.test_date)}: ${val(s.previous.value_cmp)} (${pc(s.fromPrevious)})`] : []);
        const devs = (rule.both ? [s.fromBase, s.fromPrevious] : [s.fromBase]).filter(fin);
        const worst = devs.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), devs[0]);
        const host = hostOf.get(row.key);
        const bad = j.status === 'fail' || j.status === 'warn';
        const lbl = rule.rowLabel && rowLabelOf.get(row.key) ? ' ' + rowLabelOf.get(row.key) : '';
        add({ sec: secOf(row.key) || (host && host.sec), item: `Xu hướng ${rule.name}${lbl}`, loc: host ? host.loc : '',
          meas: `${val(cur)}${norm !== null && (rule.unit === 'MΩ' || rule.unit === '%') ? ' @20 °C' : ''}`, ref: refs.join('; '),
          dev: pc(worst), limit: j.limit, status: j.status, basis: rule.basis, trend: true, trendFail: bad || undefined,
          note: bad ? `${rule.name} vượt tiêu chí so với ${rule.both ? 'giá trị khởi đầu / lần trước' : 'giá trị khởi đầu'}. ${j.actions}`
            : `So với ${s.history.length} lần đo trước trong CSDL.`, keys: [row.key] });
        // tgδ cuộn dây > 1 % không có XX: CSDL có giá trị khởi đầu → đánh giá theo dòng xu hướng (Điều 30 mục 3), Bảng 46 chỉ tham khảo
        if (host && host.tgdNoInit && rule === TREND_RULES['WTGD:TGD']) {
          host.status = 'info';
          host.note = host.note.replace(/^tgδ20 > .*?Nếu CSDL có giá trị khởi đầu thì đánh giá theo dòng Xu hướng\. /,
            `tgδ20 > ${L.WINDING_TGD_OK} %: đánh giá theo giá trị khởi đầu trong CSDL — xem dòng Xu hướng (Điều 30 mục 3); Bảng 46 chỉ tham khảo. `);
        }
        // dòng so XX ghi "lưu làm giá trị khởi đầu" trong khi CSDL đã có giá trị khởi đầu → trỏ sang dòng xu hướng
        if (host && host.note) Object.values(INIT_NOTE).forEach(n => { host.note = host.note.replace(n.text, n.withHistory); });
      });
    };
    trendFindings();

    // Thí nghiệm ngắn mạch (Uk, Pk theo QĐ 1901 Điều 35, QĐ 1387) — tính ở Appendix, gộp vào kết quả chung
    if (typeof Appendix !== 'undefined' && Appendix.shortCircuitFindings) Appendix.shortCircuitFindings(state, F).forEach(add);

    // ================= Tổng hợp theo hạng mục =================
    const sec = {};
    for (let i = findings.length - 1; i >= 0; i--) if (Report.isSkipped(state, findings[i].sec)) findings.splice(i, 1);
    schema.sections.forEach(s => { sec[s.id] = { status: null, counts: { pass: 0, warn: 0, fail: 0, missing: 0, info: 0 } }; });
    findings.forEach(f => { const S = sec[f.sec]; if (!S) return; S.counts[f.status]++; S.status = worst(S.status, f.status); });
    Object.values(sec).forEach(S => {
      S.text = !S.status ? '' : S.status === 'fail' ? 'Không đạt' : S.status === 'warn' ? 'Cần xem xét' : S.status === 'missing' ? 'Thiếu dữ liệu' : 'Đạt';
    });
    schema.sections.forEach(s => { if (Report.isSkipped(state, s.id)) Object.assign(sec[s.id], { skipped: true, text: 'Không thực hiện' }); });
    return { calc, findings, sec, notes };
  }


  function autoConclusion(res, schema, state) {
    const failed = schema.sections.filter(s => res.sec[s.id].status === 'fail').map(s => `${s.no}. ${s.title}`);
    const warned = schema.sections.filter(s => res.sec[s.id].status === 'warn').map(s => `${s.no}. ${s.title}`);
    const missing = schema.sections.filter(s => res.sec[s.id].status === 'missing').map(s => `${s.no}. ${s.title}`);
    const done = schema.sections.filter(s => res.sec[s.id].status).length;
    if (!done) return '';
    const parts = [];
    if (failed.length) parts.push(`Hạng mục chưa đạt: ${failed.join('; ')}. Đề nghị kiểm tra, thí nghiệm bổ sung và báo cáo người có thẩm quyền xem xét trước khi đóng điện.`);
    // tiêu chí xu hướng QĐ 1901 (so với giá trị khởi đầu / lần trước trong CSDL) không đạt / cần xem xét
    const trendBad = res.findings.filter(f => f.trendFail);
    if (trendBad.some(f => /^Xu hướng R60@20/.test(f.item))) {
      parts.push(`R60 cách điện cuộn dây quy đổi về 20 °C giảm quá ${Criteria.limits().IR_DROP}% so với giá trị khởi đầu / lần thí nghiệm trước: `
        + 'đề nghị kiểm tra điều kiện đo và đo lại, đo hệ số phân cực PI; nếu các hạng mục thí nghiệm khác đạt tiêu chuẩn vận hành, '
        + 'việc đóng điện MBA do người có thẩm quyền quyết định (QĐ 1901 Điều 29 mục 3).');
    }
    const otherTrend = [...new Set(trendBad.filter(f => !/^Xu hướng R60@20/.test(f.item)).map(f => `${f.item.replace(/^Xu hướng /, '')} (${f.basis.replace(/^QĐ 1901 /, '')})`))];
    if (otherTrend.length) parts.push(`Xu hướng vượt tiêu chí QĐ 1901 so với giá trị khởi đầu: ${otherTrend.join('; ')} — đề nghị kiểm tra, đo lại theo hướng dẫn và báo cáo người có thẩm quyền xem xét.`);
    if (warned.length) parts.push(`Hạng mục cần theo dõi/xem xét: ${warned.join('; ')}.`);
    if (missing.length) parts.push(`Hạng mục còn thiếu dữ liệu đánh giá: ${missing.join('; ')}.`);
    if (!failed.length && !warned.length && !missing.length) parts.push('Các hạng mục đã thí nghiệm đạt tiêu chuẩn theo QĐ 1901/QĐ-EVNNPT và phù hợp với số liệu xuất xưởng.');
    // ngưỡng đơn vị khác QĐ 1901 → ghi rõ căn cứ đánh giá
    const own = Criteria.changedText();
    if (own) parts.push(own);
    return parts.join(' ');
  }

  window.Evaluate = { evaluate, autoConclusion, findGrid, fmt, toNum, RANK, worst };
})();
