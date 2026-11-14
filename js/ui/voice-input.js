// Nhập số liệu bằng Web Speech API, dùng lại các sự kiện nhập tay của biểu mẫu.
(function () {
  'use strict';
  const Recognition = window.webkitSpeechRecognition;
  if (!Recognition) { window.VoiceInput = null; return; }
  let recognition = null, continuous = false, active = false, lastCell = null;
  const selector = '#main input[data-g]:not([readonly]):not(:disabled):not(.text), #main input[data-k][inputmode="decimal"]:not([readonly]):not(:disabled):not(.text)';
  const cells = () => Array.from(document.querySelectorAll(selector));
  function move(cell, step) {
    if (!cell || !cell.matches('input[data-g]')) return null;
    const table = cell.closest('table'), row = +cell.dataset.r + step;
    const next = table && table.querySelector(`[data-r="${row}"][data-col="${cell.dataset.col}"]:not([readonly]):not(:disabled):not(.text)`);
    if (next) { next.focus(); next.select?.(); lastCell = next; }
    return next;
  }
  function emit(cell, type) { cell.dispatchEvent(new Event(type, { bubbles: true })); }
  function write(cell, value) { cell.value = value; emit(cell, 'input'); emit(cell, 'change'); }
  function command(text) { return text.normalize('NFC').trim().toLocaleLowerCase('vi-VN'); }
  function toast(message) { if (window.App && App.toast) App.toast(message, true); }
  function onResult(event) {
    const result = event.results[event.resultIndex];
    if (!result || !result.isFinal) return;
    const spoken = result[0].transcript.trim(), cmd = command(spoken);
    const focused = document.activeElement;
    const cell = focused.matches && focused.matches(selector) ? focused : lastCell && lastCell.isConnected ? lastCell : null;
    if (cmd === 'dừng' || cmd === 'dừng lại') { stop(); return; }
    if (cmd === 'lùi' || cmd === 'quay lại') { move(cell, -1); return; }
    if (cmd === 'xóa' || cmd === 'xóa ô') { if (cell) write(cell, ''); return; }
    if (!cell) return;
    const value = VnNumber.parse(spoken);
    if (value == null) { toast(`Không hiểu “${spoken}” — đọc lại.`); return; }
    write(cell, value);
    lastCell = cell;
    if (continuous) move(cell, 1);
  }
  function syncButtons() {
    document.querySelectorAll('[data-voice]').forEach(b => {
      b.textContent = active ? '■ Dừng đọc' : '🎙 Đọc số';
      b.classList.toggle('primary', active);
    });
  }
  function stop() {
    continuous = false; active = false;
    if (recognition) { try { recognition.stop(); } catch (_) {} }
    syncButtons();
  }
  function start(button) {
    const focused = document.activeElement;
    let target = lastCell && lastCell.isConnected && document.querySelector(selector) && document.querySelector('#main').contains(lastCell) ? lastCell : null;
    if (!target && focused.matches && focused.matches(selector)) target = focused;
    if (!target) target = button.closest('.panel')?.querySelector(selector);
    if (target) { target.focus(); lastCell = target; }
    continuous = !!document.querySelector('[data-voice-continuous]')?.checked;
    if (!recognition) {
      recognition = new Recognition(); recognition.lang = 'vi-VN'; recognition.interimResults = false; recognition.continuous = true;
      recognition.onresult = onResult;
      recognition.onerror = event => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          stop(); toast('Trình duyệt chưa cho dùng micro — bấm biểu tượng ổ khóa trên thanh địa chỉ để cho phép');
        } else if (event.error === 'network') { stop(); toast('Nhận dạng giọng nói cần có mạng.'); }
        else stop();
      };
      recognition.onend = () => { if (active) { try { recognition.start(); } catch (_) {} } else syncButtons(); };
    }
    active = true; syncButtons();
    try { recognition.start(); } catch (_) {}
  }
  function buttonHTML() {
    return `<span class="voice-controls"><button type="button" class="btn small${active ? ' primary' : ''}" data-voice aria-label="Nhập số liệu bằng giọng nói">${active ? '■ Dừng đọc' : '🎙 Đọc số'}</button><label class="voice-cont"><input type="checkbox" data-voice-continuous> Liên tục</label></span>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-voice]');
    if (!b) return;
    if (active) stop(); else start(b);
  });
  document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches(selector)) lastCell = e.target; });
  window.VoiceInput = { buttonHTML };
})();
