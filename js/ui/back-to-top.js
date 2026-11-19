// Nút "Về đầu trang": hiện ở góc phải dưới khi cuộn quá ~0,6 màn hình (trang dài), bấm để cuộn lên đầu.
// Trang Nhập hiện trường trên điện thoại có thanh nút dính đáy → nút đặt cao hơn (CSS .btt.lift).
(function () {
  'use strict';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btt';
  btn.hidden = true;
  btn.title = 'Về đầu trang';
  btn.setAttribute('aria-label', 'Về đầu trang');
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>';
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduce() ? 'auto' : 'smooth' });
    // đưa tiêu điểm về đầu nội dung cho người dùng bàn phím / trình đọc màn hình
    const main = document.getElementById('main');
    if (main) main.focus({ preventScroll: true });
  });
  let ticking = false;
  function update() {
    ticking = false;
    const far = window.scrollY > Math.max(400, window.innerHeight * 0.6);
    btn.hidden = !far;
    btn.classList.toggle('lift', !!document.querySelector('[data-fe-page]'));
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update);
  const mount = () => { if (!btn.isConnected) document.body.appendChild(btn); update(); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  window.BackToTop = { update };
})();
