// MBA: phần giao diện riêng của loại thiết bị — chú thích từng hạng mục, cấu hình ở mục 0, công cụ mục 5/6/7/8/9/11
// (sứ, đối tượng đo tgδ, Haefely 2293 và xem trước chụp sóng OLTC, CPC 100), file test report sứ Hitachi. Lõi giao diện (js/ui/app.js) gọi qua TypeUI.MBA.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const LS_HIT = 'bbtn-mba.customHitachi';
  let cpcTarget = null; // ô pha/phía đang tải XML CPC 100

  // ---------------------------------------------------------------- chú thích đầu mỗi hạng mục
  function intro(id, A) {
    const { state, FX, esc } = A, fm = Common.fmt;
    if (!FX) return '<div class="callout warn">Chưa nạp số liệu xuất xưởng — chỉ đánh giá theo ngưỡng QĐ 1901.</div>';
    const D = FX.data, s = state.v['meta.serial'], u = FX.unit(s);
    const mainLine = u ? `Máy chính <b>${esc(s)}</b> (pha ${esc(u.phase)})` : `<b>Số chế tạo “${esc(s || '')}” không có trong file xuất xưởng</b> — kiểm tra lại mục 0`;
    const cond = (D.conditions[s] || {});
    const ps = `Cột pha A/B/C ↔ ${['A', 'B', 'C'].map(p => esc(state.cfg.ps[p] || '—')).join(' / ')}`;
    switch (id) {
      case 'noload': return `<div class="callout">${mainLine}: P0 xuất xưởng = <b>${u ? fm(u.noLoadLoss, 1) : '—'} kW</b> (đo ${fm(cond.noload, 1)} °C). P0 = Pm(1+d), d=(U′−U)/U′; I0% = Io/I<sub>LV</sub> × S<sub>LV</sub>/S<sub>r</sub> × 100 với I<sub>LV</sub>=${esc(state.cfg.iLV)} A, S<sub>LV</sub>=${esc(state.cfg.sLV)} MVA, S<sub>r</sub>=${esc(state.cfg.sR)} MVA (sửa ở mục 0).</div>`;
      case 'ir': return `<div class="callout">${mainLine}. Quy đổi về 20 °C theo <b>Bảng 4 QĐ 1901</b>: R20 = R(t) × K1 (đo dưới 20 °C thì chia K1); K1 tự tra theo độ chênh nhiệt độ, độ chênh không có trong bảng thì nhân các hệ số (vd 12 °C = K(10)×K(2)). Tiêu chuẩn: <b>R60@20 ≥ Bảng 5 tại 20 °C</b> (MBA ≥110 kV: 600 MΩ). Xuất xưởng (đo ${fm(cond.ins, 1)} °C) chỉ có Kht, PI và R lõi/gông.</div>`;
      case 'bushing': {
        const bl = D.bushings.filter(b => Object.values(state.cfg.ps).includes(b.mba));
        const HB = window.HitachiBushing, HK = HB && HB.consts, tl = HK && HK.tol;
        return `<div class="callout"><b>Sứ RIP Hitachi Energy</b> quy đổi theo HD vận hành sứ của hãng (mục 19.6–19.8):
          T sứ = T môi trường khi <b>chưa lắp</b>, = (2·T môi trường + T dầu)/3 khi <b>đã lắp</b>; tanδ20 = tanδ/fc; C20 = C·(1 − ∆T·${HK ? String(HK.cCoef).replace('.', ',') : '0,0004'});
          sứ đã lắp cộng ΔC lắp đặt vào C1 (${HK ? HK.dC.map(r => `Ur ≤ ${r.ur} kV: ${r.pf} pF`).join('; ') : ''}).
          So với <b>test report của hãng tra theo S/N sứ</b> (${esc(HB && HB.source ? `${HB.source}, ${HB.reports.length} sứ` : 'chưa nạp — nạp ở mục 0')}):
          ${tl ? `Ur ≤ ${HK.urSplit} kV: C1 ±${tl.low.c1 * 100}%, tanδ1 ±${String(tl.low.tgd1).replace('.', ',')}, C2 ±${tl.low.c2 * 100}%, tanδ2 ±${String(tl.low.tgd2).replace('.', ',')} điểm %; Ur > ${HK.urSplit} kV: C1 ±${tl.high.c1 * 100}%` : ''}.
          Sứ không có trong test report thì so với giá trị nhãn trong hồ sơ MBA (${bl.length} sứ của các máy đang chọn; ${ps}).
          <br>Chọn <b>Theo QĐ 1901</b> hoặc <b>Theo hãng</b> ở ô “Cách quy đổi về 20 °C”: tra hệ số K theo loại cách điện sứ và nhiệt độ sứ (đã lắp: nhiệt độ dầu; chưa lắp: nhiệt độ môi trường), tgδ20 = tgδ(t) × K. Bảng K do Admin cấu hình ở trang “Hệ số quy đổi sứ”.
          <div class="row-actions"><button class="btn small" data-nav="kconf">Xem bảng hệ số K</button><button class="btn small" data-act="fillBushingSN">Điền S/N sứ theo hồ sơ xuất xưởng (cần đối chiếu thực tế)</button></div></div>`;
      }
      case 'wtgd': return `<div class="callout">${mainLine}. Quy đổi về 20 °C theo <b>Bảng 7 QĐ 1901</b>: tgδ20 = tgδ(t) ÷ K2 (đo dưới 20 °C thì nhân K2); K2 tự tra theo độ chênh nhiệt độ. Tiêu chuẩn: <b>tgδ@20 °C ≤ 1 %</b>. Số liệu xuất xưởng (đo ${fm(FX.insT(s), 1)} °C) chỉ để tham khảo xu hướng.</div>`;
      case 'dcr': return `<div class="callout">So sánh theo số chế tạo của từng cột pha (${ps}). Xuất xưởng cho R quy đổi ${D.dcr.refT} °C: cuộn SER theo nấc, COM, LV. Phép đo A–N hiện trường được so với <b>${state.cfg.hvMeas === 'SER' ? 'SER' : 'SER + COM'}</b>; cuộn hạ áp: ${state.cfg.lvMode === 'delta' ? 'tam giác đã đấu (×2/3)' : 'từng máy (a–x)'} — đổi ở mục 0. Nấc 9a/9b/9c ứng với nấc 9A xuất xưởng.</div>`;
      case 'ratio': return `<div class="callout">Tỷ số định mức lấy từ bảng xuất xưởng theo nấc (HV:MV), HV:LV = (U<sub>HV</sub>/√3)/U<sub>LV</sub>${state.cfg.lvMode === 'delta' ? ' × √3 (tổ đã đấu tam giác)' : ''}. ΔK tự tính nếu để trống; có thể nhập ΔK đọc từ máy đo. ${ps}.</div>`;
      case 'oltc': return `<div class="callout">OLTC theo hồ sơ xuất xưởng: <b>${esc(D.specs.oltc || '—')}</b>.</div>`;
      case 'moisture': return `<div class="callout">${mainLine}: độ ẩm cách điện cứng theo DFR xuất xưởng = <b>${fm(FX.moisture(s), 2)} %</b>. Phân loại theo Điều 28.</div>`;
      case 'bct': return `<div class="callout">Tra số liệu BCT theo <b>số chế tạo MBA (cột pha) + ký hiệu đầu cuộn</b> (vd 2S1-2S3). Mã lõi CT ứng với “cuộn 1..n” của từng phía đặt ở mục 0 (HV: ${esc(state.cfg.ctNo.hv)}; MV: ${esc(state.cfg.ctNo.mv)}; N: ${esc(state.cfg.ctNo.n)}; LV: ${esc(state.cfg.ctNo.lv)}). Hồ sơ có ${D.bct.length} cuộn BCT. R một chiều quy về 75 °C.</div>`;
      default: return '';
    }
  }

  // Công cụ đầu hạng mục (mục 7, 8, 9: nhập file Haefely 2293; mục 11: số cuộn thứ cấp, nhập XML CPC 100)
  function sectionTools(id, A) {
    if (['dcr', 'ratio', 'oltc'].includes(id)) {
      return `<div class="bct-tools"><div class="fields"><div class="field"><label>Số liệu từ máy đo</label><button class="btn primary" data-act="load2293">Nhập file Haefely 2293…</button></div>${id === 'oltc' ? A.cfgField('oltcCharts', 'Đồ thị chụp sóng trong phụ lục BBTN', { options: [['all', 'Từng lần chuyển nấc (2 đồ thị/hàng)'], ['overlay', 'Gộp theo chiều tăng / giảm nấc']] }) : ''}</div>`
        + '<div class="hint-text">Chọn cùng lúc các file <b>.csv</b> xuất từ máy (điện trở một chiều, tỷ số biến, chuyển nấc) và file <b>.bin</b> cùng tên (dạng sóng chụp OLTC); có thể chọn file của cả ba pha. Bỏ qua các file .dat, .mat.</div></div>';
    }
    if (id !== 'bct') return '';
    return `<div class="bct-tools"><div class="fields">${A.cfgField('bctCores.hv', 'Số cuộn thứ cấp TI phía HV', { options: [4, 5, 6] })}${A.cfgField('bctCores.mv', 'Số cuộn thứ cấp TI phía MV', { options: [4, 5] })}<div class="field"><label>Đặc tính từ hóa từ máy đo</label><button class="btn primary" data-act="loadCpc">Nhập XML CPC 100…</button></div></div><div class="hint-text">Chọn một hoặc nhiều file XML xuất từ CPC 100 (mỗi file một pha/một phía). App lấy 3 điểm (U, I) theo IEC 61869-2 và điền vào bảng đặc tính từ hóa; file có cuộn 5, 6 sẽ tự mở thêm cuộn. Phía LV và trung tính theo template chỉ có 4 và 3 cuộn.</div></div>`;
  }

  // ---------------------------------------------------------------- mục 9: chụp sóng OLTC (xem trước phụ lục)
  const thumbs = new Map(); // ảnh xem trước theo dạng sóng nén (vẽ lại chỉ khi số liệu đổi)
  function thumb(series, o, key) {
    if (!thumbs.has(key)) thumbs.set(key, OltcChart.draw(document.createElement('canvas'), series, o).toDataURL('image/png'));
    return thumbs.get(key);
  }
  const OSC_COLS = ['t', 'ub', 'ib', 'rb', 'ua', 'ia', 'ra', 'tFall', 'tRise', 'delta'];
  function sectionFooter(id, A) {
    if (id !== 'oltc') return '';
    const osc = (A.state.att && A.state.att.oltc) || {}, esc = A.esc, f = Common.fmt;
    const phases = Object.keys(osc).sort();
    let h = '<h3>Chụp sóng OLTC (phụ lục BBTN)</h3>';
    if (!phases.length) return h + '<div class="hint-text">Chưa có số liệu chụp sóng — nhập file .csv và .bin của Haefely 2293 bằng nút ở đầu mục.</div>';
    const mode = A.state.cfg.oltcCharts || 'all';
    phases.forEach(ph => {
      const r = osc[ph], an = OltcWave.anomalies(r);
      h += `<section class="osc-phase" data-ph="${ph}"><div class="osc-head"><b>Pha ${ph}</b><span>${r.rows.length || r.waves.length} lần chuyển nấc · ${esc([r.file, r.bin].filter(Boolean).join(' + '))}</span>`
        + `${an.length ? `<span class="badge st-warn" title="${esc(an.map(a => a.text).join('; '))}">${an.length} điểm cần xem xét</span>` : ''}<span class="spacer"></span><button class="btn small" data-act="delOltc" data-ph="${ph}">Xóa pha ${ph}</button></div>`;
      if (an.length) h += `<ul class="osc-warn">${an.map(a => `<li>${esc(a.text)}</li>`).join('')}</ul>`;
      if (r.rows.length) {
        h += '<details class="osc-data"><summary>Bảng số liệu chuyển nấc</summary><div class="grid-wrap"><table class="ftable"><thead><tr><th>Chuyển nấc</th><th>T (°C)</th><th>U trước (V)</th><th>I trước (A)</th><th>R trước (Ω)</th><th>U sau (V)</th><th>I sau (A)</th><th>R sau (Ω)</th><th>tFall (ms)</th><th>tRise (ms)</th><th>Delta</th></tr></thead><tbody>'
          + r.rows.map(x => `<tr class="${x.tFall === 0 && x.tRise === 0 ? 'st-warn' : ''}"><td>${esc(x.tr)}</td>${OSC_COLS.map(k => `<td class="num">${Number.isFinite(x[k]) ? String(x[k]).replace('.', ',') : ''}</td>`).join('')}</tr>`).join('')
          + '</tbody></table></div></details>';
      }
      if (!r.waves.length) { h += '<div class="hint-text">Chưa có file .bin của pha này — phụ lục chỉ có bảng số liệu.</div></section>'; return; }
      h += `<div class="osc-grid ${mode === 'overlay' ? 'wide' : ''}">`;
      if (mode === 'overlay') {
        [['up', 'tăng nấc'], ['down', 'giảm nấc']].forEach(([d, t]) => {
          const xs = r.waves.filter(w => OltcWave.dir(w) === d);
          if (!xs.length) return;
          const col = OltcChart.ramp(xs.length);
          const src = thumb(xs.map((c, k) => ({ c, color: col[k] })), { title: `Pha ${ph}: ${t} ${xs[0].from} -> ${xs[xs.length - 1].to}` }, `o|${ph}|${d}|${xs.map(c => c.tr + c.q.slice(0, 40)).join()}`);
          h += `<figure><img src="${src}" alt="Đồ thị R(t) chồng ${xs.length} lần ${t}, pha ${ph}"><figcaption>${xs.length} lần ${t}, màu đậm dần theo thứ tự đo</figcaption></figure>`;
        });
      } else {
        r.waves.forEach(w => {
          const src = thumb([{ c: w }], { title: OltcChart.title(w) }, `w|${w.tr}|${w.q}`);
          const drop = w.iMinPct !== null && w.iMinPct < 50;
          h += `<figure class="${drop ? 'warn' : ''}"><img src="${src}" alt="Đồ thị R(t) chuyển nấc ${esc(w.from)} → ${esc(w.to)}, pha ${ph}" loading="lazy"><figcaption>${esc(w.from)} → ${esc(w.to)}${w.iMinPct !== null ? ` · I nhỏ nhất ${f(w.iMinPct, 0)} %` : ''}</figcaption></figure>`;
        });
      }
      h += '</div></section>';
    });
    return h;
  }

  // Ảnh đồ thị cho phụ lục BBTN (gọi khi xuất .docx)
  async function reportAssets(A) {
    const osc = (A.state.att && A.state.att.oltc) || {}, mode = A.state.cfg.oltcCharts || 'all';
    const out = {};
    for (const ph of Object.keys(osc)) {
      const ws = osc[ph].waves;
      out[ph] = [];
      if (mode === 'overlay') {
        for (const [d, t] of [['up', 'tăng nấc'], ['down', 'giảm nấc'], ['', 'chuyển nấc']]) {
          const xs = ws.filter(w => OltcWave.dir(w) === d);
          if (!xs.length) continue;
          const col = OltcChart.ramp(xs.length);
          const img = await OltcChart.png(xs.map((c, k) => ({ c, color: col[k] })), { title: `Pha ${ph}: ${t} ${xs[0].from} -> ${xs[xs.length - 1].to}` });
          out[ph].push(Object.assign(img, { dir: d, perRow: 1, caption: `${xs.length} lần ${t}, màu đậm dần theo thứ tự đo` }));
        }
      } else {
        for (const w of ws) out[ph].push(Object.assign(await OltcChart.png([{ c: w }], { title: OltcChart.title(w) }), { dir: OltcWave.dir(w), perRow: 2, caption: '' }));
      }
    }
    return { oltcCharts: out };
  }

  // Ô hệ số K sứ: tự tra (Hitachi, bảng K) thì hiện giá trị tính, nhập tay thì là ô nhập thường
  function field(f, A) {
    const m = f.k.match(/^b\.(\w+)\.k$/);
    if (!m) return null;
    const rip = !/Nhập/i.test(A.state.v[`b.${m[1]}.kmode`] || '');
    const mode = typeof BushingK !== 'undefined' ? BushingK.resolve(A.state.v[`b.${m[1]}.kmode`]) : null;
    const label = mode && mode.kind === 'table' ? `Hệ số K tra bảng (tgδ20 = tgδ ${mode.table && mode.table.formula === 'MUL' ? '×' : '÷'} K)` : f.label;
    return rip ? `<div class="field"><label>${A.esc(label)}</label><div class="calcval" data-n="${f.k}"></div></div>` : null;
  }
  // Đổi cách quy đổi sứ / trạng thái lắp → vẽ lại hạng mục (ô K đổi giữa ô nhập và giá trị tính)
  const rerenderOn = /\.(kmode|mount)$/;

  // Lưới đặc tính từ hóa: nút tải XML cho đúng phía/pha; nhãn hàng theo đầu cuộn thực đo
  const gridTools = g => (g.ex ? `<button class="btn small" data-act="cpcSlot" data-grid="${g.id}">Tải XML CPC 100…</button>` : '');
  function rowLabel(g, r, A) {
    const tap = /^bct\.\w+\.ex\./.test(g.id) && A.state.v[`${g.id}.tap.${r.k.slice(0, -1)}`];
    return tap ? r.label.replace(/^[^:]+/, tap) : null;
  }

  // ---------------------------------------------------------------- mục 0
  // Nút đọc ảnh nameplate ở đầu khối Thông tin thiết bị
  const headTools = () => '<div class="np-tools"><button class="btn primary" data-act="loadNameplate">Nhập ảnh nameplate…</button>'
    + '<span class="hint-text">Chụp thẳng, đủ sáng, không lóa. App đọc chữ ngay trên máy này và điền các ô; ô tô vàng cần kiểm tra, ô tô đỏ chưa đọc được — nhập tay.</span></div>';

  function generalFiles(A) {
    const HB = HitachiBushing;
    return `<div class="field"><label>Test report sứ Hitachi (quy đổi 20 °C)</label><div class="calcval file" title="${A.esc(HB.source || '')}">${A.esc(HB.source || 'chưa nạp')}${HB.source ? ` · ${HB.reports.length} sứ` : ''}</div></div>`
      + '<div class="field"><label>Nạp test report sứ khác (.xlsx, sheet TestReport + TraCuu)</label><button class="btn" data-act="loadHitachi">Chọn file .xlsx…</button></div>';
  }

  function generalConfig(A) {
    const { cfgField, FX } = A, D = FX && FX.data;
    const serialOpts = D ? D.order.map(s => [s, `${s} — pha ${D.units[s].phase}`]) : [];
    let h = '<h3>Ánh xạ cột pha ↔ số chế tạo (để so sánh từng cột với đúng máy)</h3><div class="hint-text">Template có cột A/B/C. Với tổ 3 máy 1 pha, mỗi cột ứng với một máy; nếu chỉ thí nghiệm một máy, đặt cả ba cột về cùng số chế tạo hoặc chỉ nhập cột của máy đó. Cột N (trung tính) dùng số chế tạo máy chính.</div><div class="fields">';
    ['A', 'B', 'C'].forEach(p => { h += cfgField(`ps.${p}`, `Cột pha ${p} (a)`, serialOpts.length ? { options: [['', '—']].concat(serialOpts) } : {}); });
    h += '</div><h3>Thông số tính toán & quy ước so sánh</h3><div class="fields">';
    h += cfgField('taps', 'Nhãn 19 nấc (thứ tự hàng 1..19 của template)', { wide: true, note: 'Ngăn cách bằng dấu phẩy. Nhãn 9a/9b/9c được so với nấc 9A của xuất xưởng.' });
    h += cfgField('hvMeas', 'Phép đo R một chiều cao áp (AN) so với', { options: [['SER+COM', 'Cuộn nối tiếp + cuộn chung (A–N)'], ['SER', 'Chỉ cuộn nối tiếp (A–Am)']] });
    h += cfgField('lvMode', 'Cuộn hạ áp khi đo', { options: [['unit', 'Từng máy 1 pha (chưa đấu tam giác)'], ['delta', 'Tổ 3 pha đã đấu tam giác']] });
    h += cfgField('iLV', 'Dòng định mức cuộn hạ áp I_LV (A)', { num: true });
    h += cfgField('sLV', 'Công suất cuộn hạ áp S_LV (MVA)', { num: true });
    h += cfgField('sR', 'Công suất định mức S_r (MVA)', { num: true });
    h += cfgField('i0Ref', 'I0 nameplate (%) — để so sánh', { num: true, note: 'vd 0.04 theo nameplate AT1' });
    h += cfgField('bC1Dev', 'Sứ (bảng K / nhập K): lệch C1 tối đa (%)', { num: true, note: 'Dùng khi quy đổi theo bảng K (QĐ 1901, theo hãng) hoặc nhập K. Sứ Hitachi dùng dung sai Bảng 15 của hãng' });
    h += cfgField('bTgdMax', 'Sứ (bảng K / nhập K): tgδ C1 @20 °C tối đa (%)', { num: true });
    h += cfgField('bctCores.hv', 'TI chân sứ HV: số cuộn thứ cấp', { options: [4, 5, 6] });
    h += cfgField('bctCores.mv', 'TI chân sứ MV: số cuộn thứ cấp', { options: [4, 5] });
    h += cfgField('ctNo.hv', 'Mã lõi CT phía HV (cuộn 1..n)');
    h += cfgField('ctNo.mv', 'Mã lõi CT phía MV (cuộn 1..n)');
    h += cfgField('ctNo.n', 'Mã lõi CT trung tính');
    h += cfgField('ctNo.lv', 'Mã lõi CT phía LV');
    h += cfgField('bctErrLimit', 'Giới hạn sai số tỷ số TI chân sứ (%)', { num: true, note: 'QĐ 1901 không nêu số — nhập theo cấp chính xác nếu muốn tự đánh giá Đạt/Không đạt' });
    h += cfgField('decSep', 'Dấu thập phân trong BBTN xuất ra', { options: [[',', 'Dấu phẩy (12,5)'], ['.', 'Dấu chấm (12.5)']] });
    return h + '</div>';
  }

  function factoryUnits(A) {
    const D = A.FX && A.FX.data, esc = A.esc, f = Common.fmt;
    if (!D) return '';
    let h = '<h3>Các máy trong file xuất xưởng</h3><div class="grid-wrap"><table class="grid"><thead><tr><th>Số chế tạo</th><th>Pha</th><th>Job No.</th><th>P0 (kW)</th><th>T đo cách điện (°C)</th><th>T đo R 1 chiều (°C)</th><th>Độ ẩm DFR (%)</th></tr></thead><tbody>';
    D.order.forEach(s => { const u = D.units[s], c = D.conditions[s] || {}; h += `<tr><th>${esc(s)}</th><td class="calc"><span class="cv">${esc(u.phase)}</span></td><td class="calc"><span class="cv">${esc(u.jobNo || '')}</span></td><td class="calc"><span class="cv">${f(u.noLoadLoss, 1)}</span></td><td class="calc"><span class="cv">${f(c.ins, 1)}</span></td><td class="calc"><span class="cv">${f(c.dcr, 1)}</span></td><td class="calc"><span class="cv">${f(c.moisture, 2)}</span></td></tr>`; });
    return h + '</tbody></table></div>';
  }

  // ---------------------------------------------------------------- hành động
  function fillBushingSN(A) {
    const { state, FX } = A;
    let n = 0;
    const put = (k, val) => { if (val && !state.v[k]) { state.v[k] = val; n++; } };
    [['hv', '1.1', ['A', 'B', 'C']], ['mv', '2.1', ['A', 'B', 'C']], ['lv', '3.1', ['a', 'b', 'c']]].forEach(([side, term, cols]) => {
      cols.forEach(c => { const b = FX.bushingByUnit(state.cfg.ps[c.toUpperCase()], term); put(`b.${side}.meas.serial.${c}`, b && b.serial); });
    });
    const bn = FX.bushingByUnit(state.v['meta.serial'], '2');
    put('b.mv.meas.serial.N', bn && bn.serial);
    A.recompute(); A.renderMain(); A.persist();
    A.toast(n ? `Đã điền ${n} số chế tạo sứ — hãy đối chiếu với nameplate thực tế` : 'Không có ô trống cần điền');
  }

  const actions = {
    fillBushingSN: (b, A) => fillBushingSN(A),
    addWtgdRow(b, A) {
      A.state.cfg.wtgdRows.push({ k: 'x' + Date.now().toString(36) });
      A.rebuild(true);
      const ins = Array.from(document.querySelectorAll('[data-grid="wtgd.meas"] input.lbl')); if (ins.length) ins[ins.length - 1].focus();
    },
    delWtgdRow(b, A) {
      const rk = b.dataset.rk, st = A.state;
      st.cfg.wtgdRows = st.cfg.wtgdRows.filter(x => x.k !== rk);
      delete st.cfg.wtgdLabels[rk];
      Object.keys(st.v).filter(k => k.startsWith(`wtgd.meas.${rk}.`)).forEach(k => delete st.v[k]);
      A.rebuild(true);
    },
    loadHitachi: () => $('#fileHitachi').click(),
    load2293: () => $('#file2293').click(),
    loadNameplate: () => $('#fileNameplate').click(),
    delOltc(b, A) {
      const st = A.state, ph = b.dataset.ph;
      if (!st.att || !st.att.oltc || !confirm(`Xóa số liệu chụp sóng OLTC pha ${ph}? Các ô đã điền ở mục 7, 8, 9 giữ nguyên.`)) return;
      delete st.att.oltc[ph];
      const sum = Mba2293.oltcSummary(st.att.oltc);
      if (String(st.v['oltc.osc'] ?? '').trim() === st.att.oscAuto) st.v['oltc.osc'] = sum;
      st.att.oscAuto = sum;
      A.rebuild(false);
    },
    loadCpc: () => { cpcTarget = null; $('#fileCpc').multiple = true; $('#fileCpc').click(); },
    cpcSlot(b) {
      const m = b.dataset.grid.match(/^bct\.(\w+)\.ex\.(\w)$/);
      cpcTarget = { side: m[1], phase: m[2] };
      $('#fileCpc').multiple = false; $('#fileCpc').click();
    },
  };

  // ---------------------------------------------------------------- khởi động
  // Test report sứ Hitachi + hằng số quy đổi: file nạp tay (lưu trình duyệt) ưu tiên hơn file nhúng sẵn
  function loadHitachiDefault(A) {
    try {
      const custom = A.lsGet(LS_HIT);
      if (custom) { const o = JSON.parse(custom); HitachiBushing.fromBase64(o.b64, o.name); return; }
      if (A.EMB.bushingTR) HitachiBushing.fromBase64(A.EMB.bushingTR.b64, A.EMB.bushingTR.name);
    } catch (e) { console.warn('Hitachi test report:', e); A.toast('Không đọc được file test report sứ: ' + e.message, true); }
  }

  // Gọi một lần khi app khởi động, trước khi đánh giá biên bản đầu tiên
  function init(A) {
    loadHitachiDefault(A);
    $('#fileNameplate').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) NameplateImport.open(f); });
    $('#file2293').addEventListener('change', e => { const fl = Array.from(e.target.files); e.target.value = ''; if (fl.length) Wa2293Import.open(fl).catch(err => A.toast('Lỗi đọc file 2293: ' + err.message, true)); });
    $('#fileCpc').addEventListener('change', e => { const fl = Array.from(e.target.files); e.target.value = ''; if (fl.length) CpcImport.open(fl, cpcTarget); });
    $('#fileHitachi').addEventListener('change', e => A.readFile(e.target, async f => {
      const buf = await f.arrayBuffer();
      const info = HitachiBushing.fromArrayBuffer(buf, f.name);
      if (!A.lsSet(LS_HIT, JSON.stringify({ name: f.name, b64: A.abToB64(buf) }))) A.toast('File lớn — chỉ dùng trong phiên này', true);
      A.recompute(); A.renderMain(); A.toast(`Đã nạp test report sứ ${f.name}: ${info.count} sứ`);
    }));
  }

  window.TypeUI = window.TypeUI || {};
  window.TypeUI.MBA = { intro, headTools, sectionTools, sectionFooter, reportAssets, field, rerenderOn, gridTools, rowLabel, generalFiles, generalConfig, factoryUnits, actions, init };
})();
