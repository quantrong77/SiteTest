// MBA: hộp thoại nhập số liệu biến dòng chân sứ đo bằng Megger MRCT (mục 11).
// Nhận file .pdbxml (PowerDB) và báo cáo PDF "CT TEST REPORT"; đọc bằng js/data/instruments/mrct.js.
// Người dùng gán mỗi CT vào phía/pha của MBA và mỗi lõi vào "cuộn" của BBTN, rồi điền: tỷ số đo & sai số,
// điện trở một chiều (cặp S1-Sk có ô trong BBTN), đặc tính từ hóa (mốc 25/50/75 % và điểm khuỷu), cực tính.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ok = Number.isFinite;
  const fmt = (x, d) => (ok(x) ? x.toFixed(d).replace('.', ',') : '—');
  const trim = (x, d) => (ok(x) ? String(+x.toFixed(d)).replace('.', ',') : '—'); // bỏ số 0 thừa

  const SIDES = { '': '— Không điền', hv: 'Cao áp (HV)', mv: 'Trung áp (MV) / trung tính', lv: 'Hạ áp (LV)' };
  const PHASES = { hv: ['A', 'B', 'C'], mv: ['A', 'B', 'C', 'N'], lv: ['a', 'b', 'c'] };
  const MAXCORE = { hv: 6, mv: 5, lv: 4 }; // số cuộn tối đa template hỗ trợ
  const EXMAX = { hv: 6, mv: 5, lv: 4, n: 3 };
  let files = [];

  // ---------------------------------------------------------------- đọc file
  async function readOne(f) {
    if (/\.pdf$/i.test(f.name)) return Mrct.parsePdfItems(await PdfText.extract(f), f.name);
    return Mrct.parsePdbxml(await f.text(), f.name);
  }

  async function open(fileList) {
    const list = await Promise.all(Array.from(fileList).map(f => readOne(f).catch(e => ({ error: e.message, file: f.name }))));
    list.filter(x => x.error).forEach(x => Notify.show({ type: 'error', msg: x.error }));
    files = list.filter(x => !x.error);
    if (!files.length) return;
    files.forEach(f => f.cts.forEach(ct => {
      Object.assign(ct, guess(ct.name, f.file));
      ct.cores.forEach(c => { c.ex = Mrct.excitation(c); c.use = true; });
      defaultRows(ct);
    }));
    render();
    $('#mrctDialog').showModal();
  }

  // Đoán phía/pha: CT tên U/V/W (kháng, máy phát) → pha A/B/C; tên có chữ pha cuối (vd "1.1.A1") hoặc tên file "BCT220A";
  // CT trung tính (UN, VN, WN…) và CT khác để người dùng tự gán.
  function guess(name, file) {
    const n = String(name).trim();
    const uvw = { U: 'A', V: 'B', W: 'C' };
    if (/^[UVW]$/i.test(n)) return { side: 'hv', phase: uvw[n.toUpperCase()] };
    const fm = file.replace(/\.[^.]+$/, '').match(/(\d{2,3})\s*([ABCabcN])(?![A-Za-z])/);
    const kv = fm ? +fm[1] : null;
    const pm = n.match(/(?:^|[^A-Za-z])([ABCabc])\d*$/) || (fm ? [null, fm[2]] : null);
    if (!pm) return { side: '', phase: '' };
    const p = pm[1];
    if (/^[abc]$/.test(p) || (kv && kv <= 35)) return { side: 'lv', phase: p.toLowerCase() };
    if (p === 'N') return { side: 'mv', phase: 'N' };
    return { side: 'hv', phase: p.toUpperCase() };
  }
  // Lõi → "cuộn" BBTN: theo mã lõi CT khai ở mục 0 (Cấu hình) khi mọi lõi của CT đều có trong danh sách,
  // không thì theo số lõi (tránh hai lõi rơi vào cùng một cuộn)
  function defaultRows(ct) {
    const cfg = App.state.cfg;
    const list = String((ct.phase === 'N' ? cfg.ctNo.n : cfg.ctNo[ct.side]) || '').split(/[,; ]+/).filter(Boolean);
    const byList = ct.cores.every(c => list.includes(String(c.code)));
    ct.cores.forEach(c => {
      c.w = byList ? list.indexOf(String(c.code)) + 1 : c.code;
      if (ct.side && c.w > maxRow(ct)) c.use = false;
    });
  }
  // Các lõi đang chọn trùng cùng một ô (phía, pha, cuộn)
  function clashes() {
    const seen = new Map(), out = [];
    files.forEach(f => f.cts.forEach(ct => {
      if (!ct.side || !ct.phase) return;
      ct.cores.forEach(c => {
        if (!c.use) return;
        const key = `${ct.side}.${ct.phase}.${c.w}`, who = `${f.file} CT ${ct.name} lõi ${c.code}`;
        if (seen.has(key)) out.push({ key, text: `${seen.get(key)} và ${who} cùng vào ${SIDES[ct.side]} pha ${ct.phase} cuộn ${c.w}` });
        else seen.set(key, who);
      });
    }));
    return out;
  }
  const maxRow = ct => (ct.phase === 'N' ? EXMAX.n : MAXCORE[ct.side] || 0);

  // ---------------------------------------------------------------- giao diện
  function coreRow(f, fi, ct, ti, c, ci) {
    const ratioTaps = c.taps.filter(t => t.a === 1 && (t.ratio || ok(t.r)));
    const other = c.taps.filter(t => t.a !== 1 && (t.ratio || ok(t.r))).map(t => t.name);
    const rat = ratioTaps.length ? ratioTaps.map(t => `<div><b>${esc(t.name)}</b> ${t.ratio ? `${esc(t.nominal ? t.nominal.text : '')} → ${trim(t.ratio.k, 3)} <span>(${ok(t.err) ? trim(t.err, 3) : '—'} %${t.phase ? `, ${esc(t.phase.text)}` : ''}${t.polarity ? `, ${esc(t.polarity)}` : ''})</span>` : '<span>không có tỷ số</span>'}${ok(t.r) ? ` · R ${trim(t.r, 4)} Ω` : ''}</div>`).join('') : '—';
    const ex = c.ex;
    const pt = p => (p ? `${fmt(p.v, 1)} V / ${fmt(p.i * 1000, 3)} mA` : '—');
    const exTxt = ex && ex.picks.length ? `<div><b>${esc(ex.name)}</b> · ${ex.points.length} điểm</div><div>25 %: ${pt(ex.picks[0])}</div><div>50 %: ${pt(ex.picks[1])}</div><div>75 %: ${pt(ex.picks[2])}</div><div>Khuỷu: ${ex.picks[3] ? pt(ex.picks[3]) : 'Không có'}</div>` : '—';
    const max = maxRow(ct);
    const opts = Array.from({ length: Math.max(max, 1) }, (_, k) => `<option value="${k + 1}" ${k + 1 === c.w ? 'selected' : ''}>Cuộn ${k + 1}</option>`).join('');
    const notes = [];
    if (ex) notes.push(esc(ex.how) + (ex.status === 'app' ? ' <span class="badge st-warn">kiểm tra</span>' : ''));
    if (other.length) notes.push(`Cặp ${esc(other.join(', '))}: BBTN không có ô, chỉ xem.`);
    if (c.rating) notes.push(`Định mức: ${esc(c.rating)}`);
    return `<tr><td><input type="checkbox" data-mrct="use" data-f="${fi}" data-t="${ti}" data-c="${ci}" ${c.use ? 'checked' : ''} ${ct.side ? '' : 'disabled'} aria-label="Điền lõi ${c.code}"></td>
      <td><b>Lõi ${c.code}</b><br><select data-mrct="w" data-f="${fi}" data-t="${ti}" data-c="${ci}" ${ct.side ? '' : 'disabled'} aria-label="Cuộn BBTN cho lõi ${c.code}">${opts}</select></td>
      <td class="num mrct-cell">${rat}</td><td class="num mrct-cell">${exTxt}</td><td class="note">${notes.join('<br>')}</td></tr>`;
  }

  function render() {
    let h = `<div class="ad-body cpc"><h2 id="mrctTitle">Nhập số liệu TI chân sứ từ Megger MRCT</h2>
      <p class="ad-lead">Gán mỗi CT vào <b>phía và pha</b> của MBA, mỗi lõi vào <b>cuộn</b> của BBTN (mặc định theo mã lõi khai ở mục 0). App điền tỷ số đo và sai số, điện trở một chiều của các cặp S1-S<i>k</i>, đặc tính từ hóa (mốc 25/50/75 % và điểm khuỷu) và cực tính. File .pdbxml không có kết quả tỷ số; dùng báo cáo PDF của PowerDB để lấy tỷ số.</p>`;
    files.forEach((f, fi) => {
      h += `<section class="cpc-file"><div class="cpc-file-head"><b>${esc(f.file)}</b><span>${esc(f.kind === 'pdf' ? 'Báo cáo PDF' : 'PowerDB .pdbxml')} · ${esc(f.device)}${f.date ? ` · ${esc(f.date)}` : ''}</span></div>`;
      f.cts.forEach((ct, ti) => {
        h += `<div class="cpc-file-head mrct-ct"><b>CT ${esc(ct.name)}</b>
          <label>Phía <select data-mrct="side" data-f="${fi}" data-t="${ti}">${Object.entries(SIDES).map(([k, t]) => `<option value="${k}" ${k === ct.side ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          ${ct.side ? `<label>Pha <select data-mrct="phase" data-f="${fi}" data-t="${ti}">${PHASES[ct.side].map(p => `<option ${p === ct.phase ? 'selected' : ''}>${p}</option>`).join('')}</select></label>` : ''}</div>
          <table class="ftable cpc-tbl mrct-tbl"><thead><tr><th></th><th>Lõi → cuộn</th><th>Tỷ số đo (sai số, góc, cực tính) · R một chiều</th><th>Đặc tính từ hóa</th><th>Ghi chú</th></tr></thead><tbody>`;
        ct.cores.forEach((c, ci) => { h += coreRow(f, fi, ct, ti, c, ci); });
        h += '</tbody></table>';
      });
      h += '</section>';
    });
    const cl = clashes();
    if (cl.length) h += `<div class="callout warn mrct-clash" role="alert"><b>Trùng ô:</b> ${cl.map(c => esc(c.text)).join('; ')}. Đổi cuộn, pha hoặc bỏ chọn một lõi.</div>`;
    h += `<div class="row-actions" style="justify-content:flex-end"><button class="btn" data-mrct="cancel">Hủy</button><button class="btn primary" data-mrct="apply">Điền vào biểu mẫu</button></div></div>`;
    const old = $('#mrctPanel .ad-body'), top = old ? old.scrollTop : 0;
    $('#mrctPanel').innerHTML = h;
    const body = $('#mrctPanel .ad-body');
    if (body) body.scrollTop = top; // vẽ lại khi đổi lựa chọn: giữ vị trí cuộn
  }

  // ---------------------------------------------------------------- điền biểu mẫu
  // Hàng tỷ số/điện trở có trong BBTN: cuộn 1..n-1 có S1-S2..S1-S5, cuộn n chỉ có S1-S2 (giống Schema.bctTapRows)
  const hasRow = (cores, w, b) => w >= 1 && w <= cores && (w < cores ? b >= 2 && b <= 5 : b === 2);
  const numText = (x, d) => String(+x.toFixed(d));

  const apply = () => App.track('Nhập số liệu MRCT', doApply);
  function doApply() {
    const st = App.state, v = st.v, cfg = st.cfg;
    const jobs = [];
    files.forEach(f => f.cts.forEach(ct => { if (ct.side && ct.phase) ct.cores.forEach(c => { if (c.use) jobs.push({ f, ct, c }); }); }));
    if (!jobs.length) { Notify.show({ type: 'error', msg: 'Chưa gán CT nào vào phía/pha của MBA.' }); return; }
    const cl = clashes();
    if (cl.length) { Notify.show({ type: 'error', title: 'Hai lõi cùng vào một cuộn', msg: cl[0].text }); return; }
    // mở thêm cuộn 5, 6 nếu cần
    let rebuilt = false;
    ['hv', 'mv'].forEach(side => {
      const need = Math.max(0, ...jobs.filter(j => j.ct.side === side && j.ct.phase !== 'N').map(j => j.c.w));
      if (need > +cfg.bctCores[side]) { cfg.bctCores[side] = Math.min(need, MAXCORE[side]); rebuilt = true; }
    });
    let nRatio = 0, nR = 0, nEx = 0;
    const skipped = [], pol = [];
    jobs.forEach(({ f, ct, c }) => {
      const side = ct.side, ph = ct.phase, cores = +cfg.bctCores[side], w = c.w;
      c.taps.forEach(t => {
        if (t.a !== 1 || (!t.ratio && !ok(t.r))) return;
        if (!hasRow(cores, w, t.b)) { skipped.push(`${ct.name} ${t.name}`); return; }
        const row = `w${w}s${t.b}`;
        if (t.ratio) {
          v[`bct.${side}.ratio.${row}.${ph}`] = numText(t.ratio.k, 3);
          v[`bct.${side}.ratio.${row}.${ph}e`] = ok(t.err) ? numText(t.err, 3) : '';
          nRatio++;
        }
        if (ok(t.r)) { v[`bct.${side}.dcr.${row}.${ph}`] = numText(t.r, 4); nR++; }
      });
      c.taps.forEach(t => { if (t.polarity) pol.push({ ok: /^correct$/i.test(t.polarity), name: `${ct.name} ${t.name}` }); });
      const ex = c.ex;
      if (ex && ex.picks.length) {
        const g = ph === 'N' ? 'bct.n.ex.N' : `bct.${side}.ex.${ph}`;
        if (w > (ph === 'N' ? EXMAX.n : EXMAX[side])) skipped.push(`${ct.name} lõi ${c.code} (từ hóa)`);
        else {
          [0, 1, 2, 3].forEach(k => {
            const p = ex.picks[k];
            v[`${g}.w${w}u.p${k + 1}`] = p ? p.v.toFixed(1) : '';
            v[`${g}.w${w}i.p${k + 1}`] = p ? (p.i * 1000).toFixed(3) : '';
          });
          if (!ex.picks[3]) { v[`${g}.w${w}u.p4`] = 'Không có'; v[`${g}.w${w}i.p4`] = '—'; } // máy không báo điểm khuỷu
          v[`${g}.src.w${w}`] = `${f.file} · CT ${ct.name} · ${ex.name} · ${ex.how}`;
          v[`${g}.tap.w${w}`] = ex.name + (ex.status === 'noknee' ? ' (mốc theo % U max)' : '');
          nEx++;
        }
      }
    });
    // cực tính: chỉ ghi khi ô còn trống
    if (pol.length && !String(v['bct.polarity'] ?? '').trim()) {
      const bad = pol.filter(p => !p.ok).map(p => p.name);
      v['bct.polarity'] = bad.length ? `Sai cực tính (MRCT): ${bad.join(', ')}` : 'Đúng cực tính (MRCT: Correct tất cả các cặp đầu ra)';
    }
    $('#mrctDialog').close();
    App.rebuild(rebuilt);
    Notify.show({ type: 'success', title: `Đã điền từ ${files.length} file MRCT`,
      msg: `${nRatio} tỷ số, ${nR} điện trở, ${nEx} đặc tính từ hóa.${rebuilt ? ` Đã mở thêm cuộn: HV ${cfg.bctCores.hv}, MV ${cfg.bctCores.mv}.` : ''}${skipped.length ? ` Không có ô trong BBTN: ${skipped.slice(0, 6).join('; ')}${skipped.length > 6 ? '…' : ''}.` : ''} Nhập nhiệt độ đo điện trở ở mục 11.` });
  }

  document.addEventListener('change', e => {
    const t = e.target;
    if (!t.dataset || !t.dataset.mrct) return;
    const ct = files[+t.dataset.f].cts[+t.dataset.t];
    if (t.dataset.mrct === 'side') { ct.side = t.value; ct.phase = ct.side ? PHASES[ct.side][0] : ''; ct.cores.forEach(c => { c.use = true; }); defaultRows(ct); render(); }
    if (t.dataset.mrct === 'phase') { ct.phase = t.value; ct.cores.forEach(c => { c.use = true; }); defaultRows(ct); render(); }
    if (t.dataset.mrct === 'use') { ct.cores[+t.dataset.c].use = t.checked; render(); }
    if (t.dataset.mrct === 'w') { ct.cores[+t.dataset.c].w = +t.value; render(); }
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-mrct]');
    if (!b || b.tagName !== 'BUTTON') return;
    if (b.dataset.mrct === 'cancel') $('#mrctDialog').close();
    if (b.dataset.mrct === 'apply') apply();
  });

  window.MrctImport = { open, guess, hasRow };
})();
