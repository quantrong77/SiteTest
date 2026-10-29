// Hạng mục thí nghiệm dùng chung cho mọi loại thiết bị (MBA, kháng điện, TI, TU…): quy đổi nhiệt độ theo QĐ 1901 và
// phép so sánh – đánh giá cơ bản. Mỗi loại thiết bị tự dựng câu chữ kết quả (vị trí, tham chiếu) quanh các hàm này.
// Ngưỡng truyền vào từ bộ tiêu chí (Criteria.limits()), không đọc thẳng QĐ 1901.
(function () {
  'use strict';
  const { ok, devPct } = Common;

  // Độ lệch có dấu so với giới hạn ±lim → 'pass' | 'fail'; không tính được → null
  const judgeDev = (d, lim) => (ok(d) ? (Math.abs(d) <= lim ? 'pass' : 'fail') : null);

  // Điện trở cách điện về 20 °C (Bảng 4, K1); tgδ về 20 °C (Bảng 7, K2) — trả { val, k, expr, dt }
  const irAt20 = (r, t) => QD.convIR(r, t, 20);
  const tgdAt20 = (v, t) => QD.convTgd(v, t, 20);

  // R một chiều: quy giá trị đo về nhiệt độ tham chiếu (235 + t, cuộn đồng) rồi so với NSX.
  // Thiếu nhiệt độ đo → 'missing'; không có số liệu NSX → 'info' (lưu làm giá trị khởi đầu).
  function dcr({ m, t, ref, refT = 75, lim }) {
    const atRef = ok(t) ? QD.convDCR(m, t, refT) : NaN;
    const dev = devPct(atRef, ref);
    return { atRef, dev, status: !ok(t) ? 'missing' : judgeDev(dev, lim) || 'info' };
  }

  // Tỷ số biến: độ lệch so với tỷ số định mức; người dùng nhập sẵn độ lệch (đọc từ máy đo) thì dùng giá trị đó
  function ratio({ m, nominal, manualDev, lim }) {
    const devAuto = devPct(m, nominal);
    const dev = ok(manualDev) ? manualDev : devAuto;
    return { devAuto, dev, status: judgeDev(dev, lim) || 'missing' };
  }

  // Độ lệch giữa các pha (Rmax − Rmin)/RTB × 100; dưới 2 pha có số → null
  function spread(vals, lim) {
    const sp = QD.phaseSpread(vals);
    return sp === null ? null : { sp, status: sp <= lim ? 'pass' : 'fail' };
  }

  // Điện dung (cuộn dây, sứ): thay đổi so với giá trị khởi đầu; không có khởi đầu → 'info'
  function capacitance({ c, ref, lim }) {
    const dev = devPct(c, ref);
    return { dev, status: judgeDev(dev, lim) || 'info' };
  }

  window.TestItems = { devPct, judgeDev, irAt20, tgdAt20, dcr, ratio, spread, capacitance };
})();
