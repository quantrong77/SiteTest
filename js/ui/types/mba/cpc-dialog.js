// MBA: hộp thoại nhập đặc tính từ hóa biến dòng chân sứ từ file XML CPC 100 (mục 11).
// Đọc file bằng bộ đọc js/data/instruments/cpc100.js, cho chọn phía/pha/cuộn rồi điền vào lưới bct.*.ex.*.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ok = Number.isFinite;
  const fmt = (x, d) => (ok(x) ? x.toFixed(d).replace('.', ',') : '—');
  const { parse, assignSides } = Cpc100;

  const SIDES = { hv: 'Cao áp (HV)', mv: 'Trung áp (MV)', n: 'Trung tính (N)', lv: 'Hạ áp (LV)' };
  const PHASES = { hv: ['A', 'B', 'C'], mv: ['A', 'B', 'C'], n: ['N'], lv: ['a', 'b', 'c'] };
  const MAXCORE = { hv: 6, mv: 5, n: 3, lv: 4 }; // số cuộn tối đa template hỗ trợ
  let files = [];
  let locked = null; // { side, phase } khi tải XML cho một ô pha cụ thể

  function open(fileList, target) {
    locked = target || null;
    const jobs = Array.from(fileList).map(f => f.text().then(t => parse(t, f.name)).catch(e => ({ error: e.message, file: f.name })));
    Promise.all(jobs).then(list => {
      files = list.filter(x => !x.error);
      list.filter(x => x.error).forEach(x => Notify.show({ type: 'error', msg: x.error }));
      if (!files.length) return;
      assignSides(files);
      if (locked) files.forEach(f => { f.side = locked.side; f.phase = locked.phase; });
      files.forEach(f => f.cards.forEach(c => { c.use = c.status !== 'empty' && c.core <= MAXCORE[f.side]; }));
      render();
      $('#cpcDialog').showModal();
    });
  }

  function render() {
    let h = `<div class="ad-body cpc"><h2 id="cpcTitle">Nhập đặc tính từ hóa từ CPC 100</h2>
      <p class="ad-lead">Mỗi cuộn lấy <b>mốc 25 %, 50 %, 75 %</b> và <b>điểm khuỷu</b> (IEC 61869-2: +10 % áp → +50 % dòng). Có khuỷu thì mốc tính theo % U<sub>k</sub>; không xác định được khuỷu thì theo % U lớn nhất đã đo.${locked ? '' : ' Kiểm tra phía và pha của từng file trước khi điền.'}</p>`;
    files.forEach((f, fi) => {
      h += `<section class="cpc-file"><div class="cpc-file-head"><b>${esc(f.file)}</b><span>${esc(f.date)}</span>
        <label>Phía <select data-cpc="side" data-f="${fi}" ${locked ? 'disabled' : ''}>${Object.entries(SIDES).map(([k, t]) => `<option value="${k}" ${k === f.side ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>Pha <select data-cpc="phase" data-f="${fi}" ${locked ? 'disabled' : ''}>${PHASES[f.side].map(p => `<option ${p === f.phase ? 'selected' : ''}>${p}</option>`).join('')}</select></label></div>
        <table class="ftable cpc-tbl"><thead><tr><th></th><th>Cuộn</th><th>Mốc 25 %</th><th>Mốc 50 %</th><th>Mốc 75 %</th><th>Khuỷu (U<sub>k</sub>, I<sub>k</sub>)</th><th>Ghi chú</th></tr></thead><tbody>`;
      f.cards.forEach((c, ci) => {
        const over = c.core > MAXCORE[f.side];
        const pt = p => (p ? `${fmt(p.v, 1)} V<br><span>${fmt(p.i * 1000, 3)} mA</span>` : '—');
        h += `<tr class="${c.status === 'empty' ? 'muted' : ''}"><td><input type="checkbox" data-cpc="use" data-f="${fi}" data-c="${ci}" ${c.use ? 'checked' : ''} ${c.status === 'empty' || over ? 'disabled' : ''} aria-label="Điền cuộn ${esc(c.name)}"></td>
          <td><b>${esc(c.name)}</b><br><span>${c.points.length} điểm</span></td>
          <td class="num">${pt(c.picks[0])}</td><td class="num">${pt(c.picks[1])}</td><td class="num">${pt(c.picks[2])}</td><td class="num knee">${pt(c.picks[3])}</td>
          <td class="note">${over ? `Template phía này chỉ có ${MAXCORE[f.side]} cuộn` : esc(c.how)}${c.status === 'app' ? ' <span class="badge st-warn">kiểm tra</span>' : ''}</td></tr>`;
      });
      h += '</tbody></table></section>';
    });
    h += `<div class="row-actions" style="justify-content:flex-end"><button class="btn" data-cpc="cancel">Hủy</button><button class="btn primary" data-cpc="apply">Điền vào biểu mẫu</button></div></div>`;
    $('#cpcPanel').innerHTML = h;
  }

  const apply = () => App.track('Nhập XML CPC 100', doApply);
  function doApply() {
    const st = App.state, need = {};
    const filled = [];
    files.forEach(f => f.cards.forEach(c => {
      if (!c.use || !c.picks.length) return;
      if (f.side === 'hv' || f.side === 'mv') need[f.side] = Math.max(need[f.side] || 0, c.core);
    }));
    // Hiện thêm cuộn 5, 6 nếu file có
    let rebuilt = false;
    ['hv', 'mv'].forEach(side => {
      const cur = +st.cfg.bctCores[side];
      if (need[side] > cur) { st.cfg.bctCores[side] = Math.min(need[side], MAXCORE[side]); rebuilt = true; }
    });
    files.forEach(f => f.cards.forEach(c => {
      if (!c.use || !c.picks.length) return;
      const g = f.side === 'n' ? 'bct.n.ex.N' : `bct.${f.side}.ex.${f.phase}`;
      [0, 1, 2, 3].forEach(k => { // xóa giá trị cũ (vd cột khuỷu khi lần này không xác định được khuỷu)
        const p = c.picks[k];
        st.v[`${g}.w${c.core}u.p${k + 1}`] = p ? p.v.toFixed(1) : '';
        st.v[`${g}.w${c.core}i.p${k + 1}`] = p ? (p.i * 1000).toFixed(3) : '';
      });
      st.v[`${g}.src.w${c.core}`] = `${f.file} · ${c.name} · ${c.how}`;
      // đầu cuộn thực đo ghi vào ô nhãn BBTN; cuộn không xác định được khuỷu ghi rõ mốc theo % U max
      st.v[`${g}.tap.w${c.core}`] = c.name + (c.status === 'noknee' ? ' (mốc theo % U max)' : '');
      filled.push(`${SIDES[f.side]} ${f.phase} · ${c.name}`);
    }));
    $('#cpcDialog').close();
    App.rebuild(rebuilt);
    Notify.show({ type: 'success', title: `Đã điền ${filled.length} cuộn từ ${files.length} file CPC 100`,
      msg: rebuilt ? `Đã mở thêm cuộn thứ cấp: HV ${st.cfg.bctCores.hv}, MV ${st.cfg.bctCores.mv}.` : 'Xem lại các ô đặc tính từ hóa trong mục 11.' });
  }

  document.addEventListener('change', e => {
    const t = e.target;
    if (!t.dataset || !t.dataset.cpc) return;
    const f = files[+t.dataset.f];
    if (t.dataset.cpc === 'side') { f.side = t.value; f.phase = PHASES[f.side][0]; f.cards.forEach(c => { c.use = c.status !== 'empty' && c.core <= MAXCORE[f.side]; }); render(); }
    if (t.dataset.cpc === 'phase') f.phase = t.value;
    if (t.dataset.cpc === 'use') f.cards[+t.dataset.c].use = t.checked;
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-cpc]');
    if (!b || b.tagName !== 'BUTTON') return;
    if (b.dataset.cpc === 'cancel') $('#cpcDialog').close();
    if (b.dataset.cpc === 'apply') apply();
  });

  window.CpcImport = { open };
})();
