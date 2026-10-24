// Trang CSDL (kết nối, đăng nhập, biên bản đã lưu, nhập Test report) và trang Xu hướng.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => App.esc(s);
  const fmt = (x, d) => (x === null || x === undefined || x === '' ? '' : Common.fmt(Number(x), d));
  const ST = { pass: 'Đạt', warn: 'Cần xem xét', fail: 'Không đạt', missing: 'Thiếu dữ liệu', info: 'Tham khảo' };
  const ITEM = {
    IR: 'Điện trở cách điện', WTGD: 'tgδ & điện dung cuộn dây', DCR: 'Điện trở một chiều', RATIO: 'Tỷ số biến', BUSHING: 'Sứ đầu vào',
    BUSHING_AC: 'Thử AC sứ', NOLOAD: 'Không tải', MOISTURE: 'Độ ẩm cách điện cứng', OLTC: 'OLTC', BCT_IR: 'TI chân sứ – cách điện',
    BCT_RATIO: 'TI chân sứ – tỷ số', BCT_DCR: 'TI chân sứ – R một chiều', BCT_EXC: 'TI chân sứ – đặc tính V-A', VECTOR: 'Tổ đấu dây', VISUAL: 'Kiểm tra bên ngoài', BCT: 'TI chân sứ',
  };
  const COLORS = ['#0d5aa7', '#c2410c', '#15803d', '#7c3aed', '#b91c1c', '#0e7490', '#a16207', '#be185d'];

  let sessions = null, docs = {}, busy = false;
  const T = { equipment: null, eqId: '', withChildren: true, data: null, series: '', loadedFor: '' };

  // ------------------------------------------------------------------ trang CSDL
  function renderDb() {
    const c = DB.cfgGet();
    const st = App.state;
    let h = `<div class="panel-head"><span class="secno">DB</span><h2>Cơ sở dữ liệu thí nghiệm</h2><span class="en">Supabase</span></div>`;
    if (c.fromSite) {
      h += `<h3>Kết nối</h3><div class="callout">Trang này đã được cấu hình sẵn kết nối tới <b>${esc(c.url)}</b>.</div>`;
    } else {
      h += '<h3>Kết nối</h3><div class="fields">';
      h += `<div class="field wide"><label for="dbUrl">Supabase URL</label><input id="dbUrl" value="${esc(c.url || '')}" placeholder="https://xxxx.supabase.co"></div>`;
      h += `<div class="field wide"><label for="dbKey">Anon (publishable) key</label><input id="dbKey" value="${esc(c.key || '')}" placeholder="eyJhbGciOi…"></div>`;
      h += `</div><div class="row-actions"><button class="btn" data-act="dbConnect">Kết nối</button><span class="hint-text">${DB.client ? 'Đã cấu hình kết nối.' : 'Chưa kết nối — app vẫn dùng được ở chế độ offline.'}</span></div>`;
    }
    if (DB.client && !DB.user) {
      h += `<h3>Tài khoản</h3><div class="callout">Đăng nhập để lưu biên bản, nhập Test report và xem xu hướng.
        <div class="row-actions"><button class="btn primary" data-auth="open">Đăng nhập</button><button class="btn" data-auth="signup">Tạo tài khoản</button></div></div>`;
    } else if (DB.user && !DB.canEdit()) {
      h += `<div class="callout warn">Tài khoản <b>${esc(DB.user.email)}</b> đang ở quyền chỉ xem — xem được số liệu nhưng chưa lưu được. Đề nghị quản trị viên cấp quyền Nhập liệu.</div>`;
    }
    if (DB.user) {
      const saved = st.db && st.db.sessionId;
      h += `<h3>Biên bản đang mở</h3><div class="callout">${esc(st.v['meta.serial'] || '—')} · ${esc(st.v['meta.date'] || '')} · ${esc(st.v['meta.reason'] || '')}
        — ${saved ? `đã lưu CSDL (id <code>${esc(st.db.sessionId.slice(0, 8))}</code>${st.db.savedAt ? ', ' + esc(new Date(st.db.savedAt).toLocaleString('vi-VN')) : ''})` : 'chưa lưu CSDL'}
        <div class="hint-text" style="margin-top:8px">Gắn thiết bị vào ngăn lộ (áp dụng khi thiết bị chưa thuộc ngăn nào):</div><div id="bayPicker">${Catalog.bayPickerHTML()}</div>
        <div class="row-actions">
          <button class="btn primary" data-act="dbSave" ${DB.canEdit() ? '' : 'disabled'}>Lưu lên CSDL (bản nháp)</button>
          <button class="btn" data-act="dbSaveFinal" ${DB.canEdit() ? '' : 'disabled'}>Lưu & chốt (final)</button>
          ${saved ? '<button class="btn" data-act="dbSaveAsNew">Lưu thành biên bản mới</button>' : ''}
        </div></div>`;
      h += `<h3>Test report xuất xưởng</h3><div class="callout">Nạp số liệu xuất xưởng (<b>${esc(App.FX ? App.FX.data.fileName : '—')}</b>) vào CSDL làm lần thí nghiệm <b>FAT</b>
        cho ${App.FX ? App.FX.data.order.length : 0} máy (kèm sứ xuyên, BCT) — mốc khởi đầu để đánh giá xu hướng. Chạy lại sẽ cập nhật, không tạo trùng.
        Các máy được gắn vào ngăn lộ chọn ở mục “Biên bản đang mở” phía trên.
        <div class="row-actions"><button class="btn" data-act="dbImportFactory" ${DB.canEdit() ? '' : 'disabled'}>Nhập Test report vào CSDL</button></div></div>`;
      h += `<h3>Biên bản đã lưu</h3><div class="row-actions"><button class="btn small" data-act="dbRefresh">Tải lại danh sách</button></div><div id="dbSessions">${sessionsHTML()}</div>`;
    }
    return `<section class="panel">${h}</section>`;
  }

  function sessionsHTML() {
    if (!sessions) return '<div class="empty">Đang tải…</div>';
    if (!sessions.length) return '<div class="empty">Chưa có biên bản nào trong CSDL.</div>';
    let h = '<div style="overflow-x:auto"><table class="ftable"><thead><tr><th>Ngày TN</th><th>Loại</th><th>Thiết bị</th><th>Trạng thái</th><th>Số giá trị</th><th>Không đạt</th><th>Nguồn</th><th></th></tr></thead><tbody>';
    sessions.forEach(s => {
      const cur = App.state.db && App.state.db.sessionId === s.id;
      h += `<tr class="${s.n_fail ? 'st-fail' : ''}"><td class="num">${esc(s.test_date)}</td><td>${esc(Common.KIND_LABEL[s.kind] || s.kind)}</td>
        <td>${esc(s.serial_no)}${s.equipment_name ? `<div class="note">${esc(s.equipment_name)}</div>` : ''}${s.bay_code ? `<div class="note">${esc(s.substation_name || '')} · ${esc(s.bay_code)}</div>` : ''}</td>
        <td><span class="badge ${s.status === 'final' ? 'st-pass' : 'st-info'}">${s.status === 'final' ? 'Đã chốt' : 'Nháp'}</span>${cur ? ' <span class="badge st-missing">đang mở</span>' : ''}</td>
        <td class="num">${s.n_values}</td><td class="num">${s.n_fail || ''}</td><td>${s.source === 'factory_import' ? 'Test report' : 'Hiện trường'}</td>
        <td><div class="row-actions" style="margin:0">
          ${s.has_form ? `<button class="btn small" data-act="dbOpen" data-id="${s.id}">Mở</button><button class="btn small" data-act="dbExport" data-id="${s.id}">Xuất BBTN .docx</button>` : ''}
          <button class="btn small" data-act="dbDocs" data-id="${s.id}">Tài liệu</button>
          <button class="btn small" data-act="dbTrendOf" data-eq="${s.equipment_id}">Xu hướng</button>
          <button class="btn small" data-act="dbDelete" data-id="${s.id}">Xóa</button></div>
          ${docs[s.id] ? docsHTML(docs[s.id]) : ''}</td></tr>`;
    });
    return h + '</tbody></table></div>';
  }
  function docsHTML(list) {
    if (!list.length) return '<div class="note">Chưa có tài liệu.</div>';
    return list.map(d => `<div class="note"><a href="#" data-dl="${esc(d.storage_path)}" data-name="${esc(d.file_name)}">${esc(d.file_name)}</a> · ${esc(d.kind)}</div>`).join('');
  }

  async function loadSessions() {
    try { sessions = (await DB.listSessions()).map(s => Object.assign(s, { test_date: String(s.test_date).slice(0, 10) })); } catch (e) { sessions = []; App.toast('Lỗi tải danh sách: ' + e.message, true); }
    const el = $('#dbSessions');
    if (el) el.innerHTML = sessionsHTML();
  }

  // ------------------------------------------------------------------ trang Xu hướng
  function renderTrend() {
    let h = `<div class="panel-head"><span class="secno">↗</span><h2>Xu hướng số liệu thí nghiệm</h2><span class="en">FAT → sau lắp đặt → định kỳ</span></div>`;
    if (!DB.user) return `<section class="panel">${h}<div class="empty">Kết nối và đăng nhập CSDL ở trang “CSDL” để xem xu hướng.</div></section>`;
    h += '<div class="fields">';
    h += `<div class="field"><label for="trEq">Thiết bị</label><select id="trEq">${eqOptions()}</select></div>`;
    h += `<div class="field"><label><input type="checkbox" id="trKids" ${T.withChildren ? 'checked' : ''}> Gồm sứ / OLTC của MBA</label></div>`;
    h += `<div class="field wide"><label for="trSeries">Chuỗi số liệu (hạng mục · đại lượng · sơ đồ/cuộn · nấc)</label><select id="trSeries">${seriesOptions()}</select></div></div>`;
    h += '<div class="callout">So sánh theo giá trị quy đổi chuẩn khi có (R cách điện, tgδ @20 °C; R một chiều @75 °C). % thay đổi tính so với giá trị khởi đầu: lần FAT nếu có, nếu không là lần đo sớm nhất. Đánh giá cuối cùng vẫn phải xét tổng thể theo Điều 3 QĐ 1901.</div>';
    h += `<div id="trChart">${chartHTML()}</div><div id="trTop">${topChangesHTML()}</div>`;
    return `<section class="panel">${h}</section>`;
  }
  function eqOptions() {
    if (!T.equipment) return '<option>Đang tải…</option>';
    // Nhóm theo Trạm · Ngăn lộ
    const groups = {};
    T.equipment.filter(e => !e.parent_id).forEach(e => {
      const g = e.bay_code ? `${e.substation_name || ''} · ${e.bay_code}` : 'Chưa gắn ngăn lộ';
      (groups[g] = groups[g] || []).push(e);
    });
    return Object.keys(groups).sort().map(g => `<optgroup label="${esc(g)}">${groups[g].map(e =>
      `<option value="${e.id}" ${e.id === T.eqId ? 'selected' : ''}>${esc(e.class_code)} · ${esc(e.serial_no)}${e.name ? ' — ' + esc(e.name) : ''}</option>`).join('')}</optgroup>`).join('');
  }
  const seriesKey = r => [r.item, r.param, r.config, r.tap].join('|');
  function seriesOptions() {
    if (!T.data) return '<option>—</option>';
    const groups = {};
    T.data.forEach(r => { if (r.value_cmp === null) return; const k = seriesKey(r); (groups[k] = groups[k] || { r, n: 0, d: new Set() }).n++; groups[k].d.add(r.test_date); });
    const keys = Object.keys(groups).sort((a, b) => (groups[b].d.size - groups[a].d.size) || a.localeCompare(b));
    if (!T.series || !groups[T.series]) T.series = keys.find(k => k.startsWith('DCR|R|HV|1')) || keys[0] || '';
    return keys.map(k => {
      const g = groups[k], r = g.r;
      return `<option value="${esc(k)}" ${k === T.series ? 'selected' : ''}>${esc(ITEM[r.item] || r.item)} · ${esc(r.param)}${r.config ? ' · ' + esc(r.config) : ''}${r.tap ? ' · nấc ' + esc(r.tap) : ''} (${g.d.size} lần đo)</option>`;
    }).join('');
  }

  function chartHTML() {
    if (!T.data) return '<div class="empty">Chọn thiết bị để tải dữ liệu.</div>';
    const pts = T.data.filter(r => seriesKey(r) === T.series && r.value_cmp !== null);
    if (!pts.length) return '<div class="empty">Chưa có số liệu cho chuỗi này.</div>';
    const lines = {};
    pts.forEach(r => { const k = `${r.serial_no}${r.phase ? ' · pha ' + r.phase : ''}`; (lines[k] = lines[k] || []).push(r); });
    const names = Object.keys(lines).sort();
    const t = s => new Date(s + 'T00:00:00').getTime();
    const xs = pts.map(r => t(r.test_date)), ys = pts.map(r => Number(r.value_cmp));
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (x0 === x1) { x0 -= 86400e3 * 30; x1 += 86400e3 * 30; }
    const pad = (y1 - y0) * 0.15 || Math.abs(y1) * 0.02 || 1; y0 -= pad; y1 += pad;
    const W = 920, H = 320, L = 64, R = 44, Tp = 14, B = 42;
    const sx = x => L + (x - x0) / (x1 - x0) * (W - L - R), sy = y => Tp + (1 - (y - y0) / (y1 - y0)) * (H - Tp - B);
    const unit = pts[0].unit || '';
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Biểu đồ xu hướng" style="width:100%;max-width:${W}px;height:auto;display:block">`;
    for (let i = 0; i <= 4; i++) {
      const y = y0 + (y1 - y0) * i / 4, py = sy(y);
      svg += `<line x1="${L}" x2="${W - R}" y1="${py}" y2="${py}" stroke="#e7eaed"/><text x="${L - 8}" y="${py + 4}" text-anchor="end" font-size="11" fill="#5d6874">${esc(fmt(y))}</text>`;
    }
    [...new Set(pts.map(r => r.test_date))].sort().forEach(d => {
      const px = sx(t(d));
      svg += `<line x1="${px}" x2="${px}" y1="${Tp}" y2="${H - B}" stroke="#f0f2f4"/><text x="${px}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="#5d6874">${esc(d.split('-').reverse().join('/'))}</text>`;
    });
    svg += `<text x="12" y="${Tp + 4}" font-size="11" fill="#5d6874" transform="rotate(-90 12 ${Tp + 4})" text-anchor="end">${esc(unit)}</text>`;
    names.forEach((n, i) => {
      const col = COLORS[i % COLORS.length];
      const s = lines[n].sort((a, b) => a.test_date.localeCompare(b.test_date));
      svg += `<polyline fill="none" stroke="${col}" stroke-width="2" points="${s.map(r => `${sx(t(r.test_date))},${sy(Number(r.value_cmp))}`).join(' ')}"/>`;
      s.forEach(r => {
        const fat = r.kind === 'FAT';
        svg += `<circle cx="${sx(t(r.test_date))}" cy="${sy(Number(r.value_cmp))}" r="${fat ? 5 : 4}" fill="${fat ? '#fff' : col}" stroke="${col}" stroke-width="2"><title>${esc(n)} — ${esc(r.test_date)} (${esc(Common.KIND_LABEL[r.kind] || r.kind)})\n${esc(fmt(r.value_cmp))} ${esc(unit)}${r.change_pct !== null ? `\nThay đổi so với khởi đầu: ${esc(fmt(r.change_pct, 2))} %` : ''}</title></circle>`;
      });
    });
    svg += '</svg>';
    const legend = `<div class="legend">${names.map((n, i) => `<span><i style="background:${COLORS[i % COLORS.length]}"></i>${esc(n)}</span>`).join('')}<span><i class="hollow"></i>Xuất xưởng (FAT)</span></div>`;
    let tbl = '<div style="overflow-x:auto"><table class="ftable"><thead><tr><th>Ngày</th><th>Lần TN</th><th>Thiết bị / pha</th><th>Giá trị đo</th><th>Nhiệt độ</th><th>Giá trị so sánh</th><th>Khởi đầu</th><th>% thay đổi</th><th>Đánh giá lúc đo</th></tr></thead><tbody>';
    pts.slice().sort((a, b) => a.test_date.localeCompare(b.test_date) || a.serial_no.localeCompare(b.serial_no)).forEach(r => {
      tbl += `<tr><td class="num">${esc(r.test_date)}</td><td>${esc(Common.KIND_LABEL[r.kind] || r.kind)}</td><td>${esc(r.serial_no)}${r.phase ? ' · ' + esc(r.phase) : ''}</td>
        <td class="num">${esc(fmt(r.value))} ${esc(r.unit || '')}</td><td class="num">${r.temp_c !== null ? esc(fmt(r.temp_c, 1)) + ' °C' : ''}</td>
        <td class="num">${esc(fmt(r.value_cmp))}${r.norm_temp_c !== null && r.value_norm !== null ? ` @${esc(fmt(r.norm_temp_c, 0))} °C` : ''}</td>
        <td class="num">${esc(fmt(r.base_value))}</td><td class="num">${r.change_pct !== null ? esc(fmt(r.change_pct, 2)) + ' %' : ''}</td>
        <td>${r.status ? `<span class="badge st-${r.status}">${ST[r.status]}</span>` : ''}</td></tr>`;
    });
    return svg + legend + tbl + '</tbody></table></div>';
  }

  // Các chuỗi có % thay đổi lớn nhất ở lần đo mới nhất — gợi ý chỗ cần xem kỹ
  function topChangesHTML() {
    if (!T.data) return '';
    const last = {};
    T.data.forEach(r => {
      if (r.change_pct === null || r.kind === 'FAT') return;
      const k = seriesKey(r) + '|' + r.equipment_id + '|' + r.phase;
      if (!last[k] || r.test_date > last[k].test_date) last[k] = r;
    });
    const top = Object.values(last).filter(r => Math.abs(r.change_pct) > 0).sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct)).slice(0, 25);
    if (!top.length) return '';
    let h = '<h3>Thay đổi lớn nhất so với giá trị khởi đầu (lần đo gần nhất)</h3><div style="overflow-x:auto"><table class="ftable"><thead><tr><th>Chuỗi</th><th>Thiết bị / pha</th><th>Ngày</th><th>Giá trị</th><th>Khởi đầu</th><th>% thay đổi</th><th></th></tr></thead><tbody>';
    top.forEach(r => {
      h += `<tr><td>${esc(ITEM[r.item] || r.item)} · ${esc(r.param)}${r.config ? ' · ' + esc(r.config) : ''}${r.tap ? ' · nấc ' + esc(r.tap) : ''}</td><td>${esc(r.serial_no)}${r.phase ? ' · ' + esc(r.phase) : ''}</td>
        <td class="num">${esc(r.test_date)}</td><td class="num">${esc(fmt(r.value_cmp))}</td><td class="num">${esc(fmt(r.base_value))}</td><td class="num"><b>${esc(fmt(r.change_pct, 2))} %</b></td>
        <td><button class="btn small" data-act="dbSeries" data-key="${esc(seriesKey(r))}">Xem</button></td></tr>`;
    });
    return h + '</tbody></table></div>';
  }

  async function loadTrend() {
    if (!T.eqId) return;
    const ids = [T.eqId].concat(T.withChildren ? T.equipment.filter(e => e.parent_id === T.eqId).map(e => e.id) : []);
    const key = ids.join(',');
    if (T.loadedFor !== key) {
      T.data = null; refreshTrend();
      try {
        T.data = (await DB.trend(ids)).map(r => Object.assign(r, { test_date: String(r.test_date).slice(0, 10) }));
        T.loadedFor = key;
      } catch (e) { T.data = []; App.toast('Lỗi tải xu hướng: ' + e.message, true); }
    }
    refreshTrend();
  }
  function refreshTrend() {
    const s = $('#trSeries'); if (s) s.innerHTML = seriesOptions();
    const c = $('#trChart'); if (c) c.innerHTML = chartHTML();
    const t = $('#trTop'); if (t) t.innerHTML = topChangesHTML();
  }

  async function afterRender(page) {
    if (page === 'db' && DB.user && !sessions && !busy) loadSessions();
    if (page === 'db' && DB.user) {
      await Catalog.load(false);
      const w = $('#bayPicker'); if (w) { w.innerHTML = Catalog.bayPickerHTML(); Catalog.bindBayPicker(); }
    }
    if (page === 'trend' && DB.user) {
      if (!T.equipment) {
        try { T.equipment = await DB.listEquipment(); } catch (e) { T.equipment = []; App.toast(e.message, true); }
        const main = T.equipment.find(e => !e.parent_id && e.serial_no === App.state.v['meta.serial']);
        if (!T.eqId) T.eqId = main ? main.id : ((T.equipment.find(e => !e.parent_id) || {}).id || '');
        const sel = $('#trEq'); if (sel) sel.innerHTML = eqOptions();
      }
      $('#trEq').onchange = e => { T.eqId = e.target.value; loadTrend(); };
      $('#trKids').onchange = e => { T.withChildren = e.target.checked; loadTrend(); };
      $('#trSeries').onchange = e => { T.series = e.target.value; refreshTrend(); };
      loadTrend();
    }
  }

  // ------------------------------------------------------------------ hành động
  async function action(act, btn) {
    if (busy) return;
    if (/^dbSave/.test(act) && !DB.user) {
      if (DB.client) { Notify.show({ type: 'info', msg: 'Đăng nhập để lưu biên bản lên CSDL.' }); AuthUI.openDialog('signin'); }
      else { Notify.show({ type: 'info', msg: 'Nhập URL và key Supabase để kết nối CSDL trước.' }); App.go('db'); }
      return;
    }
    if (/^(dbSave|dbImport)/.test(act) && !DB.canEdit()) {
      Notify.show({ type: 'info', title: 'Tài khoản chỉ xem', msg: 'Bạn chưa lưu được lên CSDL. Đề nghị quản trị viên cấp quyền Nhập liệu.' });
      return;
    }
    busy = true; btn.disabled = true;
    try {
      if (act === 'dbConnect') {
        const bad = await DB.checkConfig($('#dbUrl').value, $('#dbKey').value);
        if (bad) throw new Error(bad);
        DB.connect($('#dbUrl').value, $('#dbKey').value);
        await AuthUI.init();
        sessions = null; T.equipment = null; T.loadedFor = ''; Catalog.reset();
        App.toast(DB.client ? 'Đã lưu cấu hình kết nối' : 'Thiếu URL hoặc key', !DB.client);
      } else if (act === 'dbGoCatalog') {
        busy = false; App.go('catalog'); return;
      } else if (act === 'dbSignOut') {
        busy = false; await AuthUI.signOut(); return;
      } else if (act === 'dbSave' || act === 'dbSaveFinal' || act === 'dbSaveAsNew') {
        const st = App.state;
        if (act === 'dbSaveAsNew') st.db = null;
        App.recompute();
        const r = await Records.saveField(st, App.res, App.schema, act === 'dbSaveFinal' ? 'final' : 'draft');
        st.db = { sessionId: r.id, equipmentId: r.equipmentId, savedAt: new Date().toISOString() };
        Catalog.reset();
        App.persist(); sessions = null; T.loadedFor = '';
        App.toast(`Đã lưu biên bản lên CSDL: ${r.n} giá trị đo`);
      } else if (act === 'dbImportFactory') {
        const FX = App.FX;
        if (!FX) throw new Error('Chưa nạp file số liệu xuất xưởng (.xlsx) — nạp ở mục 0');
        const emb = App.EMB.factory;
        const blob = emb && FX.data.fileName === emb.name
          ? new Blob([Uint8Array.from(atob(emb.b64), ch => ch.charCodeAt(0))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) : null;
        const out = await Records.importFactory(App.state, FX, blob, App.state.cfg.bayId || null);
        Catalog.reset();
        sessions = null; T.loadedFor = ''; T.equipment = null;
        App.toast(`Đã nhập Test report: ${out.map(o => `${o.serial} (${o.n} giá trị)`).join(', ')}`);
      } else if (act === 'dbRefresh') {
        sessions = null;
      } else if (act === 'dbOpen' || act === 'dbExport') {
        const row = await DB.loadSession(btn.dataset.id);
        if (!row.app_state) throw new Error('Biên bản này không có dữ liệu biểu mẫu (nhập từ Test report)');
        App.openState(row.app_state, { sessionId: row.id, equipmentId: row.equipment_id, savedAt: row.updated_at });
        if (act === 'dbExport') await App.exportDocx(); else App.toast('Đã mở biên bản ' + row.test_date);
        busy = false; return;
      } else if (act === 'dbDocs') {
        docs[btn.dataset.id] = await DB.listDocs(btn.dataset.id);
      } else if (act === 'dbDelete') {
        if (!confirm('Xóa biên bản này và toàn bộ số liệu đo khỏi CSDL? Không thể hoàn tác.')) { busy = false; btn.disabled = false; return; }
        const del = await DB.deleteSession(btn.dataset.id);
        if (!del.length) throw new Error('Không có quyền xóa (chỉ admin, hoặc editor xóa bản nháp do mình tạo)');
        if (App.state.db && App.state.db.sessionId === btn.dataset.id) { App.state.db = null; App.persist(); }
        sessions = null; T.loadedFor = '';
        App.toast('Đã xóa biên bản');
      } else if (act === 'dbTrendOf') {
        T.eqId = btn.dataset.eq; T.loadedFor = '';
        busy = false; App.go('trend'); return;
      } else if (act === 'dbSeries') {
        T.series = btn.dataset.key; refreshTrend(); window.scrollTo(0, 0);
        busy = false; return;
      }
      busy = false; // cho phép afterRender tải lại danh sách
      App.render();
    } catch (e) {
      console.error(e);
      App.toast('Lỗi: ' + e.message, true);
    } finally { busy = false; if (btn.isConnected) btn.disabled = false; }
  }

  // Tải tài liệu từ Storage
  document.addEventListener('click', async e => {
    const a = e.target.closest('a[data-dl]');
    if (!a) return;
    e.preventDefault();
    try { App.download(await DB.downloadDoc(a.dataset.dl), a.dataset.name); } catch (err) { App.toast('Lỗi tải tài liệu: ' + err.message, true); }
  });

  function reset() { sessions = null; docs = {}; T.equipment = null; T.data = null; T.loadedFor = ''; T.eqId = ''; }
  window.DbUI = { renderDb, renderTrend, afterRender, action, reset };
})();
