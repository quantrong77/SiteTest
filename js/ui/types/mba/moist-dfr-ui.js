// MBA, mục độ ẩm cách điện rắn: nạp CSV DIRANA đo cách điện cuộn dây (CHL / CLT / CHT), chọn cách điện và pha,
// xem trước đồ thị tgδ theo tần số; đồ thị đính kèm phụ lục BBTN (DfrW.appendix). Lõi giao diện gọi qua TypeUI.MBA.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const items = A => (((A.state.att || {}).dfrw || {}).items) || [];
  const chartOpts = m => ({ title: DfrW.title(m), logY: true, fAuto: true });

  function html(A) {
    const esc = A.esc, list = items(A), dec = A.state.cfg.decSep === '.' ? '.' : ',';
    const num = (x, d) => (Number.isFinite(x) ? x.toFixed(d).replace('.', dec) : '—');
    let h = `<h3>Đáp ứng tần số điện môi cách điện cuộn dây (phụ lục BBTN)</h3>
      <div class="hint-text">Nạp file CSV DIRANA (cả bản 4.x). MBA 3 cuộn dây: <b>CHL</b>, <b>CLT</b>; MBA tự ngẫu (tổ 3 máy 1 pha rời, 3 pha chung vỏ): <b>CHT</b>.
      Có phép đo nào thì vẽ đồ thị phép đo đó, ghi rõ pha; nhiều pha thì thêm đồ thị xếp chồng để so sánh. Bảng tại tần số con trỏ <b>50 Hz</b>:
      tgδ, C, |Z| đọc trên đường đo; <b>độ ẩm</b> và <b>độ dẫn dầu</b> là kết quả phân tích của phần mềm DIRANA (file CSV không có) — nhập tay, độ ẩm ghi chung với ô độ ẩm của mục; phân loại theo Điều 28.</div>
      <div class="row-actions"><button class="btn" data-act="moistDfrFiles">Nạp file .csv…</button><button class="btn" data-act="moistDfrFolder">Nạp cả thư mục…</button>${list.length ? '<button class="btn small danger" data-act="moistDfrClear">Bỏ các phép đo DFR cuộn dây</button>' : ''}</div>`;
    if (!list.length) return h + '<p class="hint-text">Chưa nạp phép đo.</p>';
    const sorted = list.slice().sort((a, b) => (DfrW.INS.indexOf(a.ins) + 1 || 9) - (DfrW.INS.indexOf(b.ins) + 1 || 9) || String(a.phase).localeCompare(String(b.phase)) || String(a.date).localeCompare(String(b.date)));
    h += `<div class="ftable-wrap mdfr-table"><table class="ftable"><thead><tr><th>Phép đo</th><th>Ngày đo</th><th>Nhiệt độ (°C)</th><th>Cách điện</th><th>Pha</th><th>Độ ẩm (%)</th><th>Phân loại</th><th>Độ dẫn dầu (pS/m)</th><th>tgδ 50 Hz (%)</th><th>C 50 Hz (nF)</th><th>|Z| 50 Hz (kΩ)</th><th>Dùng</th><th></th></tr></thead><tbody>${sorted.map(m => {
      const id = esc(m.id), v = DfrW.cursor(m, 50), mk = DfrW.moistKey(A.state.cfg, m.phase), mo = DfrW.moisture(A.state, m);
      return `<tr><td>${esc(m.name)}<br><span class="hint-text">${esc(m.file || '')}</span></td><td>${esc(m.date || '')}</td><td>${esc(String(m.temp || '—').replace('.', dec))}</td>
        <td><select aria-label="Cách điện của ${esc(m.name)}" data-mdfr="ins" data-id="${id}"><option value="">—</option>${DfrW.INS.map(x => `<option value="${x}" ${m.ins === x ? 'selected' : ''}>${esc(DfrW.INS_TEXT[x])}</option>`).join('')}</select></td>
        <td><select aria-label="Pha của ${esc(m.name)}" data-mdfr="phase" data-id="${id}"><option value="" ${!m.phase ? 'selected' : ''}>3 pha</option>${DfrW.PHASES.map(x => `<option value="${x}" ${m.phase === x ? 'selected' : ''}>Pha ${x}</option>`).join('')}</select></td>
        <td><input class="mdfr-num" inputmode="decimal" aria-label="Độ ẩm ${esc(DfrW.title(m))} (%)" data-mdfr-moist="${esc(mk)}" value="${esc(A.state.v[mk] ?? '')}"></td>
        <td>${esc(DfrW.category(mo) || '—')}</td>
        <td><input class="mdfr-num" inputmode="decimal" aria-label="Độ dẫn dầu ${esc(DfrW.title(m))} (pS/m)" data-mdfr="oilCond" data-id="${id}" value="${esc(m.oilCond || '')}"></td>
        <td>${v ? num(v.tan, 3) : '—'}</td><td>${v ? num(v.cNF, 2) : '—'}</td><td>${v ? num(v.zK, 1) : '—'}</td>
        <td><input type="checkbox" aria-label="Dùng phép đo ${esc(m.name)}" data-mdfr="use" data-id="${id}" ${m.use ? 'checked' : ''} ${m.ins ? '' : 'disabled'}></td>
        <td><button class="btn small danger" data-act="moistDfrDel" data-id="${id}" aria-label="Xóa phép đo ${esc(m.name)}">×</button></td></tr>`;
    }).join('')}</tbody></table></div>`;
    const ms = DfrW.chosen(list);
    if (list.some(m => !m.ins)) h += '<div class="callout warn">Có phép đo chưa nhận ra loại cách điện (tên không chứa CHL / CLT / CHT) — chọn ở cột “Cách điện” thì mới vẽ đồ thị và đưa vào phụ lục.</div>';
    // xếp chồng các pha (cùng cách điện, từ 2 pha) để so sánh, đặt trước đồ thị riêng
    const over = DfrW.INS.filter(ins => ms.filter(m => m.ins === ins && m.phase).length > 1);
    if (over.length) h += `<div class="dfr-preview">${over.map(ins => `<div><b>${ins} – xếp chồng các pha</b><canvas data-mdfr-overlay="${ins}" aria-label="Đồ thị DFR ${ins} xếp chồng các pha"></canvas></div>`).join('')}</div>`;
    if (ms.length) h += `<div class="dfr-preview compact">${ms.map(m => `<div><b>${esc(DfrW.title(m))}</b><canvas data-mdfr-preview="${esc(m.id)}" aria-label="Đồ thị DFR ${esc(DfrW.title(m))}"></canvas></div>`).join('')}</div>`;
    return h;
  }

  function afterRender(A) {
    const list = items(A);
    document.querySelectorAll('[data-mdfr-preview]').forEach(cv => {
      const m = list.find(x => x.id === cv.dataset.mdfrPreview);
      if (m) DfrChart.draw(cv, [m], false, chartOpts(m));
    });
    const ms = DfrW.chosen(list);
    document.querySelectorAll('[data-mdfr-overlay]').forEach(cv => {
      const xs = ms.filter(m => m.ins === cv.dataset.mdfrOverlay && m.phase);
      DfrChart.draw(cv, xs, true, { title: `${cv.dataset.mdfrOverlay} – ${xs.length} pha`, logY: true, fAuto: true });
    });
  }

  // Ảnh đồ thị cho phụ lục: mỗi phép đo một đồ thị (2 đồ thị/hàng); cùng cách điện từ 2 pha trở lên thì thêm đồ thị xếp chồng
  async function charts(A) {
    const ms = DfrW.chosen(items(A)), out = {};
    for (const ins of DfrW.INS) {
      const xs = ms.filter(m => m.ins === ins);
      if (!xs.length) continue;
      const individual = [];
      for (const m of xs) individual.push(Object.assign(await DfrChart.png([m], false, chartOpts(m)), { caption: m.date ? `Đo ${m.date}` : '', perRow: 2 }));
      const phased = xs.filter(m => m.phase);
      const overlay = phased.length > 1 ? Object.assign(await DfrChart.png(phased, true, { title: `${ins} – ${phased.length} pha`, logY: true, fAuto: true }), { caption: '' }) : null;
      out[ins] = { individual, overlay };
    }
    return out;
  }

  async function load(files, A) {
    const st = A.state, att = st.att || (st.att = {}), before = (att.dfrw && att.dfrw.items) || [];
    const parsed = [], errors = [];
    for (const file of files.filter(f => /\.csv$/i.test(f.name))) {
      try { Dirana.parse(await file.text(), file.name).forEach(m => parsed.push(m)); } catch (e) {
        if (!/không phải CSV DIRANA/.test(e.message || '')) errors.push(e.message);
      }
    }
    if (!parsed.length) return A.toast(errors.length ? errors.join('\n') : 'Không tìm thấy phép đo DIRANA trong các file đã chọn.', true);
    const newId = () => `dfrw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    att.dfrw = { items: DfrW.merge(before, parsed, newId, st.cfg) };
    A.persist(); A.renderMain();
    const unknown = att.dfrw.items.filter(m => !m.ins).length;
    A.toast(`Đã nạp ${parsed.length} phép đo DFR cuộn dây từ ${new Set(parsed.map(m => m.file)).size} file${unknown ? ` — ${unknown} phép đo cần chọn loại cách điện` : ''}`);
    if (errors.length) A.toast(errors.join('\n'), true);
  }

  const actions = {
    moistDfrFiles: () => $('#fileDiranaW').click(),
    moistDfrFolder: () => $('#diranaWFolder').click(),
    moistDfrDel(b, A) {
      const att = A.state.att || {};
      if (!att.dfrw) return;
      att.dfrw.items = att.dfrw.items.filter(m => m.id !== b.dataset.id);
      if (!att.dfrw.items.length) delete att.dfrw;
      A.persist(); A.renderMain();
    },
    moistDfrClear(b, A) {
      if (!confirm('Bỏ các phép đo DFR cuộn dây khỏi biên bản? Đồ thị sẽ không còn trong phụ lục BBTN.')) return;
      delete A.state.att.dfrw;
      A.persist(); A.renderMain(); A.toast('Đã bỏ các phép đo DFR cuộn dây');
    },
  };

  function init(A) {
    ['fileDiranaW', 'diranaWFolder'].forEach(id => $('#' + id).addEventListener('change', async e => {
      const fl = Array.from(e.target.files || []); e.target.value = '';
      if (fl.length) await load(fl, A);
    }));
    document.addEventListener('change', e => {
      const el = e.target;
      // ô độ ẩm trong bảng ghi chung với ô độ ẩm của mục (đánh giá Điều 28, BBTN)
      if (el.dataset && el.dataset.mdfrMoist) {
        A.state.v[el.dataset.mdfrMoist] = el.value.trim();
        A.recompute(); A.persist(); A.renderMain();
        return;
      }
      const k = el.dataset && el.dataset.mdfr;
      if (!k) return;
      const list = items(A), m = list.find(x => x.id === el.dataset.id);
      if (!m) return;
      if (k === 'use') {
        m.use = el.checked;
        list.forEach(x => { if (x.ins === m.ins && x.phase === m.phase) { x.useManual = true; if (m.use && x !== m) x.use = false; } });
      } else if (k === 'oilCond') {
        m.oilCond = el.value.trim();
      } else {
        m[k] = el.value; m[k + 'Manual'] = true;
        if (!m.ins) m.use = false;
        // đổi cách điện / pha: nhóm mới chưa có phép đo dùng thì dùng phép đo này
        else if (!list.some(x => x !== m && x.use && x.ins === m.ins && x.phase === m.phase)) m.use = true;
        else if (m.use) m.use = false;
      }
      A.persist(); A.renderMain();
    });
  }

  window.MoistDfrUI = { html, afterRender, charts, load, actions, init };
})();
