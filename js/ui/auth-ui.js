// Đăng nhập / đăng ký (Google, email), trạng thái phiên, thông báo và vạch tiến trình.
// Trạng thái phiên: unconfigured → checking → signed-out | signed-in; thêm redirecting / signing-out khi đang chuyển.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const OAUTH_FLAG = 'bbtn-mba.oauth-pending';

  // ================================================================ thông báo (toast)
  const ICON = {
    success: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 5.5v5.5M10 14.2v.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    info: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 9v5.5M10 5.8v.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    loading: '<span class="spin" aria-hidden="true"></span>',
  };
  const TIMEOUT = { success: 3200, info: 4500, error: 8000, loading: 0 };
  let seq = 0;
  const Notify = {
    show(o) {
      const opts = typeof o === 'string' ? { msg: o } : o;
      const id = opts.id || 't' + (++seq);
      let el = document.getElementById(id);
      const region = $('#toasts');
      if (!el) {
        el = document.createElement('div');
        el.id = id; el.className = 'toast-item';
        region.appendChild(el);
        while (region.children.length > 4) region.firstElementChild.remove();
      }
      const type = opts.type || 'info';
      el.dataset.type = type;
      el.setAttribute('role', type === 'error' ? 'alert' : 'status');
      el.innerHTML = `<span class="ti-icon">${ICON[type]}</span><div class="ti-body">${opts.title ? `<b>${esc(opts.title)}</b>` : ''}<span>${esc(opts.msg || '')}</span></div>
        ${type === 'loading' ? '' : '<button class="ti-close" aria-label="Đóng thông báo">×</button>'}`;
      const close = el.querySelector('.ti-close');
      if (close) close.onclick = () => Notify.dismiss(id);
      clearTimeout(el._t);
      const t = opts.timeout ?? TIMEOUT[type];
      if (t) el._t = setTimeout(() => Notify.dismiss(id), t);
      return id;
    },
    dismiss(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add('leaving');
      setTimeout(() => el.remove(), reduceMotion() ? 0 : 180);
    },
    async promise(p, m) {
      const id = Notify.show({ type: 'loading', msg: m.loading });
      try { const r = await p; Notify.show({ id, type: 'success', msg: typeof m.success === 'function' ? m.success(r) : m.success }); return r; }
      catch (e) { Notify.show({ id, type: 'error', msg: (m.error ? m.error + ': ' : '') + friendly(e) }); throw e; }
    },
  };

  // ================================================================ vạch tiến trình
  let barTimer = null;
  document.addEventListener('db:activity', e => {
    const bar = $('#netbar');
    if (!bar) return;
    clearTimeout(barTimer);
    // chờ 150 ms để truy vấn nhanh không làm nháy vạch
    if (e.detail > 0) barTimer = setTimeout(() => bar.classList.add('on'), 150);
    else bar.classList.remove('on');
  });

  // ================================================================ thông báo lỗi dễ hiểu
  function friendly(e) {
    const code = e && (e.code || ''), msg = String((e && e.message) || e || '');
    if (/Invalid API key/i.test(msg)) return 'Key Supabase đang dùng không hợp lệ. Vào trang CSDL nhập lại key “anon public”, hoặc tải lại trang (Ctrl+F5) nếu trang đã có cấu hình sẵn.';
    if (code === 'google_disabled') return 'Đăng nhập Google chưa được bật trên CSDL. Quản trị viên cần bật Google tại Supabase → Authentication → Sign In / Providers. Tạm thời dùng đăng nhập email.';
    if (code === 'file_protocol') return 'Đăng nhập Google cần mở app qua địa chỉ http(s) — chạy start.bat (localhost) hoặc dùng bản GitHub Pages, không mở trực tiếp file index.html.';
    if (code === 'invalid_credentials' || /Invalid login credentials/i.test(msg)) return 'Email hoặc mật khẩu không đúng.';
    if (code === 'email_not_confirmed' || /Email not confirmed/i.test(msg)) return 'Email chưa được xác nhận. Mở thư xác nhận trong hộp thư rồi đăng nhập lại.';
    if (code === 'user_already_exists' || /already registered/i.test(msg)) return 'Email này đã có tài khoản. Chuyển sang Đăng nhập hoặc dùng “Quên mật khẩu”.';
    if (code === 'weak_password' || /Password should be/i.test(msg)) return 'Mật khẩu quá yếu — dùng ít nhất 8 ký tự, có chữ và số.';
    if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || /rate limit/i.test(msg)) return 'Thao tác quá nhiều lần trong thời gian ngắn. Thử lại sau ít phút.';
    if (code === 'validation_failed' && /provider is not enabled/i.test(msg) || /provider is not enabled/i.test(msg)) return 'Đăng nhập Google chưa được bật trên Supabase (Authentication → Providers → Google).';
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Không kết nối được máy chủ CSDL. Kiểm tra mạng hoặc URL Supabase.';
    return msg || 'Đã có lỗi không xác định.';
  }

  // ================================================================ trạng thái phiên
  let status = 'unconfigured', sub = null, booted = false;
  const LAMP = {
    unconfigured: ['off', 'Chưa kết nối CSDL'], checking: ['busy', 'Đang kiểm tra phiên đăng nhập'], 'signed-out': ['off', 'Chưa đăng nhập'],
    redirecting: ['busy', 'Đang chuyển sang Google'], 'signing-out': ['busy', 'Đang đăng xuất'],
  };
  const ROLE = { admin: ['Quản trị', 'on'], editor: ['Nhập liệu', 'on'], viewer: ['Chỉ xem', 'warn'], none: ['Chưa được cấp quyền', 'warn'] };

  function setStatus(s) { status = s; renderAccount(); }

  function initials(name) {
    const w = String(name || '?').trim().split(/\s+/);
    return ((w.length > 1 ? w[w.length - 2][0] : '') + w[w.length - 1][0]).toUpperCase();
  }
  const avatarHTML = (p, cls) => (p && p.avatar
    ? `<img class="${cls}" src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="${cls} ini" aria-hidden="true">${esc(initials(p && p.name))}</span>`);

  function renderAccount() {
    const box = $('#account');
    if (!box) return;
    if (status === 'signed-in' && DB.profile) {
      const p = DB.profile, [roleTxt, lamp] = ROLE[DB.role] || ROLE.none;
      box.innerHTML = `<button class="acct" id="acctBtn" aria-haspopup="menu" aria-expanded="false" aria-controls="acctMenu" title="${esc(p.email)} — ${esc(roleTxt)}">
          <span class="lamp ${lamp}" aria-hidden="true"></span>${avatarHTML(p, 'av')}<span class="acct-name">${esc(p.name)}</span><span class="caret" aria-hidden="true"></span></button>
        <div class="acct-menu" id="acctMenu" role="menu" hidden>
          <div class="am-head">${avatarHTML(p, 'av lg')}<div><b>${esc(p.name)}</b><span>${esc(p.email)}</span></div></div>
          <div class="am-role"><span class="lamp ${lamp}" aria-hidden="true"></span><div><b>${esc(roleTxt)}</b>
            <span>${DB.role === 'viewer' || DB.role === 'none' ? 'Bạn xem được số liệu nhưng chưa lưu được. Đề nghị quản trị viên cấp quyền Nhập liệu.' : DB.role === 'admin' ? 'Toàn quyền danh mục, biên bản và người dùng.' : 'Lưu biên bản, nhập Test report, quản lý danh mục.'}</span>
            <span class="am-via">Đăng nhập bằng ${p.provider === 'google' ? 'Google' : 'email'}</span></div></div>
          <button class="am-item" role="menuitem" data-auth="db">Biên bản đã lưu</button>
          <button class="am-item" role="menuitem" data-auth="signout">Đăng xuất</button>
        </div>`;
    } else {
      const [lamp, label] = LAMP[status] || LAMP['signed-out'];
      const busy = lamp === 'busy';
      box.innerHTML = status === 'unconfigured'
        ? `<button class="acct ghost" data-auth="db" title="${label}"><span class="lamp off" aria-hidden="true"></span><span class="acct-name">Kết nối CSDL</span></button>`
        : busy
          ? `<div class="acct ghost" aria-live="polite"><span class="lamp busy" aria-hidden="true"></span><span class="acct-name">${label}…</span></div>`
          : `<button class="acct signin" data-auth="open"><span class="lamp off" aria-hidden="true"></span><span class="acct-name">Đăng nhập</span></button>`;
    }
  }

  function toggleMenu(open) {
    const btn = $('#acctBtn'), menu = $('#acctMenu');
    if (!btn || !menu) return;
    const show = open ?? menu.hidden;
    menu.hidden = !show;
    btn.setAttribute('aria-expanded', String(show));
    if (show) { const first = menu.querySelector('[role=menuitem]'); if (first) first.focus(); }
  }

  // ================================================================ hộp thoại đăng nhập
  let mode = 'signin', pending = null;
  const MODES = {
    signin: { title: 'Đăng nhập', lead: 'Dùng tài khoản của đơn vị để lưu biên bản và xem xu hướng số liệu thí nghiệm.', submit: 'Đăng nhập', busy: 'Đang đăng nhập…' },
    signup: { title: 'Tạo tài khoản', lead: 'Tài khoản mới được xem số liệu ngay. Quyền nhập liệu do quản trị viên cấp.', submit: 'Tạo tài khoản', busy: 'Đang tạo tài khoản…' },
    reset: { title: 'Đặt lại mật khẩu', lead: 'Nhập email đã đăng ký, hệ thống gửi đường dẫn đặt mật khẩu mới.', submit: 'Gửi đường dẫn', busy: 'Đang gửi…' },
    recovery: { title: 'Mật khẩu mới', lead: 'Đặt mật khẩu mới cho tài khoản của bạn.', submit: 'Lưu mật khẩu', busy: 'Đang lưu…' },
    sent: { title: 'Kiểm tra hộp thư' },
  };

  function dialogHTML() {
    const M = MODES[mode];
    if (mode === 'sent') {
      return `<div class="ad-body sent"><div class="sent-mark" aria-hidden="true">✉</div><h2 id="adTitle">${M.title}</h2>
        <p>${esc(pending)}</p><button class="btn primary wide" data-auth="mode" data-mode="signin">Quay lại đăng nhập</button></div>`;
    }
    const google = mode === 'signin' || mode === 'signup';
    return `<div class="ad-body">
      <h2 id="adTitle">${M.title}</h2><p class="ad-lead">${M.lead}</p>
      ${google ? `<button type="button" class="gbtn" data-auth="google"><svg viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.96 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"/></svg>
        <span>${mode === 'signup' ? 'Đăng ký bằng Google' : 'Tiếp tục với Google'}</span></button>
        <div class="ad-or"><span>hoặc dùng email</span></div>` : ''}
      <form id="adForm" novalidate>
        ${mode !== 'recovery' ? `<label class="af"><span>Email</span><input id="adEmail" type="email" autocomplete="email" required value="${esc(pending && pending.email || '')}"></label>` : ''}
        ${mode !== 'reset' ? `<label class="af"><span>${mode === 'recovery' ? 'Mật khẩu mới' : 'Mật khẩu'}</span><span class="pw">
          <input id="adPass" type="password" autocomplete="${mode === 'signin' ? 'current-password' : 'new-password'}" required minlength="${mode === 'signin' ? 1 : 8}">
          <button type="button" class="pw-toggle" data-auth="pw" aria-label="Hiện mật khẩu" aria-pressed="false">Hiện</button></span>
          ${mode !== 'signin' ? '<small>Ít nhất 8 ký tự, nên có chữ và số.</small>' : ''}</label>` : ''}
        <p class="ad-err" id="adErr" role="alert" hidden></p>
        <button class="btn primary wide" id="adSubmit" type="submit"><span class="spin" hidden></span><span class="lbl">${M.submit}</span></button>
      </form>
      <div class="ad-links">
        ${mode === 'signin' ? '<button type="button" class="link" data-auth="mode" data-mode="reset">Quên mật khẩu?</button><span>Chưa có tài khoản? <button type="button" class="link" data-auth="mode" data-mode="signup">Tạo tài khoản</button></span>' : ''}
        ${mode === 'signup' ? '<span>Đã có tài khoản? <button type="button" class="link" data-auth="mode" data-mode="signin">Đăng nhập</button></span>' : ''}
        ${mode === 'reset' ? '<button type="button" class="link" data-auth="mode" data-mode="signin">Quay lại đăng nhập</button>' : ''}
      </div></div>`;
  }

  function openDialog(m) {
    if (!DB.client) { App.go('db'); Notify.show({ type: 'info', msg: 'Nhập URL và key Supabase để kết nối trước khi đăng nhập.' }); return; }
    mode = m || 'signin';
    const d = $('#authDialog');
    $('#adPanel').innerHTML = dialogHTML();
    if (!d.open) d.showModal();
    const f = $('#adEmail') || $('#adPass');
    if (f) f.focus();
  }
  function setMode(m) {
    const email = $('#adEmail') ? $('#adEmail').value : '';
    pending = { email };
    mode = m;
    $('#adPanel').innerHTML = dialogHTML();
    const f = $('#adEmail') || $('#adPass');
    if (f) f.focus();
  }
  function closeDialog() { const d = $('#authDialog'); if (d.open) d.close(); }

  function setBusy(on, which) {
    const panel = $('#adPanel');
    panel.querySelectorAll('input, button').forEach(el => { el.disabled = on; });
    if (which === 'google') {
      const g = panel.querySelector('.gbtn span');
      if (g) g.textContent = on ? 'Đang chuyển sang Google…' : (mode === 'signup' ? 'Đăng ký bằng Google' : 'Tiếp tục với Google');
      panel.querySelector('.gbtn').classList.toggle('busy', on);
    } else {
      const b = $('#adSubmit');
      if (b) { b.querySelector('.spin').hidden = !on; b.querySelector('.lbl').textContent = on ? MODES[mode].busy : MODES[mode].submit; }
    }
  }
  function showErr(msg) { const e = $('#adErr'); if (e) { e.textContent = msg; e.hidden = !msg; } }

  async function submit(ev) {
    ev.preventDefault();
    const email = $('#adEmail') ? $('#adEmail').value.trim() : '';
    const pass = $('#adPass') ? $('#adPass').value : '';
    if ($('#adEmail') && !/^\S+@\S+\.\S+$/.test(email)) { showErr('Email chưa đúng định dạng.'); $('#adEmail').focus(); return; }
    if ($('#adPass') && mode !== 'signin' && pass.length < 8) { showErr('Mật khẩu cần ít nhất 8 ký tự.'); $('#adPass').focus(); return; }
    if ($('#adPass') && !pass) { showErr('Nhập mật khẩu.'); $('#adPass').focus(); return; }
    showErr(''); setBusy(true);
    try {
      if (mode === 'signin') {
        await DB.signIn(email, pass);
        closeDialog(); await afterSignIn('email', false, true);
      } else if (mode === 'signup') {
        const needConfirm = await DB.signUp(email, pass);
        if (needConfirm) { pending = `Đã gửi thư xác nhận tới ${email}. Mở thư, bấm đường dẫn xác nhận rồi quay lại đăng nhập.`; mode = 'sent'; $('#adPanel').innerHTML = dialogHTML(); }
        else { closeDialog(); await afterSignIn('email', true, true); }
      } else if (mode === 'reset') {
        await DB.resetPassword(email);
        pending = `Nếu ${email} đã đăng ký, hệ thống vừa gửi đường dẫn đặt lại mật khẩu. Đường dẫn chỉ dùng được một lần.`;
        mode = 'sent'; $('#adPanel').innerHTML = dialogHTML();
      } else if (mode === 'recovery') {
        await DB.updatePassword(pass);
        closeDialog(); Notify.show({ type: 'success', msg: 'Đã lưu mật khẩu mới.' });
      }
    } catch (e) {
      setBusy(false); showErr(friendly(e));
    }
  }

  async function google() {
    showErr(''); setBusy(true, 'google');
    try {
      sessionStorage.setItem(OAUTH_FLAG, '1');
      setStatus('redirecting');
      await DB.signInWithGoogle(); // trình duyệt chuyển trang sang Google
    } catch (e) {
      sessionStorage.removeItem(OAUTH_FLAG);
      setBusy(false, 'google'); showErr(friendly(e)); setStatus('signed-out');
    }
  }

  // fresh: hồ sơ vừa được tải trong DB.signIn/signUp, không cần hỏi lại máy chủ
  async function afterSignIn(via, isNew, fresh) {
    if (!fresh) await DB.refreshUser();
    setStatus(DB.user ? 'signed-in' : 'signed-out');
    const p = DB.profile;
    if (p) {
      Notify.show({ type: 'success', title: isNew ? 'Đã tạo tài khoản' : `Xin chào, ${p.name}`,
        msg: DB.canEdit() ? `Đăng nhập bằng ${via === 'google' ? 'Google' : 'email'} — quyền ${ROLE[DB.role][0].toLowerCase()}.` : 'Bạn đang ở quyền chỉ xem. Đề nghị quản trị viên cấp quyền Nhập liệu để lưu biên bản.' });
    }
    document.dispatchEvent(new CustomEvent('auth:changed'));
  }

  async function signOut() {
    toggleMenu(false);
    setStatus('signing-out');
    try {
      await DB.signOut();
      setStatus('signed-out');
      Notify.show({ type: 'success', msg: 'Đã đăng xuất. Dữ liệu đang nhập trên máy vẫn được giữ.' });
      document.dispatchEvent(new CustomEvent('auth:changed'));
    } catch (e) {
      await DB.refreshUser(); setStatus(DB.user ? 'signed-in' : 'signed-out');
      Notify.show({ type: 'error', msg: 'Chưa đăng xuất được: ' + friendly(e) });
    }
  }

  // ================================================================ khởi động & theo dõi phiên
  // Gọi lại mỗi khi đổi cấu hình kết nối
  async function init() {
    if (sub) { sub.unsubscribe(); sub = null; }
    if (!DB.client) { setStatus('unconfigured'); return; }
    setStatus('checking');
    const url = new URL(location.href);
    const oauthErr = url.searchParams.get('error_description') || new URLSearchParams(url.hash.slice(1)).get('error_description');
    const hasCode = url.searchParams.has('code') || /(^|&)access_token=/.test(url.hash.slice(1));
    const returning = sessionStorage.getItem(OAUTH_FLAG) && hasCode;
    let exchangeErr = null;
    const tid = returning ? Notify.show({ type: 'loading', msg: 'Đang hoàn tất đăng nhập Google…' }) : null;
    try {
      const ini = await DB.authInit(); // supabase-js đọc phiên từ #access_token (hoặc đổi mã ?code=)
      if (ini && ini.error) { exchangeErr = ini.error; console.warn('Supabase auth init:', ini.error); }
      await DB.refreshUser();
    } catch (e) {
      if (tid) Notify.dismiss(tid);
      Notify.show({ type: 'error', msg: 'Không kiểm tra được phiên đăng nhập: ' + friendly(e) });
    }
    if (tid) Notify.dismiss(tid);
    if (oauthErr) Notify.show({ type: 'error', title: 'Đăng nhập Google không thành công', msg: oauthErr });
    if (url.searchParams.has('code') || url.searchParams.has('error') || /access_token|error/.test(url.hash)) {
      history.replaceState(null, '', location.pathname); // xóa mã xác thực khỏi thanh địa chỉ
    }
    setStatus(DB.user ? 'signed-in' : 'signed-out');
    if (hasCode && !DB.user && !oauthErr) {
      const m = String(exchangeErr && exchangeErr.message || '');
      Notify.show({ type: 'error', title: 'Đăng nhập Google chưa hoàn tất', timeout: 20000,
        msg: (/Invalid API key/i.test(m) ? friendly(exchangeErr)
          : /code verifier|both auth code and code verifier/i.test(m)
          ? 'Trình duyệt không còn mã xác thực của lần bấm đăng nhập. Hãy bấm “Tiếp tục với Google” ngay trên chính trang này (cùng địa chỉ, không dùng cửa sổ khác) rồi thử lại.'
          : /expired|invalid/i.test(m) ? 'Mã đăng nhập đã hết hạn hoặc đã được dùng. Bấm “Tiếp tục với Google” để thử lại.'
          : `Máy chủ không trả về phiên đăng nhập. Kiểm tra Supabase → Authentication → URL Configuration: Redirect URLs phải có ${location.origin + location.pathname.replace(/[^/]*$/, '')}**.`)
          + (exchangeErr ? ` [Chi tiết: ${exchangeErr.code || exchangeErr.status || ''} ${m}]` : '') });
    }
    if (returning) { sessionStorage.removeItem(OAUTH_FLAG); if (DB.user) await afterSignIn('google'); }
    else if (booted) document.dispatchEvent(new CustomEvent('auth:changed'));
    booted = true;

    sub = DB.onAuthChange((event) => {
      // không gọi Supabase trực tiếp trong callback (khuyến cáo của supabase-js)
      setTimeout(async () => {
        if (event === 'PASSWORD_RECOVERY') { openDialog('recovery'); return; }
        if (event === 'SIGNED_OUT' && status === 'signed-in') {
          await DB.refreshUser(); setStatus('signed-out');
          Notify.show({ type: 'info', title: 'Phiên đăng nhập đã kết thúc', msg: 'Đăng nhập lại để tiếp tục lưu dữ liệu lên CSDL.' });
          document.dispatchEvent(new CustomEvent('auth:changed'));
        }
        if (event === 'USER_UPDATED' && status === 'signed-in') { await DB.refreshUser(); renderAccount(); }
      }, 0);
    });
  }

  // ================================================================ sự kiện
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-auth]');
    const menu = $('#acctMenu');
    if (menu && !menu.hidden && !e.target.closest('#account')) toggleMenu(false);
    if (e.target.closest('#acctBtn')) { toggleMenu(); return; }
    if (!t) return;
    const a = t.dataset.auth;
    if (a === 'open') openDialog('signin');
    else if (a === 'signup') openDialog('signup');
    else if (a === 'mode') setMode(t.dataset.mode);
    else if (a === 'google') google();
    else if (a === 'signout') signOut();
    else if (a === 'db') { toggleMenu(false); App.go('db'); }
    else if (a === 'close') closeDialog();
    else if (a === 'pw') {
      const i = $('#adPass'), show = i.type === 'password';
      i.type = show ? 'text' : 'password';
      t.textContent = show ? 'Ẩn' : 'Hiện'; t.setAttribute('aria-pressed', String(show)); t.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    }
  });
  document.addEventListener('submit', e => { if (e.target.id === 'adForm') submit(e); });
  document.addEventListener('keydown', e => {
    const menu = $('#acctMenu');
    if (e.key === 'Escape' && menu && !menu.hidden) { toggleMenu(false); $('#acctBtn').focus(); }
  });
  document.addEventListener('DOMContentLoaded', () => {
    const d = $('#authDialog');
    // bấm ra ngoài khung để đóng
    d.addEventListener('click', e => { if (e.target === d) closeDialog(); });
  });

  window.Notify = Notify;
  window.AuthUI = { init, openDialog, signOut, renderAccount, friendly, get status() { return status; } };
})();
