// MBA: hộp thoại đọc ảnh nameplate (mục 0). OCR bằng js/data/ocr.js, tách trường bằng js/domain/types/mba/nameplate.js.
// Người dùng xem ảnh, sửa giá trị, chọn ô cần điền. Sau khi điền: ô đọc chưa chắc chắn tô vàng, ô không đọc được tô đỏ
// (state.att.ocr) cho tới khi người dùng sửa ô đó hoặc bấm "Đã kiểm tra".
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ST = { ok: ['st-pass', 'Đọc rõ'], check: ['st-warn', 'Cần kiểm tra'], missing: ['st-fail', 'Không đọc được'] };
  let cur = null; // { file, url, rotate, fields, rows, text }

  function dialog() {
    let d = $('#npDialog');
    if (!d) {
      d = document.createElement('dialog');
      d.id = 'npDialog'; d.className = 'auth-dialog cpc-dialog np-dialog'; d.setAttribute('aria-labelledby', 'npTitle');
      d.innerHTML = '<div class="ad-band"><span>Đọc ảnh nameplate</span><button class="ad-x" data-np="cancel" aria-label="Đóng">×</button></div><div id="npPanel"></div>';
      document.body.appendChild(d);
    }
    return d;
  }
  const getVal = k => (k.startsWith('cfg.') ? App.state.cfg[k.slice(4)] : App.state.v[k]) ?? '';

  async function open(file) {
    if (cur && cur.url) URL.revokeObjectURL(cur.url);
    cur = { file, url: URL.createObjectURL(file), rotate: 0 };
    dialog().showModal();
    await run();
  }

  async function run() {
    $('#npPanel').innerHTML = `<div class="ad-body cpc np"><h2 id="npTitle">Đọc ảnh nameplate</h2><div class="np-wait"><img src="${cur.url}" alt="Ảnh nameplate đã chọn" style="transform:rotate(${cur.rotate}deg)">
      <div><p id="npStage">Đang chuẩn bị…</p><progress id="npProg" max="1"></progress><p class="hint-text">Đọc chữ chạy ngay trên máy này, ảnh không gửi đi đâu. Lần đầu cần mạng để tải dữ liệu nhận dạng.</p></div></div></div>`;
    try {
      const onProgress = pass => (stage, p) => { const s = $('#npStage'), g = $('#npProg'); if (s) s.textContent = pass + stage; if (g) { if (p) g.value = p; else g.removeAttribute('value'); } };
      const opts = { serials: App.FX ? App.FX.data.order : [] };
      // Lượt 1: đọc theo khối (tốt với bảng rõ chữ). Đọc được ít trường (nameplate nhiều sơ đồ, chữ nhỏ) thì thêm lượt 2
      // đọc chữ rải rác ở độ phân giải cao hơn, mỗi trường lấy kết quả tốt hơn của hai lượt.
      const r = await Ocr.recognize(cur.file, { rotate: cur.rotate, onProgress: onProgress('') });
      cur.text = r.text; cur.conf = r.conf;
      cur.fields = MbaNameplate.parse(r.lines, opts);
      if (MbaNameplate.found(cur.fields) < 6) {
        const r2 = await Ocr.recognize(cur.file, { rotate: cur.rotate, psm: '11', long: 4500, onProgress: onProgress('Lượt 2 · ') });
        cur.fields = MbaNameplate.best(cur.fields, MbaNameplate.parse(r2.lines, opts));
        cur.text += `\n\n— Lượt 2 (chữ rải rác) —\n${r2.text}`;
      }
      cur.rows = MbaNameplate.FIELDS.map(([k, label]) => {
        const f = cur.fields[k], now = String(getVal(k)).trim();
        return { k, label, f, value: f.value, now, use: !!f.value && f.value !== now && !f.weak };
      });
      render();
    } catch (e) {
      console.error(e);
      $('#npPanel').innerHTML = `<div class="ad-body cpc np"><h2 id="npTitle">Đọc ảnh nameplate</h2><div class="callout warn">Không đọc được ảnh: ${esc(e.message || 'lỗi bộ nhận dạng chữ (ảnh quá lớn hoặc hỏng) — thử ảnh khác hoặc chụp lại')}</div>
        <div class="row-actions" style="justify-content:flex-end"><button class="btn" data-np="cancel">Đóng</button></div></div>`;
    }
  }

  function render() {
    const n = { ok: 0, check: 0, missing: 0 };
    cur.rows.forEach(r => { n[r.f.status]++; });
    let h = `<div class="ad-body cpc np"><h2 id="npTitle">Đọc ảnh nameplate</h2>
      <p class="ad-lead">Đọc rõ <b>${n.ok}</b> · cần kiểm tra <b>${n.check}</b> · không đọc được <b>${n.missing}</b> trên ${cur.rows.length} trường. Đối chiếu với ảnh, sửa giá trị nếu cần rồi bấm <i>Điền vào biểu mẫu</i>.
      Sau khi điền, ô chưa chắc chắn được tô vàng, ô không đọc được tô đỏ để anh/chị kiểm tra và nhập tay.</p>
      <div class="np-grid"><figure class="np-img"><img src="${cur.url}" alt="Ảnh nameplate" style="transform:rotate(${cur.rotate}deg)"><figcaption><button class="btn small" data-np="rotate">Xoay 90° và đọc lại</button></figcaption></figure>
      <div class="np-tbl"><table class="ftable cpc-tbl"><thead><tr><th></th><th>Trường</th><th>Giá trị đọc được (sửa được)</th><th>Đang có trong biểu mẫu</th></tr></thead><tbody>`;
    cur.rows.forEach((r, i) => {
      const [cls, txt] = ST[r.f.status];
      h += `<tr class="np-${r.f.status}"><td><input type="checkbox" data-np="use" data-i="${i}" ${r.use ? 'checked' : ''} aria-label="Điền ${esc(r.label)}"></td>
        <td><b>${esc(r.label)}</b><br><span class="badge ${cls}">${txt}${r.f.status !== 'missing' ? ` · ${r.f.conf} %` : ''}</span>${r.f.why ? `<br><span>${esc(r.f.why)}</span>` : ''}${r.f.weak ? '<br><span class="np-weak">Nhiều khả năng sai — không điền sẵn; sửa giá trị hoặc tích chọn nếu đúng</span>' : ''}</td>
        <td><input class="np-val" data-np="val" data-i="${i}" value="${esc(r.value)}" placeholder="${r.f.status === 'missing' ? 'Không đọc được — nhập tay' : ''}" autocomplete="off"></td>
        <td>${r.now ? esc(r.now) : '<span>(trống)</span>'}</td></tr>`;
    });
    h += `</tbody></table></div></div>
      <details class="np-raw"><summary>Chữ đọc được trên ảnh (độ tin cậy chung ${Math.round(cur.conf || 0)} %)</summary><pre>${esc(cur.text)}</pre></details>
      <div class="row-actions" style="justify-content:flex-end"><button class="btn" data-np="cancel">Hủy</button><button class="btn primary" data-np="apply">Điền vào biểu mẫu</button></div></div>`;
    $('#npPanel').innerHTML = h;
  }

  function apply() {
    const st = App.state;
    App.track('Đọc ảnh nameplate', () => {
      st.att = st.att || {};
      const flags = st.att.ocr = {};
      const filled = [], check = [], miss = [];
      cur.rows.forEach(r => {
        const v = String(r.value || '').trim();
        if (r.use && v) {
          if (r.k.startsWith('cfg.')) st.cfg[r.k.slice(4)] = v; else st.v[r.k] = v;
          filled.push(r.label);
        }
        const now = String(getVal(r.k)).trim();
        // người dùng đã sửa giá trị trong hộp thoại → coi như đã kiểm tra
        if (r.use && v && r.f.status === 'check' && v === r.f.value) { flags[r.k] = { status: 'check', label: r.label, conf: r.f.conf, why: r.f.why }; check.push(r.label); }
        if (!now) { flags[r.k] = { status: 'missing', label: r.label, why: r.f.why }; miss.push(r.label); }
      });
      st.att.ocrAt = new Date().toISOString();
      $('#npDialog').close();
      App.rebuild(false);
      Notify.show({ type: miss.length || check.length ? 'warn' : 'success', title: `Đã điền ${filled.length} trường từ ảnh nameplate`,
        msg: [check.length ? `Cần kiểm tra (tô vàng): ${check.join(', ')}.` : '', miss.length ? `Không đọc được, cần nhập tay (tô đỏ): ${miss.join(', ')}.` : ''].filter(Boolean).join(' ') || 'Các trường đều đọc rõ — vẫn nên đối chiếu nameplate.' });
    });
  }

  document.addEventListener('change', e => {
    const t = e.target;
    if (!t.dataset || !t.dataset.np || !cur || !cur.rows) return;
    const r = cur.rows[+t.dataset.i];
    if (t.dataset.np === 'use') r.use = t.checked;
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (!t.dataset || t.dataset.np !== 'val' || !cur || !cur.rows) return;
    const r = cur.rows[+t.dataset.i];
    r.value = t.value;
    r.use = !!t.value.trim() && t.value.trim() !== r.now;
    const cb = $(`[data-np="use"][data-i="${t.dataset.i}"]`);
    if (cb) cb.checked = r.use;
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('#npDialog [data-np]');
    if (!b || b.tagName !== 'BUTTON') return;
    if (b.dataset.np === 'cancel') $('#npDialog').close();
    if (b.dataset.np === 'apply') apply();
    if (b.dataset.np === 'rotate') { cur.rotate = (cur.rotate + 90) % 360; run(); }
  });

  window.NameplateImport = { open };
})();
