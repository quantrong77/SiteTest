// Nhập số liệu bằng Web Speech API, dùng lại các sự kiện nhập tay của biểu mẫu.
// Lệnh: "dừng" / "dừng lại", "lùi" / "quay lại", "bỏ qua" / "tiếp", "xóa" / "xóa ô"; còn lại đọc thành số (VnNumber).
// Trang Nhập hiện trường (ô data-fe): chuyển ô qua FieldUI; khi đang nghe tắt bàn phím ảo (inputmode="none").
(function () {
  'use strict';
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) { window.VoiceInput = null; return; }
  let recognition = null, continuous = false, active = false, lastCell = null;
  const selector = '#main input[data-g]:not([readonly]):not(:disabled):not(.text), #main input[data-k][inputmode="decimal"]:not([readonly]):not(:disabled):not(.text), #main input[data-fe="cell"]';
  const editable = el => el && !el.readOnly && !el.disabled && !el.classList.contains('text');
  // ô kế tiếp cùng cột (bỏ qua hàng không áp dụng / chỉ đọc); hết cột → null
  function move(cell, step) {
    if (!cell) return null;
    if (cell.dataset.fe === 'cell' && window.FieldUI) { FieldUI.step(step); return cell; }
    if (!cell.matches('input[data-g]')) return null;
    const table = cell.closest('table');
    let next = null;
    for (let row = +cell.dataset.r + step; table && row >= 0 && row < 500; row += step) {
      const el = table.querySelector(`[data-r="${row}"][data-col="${cell.dataset.col}"]`);
      if (!el && !table.querySelector(`[data-r="${row}"]`)) break;
      if (editable(el)) { next = el; break; }
    }
    if (next) { next.focus(); next.select?.(); lastCell = next; }
    else if (step > 0) toast('Hết cột — chọn ô tiếp theo hoặc nói “dừng”.');
    return next;
  }
  function emit(cell, type) { cell.dispatchEvent(new Event(type, { bubbles: true })); }
  function write(cell, value) { cell.value = value; emit(cell, 'input'); emit(cell, 'change'); }
  function command(text) { return text.normalize('NFC').trim().toLocaleLowerCase('vi-VN').replace(/[.!?]+$/, ''); }
  function toast(message) { if (window.App && App.toast) App.toast(message, true); }
  // Biểu tượng SVG (thay emoji: emoji hiển thị khác nhau theo máy, làm nút cao lệch)
  const MIC = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>';
  const STOP = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" class="fill"/></svg>';
  const label = on => (on ? `${STOP}<span>Dừng đọc</span>` : `${MIC}<span>Đọc số</span>`);
  const heard = detail => { document.dispatchEvent(new CustomEvent('voice:heard', { detail })); showHeard(detail); };

  // ===== Phản hồi khi nhập bằng giọng nói (không cần nhìn màn hình) =====
  // tiếng bíp (nhận số: một tiếng cao; không hiểu: hai tiếng thấp), rung (Android), ô vừa nhập nháy xanh,
  // dòng "Nghe: … → giá trị" ở trang đầy đủ, tùy chọn đọc lại "tên ô: số" (micro tạm dừng khi máy nói)
  const LS_READ = 'bbtn-mba.voiceReadback';
  let readback = false, speaking = false, audio = null;
  try { readback = localStorage.getItem(LS_READ) === '1'; } catch (_) { /* bỏ qua */ }
  function beep(ok) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const tones = ok ? [[880, 0, 0.09]] : [[260, 0, 0.12], [220, 0.17, 0.12]];
      tones.forEach(([f, at, dur]) => {
        const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + at;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + dur + 0.02);
      });
    } catch (_) { /* trình duyệt không cho phát âm thanh */ }
    try { if (navigator.vibrate) navigator.vibrate(ok ? 40 : [70, 60, 70]); } catch (_) { /* không hỗ trợ rung */ }
  }
  function flash(cell) {
    if (!cell) return;
    cell.classList.remove('voice-ok'); void cell.offsetWidth; cell.classList.add('voice-ok');
    setTimeout(() => cell.classList.remove('voice-ok'), 900);
  }
  // tên ô ngắn để đọc lại: phần sau "–" của nhãn ô (vd "R60″ (MΩ)", "Pha A-N"), bỏ đơn vị trong ngoặc
  const shortName = cell => String((cell && (cell.getAttribute('aria-label') || '')) || '').split(' – ').pop().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[″"]/g, '').trim();
  function say(text) {
    if (!readback || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'vi-VN'; u.rate = 1.1;
    const vi = speechSynthesis.getVoices().find(v => /^vi/i.test(v.lang)); if (vi) u.voice = vi;
    // micro tạm dừng khi máy nói — không tự nghe nhầm chính giọng đọc lại
    speaking = true;
    if (recognition) { try { recognition.stop(); } catch (_) {} }
    u.onend = u.onerror = () => { speaking = false; if (active && recognition) { try { recognition.start(); } catch (_) {} } };
    // lỗi giọng đọc không được làm hỏng việc nhập: vẫn nghe tiếp
    try { speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (_) { u.onend(); }
  }
  function showHeard(d) {
    document.querySelectorAll('[data-voice-heard]').forEach(el => {
      el.textContent = d.error ? `Nghe: “${d.text}” — ${d.error}` : d.cmd ? `Lệnh: ${d.text}` : `Nghe: “${d.text}” → ${d.value}`;
      el.classList.toggle('bad', !!d.error);
    });
  }
  function handle(spoken) {
    const cmd = command(spoken);
    const focused = document.activeElement;
    const cell = focused && focused.matches && focused.matches(selector) ? focused : lastCell && lastCell.isConnected ? lastCell : null;
    if (cmd === 'dừng' || cmd === 'dừng lại') { heard({ text: spoken, cmd: 'stop' }); stop(); return; }
    if (cmd === 'lùi' || cmd === 'quay lại') { heard({ text: spoken, cmd: 'back' }); move(cell, -1); return; }
    if (cmd === 'bỏ qua' || cmd === 'tiếp' || cmd === 'tiếp theo') { heard({ text: spoken, cmd: 'skip' }); move(cell, 1); return; }
    if (cmd === 'xóa' || cmd === 'xóa ô') { heard({ text: spoken, cmd: 'clear' }); if (cell) write(cell, ''); return; }
    if (!cell) { heard({ text: spoken, error: 'Chưa chọn ô' }); return; }
    const value = VnNumber.parse(spoken);
    if (value == null) {
      heard({ text: spoken, error: 'Không hiểu — đọc lại' });
      beep(false);
      // đã có dòng "Nghe: …" (trang Nhập hiện trường / thanh giọng nói) — không bật thông báo nổi che nút
      if (!document.querySelector('[data-fe-heard], [data-voice-heard]')) toast(`Không hiểu “${spoken}” — đọc lại.`);
      return;
    }
    const name = shortName(cell);
    write(cell, value);
    heard({ text: spoken, value, key: cell.dataset.k });
    beep(true); flash(cell);
    lastCell = cell;
    if (continuous) move(cell, 1);
    say(`${name ? name + ': ' : ''}${value}`);
  }
  function onResult(event) {
    // một sự kiện có thể chứa nhiều kết quả (đọc liền nhiều số)
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      // đang đọc lại số: bỏ qua (tránh tự nghe giọng máy)
      if (!speaking && r && r.isFinal && r[0] && r[0].transcript.trim()) handle(r[0].transcript.trim());
    }
  }
  function syncButtons() {
    document.querySelectorAll('[data-voice]').forEach(b => {
      b.innerHTML = label(active);
      b.classList.toggle('primary', active);
      b.setAttribute('aria-pressed', String(active));
    });
    // bàn phím ảo che màn hình khi đang đọc bằng giọng nói → tắt (inputmode none), bật lại khi dừng
    document.querySelectorAll('#main input[data-fe="cell"]').forEach(el => { el.inputMode = active ? 'none' : 'decimal'; });
    document.dispatchEvent(new CustomEvent('voice:state', { detail: { active } }));
  }
  function stop() {
    continuous = false; active = false; speaking = false;
    if (window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (_) {} }
    if (recognition) { try { recognition.stop(); } catch (_) {} }
    syncButtons();
  }
  // opts.continuous: true/false ép chế độ tự sang ô kế; không có thì theo ô tích "Liên tục"
  function start(button, opts = {}) {
    const focused = document.activeElement;
    let target = lastCell && lastCell.isConnected && document.querySelector('#main').contains(lastCell) && lastCell.matches(selector) ? lastCell : null;
    if (!target && focused && focused.matches && focused.matches(selector)) target = focused;
    if (!target) target = (button && button.closest('.panel') || document).querySelector(selector);
    if (target) { target.focus(); lastCell = target; }
    continuous = opts.continuous != null ? !!opts.continuous : !!document.querySelector('[data-voice-continuous]')?.checked;
    if (!recognition) {
      recognition = new Recognition(); recognition.lang = 'vi-VN'; recognition.interimResults = false; recognition.continuous = true;
      recognition.onresult = onResult;
      recognition.onerror = event => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          stop(); toast('Trình duyệt chưa cho dùng micro — bấm biểu tượng ổ khóa trên thanh địa chỉ để cho phép (trang phải mở qua https).');
        } else if (event.error === 'network') { stop(); toast('Nhận dạng giọng nói của trình duyệt cần có mạng.'); }
        else if (event.error === 'audio-capture') { stop(); toast('Không tìm thấy micro.'); }
        else stop();
      };
      // trình duyệt tự dừng sau một lúc im lặng → nghe tiếp khi vẫn đang bật
      recognition.onend = () => { if (active && !speaking) { try { recognition.start(); } catch (_) {} } else if (!active) syncButtons(); };
    }
    active = true; syncButtons();
    // âm thanh chỉ phát được sau thao tác của người dùng → khởi tạo ngay lúc bấm nút
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (_) { /* bỏ qua */ }
    try { recognition.start(); } catch (_) {}
  }
  function buttonHTML() {
    return `<span class="voice-controls"><button type="button" class="btn small${active ? ' primary' : ''}" data-voice aria-pressed="${active}" aria-label="Nhập số liệu bằng giọng nói">${label(active)}</button><label class="voice-cont"><input type="checkbox" data-voice-continuous> Liên tục</label>${readbackHTML()}<span class="voice-heard" data-voice-heard aria-live="polite"></span></span>`;
  }
  const readbackHTML = () => `<label class="voice-cont" title="Máy đọc lại tên ô và số vừa nhập (micro tạm dừng khi máy nói)"><input type="checkbox" data-voice-readback ${readback ? 'checked' : ''}> Đọc lại</label>`;
  document.addEventListener('change', e => {
    if (!e.target.matches || !e.target.matches('[data-voice-readback]')) return;
    readback = e.target.checked;
    try { localStorage.setItem(LS_READ, readback ? '1' : '0'); } catch (_) { /* bỏ qua */ }
    document.querySelectorAll('[data-voice-readback]').forEach(x => { x.checked = readback; });
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-voice]');
    if (!b) return;
    if (active) stop(); else start(b, b.dataset.voice === 'continuous' ? { continuous: true } : {});
  });
  document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches(selector)) lastCell = e.target; });
  window.VoiceInput = { buttonHTML, readbackHTML, label, start, stop, get active() { return active; }, get readback() { return readback; }, _handle: handle };
})();
