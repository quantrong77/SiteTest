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
  const heard = detail => document.dispatchEvent(new CustomEvent('voice:heard', { detail }));
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
      // trang Nhập hiện trường đã hiện dòng "Nghe: …" dưới ô — không bật thông báo nổi che nút
      if (!document.querySelector('[data-fe-heard]')) toast(`Không hiểu “${spoken}” — đọc lại.`);
      return;
    }
    write(cell, value);
    heard({ text: spoken, value, key: cell.dataset.k });
    lastCell = cell;
    if (continuous) move(cell, 1);
  }
  function onResult(event) {
    // một sự kiện có thể chứa nhiều kết quả (đọc liền nhiều số)
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r && r.isFinal && r[0] && r[0].transcript.trim()) handle(r[0].transcript.trim());
    }
  }
  function syncButtons() {
    document.querySelectorAll('[data-voice]').forEach(b => {
      b.textContent = active ? '■ Dừng đọc' : '🎙 Đọc số';
      b.classList.toggle('primary', active);
      b.setAttribute('aria-pressed', String(active));
    });
    // bàn phím ảo che màn hình khi đang đọc bằng giọng nói → tắt (inputmode none), bật lại khi dừng
    document.querySelectorAll('#main input[data-fe="cell"]').forEach(el => { el.inputMode = active ? 'none' : 'decimal'; });
    document.dispatchEvent(new CustomEvent('voice:state', { detail: { active } }));
  }
  function stop() {
    continuous = false; active = false;
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
      recognition.onend = () => { if (active) { try { recognition.start(); } catch (_) {} } else syncButtons(); };
    }
    active = true; syncButtons();
    try { recognition.start(); } catch (_) {}
  }
  function buttonHTML() {
    return `<span class="voice-controls"><button type="button" class="btn small${active ? ' primary' : ''}" data-voice aria-pressed="${active}" aria-label="Nhập số liệu bằng giọng nói">${active ? '■ Dừng đọc' : '🎙 Đọc số'}</button><label class="voice-cont"><input type="checkbox" data-voice-continuous> Liên tục</label></span>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-voice]');
    if (!b) return;
    if (active) stop(); else start(b, b.dataset.voice === 'continuous' ? { continuous: true } : {});
  });
  document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches(selector)) lastCell = e.target; });
  window.VoiceInput = { buttonHTML, start, stop, get active() { return active; }, _handle: handle };
})();
