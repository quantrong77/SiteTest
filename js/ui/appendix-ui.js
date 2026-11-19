// Trang phụ lục BBTN: quản lý đồ thị OLTC, báo cáo SFRA và phép đo DFR.
// Trang "Phụ lục BBTN": chụp sóng OLTC và báo cáo SFRA — mở SFRA Analyzer để phân tích, tải báo cáo Word
// về rồi nạp vào đây; khi xuất BBTN báo cáo được nối nguyên văn thành phụ lục. File báo cáo giữ trong kho file của
// trình duyệt (FileStore), đi kèm file .json khi lưu và lên Storage khi lưu CSDL.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  let opened = { id: null, doc: null }; // báo cáo SFRA đã mở (DocxTemplate)

  const kb = n => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} kB`);
  const when = iso => { const d = new Date(iso); return Number.isNaN(+d) ? '' : d.toLocaleString('vi-VN'); };
  const storagePath = (st, id) => `${st.v['meta.serial'] || 'MBA'}/${st.db.sessionId}/appendix/${id}.docx`;

  function shortCircuitHTML(A) {
    const st = A.state, esc = A.esc;
    const rows = st.att && st.att.shortCircuit && st.att.shortCircuit.rows || [];
    const results = Appendix.shortCircuitResults(st, A.FX);
    const layout = st.cfg.template === 'custom' ? st.cfg.layout : st.cfg.template || '1P';
    const is3Phase = ['3P', '110'].includes(layout);
    const number = (row, key, label) => `<div class="field"><label>${label}</label><input type="text" inputmode="decimal" data-sc-field="${key}" data-id="${esc(row.id)}" aria-label="${label}" value="${esc(row[key] ?? '')}"></div>`;
    const text = (row, key, label) => `<div class="field"><label>${label}</label><input type="text" data-sc-field="${key}" data-id="${esc(row.id)}" aria-label="${label}" value="${esc(row[key] ?? '')}"></div>`;
    const cards = rows.map((row, i) => {
      const result = results[i] || {};
      return `<div class="appx-file"><div class="appx-file-head"><b>Phép đo ${i + 1} · ${esc(row.pair || 'chưa chọn cặp cuộn')} · nấc ${esc(row.tap || '—')}</b><span class="spacer"></span><button class="btn small danger" data-act="appxScDel" data-id="${esc(row.id)}" aria-label="Xóa phép đo ${i + 1}">×</button></div>
      <div class="fields">
        <div class="field"><label>Cặp cuộn dây</label><select data-sc-field="pair" data-id="${esc(row.id)}" aria-label="Cặp cuộn dây phép đo ${i + 1}">${Appendix.shortCircuitPairs.map(x => `<option value="${x}" ${row.pair === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        ${text(row, 'tap', 'Nấc phân áp')}
        ${is3Phase ? `<div class="field"><label>Pha</label><select data-sc-field="phase" data-id="${esc(row.id)}" aria-label="Pha phép đo ${i + 1}"><option value="">Không áp dụng / tổng 3 pha</option>${['A', 'B', 'C'].map(x => `<option value="${x}" ${row.phase === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>` : ''}
        <div class="field"><label>Trường hợp</label><select data-sc-field="testCase" data-id="${esc(row.id)}" aria-label="Trường hợp thí nghiệm"><option value="new" ${result.testCase === 'new' ? 'selected' : ''}>Sau lắp đặt mới</option><option value="overhaul" ${result.testCase === 'overhaul' ? 'selected' : ''}>Sau đại tu</option><option value="operation" ${result.testCase === 'operation' ? 'selected' : ''}>Trong vận hành</option></select></div>
        <div class="field"><label>Vị trí nấc</label><select data-sc-field="tapRole" data-id="${esc(row.id)}" aria-label="Vị trí nấc"><option value="main" ${result.tapRole === 'main' ? 'selected' : ''}>Nấc chính</option><option value="other" ${result.tapRole === 'other' ? 'selected' : ''}>Nấc khác</option></select></div>
        ${number(row, 'tempC', 'Nhiệt độ đo (°C)')}${number(row, 'frequencyHz', 'Tần số đo (Hz)')}${number(row, 'ratedFrequencyHz', 'Tần số định mức (Hz)')}
        ${number(row, 'ratedVoltageKV', 'Điện áp định mức Un (kV)')}${number(row, 'ratedCurrentA', 'Dòng điện định mức In (A)')}
        <div class="field"><label>Điện áp thử U</label><input type="text" inputmode="decimal" list="scVoltageChoices" data-sc-field="testVoltage" data-id="${esc(row.id)}" aria-label="Điện áp thử U" value="${esc(row.testVoltage ?? row.testVoltageKV ?? '')}"></div>
        <div class="field"><label>Đơn vị U thử</label><select data-sc-field="testVoltageUnit" data-id="${esc(row.id)}" aria-label="Đơn vị điện áp thử"><option value="V" ${(row.testVoltageUnit || (row.testVoltageKV !== undefined ? 'kV' : 'V')) === 'V' ? 'selected' : ''}>V</option><option value="kV" ${(row.testVoltageUnit || (row.testVoltageKV !== undefined ? 'kV' : 'V')) === 'kV' ? 'selected' : ''}>kV</option></select></div>
        ${number(row, 'testCurrentA', 'Dòng điện đo I (A)')}${number(row, 'powerKw', 'Công suất đo P (kW)')}${number(row, 'copperLossKw', 'Thành phần PI²R (kW)')}
        <div class="field"><label>Vật liệu dây dẫn</label><select data-sc-field="tempFactor" data-id="${esc(row.id)}" aria-label="Vật liệu dây dẫn"><option value="">Chưa xác định</option><option value="235" ${String(row.tempFactor) === '235' ? 'selected' : ''}>Đồng (K = 235)</option><option value="225" ${String(row.tempFactor) === '225' ? 'selected' : ''}>Nhôm (K = 225)</option></select></div>
        ${number(row, 'reportTempC', 'Nhiệt độ Pk Test Report (°C)')}
        ${result.testCase === 'new' ? number(row, 'nameplateUkPct', 'Uk nhãn máy (%)') : number(row, 'initialUkPct', 'Uk ban đầu (%)')}
      </div></div>`;
    }).join('');
    return `<section class="appx-card"><div class="appx-head"><h3>Số liệu thí nghiệm ngắn mạch</h3>${rows.length ? `<span class="badge st-info">${rows.length} phép đo</span>` : '<span class="badge st-none">Chưa có số liệu</span>'}</div>
      <p>Test Report đang dùng: ${esc(A.FX && A.FX.data.fileName || 'chưa nạp')}. Nhập điện áp thử theo V hoặc kV; có thể nhập 67 V, 220 V, 380 V hoặc giá trị khác. App quy đổi kết quả về Un và In.</p>
      <div class="row-actions"><button class="btn primary" data-act="appxScAdd">Thêm phép đo</button>${rows.length ? '<button class="btn small danger" data-act="appxScClear">Xóa toàn bộ phép đo</button>' : ''}</div>
      ${cards || '<p>Thêm phép đo để nhập cặp cuộn dây, nấc, pha và thông số đo.</p>'}
      <datalist id="scVoltageChoices"><option value="67"></option><option value="220"></option><option value="380"></option></datalist>
      <p class="hint-text">Ghi cặp cuộn dây, nấc, pha, nhiệt độ, tần số, U, I và P. Khai báo PI²R và vật liệu dây dẫn nếu cần quy đổi Pk theo nhiệt độ Test Report. Kết quả so sánh nằm trong tab Đánh giá.</p></section>`;
  }

  function render(A) {
    const st = A.state, esc = A.esc, att = st.att || {}, fra = att.fra, oils = att.oil && att.oil.items || [], osc = att.oltc || {};
    const labels = Object.fromEntries(Appendix.list(st).map(a => [a.kind, a.label]));
    const oilLabels = Object.fromEntries(Appendix.list(st).filter(a => a.kind === 'oil').map(a => [a.id, a.label]));
    const phases = Object.keys(osc).sort();
    let h = '<div class="panel-head"><span class="secno">PL</span><h2>Phụ lục BBTN</h2><span class="en">Appendices</span></div>';
    h += '<p class="hint-text">Khi xuất BBTN .docx, các phụ lục dưới đây được nối sau biên bản; mỗi phụ lục bắt đầu trang mới và đánh số trang riêng.</p>';

    h += `<section class="appx-card"><div class="appx-head"><h3>Chụp sóng OLTC</h3>${labels.oltc ? `<span class="badge st-pass">${labels.oltc}</span>` : '<span class="badge st-none">Chưa có</span>'}</div>`
      + (phases.length
        ? `<p>${phases.map(ph => `Pha ${ph}: ${osc[ph].rows.length || osc[ph].waves.length} lần chuyển nấc`).join(' · ')}. Bảng số liệu và đồ thị dựng từ file Haefely 2293.</p>`
        : '<p>Nhập file .csv và .bin của Haefely 2293 ở hạng mục OLTC để có phụ lục chụp sóng.</p>')
      + '<div class="row-actions"><button class="btn" data-nav="oltc">Mở hạng mục OLTC</button></div></section>';

    h += `<section class="appx-card"><div class="appx-head"><h3>Đáp ứng tần số quét (SFRA)</h3>${fra ? `<span class="badge st-pass">${labels.fra}</span>` : '<span class="badge st-none">Chưa có</span>'}</div>
      <ol class="appx-steps">
        <li><div><b>Phân tích trên SFRA Analyzer.</b> Nạp file đo baseline và lần đo (.frax, .sfra, .csv), bấm <i>Xác nhận và tính</i>, rồi ở mục <i>Báo cáo</i> tải báo cáo Word (.docx). Số liệu đo được xử lý ngay trong trình duyệt, không tải lên máy chủ.</div>
          <a class="btn primary" href="${Appendix.SFRA_URL}" target="_blank" rel="noopener">Mở SFRA Analyzer</a></li>
        <li><div><b>Nạp báo cáo vào BBTN.</b> Chọn file .docx vừa tải; nội dung báo cáo (bảng tổng hợp, giản đồ Bode, kết luận) được nối nguyên văn thành phụ lục.</div>
          <button class="btn${fra ? '' : ' primary'}" data-act="appxLoadFra">${fra ? 'Thay báo cáo SFRA…' : 'Nạp báo cáo SFRA (.docx)…'}</button></li>
      </ol>`;
    if (fra) {
      h += `<div class="appx-file"><div class="appx-file-head"><b>${esc(fra.name)}</b><span>${kb(fra.size)} · nạp lúc ${esc(when(fra.importedAt))}</span><span data-frafile class="badge st-none">Đang kiểm tra file…</span>
          <span class="spacer"></span><button class="btn small danger" data-act="appxDelFra">Bỏ phụ lục SFRA</button></div>
        <dl class="kv"><dt>Tiêu đề báo cáo</dt><dd>${esc(fra.title || '—')}</dd><dt>Số phép đo</dt><dd>${fra.measurements || '—'}</dd>
        <dt>Kết luận</dt><dd>${fra.conclusion && fra.conclusion.length ? fra.conclusion.map(esc).join('<br>') : '—'}</dd></dl></div>`;
    }
    h += '</section>';
    const serials = [...new Set([st.v['meta.serial'], ...Object.values(st.cfg.ps || {})].filter(Boolean))].join(' / ');
    h += `<section class="appx-card" id="appx-oil"><div class="appx-head"><h3>Dầu MBA — DGA và lý hóa dầu</h3></div>
      <ol class="appx-steps"><li><div><b>Mở app DGA.</b> Chọn thiết bị theo số chế tạo, nhập và đánh giá kết quả, sau đó xuất BBTN .docx.</div>
        <div class="row-actions"><a class="btn primary" href="${Appendix.dgaLink(st.v['meta.serial'])}" target="_blank" rel="noopener">Mở app DGA</a><button class="btn" data-act="appxOilCopy">Chép số chế tạo</button></div></li>
        <li><div><b>Nạp BBTN dầu.</b> Có thể chọn nhiều file DGA và lý hóa dầu; các file được nối nguyên văn thành phụ lục riêng.</div><button class="btn${oils.length ? '' : ' primary'}" data-act="appxOilLoad">Nạp BBTN dầu (.docx)…</button></li></ol>
      ${oils.length ? `<div class="ftable-wrap"><table class="ftable"><thead><tr><th>Tên file</th><th>Loại</th><th>Số chế tạo</th><th>Ngày lấy mẫu</th><th>Kết luận</th><th>Nối vào BBTN</th><th>Phụ lục</th><th></th></tr></thead><tbody>${oils.map(x => `<tr><td><span data-oilfile="${esc(x.id)}" class="badge st-none">Đang kiểm tra file…</span><br>${esc(x.name)}</td><td>${x.kind === 'dga' ? 'DGA' : x.kind === 'oil' ? 'Lý hóa dầu' : 'Không nhận dạng'}</td><td>${esc(x.serial || '—')}</td><td>${esc(x.sampleDate || '—')}</td><td>${esc((x.conclusion || []).join(' ') || '—')}</td><td><input type="checkbox" aria-label="Nối ${esc(x.name)} vào BBTN" data-oil-use="${esc(x.id)}" ${x.use !== false ? 'checked' : ''}></td><td>${oilLabels[x.id] ? `<span class="badge st-pass">${oilLabels[x.id]}</span>` : '—'}</td><td><button class="btn small danger" data-act="appxOilDel" data-id="${esc(x.id)}">Bỏ</button></td></tr>`).join('')}</tbody></table></div>` : '<p>Chưa nạp BBTN dầu.</p>'}</section>`;
    const dfr = att.dfr && att.dfr.items || [];
    h += `<section class="appx-card"><div class="appx-head"><h3>Đáp ứng tần số điện môi sứ đầu vào (DFR)</h3>${labels.dfr ? `<span class="badge st-pass">${labels.dfr}</span>` : '<span class="badge st-none">Chưa có</span>'}</div>
      <p>Nạp file CSV DIRANA; chỉ trình bày số liệu đo, không đánh giá đạt/không đạt.</p><div class="row-actions"><button class="btn" data-act="dfrFiles">Nạp file .csv…</button><button class="btn" data-act="dfrFolder">Nạp cả thư mục…</button>${dfr.length ? '<button class="btn small danger" data-act="dfrClear">Bỏ phụ lục DFR</button>' : ''}</div>
      ${dfr.length ? `<div class="ftable-wrap"><table class="ftable"><thead><tr><th>Phép đo</th><th>Ngày đo</th><th>Phía</th><th>Pha</th><th>15 Hz: tan / C</th><th>400 Hz: tan / C</th><th>Dùng</th><th></th></tr></thead><tbody>${dfr.slice().sort((a,b)=>{const rank=x=>({HV:0,MV:1,N:2,LV1:3,LV2:4}[x]??5);return rank(a.side)-rank(b.side)||Dfr.PHASES.indexOf(a.phase)-Dfr.PHASES.indexOf(b.phase)||Dfr.dateKey(a.date).localeCompare(Dfr.dateKey(b.date));}).map(m=>{const a=Dfr.at(m,15),b=Dfr.at(m,400), id=esc(m.id); const dec=x=>Number(x).toFixed(2).replace('.', (A.state.cfg.decSep||',')==='.'?'.':',');return `<tr><td>${esc(m.name)}</td><td>${esc(m.date)}</td><td><select aria-label="Phía của ${esc(m.name)}" data-dfr="side" data-id="${id}"><option value="">—</option>${Dfr.SIDES.map(x=>`<option ${m.side===x?'selected':''}>${x}</option>`).join('')}</select></td><td><select aria-label="Pha của ${esc(m.name)}" data-dfr="phase" data-id="${id}"><option value="">—</option>${Dfr.PHASES.map(x=>`<option ${m.phase===x?'selected':''}>${x}</option>`).join('')}</select></td><td>${a?`${dec(a.tan)} / ${dec(a.c)}`:'—'}</td><td>${b?`${dec(b.tan)} / ${dec(b.c)}`:'—'}</td><td><input type="checkbox" aria-label="Dùng phép đo ${esc(m.name)}" data-dfr="use" data-id="${id}" ${m.use?'checked':''}></td><td><button class="btn small danger" data-act="dfrDelete" data-id="${id}" aria-label="Xóa phép đo">×</button></td></tr>`}).join('')}</tbody></table></div><div class="dfr-preview">${Dfr.SIDES.filter(s=>Dfr.table(dfr).some(row=>row.side===s)).map(s=>`<div><b>Đồ thị xếp chồng — ${s}</b><canvas data-dfr-preview="${s}" aria-label="Đồ thị DFR phía ${s}"></canvas></div>`).join('')}</div>` : '<p>Chưa nạp phép đo DFR.</p>'}</section>`;
    return `<section class="panel appx">${h}</section>`;
  }

  // Sau khi vẽ: kiểm tra file báo cáo còn trong kho của trình duyệt
  async function afterRender(A) {
    const fra = A.state.att && A.state.att.fra, el = $('[data-frafile]');
    if (fra && el) { const rec = await FileStore.get(fra.id).catch(() => null); el.className = `badge ${rec ? 'st-pass' : 'st-warn'}`; el.textContent = rec ? 'File có trên máy này' : 'Thiếu file trên máy này — nạp lại báo cáo'; }
    for (const x of (((A.state.att || {}).oil || {}).items || [])) {
      const badge = document.querySelector(`[data-oilfile="${CSS.escape(x.id)}"]`);
      if (!badge) continue;
      const rec = await FileStore.get(x.id).catch(() => null);
      badge.className = `badge ${rec ? 'st-pass' : 'st-warn'}`; badge.textContent = rec ? 'File có trên máy này' : 'Thiếu file';
    }
    const used = ((A.state.att || {}).dfr || {}).items || [];
    document.querySelectorAll('[data-dfr-preview]').forEach(cv => DfrChart.draw(cv, Dfr.table(used).filter(row=>row.side===cv.dataset.dfrPreview).map(row=>row.m), true));
  }

  async function loadOil(files, A) {
    const state = A.state, serials = [state.v['meta.serial'], ...Object.values(state.cfg.ps || {})];
    state.att = state.att || {}; state.att.oil = state.att.oil || { items: [] };
    for (const f of files) {
      let bytes = await f.arrayBuffer(), doc;
      try { doc = await DocxTemplate.load(bytes); } catch (_) { A.toast(`${f.name}: không phải file Word .docx`, true); continue; }
      const sum = Appendix.oilSummary(doc.lines());
      if (!sum.kind && !confirm(`${f.name} không giống BBTN dầu xuất từ app DGA. Vẫn dùng file này làm phụ lục?`)) continue;
      if (sum.serial && !Appendix.serialMatch(sum.serial, serials) && !confirm(`Số chế tạo trong file (${sum.serial}) không khớp số chế tạo của biên bản (${serials.filter(Boolean).join(' / ') || 'chưa khai báo'}). Vẫn nạp file?`)) continue;
      const id = `oil-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      await FileStore.put(id, { name: f.name, type: f.type, bytes });
      state.att.oil.items.push({ id, name: f.name, size: f.size, importedAt: new Date().toISOString(), ...sum, use: true });
    }
    A.persist(); A.render();
  }

  async function loadFile(f, A) {
    const buf = await f.arrayBuffer();
    let doc;
    try { doc = await DocxTemplate.load(buf); } catch (e) { throw new Error(`${f.name}: không phải file Word .docx`); }
    const sum = Appendix.fraSummary(doc.outline());
    if (!sum.isSfra && !confirm(`${f.name} không giống báo cáo SFRA (không thấy SFRA / Rxy / DL/T 911). Vẫn dùng file này làm phụ lục?`)) return;
    const st = A.state, old = st.att && st.att.fra;
    const id = 'fra-' + Date.now().toString(36);
    await FileStore.put(id, { name: f.name, type: f.type, bytes: buf });
    if (old) FileStore.del(old.id).catch(() => {});
    st.att = st.att || {};
    st.att.fra = { id, name: f.name, size: f.size, importedAt: new Date().toISOString(), title: sum.title, measurements: sum.measurements, conclusion: sum.conclusion };
    opened = { id, doc };
    A.persist(); A.render();
    A.toast(`Đã nạp báo cáo SFRA ${f.name}${sum.measurements ? ` (${sum.measurements} phép đo)` : ''} — sẽ nối thành phụ lục khi xuất BBTN`);
  }

  async function action(act, b, A) {
    const st = A.state;
    if (act === 'appxScAdd') {
      const att = st.att || (st.att = {}), sc = att.shortCircuit || (att.shortCircuit = { rows: [] });
      sc.rows = sc.rows || [];
      const layout = st.cfg.template === 'custom' ? st.cfg.layout : st.cfg.template;
      const reason = String(st.v['meta.reason'] || '').toLowerCase();
      const testCase = /đại tu|sửa chữa/.test(reason) ? 'overhaul' : /định kỳ|bất thường|dự phòng|vận hành/.test(reason) ? 'operation' : 'new';
      sc.rows.push({ id: `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, pair: 'HV-MV', tap: (st.cfg.taps || [])[0] || '', phase: ['3P', '110'].includes(layout) ? 'A' : '', testCase, tapRole: 'main', testVoltageUnit: 'V' });
      A.recompute(); A.persist(); A.render();
    }
    if (act === 'appxScDel' && st.att && st.att.shortCircuit) {
      st.att.shortCircuit.rows = (st.att.shortCircuit.rows || []).filter(row => row.id !== b.dataset.id);
      if (!st.att.shortCircuit.rows.length) delete st.att.shortCircuit;
      A.recompute(); A.persist(); A.render();
    }
    if (act === 'appxScClear' && st.att && st.att.shortCircuit) {
      if (!confirm('Xóa toàn bộ số liệu thí nghiệm ngắn mạch khỏi biên bản?')) return;
      delete st.att.shortCircuit;
      A.recompute(); A.persist(); A.render(); A.toast('Đã xóa số liệu thí nghiệm ngắn mạch');
    }
    if (act === 'appxLoadFra') $('#fileFra').click();
    if (act === 'appxOilLoad') $('#fileOil').click();
    if (act === 'appxOilCopy') {
      const sn = [...new Set([st.v['meta.serial'], ...Object.values(st.cfg.ps || {})].filter(Boolean))].join(' / ');
      if (!sn) return A.toast('Chưa khai báo số chế tạo ở mục 0.', true);
      try { await navigator.clipboard.writeText(sn); A.toast(`Đã chép số chế tạo: ${sn}`); } catch (_) { A.toast('Không chép được số chế tạo — kiểm tra quyền clipboard của trình duyệt.', true); }
    }
    if (act === 'appxOilDel' && st.att && st.att.oil) {
      const item = st.att.oil.items.find(x => x.id === b.dataset.id);
      if (!item || !confirm(`Bỏ phụ lục dầu “${item.name}” khỏi biên bản? File gốc trên máy của anh/chị không bị xóa.`)) return;
      st.att.oil.items = st.att.oil.items.filter(x => x.id !== b.dataset.id);
      if (item) FileStore.del(item.id).catch(() => {});
      A.persist(); A.render();
    }
    if (act === 'appxDelFra' && st.att && st.att.fra) {
      if (!confirm('Bỏ phụ lục SFRA khỏi biên bản? File báo cáo gốc trên máy của anh/chị không bị xóa.')) return;
      FileStore.del(st.att.fra.id).catch(() => {});
      delete st.att.fra;
      opened = { id: null, doc: null };
      A.persist(); A.render(); A.toast('Đã bỏ phụ lục SFRA');
    }
    if (act === 'dfrFiles') $('#fileDirana').click();
    if (act === 'dfrFolder') $('#diranaFolder').click();
    if (act === 'dfrDelete' || act === 'dfrClear') {
      if (act === 'dfrClear' && !confirm('Bỏ phụ lục DFR khỏi biên bản? Các phép đo đã nạp sẽ bị xóa khỏi biên bản.')) return;
      const xs = st.att.dfr.items;
      if (act === 'dfrDelete') st.att.dfr.items = xs.filter(m => m.id !== b.dataset.id);
      else delete st.att.dfr;
      A.persist(); A.render(); A.toast('Đã cập nhật phép đo DFR');
    }
  }

  async function loadDirana(files, A) {
    const list = Array.isArray(files) ? files : [files];
    const att = A.state.att || (A.state.att = {}), items = (att.dfr && att.dfr.items) || [];
    const before = items.slice(), parsedNew = [], errors = [];
    for (const file of list.filter(f => /\.csv$/i.test(f.name))) {
      try {
        const parsed = Dirana.parse(await file.text(), file.name);
        parsed.forEach(m => parsedNew.push(m));
      } catch (e) {
        if (!/không phải CSV DIRANA/.test(e.message || '')) errors.push(`${file.name}: ${e.message}`);
      }
    }
    if (!parsedNew.length) {
      if (errors.length) A.toast(errors.join('\n'), true);
      else A.toast('Không tìm thấy phép đo DIRANA trong các file đã chọn.', true);
      return;
    }
    const newId = () => `dfr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    att.dfr = { items: Dirana.merge(before, parsedNew, newId) };
    A.persist(); A.render();
    A.toast(`Đã nạp ${parsedNew.length} phép đo từ ${new Set(parsedNew.map(m => m.file)).size} file`);
    if (errors.length) A.toast(errors.join('\n'), true);
  }

  // Đọc lại các file phụ lục khi xuất; thiếu file thì báo và bỏ riêng phụ lục tương ứng
  async function reportAssets(A) {
    const att = A.state.att || {}, fra = att.fra;
    if (fra && opened.id !== fra.id) {
      const rec = await FileStore.get(fra.id).catch(() => null);
      if (!rec) { A.toast(`Thiếu file báo cáo SFRA “${fra.name}” trên máy này — BBTN xuất không có phụ lục SFRA. Nạp lại ở trang Phụ lục.`, true); opened = { id: null, doc: null }; }
      else opened = { id: fra.id, doc: await DocxTemplate.load(rec.bytes) };
    }
    const oilDocs = {};
    for (const item of ((att.oil && att.oil.items) || []).filter(x => x.use !== false)) {
      const rec = await FileStore.get(item.id).catch(() => null);
      if (!rec) { A.toast(`Thiếu file phụ lục dầu “${item.name}” trên máy này — nạp lại ở trang Phụ lục.`, true); continue; }
      oilDocs[item.id] = await DocxTemplate.load(rec.bytes);
    }
    return {
      fraDoc: fra ? opened.doc : null,
      oilDocs,
      shortCircuitRows: Appendix.shortCircuitResults(A.state, A.FX),
      factoryName: A.FX && A.FX.data.fileName || '',
    };
  }

  // ---- đi kèm biên bản: .json (base64), CSDL (Storage)
  async function filesFor(st) {
    const fra = st.att && st.att.fra, out = {};
    const items = [fra, ...((st.att && st.att.oil && st.att.oil.items) || [])].filter(Boolean);
    for (const item of items) {
      const rec = await FileStore.get(item.id).catch(() => null);
      if (rec) out[item.id] = { name: rec.name, type: rec.type, b64: App.abToB64(rec.bytes) };
    }
    return out;
  }
  async function restoreFiles(files) {
    for (const [id, f] of Object.entries(files || {})) {
      const bytes = Uint8Array.from(atob(f.b64), c => c.charCodeAt(0)).buffer;
      await FileStore.put(id, { name: f.name, type: f.type, bytes });
    }
  }
  async function afterDbSave(st) {
    const items = [st.att && st.att.fra, ...((st.att && st.att.oil && st.att.oil.items) || [])].filter(Boolean);
    if (!st.db || !st.db.sessionId) return;
    for (const item of items) {
      const rec = await FileStore.get(item.id).catch(() => null);
      if (!rec) continue;
      const blob = new Blob([rec.bytes], { type: rec.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      await DB.uploadDoc(st.db.sessionId, st.db.equipmentId || null, 'OTHER', storagePath(st, item.id), item.name, blob);
    }
  }
  // Mở biên bản từ CSDL trên máy khác: tải báo cáo SFRA từ Storage về kho file của trình duyệt
  async function ensureFiles(st) {
    const items = [st.att && st.att.fra, ...((st.att && st.att.oil && st.att.oil.items) || [])].filter(Boolean);
    if (!items.length || !st.db || !st.db.sessionId) return;
    const docs = await DB.listDocs(st.db.sessionId);
    for (const item of items) {
      if (await FileStore.get(item.id).catch(() => null)) continue;
      const d = docs.find(x => String(x.storage_path).includes(`/appendix/${item.id}.docx`));
      if (!d) continue;
      const blob = await DB.downloadDoc(d.storage_path);
      await FileStore.put(item.id, { name: item.name, type: blob.type, bytes: await blob.arrayBuffer() });
    }
  }

  function init(A) {
    $('#fileFra').addEventListener('change', e => A.readFile(e.target, f => loadFile(f, A)));
    $('#fileOil').addEventListener('change', async e => { await loadOil(Array.from(e.target.files || []), A); e.target.value = ''; });
    ['fileDirana','diranaFolder'].forEach(id => $('#' + id).addEventListener('change', async e => { await loadDirana(Array.from(e.target.files || []), A); e.target.value = ''; }));
    document.addEventListener('change', e => {
      const el = e.target;
      if (el.dataset.scField) {
        const rows = ((A.state.att || {}).shortCircuit || {}).rows || [];
        const row = rows.find(x => x.id === el.dataset.id);
        if (row) { row[el.dataset.scField] = el.value; A.recompute(); A.persist(); A.render(); }
        return;
      }
      if (!el.dataset.dfr) return;
      const items = A.state.att.dfr.items, m = items.find(x => x.id === el.dataset.id);
      if (!m) return;
      m[el.dataset.dfr] = el.type === 'checkbox' ? el.checked : el.value;
      // chỉnh tay: phía/pha không bị xếp hạng lại khi nạp thêm file; lựa chọn "Dùng" giữ cho cả nhóm phía|pha
      if (el.dataset.dfr === 'side' || el.dataset.dfr === 'phase') m.sideManual = true;
      if (el.dataset.dfr === 'use') items.forEach(x => { if (x.side === m.side && x.phase === m.phase) x.useManual = true; });
      if (m.use) items.forEach(x => { if (x.id !== m.id && x.side === m.side && x.phase === m.phase) x.use = false; });
      A.persist(); A.render();
    });
    document.addEventListener('change', e => {
      const el = e.target;
      if (!el.dataset.oilUse) return;
      const item = ((A.state.att.oil || {}).items || []).find(x => x.id === el.dataset.oilUse);
      if (item) { item.use = el.checked; A.persist(); A.render(); }
    });
  }

  window.AppendixUI = { render, shortCircuitHTML, afterRender, action, reportAssets, filesFor, restoreFiles, afterDbSave, ensureFiles, init };
})();
