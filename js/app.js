// Giao diện nhập liệu BBTN MBA: render theo schema, đánh giá tức thời, lưu/mở, xuất DOCX/XLSX.
(function () {
  'use strict';
  const LS_STATE = 'bbtn-mba.state.v1';
  const LS_TPL = 'bbtn-mba.customTemplate';
  const LS_FAC = 'bbtn-mba.customFactory';
  const LS_HIT = 'bbtn-mba.customHitachi';
  const ST_TEXT = { pass: 'Đạt', warn: 'Cần xem xét', fail: 'Không đạt', missing: 'Thiếu dữ liệu', info: 'Tham khảo' };

  // Template & Test report nhúng sẵn (js/embedded.js, tự sinh, không đưa lên Git). Thiếu thì người dùng nạp file ở mục 0.
  const EMB = window.EMBEDDED || { templates: {}, factory: null };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); return true; } catch (e) { return false; } };

  let FX = null, state = null, schema = null, res = null, current = 'general';
  const filters = {};

  // ---------------------------------------------------------------- helpers
  function toast(msg, err) { Notify.show({ type: err ? 'error' : 'success', msg }); }
  function abToB64(buf) {
    const bytes = new Uint8Array(buf); let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const safeName = s => String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const lastNum = s => { const m = String(s || '').match(/[\d.]+(?=\s*$)/); return m ? m[0] : ''; };

  function defaultCfg() {
    return {
      template: 'A', ps: { A: '', B: '', C: '' }, taps: Schema.DEFAULT_TAPS.slice(), hvMeas: 'SER+COM', lvMode: 'unit',
      iLV: '', sLV: '', sR: '', i0Ref: '', bC1Dev: '', bTgdMax: '', bctCores: { hv: 4, mv: 4, lv: 4 },
      ctNo: { hv: '1,2,3,4,5,6', mv: '4,5,6,7,8', n: '8,9,10', lv: '11,12,13,14' }, bctErrLimit: '', decSep: ',',
    };
  }
  function applyFactoryDefaults(cfg) {
    if (!FX) return;
    const D = FX.data;
    D.order.forEach(s => { const ph = D.units[s].phase; if (ph && !cfg.ps[ph]) cfg.ps[ph] = s; });
    if (!cfg.iLV && D.specs.current) cfg.iLV = lastNum(D.specs.current.LV);
    if (!cfg.sLV && D.specs.power) cfg.sLV = lastNum(D.specs.power.LV);
    if (!cfg.sR && D.specs.power) cfg.sR = lastNum(D.specs.power.HV);
    if (!cfg.bC1Dev && D.bushingCriteria.c1) cfg.bC1Dev = String(D.bushingCriteria.c1);
    if (!cfg.bTgdMax && D.bushingCriteria.tgd) cfg.bTgdMax = String(D.bushingCriteria.tgd);
  }

  function templateData() {
    if (state.cfg.template === 'custom') {
      const b = lsGet(LS_TPL);
      if (b) return JSON.parse(b).b64;
      toast('Không tìm thấy template tùy chỉnh — dùng template có sẵn', true);
      state.cfg.template = 'A';
    }
    const t = EMB.templates[state.cfg.template] || Object.values(EMB.templates)[0];
    return t ? t.b64 : null;
  }
  function templateName() {
    if (state.cfg.template === 'custom') { const b = lsGet(LS_TPL); return b ? JSON.parse(b).name : '(thiếu)'; }
    return (EMB.templates[state.cfg.template] || {}).name || 'chưa có template';
  }

  // ---------------------------------------------------------------- state
  async function newRecord(keepCfg) {
    const cfg = keepCfg ? JSON.parse(JSON.stringify(state.cfg)) : defaultCfg();
    applyFactoryDefaults(cfg);
    state = { v: {}, cfg, sum: { tick: {}, ev: {} }, created: new Date().toISOString() };
    schema = Schema.build(state.cfg);
    await readTemplateDefaults();
    const u = FX && FX.unit(state.v['meta.serial']);
    if (u && u.phase && state.cfg.template !== 'custom' && u.phase !== state.cfg.template && EMB.templates[u.phase]) {
      state.cfg.template = u.phase;
      state.v = {};
      await readTemplateDefaults();
    }
    if (!state.v['meta.reason']) state.v['meta.reason'] = 'Sau lắp đặt';
  }

  // Lấy giá trị sẵn có trong template (thông tin chung, Uo = 10 kV…) làm mặc định
  async function readTemplateDefaults() {
    const data = templateData();
    if (!data) return;
    const tpl = await DocxTemplate.load(data);
    Schema.eachField(schema, f => {
      if (!f.doc || /remark|conclusion/.test(f.k)) return;
      const val = tpl.readField(f.doc);
      if (val && val.replace(/[\s.]/g, '')) state.v[f.k] = val;
    });
    Schema.eachGrid(schema, g => {
      if (g.readonly) return;
      g.rows.forEach(r => g.cols.forEach(c => {
        if (r.nodoc || c.calc || c.auto || (g.skip && g.skip(r.k, c.k))) return;
        const tc = tpl.cell(g.tables, r.doc, r.cmap && r.cmap[c.k] !== undefined ? r.cmap[c.k] : c.doc);
        const t = tc ? tc.textContent.trim() : '';
        if (t && t !== '/') state.v[`${g.id}.${r.k}.${c.k}`] = t;
      }));
    });
  }

  let saveT = null;
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { lsSet(LS_STATE, JSON.stringify(state)); }, 350);
  }

  function recompute() {
    res = Evaluate.evaluate(state, FX, schema);
  }

  // ---------------------------------------------------------------- nav
  function navItems() {
    return [{ id: 'general', no: '0', title: 'Thông tin chung & cấu hình' }]
      .concat(schema.sections.map(s => ({ id: s.id, no: String(s.no), title: s.title })))
      .concat([{ id: 'summary', no: 'Σ', title: 'Tổng hợp & kết luận' }, { id: 'factory', no: 'XX', title: 'Số liệu xuất xưởng' },
        { id: 'db', no: 'DB', title: 'CSDL – biên bản đã lưu' }, { id: 'catalog', no: '≡', title: 'Trạm – Ngăn – Thiết bị' }, { id: 'trend', no: '↗', title: 'Xu hướng' }]);
  }
  // Thanh điều hướng vẽ như sơ đồ một sợi: mỗi hạng mục là một ngăn lộ, trạng thái là ký hiệu máy cắt
  const BRK_LABEL = { pass: 'Đạt — máy cắt đóng', warn: 'Cần xem xét', fail: 'Không đạt — máy cắt cắt', missing: 'Thiếu dữ liệu', info: 'Tham khảo' };
  let navPrev = null;
  const navChangedAt = {};
  function renderNav() {
    const items = navItems();
    const first = !navPrev;
    navPrev = navPrev || {};
    let html = '';
    items.forEach((it, i) => {
      if (i === 1) html += '<div class="nav-group">Hạng mục thí nghiệm</div>';
      if (it.id === 'summary') html += '<div class="nav-group">Kết quả</div>';
      if (it.id === 'db') html += '<div class="nav-group">Cơ sở dữ liệu</div>';
      const S = res && res.sec[it.id];
      const st = S && S.status ? S.status : '';
      // máy cắt "đóng/cắt" có hiệu ứng khi trạng thái vừa đổi (giữ 0,6 s vì thanh điều hướng có thể vẽ lại liên tiếp)
      if (!first && navPrev[it.id] !== st) navChangedAt[it.id] = Date.now();
      navPrev[it.id] = st;
      const flip = st && Date.now() - (navChangedAt[it.id] || 0) < 600 ? ' flip' : '';
      const fails = S && S.counts.fail ? `<span class="cnt">${S.counts.fail} lỗi</span>` : '';
      const tip = st ? BRK_LABEL[st] : (S ? 'Chưa nhập' : '');
      html += `<button class="nav-item ${current === it.id ? 'active' : ''}" data-nav="${it.id}" ${current === it.id ? 'aria-current="page"' : ''}>`
        + `<span class="brk ${st ? 'st-' + st : ''}${flip}" ${tip ? `title="${esc(tip)}"` : ''} aria-hidden="true"></span>`
        + `<span class="nav-no">${esc(it.no)}</span><span class="nav-t">${esc(it.title)}${fails}</span>`
        + `${tip ? `<span class="sr-only">${esc(tip)}</span>` : ''}</button>`;
    });
    ($('#navItems') || $('#nav')).innerHTML = html;
  }
  function renderRecordChip() {
    const v = state.v, u = FX && FX.unit(v['meta.serial']);
    $('#recordChip').innerHTML = [
      `<span class="chip">S/N <b>${esc(v['meta.serial'] || '—')}</b>${u ? ` · pha ${esc(u.phase)}` : ''}</span>`,
      `<span class="chip">${esc(v['meta.date'] || 'chưa có ngày')}</span>`,
      `<span class="chip">${esc(v['meta.reason'] || '')}</span>`,
    ].join('');
  }

  // ---------------------------------------------------------------- render primitives
  function fieldHTML(f, opts = {}) {
    const k = f.k, val = state.v[k] ?? '';
    const id = 'f_' + k.replace(/\W/g, '_');
    let ctrl;
    if (f.type === 'select') {
      ctrl = `<select id="${id}" data-k="${k}">${f.options.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    } else if (f.type === 'textarea') {
      ctrl = `<textarea id="${id}" data-k="${k}" placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>`;
    } else if (opts.calc) {
      ctrl = `<div class="calcval" data-c="${k}"></div>`;
    } else {
      const list = f.serial && FX ? ' list="dlSerials"' : '';
      ctrl = `<input id="${id}" data-k="${k}" value="${esc(val)}" ${f.num ? 'inputmode="decimal"' : ''} placeholder="${esc(f.placeholder || '')}"${list}>`;
    }
    return `<div class="field ${f.type === 'textarea' ? 'wide' : ''}"><label for="${id}">${esc(f.label)}</label>${ctrl}${opts.note ? `<span class="note">${opts.note}</span>` : ''}</div>`;
  }
  function cfgField(path, label, opts = {}) {
    const val = path.split('.').reduce((o, p) => (o ? o[p] : ''), state.cfg) ?? '';
    const id = 'c_' + path.replace(/\W/g, '_');
    let ctrl;
    if (opts.options) ctrl = `<select id="${id}" data-cfg="${path}">${opts.options.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select>`;
    else ctrl = `<input id="${id}" data-cfg="${path}" value="${esc(Array.isArray(val) ? val.join(', ') : val)}" ${opts.list ? 'list="dlSerials"' : ''} ${opts.num ? 'inputmode="decimal"' : ''}>`;
    return `<div class="field ${opts.wide ? 'wide' : ''}"><label for="${id}">${esc(label)}</label>${ctrl}${opts.note ? `<span class="note">${opts.note}</span>` : ''}</div>`;
  }

  function gridHTML(g) {
    const ro = !!g.readonly;
    let h = `<div class="grid-block">${g.title ? `<div class="grid-title">${esc(g.title)}</div>` : ''}<div class="grid-wrap ${ro ? 'readonly' : ''}"><table class="grid" data-grid="${g.id}"><thead><tr><th></th>`;
    // cột pha: gắn mã pha để tô vạch màu A vàng · B xanh · C đỏ
    g.cols.forEach(c => {
      const ph = c.phase ? String(c.k).charAt(0).toUpperCase() : '';
      h += `<th${ph ? ` data-ph="${ph}" title="Pha ${ph}"` : ''}>${esc(c.label)}</th>`;
    });
    h += '</tr></thead><tbody>';
    g.rows.forEach((r, ri) => {
      const tapLbl = /^bct\.\w+\.ex\./.test(g.id) && state.v[`${g.id}.tap.${r.k.slice(0, -1)}`];
      h += `<tr><th>${esc(tapLbl ? r.label.replace(/^[^:]+/, tapLbl) : r.label)}</th>`;
      g.cols.forEach((c, ci) => {
        const key = `${g.id}.${r.k}.${c.k}`;
        if (g.skip && g.skip(r.k, c.k)) { h += '<td class="na"></td>'; return; }
        if (ro || c.calc) { h += `<td class="calc"><span class="cv" data-c="${key}"></span></td>`; return; }
        const val = esc(state.v[key] ?? '');
        if (r.select) {
          h += `<td><select data-k="${key}" data-g="${g.id}" data-r="${ri}" data-col="${ci}">${r.select.map(o => `<option ${o === state.v[key] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></td>`;
          return;
        }
        const text = r.text || c.text;
        // Bảng đã có cột độ lệch riêng (ΔR, ΔK, sai số) thì không lặp lại gợi ý dưới ô
        const hasDevCol = g.cols.some(x => x.k === 'd' + c.k || x.k === c.k + 'e');
        const hint = hasDevCol || c.auto || r.auto ? '' : `<span class="hint" data-h="${key}"></span>`;
        h += `<td><input data-k="${key}" data-g="${g.id}" data-r="${ri}" data-col="${ci}" class="${text ? 'text' : ''} ${c.auto || r.text || r.auto ? 'auto' : ''}" value="${val}" ${text ? '' : 'inputmode="decimal"'} autocomplete="off">${hint}</td>`;
      });
      h += '</tr>';
    });
    return h + '</tbody></table></div></div>';
  }

  function findingsHTML(secId) {
    const list = res.findings.filter(f => secId === '*' || f.sec === secId);
    const fk = filters[secId] || 'all';
    const counts = { all: list.length };
    ['fail', 'warn', 'missing', 'pass', 'info'].forEach(s => { counts[s] = list.filter(f => f.status === s).length; });
    const shown = list.filter(f => fk === 'all' || f.status === fk);
    const secTitle = id => { const s = schema.sections.find(x => x.id === id); return s ? `${s.no}. ${s.title}` : id; };
    let h = `<div class="findings" data-findings="${secId}"><div class="findings-head"><h3>So sánh với số liệu xuất xưởng & đánh giá</h3><div class="filters">`;
    [['all', 'Tất cả'], ['fail', 'Không đạt'], ['warn', 'Cần xem xét'], ['missing', 'Thiếu dữ liệu'], ['pass', 'Đạt'], ['info', 'Tham khảo']].forEach(([k, t]) => {
      if (k !== 'all' && !counts[k]) return;
      h += `<button data-filter="${k}" data-fsec="${secId}" class="${fk === k ? 'on' : ''}">${t} · ${counts[k]}</button>`;
    });
    h += '</div></div>';
    if (!shown.length) return h + `<div class="empty">${list.length ? 'Không có mục nào theo bộ lọc.' : 'Chưa có số liệu để đánh giá — nhập số liệu ở các bảng phía trên.'}</div></div>`;
    h += `<div style="overflow-x:auto"><table class="ftable"><thead><tr>${secId === '*' ? '<th>Hạng mục</th>' : ''}<th>Nội dung</th><th>Vị trí / pha / nấc</th><th>Giá trị đo</th><th>Quy đổi</th><th>Tham chiếu</th><th>Độ lệch</th><th>Giới hạn</th><th>Đánh giá</th><th>Căn cứ</th><th>Ghi chú</th></tr></thead><tbody>`;
    shown.forEach(f => {
      h += `<tr class="st-${f.status}">${secId === '*' ? `<td>${esc(secTitle(f.sec))}</td>` : ''}<td>${esc(f.item)}</td><td>${esc(f.loc || '')}</td><td class="num">${esc(f.meas || '')}</td><td class="num">${esc(f.conv || '')}</td><td class="num">${esc(f.ref || '')}</td><td class="num">${esc(f.dev || '')}</td><td>${esc(f.limit || '')}</td><td><span class="badge st-${f.status}">${ST_TEXT[f.status]}</span></td><td>${esc(f.basis || '')}</td><td class="note">${esc(f.note || '')}</td></tr>`;
    });
    return h + '</tbody></table></div></div>';
  }

  function headHTML(no, title, en, secId) {
    const S = secId && res.sec[secId];
    const badge = S ? `<span class="badge ${S.status ? 'st-' + S.status : 'st-none'}">${S.text || 'Chưa nhập'}</span>` : '';
    return `<div class="panel-head"><span class="secno">${esc(no)}</span><h2>${esc(title)}</h2><span class="en">${esc(en || '')}</span><span class="spacer"></span>${badge}</div>`;
  }

  // ---------------------------------------------------------------- reference callouts
  function refInfo(id) {
    if (!FX) return '<div class="callout warn">Chưa nạp số liệu xuất xưởng — chỉ đánh giá theo ngưỡng QĐ 1901.</div>';
    const D = FX.data, s = state.v['meta.serial'], u = FX.unit(s), fm = Evaluate.fmt;
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
          <div class="row-actions"><button class="btn small" data-act="fillBushingSN">Điền S/N sứ theo hồ sơ xuất xưởng (cần đối chiếu thực tế)</button></div></div>`;
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

  // ---------------------------------------------------------------- pages
  function renderGeneral() {
    const D = FX && FX.data;
    const serialOpts = D ? D.order.map(s => [s, `${s} — pha ${D.units[s].phase}`]) : [];
    let h = headHTML('0', 'Thông tin chung & cấu hình', 'General & settings');
    h += '<h3>Thông tin thiết bị (điền vào đầu biên bản)</h3><div class="fields">' + Schema.META.map(f => fieldHTML(f)).join('') + '</div>';
    h += '<h3>Template & số liệu xuất xưởng</h3><div class="fields">';
    h += cfgField('template', 'Template BBTN dùng để xuất', { options: (Object.keys(EMB.templates).length ? Object.keys(EMB.templates).map(k => [k, EMB.templates[k].name]) : [['A', '(chưa có — nạp template .docx)']]).concat(lsGet(LS_TPL) ? [['custom', 'Tùy chỉnh: ' + JSON.parse(lsGet(LS_TPL)).name]] : []) });
    h += `<div class="field"><label>Nạp template khác (.docx cùng cấu trúc)</label><button class="btn" data-act="loadDocx">Chọn file template…</button></div>`;
    h += `<div class="field"><label>File số liệu xuất xưởng</label><div class="calcval">${esc(D ? D.fileName : 'chưa nạp')}</div></div>`;
    h += `<div class="field"><label>Nạp file xuất xưởng khác (.xlsx)</label><button class="btn" data-act="loadXlsx">Chọn file .xlsx…</button></div>`;
    h += `<div class="field"><label>Test report sứ Hitachi (quy đổi 20 °C)</label><div class="calcval">${esc(HitachiBushing.source || 'chưa nạp')}${HitachiBushing.source ? ` · ${HitachiBushing.reports.length} sứ` : ''}</div></div>`;
    h += `<div class="field"><label>Nạp test report sứ khác (.xlsx, sheet TestReport + TraCuu)</label><button class="btn" data-act="loadHitachi">Chọn file .xlsx…</button></div></div>`;
    if (D && D.warnings.length) h += `<div class="callout warn">${D.warnings.map(esc).join('<br>')}</div>`;
    h += '<h3>Ánh xạ cột pha ↔ số chế tạo (để so sánh từng cột với đúng máy)</h3><div class="hint-text">Template có cột A/B/C. Với tổ 3 máy 1 pha, mỗi cột ứng với một máy; nếu chỉ thí nghiệm một máy, đặt cả ba cột về cùng số chế tạo hoặc chỉ nhập cột của máy đó. Cột N (trung tính) dùng số chế tạo máy chính.</div><div class="fields">';
    ['A', 'B', 'C'].forEach(p => { h += cfgField(`ps.${p}`, `Cột pha ${p} (a)`, serialOpts.length ? { options: [['', '—']].concat(serialOpts) } : {}); });
    h += '</div><h3>Thông số tính toán & quy ước so sánh</h3><div class="fields">';
    h += cfgField('taps', 'Nhãn 19 nấc (thứ tự hàng 1..19 của template)', { wide: true, note: 'Ngăn cách bằng dấu phẩy. Nhãn 9a/9b/9c được so với nấc 9A của xuất xưởng.' });
    h += cfgField('hvMeas', 'Phép đo R một chiều cao áp (AN) so với', { options: [['SER+COM', 'Cuộn nối tiếp + cuộn chung (A–N)'], ['SER', 'Chỉ cuộn nối tiếp (A–Am)']] });
    h += cfgField('lvMode', 'Cuộn hạ áp khi đo', { options: [['unit', 'Từng máy 1 pha (chưa đấu tam giác)'], ['delta', 'Tổ 3 pha đã đấu tam giác']] });
    h += cfgField('iLV', 'Dòng định mức cuộn hạ áp I_LV (A)', { num: true });
    h += cfgField('sLV', 'Công suất cuộn hạ áp S_LV (MVA)', { num: true });
    h += cfgField('sR', 'Công suất định mức S_r (MVA)', { num: true });
    h += cfgField('i0Ref', 'I0 nameplate (%) — để so sánh', { num: true, note: 'vd 0.04 theo nameplate AT1' });
    h += cfgField('bC1Dev', 'Sứ (chế độ nhập K): lệch C1 tối đa (%)', { num: true, note: 'Chỉ dùng khi chọn “Nhập hệ số K”. Sứ Hitachi dùng dung sai Bảng 15 của hãng' });
    h += cfgField('bTgdMax', 'Sứ (chế độ nhập K): tgδ C1 @20 °C tối đa (%)', { num: true });
    h += cfgField('bctCores.hv', 'TI chân sứ HV: số cuộn thứ cấp', { options: [4, 5, 6] });
    h += cfgField('bctCores.mv', 'TI chân sứ MV: số cuộn thứ cấp', { options: [4, 5] });
    h += cfgField('ctNo.hv', 'Mã lõi CT phía HV (cuộn 1..n)');
    h += cfgField('ctNo.mv', 'Mã lõi CT phía MV (cuộn 1..n)');
    h += cfgField('ctNo.n', 'Mã lõi CT trung tính');
    h += cfgField('ctNo.lv', 'Mã lõi CT phía LV');
    h += cfgField('bctErrLimit', 'Giới hạn sai số tỷ số TI chân sứ (%)', { num: true, note: 'QĐ 1901 không nêu số — nhập theo cấp chính xác nếu muốn tự đánh giá Đạt/Không đạt' });
    h += cfgField('decSep', 'Dấu thập phân trong BBTN xuất ra', { options: [[',', 'Dấu phẩy (12,5)'], ['.', 'Dấu chấm (12.5)']] });
    h += '</div>';
    if (D) {
      h += '<h3>Các máy trong file xuất xưởng</h3><div class="grid-wrap"><table class="grid"><thead><tr><th>Số chế tạo</th><th>Pha</th><th>Job No.</th><th>P0 (kW)</th><th>T đo cách điện (°C)</th><th>T đo R 1 chiều (°C)</th><th>Độ ẩm DFR (%)</th></tr></thead><tbody>';
      D.order.forEach(s => { const u = D.units[s], c = D.conditions[s] || {}; h += `<tr><th>${esc(s)}</th><td class="calc"><span class="cv">${esc(u.phase)}</span></td><td class="calc"><span class="cv">${esc(u.jobNo || '')}</span></td><td class="calc"><span class="cv">${Evaluate.fmt(u.noLoadLoss, 1)}</span></td><td class="calc"><span class="cv">${Evaluate.fmt(c.ins, 1)}</span></td><td class="calc"><span class="cv">${Evaluate.fmt(c.dcr, 1)}</span></td><td class="calc"><span class="cv">${Evaluate.fmt(c.moisture, 2)}</span></td></tr>`; });
      h += '</tbody></table></div>';
    }
    return `<section class="panel">${h}</section>`;
  }

  function renderSection(s) {
    let h = headHTML(String(s.no), s.title, s.en, s.id) + refInfo(s.id);
    if (s.id === 'bct') {
      h += `<div class="bct-tools"><div class="fields">${cfgField('bctCores.hv', 'Số cuộn thứ cấp TI phía HV', { options: [4, 5, 6] })}${cfgField('bctCores.mv', 'Số cuộn thứ cấp TI phía MV', { options: [4, 5] })}<div class="field"><label>Đặc tính từ hóa từ máy đo</label><button class="btn primary" data-act="loadCpc">Nhập XML CPC 100…</button></div></div><div class="hint-text">Chọn một hoặc nhiều file XML xuất từ CPC 100 (mỗi file một pha/một phía). App lấy 3 điểm (U, I) theo IEC 61869-2 và điền vào bảng đặc tính từ hóa; file có cuộn 5, 6 sẽ tự mở thêm cuộn. Phía LV và trung tính theo template chỉ có 4 và 3 cuộn.</div></div>`;
    }
    if (s.fields) h += '<div class="fields">' + s.fields.map(f => sectionField(f)).join('') + '</div>';
    (s.grids || []).forEach(g => { h += gridHTML(g); });
    (s.groups || []).forEach(gr => {
      h += `<h3>${esc(gr.title)}</h3>`;
      if (gr.fields) h += '<div class="fields">' + gr.fields.map(f => sectionField(f)).join('') + '</div>';
      gr.grids.forEach(g => { h += gridHTML(g); });
    });
    if (s.extraDoc) h += '<div class="fields">' + s.extraDoc.map(x => `<div class="field"><label>${x.k === 'ir.k1' ? 'Hệ số quy đổi K1 (ghi vào BBTN)' : 'Hệ số quy đổi K2 (ghi vào BBTN)'}</label><div class="calcval" data-n="${x.k}"></div></div>`).join('') + '</div>';
    h += findingsHTML(s.id);
    return `<section class="panel" data-sec="${s.id}">${h}</section>`;
  }
  function sectionField(f) {
    const m = f.k.match(/^b\.(\w+)\.k$/);
    if (m) {
      const rip = !/Nhập/i.test(state.v[`b.${m[1]}.kmode`] || '');
      if (rip) return `<div class="field"><label>${esc(f.label)}</label><div class="calcval" data-n="${f.k}"></div></div>`;
    }
    return fieldHTML(f);
  }

  function renderSummary() {
    let h = headHTML('Σ', 'Tổng hợp & kết luận', 'Summary');
    h += '<div class="hint-text">Cột “Ghi vào BBTN” điền vào bảng hạng mục ở trang 1 của biên bản. Để “Tự động” nếu muốn dùng kết quả đánh giá của app.</div>';
    h += '<div class="grid-wrap"><table class="ftable summary-table"><thead><tr><th>STT</th><th>Hạng mục</th><th>Đã thí nghiệm</th><th>Đánh giá tự động</th><th>Số mục (đạt / xem xét / không đạt / thiếu)</th><th>Ghi vào BBTN</th></tr></thead><tbody>';
    schema.sections.forEach(s => {
      const S = res.sec[s.id];
      const autoTick = !!S.status;
      const tick = state.sum.tick[s.id] ?? autoTick;
      const ev = state.sum.ev[s.id] || '';
      h += `<tr class="${S.status ? 'st-' + S.status : ''}"><td>${s.no}</td><td>${esc(s.title)}</td>
        <td><input type="checkbox" data-sumtick="${s.id}" ${tick ? 'checked' : ''}></td>
        <td><span class="badge ${S.status ? 'st-' + S.status : 'st-none'}">${S.text || 'Chưa nhập'}</span></td>
        <td class="num">${S.counts.pass} / ${S.counts.warn} / ${S.counts.fail} / ${S.counts.missing}</td>
        <td><select data-sumev="${s.id}">${[['', 'Tự động'], ['Đạt', 'Đạt'], ['Không đạt', 'Không đạt'], ['Cần xem xét', 'Cần xem xét'], ['—', '(để trống)']].map(([v, t]) => `<option value="${v}" ${v === ev ? 'selected' : ''}>${t}</option>`).join('')}</select></td></tr>`;
    });
    h += '</tbody></table></div>';
    h += '<h3>Ghi chú & kết luận (điền vào BBTN)</h3><div class="fields">' + Schema.CLOSING.map(f => fieldHTML(f)).join('') + '</div>';
    h += `<div class="row-actions"><button class="btn" data-act="autoConclusion">Điền kết luận tự động</button><button class="btn" data-act="xlsx">Xuất so sánh .xlsx</button><button class="btn primary" data-act="docx">Xuất BBTN .docx</button></div>`;
    h += `<div class="callout">Kết luận tự động chỉ tổng hợp kết quả so sánh; quyết định đóng điện thuộc người có thẩm quyền (QĐ 1901 Điều 3, Điều 9 mục 4). Gợi ý hiện tại: <i data-autoconc></i></div>`;
    h += findingsHTML('*');
    return `<section class="panel">${h}</section>`;
  }

  let factoryTab = 0;
  function renderFactory() {
    let h = headHTML('XX', 'Số liệu xuất xưởng', FX ? FX.data.fileName : '');
    if (!FX) return `<section class="panel">${h}<div class="empty">Chưa nạp file.</div></section>`;
    const sh = FX.data.sheets;
    h += `<div class="row-actions"><button class="btn" data-act="loadXlsx">Nạp file .xlsx khác…</button>${lsGet(LS_FAC) ? '<button class="btn" data-act="resetXlsx">Dùng lại file mặc định</button>' : ''}</div>`;
    h += '<div class="tabs">' + sh.map((s, i) => `<button data-ftab="${i}" class="${i === factoryTab ? 'on' : ''}">${esc(s.name)}</button>`).join('') + '</div>';
    const rows = sh[factoryTab].rows;
    h += '<div class="raw"><table>' + rows.map(r => '<tr>' + (r || []).map(c => `<td title="${esc(c)}">${esc(typeof c === 'number' ? +c.toFixed(6) : c)}</td>`).join('') + '</tr>').join('') + '</table></div>';
    return `<section class="panel">${h}</section>`;
  }

  function renderMain() {
    const main = $('#main');
    let html;
    if (current === 'general') html = renderGeneral();
    else if (current === 'summary') html = renderSummary();
    else if (current === 'factory') html = renderFactory();
    else if (current === 'db') html = DbUI.renderDb();
    else if (current === 'trend') html = DbUI.renderTrend();
    else if (current === 'catalog') html = Catalog.render();
    else html = renderSection(schema.sections.find(s => s.id === current));
    const dl = FX ? `<datalist id="dlSerials">${FX.data.order.map(s => `<option value="${esc(s)}">`).join('')}</datalist>` : '';
    main.innerHTML = html + dl;
    updateComputed();
    if (current === 'db' || current === 'trend') DbUI.afterRender(current);
    if (current === 'catalog') Catalog.afterRender();
  }

  // Cập nhật ô tính toán, trạng thái ô, bảng so sánh mà không render lại form (giữ focus)
  function updateComputed() {
    const main = $('#main');
    $$('[data-c]', main).forEach(el => { el.textContent = res.calc[el.dataset.c] || ''; });
    $$('[data-n]', main).forEach(el => {
      const k = el.dataset.n;
      el.textContent = (res.notes[k] || res.calc[k] || '').trim() || '—';
    });
    $$('input.auto', main).forEach(el => { el.placeholder = res.calc[el.dataset.k] || ''; });
    const byKey = {};
    res.findings.forEach(f => (f.keys || []).forEach(k => {
      if (!byKey[k] || Evaluate.RANK[f.status] > Evaluate.RANK[byKey[k].status]) byKey[k] = f;
    }));
    $$('[data-k]', main).forEach(el => {
      el.classList.remove('st-pass', 'st-warn', 'st-fail', 'st-missing', 'st-info');
      const f = byKey[el.dataset.k];
      if (f && f.status !== 'info') el.classList.add('st-' + f.status);
      el.title = f ? `${ST_TEXT[f.status]} — ${f.item}${f.loc ? ' · ' + f.loc : ''}\nĐo: ${f.meas || ''}${f.conv ? '\nQuy đổi: ' + f.conv : ''}${f.ref ? '\nTham chiếu: ' + f.ref : ''}${f.dev ? '\nĐộ lệch: ' + f.dev : ''}${f.limit ? '\nGiới hạn: ' + f.limit : ''}${f.note ? '\n' + f.note : ''}\n(${f.basis || ''})` : '';
    });
    $$('[data-h]', main).forEach(el => {
      const f = byKey[el.dataset.h];
      el.className = 'hint' + (f ? ' st-' + f.status : '');
      const tok = f && f.dev ? f.dev.trim().split(' ')[0] : '';
      el.textContent = tok ? (tok.endsWith('%') ? tok : tok + '%') : '';
    });
    $$('.calc .cv', main).forEach(el => {
      const f = byKey[el.dataset.c];
      el.classList.remove('st-pass', 'st-warn', 'st-fail');
      if (f && f.status !== 'info') el.classList.add('st-' + f.status);
    });
    $$('[data-findings]', main).forEach(el => { el.outerHTML = findingsHTML(el.dataset.findings); });
    const ac = $('[data-autoconc]', main);
    if (ac) ac.textContent = Evaluate.autoConclusion(res, schema, state) || '(chưa có dữ liệu)';
    const head = $('.panel[data-sec] .panel-head .badge', main);
    const secEl = $('.panel[data-sec]', main);
    if (head && secEl) { const S = res.sec[secEl.dataset.sec]; head.className = `badge ${S.status ? 'st-' + S.status : 'st-none'}`; head.textContent = S.text || 'Chưa nhập'; }
    renderNav();
    renderRecordChip();
  }

  let evalT = null;
  function scheduleEval() {
    clearTimeout(evalT);
    evalT = setTimeout(() => { recompute(); updateComputed(); }, 120);
    persist();
  }

  // ---------------------------------------------------------------- events
  function setCfg(path, value) {
    const parts = path.split('.');
    let o = state.cfg;
    parts.slice(0, -1).forEach(p => { o[p] = o[p] || {}; o = o[p]; });
    const last = parts[parts.length - 1];
    if (path === 'taps') o[last] = value.split(/[,;]+/).map(x => x.trim()).filter(Boolean);
    else o[last] = value;
  }

  function onInput(e) {
    const el = e.target;
    if (el.dataset.k) {
      state.v[el.dataset.k] = el.value;
      if (/\.(kmode|mount)$/.test(el.dataset.k)) { recompute(); renderMain(); persist(); return; }
      if (el.dataset.k === 'meta.serial' && e.type === 'change') onSerialChange();
      scheduleEval();
    } else if (el.dataset.cfg && e.type === 'change') {
      setCfg(el.dataset.cfg, el.value);
      if (/^(taps|bctCores)/.test(el.dataset.cfg)) {
        if (el.dataset.cfg === 'taps' && state.cfg.taps.length !== 19) toast(`Cần đúng 19 nhãn nấc (đang có ${state.cfg.taps.length}) — tạm dùng mặc định`, true);
        schema = Schema.build(state.cfg);
      }
      recompute();
      if (/^(template|bctCores|taps)/.test(el.dataset.cfg)) renderMain(); else updateComputed();
      persist();
    } else if (el.dataset.sumtick) {
      state.sum.tick[el.dataset.sumtick] = el.checked; persist();
    } else if (el.dataset.sumev !== undefined && e.type === 'change') {
      state.sum.ev[el.dataset.sumev] = el.value; persist();
    }
  }
  function onSerialChange() {
    const u = FX && FX.unit(state.v['meta.serial']);
    if (!u) { toast('Số chế tạo không có trong file xuất xưởng — các so sánh với máy chính sẽ thiếu tham chiếu', true); return; }
    if (state.cfg.template !== 'custom' && EMB.templates[u.phase] && state.cfg.template !== u.phase) {
      state.cfg.template = u.phase;
      toast(`Đã chọn template ${EMB.templates[u.phase].name} theo pha ${u.phase}`);
    }
  }

  function onPaste(e) {
    const el = e.target;
    if (!el.dataset || !el.dataset.g) return;
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!/[\t\n]/.test(text.replace(/\r?\n$/, ''))) return;
    e.preventDefault();
    const table = el.closest('table');
    const map = {};
    $$('[data-g]', table).forEach(x => { map[`${x.dataset.r}:${x.dataset.col}`] = x; });
    const r0 = +el.dataset.r, c0 = +el.dataset.col;
    const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n');
    let n = 0;
    lines.forEach((line, i) => line.split('\t').forEach((cell, j) => {
      // bỏ qua các cột tính toán: tìm ô nhập thứ j bên phải
      let cc = c0, step = 0, target = null;
      while (cc < 60) { const t = map[`${r0 + i}:${cc}`]; if (t) { if (step === j) { target = t; break; } step++; } cc++; }
      if (target) { target.value = cell.trim(); state.v[target.dataset.k] = target.value; n++; }
    }));
    toast(`Đã dán ${n} ô`);
    scheduleEval();
  }

  function onKey(e) {
    const el = e.target;
    if (e.key === 'Enter' && el.dataset && el.dataset.g && el.tagName === 'INPUT') {
      e.preventDefault();
      const table = el.closest('table');
      const next = $(`[data-r="${+el.dataset.r + (e.shiftKey ? -1 : 1)}"][data-col="${el.dataset.col}"]`, table);
      if (next) { next.focus(); next.select && next.select(); }
    }
  }

  async function onClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.nav) { current = b.dataset.nav; renderNav(); renderMain(); $('#main').scrollTop = 0; window.scrollTo(0, 0); return; }
    if (b.dataset.filter) { filters[b.dataset.fsec] = b.dataset.filter; updateComputed(); return; }
    if (b.dataset.ftab !== undefined) { factoryTab = +b.dataset.ftab; renderMain(); return; }
    const act = b.dataset.act;
    try {
      if (act === 'new') {
        if (!confirm('Tạo biên bản mới? Dữ liệu đang nhập chưa lưu file .json sẽ bị thay thế.')) return;
        await newRecord(true); recompute(); renderMain(); persist(); toast('Đã tạo biên bản mới từ template');
      } else if (act === 'save') saveJson();
      else if (act === 'open') $('#fileJson').click();
      else if (act === 'loadXlsx') $('#fileXlsx').click();
      else if (act === 'loadDocx') $('#fileDocx').click();
      else if (act === 'loadHitachi') $('#fileHitachi').click();
      else if (act === 'loadCpc') $('#fileCpc').click();
      else if (act === 'resetXlsx') { lsSet(LS_FAC, null); loadFactoryDefault(); applyFactoryDefaults(state.cfg); recompute(); renderMain(); toast('Đã dùng lại file xuất xưởng mặc định'); }
      else if (act === 'docx') await exportDocx();
      else if (act === 'xlsx') exportXlsx();
      else if (act === 'autoConclusion') {
        state.v['meta.conclusion'] = Evaluate.autoConclusion(res, schema, state);
        renderMain(); persist();
      } else if (act === 'fillBushingSN') fillBushingSN();
      else if (act && act.startsWith('db')) await DbUI.action(act, b);
    } catch (err) {
      console.error(err);
      toast('Lỗi: ' + err.message, true);
    }
  }

  function fillBushingSN() {
    let n = 0;
    const put = (k, val) => { if (val && !state.v[k]) { state.v[k] = val; n++; } };
    [['hv', '1.1', ['A', 'B', 'C']], ['mv', '2.1', ['A', 'B', 'C']], ['lv', '3.1', ['a', 'b', 'c']]].forEach(([side, term, cols]) => {
      cols.forEach(c => { const b = FX.bushingByUnit(state.cfg.ps[c.toUpperCase()], term); put(`b.${side}.meas.serial.${c}`, b && b.serial); });
    });
    const bn = FX.bushingByUnit(state.v['meta.serial'], '2');
    put('b.mv.meas.serial.N', bn && bn.serial);
    recompute(); renderMain(); persist();
    toast(n ? `Đã điền ${n} số chế tạo sứ — hãy đối chiếu với nameplate thực tế` : 'Không có ô trống cần điền');
  }

  // ---------------------------------------------------------------- files
  function saveJson() {
    const data = { app: 'bbtn-mba', version: 1, savedAt: new Date().toISOString(), factoryFile: FX ? FX.data.fileName : null, state };
    const name = `BBTN_MBA_${safeName(state.v['meta.serial'])}_${safeName(state.v['meta.date'])}.json`;
    download(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), name);
    toast('Đã lưu ' + name);
  }
  function loadState(obj) {
    const st = obj.state || obj;
    if (!st || !st.v || !st.cfg) throw new Error('File không đúng định dạng dữ liệu BBTN');
    const cfg = Object.assign(defaultCfg(), st.cfg);
    cfg.ps = Object.assign(defaultCfg().ps, st.cfg.ps || {});
    cfg.ctNo = Object.assign(defaultCfg().ctNo, st.cfg.ctNo || {});
    cfg.bctCores = Object.assign(defaultCfg().bctCores, st.cfg.bctCores || {});
    state = { v: st.v, cfg, sum: st.sum || { tick: {}, ev: {} }, created: st.created, db: st.db || null };
    state.sum.tick = state.sum.tick || {}; state.sum.ev = state.sum.ev || {};
    applyFactoryDefaults(state.cfg);
    schema = Schema.build(state.cfg);
  }
  async function readFile(input, fn) {
    const f = input.files[0];
    input.value = '';
    if (!f) return;
    try { await fn(f); } catch (err) { console.error(err); toast('Lỗi đọc file: ' + err.message, true); }
  }

  function loadFactoryDefault() {
    const custom = lsGet(LS_FAC);
    try {
      if (custom) { const o = JSON.parse(custom); FX = Factory.fromBase64(o.b64, o.name); return; }
    } catch (e) { console.warn('custom factory invalid', e); }
    FX = EMB.factory ? Factory.fromBase64(EMB.factory.b64, EMB.factory.name) : null;
  }
  // Test report sứ Hitachi + hằng số quy đổi: file nạp tay (lưu trình duyệt) ưu tiên hơn file nhúng sẵn
  function loadHitachiDefault() {
    try {
      const custom = lsGet(LS_HIT);
      if (custom) { const o = JSON.parse(custom); HitachiBushing.fromBase64(o.b64, o.name); return; }
      if (EMB.bushingTR) HitachiBushing.fromBase64(EMB.bushingTR.b64, EMB.bushingTR.name);
    } catch (e) { console.warn('Hitachi test report:', e); toast('Không đọc được file test report sứ: ' + e.message, true); }
  }

  // ---------------------------------------------------------------- export
  async function exportDocx() {
    recompute();
    const data = templateData();
    if (!data) { toast('Chưa có template BBTN — nạp file .docx ở mục 0 “Thông tin chung & cấu hình”', true); return; }
    const tpl = await DocxTemplate.load(data);
    if (tpl.tables.length < 72) toast(`Cảnh báo: template có ${tpl.tables.length} bảng (mẫu chuẩn 73) — vị trí điền có thể lệch`, true);
    const miss = [];
    // Thống nhất dấu thập phân cho các giá trị thuần số (giá trị nhập và giá trị tính)
    const dec = state.cfg.decSep === '.' ? '.' : ',';
    const out = s => {
      const t = String(s).trim();
      return /^[-+]?\d+([.,]\d+)?$/.test(t) ? t.replace(/[.,]/, dec) : t;
    };
    const write = (f, value) => {
      if (value === undefined || value === null || String(value).trim() === '') return;
      if (!tpl.writeField(f.doc, out(value))) miss.push(f.label || f.k);
    };
    const v = state.v;
    Schema.eachField(schema, f => {
      if (!f.doc) return;
      let val = v[f.k];
      if (f.k === 'meta.conclusion' && !val) val = Evaluate.autoConclusion(res, schema, state);
      const m = f.k.match(/^b\.(\w+)\.k$/);
      if (m && !/Nhập/i.test(v[`b.${m[1]}.kmode`] || '')) val = (res.notes[f.k] || '').trim();
      if (/\.btype$/.test(f.k)) val = val || 'RIP';
      write(f, val);
    });
    schema.sections.forEach(s => (s.extraDoc || []).forEach(x => write({ doc: x.doc, k: x.k }, (res.notes[x.k] || '').trim())));
    let cells = 0;
    Schema.eachGrid(schema, g => {
      g.rows.forEach(r => g.cols.forEach(c => {
        if (r.nodoc || (g.skip && g.skip(r.k, c.k))) return;
        const key = `${g.id}.${r.k}.${c.k}`;
        const val = (g.readonly || c.calc) ? res.calc[key] : ((v[key] ?? '').toString().trim() || res.calc[key]);
        if (val === undefined || val === null || String(val).trim() === '') return;
        const tc = tpl.cell(g.tables, r.doc, r.cmap && r.cmap[c.k] !== undefined ? r.cmap[c.k] : c.doc);
        if (tpl.setCellText(tc, out(val))) cells++; else miss.push(key);
      }));
      // Đặc tính từ hóa: ghi đầu cuộn thực đo (vd 2S1-2S5) vào ô nhãn thay cho nhãn mẫu "2S1 - 2S4"
      if (/^bct\.\w+\.ex\./.test(g.id)) g.rows.filter(r => /i$/.test(r.k)).forEach(r => {
        const tap = v[`${g.id}.tap.${r.k.slice(0, -1)}`];
        if (tap) tpl.setCellText(tpl.cell(g.tables, r.doc, 0), tap);
      });
    });
    schema.sections.forEach(s => {
      const row = Schema.SUMMARY_ROWS[s.id];
      const S = res.sec[s.id];
      const tick = state.sum.tick[s.id] ?? !!S.status;
      const ev = state.sum.ev[s.id];
      tpl.setCellText(tpl.cell([0], row, 3), tick ? '✓' : '');
      tpl.setCellText(tpl.cell([0], row, 4), ev === '—' ? '' : (ev || (tick ? S.text : '')));
    });
    const blob = await tpl.toBlob();
    const name = `BBTN_MBA_${safeName(v['meta.serial'])}_${safeName(v['meta.date'])}.docx`;
    download(blob, name);
    toast(`Đã xuất ${name} (${cells} ô số liệu)${miss.length ? ` — không định vị được: ${miss.slice(0, 4).join(', ')}${miss.length > 4 ? '…' : ''}` : ''}`, miss.length > 0);
    // Biên bản đã lưu CSDL → lưu kèm file BBTN vào Storage
    if (state.db && state.db.sessionId && DB.user && DB.canEdit()) {
      try {
        await DB.uploadDoc(state.db.sessionId, state.db.equipmentId || null, 'BBTN_DOCX', `${v['meta.serial']}/${state.db.sessionId}/${name}`, name, blob);
        toast(`Đã xuất ${name} và lưu bản .docx vào CSDL`);
      } catch (err) { toast('Đã tải file nhưng chưa lưu được vào CSDL: ' + err.message, true); }
    }
  }

  function exportXlsx() {
    recompute();
    const v = state.v;
    const secTitle = id => { const s = schema.sections.find(x => x.id === id); return s ? `${s.no}. ${s.title}` : id; };
    const head = ['Số chế tạo (máy chính)', 'Ngày TN', 'Lý do', 'Hạng mục', 'Nội dung', 'Vị trí / pha / nấc', 'Giá trị đo', 'Giá trị quy đổi', 'Tham chiếu (xuất xưởng / tiêu chuẩn)', 'Độ lệch', 'Giới hạn', 'Đánh giá', 'Điều/Bảng QĐ 1901', 'Ghi chú'];
    const rows = [head].concat(res.findings.map(f => [v['meta.serial'], v['meta.date'], v['meta.reason'], secTitle(f.sec), f.item, f.loc || '', f.meas || '', f.conv || '', f.ref || '', f.dev || '', f.limit || '', ST_TEXT[f.status], f.basis || '', f.note || '']));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [12, 11, 11, 30, 34, 34, 20, 20, 34, 14, 34, 12, 26, 50].map(w => ({ wch: w }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: head.length - 1 } }) };
    const sum = [['STT', 'Hạng mục', 'Đánh giá', 'Đạt', 'Cần xem xét', 'Không đạt', 'Thiếu dữ liệu', 'Tham khảo']].concat(schema.sections.map(s => {
      const S = res.sec[s.id];
      return [s.no, s.title, S.text || 'Chưa nhập', S.counts.pass, S.counts.warn, S.counts.fail, S.counts.missing, S.counts.info];
    }));
    sum.push([], ['Kết luận gợi ý', Evaluate.autoConclusion(res, schema, state)], ['Thiết bị', `${v['meta.site'] || ''} — S/N ${v['meta.serial'] || ''}`], ['File xuất xưởng', FX ? FX.data.fileName : '']);
    const ws2 = XLSX.utils.aoa_to_sheet(sum);
    ws2['!cols'] = [{ wch: 14 }, { wch: 46 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 13 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws2, 'Tổng hợp');
    XLSX.utils.book_append_sheet(wb, ws, 'So sánh chi tiết');
    const name = `SoSanh_MBA_${safeName(v['meta.serial'])}_${safeName(v['meta.date'])}.xlsx`;
    XLSX.writeFile(wb, name);
    toast('Đã xuất ' + name);
  }

  // ---------------------------------------------------------------- boot
  async function boot() {
    loadFactoryDefault();
    loadHitachiDefault();
    const saved = lsGet(LS_STATE);
    let restored = false;
    if (saved) {
      try { loadState(JSON.parse(saved)); restored = true; } catch (e) { console.warn('saved state invalid', e); }
    }
    if (!restored) { state = { cfg: defaultCfg() }; await newRecord(false); }
    recompute();
    renderMain();
    if (restored && !new URLSearchParams(location.search).has('code')) Notify.show({ type: 'info', msg: 'Đã mở lại biên bản đang nhập dở trên máy này.' });
    // Đăng nhập / đăng xuất / đổi kết nối → làm mới dữ liệu CSDL đang hiển thị
    document.addEventListener('auth:changed', () => { DbUI.reset(); Catalog.reset(); renderNav(); renderMain(); });
    DB.connect();
    AuthUI.init().catch(e => console.warn(e));

    document.addEventListener('click', onClick);
    $('#main').addEventListener('input', onInput);
    $('#main').addEventListener('change', onInput);
    $('#main').addEventListener('paste', onPaste);
    $('#main').addEventListener('keydown', onKey);
    $('#fileJson').addEventListener('change', e => readFile(e.target, async f => {
      loadState(JSON.parse(await f.text())); recompute(); current = 'general'; renderMain(); persist(); toast('Đã mở ' + f.name);
    }));
    $('#fileXlsx').addEventListener('change', e => readFile(e.target, async f => {
      const buf = await f.arrayBuffer();
      FX = Factory.fromArrayBuffer(buf, f.name);
      if (!lsSet(LS_FAC, JSON.stringify({ name: f.name, b64: abToB64(buf) }))) toast('File lớn — chỉ dùng trong phiên này', true);
      applyFactoryDefaults(state.cfg);
      recompute(); renderMain(); persist();
      toast(`Đã nạp ${f.name}: ${FX.data.order.length} máy${FX.data.warnings.length ? ' — có cảnh báo' : ''}`, FX.data.warnings.length > 0);
    }));
    $('#fileCpc').addEventListener('change', e => { const fl = Array.from(e.target.files); e.target.value = ''; if (fl.length) CpcImport.open(fl); });
    $('#fileHitachi').addEventListener('change', e => readFile(e.target, async f => {
      const buf = await f.arrayBuffer();
      const info = HitachiBushing.fromArrayBuffer(buf, f.name);
      if (!lsSet(LS_HIT, JSON.stringify({ name: f.name, b64: abToB64(buf) }))) toast('File lớn — chỉ dùng trong phiên này', true);
      recompute(); renderMain(); toast(`Đã nạp test report sứ ${f.name}: ${info.count} sứ`);
    }));
    $('#fileDocx').addEventListener('change', e => readFile(e.target, async f => {
      const buf = await f.arrayBuffer();
      const t = await DocxTemplate.load(buf);
      if (t.tables.length < 72) toast(`Template có ${t.tables.length} bảng, khác mẫu chuẩn (73) — kiểm tra kỹ file xuất`, true);
      lsSet(LS_TPL, JSON.stringify({ name: f.name, b64: abToB64(buf) }));
      state.cfg.template = 'custom';
      renderMain(); persist(); toast('Đã nạp template ' + f.name);
    }));
    window.addEventListener('beforeunload', () => lsSet(LS_STATE, JSON.stringify(state)));
  }

  // API cho js/db-ui.js
  window.App = {
    get state() { return state; }, get res() { return res; }, get schema() { return schema; }, get FX() { return FX; }, EMB,
    exportDocx, exportXlsx, toast, esc, download, safeName, persist, recompute,
    rebuild(schemaChanged) { if (schemaChanged) schema = Schema.build(state.cfg); recompute(); renderNav(); renderMain(); persist(); },
    render() { renderNav(); renderMain(); },
    go(id) { current = id; renderNav(); renderMain(); window.scrollTo(0, 0); },
    openState(st, db) { loadState(st); state.db = db; recompute(); current = 'general'; renderMain(); persist(); },
  };
  boot().catch(err => { console.error(err); toast('Lỗi khởi động: ' + err.message, true); });
})();
