// MBA: hộp thoại nhập số liệu máy đo Haefely 2293 (.csv + .bin cùng tên) vào mục 7 (điện trở một chiều),
// mục 8 (tỷ số biến) và mục 9 (chụp sóng OLTC → phụ lục BBTN). Đọc file bằng js/data/instruments/wa2293.js,
// ánh xạ vào biểu mẫu bằng js/domain/types/mba/import-2293.js.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',') : '—');

  const RDC_TARGETS = [['hv', '7.1 Cao áp (theo nấc)'], ['mv', '7.2 Trung áp'], ['lv', '7.3 Hạ áp']];
  const RATIO_TARGETS = [['hm', '8.1 HV : MV (theo nấc)'], ['hl', '8.2 HV : LV (theo nấc)'], ['ml', '8.3 MV : LV']];
  let entries = [];
  let opt = { mid: 'b', overwrite: true, convT: true };

  const base = name => name.replace(/\.[^.]+$/, '').toLowerCase();

  async function open(fileList) {
    const files = Array.from(fileList);
    const csv = files.filter(f => /\.csv$/i.test(f.name)), bin = files.filter(f => /\.bin$/i.test(f.name));
    const errors = [];
    const read = async f => { try { return await f.arrayBuffer(); } catch (e) { errors.push(`${f.name}: ${e.message}`); return null; } };
    entries = [];
    for (const f of csv) {
      const buf = await read(f);
      if (!buf) continue;
      try { entries.push({ csv: Wa2293.parseCsv(Wa2293.decode(buf), f.name) }); } catch (e) { errors.push(e.message); }
    }
    for (const f of bin) {
      const buf = await read(f);
      if (!buf) continue;
      let b;
      try { b = Wa2293.parseBin(buf, f.name); } catch (e) { errors.push(e.message); continue; }
      const host = entries.find(x => x.csv && base(x.csv.file) === base(f.name));
      if (host) host.bin = b; else entries.push({ bin: b });
    }
    errors.forEach(m => Notify.show({ type: 'error', msg: m }));
    entries = entries.filter(x => (x.csv && (x.csv.rdc.length || x.csv.ratio.length || x.csv.oltc.length)) || (x.bin && x.bin.waves.length));
    if (!entries.length) { if (!errors.length) Notify.show({ type: 'warn', msg: 'Không có số liệu điện trở, tỷ số biến hay chụp sóng trong các file đã chọn (chọn file .csv và .bin cùng tên).' }); return; }
    const st = App.state, taps = st.cfg.taps;
    entries.forEach(x => {
      const p = x.csv;
      const conn = p ? ((p.oltc[0] || p.rdc[0] || p.ratio[0] || {}).conn) : (x.bin.waves[0] || {}).conn;
      const g = Wa2293.guessPhase((p || x.bin).file, conn);
      x.phase = g.phase; x.phaseFrom = g.from;
      x.rdc = p ? Mba2293.rdcGroups(p).map(gr => Object.assign(gr, { use: true })) : [];
      x.ratioTarget = p && p.ratio.length ? Mba2293.guessRatioTarget(p, App.FX, st.cfg, taps) : 'hm';
      x.useRatio = !!(p && p.ratio.length);
      x.nOltc = p && p.oltc.length ? p.oltc.length : (x.bin ? x.bin.waves.length : 0);
    });
    // Nhóm điện trở lệch xa các file khác: mặc định không điền
    Mba2293.rdcOutliers(entries.flatMap(x => x.rdc)).forEach(o => { o.g.use = false; o.g.dev = o.dev; });
    pickOltc();
    render();
    $('#waDialog').showModal();
  }

  // Một pha chỉ lấy một bộ chụp sóng: file có nhiều lần chuyển nấc nhất (file Rdc của máy cũng chép lại bảng chuyển nấc)
  function pickOltc() {
    entries.forEach(x => { x.useOltc = false; });
    ['A', 'B', 'C'].forEach(ph => {
      const xs = entries.filter(x => x.phase === ph && x.nOltc);
      if (!xs.length) return;
      const best = xs.reduce((a, b) => ((b.nOltc + (b.bin ? 0.5 : 0)) > (a.nOltc + (a.bin ? 0.5 : 0)) ? b : a));
      best.useOltc = true;
    });
  }

  // Các pha ghi vào cùng lưới điện trở nhưng đo ở nhiệt độ khác nhau (biểu mẫu chỉ có một ô nhiệt độ mỗi cuộn)
  const conflicts = () => {
    const v = App.state.v;
    const items = entries.flatMap(x => x.rdc.filter(g => g.use).map(g => ({ g, phase: x.phase })));
    return Mba2293.rdcTempConflicts(items, { hv: v['dcr.hv.t'], mv: v['dcr.mv.t'], lv: v['dcr.lv.t'] });
  };
  const TARGET_NAME = Object.fromEntries(RDC_TARGETS);

  const needMid = () => {
    const taps = App.state.cfg.taps;
    return taps.some(t => /^\d+[a-z]$/i.test(t)) && entries.some(x => x.csv && x.csv.nTaps && x.csv.nTaps !== taps.length);
  };

  function render() {
    const sel = (attr, i, list, cur, extra = '') => `<select data-wa="${attr}" data-i="${i}"${extra}>${list.map(([k, t]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    let h = `<div class="ad-body cpc wa"><h2 id="waTitle">Nhập số liệu từ Haefely 2293</h2>
      <p class="ad-lead">Máy 1 pha đo từng máy với cùng dây đo A–N nên <b>pha lấy theo tên file</b> (…TAP-A, …TSB B, …pha C); tên file không có pha thì theo đấu nối. Kiểm tra pha và nơi ghi của từng file trước khi điền. Điện trở đổi Ω → mΩ; biểu mẫu có một ô nhiệt độ cho mỗi cuộn nên các pha đo ở nhiệt độ khác nhau sẽ được quy về cùng nhiệt độ (xem cảnh báo bên dưới nếu có).</p>`;
    entries.forEach((x, i) => {
      const p = x.csv;
      h += `<section class="cpc-file"><div class="cpc-file-head"><b>${esc(p ? p.file : x.bin.file)}</b>${x.bin && p ? `<span>+ ${esc(x.bin.file)}</span>` : ''}<span>${esc(p ? (p.exported || p.created) : '')}${p && p.dut ? ` · DUT “${esc(p.dut)}”` : ''}</span>
        <label>Pha ${sel('phase', i, [['A', 'A'], ['B', 'B'], ['C', 'C']], x.phase)}</label>${x.phaseFrom !== 'name' ? '<span class="badge st-warn">pha theo đấu nối — kiểm tra</span>' : ''}</div>
        <table class="ftable cpc-tbl"><thead><tr><th></th><th>Số liệu</th><th>Nội dung</th><th>Ghi vào</th></tr></thead><tbody>`;
      x.rdc.forEach((g, gi) => {
        const rs = g.rows.map(r => r.r * 1000);
        h += `<tr><td><input type="checkbox" data-wa="rdc" data-i="${i}" data-g="${gi}" ${g.use ? 'checked' : ''} aria-label="Điền điện trở cuộn ${esc(g.winding)}"></td>
          <td><b>Điện trở một chiều</b><br><span>cuộn ${esc(g.winding)} · ${esc(g.rows[0].conn)}</span></td>
          <td class="num">${g.hasTaps ? `${g.rows.length} nấc · ` : ''}${fmt(Math.min(...rs), 2)}${rs.length > 1 ? `–${fmt(Math.max(...rs), 2)}` : ''} mΩ<br><span>${fmt(g.t, 1)} °C · I = ${fmt(g.rows[0].i, 2)} A</span>${g.dev !== undefined ? `<br><span class="badge st-warn">lệch ${fmt(g.dev, 0)} % so với các file khác — kiểm tra cuộn đo</span>` : ''}</td>
          <td>${sel('rdcTarget', i, RDC_TARGETS, g.target, ` data-g="${gi}"`)}</td></tr>`;
      });
      if (p && p.ratio.length) {
        const rr = p.ratio.map(r => r.ratio);
        h += `<tr><td><input type="checkbox" data-wa="ratio" data-i="${i}" ${x.useRatio ? 'checked' : ''} aria-label="Điền tỷ số biến"></td>
          <td><b>Tỷ số biến</b><br><span>${esc(p.ratio[0].conn)}</span></td>
          <td class="num">${p.ratio.length} nấc · ${fmt(Math.min(...rr), 4)}–${fmt(Math.max(...rr), 4)}<br><span>U thử ${fmt(p.ratio[0].u, 0)} V</span></td>
          <td>${sel('ratioTarget', i, RATIO_TARGETS, x.ratioTarget)}</td></tr>`;
      }
      if (x.nOltc) {
        const span = esc(Mba2293.spanLabel(p && p.oltc.length ? p.oltc : x.bin.waves));
        h += `<tr><td><input type="checkbox" data-wa="oltc" data-i="${i}" ${x.useOltc ? 'checked' : ''} aria-label="Lấy chụp sóng OLTC"></td>
          <td><b>Chụp sóng OLTC</b><br><span>${x.bin ? `đồ thị từ ${esc(x.bin.file)}` : 'chưa chọn file .bin — phụ lục chỉ có bảng số liệu'}</span></td>
          <td class="num">${x.nOltc} lần chuyển nấc${span ? ` (${span})` : ''}</td><td>9. OLTC + phụ lục pha ${esc(x.phase)}</td></tr>`;
      }
      h += '</tbody></table></section>';
    });
    const cf = conflicts();
    if (cf.length) {
      h += `<div class="callout warn wa-temp"><b>Nhiệt độ đo khác nhau giữa các pha</b> — biểu mẫu chỉ có một ô nhiệt độ cho mỗi cuộn dây:<ul>${cf.map(c => `<li>${esc(TARGET_NAME[c.target])}: ${c.temps.map(x => `pha ${x.phase} ${fmt(x.t, 1)} °C`).join(', ')}</li>`).join('')}</ul>
        <label class="chk"><input type="checkbox" data-wa="convT" ${opt.convT ? 'checked' : ''}> Quy đổi điện trở các pha về cùng nhiệt độ ${cf.map(c => `${fmt(c.ref, 1)} °C`).join(' / ')} trước khi ghi (QĐ 1901: R<sub>2</sub> = R<sub>1</sub>·(235 + t<sub>2</sub>)/(235 + t<sub>1</sub>)), ghi nhiệt độ đó vào ô nhiệt độ của cuộn</label>
        ${opt.convT ? '' : '<p>Không quy đổi: các pha được đánh giá như đo cùng một nhiệt độ — kết quả so sánh lệch pha sẽ sai.</p>'}</div>`;
    }
    h += '<div class="wa-opts">';
    if (needMid()) h += `<label>Nấc giữa của máy đo (vd 9) ghi vào hàng <select data-wa="mid">${[['a', '9a'], ['b', '9b'], ['c', '9c'], ['all', 'cả 9a, 9b, 9c']].map(([k, t]) => `<option value="${k}" ${k === opt.mid ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
    h += `<label class="chk"><input type="checkbox" data-wa="overwrite" ${opt.overwrite ? 'checked' : ''}> Ghi đè ô đã có số liệu</label></div>`;
    h += '<div class="row-actions" style="justify-content:flex-end"><button class="btn" data-wa="cancel">Hủy</button><button class="btn primary" data-wa="apply">Điền vào biểu mẫu</button></div></div>';
    $('#waPanel').innerHTML = h;
  }

  function apply() {
    const st = App.state, taps = st.cfg.taps;
    st.att = st.att || {};
    const writes = {}, temps = {};
    const done = { rdc: 0, ratio: 0, oltc: [], conv: [] };
    const toT = {};
    if (opt.convT) conflicts().forEach(c => { toT[c.target] = c.ref; done.conv.push(`${TARGET_NAME[c.target]} về ${fmt(c.ref, 1)} °C`); });
    entries.forEach(x => {
      const p = x.csv;
      x.rdc.filter(g => g.use).forEach(g => {
        const w = Mba2293.rdcWrites(g, g.target, x.phase, taps, p.nTaps, opt.mid, toT[g.target]);
        Object.assign(writes, w); done.rdc += Object.keys(w).length;
        const t = toT[g.target] ?? g.t;
        if (Number.isFinite(t) && !temps[`dcr.${g.target}.t`]) temps[`dcr.${g.target}.t`] = String(t);
      });
      if (x.useRatio) { const w = Mba2293.ratioWrites(p, x.ratioTarget, x.phase, taps, opt.mid); Object.assign(writes, w); done.ratio += Object.keys(w).length; }
      if (x.useOltc) {
        const waves = x.bin ? x.bin.waves.map(w => OltcWave.compact(w)) : [];
        st.att.oltc = st.att.oltc || {};
        st.att.oltc[x.phase] = Mba2293.oltcRecord(p, waves, x.bin && x.bin.file);
        done.oltc.push(x.phase);
      }
    });
    let n = 0, kept = 0;
    Object.entries(writes).forEach(([k, val]) => {
      if (!opt.overwrite && String(st.v[k] ?? '').trim()) { kept++; return; }
      st.v[k] = val; n++;
    });
    // nhiệt độ của cuộn: điền khi trống; đã quy đổi thì ghi nhiệt độ quy đổi
    Object.entries(temps).forEach(([k, val]) => { if (!String(st.v[k] ?? '').trim() || toT[k.split('.')[1]] !== undefined) st.v[k] = val; });
    if (done.oltc.length) fillOltcFields(st);
    $('#waDialog').close();
    App.rebuild(false);
    const parts = [];
    if (done.rdc) parts.push(`${done.rdc} ô điện trở một chiều${done.conv.length ? ` (đã quy đổi ${done.conv.join(', ')})` : ''}`);
    if (done.ratio) parts.push(`${done.ratio} ô tỷ số biến`);
    if (done.oltc.length) parts.push(`chụp sóng OLTC pha ${done.oltc.join(', ')}`);
    Notify.show({ type: 'success', title: `Đã điền ${n} ô từ ${entries.length} file 2293`,
      msg: `${parts.join('; ')}.${kept ? ` Giữ nguyên ${kept} ô đã có số liệu.` : ''}${done.oltc.length ? ' Đồ thị chụp sóng xem ở mục 9 và được nối thành phụ lục khi xuất BBTN.' : ''}` });
  }

  // Ô chiều chuyển nấc (để trống thì điền) và kết quả chụp công tắc K (điền khi trống hoặc còn là nội dung app tự điền lần trước)
  function fillOltcFields(st) {
    const d = Mba2293.oltcDirections(st.att.oltc);
    const put = (k, val) => { if (val && !String(st.v[k] ?? '').trim()) st.v[k] = val; };
    if (d.up) { put('oltc.d1from', d.up.from); put('oltc.d1to', d.up.to); }
    if (d.down) { put('oltc.d2from', d.down.from); put('oltc.d2to', d.down.to); }
    const sum = Mba2293.oltcSummary(st.att.oltc);
    const cur = String(st.v['oltc.osc'] ?? '').trim();
    if (!cur || cur === st.att.oscAuto) st.v['oltc.osc'] = sum;
    st.att.oscAuto = sum;
  }

  document.addEventListener('change', e => {
    const t = e.target;
    if (!t.dataset || !t.dataset.wa || !t.closest('#waPanel')) return;
    const x = entries[+t.dataset.i], a = t.dataset.wa;
    if (a === 'phase') { x.phase = t.value; x.phaseFrom = 'user'; pickOltc(); render(); }
    if (a === 'rdc') { x.rdc[+t.dataset.g].use = t.checked; render(); }
    if (a === 'rdcTarget') { x.rdc[+t.dataset.g].target = t.value; render(); }
    if (a === 'convT') { opt.convT = t.checked; render(); }
    if (a === 'ratio') x.useRatio = t.checked;
    if (a === 'ratioTarget') x.ratioTarget = t.value;
    if (a === 'oltc') x.useOltc = t.checked;
    if (a === 'mid') opt.mid = t.value;
    if (a === 'overwrite') opt.overwrite = t.checked;
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('#waPanel button[data-wa]');
    if (!b) return;
    if (b.dataset.wa === 'cancel') $('#waDialog').close();
    if (b.dataset.wa === 'apply') apply();
  });

  window.Wa2293Import = { open };
})();
