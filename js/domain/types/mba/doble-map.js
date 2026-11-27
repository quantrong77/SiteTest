// MBA: ghép số liệu tgδ Doble M4000 (DobleM4000.parse) vào ô biểu mẫu mục tgδ sứ (b.<phía>.meas) và tgδ cuộn dây (wtgd[.<pha>].meas).
// Ô đích lấy từ biểu mẫu đang mở (mẫu chung 3 pha, theo pha, 110/220 kV). tgδ ghi theo %PF đo (Meas. %PF, chưa hiệu chỉnh nhiệt độ:
// app tự quy đổi về 20 °C); C ghi pF; U đo (kV), sơ đồ đo (UST/GAR/GND). Đích là chuỗi:
//   cuộn dây  "w|<grid id>|<hàng>"            vd "w|wtgd.A.meas|r4"
//   sứ        "b|<grid id>|<1|2>|<cột pha>"   vd "b|b.hv.meas|1|A"
//   không tải "n|<grid id>|<r0|r1>"            vd "n|nl.A.rated|r0" — lần 1: điện áp thấp (vd 380 V), lần 2: điện áp cao nhất (vd 2 kV, 10 kV)
(function () {
  'use strict';

  // ---------------------------------------------------------------- ô đích có trong biểu mẫu
  function targets(schema) {
    const out = [];
    Common.eachGrid(schema, g => {
      const w = g.id.match(/^wtgd(?:\.([ABC]))?\.meas$/);
      if (w) g.rows.forEach(r => out.push({ id: `w|${g.id}|${r.k}`, kind: 'winding', grid: g.id, row: r.k, phase: w[1] || '', label: `Cuộn dây${w[1] ? ` pha ${w[1]}` : ''}: ${r.label}` }));
      const n = g.id.match(/^nl(?:\.([ABC]))?\.rated$/);
      if (n) g.rows.forEach((r, i) => out.push({ id: `n|${g.id}|${r.k}`, kind: 'noload', grid: g.id, row: r.k, phase: n[1] || '', label: `Không tải${n[1] ? ` pha ${n[1]}` : ''}: lần ${i + 1}` }));
      const b = g.id.match(/^b\.(\w+)\.meas$/);
      if (b && g.rows.some(r => r.k === 'tgd1')) {
        const side = b[1], title = { hv: 'Sứ HV', mv: 'Sứ MV', n: 'Sứ N', lv: 'Sứ LV', lv2: 'Sứ LV (x,y,z)' }[side] || `Sứ ${side}`;
        g.cols.filter(c => c.phase).forEach(c => [1, 2].forEach(p => {
          if (g.rows.some(r => r.k === `tgd${p}`)) out.push({ id: `b|${g.id}|${p}|${c.k}`, kind: 'bushing', grid: g.id, side, part: p, col: c.k, label: `${title} ${c.label} – C${p}` });
        }));
      }
    });
    return out;
  }

  // ---------------------------------------------------------------- đoán đích
  // Cuộn dây (MBA tự ngẫu có cuộn hạ H–T hoặc 2 cuộn H–L): theo sơ đồ đo và cuộn được cấp điện (tên bắt đầu CH… / CT…, CL…)
  //   CH GAR → Cao~Vỏ (r4) · CH UST (CHT/CHL) → Hạ~Cao (r3) · CH GND → Cao~Hạ,Vỏ (r0), có "+CT/+CL" → Cao,Hạ~Vỏ (r2)
  //   CT GAR → Hạ~Vỏ (r5) · CT GND → Hạ~Cao,Vỏ (r1) · CT UST → Hạ~Cao (r3)
  function windingRow(it) {
    // bỏ phần mô tả trong ngoặc ("CH (500/220 - Vo)") và khoảng trắng: CH, CHT, CH+CHT, CH+CT, CT, CT+CTH
    const s = String(it.label).toUpperCase().replace(/\(.*?\)/g, '').replace(/\s+/g, '');
    if (/^CH/.test(s)) {
      if (it.mode === 'GAR') return 'r4';
      if (it.mode === 'UST') return 'r3';
      return /\+C[TLX](?![A-Z])/.test(s) ? 'r2' : 'r0'; // GND: CH+CT → cả hai cuộn ~ vỏ; CH, CH+CHT → cao ~ hạ, vỏ
    }
    if (/^C[TLX]/.test(s)) return it.mode === 'GAR' ? 'r5' : it.mode === 'GND' ? 'r1' : 'r3';
    return '';
  }
  // Sứ: "500-C1", "220-C2", "N-C1", "35.1-C1"; thiếu hậu tố C1/C2 → theo các sứ cùng nhóm đề mục, rồi theo điện áp đo (C2 đo ≤ 2 kV)
  const bushingTok = it => { const m = String(it.label).trim().match(/^(N|TT|\d+(?:[.,]\d+)?)\s*(?:-\s*C?([12])?)?/i); return m ? { tok: m[1].toUpperCase().replace(',', '.'), part: m[2] ? +m[2] : 0 } : null; };

  function guess(parsed, schema, cfg) {
    const T = targets(schema), has = id => T.some(t => t.id === id);
    const is3P = schema.layout === '3P', tplPhase = ['A', 'B', 'C'].includes((cfg || {}).template) ? cfg.template : '';
    const items = parsed.items.map(it => Object.assign({}, it, { target: '', use: false, note: '' }));
    // điện áp danh định các sứ trong file (500, 220, 35…) xếp giảm dần: cao nhất HV, kế MV, thấp nhất LV
    const bs = items.filter(it => it.group === 'bushing').map(it => Object.assign(it, { tk: bushingTok(it) }));
    const kvs = [...new Set(bs.map(it => it.tk && Math.floor(Number(it.tk.tok))).filter(Number.isFinite))].sort((a, b) => b - a);
    items.forEach(it => {
      if (tplPhase && it.phase && it.phase !== tplPhase) { it.note = `Pha ${it.phase} — biên bản đang lập pha ${tplPhase}`; return; }
      if (it.group === 'noload') {
        // mỗi pha: điện áp cao nhất → lần 2; thấp hơn → lần 1 (đo lặp: lần sau cùng, đánh dấu ở markRepeats)
        const grid = T.find(t => t.kind === 'noload' && (t.phase === it.phase || (!t.phase && (!it.phase || tplPhase))));
        if (!grid || !Number.isFinite(it.kv)) { it.note = 'Biểu mẫu không có bảng không tải pha này — chọn tay'; return; }
        const same = items.filter(x => x.group === 'noload' && x.phase === it.phase && Number.isFinite(x.kv));
        const top = Math.max(...same.map(x => x.kv)), two = same.some(x => x.kv < top);
        it.target = `n|${grid.grid}|${two && it.kv === top ? 'r1' : 'r0'}`;
        it.use = true;
        return;
      }
      if (it.group === 'winding') {
        const rk = windingRow(it);
        const gid = T.find(t => t.kind === 'winding' && (t.phase === it.phase || (!t.phase && (!it.phase || tplPhase))));
        if (!rk || !gid) { it.note = !rk ? 'Không nhận ra đối tượng đo — chọn tay' : 'Biểu mẫu không có bảng cuộn dây pha này'; return; }
        it.target = `w|${gid.grid}|${rk}`;
      } else if (it.group === 'bushing') {
        const tk = it.tk;
        if (!tk) { it.note = 'Không nhận ra sứ — chọn tay'; return; }
        // nhóm cùng đề mục: hậu tố C1/C2 chung, và sứ hạ áp còn thiếu (".1" / ".2") khi tên bị cắt ("35")
        const same = bs.filter(x => x.block === it.block && x.tk);
        let part = tk.part || (same.find(x => x.tk.part) || { tk: {} }).tk.part || (it.kv <= 2 ? 2 : 1);
        let tok = tk.tok;
        const kvN = Math.floor(Number(tok));
        if (Number.isFinite(kvN) && kvN === kvs[kvs.length - 1] && !/\./.test(tok) && kvs.length > 1) {
          const sub = same.map(x => x.tk.tok).filter(t => t.startsWith(`${kvN}.`));
          tok = sub.includes(`${kvN}.2`) && !sub.includes(`${kvN}.1`) ? `${kvN}.1` : sub.includes(`${kvN}.1`) && !sub.includes(`${kvN}.2`) ? `${kvN}.2` : tok;
        }
        let side = '';
        if (tok === 'N' || tok === 'TT') side = 'n';
        else if (Number.isFinite(kvN)) {
          const rank = kvs.indexOf(kvN), low = rank === kvs.length - 1 && kvs.length > 1;
          side = rank === 0 ? 'hv' : low ? (/\.2$/.test(tok) ? 'lv2' : 'lv') : 'mv';
        }
        // cột pha: mẫu 3 pha sứ hạ áp cột a/b/c; sứ trung tính mẫu khác nằm ở cột N của bảng MV
        let grid = `b.${side}.meas`, col = it.phase;
        if (side === 'n' && !has(`b|b.n.meas|${part}|${it.phase}`)) { grid = 'b.mv.meas'; col = 'N'; }
        if ((side === 'lv' || side === 'lv2') && !has(`b|${grid}|${part}|${col}`)) col = String(col).toLowerCase();
        if (side === 'lv2' && !has(`b|${grid}|${part}|${col}`) && !is3P) { it.note = 'Biểu mẫu không có bảng sứ hạ áp x, y, z — chọn tay'; return; }
        const id = `b|${grid}|${part}|${col}`;
        if (!side || !col || !has(id)) { it.note = 'Không xác định được phía / pha của sứ — chọn tay'; return; }
        it.target = id;
        if (tok !== tk.tok) it.note = `Tên sứ bị cắt "${it.label}" — đoán ${tok}`;
        if (!tk.part) it.note = [it.note, `không ghi C1/C2 — đoán C${part}`].filter(Boolean).join('; ');
      } else { it.note = 'Ngoài nhóm cuộn dây / sứ — chọn tay nếu cần'; return; }
      it.use = true;
    });
    markRepeats(items);
    return items;
  }
  // Cùng một ô đo nhiều lần: mặc định vẫn chọn tất cả, khi điền dùng lần đo sau cùng (effective) — ghi chú ở các lần trước
  function markRepeats(items) {
    const last = new Map();
    items.forEach(it => { if (it.target && it.use) last.set(it.target, it); });
    items.forEach(it => {
      if (!it.target || !it.use) return;
      const w = last.get(it.target);
      if (w !== it) it.note = [it.note, `đo lặp — điền lần sau (TT ${w.no})`].filter(Boolean).join('; ');
    });
    return items;
  }
  // Các dòng thực sự điền: đang chọn, có ô đích; cùng ô thì lấy dòng chọn sau cùng
  function effective(items) {
    const last = new Map();
    items.forEach(it => { if (it.use && it.target) last.set(it.target, it); });
    return items.filter(it => it.use && it.target && last.get(it.target) === it);
  }
  // Ô trùng giữa các dòng đang chọn
  function clashes(items) {
    const seen = new Map(), out = [];
    items.forEach(it => { if (it.use && it.target) { if (seen.has(it.target)) out.push([seen.get(it.target), it]); else seen.set(it.target, it); } });
    return out;
  }

  // ---------------------------------------------------------------- ghi vào biểu mẫu
  const txt = (x, d) => (Number.isFinite(x) ? String(Number(x.toFixed(d))).replace('.', ',') : '');
  // Uđm cuộn hạ áp của một máy 1 pha (kV) = S hạ áp (MVA) × 1000 / I hạ áp (A) — cấu hình mục 0; MBA 3 pha (mẫu 110/220) không tính
  function uLV(cfg, schema) {
    const c = cfg || {}, s = Common.toNum(c.sLV), i = Common.toNum(c.iLV);
    if (schema && schema.layout === '110') return NaN;
    return Number.isFinite(s) && Number.isFinite(i) && i > 0 ? s * 1000 / i : NaN;
  }
  const sig = (x, n) => (Number.isFinite(x) ? String(Number(x.toPrecision(n))).replace('.', ',') : '');
  // Trả về { v: {khóa: giá trị}, n: số dòng điền } — không sửa state; ô U đo / sơ đồ đo chung các pha của bảng sứ lấy theo dòng sau cùng
  // opt: { p0FromPm: P0 = Pmean (Doble không đo U'mean, nguồn sin → d = 0), uLV: Uđm hạ áp (kV) để tính %Uđm, hasPu: bảng có cột %Uđm }
  function writes(items, opt = {}) {
    const v = {};
    let n = 0;
    effective(items).forEach(it => {
      const p = it.target.split('|');
      if (p[0] === 'n') {
        const base = `${p[1]}.${p[2]}`;
        // U'mean: Doble không đo → để trống; I0 (A), Pmean (kW); I0 % app tự tính
        v[`${base}.ur`] = txt(it.kv, 3); v[`${base}.ia`] = sig(it.ma / 1000, 5); v[`${base}.pm`] = sig(it.watts / 1000, 5);
        if (opt.p0FromPm) v[`${base}.p0`] = sig(it.watts / 1000, 5);
        if (opt.hasPu && Number.isFinite(opt.uLV) && opt.uLV > 0) v[`${base}.pu`] = sig(it.kv / opt.uLV * 100, 3);
        n++;
        return;
      }
      if (p[0] === 'w') {
        const base = `${p[1]}.${p[2]}`;
        v[`${base}.tgd`] = txt(it.pf, 3); v[`${base}.c`] = txt(it.cap, 2); v[`${base}.u`] = txt(it.kv, 3); v[`${base}.d`] = it.mode;
      } else {
        const [, gid, part, col] = p;
        v[`${gid}.tgd${part}.${col}`] = txt(it.pf, 3); v[`${gid}.c${part}.${col}`] = txt(it.cap, 2);
        v[`${gid}.tgd${part}.u`] = txt(it.kv, 3); v[`${gid}.tgd${part}.d`] = it.mode;
      }
      n++;
    });
    return { v, n };
  }
  // Nhiệt độ dầu trong file → ô nhiệt độ cuộn dây / sứ còn trống
  function tempWrites(parsed, schema, items, state) {
    const t = parsed.meta && parsed.meta.oilT;
    if (!t) return {};
    const keys = new Set();
    Common.eachField(schema, f => keys.add(f.k));
    const out = {}, put = k => { if (keys.has(k) && String((state.v || {})[k] ?? '').trim() === '') out[k] = String(t).replace('.', ','); };
    effective(items).forEach(it => {
      const p = it.target.split('|');
      if (p[0] === 'w') put(p[1].replace(/\.meas$/, '.t'));
      else if (p[0] === 'b') put('b.hv.t');
    });
    return out;
  }

  window.MbaDoble = { targets, guess, windingRow, bushingTok, markRepeats, effective, clashes, writes, tempWrites, uLV };
})();
