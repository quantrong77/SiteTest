// Trình khởi tạo BBTN — bước ① Thiết bị: chọn Trạm → Ngăn (vị trí lắp đặt) → Thiết bị → Pha (tổ 3 máy 1 pha rời) từ danh mục CSDL,
// rồi áp: gắn ngăn, chọn template theo cấu hình / pha, số chế tạo các máy, tự nạp test report và thông số kỹ thuật
// (thứ tự nguồn CSDL → test report → nhập tay, EquipmentSpecs). Chưa đăng nhập: nhập tay như trước.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  let A = null;
  const esc = s => A.esc(s);
  const C = () => (window.Catalog && Catalog.data) || {};
  const signedIn = () => !!(window.DB && DB.client && DB.user);
  const classCode = () => EquipmentTypes.codeOf(A.state);
  const PH = EquipmentSpecs.PHASES;
  const up = x => String(x || '').trim().toUpperCase();
  const vnDate = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d || ''); };
  // các lần FAT đã lưu CSDL (biết số chế tạo nào đã có giá trị khởi đầu)
  const fat = { list: null, forUser: null, loading: false };
  async function loadFat(force) {
    if (!signedIn() || fat.loading || (!force && fat.list && fat.forUser === DB.user.id)) return false;
    fat.loading = true;
    try { fat.list = await DB.listFactorySessions(); fat.forUser = DB.user.id; } catch (err) { fat.list = null; } finally { fat.loading = false; }
    return true;
  }
  // số chế tạo của biên bản: tổ 3 máy 1 pha → các pha; còn lại → máy chính
  const recordSerials = () => {
    const st = A.state;
    return (st.cfg.topology === 'bank1p' ? PH.map(p => st.cfg.ps[p]) : [st.v['meta.serial']]).map(x => String(x || '').trim()).filter(Boolean);
  };
  const activeFile = () => (A.factories || []).find(x => x.api === A.FX) || null;

  function pickerHTML() {
    const c = C(), cfg = A.state.cfg;
    const bayOf = id => (c.bays || []).find(b => b.id === id);
    const curBay = bayOf(cfg.pickBay || cfg.bayId);
    const sub = cfg.pickSub || (curBay && curBay.substation_id) || '';
    const bays = (c.bays || []).filter(b => b.substation_id === sub);
    const bayId = curBay && curBay.substation_id === sub ? curBay.id : '';
    const units = bayId ? EquipmentSpecs.bayUnits(c.eqs, bayId, classCode(), c.groups) : { bank: null, singles: [] };
    const eqVal = cfg.pickEq || '';
    const opt = (v, t, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(t)}</option>`;
    let h = '<div class="fields su-picker">'
      + `<div class="field"><label for="suSub">Trạm</label><select id="suSub" data-su="pickSub">${opt('', '— Chọn trạm —', !sub)}${(c.subs || []).map(s => opt(s.id, s.name, s.id === sub)).join('')}</select></div>`
      + `<div class="field"><label for="suBay">Ngăn (vị trí lắp đặt)</label><select id="suBay" data-su="pickBay" ${sub ? '' : 'disabled'}>${opt('', bays.length || !sub ? '— Chọn ngăn —' : 'Trạm chưa có ngăn', !bayId)}`
      + `${bays.map(b => opt(b.id, `${b.code}${b.name ? ` — ${b.name}` : ''}`, b.id === bayId)).join('')}</select></div>`
      + `<div class="field"><label for="suEq">Thiết bị</label><select id="suEq" data-su="pickEq" ${bayId ? '' : 'disabled'}>${opt('', '— Chọn thiết bị —', !eqVal)}`
      + (units.bank ? opt('bank', `${units.bank.group ? units.bank.group.name : 'Tổ 3 máy 1 pha'}: ${PH.filter(p => units.bank[p]).map(p => `${p} ${units.bank[p].serial_no}`).join(' · ')}`, eqVal === 'bank') : '')
      + units.singles.map(e => opt(e.id, `${e.name || e.class_name || e.class_code} — ${e.serial_no}${e.phase ? ` (pha ${e.phase})` : ''}`, eqVal === e.id)).join('')
      + (bayId ? opt('new', '＋ Thiết bị mới trong ngăn này', eqVal === 'new') : '') + '</select></div>';
    if (eqVal === 'bank' && units.bank) {
      const ph = cfg.pickPhase || 'A';
      h += `<div class="field"><label for="suPhase">Pha</label><select id="suPhase" data-su="pickPhase">`
        + PH.filter(p => units.bank[p]).map(p => opt(p, `Pha ${p} — ${units.bank[p].serial_no} (BBTN riêng máy pha ${p})`, ph === p)).join('')
        + opt('ALL', 'Cả tổ A+B+C — một BBTN chung (mẫu 3 pha)', ph === 'ALL') + '</select></div>';
    }
    const ready = bayId && eqVal && (eqVal !== 'bank' || units.bank);
    h += `<div class="field"><label>&nbsp;</label><button class="btn primary" data-act="suApply" ${ready ? '' : 'disabled'}>Chọn thiết bị này →</button></div></div>`;
    if (eqVal === 'new') h += '<div class="hint-text">Thiết bị mới: nhập số chế tạo bên dưới, hoặc bấm <b>Nhập Test Report (.xlsx)…</b> (file một máy: số chế tạo tự điền). Có test report thì thông số kỹ thuật được tự nạp; chưa có thì nhập tay ở bước ②.</div>';
    const applied = bayOf(cfg.bayId);
    if (applied) {
      const s = (c.subs || []).find(x => x.id === applied.substation_id);
      h += `<div class="callout su-applied">Biên bản đang gắn: <b>${esc(s ? s.name : '')}</b> · ngăn <b>${esc(applied.code)}</b>${applied.name ? ` (${esc(applied.name)})` : ''}. Lưu CSDL sẽ ghi thiết bị vào ngăn này.</div>`;
    }
    return h;
  }

  function deviceHTML(App) {
    A = App;
    let h = '<h3>Chọn thiết bị từ danh mục</h3>';
    if (!window.DB || !DB.client) return h + '<div class="callout warn">Chưa cấu hình CSDL — nhập thông tin thiết bị trực tiếp bên dưới.</div>';
    if (!DB.user) return h + '<div class="callout">Đăng nhập để chọn <b>Trạm → Ngăn → Thiết bị</b> từ danh mục và tự nạp thông số kỹ thuật. Chưa đăng nhập: nhập trực tiếp bên dưới.</div>';
    if (!C().subs) return h + '<div class="empty" id="suPicker">Đang tải danh mục…</div>';
    return h + `<div id="suPicker">${pickerHTML()}</div><div class="hint-text">Trạm / ngăn / thiết bị chưa có trong danh mục: thêm ở <button class="btn small" data-nav="catalog">Trạm – Ngăn – Thiết bị</button>, hoặc chọn “Thiết bị mới”.</div>`;
  }

  async function afterRender(App) {
    A = App;
    if (!signedIn()) return;
    const tasks = [loadFat()];
    if (!C().subs && !C().loading) tasks.push(Catalog.load().then(() => true));
    const changed = (await Promise.all(tasks)).some(Boolean);
    if (changed && A.currentSection() === 'general') A.renderMain();
  }

  // Khối "Test report xuất xưởng" (bước ① và ②): nhập file, tình trạng, lưu CSDL làm giá trị khởi đầu
  function reportHTML(App) {
    A = App;
    const sns = recordSerials(), FX = A.FX, file = activeFile();
    const inFile = FX ? sns.filter(sn => FX.has(sn)) : [];
    let h = '<h3>Test report xuất xưởng</h3><div class="row-actions"><button class="btn" data-act="suImport" '
      + 'title="Nạp file test report (.xlsx) của thiết bị: tự điền số chế tạo (file một máy), thông số kỹ thuật và dùng làm số liệu so sánh">Nhập Test Report (.xlsx)…</button></div>';
    if (!sns.length) return h + '<div class="hint-text">Chưa có số chế tạo. Nhập test report: file chỉ có một máy (hoặc tổ 3 máy pha A / B / C) thì số chế tạo được điền tự động.</div>';
    h += inFile.length
      ? `<div class="hint-text">Đang dùng <b>${esc(file ? file.name : FX.data.fileName)}</b> cho ${esc(inFile.join(', '))}: thông số kỹ thuật và số liệu xuất xưởng để so sánh.</div>`
      : `<div class="callout">Chưa có test report của ${esc(sns.join(', '))} trên máy này — thông số kỹ thuật nhập tay, các hạng mục không so được với số liệu xuất xưởng.</div>`;
    if (!signedIn() || !fat.list) return h;
    const fatOf = sn => fat.list.filter(x => up(x.serial_no) === up(sn)).sort((a, b) => String(b.test_date || '').localeCompare(String(a.test_date || '')))[0];
    const saved = sns.filter(fatOf), unsaved = inFile.filter(sn => !fatOf(sn));
    if (saved.length) h += `<div class="hint-text">Đã có số liệu xuất xưởng trong CSDL (giá trị khởi đầu): ${saved.map(sn => `${esc(sn)} — FAT ${esc(vnDate(fatOf(sn).test_date))}`).join('; ')}.</div>`;
    if (unsaved.length) {
      const bay = ((C().bays || []).find(b => b.id === A.state.cfg.bayId));
      const can = DB.canEdit();
      h += `<div class="callout warn"><b>Test report của ${esc(unsaved.join(', '))} chưa lưu CSDL.</b> Lưu để làm <b>giá trị khởi đầu</b> (thiết bị mới, chưa vận hành): `
        + 'lần sau khởi tạo BBTN (sau lắp đặt, định kỳ) chọn thiết bị ở bước ① là tự lấy thông số và so sánh.'
        + `${bay ? ` Thiết bị mới được gắn vào ngăn <b>${esc(bay.code)}</b>.` : ' Biên bản chưa gắn ngăn — thiết bị mới nằm ở nhóm “Chưa gắn trạm / ngăn”.'}`
        + (FX.data.reportDate ? '' : '<div class="fields"><div class="field flag-missing"><label for="suFatDate">Ngày thí nghiệm xuất xưởng (nhập tay — file không ghi / không đọc được)</label>'
          + '<input id="suFatDate" type="date" required></div></div><div class="hint-text">Mục khác không đọc được thì bỏ trống; sửa sau ở <b>XX</b> → chuột phải → <b>Sửa giá trị đo</b>.</div>')
        + `<div class="row-actions"><button class="btn primary" data-act="suSaveReport" ${can ? '' : 'disabled title="Tài khoản chỉ xem"'}>Lưu test report lên CSDL</button></div></div>`;
    }
    return h;
  }

  // file vừa nạp từ nút "Nhập Test Report": điền số chế tạo (nếu chưa có), rồi thông số kỹ thuật
  async function afterImport(entry) {
    const st = A.state, cfg = st.cfg, D = entry.api.data;
    if (!recordSerials().length) {
      if (cfg.topology === 'bank1p') {
        D.order.forEach(sn => { const p = up((D.units[sn] || {}).phase); if (PH.includes(p) && !cfg.ps[p]) cfg.ps[p] = sn; });
        st.v['meta.serial'] = cfg.ps.A || '';
      } else if (D.order.length === 1) st.v['meta.serial'] = D.order[0];
      if (!recordSerials().length) { A.persist(); A.setupGo('device'); A.toast(`File có ${D.order.length} máy (${D.order.join(', ')}) — nhập số chế tạo của thiết bị ở bước ①`, true); return; }
    } else if (!recordSerials().some(sn => entry.api.has(sn))) {
      A.toast(`File ${entry.name} không có số chế tạo ${recordSerials().join(', ')} (file có: ${D.order.join(', ')})`, true);
      return;
    }
    await refill();
    if (A.currentSection() === 'general') A.setupGo('specs');
  }

  async function saveReport() {
    if (!DB.canEdit()) throw new Error('Cần đăng nhập tài khoản có quyền ghi');
    const FX = A.FX, file = activeFile();
    if (!FX || !file) throw new Error('Chưa nạp test report');
    const sns = recordSerials().filter(sn => FX.has(sn));
    if (!sns.length) throw new Error('File test report đang dùng không có số chế tạo của biên bản');
    const dateIn = $('#suFatDate'), date = dateIn ? dateIn.value : '';
    if (!FX.data.reportDate && !date) { if (dateIn) dateIn.focus(); throw new Error('Nhập ngày thí nghiệm xuất xưởng (file không ghi hoặc không đọc được)'); }
    const out = await Records.importFactory(A.state, FX, A.factoryBlob(file.name), A.state.cfg.bayId || null, sns, { test_date: date });
    if (window.Catalog) Catalog.reset();
    if (window.FactoryUI) FactoryUI.reset();
    await loadFat(true);
    A.renderMain();
    A.toast(`Đã lưu test report lên CSDL: ${out.map(o => `${o.serial} (${o.n} giá trị)`).join(', ')} — dùng làm giá trị khởi đầu`);
  }

  // test report của thiết bị trong CSDL (lần FAT mới nhất có file gốc) → nạp làm file xuất xưởng (lặng)
  async function loadReport(eqId) {
    const ses = (await DB.listFactorySessions()).filter(s => s.equipment_id === eqId).sort((a, b) => String(b.test_date || '').localeCompare(String(a.test_date || '')));
    for (const s of ses) {
      const doc = (await DB.listDocs(s.id)).find(d => d.kind === 'FACTORY_REPORT');
      if (!doc) continue;
      const blob = await DB.downloadDoc(doc.storage_path);
      A.addFactoryFile(doc.file_name, await blob.arrayBuffer(), true);
      return doc.file_name;
    }
    return null;
  }

  // điền thông số đầu biên bản cho thiết bị eq (null: thiết bị mới) theo số chế tạo đang nhập
  async function fillSpecs(eq, where) {
    const serial = String(A.state.v['meta.serial'] || A.state.cfg.ps.A || '').trim();
    A.pickFactory(true);
    let report = null;
    const fxHas = () => A.FX && serial && A.FX.unit(serial);
    if (!fxHas() && eq && signedIn()) { try { report = await loadReport(eq.id); } catch (err) { A.toast('Không tải được test report từ CSDL: ' + err.message, true); } }
    const fx = fxHas() ? A.FX.data.specs : null;
    const plan = A.applyHeadFills(EquipmentSpecs.headFrom(eq, fx, where));
    const n = { CSDL: 0, 'Test report': 0 };
    Object.values(plan).forEach(f => { n[f.src] += 1; });
    return { n, report, fx: !!fx };
  }

  async function apply() {
    const c = C(), st = A.state, cfg = st.cfg;
    // ngăn đang chọn trên bộ chọn trước, ngăn đã gắn của biên bản sau
    const bay = (c.bays || []).find(b => b.id === cfg.pickBay) || (c.bays || []).find(b => b.id === cfg.bayId);
    if (!bay) throw new Error('Chưa chọn ngăn');
    const sub = (c.subs || []).find(s => s.id === bay.substation_id) || {};
    const units = EquipmentSpecs.bayUnits(c.eqs, bay.id, classCode(), c.groups);
    cfg.bayId = bay.id;
    let eq = null;
    if (cfg.pickEq === 'bank' && units.bank) {
      PH.forEach(p => { if (units.bank[p]) cfg.ps[p] = units.bank[p].serial_no; });
      const ph = cfg.pickPhase || 'A';
      if (ph === 'ALL') { await A.applyTemplate('3P'); st.v['meta.serial'] = cfg.ps.A; eq = units.bank[PH.find(p => units.bank[p])]; }
      else { await A.applyTemplate(ph); eq = units.bank[ph]; st.v['meta.serial'] = eq.serial_no; }
    } else if (cfg.pickEq && cfg.pickEq !== 'new') {
      eq = units.singles.find(e => e.id === cfg.pickEq);
      if (!eq) throw new Error('Không còn thiết bị này trong ngăn');
      st.v['meta.serial'] = eq.serial_no;
      const p = String(eq.phase || '').toUpperCase();
      if (eq.rated && eq.rated.oltc_winding) await A.applyTemplate('110');
      else if (PH.includes(p) && Schema.layoutOf(cfg) === '1P') await A.applyTemplate(p);
    }
    const r = await fillSpecs(eq, { substation: sub.name, bay: bay.name || bay.code });
    A.rebuild(true);
    A.loadTrend(); // lịch sử đo của máy (và các máy cùng tổ) cho xu hướng, so sánh giữa các pha
    A.setupGo('specs');
    const parts = [r.n.CSDL ? `${r.n.CSDL} ô từ CSDL` : '', r.n['Test report'] ? `${r.n['Test report']} ô từ test report${r.report ? ` (${r.report})` : ''}` : ''].filter(Boolean);
    A.toast(eq || cfg.pickEq === 'new'
      ? `Đã chọn ${eq ? eq.serial_no : 'thiết bị mới'} — ${parts.length ? `tự điền ${parts.join(', ')}; ô tô nền cần kiểm tra` : 'chưa có thông số trong CSDL / test report, nhập tay'}`
      : 'Đã gắn ngăn');
  }

  // bước ②: điền lại theo số chế tạo đang nhập (thiết bị trong danh mục hoặc test report)
  async function refill() {
    const serial = String(A.state.v['meta.serial'] || A.state.cfg.ps.A || '').trim().toUpperCase();
    if (!serial) throw new Error('Chưa có số chế tạo');
    let eq = null, where = {};
    if (signedIn()) {
      if (!C().subs) await Catalog.load();
      eq = (C().eqs || []).find(e => !e.parent_id && e.class_code === classCode() && String(e.serial_no || '').trim().toUpperCase() === serial) || null;
      if (eq) where = { substation: eq.substation_name, bay: eq.bay_name || eq.bay_code };
    }
    const r = await fillSpecs(eq, where);
    A.rebuild(false);
    const total = r.n.CSDL + r.n['Test report'];
    A.toast(total ? `Đã điền ${total} ô (${r.n.CSDL} từ CSDL, ${r.n['Test report']} từ test report)` : 'Không có thông số mới để điền (ô đã nhập tay được giữ nguyên)');
  }

  async function action(act) {
    if (act === 'suApply') await apply();
    else if (act === 'suFill') await refill();
    else if (act === 'suImport') A.pickXlsx({ page: 'setup' });
    else if (act === 'suSaveReport') await saveReport();
  }

  document.addEventListener('change', e => {
    const t = e.target;
    if (!A || !t.dataset || !t.dataset.su) return;
    const cfg = A.state.cfg, k = t.dataset.su;
    cfg[k] = t.value;
    if (k === 'pickSub') { cfg.pickBay = ''; cfg.pickEq = ''; }
    if (k === 'pickBay') cfg.pickEq = '';
    if (k === 'pickEq') cfg.pickPhase = cfg.pickPhase || 'A';
    A.persist();
    const w = $('#suPicker');
    if (w) { w.innerHTML = pickerHTML(); const again = $(`[data-su="${k}"]`); if (again) again.focus(); }
  });

  document.addEventListener('factory:added', e => {
    const d = e.detail || {};
    if (!A || !d.purpose || d.purpose.page !== 'setup' || !d.entry) return;
    afterImport(d.entry).catch(err => A.toast('Lỗi: ' + err.message, true));
  });
  document.addEventListener('auth:changed', () => { fat.list = null; fat.forUser = null; });

  window.SetupUI = { deviceHTML, reportHTML, afterRender, action };
})();
