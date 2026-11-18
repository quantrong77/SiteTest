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

  function pickerHTML() {
    const c = C(), cfg = A.state.cfg;
    const bayOf = id => (c.bays || []).find(b => b.id === id);
    const curBay = bayOf(cfg.pickBay || cfg.bayId);
    const sub = cfg.pickSub || (curBay && curBay.substation_id) || '';
    const bays = (c.bays || []).filter(b => b.substation_id === sub);
    const bayId = curBay && curBay.substation_id === sub ? curBay.id : '';
    const units = bayId ? EquipmentSpecs.bayUnits(c.eqs, bayId, classCode()) : { bank: null, singles: [] };
    const eqVal = cfg.pickEq || '';
    const opt = (v, t, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(t)}</option>`;
    let h = '<div class="fields su-picker">'
      + `<div class="field"><label for="suSub">Trạm</label><select id="suSub" data-su="pickSub">${opt('', '— Chọn trạm —', !sub)}${(c.subs || []).map(s => opt(s.id, s.name, s.id === sub)).join('')}</select></div>`
      + `<div class="field"><label for="suBay">Ngăn (vị trí lắp đặt)</label><select id="suBay" data-su="pickBay" ${sub ? '' : 'disabled'}>${opt('', bays.length || !sub ? '— Chọn ngăn —' : 'Trạm chưa có ngăn', !bayId)}`
      + `${bays.map(b => opt(b.id, `${b.code}${b.name ? ` — ${b.name}` : ''}`, b.id === bayId)).join('')}</select></div>`
      + `<div class="field"><label for="suEq">Thiết bị</label><select id="suEq" data-su="pickEq" ${bayId ? '' : 'disabled'}>${opt('', '— Chọn thiết bị —', !eqVal)}`
      + (units.bank ? opt('bank', `Tổ 3 máy 1 pha: ${PH.filter(p => units.bank[p]).map(p => `${p} ${units.bank[p].serial_no}`).join(' · ')}`, eqVal === 'bank') : '')
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
    if (eqVal === 'new') h += '<div class="hint-text">Thiết bị mới: nhập số chế tạo bên dưới. Có test report (file .xlsx trên máy hoặc trong CSDL) thì thông số kỹ thuật được tự nạp; chưa có thì nhập tay ở bước ②.</div>';
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
    if (!signedIn() || C().subs || C().loading) return;
    await Catalog.load();
    if (A.currentSection() === 'general') A.renderMain();
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
    const units = EquipmentSpecs.bayUnits(c.eqs, bay.id, classCode());
    cfg.bayId = bay.id;
    let eq = null;
    if (cfg.pickEq === 'bank' && units.bank) {
      PH.forEach(p => { if (units.bank[p]) cfg.ps[p] = units.bank[p].serial_no; });
      const ph = cfg.pickPhase || 'A';
      if (ph === 'ALL') { await A.applyTemplate('3P'); st.v['meta.serial'] = cfg.ps.A; eq = units.bank.A || Object.values(units.bank)[0]; }
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

  window.SetupUI = { deviceHTML, afterRender, action };
})();
