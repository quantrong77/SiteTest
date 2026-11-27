// MBA: hộp thoại nhập tgδ / điện dung sứ và cuộn dây từ file .txt máy Doble M4000 (mục 5, mục 7).
// Đọc bằng js/data/instruments/doble-m4000.js; đoán ô đích bằng MbaDoble.guess (js/domain/types/mba/doble-map.js).
// Người dùng xem từng phép đo, sửa ô đích hoặc bỏ chọn, rồi điền. tgδ = %PF đo (chưa hiệu chỉnh), app tự quy đổi về 20 °C.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ok = Number.isFinite;
  const fmt = (x, d) => (ok(x) ? String(Number(x.toFixed(d))).replace('.', ',') : '—');
  const GROUP = { winding: 'Cuộn dây', bushing: 'Sứ', noload: 'Kích từ / không tải', '': 'Khác' };
  let files = [], T = [];

  async function open(fileList) {
    files = [];
    for (const f of Array.from(fileList)) {
      try {
        // file M4000 mã hóa ANSI (°C = 0xB0): đọc latin1, chỉ cần chữ ASCII và số
        const parsed = DobleM4000.parse(new TextDecoder('windows-1252').decode(await f.arrayBuffer()), f.name);
        files.push(Object.assign(parsed, { items: MbaDoble.guess(parsed, App.schema, App.state.cfg) }));
      } catch (e) { Notify.show({ type: 'error', msg: e.message }); }
    }
    if (!files.length) return;
    T = MbaDoble.targets(App.schema);
    render();
    $('#dobleDialog').showModal();
  }

  const options = (it, fi, ii) => {
    const list = T.filter(t => !it.group || it.group === 'noload' || it.group === '' || t.kind === it.group);
    return `<select data-doble="target" data-f="${fi}" data-i="${ii}" aria-label="Ô đích của phép đo ${esc(it.no)}"><option value="">— Không điền</option>${list.map(t => `<option value="${esc(t.id)}" ${t.id === it.target ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select>`;
  };

  function render() {
    let h = `<div class="ad-body cpc"><h2 id="dobleTitle">Nhập tgδ, điện dung từ Doble M4000 (.txt)</h2>
      <p class="ad-lead">App đọc <b>%PF đo</b> (Meas. %PF, chưa hiệu chỉnh nhiệt độ — app tự quy đổi về 20 °C), <b>C (pF)</b>, U đo và sơ đồ đo; ghép theo đề mục pha / nhóm trong file:
      cuộn dây theo tên và sơ đồ đo (CH GAR → Cao~Vỏ, CHT UST → Hạ~Cao, CH+CHT GND → Cao~Hạ,Vỏ, CT GAR → Hạ~Vỏ, CT+CTH GND → Hạ~Cao,Vỏ, CH+CT GND → Cao,Hạ~Vỏ);
      sứ theo tên (500 → HV, 220 → MV, N → trung tính, 35.1 / 35.2 → hạ áp) và C1 / C2. Đo lặp cùng một ô: dùng lần sau cùng. Kiểm tra cột “Ô đích” trước khi điền.</p>`;
    files.forEach((f, fi) => {
      const m = f.meta;
      h += `<section class="cpc-file"><div class="cpc-file-head"><b>${esc(m.file)}</b><span>${esc([m.equipment, m.location, m.date && `${m.date} ${m.time || ''}`, m.oilT && `dầu ${m.oilT} °C`].filter(Boolean).join(' · '))}</span></div>
        <table class="ftable cpc-tbl doble-tbl"><thead><tr><th></th><th>TT</th><th>Nhóm · pha</th><th>Phép đo</th><th>Sơ đồ</th><th>kV</th><th>%PF đo</th><th>C (pF)</th><th>Ô đích</th><th>Ghi chú</th></tr></thead><tbody>`;
      f.items.forEach((it, ii) => {
        h += `<tr class="${it.use ? '' : 'off'}"><td><input type="checkbox" data-doble="use" data-f="${fi}" data-i="${ii}" ${it.use ? 'checked' : ''} ${it.target ? '' : 'disabled'} aria-label="Điền phép đo ${esc(it.no)}"></td>
          <td>${esc(it.no)}</td><td>${esc(GROUP[it.group] || it.group)}${it.phase ? ` · ${esc(it.phase)}` : ''}</td><td>${esc(it.label)}</td><td>${esc(it.mode)}</td>
          <td class="num">${fmt(it.kv, 3)}</td><td class="num">${fmt(it.pf, 3)}</td><td class="num">${ok(it.cap) ? fmt(it.cap, 2) : esc(ok(it.ind) ? `${fmt(it.ind, 3)} H` : '—')}</td>
          <td>${options(it, fi, ii)}</td><td class="note">${esc(it.note)}</td></tr>`;
      });
      h += '</tbody></table></section>';
    });
    const cl = files.flatMap(f => MbaDoble.clashes(f.items)).concat(clashAcross());
    if (cl.length) h += `<div class="callout warn" role="alert"><b>Trùng ô:</b> ${cl.slice(0, 6).map(([a, b]) => `TT ${esc(a.no)} và TT ${esc(b.no)}`).join('; ')} cùng vào một ô. Bỏ chọn hoặc đổi ô đích.</div>`;
    h += `<div class="row-actions" style="justify-content:flex-end"><button class="btn" data-doble="cancel">Hủy</button><button class="btn primary" data-doble="apply">Điền vào biểu mẫu</button></div></div>`;
    const old = $('#doblePanel .ad-body'), top = old ? old.scrollTop : 0;
    $('#doblePanel').innerHTML = h;
    const body = $('#doblePanel .ad-body');
    if (body) body.scrollTop = top;
  }
  // nhiều file: cùng một ô ở hai file khác nhau
  function clashAcross() {
    if (files.length < 2) return [];
    return MbaDoble.clashes(files.flatMap(f => f.items)).filter(([a, b]) => !files.some(f => f.items.includes(a) && f.items.includes(b)));
  }

  const apply = () => App.track('Nhập tgδ Doble M4000', doApply);
  function doApply() {
    const all = files.flatMap(f => f.items);
    const cl = MbaDoble.clashes(all);
    if (cl.length) { Notify.show({ type: 'error', title: 'Hai phép đo cùng vào một ô', msg: `TT ${cl[0][0].no} và TT ${cl[0][1].no}` }); return; }
    const { v, n } = MbaDoble.writes(all);
    if (!n) { Notify.show({ type: 'error', msg: 'Chưa chọn phép đo nào để điền.' }); return; }
    const temps = Object.assign({}, ...files.map(f => MbaDoble.tempWrites(f, App.schema, f.items, App.state)));
    Object.assign(App.state.v, v, temps);
    $('#dobleDialog').close();
    App.rebuild(false);
    const nw = all.filter(it => it.use && /^w\|/.test(it.target)).length, nb = n - nw;
    Notify.show({ type: 'success', title: `Đã điền từ ${files.length} file Doble`,
      msg: `${nw} phép đo cuộn dây, ${nb} phép đo sứ (tgδ, C, U đo, sơ đồ đo).${Object.keys(temps).length ? ` Nhiệt độ dầu ${files[0].meta.oilT} °C ghi vào ${Object.keys(temps).length} ô nhiệt độ còn trống.` : ''}` });
  }

  document.addEventListener('change', e => {
    const t = e.target;
    if (!t.dataset || !t.dataset.doble) return;
    const it = files[+t.dataset.f].items[+t.dataset.i];
    if (t.dataset.doble === 'use') it.use = t.checked;
    if (t.dataset.doble === 'target') { it.target = t.value; it.use = !!t.value; }
    render();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-doble]');
    if (!b || b.tagName !== 'BUTTON') return;
    if (b.dataset.doble === 'cancel') $('#dobleDialog').close();
    if (b.dataset.doble === 'apply') apply();
  });

  window.DobleImport = { open };
})();
