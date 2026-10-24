// Kho dữ liệu Supabase: kết nối, đăng nhập, ghi/đọc lần thí nghiệm, thiết bị, tài liệu, danh mục.
// Không biết loại thiết bị: các dòng số liệu do mô-đun loại thiết bị dựng sẵn (js/domain/types/*/to-rows.js).
(function () {
  'use strict';
  const LS_CFG = 'bbtn-mba.supabase';
  const BUCKET = 'test-documents';

  // ======================================================================= Supabase I/O
  let client = null, user = null, role = 'none', profile = null;
  // Cấu hình do trang cung cấp (js/config.js, GitHub Pages) luôn được ưu tiên; cấu hình nhập tay chỉ dùng khi trang chưa có
  const siteCfg = () => { const c = window.SUPABASE_CONFIG || {}; return c.url && c.key ? { url: c.url, key: c.key, fromSite: true } : null; };
  const cfgGet = () => {
    const site = siteCfg();
    if (site) { try { localStorage.removeItem(LS_CFG); } catch (e) { /* bỏ qua */ } return site; }
    try { return JSON.parse(localStorage.getItem(LS_CFG) || '{}'); } catch (e) { return {}; }
  };
  // Kiểm tra URL + key với máy chủ trước khi dùng: trả về null nếu hợp lệ, hoặc câu báo lỗi
  async function checkConfig(url, key) {
    if (!/^https:\/\/[\w-]+\.supabase\.co\/?$/.test(String(url).trim()) && !/^https?:\/\//.test(String(url).trim())) return 'URL không đúng dạng https://<mã-project>.supabase.co';
    try {
      const r = await fetch(String(url).trim().replace(/\/$/, '') + '/auth/v1/settings', { headers: { apikey: String(key).trim() } });
      if (r.status === 401) return 'Key không hợp lệ cho project này. Chép lại key “anon public” (Project Settings → API Keys), không dùng key service_role.';
      if (!r.ok) return `Máy chủ trả mã ${r.status}. Kiểm tra lại URL project.`;
      return null;
    } catch (e) { return 'Không kết nối được tới URL này. Kiểm tra lại URL và mạng.'; }
  }

  // Đếm số yêu cầu mạng đang chạy để giao diện hiện vạch tiến trình
  let inflight = 0;
  const activity = n => { inflight = Math.max(0, inflight + n); document.dispatchEvent(new CustomEvent('db:activity', { detail: inflight })); };
  const trackedFetch = (...args) => { activity(1); return fetch(...args).finally(() => activity(-1)); };

  function connect(url, key) {
    if (url !== undefined && !siteCfg()) { try { localStorage.setItem(LS_CFG, JSON.stringify({ url: String(url).trim(), key: String(key).trim() })); } catch (e) { /* phiên tạm */ } }
    const c = cfgGet();
    client = null; user = null; role = 'none'; profile = null;
    if (!c.url || !c.key || !window.supabase) return false;
    client = window.supabase.createClient(c.url.trim(), c.key.trim(), {
      // implicit: máy chủ trả phiên thẳng về trang (#access_token), không có bước đổi mã ?code= dễ lỗi trên trang tĩnh
      auth: { persistSession: true, storageKey: 'bbtn-mba-auth', flowType: 'implicit', detectSessionInUrl: true, autoRefreshToken: true },
      global: { fetch: trackedFetch },
    });
    return true;
  }
  const need = () => { if (!client) throw new Error('Chưa cấu hình kết nối Supabase (URL + anon key)'); return client; };
  const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  // Giữ mã lỗi của Supabase Auth để giao diện diễn giải thành thông báo dễ hiểu
  const authChk = ({ data, error }) => { if (error) throw Object.assign(new Error(error.message), { code: error.code, status: error.status }); return data; };

  async function refreshUser() {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    user = data && data.session ? data.session.user : null;
    role = 'none'; profile = null;
    if (user) {
      const meta = user.user_metadata || {};
      const r = await client.from('app_users').select('role, full_name, avatar_url').eq('user_id', user.id).maybeSingle();
      const row = r.data || {};
      role = row.role || 'none';
      profile = {
        email: user.email,
        name: row.full_name || meta.full_name || meta.name || (user.email || '').split('@')[0],
        avatar: row.avatar_url || meta.avatar_url || meta.picture || null,
        provider: (user.app_metadata && user.app_metadata.provider) || 'email',
      };
    }
    return user;
  }
  async function signIn(email, password) { authChk(await need().auth.signInWithPassword({ email, password })); return refreshUser(); }
  // Trả về true nếu cần xác nhận email trước khi đăng nhập
  async function signUp(email, password) {
    const d = authChk(await need().auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } }));
    await refreshUser();
    return !d.session;
  }
  const appUrl = () => location.origin + location.pathname;
  async function signInWithGoogle() {
    if (location.protocol === 'file:') {
      throw Object.assign(new Error('file-protocol'), { code: 'file_protocol' });
    }
    // Hỏi trước máy chủ xem Google đã bật chưa — nếu chưa, Supabase chỉ trả trang JSON lỗi sau khi đã chuyển trang
    try {
      const c = cfgGet();
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 4000); // mạng chậm: bỏ qua bước kiểm tra, không giữ người dùng chờ
      const r = await fetch(c.url.trim().replace(/\/$/, '') + '/auth/v1/settings', { headers: { apikey: c.key.trim() }, signal: ctl.signal })
        .finally(() => clearTimeout(timer));
      if (r.ok) {
        const s = await r.json();
        if (s.external && s.external.google === false) throw Object.assign(new Error('google-disabled'), { code: 'google_disabled' });
      }
    } catch (e) { if (e.code === 'google_disabled') throw e; /* lỗi mạng: để bước chuyển trang tự báo */ }
    authChk(await need().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appUrl(), queryParams: { prompt: 'select_account' } } }));
  }
  async function resetPassword(email) { authChk(await need().auth.resetPasswordForEmail(email, { redirectTo: appUrl() })); }
  async function updatePassword(password) { authChk(await need().auth.updateUser({ password })); }
  async function signOut() { if (client) authChk(await client.auth.signOut()); user = null; role = 'none'; profile = null; }
  // Kết quả khởi tạo phiên (gồm đổi mã ?code= → phiên khi quay về từ Google); trả về lỗi nếu có
  const authInit = async () => (client && client.auth.initialize ? client.auth.initialize() : { error: null });
  const onAuthChange = cb => (client ? client.auth.onAuthStateChange(cb).data.subscription : null);

  // Tạo/cập nhật thiết bị theo (loại, số chế tạo); thiết bị cha trước, chỉ ghi các trường có giá trị
  // bayId: ngăn lộ gắn cho thiết bị chính (không có cha) nếu thiết bị chưa thuộc ngăn nào
  async function ensureEquipment(refs, bayId) {
    const ids = {};
    const order = refs.filter(r => !r.parent).concat(refs.filter(r => r.parent));
    for (const r of order) {
      const payload = { class_code: r.class_code, serial_no: r.serial_no };
      ['name', 'position', 'phase', 'manufacturer', 'model', 'year_made'].forEach(k => { if (r[k] !== undefined && r[k] !== null && r[k] !== '') payload[k] = r[k]; });
      if (r.parent) payload.parent_id = ids[r.parent];
      const cur = chk(await need().from('equipment').select('id, rated, bay_id').eq('class_code', r.class_code).eq('serial_no', r.serial_no).maybeSingle());
      if (bayId && !r.parent && !(cur && cur.bay_id)) payload.bay_id = bayId;
      if (r.rated) payload.rated = Object.assign({}, cur ? cur.rated : {}, Object.fromEntries(Object.entries(r.rated).filter(([, x]) => x !== undefined && x !== null && x !== '')));
      if (cur) { chk(await need().from('equipment').update(payload).eq('id', cur.id)); ids[r.key] = cur.id; }
      else ids[r.key] = chk(await need().from('equipment').insert(payload).select('id').single()).id;
    }
    return ids;
  }

  async function writeSession(pack, sessionId, extra = {}) {
    if (!pack.session.test_date) throw new Error('Thiếu/không đọc được ngày thí nghiệm (dd/mm/yyyy)');
    const ids = await ensureEquipment(pack.refs, extra.bayId);
    extra = Object.assign({}, extra);
    delete extra.bayId;
    const body = Object.assign({}, pack.session, extra, { equipment_id: ids[pack.mainRef] });
    let id = sessionId;
    if (id) {
      const upd = chk(await need().from('test_sessions').update(body).eq('id', id).select('id'));
      if (!upd.length) id = null; // đã bị xóa trên CSDL → tạo mới
    }
    if (!id) id = chk(await need().from('test_sessions').insert(body).select('id').single()).id;
    const rows = pack.rows.map(r => { const o = Object.assign({}, r, { equipment_id: ids[r.eq] }); delete o.eq; return o; });
    const n = chk(await need().rpc('replace_session_data', { p_session_id: id, p_measurements: rows, p_findings: pack.findings || [] }));
    return { id, n, equipmentId: ids[pack.mainRef] };
  }

  // pack: dòng số liệu của biên bản (mô-đun loại thiết bị dựng); state lưu kèm để mở lại biên bản
  async function saveField(pack, state, status) {
    const appState = JSON.parse(JSON.stringify(state));
    delete appState.db;
    return writeSession(pack, state.db && state.db.sessionId, { app_state: appState, status: status || 'draft', bayId: state.cfg.bayId || null });
  }

  // packs: các lần thí nghiệm xuất xưởng (mỗi máy một lần) do mô-đun loại thiết bị dựng từ file Test report
  async function importFactory(packs, fileName, fileBlob, bayId) {
    const out = [];
    for (const pack of packs) {
      if (!pack.session.test_date) throw new Error('Không đọc được ngày thí nghiệm trong file xuất xưởng');
      const ids = await ensureEquipment(pack.refs, bayId);
      const ex = chk(await need().from('test_sessions').select('id').eq('equipment_id', ids[pack.mainRef]).eq('kind', 'FAT').eq('source', 'factory_import').limit(1));
      const r = await writeSession(pack, ex.length ? ex[0].id : null, { status: 'final', bayId });
      if (fileBlob) await uploadDoc(r.id, r.equipmentId, 'FACTORY_REPORT', `${pack.serial}/factory/${fileName}`, fileName, fileBlob);
      out.push({ serial: pack.serial, id: r.id, n: r.n });
    }
    return out;
  }

  async function uploadDoc(sessionId, equipmentId, kind, path, fileName, blob) {
    const safe = path.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\w./-]+/g, '_');
    chk(await need().storage.from(BUCKET).upload(safe, blob, { upsert: true, contentType: blob.type || undefined }));
    chk(await need().from('documents').upsert({ session_id: sessionId, equipment_id: equipmentId, kind, storage_path: safe, file_name: fileName, size_bytes: blob.size },
      { onConflict: 'storage_path' }));
    return safe;
  }
  async function downloadDoc(path) { return chk(await need().storage.from(BUCKET).download(path)); }

  const listSessions = async () => chk(await need().from('v_session_list').select('*').order('test_date', { ascending: false }).limit(500));
  const loadSession = async id => chk(await need().from('test_sessions').select('*').eq('id', id).single());
  const deleteSession = async id => chk(await need().from('test_sessions').delete().eq('id', id).select('id'));
  const listDocs = async sessionId => chk(await need().from('documents').select('*').eq('session_id', sessionId).order('created_at'));
  const listEquipment = async () => chk(await need().from('v_equipment').select('*').order('class_code').order('serial_no'));

  // ---------- Danh mục Trạm / Ngăn / Thiết bị (CRUD)
  const listSubstations = async () => chk(await need().from('v_substations').select('*').order('name'));
  const listBays = async () => chk(await need().from('v_bays').select('*').order('code'));
  const listClasses = async () => chk(await need().from('equipment_classes').select('*').order('is_component').order('code'));
  // Bảng hệ số quy đổi tgδ sứ (QĐ 1901, theo hãng) — admin cấu hình
  const listKTables = async () => chk(await need().from('bushing_k_tables').select('*').order('basis', { ascending: false }).order('name'));
  const FK_MSG = { bays: 'ngăn lộ', substations: 'trạm', equipment: 'thiết bị' };
  async function crud(op, table, payload, id) {
    let q = need().from(table);
    if (op === 'insert') q = q.insert(payload).select().single();
    else if (op === 'update') q = q.update(payload).eq('id', id).select();
    else q = q.delete().eq('id', id).select('id');
    const { data, error } = await q;
    if (error) {
      if (error.code === '23503') throw new Error(`Không xóa/sửa được ${FK_MSG[table] || ''}: vẫn còn dữ liệu phụ thuộc (ngăn lộ, thiết bị hoặc số liệu thí nghiệm). Hãy chuyển hoặc xóa dữ liệu đó trước.`);
      if (error.code === '23505') throw new Error('Trùng dữ liệu: mã/tên hoặc (loại, số chế tạo) đã tồn tại.');
      throw new Error(error.message);
    }
    if (op !== 'insert' && Array.isArray(data) && !data.length) throw new Error('Không có quyền thực hiện (cần quyền editor/admin)');
    return data;
  }
  async function trend(equipmentIds) {
    return chk(await need().from('v_trend_delta').select('*').in('equipment_id', equipmentIds).order('test_date').limit(20000));
  }

  window.DB = {
    connect, cfgGet, checkConfig, siteCfg, refreshUser, signIn, signUp, signOut, signInWithGoogle, resetPassword, updatePassword, onAuthChange, authInit, saveField, importFactory, uploadDoc, downloadDoc,
    listSessions, loadSession, deleteSession, listDocs, listEquipment, trend, listSubstations, listBays, listClasses, listKTables, crud,
    get client() { return client; }, get user() { return user; }, get role() { return role; }, get profile() { return profile; },
    get busy() { return inflight; },
    canEdit: () => role === 'editor' || role === 'admin',
  };
})();
