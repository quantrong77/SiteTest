// Hướng dẫn đo mặc định từng hạng mục MBA (bước 2 "Hướng dẫn đo"), Markdown. Tổng hợp từ:
//   [QĐ] QĐ 1901/QĐ-EVNNPT (29/09/2025), Chương V — Quy trình thí nghiệm, kiểm định MBA (Điều 26–44)
//   [QT] QT-KĐMBA — Quy trình kiểm định máy biến áp, Công ty Truyền tải điện 3 (lần sửa 03, 25/02/2025), Điều 7
//   [ĐT] Tài liệu đào tạo thí nghiệm nhất thứ MBA (2026)
// Chỉ ghi lại nội dung của các tài liệu trên (tóm tắt, kèm nguồn) — không thêm ngưỡng. Admin chỉnh được theo đơn vị
// (bảng workflow_guides); nội dung ở đây là mặc định khi đơn vị chưa chỉnh.
// Ảnh: cú pháp ![chú thích](img:khóa). Ảnh KHÔNG nằm trong mã nguồn (repo công khai, tài liệu nội bộ): Admin nạp từ
// chính tệp tài liệu (.docx đào tạo: lấy ảnh nhúng; .pdf quy trình: cắt vùng trang) vào kho file riêng tư của CSDL.
(function () {
  'use strict';

  const DOCS = {
    dt: { kind: 'docx', title: 'Tài liệu đào tạo thí nghiệm nhất thứ MBA (2026)', file: 'TaiLieuĐT_TNNhatThu MBA_2026.docx' },
    qt: { kind: 'pdf', title: 'QT-KĐMBA — Quy trình kiểm định máy biến áp (PTC3, lần sửa 03)', file: '2.Qui trình kiểm định máy biến áp.pdf', pages: 51 },
  };

  // Ảnh tham chiếu: docx → tệp media nhúng (size: số byte để nhận đúng phiên bản tài liệu);
  // pdf → trang và khung cắt [x0, y0, x1, y1] theo tỉ lệ trang (0–1).
  const D = (media, size, caption) => ({ doc: 'dt', media: `word/media/${media}`, size, caption });
  const P = (page, rect, caption) => ({ doc: 'qt', page, rect, caption });
  const IMAGES = {
    'dt-noload-bothu': D('image2.png', 619509, 'Sơ đồ nguyên lý bộ thử không tải MBA 500 kV'),
    'dt-noload-sodo': D('image3.png', 130377, 'Sơ đồ đo không tải: vôn kế, ampe kế, oát kế'),
    'dt-ir-tuongduong': D('image4.png', 66740, 'Mạch tương đương cách điện khi đặt điện áp DC'),
    'dt-ir-megom': D('image6.png', 119590, 'Đấu Mêgômmét đo cách điện MBA 2 cuộn dây'),
    'qt-ir-cao': P(21, [0.1648, 0.3674, 0.9143, 0.6916], 'Sơ đồ đo điện trở cách điện cuộn cao áp (Cao – Hạ + Đất)'),
    'qt-ir-ha': P(22, [0.1648, 0.3916, 0.9143, 0.689], 'Sơ đồ đo điện trở cách điện cuộn hạ áp (Hạ – Cao + Đất)'),
    'dt-tgd-chedo': D('image9.png', 102630, 'Ba chế độ đo UST / GST / GSTg'),
    'dt-tgd-2cuon': D('image13.png', 212410, 'Đấu máy đo tgδ MBA 2 cuộn dây'),
    'dt-tgd-tuongduong': D('image14.png', 220427, 'Sơ đồ điện dung tương đương MBA 2 cuộn dây'),
    'qt-tgd-sodo': P(25, [0.2878, 0.3372, 0.836, 0.6025], 'Sơ đồ nguyên lý đo tgδ cách điện cuộn dây'),
    'dt-su-testtap': D('image10.png', 120648, 'Cực đo test tap của sứ xuyên'),
    'dt-su-c1c2': D('image11.png', 153123, 'Điện dung C1 và C2 của sứ xuyên'),
    'dt-su-ust': D('image12.png', 332734, 'Sơ đồ đo tgδ, điện dung C1 sứ xuyên (UST)'),
    'dt-dcr-nguyenly': D('image18.png', 101509, 'Nguyên lý đo điện trở một chiều (vôn – ampe)'),
    'dt-dcr-sodo': D('image19.png', 161515, 'Sơ đồ đấu dây đo điện trở một chiều'),
    'qt-dcr-cpc': P(28, [0.3605, 0.16, 0.8025, 0.3199], 'Đấu nối đo điện trở một chiều bằng CPC 100 + CP SA1'),
    'dt-ratio-ttr': D('image20.png', 117276, 'Đấu thiết bị TTR đo tỉ số biến'),
    'dt-ratio-diagram': D('image21.png', 371217, 'Bảng tổ đấu dây — số định danh sơ đồ (Diagram No.) khai báo cho máy TTR'),
    'qt-ratio-1p': P(31, [0.2878, 0.16, 0.7913, 0.281], 'Đo tỉ số biến MBA một pha bằng 2 vôn mét'),
    'qt-ratio-3p': P(31, [0.1648, 0.7132, 0.9031, 0.8688], 'Đo tỉ số biến MBA ba pha bằng nguồn một pha, 2 vôn mét'),
    'qt-polarity': P(33, [0.3326, 0.3545, 0.9031, 0.5507], 'Xác định cực tính cuộn dây bằng xung một chiều'),
    'qt-vector-yy-yd': P(35, [0.3102, 0.16, 0.7913, 0.3761], 'Tổ đấu dây Y/Y-12 và Y/d-11'),
    'qt-vector-9': P(36, [0.1648, 0.2119, 0.9031, 0.5489], 'Kiểm tra tổ nối dây bằng xung một chiều chín trị số'),
    'qt-vector-3': P(37, [0.1648, 0.16, 0.9031, 0.523], 'Phương pháp xung một chiều ba trị số'),
    'dt-moist-sodo': D('image22.png', 205967, 'Sơ đồ đấu dây đo độ ẩm cách điện cứng (FDS/PDC)'),
    'dt-oltc-nguyenly': D('image23.png', 325264, 'Nguyên lý chụp sóng công tắc K'),
    'dt-oltc-tm1800': D('image24.png', 599431, 'Đấu nối TM1800 và LTC135 với MBA 3 pha'),
    'dt-oltc-song': D('image25.png', 518411, 'Dạng sóng điện trở động khi chuyển nấc'),
    'qt-oltc-nguyenly': P(39, [0.3326, 0.5533, 0.7465, 0.886], 'Sơ đồ nguyên lý kiểm tra bộ điều áp dưới tải'),
    'dt-sc-1pha': D('image26.png', 33040, 'Sơ đồ đấu dây ngắn mạch MBA 1 pha'),
    'dt-sc-3pha': D('image27.png', 45279, 'Sơ đồ đấu dây ngắn mạch MBA 3 pha'),
    'dt-sc-y-tb': D('image28.png', 204698, 'Nguồn vào cuộn đấu Y — giá trị trung bình ở điện áp đo'),
    'dt-sc-y-qd': D('image29.png', 172362, 'Nguồn vào cuộn đấu Y — quy đổi về định mức tại nhiệt độ đo'),
    'dt-sc-d-tb': D('image30.png', 202232, 'Nguồn vào cuộn đấu D — giá trị trung bình ở điện áp đo'),
    'dt-sc-d-qd': D('image31.png', 183731, 'Nguồn vào cuộn đấu D — quy đổi về định mức tại nhiệt độ đo'),
    'dt-bct-ratio-i': D('image32.png', 328113, 'Đo tỉ số biến TI bằng dòng AC (CPC 100)'),
    'dt-bct-ratio-u': D('image34.png', 300288, 'Đo tỉ số biến TI bằng điện áp AC (CPC 100)'),
    'dt-bct-dcr': D('image36.png', 543162, 'Đo điện trở một chiều cuộn thứ cấp TI'),
    'dt-bct-va': D('image38.png', 448886, 'Đo đặc tính từ hóa V-A của TI'),
  };

  const GUIDE = {};

  GUIDE.visual = `### Mục đích
Kiểm tra bằng mắt để phát hiện bất thường bên ngoài trước khi thí nghiệm: thay đổi hình dáng, nứt, vỡ, lỏng đầu cốt, rò dầu… *(QT 7.1)*

### Nội dung kiểm tra
- Vỏ máy, bình dầu phụ, cánh tản nhiệt, kính phòng nổ; sứ đầu vào, đầu ra, trung tính. *(QT 7.1)*
- Mức dầu MBA; màu hạt silicagel trong ống thở không đổi màu. *(QT 7.1; QĐ Điều 27.2.e)*
- Hệ thống làm mát cưỡng bức; đồng hồ nhiệt độ, đồng hồ báo nấc. *(QT 7.1)*
- Nối đất vỏ máy và nối đất trung tính; các đầu sứ ra đang được nối tắt và nối đất. *(QT 7.1)*
- Thông số trên máy, nhãn máy đúng với tài liệu cấp. *(QĐ Điều 27.2.b)*
- Lắp đặt xong, dầu đã bơm đủ, không rò rỉ và **để ổn định tối thiểu 12 giờ**; sứ không sứt mẻ, rạn nứt, chân sứ không chảy dầu, bề mặt sứ đã vệ sinh. *(QĐ Điều 27.2.d, e)*
- Khu vực quanh MBA không có mảnh vỡ, vật liệu dễ cháy, vật cản. *(QT 7.1)*

### Trước khi thí nghiệm
1. Cắt điện MBA, nối đất vỏ, nối đất tạm thời các đầu cực, tách các đầu nối dây đến MBA ở khoảng cách an toàn. *(QĐ Điều 27.2.a)*
2. Kiểm tra lại toàn bộ để chắc chắn MBA đã cách ly hoàn toàn khỏi thiết bị đang mang điện. *(QT 7.1)*
3. MBA cắt điện ít nhất 3 giờ trước khi thử — khi đó nhiệt độ cuộn dây coi như bằng nhiệt độ dầu; ghi nhiệt độ dầu, cuộn dây (đồng hồ trên máy), nhiệt độ và độ ẩm môi trường vào biên bản. *(QT Điều 7)*
4. Thực hiện thí nghiệm theo Quy trình Kỹ thuật an toàn điện; thiết bị thí nghiệm có bảo vệ đầu ra nối đất khỏi xuất hiện cao áp khi mất tiếp đất. *(QĐ Điều 27.3.a)*

### Kiểm tra kèm theo (khi áp dụng)
- **Độ kín dầu**: theo quy định NSX; nếu không có — nhiệt độ dầu khi thử không dưới 10 °C (MBA đến 150 kV) / 20 °C (còn lại); MBA đến 35 kV tạo cột dầu 0,6 m trên mức dầu bình dầu phụ; MBA có túi khí tạo áp 10 kPa trong túi khí; MBA còn lại tạo áp khí khô hoặc Nitơ 10 kPa trên mức dầu bình dầu phụ; thời gian không dưới 3 giờ. Không thấy gỉ dầu là kín. *(QT 7.1)*
- **Hệ thống làm mát**: đo cách điện động cơ quạt, bơm bằng Mêgômmét 1000 V; đo điện trở một chiều cuộn dây động cơ, so sánh giữa các pha; kiểm tra phần cơ khí, đồng hồ chỉ thị bơm dầu. *(QT 7.1)*`;

  GUIDE.noload = `### Mục đích
Đo tổn hao không tải P0 và dòng điện không tải I0 để phát hiện hư hỏng, khuyết tật trong lõi thép, gông từ, chạm chập lá thép, chập vòng dây. *(QĐ Điều 34.1)*

### Sơ đồ đấu dây
- Điện áp thử đưa vào **cuộn hạ áp**, các cuộn còn lại hở mạch (cuộn tam giác hở phải đấu kín mạch); cuộn có điều chỉnh điện áp đặt ở **nấc định mức**; đầu trung tính nối đất. *(QĐ Điều 34.2)*
- Nguồn: nên dùng điện áp lưới, xoay chiều 50 ± 0,5 Hz. *(QĐ Điều 27.3.c)*
- Thiết bị đo tổn hao không tải đáp ứng IEC 60076-1, IEC 60076-19. *(QĐ Điều 34.2)*

![Sơ đồ đo không tải](img:dt-noload-sodo)
![Bộ thử không tải](img:dt-noload-bothu)

### Trường hợp không có nguồn điện áp định mức
- Dùng nguồn một pha điện áp cao nhất có thể (thường 10 kV); nên đo trên cuộn cao áp, nghi ngờ MBA có vấn đề thì đo thêm trên cuộn hạ áp. *(QĐ Điều 34.2)*
- 1 năm sau đóng điện: đo dòng không tải ở điện áp thấp. *(QĐ Điều 34.2)*
- Ghi rõ nấc phân áp lúc đo để so sánh được với lần trước và số liệu xuất xưởng. *(ĐT I.3)*

### Trình tự đo
1. **Đo không tải TRƯỚC** đo điện trở một chiều và điện trở cách điện: không được đưa dòng một chiều vào cuộn dây trước khi đo (đo điện trở một chiều, đo cách điện, sấy bằng dòng một chiều). *(QĐ Điều 34.2)*
2. Lõi thép có từ dư (do đóng cắt, đo DC trước đó) thì phải khử từ trước khi đo — đây là cách duy nhất loại bỏ ảnh hưởng từ dư. *(QĐ Điều 34.2)*
3. Kiểm tra sơ đồ: tam giác hở đã đấu kín, trung tính nối đất, TI chân sứ không dùng nối tắt và nối đất. *(ĐT I.3)*
4. Tăng đều điện áp với tốc độ theo dõi được trên đồng hồ, giữ ổn định ở giá trị đặt trong thời gian đo. *(QĐ Điều 27.3.c)*
5. Đọc và ghi U, I0, P0 — theo từng cặp pha khi đo một pha MBA 3 trụ (nguồn vào ab, bc, ca). *(ĐT I.3)*
6. Đo xong, hạ đều điện áp xuống dưới 1/3 điện áp thí nghiệm rồi mới cắt nguồn. *(QĐ Điều 27.3.c)*

### Tính toán
- Hiệu chỉnh tổn hao đo được: **P0 = Pm·(1 + d)**, d = (U′ − U)/U′ (thường âm); U′ là điện áp trung bình, U là điện áp hiệu dụng (rms). *(QĐ Điều 34.2)*
- **I0% = (I0 / I)·(S / Sr)·100** — I0 đo phía hạ áp, I dòng định mức cuộn hạ áp, S công suất cuộn hạ áp, Sr công suất định mức MBA. MBA 3 pha: lấy trung bình 3 pha; MBA nhiều cuộn: quy về cuộn công suất lớn nhất. *(QĐ Điều 34.2)*
- **Không** hiệu chỉnh I0, P0 theo nhiệt độ. *(QĐ Điều 34.2)*

### Lưu ý
- MBA 3 pha: P0, I0 khi nguồn vào bc (ngắn mạch a) và nguồn vào ab (ngắn mạch c) gần bằng nhau; nguồn vào ac (ngắn mạch b) thường lớn hơn (25÷50)% do kết cấu lõi — đây là bình thường. *(QĐ Điều 34.3)*
- Nguồn sai tần số, méo dạng sóng, thiết bị không đáp ứng IEC 60076-1/-19 làm sai kết quả. *(ĐT I.3)*
- Kết quả thay đổi khác thường: làm thêm FRA (Điều 44). *(ĐT I.3)*`;

  GUIDE.ir = `### Mục đích
Đánh giá tình trạng cách điện cuộn dây qua dòng điện rò; R60/R15 và PI (R600/R60) đánh giá độ ẩm lớp giấy cách điện giữa các vòng dây. Đo cách điện lõi từ, gông từ để xác nhận mạch từ chỉ nối đất **một điểm**. *(QĐ Điều 29.1; ĐT I.4)*

### Điều kiện đo
- Đo khi các bộ phận chính đã lắp hoàn chỉnh, môi trường khô ráo, cách điện bên ngoài đã vệ sinh; MBA dầu đã nạp đầy và để dầu ổn định, bọt khí thoát hết. Chưa đổ đầy dầu chỉ đo khi các chi tiết cách điện chính ngâm hoàn toàn trong dầu (mức dầu cách mặt máy 150–200 mm). *(QĐ Điều 29.2; QT 7.2)*
- Mêgômmét **không nhỏ hơn 2500 V** cho cuộn dây (cuộn có điện áp đầu cực ≤ 1 kV: 1000 V). *(QĐ Điều 29.2; QT 7.2)*
- Nên đo khi nhiệt độ dầu 10–40 °C; MBA 220 kV trở lên tốt nhất chênh với nhiệt độ đo của NSX không quá ±5 °C. *(QĐ Điều 29.2)*
- MBA ≥ 110 kV: tiếp địa cuộn dây cần đo **không dưới 120 giây** trước khi đo; đo lại thì tiếp địa lại **không dưới 300 giây**. *(QT 7.2)*
- Độ ẩm cao, vùng ô nhiễm (ven biển, khu công nghiệp, hóa chất): dùng vòng màn chắn (guard) mặt ngoài sứ để loại dòng rò bề mặt. *(QĐ Điều 29.2)*

### Sơ đồ đấu dây
Các đầu ra của **mỗi cuộn dây nối tắt với nhau**; cuộn không đo nối với vỏ và nối đất. *(QT 7.2; ĐT I.4)*

| Phép đo | Cực (+) LINE | Cực (−) EARTH |
|---|---|---|
| MBA 2 cuộn: Cao – (Hạ + Vỏ + Đất) | Cao | Hạ + Vỏ + Đất |
| MBA 2 cuộn: Hạ – (Cao + Vỏ + Đất) | Hạ | Cao + Vỏ + Đất |
| MBA 3 cuộn: C – (T + H + V + Đ) | Cao | Trung + Hạ + Vỏ + Đất |
| MBA 3 cuộn: T – (C + H + V + Đ) | Trung | Cao + Hạ + Vỏ + Đất |
| MBA 3 cuộn: H – (C + T + V + Đ) | Hạ | Cao + Trung + Vỏ + Đất |

*(ĐT I.4)*

![Sơ đồ đo cuộn cao áp](img:qt-ir-cao)
![Sơ đồ đo cuộn hạ áp](img:qt-ir-ha)
![Đấu Mêgômmét MBA 2 cuộn](img:dt-ir-megom)

### Trình tự đo
1. Nối tắt các đầu cực từng cuộn và nối đất 1–3 phút để phóng hết điện tích dư (MBA ≥ 110 kV: theo thời gian ở trên). *(QT 7.2)*
2. Đấu dây LINE (đỏ) vào cuộn cần đo, EARTH (đen) vào các cuộn còn lại + vỏ + đất theo bảng. *(QT 7.2.1)*
3. Chọn thang điện áp; nhấn PRESS TO TEST (xoay giữ); đọc **R15, R60** (nút DAR/PI); đo PI thì giữ đến **600 giây** đọc R600. *(QT 7.2.1)*
4. Kết thúc đo, nối đất cuộn dây **ít nhất 5 phút** để phóng hết điện tích. *(QĐ Điều 29.2)*
5. Chuyển sơ đồ, đo lần lượt các cuộn còn lại; ghi nhiệt độ dầu / cuộn dây. Không đạt thì dừng, báo Đội trưởng / người có trách nhiệm. *(QT 7.2)*

### Cách điện lõi từ, gông từ
1. Tháo dây nối đất ngoài của lõi / gông từ khỏi hệ thống tiếp đất trạm.
2. Đấu một đầu Mêgômmét vào điểm nối đất lõi / gông đã tháo, đầu kia vào vỏ máy (đã tiếp đất).
3. Đo xong **đấu lại dây tiếp đất lõi / gông từ** — tuyệt đối không để lõi thép nổi điện áp khi vận hành. *(ĐT I.4)*

### Lưu ý
- PI: đo sau lắp đặt, sau sửa chữa nếu biên bản xuất xưởng có đo; trong vận hành khi cách điện suy giảm lớn; không nên dùng PI đánh giá MBA mới. *(QĐ Điều 29.2)*
- Nhiệt độ cuộn dây MBA trên 35 kV có thể xác định qua điện trở một chiều pha B: tx = Rx/R0·(235 + t0) − 235. *(QT 7.2)*
- Đo IR trước khi bơm dòng DC (đo điện trở một chiều) để tránh từ dư; xả điện tích ≥ 5 phút giữa các phép đo. *(ĐT I.4)*
- App tự quy R60 về 20 °C theo K1 (Bảng 45) khi nhập nhiệt độ.

![Mạch tương đương cách điện](img:dt-ir-tuongduong)`;

  GUIDE.vector = `### Mục đích
Kiểm tra cực tính để làm cơ sở xác định tổ đấu dây; tổ đấu dây là cơ sở áp dụng sơ đồ thí nghiệm, công thức quy đổi, điều kiện vận hành song song và đấu nối mạch dòng bảo vệ rơ le. *(QĐ Điều 32.1)*

### Khi nào thực hiện
Bắt buộc sau lắp đặt mới, sau sửa chữa có thay toàn bộ cuộn dây, cách điện, mạch từ hoặc tái cấu trúc MBA; khi không có tài liệu NSX hoặc nghi ngờ dữ liệu. *(QĐ Điều 32.2)*

### Phương pháp
- Thiết bị đo tỉ số biến (TTR) có tích hợp chức năng xác định cực tính và tổ đấu dây; hoặc dùng điện kế (Ganvanomet) và nguồn pin 1,5 V. *(QT 7.6)*
- Trước khi đấu: xác định, đánh dấu đúng tên / thứ tự đầu cực theo nameplate — đấu nhầm thứ tự pha là nguyên nhân phổ biến nhất xác định sai tổ đấu dây. *(ĐT I.7)*

### Kiểm tra cực tính bằng xung một chiều
1. Đấu như hình; nối (+) pin vào A, (−) vào X cuộn điện áp cao; điện kế mắc đúng cực tính vào a – x.
2. Đóng xung dòng một chiều vào cuộn cao áp, quan sát kim: lệch chiều dương — cùng cực tính; lệch chiều âm — ngược cực tính.
3. Đóng ngắt nhanh nhưng đủ để nhìn rõ chiều kim. *(QT 7.6.a)*

![Xác định cực tính](img:qt-polarity)

### Kiểm tra tổ đấu dây bằng xung một chiều
Quy ước: cuộn cao áp A, B, C (X, Y, Z), cuộn hạ áp a, b, c (x, y, z); đầu cực trên nắp máy theo thứ tự O, A, B, C và o, a, b, c từ trái sang phải nhìn từ phía cao áp. *(QT 7.6.b)*

![Tổ đấu dây Y/Y-12 và Y/d-11](img:qt-vector-yy-yd)

**Phương pháp chín trị số** *(QT 7.6.b)*
1. Nối (+) pin vào A, (−) vào B cuộn cao áp.
2. Điện kế (+) vào a, (−) vào b — ghi chiều lệch (phải: +, trái: −). Lặp lại với b–c và a–c.
3. Nối pin B(+) – C(−), lặp lại bước 2; rồi A(+) – C(−), lặp lại bước 2.
4. Tra bảng mẫu xác định tổ nối dây.

![Chín trị số](img:qt-vector-9)

**Phương pháp ba trị số** *(QT 7.6.b)*
1. Nối (+) pin vào B, (−) vào A và C cuộn cao áp.
2. Ghi chiều lệch điện kế lần lượt trên ab, bc, ac; tra bảng.

![Ba trị số](img:qt-vector-3)

| Tổ | ab | bc | ac | Tổ | ab | bc | ac |
|---|---|---|---|---|---|---|---|
| 1 | − | + | + | 0 | − | + | 0 |
| 7 | + | − | − | 6 | + | − | 0 |
| 3 | + | + | + | 2 | 0 | + | + |
| 9 | − | − | − | 8 | 0 | − | − |
| 5 | + | − | + | 4 | + | 0 | + |
| 11 | − | + | − | 10 | − | 0 | − |

*(QT 7.6 — bảng các tổ nối dây, tham khảo mục 7 IEC 60076-1:2011)*`;

  GUIDE.bushing = `### Mục đích
Đánh giá tính năng kỹ thuật của sứ tổ hợp ở MBA: tgδ và điện dung C1 (cách điện chính), C2 (lớp ngoài, giữa test tap và mặt bích); đáp ứng điện môi DFR. *(QĐ Điều 38.1, 38.2; ĐT I.5, I.9)*

### Yêu cầu
- Sứ có cực đo tang (test tap): đo tgδ, điện dung; đo DFR theo IEEE C57.12.200. Chưa đủ thiết bị DFR theo tiêu chuẩn thì dùng máy đo tổn hao điện môi đo ở dải 1 Hz – tần số lớn nhất của máy; DFR bất thường có thể bổ sung DGA dầu sứ. *(QĐ Điều 38.2)*
- Sứ không có test tap, điện áp ≤ 35 kV: thử điện áp tăng cao 1 phút bằng **85%** giá trị trong biên bản xuất xưởng hoặc Bảng 50 (chỉ khi lắp đặt hoặc thay sứ); phần đuôi sứ phải ngâm trong dầu đạt tiêu chuẩn vận hành. *(QĐ Điều 38.2)*
- Thí nghiệm tgδ sứ ở nhiệt độ môi trường 10–40 °C (IEC 60137); nhiệt độ sứ lấy bằng nhiệt độ dầu MBA. *(QĐ Điều 38.2)*
- Trước khi đo: vệ sinh sạch bề mặt sứ và test tap; kiểm tra sứ nguyên vẹn, không nứt, mẻ tán, không rò dầu, đồng hồ mức dầu sứ. *(QĐ Điều 38.2)*

![Test tap của sứ](img:dt-su-testtap)
![Điện dung C1, C2](img:dt-su-c1c2)

### Sơ đồ và trình tự đo
1. Nối tắt các đầu cực của từng cuộn dây; tiếp địa vỏ chắc chắn. *(ĐT I.5)*
2. **C1 — UST**: cao áp vào đầu sứ (cuộn dây đã nối tắt), dây đo vào test tap; mặt bích nối đất. *(ĐT I.5)*
3. **C2**: đo theo sơ đồ và điện áp thử của NSX sứ / thiết bị đo.
4. Đặt điện áp thử (thường 10 kV cho C1), giữ ổn định, đọc tgδ%, C (pF); hạ áp về 0 rồi chuyển sơ đồ. *(ĐT I.5)*
5. Đo xong: xả và tiếp địa test tap (đậy nắp test tap) theo hướng dẫn NSX trước khi hoàn trả đấu nối.

![Sơ đồ UST sứ](img:dt-su-ust)

### DFR sứ
- Điện áp thử: thường 140 V hiệu dụng; môi trường nhiễu cao có thể dùng đến 1400 V. Dải tần điển hình 1 mHz – 1 kHz (hiện trường thường 10 mHz – 1 kHz); tránh đo đúng tần số công nghiệp và các hài. *(ĐT I.9)*
- So sánh với đường cong gốc (xuất xưởng / lần trước), giữa 3 sứ cùng loại trên cùng MBA; hiệu chỉnh nhiệt độ trước khi so. *(ĐT I.9)*
- Đồ thị sai dạng: thường do sứ ẩm sau mưa, bẩn — lau sạch, chờ khô; đồ thị đứt đoạn: nhiễu lớn — dùng guard, bật lọc nhiễu. *(ĐT I.9)*

### Lưu ý
- Trong vận hành tgδ C1 tăng (70–100)% so với khởi đầu: đo thêm tgδ ở 15 Hz và 400 Hz để có thêm cơ sở đánh giá. *(QĐ Điều 38.3.a)*
- Kết quả bất thường: kiểm tra đấu nối trước (quên tháo tiếp địa test tap, nhầm guard / measure), đo lại ít nhất 2 lần. *(ĐT I.5)*
- Độ ẩm không khí cao, bụi bẩn bề mặt, nhiễu từ thiết bị mang điện lân cận làm tgδ tăng hoặc dao động — đo khi khô ráo, dùng guard, lọc nhiễu. *(ĐT I.5)*`;

  GUIDE.wtgd = `### Mục đích
Đo góc tổn hao điện môi tgδ và điện dung để xác định chất lượng cách điện cuộn dây (nhiễm ẩm, nhiễm tạp chất, già hóa). *(QĐ Điều 30.1)*

### Yêu cầu, điều kiện đo
- Bắt buộc với MBA 110 kV trở lên không phân biệt công suất (QT: cả MBA 35 kV từ 10 000 kVA). *(QĐ Điều 30.2; QT 7.3)*
- Điện áp thử xoay chiều hình sin 45–65 Hz, **không vượt quá 10 kV**. *(QT 7.3)*
- Chỉ đo khi nhiệt độ đối tượng **trên 10 °C**; MBA 220 kV, 500 kV tốt nhất đo ở 30–40 °C. Môi trường khô ráo, độ ẩm dưới 80%. *(QT 7.3)*
- Kết quả lớn: xem xét các yếu tố làm tăng kết quả — độ ẩm cao, môi trường ô nhiễm, sứ đầu ra bẩn, nhiễu thiết bị mang điện gần đó — và loại trừ. *(QĐ Điều 30.2)*
- Kiểm tra điện trở cách điện đạt trước khi đo tgδ. *(ĐT I.5)*

### Sơ đồ đấu dây
Tất cả các đầu cực của **mỗi cuộn dây nối tắt với nhau**; cuộn không đo nối với vỏ và nối đất. *(QT 7.3)*

![Sơ đồ nguyên lý đo tgδ cuộn dây](img:qt-tgd-sodo)
![Ba chế độ UST / GST / GSTg](img:dt-tgd-chedo)

**MBA 2 cuộn dây** *(ĐT I.5)*

| STT | Phép đo | Điện dung |
|---|---|---|
| 1 | Cao – (Hạ + Vỏ) | C1 = CH + CHL |
| 2 | Cao – Vỏ (guard = Hạ) | C2 = CH |
| 3 | Cao – Hạ (UST) | C3 = CHL |
| 4 | Hạ – (Cao + Vỏ) | C4 = CL + CHL |
| 5 | Hạ – Vỏ (guard = Cao) | C5 = CL |

Kiểm tra chéo: C3 = C1 − C2 = C4 − C5.

![Đấu máy đo MBA 2 cuộn](img:dt-tgd-2cuon)
![Sơ đồ tương đương](img:dt-tgd-tuongduong)

**MBA 3 cuộn dây** *(QT 7.3 — bảng các phép đo)*

| Không dùng mạch Guard | Dùng mạch Guard |
|---|---|
| Cao – (Hạ + cuộn 3 + Đất) | Cao – (Hạ + Đất), guard vào cuộn 3 |
| Hạ – (Cao + cuộn 3 + Đất) | Cao – Đất, guard vào (Hạ + cuộn 3) |
| Cuộn 3 – (Cao + Hạ + Đất) | Hạ – (cuộn 3 + Đất), guard vào Cao |
| (Cao + Hạ) – (cuộn 3 + Đất) | Hạ – Đất, guard vào (Cao + cuộn 3) |
| (Cao + cuộn 3) – (Hạ + Đất) | Cuộn 3 – (Cao + Đất), guard vào Hạ |
| (Hạ + cuộn 3) – (Cao + Đất) | Cuộn 3 – Đất, guard vào (Cao + Hạ) |
| (Cao + Hạ + cuộn 3) – Đất | (Cao + Hạ) – (cuộn 3 + Đất); (Cao + cuộn 3) – (Hạ + Đất) |

### Trình tự đo
1. Kiểm tra bên ngoài, vệ sinh sứ, tiếp địa vỏ; tháo các dây nối vào hệ thống, nối tắt đầu ra từng cuộn. *(ĐT I.5)*
2. Đấu sơ đồ phép đo đầu tiên (UST hoặc GST). *(ĐT I.5)*
3. Cầu đo tự động: cài chế độ phù hợp, kiểm tra an toàn, nhấn đo — máy tự nâng áp, đo, giảm về 0 và hiển thị tgδ, C. Cầu chỉnh tay: nâng áp, cân bằng cầu ở độ nhạy lớn nhất, đọc kết quả, giảm áp về 0, cắt nguồn. *(QT 7.3, bước 3)*
4. Nối đất cuộn vừa đo, chuyển sơ đồ sang cuộn khác; lặp lại đến hết. *(QT 7.3, bước 4)*
5. Ghi nhiệt độ cuộn dây lúc đo; app tự quy tgδ về 20 °C theo K2 (Bảng 47). *(ĐT I.5)*

### Lưu ý
- Đo ở nhiệt độ cao mà giá trị sau quy đổi lớn bất thường: để MBA nguội rồi đo lại. *(QĐ Điều 30.3)*
- Nghi khiếm khuyết cục bộ: đo ở ít nhất hai cấp điện áp (vd 2 kV và 10 kV) để xem tgδ có tăng theo điện áp (tip-up). *(ĐT I.5)*
- Không kết luận chỉ từ một phép đo tgδ — đối chiếu R60, R60/R15, PI, DGA, DFR. *(ĐT I.5)*`;

  GUIDE.dcr = `### Mục đích
Kiểm tra phần dẫn dòng (cuộn dây chính, cuộn phân áp) có đứt hay chập vòng; điện trở tiếp xúc các mối nối đầu vào và cấu trúc dẫn điện của bộ chuyển nấc. *(QĐ Điều 31.1)*

### Yêu cầu
- Đo với **mọi nấc phân áp**. *(QĐ Điều 31.2)*
- MBA có bộ chuyển nấc: trước khi đo, **chuyển nấc không dưới ba lần toàn bộ nấc**. *(QĐ Điều 31.2)*
- Cuộn có OLTC nên đo với dòng tối thiểu **10 A DC**; dòng đo không vượt **15% dòng định mức** để tránh phát nóng gây sai số. *(QĐ Điều 31.2; QT 7.4)*
- Thực hiện **sau** đo không tải. *(QĐ Điều 34.2)*

### Nguyên lý, sơ đồ
Bơm dòng DC ổn định vào cuộn dây, đo điện áp giáng, R = U/I. Cuộn dây có điện cảm lớn nên chỉ đọc khi dòng đã **xác lập** (giai đoạn quá độ cho kết quả sai). *(ĐT I.6)*

![Nguyên lý vôn – ampe](img:dt-dcr-nguyenly)
![Sơ đồ đấu dây](img:dt-dcr-sodo)
![Đấu CPC 100 + CP SA1](img:qt-dcr-cpc)

### Trình tự đo
1. Cắt điện, cô lập MBA, tháo các đầu nối ngoài. *(ĐT I.6)*
2. Đấu nguồn DC và dây đo áp theo sơ đồ (hoặc thiết bị chuyên dụng: TRAX280, CPC 100…). *(ĐT I.6; QT 7.4)*
3. Khởi động thiết bị, chọn thang, nhập dòng đo, nhiệt độ đo (T meas) và nhiệt độ quy chiếu; nhấn I/O. *(QT 7.4)*
4. Chờ dòng ổn định (khoảng 10 giây trở lên; cuộn lớn có thể vài phút) rồi ghi R, nhiệt độ cuộn dây. *(QT 7.4; ĐT I.6)*
5. Chuyển nấc tiếp theo, lần lượt hết các nấc; rồi các pha, các cuộn còn lại. *(ĐT I.6)*
6. Kết thúc: nhấn dừng, **chờ thiết bị tự xả hết** rồi mới tháo dây; dùng sào tiếp địa nối đất các đầu cực. *(QT 7.4)*
7. **Khử từ dư** cho mạch từ (thiết bị khử từ chuyên dụng, tiếp địa cuộn dây hoặc nút khử của máy đo). *(QĐ Điều 31.2)*

### Lưu ý
- **Không cắt dòng đột ngột, không tháo kẹp khi đang đo** — quá điện áp cảm ứng nguy hiểm cho người và thiết bị. *(ĐT I.6)*
- Quy đổi nhiệt độ: R2 = R1·(235 + t2)/(235 + t1) (dây đồng); app tự quy về 75 °C khi nhập nhiệt độ. *(QĐ Điều 31.3)*
- R một pha tăng bất thường: tiếp xúc xấu đầu nối OLTC, mối hàn; giảm bất thường: chập vòng; dao động: tiếp điểm OLTC kém. *(ĐT I.6)*`;

  GUIDE.ratio = `### Mục đích
Kiểm tra tính đúng đắn của cấu trúc cuộn dây so với thiết kế / nhãn máy; kết hợp hạng mục khác để xác định chạm chập vòng dây, điều kiện vận hành song song. *(QĐ Điều 33.1)*

### Yêu cầu
- Đo tại **tất cả các nấc phân áp**. *(QĐ Điều 33.2)*
- MBA 3 pha có pha độc lập, tiếp cận được: dùng nguồn một pha; thuận tiện thì dùng nguồn ba pha. *(QĐ Điều 33.2)*
- Điện áp đo 80, 120, 220, 380 V…; đưa điện áp vào **cuộn cao áp**; đồng hồ cấp chính xác **0,3** hoặc tốt hơn. *(QĐ Điều 33.2)*

### Đo bằng thiết bị TTR
1. Cô lập MBA, tháo các đấu nối ngoài (đường dây, TU, chống sét van, cáp). *(ĐT I.7)*
2. Xác định đúng đầu cực H, X (Y) theo nameplate; ghi nấc hiện tại (đồng hồ nấc ở tủ và tại thân OLTC phải khớp). *(ĐT I.7)*
3. Đấu dây, **không đấu ngược dây cao H và dây hạ X**; không cấp nguồn máy đo trong khi đang đấu nối. *(ĐT I.7)*
4. Khởi động máy, khai báo MBA theo nameplate; tra **số định danh sơ đồ (Diagram No.)** tương ứng tổ đấu dây và nhập vào máy. *(ĐT I.7)*
5. Đo tại tất cả nấc theo thứ tự (từ nấc 1 đến nấc cuối), mỗi nấc đo 3 pha; ghi tỉ số, độ lệch, góc pha. *(ĐT I.7)*
6. Khai báo sai tổ đấu dây (hoặc MBA sai tổ) thì tỉ số và góc lệch đều sai lệch lớn. *(ĐT I.7)*

![Đấu thiết bị TTR](img:dt-ratio-ttr)
![Bảng Diagram No.](img:dt-ratio-diagram)

### Đo bằng hai vôn mét
1. Đấu như hình; đặt điện áp xoay chiều một pha vào cuộn cao áp; đọc đồng thời hai vôn mét.
2. MBA một pha: K = U_AX / U_ax. MBA ba pha nguồn một pha: K = √3·U1/(2·U2) với cuộn Y/Δ; K = 2·U1/(√3·U2) với cuộn Δ/Y.
3. Khi đo MBA Y/Δ hoặc Δ/Y bằng nguồn một pha: **nối tắt pha không đo ở cuộn tam giác**.
4. Lặp lại ở tất cả các nấc. *(QT 7.5)*

![MBA một pha](img:qt-ratio-1p)
![MBA ba pha, nguồn một pha](img:qt-ratio-3p)

### Lưu ý
- Từ dư sau đo điện trở một chiều làm số đọc dao động: khử từ dư trước, chờ số đọc ổn định. *(ĐT I.7)*
- Sai lệch chỉ ở một vài nấc: nghi hư hỏng cục bộ bộ chuyển nấc; sai đồng loạt nhiều nấc, các pha: nghi chạm chập vòng dây — đối chiếu không tải, điện trở một chiều. *(ĐT I.7)*`;

  GUIDE.oltc = `### Mục đích
Đánh giá toàn bộ quá trình làm việc của bộ OLTC; kiểm tra đồ thị vòng (vị trí tiếp xúc tiếp điểm lựa chọn tĩnh, động); chụp sóng công tắc K để biết sự làm việc của tiếp điểm dập hồ quang và thời gian chuyển tiếp. *(QĐ Điều 37.1, 37.2; ĐT I.10)*

### Yêu cầu
- Thực hiện ở MBA có bộ điều chỉnh điện áp, công suất trên 1000 kVA (một pha) / 3000 kVA (ba pha). *(QĐ Điều 37.2)*
- Chụp sóng công tắc K tiến hành **sau khi lắp đặt hoàn chỉnh** và các hạng mục thí nghiệm MBA khác đã xong, đạt. *(QĐ Điều 37.2)*
- Chỉ thị nấc trên OLTC và trên bộ truyền động phải giống nhau. *(QT 7.8)*
- Dầu khoang điều áp thí nghiệm theo chỉ dẫn NSX (không có thì theo Bảng 49), cùng với dầu thùng chính. *(QĐ Điều 37.2)*

### Thiết bị, sơ đồ
Máy chụp sóng (TM1800 + nguồn dòng LTC135…, TRAX280) hoặc oscilloscope kết hợp nguồn DC bơm vào cuộn dây khi OLTC chuyển nấc. *(ĐT I.10; QT)*

![Sơ đồ nguyên lý](img:qt-oltc-nguyenly)
![Nguyên lý chụp sóng](img:dt-oltc-nguyenly)
![Đấu TM1800 + LTC135](img:dt-oltc-tm1800)

### Trình tự đo
1. Đấu nối: bơm dòng DC qua đầu cực pha (theo từng pha hoặc theo sơ đồ cuộn dây liên quan). *(ĐT I.10)*
2. Chờ dòng ổn định (xác lập từ thông lõi) — vài giây đến vài chục giây tùy công suất MBA. *(ĐT I.10)*
3. Vận hành OLTC chuyển **1 nấc** (động cơ hoặc tay quay); thiết bị ghi liên tục dạng sóng. *(ĐT I.10)*
4. Lặp lại cho tất cả các nấc cần kiểm tra (toàn dải hoặc các nấc nghi ngờ); ghi chiều chuyển, nấc, pha. *(ĐT I.10)*
5. Lưu tệp dạng sóng cùng cấu hình đo — nạp vào app ở mục này để vẽ và làm phụ lục.

![Dạng sóng điện trở động](img:dt-oltc-song)

### Đọc dạng sóng
- Chu trình lý tưởng: điện trở ổn định ở nấc cũ → đỉnh khi điện trở chuyển mạch tham gia → ổn định ở nấc mới. *(ĐT I.10)*
- So sánh giữa các nấc, giữa 3 pha và với dữ liệu gốc (fingerprint): tiếp điểm mòn → điện trở tăng đột biến, nhiễu; thời gian lệch chuẩn → cơ cấu truyền động, lò xo; không thấy đỉnh → điện trở chuyển mạch hỏng, đứt. *(ĐT I.10)*
- Thời gian chuyển mạch đánh giá theo giới hạn của NSX. *(ĐT I.10)*`;

  GUIDE.moisture = `### Mục đích
Đánh giá chất lượng cách điện cứng (giấy, pressboard) qua chỉ tiêu độ ẩm. Phần lớn nước trong hệ cách điện dầu – giấy nằm trong giấy nên độ ẩm dầu chỉ là chỉ số gián tiếp. *(QĐ Điều 28.1; ĐT I.8)*

### Yêu cầu
- Thực hiện với MBA 110 kV trở lên; bắt buộc sau lắp đặt, sau sửa chữa có thay cuộn dây / cách điện / mạch từ. Trong vận hành: lần đầu sau 12 năm, sau đó 6 năm / lần; được miễn khi độ ẩm dầu không vượt 10 ppm. *(QĐ Điều 28.2)*
- Đo bằng bộ thử chuyên dụng (DIRANA, IDAX…): FDS/DFR (quét tần số) kết hợp PDC (dòng phân cực / khử phân cực). *(QĐ Điều 28.2; ĐT I.8)*

### Sơ đồ đấu dây
Về cơ bản giống sơ đồ đo tgδ cuộn dây: đo cách điện chính CHL (UST), các cuộn nối tắt từng cuộn, guard nối đất. *(ĐT I.8)*

![Sơ đồ đo FDS/PDC](img:dt-moist-sodo)

### Trình tự đo
1. Cô lập MBA, tháo đấu nối ngoài; phóng điện, tiếp địa an toàn các đầu sứ trước khi đấu thiết bị. *(ĐT I.8)*
2. **Ghi nhiệt độ dầu / cuộn dây** — mô hình tính độ ẩm phụ thuộc mạnh vào nhiệt độ; đo khi MBA đã ổn định nhiệt (không đo ngay sau khi cắt điện từ mang tải cao). *(ĐT I.8)*
3. Vệ sinh bề mặt sứ; kiểm tra dây HV, dây đo, dây guard, tiếp địa thiết bị đo. *(ĐT I.8)*
4. Đo CHL theo sơ đồ; dùng chế độ FDS kết hợp PDC để rút ngắn thời gian. Trong thời gian đo không đóng cắt, tránh nguồn nhiễu gần. *(ĐT I.8)*
5. Phần mềm khớp đường cong với mô hình X-Y, cho % ẩm giấy và độ dẫn dầu; lưu tệp kết quả, nạp vào app ở mục này. *(ĐT I.8)*

### Lưu ý
- Đối chiếu với độ ẩm dầu, R60/R15, PI; kết quả ở ranh giới hai mức thì đo lại khi nhiệt độ ổn định và đối chiếu DGA (CO, CO2, furan). *(ĐT I.8)*`;

  GUIDE.shortCircuit = `### Mục đích
Xác định tổn thất ngắn mạch Pk và điện áp ngắn mạch Uk ở tần số định mức, dòng định mức; thực hiện riêng cho **từng cặp cuộn dây**. Uk phản ánh điện kháng tản — phát hiện biến dạng cơ khí cuộn dây. *(QĐ Điều 35.1; ĐT I.11)*

### Yêu cầu
- Đo Uk với MBA công suất từ 125 MVA trở lên; MBA có OLTC đo tại **nấc chính, hai nấc đầu và cuối**. *(QĐ Điều 35.2)*
- Không có điện áp thử theo biên bản xuất xưởng: dùng nguồn dòng 2–10 A, điện áp từ 100 V trở lên. *(QĐ Điều 35.2)*
- TI chân sứ không sử dụng phải **nối tắt và nối đất** trước khi đo. *(QĐ Điều 35.2)*
- Bắt buộc sau lắp đặt mới, sau sửa chữa có thay cuộn dây / cách điện / mạch từ; trong vận hành chỉ khi MBA chịu dòng ngắn mạch quá 70% giá trị tính toán. *(QĐ Điều 35.2)*

### Sơ đồ đấu dây
- 2 cuộn: Uk(C-H) — điện áp vào Cao, ngắn mạch Hạ.
- 3 cuộn: Uk(C-T) — vào Cao, ngắn mạch Trung; Uk(C-H) — vào Cao, ngắn mạch Hạ; Uk(T-H) — vào Trung, ngắn mạch Hạ. *(ĐT I.11)*

![MBA 1 pha](img:dt-sc-1pha)
![MBA 3 pha](img:dt-sc-3pha)

### Chuẩn bị
1. Cô lập MBA, tháo đấu nối ngoài; xác định Un, In từng cuộn theo nhãn máy và biên bản xuất xưởng để tính trước dòng thử, công suất nguồn. *(ĐT I.11)*
2. Dây / thanh ngắn mạch tiết diện đủ lớn, vệ sinh và siết chặt điểm nối (điện trở tiếp xúc làm Pk đo cao hơn thực). *(ĐT I.11)*
3. Đặt bộ chuyển nấc ở nấc cần đo và **khóa bộ truyền động**. *(ĐT I.11)*
4. Ghi nhiệt độ cuộn dây / dầu lúc đo (không dùng nhiệt độ môi trường thay thế). *(ĐT I.11)*
5. Lập rào chắn — điện áp thử thấp nhưng dòng có thể lớn. *(ĐT I.11)*

### Trình tự đo
1. Tăng dần điện áp từ 0, theo dõi dòng; ghi đồng thời U, I, P và tần số khi dòng ổn định. *(ĐT I.11)*
2. MBA 3 pha: đo đủ ba pha (hoặc ba lần đo một pha theo sơ đồ nguồn); lặp lại ở các nấc quy định và các cặp cuộn dây. *(ĐT I.11)*
3. Quy đổi về dòng định mức: Pk(Iđm) = Pk(Ithử)·(Iđm/Ithử)²; Uk% gần như không đổi theo dòng ở vùng tuyến tính. *(ĐT I.11)*
4. Nhập vào app theo cặp cuộn, nấc, pha; app quy đổi theo Un, In.

![Nguồn vào cuộn Y — giá trị trung bình](img:dt-sc-y-tb)
![Nguồn vào cuộn Y — quy đổi định mức](img:dt-sc-y-qd)
![Nguồn vào cuộn D — giá trị trung bình](img:dt-sc-d-tb)
![Nguồn vào cuộn D — quy đổi định mức](img:dt-sc-d-qd)

### Theo QĐ 1387/QĐ-EVNNPT (Điều 25–27)
- Thí nghiệm sau lắp đặt mới và đại tu / cải tạo; khi MBA đang vận hành thì thực hiện sau khi dòng ngắn mạch đã qua vượt 70% dòng chịu đựng tính toán. Ngắn mạch và nối đất các BCT không sử dụng theo phương án. *(QĐ 1387 Điều 26)*
- Nối ngắn mạch cuộn dây theo sơ đồ; cấp điện áp xoay chiều ở tần số định mức vào cuộn còn lại, tăng dòng thử đến ít nhất 25% dòng định mức.
- Hiện trường không có điện áp thử theo Test Report: dùng 380 V hoặc điện áp không quá 10 kV rồi nội suy. Nhập điện áp thử theo V hoặc kV; app quy đổi theo Un và In.
- Với OLTC, đo tại nấc chính và hai nấc đầu / cuối; lập phép đo riêng cho từng cặp cuộn dây và từng nấc.
- Ghi cặp cuộn, nấc, pha, nhiệt độ, tần số, điện áp, dòng điện và công suất đo; ghi riêng thành phần PI²R nếu quy trình / thiết bị cung cấp.
- Dùng U, I, Un và In cùng phía được cấp nguồn; quy đổi Uk theo dòng định mức và Pk theo bình phương tỷ số dòng. Chỉ hiệu chỉnh Pk theo nhiệt độ khi có đủ thành phần tổn hao và vật liệu dây dẫn.
- So sánh với Test Report ở cùng cặp cuộn, nấc, tần số, dòng định mức và nhiệt độ quy đổi; thực hiện lại tiếp địa trước khi tháo đấu nối.

### Lưu ý
- Hệ số công suất mạch đo rất thấp (cosφ ~ 0,05–0,15): dùng oát mét / bộ phân tích công suất chính xác ở cosφ thấp. *(ĐT I.11)*
- Pk quy về nhiệt độ chuẩn cần tách thành phần I²R (từ điện trở một chiều) và tổn hao phụ. *(ĐT I.11)*`;

  GUIDE.bct = `### Mục đích
Đánh giá tính năng kỹ thuật của TI tổ hợp ở MBA: điện trở cách điện, tỉ số biến, cực tính, đặc tính từ hóa V-A, điện trở một chiều cuộn thứ cấp. *(QĐ Điều 39.1; QT 7.7)*

### Yêu cầu, trình tự
1. **Điện trở cách điện**: giữa các cuộn với vỏ và giữa các cuộn với nhau, Mêgômmét 1000 V (QĐ) hoặc theo hướng dẫn NSX; khi đo một cuộn thì các cuộn khác **nối tắt và nối đất vỏ**. *(QĐ Điều 39.2; QT 7.7.a dùng 500 V)*
2. **Tỉ số biến, cực tính**: nạp dòng (hoặc áp) AC vào sơ cấp, đo thứ cấp, so với nhãn máy; xác định chiều dòng thứ cấp so với sơ cấp; phát hiện chạm chập vòng thứ cấp. Thiết bị chuyên dụng (CPC 100, SVERKER 780) tự tính tỉ số, kiểm tra cực tính. *(QĐ Điều 39.2; ĐT I.12)*
3. **Đặc tính từ hóa V-A**: hở mạch sơ cấp, nối nguồn AC vào cuộn thứ cấp cần đo; tăng điện áp **từng bước**, ghi (V, I), vẽ đường cong, xác định điểm gãy. Không nâng áp đột ngột. *(QĐ Điều 39.2; ĐT I.12)*
4. **Điện trở một chiều cuộn thứ cấp**: micro-ohm mét, phương pháp 4 dây; ghi nhiệt độ để quy đổi. *(QĐ Điều 39.2; ĐT I.12)*
5. Cấp chính xác (khi áp dụng): đo tỉ số và góc pha ở 100% và 10% dòng danh định với mức tải tiêu chuẩn lớn nhất; cuộn bảo vệ xác định đường cong từ hóa điển hình. *(QĐ Điều 39.2)*
6. Hoàn trả đấu nối, kiểm tra mạch thứ cấp không hở mạch trước khi kết thúc.

![Tỉ số biến bằng dòng AC](img:dt-bct-ratio-i)
![Tỉ số biến bằng điện áp AC](img:dt-bct-ratio-u)
![Điện trở một chiều cuộn thứ cấp](img:dt-bct-dcr)
![Đặc tính từ hóa V-A](img:dt-bct-va)

### Lưu ý
- Tỉ số sai lệch: kiểm tra cực tính, nấc thứ cấp đang dùng; loại trừ từ dư lõi trước khi đo. Điện trở DC biến động: nhiệt độ không ổn định, tiếp xúc đầu đo kém. *(ĐT I.12)*
- So sánh đường V-A giữa các pha cùng loại và với số liệu xuất xưởng; vùng sau điểm gãy phải phẳng (bão hòa rõ). *(ĐT I.12)*
- Đo CPC 100 / MRCT: nạp tệp kết quả vào app ở mục này.`;

  // ===== Trợ giúp =====
  const IMG_RE = /!\[[^\]]*\]\(img:([\w./-]+)\)/g;
  // Khóa ảnh → đường dẫn trong bucket 'library'; ảnh Admin tải thêm có đuôi tệp trong khóa (vd u/so-do-1.png)
  const storagePath = (classCode, key) => `guide/${classCode || 'MBA'}/${/\.\w+$/.test(key) ? key : key + '.png'}`;
  const imageKeys = md => [...new Set([...String(md || '').matchAll(IMG_RE)].map(m => m[1]))];
  // Ảnh mặc định cần nạp từ một tài liệu (dt | qt)
  const imagesOfDoc = doc => Object.entries(IMAGES).filter(([, im]) => im.doc === doc).map(([key, im]) => Object.assign({ key }, im));

  window.MbaGuide = { DOCS, IMAGES, GUIDE, storagePath, imageKeys, imagesOfDoc };
})();
