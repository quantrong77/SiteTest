// Dạng sóng điện trở động khi chuyển nấc OLTC (chụp sóng): nén để lưu kèm biên bản, giải nén để vẽ, nhận biết bất thường.
// Nén: R = U/I theo từng mẫu, gộp mỗi `bucket` mẫu thành cặp (nhỏ nhất, lớn nhất) để giữ nguyên các xung hẹp,
// lượng tử hóa 16 bit theo khoảng [min, max] của đường cong rồi mã base64 (≈ 3,5 kB cho 3250 mẫu).
(function () {
  'use strict';
  const NA = 65535;
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  function b64enc(bytes) {
    let s = '';
    for (let k = 0; k < bytes.length; k += 3) {
      const a = bytes[k], b = bytes[k + 1], c = bytes[k + 2];
      const n = (a << 16) | ((b || 0) << 8) | (c || 0);
      s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (b === undefined ? '=' : B64[(n >> 6) & 63]) + (c === undefined ? '=' : B64[n & 63]);
    }
    return s;
  }
  function b64dec(s) {
    const clean = String(s).replace(/=+$/, '');
    const out = new Uint8Array(Math.floor(clean.length * 3 / 4));
    let o = 0;
    for (let k = 0; k < clean.length; k += 4) {
      const n = (B64.indexOf(clean[k]) << 18) | (B64.indexOf(clean[k + 1]) << 12) | ((B64.indexOf(clean[k + 2]) & 63) << 6) | (B64.indexOf(clean[k + 3]) & 63);
      if (o < out.length) out[o++] = (n >> 16) & 255;
      if (o < out.length) out[o++] = (n >> 8) & 255;
      if (o < out.length) out[o++] = n & 255;
    }
    return out;
  }

  const finite = Number.isFinite;
  function median(a) {
    const s = Array.from(a).filter(finite).sort((x, y) => x - y);
    return s.length ? s[s.length >> 1] : NaN;
  }

  // wave: { tr, from, to, conn, dt (s), v, i } (mảng số) → bản nén lưu được trong JSON
  function compact(wave, bucket = 5) {
    const n = Math.min(wave.v.length, wave.i.length);
    const iMed = median(wave.i);
    const R = new Float64Array(n);
    let iMin = Infinity;
    for (let k = 0; k < n; k++) {
      const u = wave.v[k], c = wave.i[k];
      R[k] = finite(u) && finite(c) && c > 0.02 * iMed ? u / c : NaN;
      if (finite(c) && c < iMin) iMin = c;
    }
    const nb = Math.ceil(n / bucket);
    const lo = new Float64Array(nb), hi = new Float64Array(nb);
    let min = Infinity, max = -Infinity;
    for (let b = 0; b < nb; b++) {
      let l = Infinity, h = -Infinity;
      for (let k = b * bucket; k < Math.min(n, (b + 1) * bucket); k++) if (finite(R[k])) { l = Math.min(l, R[k]); h = Math.max(h, R[k]); }
      lo[b] = finite(l) ? l : NaN; hi[b] = finite(h) ? h : NaN;
      if (finite(l)) min = Math.min(min, l);
      if (finite(h)) max = Math.max(max, h);
    }
    if (!finite(min)) { min = 0; max = 0; }
    const span = max - min || 1;
    const bytes = new Uint8Array(nb * 4);
    const q = x => (finite(x) ? Math.round((x - min) / span * (NA - 1)) : NA);
    for (let b = 0; b < nb; b++) {
      const a = q(lo[b]), c = q(hi[b]);
      bytes[b * 4] = a & 255; bytes[b * 4 + 1] = a >> 8; bytes[b * 4 + 2] = c & 255; bytes[b * 4 + 3] = c >> 8;
    }
    return {
      tr: wave.tr, from: wave.from, to: wave.to, conn: wave.conn,
      dtMs: +(wave.dt * bucket * 1000).toFixed(6), n: nb, min: +min.toPrecision(7), max: +max.toPrecision(7), q: b64enc(bytes),
      iMinPct: finite(iMin) && iMed > 0 ? +(iMin / iMed * 100).toFixed(1) : null,
    };
  }

  // Bản nén → { t (ms), lo, hi } để vẽ
  function expand(c) {
    const bytes = b64dec(c.q), n = c.n, span = c.max - c.min;
    const t = new Float64Array(n), lo = new Float64Array(n), hi = new Float64Array(n);
    const dq = x => (x === NA ? NaN : c.min + x / (NA - 1) * span);
    for (let b = 0; b < n; b++) {
      t[b] = b * c.dtMs;
      lo[b] = dq(bytes[b * 4] | (bytes[b * 4 + 1] << 8));
      hi[b] = dq(bytes[b * 4 + 2] | (bytes[b * 4 + 3] << 8));
    }
    return { t, lo, hi };
  }

  // Chiều chuyển nấc: tăng (số nấc tăng) / giảm
  const dir = row => { const a = parseInt(row.from, 10), b = parseInt(row.to, 10); return finite(a) && finite(b) ? (b > a ? 'up' : b < a ? 'down' : '') : ''; };

  // Bất thường nhận biết được từ số liệu máy đo (không phải ngưỡng tiêu chuẩn): máy không ghi nhận chuyển mạch,
  // hoặc dòng đo sụt mạnh trong lúc chuyển nấc (có thể hở mạch)
  function anomalies(rec, iDropPct = 50) {
    const out = [];
    (rec.rows || []).forEach(r => {
      if (r.tFall === 0 && r.tRise === 0) out.push({ tr: r.tr, kind: 'nodetect', text: `${r.from}→${r.to}: máy đo không ghi nhận quá trình chuyển mạch (tFall = tRise = 0)` });
    });
    (rec.waves || []).forEach(w => {
      if (w.iMinPct !== null && w.iMinPct < iDropPct) out.push({ tr: w.tr, kind: 'idrop', text: `${w.from}→${w.to}: dòng đo giảm còn ${String(w.iMinPct).replace('.', ',')} % trong lúc chuyển nấc` });
    });
    return out;
  }

  window.OltcWave = { compact, expand, anomalies, dir, b64enc, b64dec };
})();
