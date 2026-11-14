# Site Test Report — Web app biên bản thí nghiệm hiện trường thiết bị nhất thứ

Hiện app hỗ trợ **máy biến áp (MBA)**; các thiết bị nhất thứ khác (TI, TU, MC, DCL, CSV…) sẽ được bổ sung dần.

Nhập số liệu thí nghiệm MBA theo template `Template/BBTN_MBA_500_x.docx`, tự so sánh từng hạng mục với
số liệu xuất xưởng (`ThinghiemHientruongMBA/Bao_Cao_Thu_Nghiem_3_MBA_500kV_Di_Linh-v4.xlsx`) theo
**số chế tạo**, đánh giá theo QĐ 1901/QĐ-EVNNPT, rồi xuất lại biên bản Word đúng template.

## Chạy

Mở `index.html` bằng Chrome hoặc Edge. Không cần cài đặt, không cần mạng (thư viện JSZip, SheetJS, supabase-js có sẵn trong `js/vendor/`).

Trong Chrome/Edge, bấm **Đọc số** ở đầu hạng mục để nhập số tiếng Việt vào ô đang chọn; bật **Liên tục** để tự chuyển xuống hàng dưới trong cùng cột. Chrome/Edge gửi âm thanh lên máy chủ Google để nhận dạng, nên cần có mạng.

**Xu hướng ngay tại ô nhập:** khi đã đăng nhập và mở biên bản đã lưu CSDL, dưới ô số có lịch sử hiện biểu đồ nhỏ và % thay đổi của giá trị đang nhập (đã quy đổi 20 °C / 75 °C như khi lưu) so với xuất xưởng (XX) và lần đo trước. Tô vàng khi vượt ngưỡng QĐ 1901 so với giá trị khởi đầu (R một chiều, tỷ số, điện dung, mức tăng tgδ). Lịch sử lưu tạm trong trình duyệt để xem khi mất mạng. Chỉ để tham khảo, không đổi kết quả đánh giá.

**Số liệu không nằm trong repo.** Template BBTN của đơn vị và file Test report xuất xưởng là dữ liệu nội bộ nên không đưa lên Git
(`js/embedded.js`, `*.docx`, `*.xlsx` nằm trong `.gitignore`). Có hai cách nạp:

- Trong app, mục **0. Thông tin chung & cấu hình** → *Nạp template khác* (.docx) và *Nạp file xuất xưởng khác* (.xlsx). Trình duyệt sẽ nhớ cho các lần sau.
- Hoặc nhúng sẵn cho cả đơn vị: đặt template vào `../Template/` và file xuất xưởng vào `../ThinghiemHientruongMBA/`
  (cạnh thư mục app), rồi chạy `python tools/build_embedded.py` để sinh `js/embedded.js`.
Dữ liệu đang nhập được tự lưu trong trình duyệt; dùng **Lưu .json** để lưu hồ sơ ra file và **Mở…** để mở lại.

## Quy trình

1. **Mới** → chọn loại thiết bị (hiện có Máy biến áp; các loại khác hiện "Chưa hỗ trợ").
   **0. Thông tin chung**: kiểm tra số chế tạo máy chính, ngày, lý do thí nghiệm. Template A/B/C tự chọn theo
   pha của số chế tạo. Kiểm tra ánh xạ **cột pha A/B/C ↔ số chế tạo** (mặc định theo file xuất xưởng).
2. **Mục 1–11**: mỗi hạng mục có 4 bước *Chuẩn bị · Hướng dẫn đo · Nhập số liệu · Đánh giá* và khung *Tài liệu tham khảo*
   (điều khoản QĐ 1901; quy trình đơn vị và HD máy đo khi có). Thanh điều hướng hiện tiến trình và trạng thái từng hạng mục
   (chưa làm / đang làm / đã nhập / đạt / cần xem xét / không đạt), vẫn nhảy tự do giữa các hạng mục.
   Bước Nhập số liệu: nhập vào các bảng giống hệt template. Có thể **dán khối từ Excel** (Ctrl+V vào ô đầu),
   Enter để xuống dòng. Ô viền xanh/đỏ/vàng = Đạt / Không đạt / Cần xem xét; rê chuột vào ô để xem chi tiết.
   Ô nền xám là giá trị tự tính (Kht, PI, quy đổi 20 °C, ΔR, ΔK…); ô chữ nghiêng mờ là giá trị tự tính có thể ghi đè.
3. **Σ Tổng hợp**: xem toàn bộ kết quả so sánh, chỉnh đánh giá ghi vào BBTN nếu cần, điền kết luận.
4. **Xuất BBTN .docx** (điền vào template) và **Xuất so sánh .xlsx** (bảng so sánh chi tiết để lưu hồ sơ).

## Đọc ảnh nameplate (mục 0)

- Nút **Nhập ảnh nameplate…** ở đầu khối *Thông tin thiết bị*; hoặc **kéo thả ảnh** vào khung đó, hoặc **dán ảnh (Ctrl+V)** khi đang ở mục 0. Chữ được nhận dạng ngay trong trình duyệt bằng
  Tesseract.js (ảnh không gửi đi đâu); lần đầu tải thư viện và dữ liệu tiếng Anh (~10 MB) từ CDN, sau đó máy lưu sẵn.
- Ảnh được phóng to, chuyển xám, lọc trung vị (bỏ hạt nhiễu, vân xước kim loại) trước khi đọc. Bảng nhãn – giá trị bị
  OCR tách cột được ghép lại theo toạ độ trên ảnh, có bù độ nghiêng.
- Trường đọc: hãng, kiểu loại, số chế tạo, năm, công suất (cuộn HV), điện áp và dòng định mức (ghép HV/MV/LV đúng cách
  ghi trong BBTN), tổ đấu dây, kiểu OLTC (mục 9), I0 nameplate (cấu hình mục 0).
- Hộp thoại cho xem ảnh, sửa giá trị, chọn ô cần điền, xoay ảnh đọc lại. Sau khi điền: ô **tô vàng** = đọc được nhưng chưa
  chắc chắn (độ tin cậy < 80 %, đã sửa ký tự O→0, bỏ khoảng trắng, ghép theo thứ tự cuộn, số giá trị giữa các cuộn không
  khớp…), ô **tô đỏ** = không đọc được, cần nhập tay; có băng nhắc ở đầu khối. Sửa ô thì ô đó hết tô nền; hoặc bấm
  *Đã kiểm tra hết*.
- OCR trên ảnh chụp thật có thể sai (lóa, chữ khắc mờ, góc chụp): luôn đối chiếu với nameplate.

## Phụ lục BBTN (chụp sóng OLTC, SFRA)

Trang **Phụ lục BBTN** (thanh điều hướng, nhóm Kết quả). Khi xuất BBTN .docx, mỗi phụ lục được nối thành một section
riêng sau biên bản (trang mới, đánh số trang lại; nhiều phụ lục thì đánh "PHỤ LỤC 1, 2").

- **Chụp sóng OLTC**: dựng từ file Haefely 2293 nhập ở mục 9.
- **SFRA**: bấm *Mở SFRA Analyzer* (https://quantrong77.github.io/-Analysis-SFRA/), phân tích rồi tải báo cáo Word ở mục
  *Báo cáo*; quay lại bấm *Nạp báo cáo SFRA (.docx)…*. App hiện tiêu đề, số phép đo, kết luận của báo cáo; khi xuất,
  nội dung báo cáo (bảng, giản đồ Bode, kết luận) được nối nguyên văn — ảnh và kiểu đoạn được chép sang mã riêng để không
  đụng định dạng template; bỏ phần chân trang, đánh số danh sách, chú thích của file nguồn.
- File báo cáo giữ trong kho file của trình duyệt (IndexedDB), đi kèm file **.json** khi *Lưu .json* (base64) và được
  tải lên Storage (`documents`, kind `OTHER`, đường dẫn `<S/N>/<lần TN>/appendix/<mã>.docx`) khi *Lưu CSDL*; mở biên
  bản từ CSDL ở máy khác thì tự tải về.

## Bộ tiêu chí đánh giá

### Thư viện tài liệu

Tài liệu tiêu chuẩn, quy trình của đơn vị và hướng dẫn máy đo được quản lý trong thư viện dùng chung; file nằm trong bucket Storage riêng tư, danh mục có thể nhập từ Excel. Cần chạy migration `20261114000700_standards_library.sql` trên Supabase trước khi sử dụng.

- Trang **Bộ tiêu chí đánh giá** (TC): mọi ngưỡng Đạt / Không đạt, giá trị gốc QĐ 1901 và căn cứ (Điều, mục). Mọi người xem được;
  **Admin** chỉnh giá trị áp dụng và ghi chú lý do (hướng dẫn NSX, văn bản của đơn vị), hoặc khôi phục toàn bộ theo QĐ 1901.
- Ngưỡng đã chỉnh được tô màu; trang đánh giá của từng hạng mục có dòng nhắc; **kết luận tự động của BBTN ghi rõ** ngưỡng nào khác
  QĐ 1901 và giá trị gốc. Các bảng tra (K1, K2, Bảng 5, PI, độ ẩm) giữ nguyên theo QĐ 1901.
- Lưu ở bảng `criteria_overrides` (migration `…000600`); app giữ bản sao trên máy để dùng khi mất mạng.

## Xóa / hoàn tác số liệu theo hạng mục

- Mỗi hạng mục có nút **Hoàn tác** (kèm số bước) và **Xóa số liệu hạng mục** cạnh thanh 4 bước.
- Mỗi bước hoàn tác là một thao tác: sửa xong một ô, dán bảng, nhập file máy đo (Haefely 2293, CPC 100), điền tự động,
  thêm / xóa dòng, xóa hạng mục. Một lần nhập file đổi nhiều hạng mục thì mỗi hạng mục có bước riêng (vd hoàn tác mục 9
  không đụng số liệu mục 7, 8 vừa nhập cùng file).
- **Ctrl+Z** khi con trỏ không ở trong ô nhập: hoàn tác hạng mục đang mở (trong ô nhập, Ctrl+Z vẫn là hoàn tác gõ chữ).
- Xóa hạng mục giữ nguyên thông tin chung, cấu hình (đề mục cột, nhãn dòng) và kết luận.
- Lịch sử giữ trong phiên làm việc (tối đa 200 bước), mất khi tải lại trang hoặc tạo / mở biên bản khác.

## Tra cứu xuất xưởng theo số chế tạo

| Hạng mục | Khóa tra cứu |
|---|---|
| Không tải, cách điện, tgδ cuộn dây, độ ẩm, OLTC | Số chế tạo máy chính |
| Điện trở một chiều, tỷ số biến | Số chế tạo của từng cột pha + nấc (9a/9b/9c → 9A) |
| Sứ đầu vào | **Số chế tạo sứ** nhập ở bảng; không khớp thì theo vị trí đầu sứ của máy ứng với cột pha |
| Biến dòng chân sứ | Số chế tạo máy (cột pha) + ký hiệu cuộn, vd `2S1-2S3` (mã lõi CT đặt ở mục 0) |

## Tiêu chí áp dụng (QĐ 1901)

- Điện trở cách điện: **R60@20 = R60(t) × K1**, K1 tra **Bảng 4** QĐ 1901 theo độ chênh nhiệt độ (đo dưới 20 °C thì chia K1);
  tiêu chuẩn **R60@20 ≥ Bảng 5 tại 20 °C** (MBA ≥110 kV: 600 MΩ). PI theo Điều 29; lõi/gông > 500 MΩ (mới) / > 100 MΩ (đã vận hành).
- tgδ cuộn dây: **tgδ@20 = tgδ(t) ÷ K2**, K2 tra **Bảng 7** QĐ 1901 (đo dưới 20 °C thì nhân K2); tiêu chuẩn **tgδ@20 °C ≤ 1 %**; điện dung ±5 %.
- Độ chênh không có trong bảng: nhân các hệ số (vd 9 °C = K(5)×K(4), như ví dụ trong QĐ 1901).
- Sứ RIP Hitachi Energy — theo HD vận hành sứ của hãng mục 19.6–19.8, đúng nghiệp vụ file `SuRIP_Hitachi_QuyDoi20C.xlsx`:
  - T sứ = T môi trường khi **chưa lắp**; = (2·T môi trường + T dầu)/3 khi **đã lắp** (chọn trạng thái ở từng phía sứ).
  - tanδ20 = tanδ/fc (fc nội suy Bảng 13, 0–80 °C); C20 = C·(1 − ΔT·0,0004); sứ đã lắp: C1 relative = C1@20 + ΔC (Bảng 14).
  - So với **test report của hãng theo S/N sứ** (sheet TestReport), dung sai Bảng 15 theo Ur (≤145 kV / >145 kV);
    kết luận "Không đạt – liên hệ Hitachi Energy" / "Đạt" / "Chưa đủ dữ liệu". Hằng số đọc từ sheet TraCuu (sửa ô vàng khi hãng cập nhật).
  - Nạp file ở mục 0 (*Nạp test report sứ*) hoặc nhúng sẵn bằng `tools/build_embedded.py`.
  - Sứ hãng khác: chọn "Nhập hệ số K" và tiêu chí ở mục 0 (tham khảo Bảng 52, Điều 38).
- Bảng hệ số K quy đổi tgδ sứ về 20 °C (trang **Hệ số quy đổi sứ**, chỉ **Admin** được thêm/sửa/xóa):
  - Có sẵn bảng **QĐ 1901** (OIP/RIP, 17–60 °C, theo `Cauhinh/Kquidoi_1901.xlsx`); admin thêm bảng **theo hãng** (nhập tay hoặc từ Excel:
    cột 1 nhiệt độ, các cột sau K, tên loại sứ lấy từ tiêu đề cột).
  - Mục 5, ô *Cách quy đổi về 20 °C*: HD Hitachi · Theo QĐ 1901 · Theo hãng – <tên bảng> · Nhập hệ số K.
  - Tra K theo loại cách điện sứ và nhiệt độ sứ (đã lắp: nhiệt độ dầu MBA – Điều 38; chưa lắp: nhiệt độ môi trường);
    tgδ20 = tgδ(t) × K (bảng theo hãng có thể khai báo ÷ K). Cách tra: dòng gần nhất (bảng theo từng °C) hoặc nội suy. Giá trị XX quy đổi bằng cùng bảng.
- R một chiều quy về 75 °C: R2 = R1·(235+t2)/(235+t1), lệch ≤ 2 % so với NSX và giữa các pha.
- Tỷ số biến lệch ≤ 0,5 % so với nameplate và giữa các pha.
- P0 (MBA 1 pha ≥ 110 kV) lệch ≤ 10 % sau lắp đặt/sửa chữa, ≤ 15 % vận hành; độ ẩm cách điện cứng theo Điều 28;
  TI chân sứ ≥ 200 MΩ.
- Biến dòng chân sứ — **XML CPC 100** (mục 11): mỗi bảng đặc tính từ hóa (từng phía, từng pha A/B/C/N) có nút
  **Tải XML CPC 100…** riêng; nút **Nhập XML CPC 100…** ở đầu mục cho chọn nhiều file một lần (phía/pha đoán từ tên file, sửa được).
  Mỗi cuộn lấy **điểm khuỷu** (ưu tiên giá trị CPC 100 tính; máy không báo thì tính theo IEC 61869-2: +10 % áp → +50 % dòng,
  gắn nhãn "kiểm tra") và **mốc 25 / 50 / 75 %** — theo % U_k khi có khuỷu, theo % U lớn nhất đã đo khi không xác định được khuỷu.
  Dòng tại các mốc nội suy log–log trên đường cong đo. Khi xuất BBTN, bảng đặc tính từ hóa được chèn thêm cột "Điểm khuỷu"
  và hàng tiêu đề; đầu cuộn thực đo (vd 2S1-2S5) ghi vào ô nhãn. File có cuộn 5, 6 tự mở thêm cuộn (HV tối đa 6, MV 5).
- Biến dòng chân sứ — **Megger MRCT** (mục 11, nút *Nhập Megger MRCT (.pdbxml, PDF)…*): chọn file `.pdbxml` của PowerDB
  và/hoặc báo cáo PDF "CT TEST REPORT" in từ PowerDB (PDF có lớp chữ; đọc trong trình duyệt bằng pdf.js, tải khi dùng lần đầu).
  - PDF: tỷ số định mức và đo, sai số %, lệch góc pha, cực tính, điện trở một chiều, điểm khuỷu, bảng đặc tính từ hóa từng cặp đầu ra.
  - `.pdbxml`: điện trở một chiều, điểm khuỷu, đường từ hóa (khối nhị phân `satchartdata`), dòng định mức; **không có** kết quả tỷ số.
  - Hộp thoại cho gán mỗi CT vào phía/pha MBA và mỗi lõi vào "cuộn" của BBTN (mặc định theo mã lõi ở mục 0). Điền tỷ số đo
    (sơ cấp/thứ cấp, vd 3000:3 → 1000) và sai số, R một chiều cho các cặp S1-S*k* có ô trong BBTN; cặp khác (vd 1S2-1S3) chỉ xem.
    Đặc tính từ hóa lấy cặp đầu ra có đủ số liệu (đường cong và điểm khuỷu do máy tính), không có thì cặp S1-S lớn nhất có
    đường cong; khuỷu lấy theo máy (ghi rõ chuẩn, vd ANSI 45) rồi mốc 25/50/75 % U_k. Máy không báo khuỷu thì ô khuỷu
    ghi "Không có" và lấy 3 mốc 25/50/75 % theo U lớn nhất đã đo (app không tự tính khuỷu cho MRCT).
    Cực tính ghi vào ô "Kết quả kiểm tra cực tính" khi ô còn trống. Hai lõi cùng vào một ô thì không cho điền.
- **Haefely 2293** (mục 7, 8, 9 — nút *Nhập file Haefely 2293…*): chọn cùng lúc các file `.csv` xuất từ máy và file `.bin`
  cùng tên của cả ba pha (bỏ qua `.dat`, `.mat`).
  - Điện trở một chiều theo nấc → mục 7 (Ω → mΩ), tỷ số biến theo nấc → mục 8, bảng chuyển nấc + dạng sóng → mục 9.
  - Pha lấy theo tên file (…TAP-A, …TSB B, …pha C) vì máy 1 pha đo từng máy với cùng dây A–N; cặp cuộn của tỷ số biến
    đoán theo tỷ số định mức xuất xưởng gần nhất; nơi ghi của từng loại số liệu sửa được trong hộp thoại.
  - Nấc 9 của máy (17 nấc) ghi vào hàng 9b (chọn được 9a / 9c / cả ba). Nhóm điện trở lệch xa các file khác mặc định không điền.
  - Biểu mẫu chỉ có một ô nhiệt độ mỗi cuộn: các pha đo ở nhiệt độ khác nhau được quy về cùng nhiệt độ
    (R2 = R1·(235+t2)/(235+t1)) trước khi ghi — có thể bỏ chọn trong hộp thoại.
  - Dạng sóng R(t) (3250 mẫu, 6500 Hz) được nén (min/max mỗi 5 mẫu, 16 bit) và lưu trong biên bản (`state.att.oltc`),
    xem trước ở mục 9. Khi xuất BBTN, **phụ lục chụp sóng OLTC** được nối vào section riêng sau biên bản (đánh số trang lại):
    mỗi pha một bảng số liệu và đồ thị từng lần chuyển nấc (hoặc gộp theo chiều tăng / giảm).
  - QĐ 1901 không nêu ngưỡng chụp sóng: app chỉ báo “Cần xem xét” khi máy không ghi nhận chuyển mạch (tFall = tRise = 0)
    hoặc dòng đo sụt dưới 50 % trong lúc chuyển nấc; đánh giá theo hướng dẫn NSX OLTC.
- Chỗ QĐ 1901 không nêu ngưỡng (đặc tính V-A, R một chiều TI chân sứ, C2 sứ, đo không tải ở điện áp thấp)
  được ghi “Tham khảo” để lưu làm giá trị khởi đầu, không tự đặt ngưỡng.

## Cơ sở dữ liệu Supabase (lưu trữ & xu hướng)

### Cài đặt một lần
1. Tạo project trên supabase.com (hoặc Supabase tự host).
2. Mở **SQL Editor**, chạy lần lượt các file trong `supabase/migrations/` theo thứ tự tên:
   `…000100_field_test_db.sql`, `…000200_substation_bay_hierarchy.sql`, `…000300_auth_profile.sql`, `…000400_bushing_k_tables.sql`, `…000500_bushing_k_formula_mul.sql`, `…000600_criteria_overrides.sql`
   (hoặc dùng Supabase CLI: `supabase link` rồi `supabase db push`).
3. Trong app: trang **CSDL** → nhập *Project URL* và *anon/publishable key* (Settings → API) → **Kết nối**.
   Muốn điền sẵn trên máy: chép `js/config.example.js` thành `js/config.js` rồi điền URL + key
   (`js/config.js` nằm trong `.gitignore`, không đưa lên Git). Không bao giờ dùng `service_role` key trong app.
4. Đăng ký tài khoản trong app. Người mới mặc định quyền **viewer** (chỉ xem). Cấp quyền trong SQL Editor:
   ```sql
   update public.app_users set role = 'admin'  where email = 'ban@donvi.vn';   -- người quản trị đầu tiên
   update public.app_users set role = 'editor' where email = 'thinghiem@donvi.vn';
   ```

### Đăng nhập bằng Google

Đăng nhập Google cần mở app qua địa chỉ `http(s)`, không mở trực tiếp file `index.html`:
chạy **`start.bat`** (mở `http://localhost:8000`) hoặc bật GitHub Pages cho repo (Settings → Pages → Branch `main`, thư mục `/root`).

Cấu hình một lần:

1. **Google Cloud Console** (console.cloud.google.com) → *APIs & Services*:
   - *OAuth consent screen*: chọn *External*, điền tên app và email hỗ trợ.
   - *Credentials* → *Create credentials* → *OAuth client ID* → loại *Web application*.
     Mục *Authorized redirect URIs* thêm: `https://<project-ref>.supabase.co/auth/v1/callback`
     (lấy đúng địa chỉ ở Supabase → Authentication → Providers → Google → *Callback URL*).
   - Chép *Client ID* và *Client secret*.
2. **Supabase** → *Authentication* → *Sign In / Providers* → **Google**: bật, dán Client ID + Client secret, Save.
3. **Supabase** → *Authentication* → *URL Configuration*:
   - *Site URL*: địa chỉ chính của app (vd `https://quantrong77.github.io/SiteTest/`).
   - *Redirect URLs*: thêm `http://localhost:8000/**` và `https://quantrong77.github.io/SiteTest/**`.
4. Chạy thêm migration `20261023000300_auth_profile.sql` để lưu tên & ảnh đại diện Google.

Người đăng nhập Google lần đầu được tạo tài khoản quyền **viewer**; admin cấp quyền như trên.
Đèn trên nút tài khoản: xanh = được nhập liệu, hổ phách = chỉ xem, xám = chưa đăng nhập, nhấp nháy = đang xử lý.

### Dữ liệu lưu trữ
| Bảng | Nội dung |
|---|---|
| `substations` → `bays` → `equipment` | Trạm → Ngăn lộ → Thiết bị (một trạm nhiều ngăn, một ngăn nhiều thiết bị). Thiết bị con (sứ `SU`, OLTC) thuộc thiết bị cha và tự theo ngăn của cha. Đã có sẵn danh mục loại TI, TU, MC, DCL, CSV… để mở rộng |
| `test_sessions` | Mỗi lần thí nghiệm: `FAT` (Test report xuất xưởng), `SAT` (sau lắp đặt), `PERIODIC`, `AFTER_REPAIR`…; kèm toàn bộ biểu mẫu (`app_state`) để mở lại và xuất lại BBTN |
| `measurements` | Một giá trị một dòng: hạng mục · đại lượng · sơ đồ/cuộn · pha · nấc, giá trị đo, nhiệt độ, **giá trị quy đổi chuẩn** (20 °C / 75 °C), đánh giá |
| `test_findings` | Kết quả so sánh – đánh giá của app tại thời điểm lưu |
| `documents` + Storage `test-documents` | File BBTN .docx đã xuất, Test report gốc |
| `v_trend_delta` | Chuỗi xu hướng kèm giá trị khởi đầu (FAT nếu có) và % thay đổi |

Phân quyền (RLS): viewer xem; editor nhập/sửa và xóa bản nháp của mình; admin toàn quyền.

### Sử dụng
- **Trạm – Ngăn – Thiết bị**: xem dạng 3 cột, thêm / sửa / xóa. Các ô có danh sách gợi ý (giá trị chuẩn + giá trị đã nhập trước đó)
  nhưng vẫn gõ tự do được. Chỉ xóa được trạm/ngăn/thiết bị khi không còn dữ liệu phụ thuộc (ngăn, thiết bị, số liệu thí nghiệm).
- Trước khi **Lưu CSDL** hoặc **Nhập Test report**, chọn Trạm/Ngăn lộ ở trang CSDL để thiết bị mới được gắn vào ngăn đó.
- **Nhập Test report vào CSDL** (trang CSDL): tạo lần thí nghiệm FAT cho từng máy, kèm sứ và BCT — mốc khởi đầu của xu hướng. Chạy lại chỉ cập nhật, không tạo trùng.
- **Lưu CSDL** (thanh trên cùng hoặc trang CSDL): lưu biên bản đang nhập dạng nháp, hoặc **Lưu & chốt** khi đã hoàn chỉnh.
- **Mở / Xuất BBTN .docx** từ danh sách biên bản đã lưu: mở lại biểu mẫu và xuất đúng template; file .docx được lưu kèm vào Storage.
- **Xu hướng**: chọn MBA (có thể gồm cả sứ/OLTC), chọn chuỗi số liệu → biểu đồ theo thời gian từng pha/thiết bị, bảng % thay đổi,
  và danh sách các chuỗi thay đổi nhiều nhất ở lần đo gần nhất.

## Cập nhật template hoặc file xuất xưởng

- Trong app: mục 0 → **Nạp template khác** / **Thêm file xuất xưởng** / **Thêm test report sứ**.
- Hoặc nhúng lại vào bản phân phối: `python tools/build_embedded.py`.

### Nhiều MBA (vd AT1, AT2): file xuất xưởng và test report sứ

- **File xuất xưởng** (`Bao_Cao_Thu_Nghiem_….xlsx`): mục 0 → *Thêm file .xlsx…*. App giữ mọi file đã thêm (lưu trình duyệt) cùng
  file nhúng sẵn và **tự chọn file chứa số chế tạo máy chính** khi nhập số chế tạo hoặc mở biên bản; các cột pha A/B/C đặt lại
  theo các máy của file đó. Chọn tay ở ô "File số liệu xuất xưởng" (mục 0) hoặc trang **Số liệu xuất xưởng** (Dùng file này / Bỏ).
- Bộ đọc nhận hai bố cục: cột theo "Máy N (số chế tạo)" và cột theo "Pha A (số chế tạo)" (nấc ở cột riêng, sứ và BCT mỗi dòng
  một mục, cách điện ghi R60/Kht/PI/C/tgδ từng dòng). Phần không có trong file (vd bảng điều kiện thí nghiệm, độ ẩm DFR, thông số
  chịu đựng của sứ) hiện thành cảnh báo ở mục 0; các so sánh cần số liệu đó để trống tham chiếu.
- **Test report sứ Hitachi** (`SuRIP_Hitachi_….xlsx`): mục 0 → *Thêm file .xlsx…*; các file được **gộp theo S/N sứ** (trùng S/N
  lấy file thêm sau), dùng chung cho mọi MBA. *Bỏ n file đã thêm* để về file nhúng sẵn.

### Mẫu chung 3 pha (một BBTN cho tổ 3 máy 1 pha A, B, C)

Mục 0 → *Template BBTN dùng để xuất* → **3P** (bản trống của "BBTN MBA 500kV 3 pha chung", đặt ở
`../Template/Mau BBTN/BBTN MBA 500kV 3 pha chung (trong).docx` rồi chạy `tools/build_embedded.py`; template tùy chỉnh
28 bảng cũng được nhận là mẫu 3 pha). Biểu mẫu đổi bố cục theo mẫu:

- Không tải, điện trở cách điện (R15, R60, R180, R360, R600, Kht, PI; lõi/gông), tgδ cuộn dây (có cột tgδ@20 °C trong bảng) nhập
  **theo từng máy A, B, C**, mỗi máy một nhiệt độ; mỗi máy so với số liệu xuất xưởng của chính nó (số chế tạo theo cột pha ở mục 0).
- Kiểm tra bên ngoài theo 9 hạng mục; sứ 5 nhóm (cao áp, trung áp, trung tính từng máy, hạ áp a-b-c, x-y-z) có **nhiệt độ đo
  riêng từng sứ** (đã lắp: nhiệt độ dầu, chưa lắp: nhiệt độ môi trường; dùng để quy đổi tgδ về 20 °C, trống thì theo nhiệt độ chung
  ở đầu mục 5). Template không có hàng này nên khi xuất app chèn hàng "Nhiệt độ đo (°C)" vào mỗi bảng sứ (template đã có thì giữ nguyên);
  R một chiều 17 nấc, đơn vị mΩ, nhiệt độ đo theo từng máy; tỷ số HV:MV, HV:LV theo nấc, MV:LV nấc 9; ẩm theo pha; OLTC số vòng theo pha.
- Biến dòng chân sứ: nhập ở mục 13 như mẫu theo pha, khi xuất thành **Phụ lục biến dòng chân sứ** nối cuối BBTN.
- BBTN ghi số chế tạo cả 3 máy; chân trang "Page x of y" của biên bản không tính trang phụ lục (phụ lục đánh số riêng).
- Đổi template giữa chừng: số liệu chung (R một chiều, tỷ số, sứ, OLTC, BCT) giữ nguyên; hạng mục theo máy dùng ô riêng của mỗi bố cục.

### Mẫu MBA 3 pha 110–220 kV

Mục 0 → *Template BBTN dùng để xuất* → **110** (bản trống của "Mau BBTN MBA 110-220", đặt ở
`../Template/Mau BBTN/Mau BBTN MBA 110-220 (trong).docx` rồi chạy `tools/build_embedded.py`; template tùy chỉnh 71 bảng cũng được
nhận là mẫu này). Cùng biểu mẫu PTC3/BM.01 với mẫu theo pha nên hạng mục, đánh giá, dòng CSDL giống mẫu theo pha; khác:
nấc đánh số 1…19, chỉ số bảng theo chỗ ngắt trang của mẫu 110-220 (`Schema.MAP_110`), không đổi template theo pha máy chính và
không lấy số chế tạo theo pha từ file xuất xưởng tổ máy 1 pha.

### Nhập BBTN cũ vào CSDL (chuỗi xu hướng)

Trang **Nhập BBTN cũ** (nhóm Cơ sở dữ liệu): chọn nhiều file .docx hoặc cả thư mục BBTN đã ban hành theo một trong các mẫu trên.
App nhận dạng mẫu theo số bảng của phần biên bản (bảng phụ lục không tính), đoán số cuộn thứ cấp biến dòng chân sứ theo bảng có số
liệu, đọc mọi ô nhập theo đúng vị trí dùng để xuất (ô tự tính được tính lại), đọc ngày dạng dd/mm/yyyy, dd.mm.yyyy hoặc
"ngày … tháng … năm …". Bảng soát cho biết mẫu, số chế tạo, ngày, số ô đọc được và cảnh báo (thiếu số chế tạo / ngày, đọc quá ít ô).
*Mở để soát* nạp thành biên bản đang mở để kiểm tra, sửa rồi lưu; *Lưu CSDL* lưu thẳng (đã chốt) với nguồn `manual`, kèm tên và
file gốc trên Storage. Mẫu chung 3 pha ghi số chế tạo cả 3 máy trong một ô: máy chính lấy số đầu, cột pha A/B/C theo thứ tự.

## Phát triển với agent (Codex, Claude Code)

Quy tắc chung cho agent lập trình: [AGENTS.md](AGENTS.md) (Claude Code đọc qua CLAUDE.md). Bảng phân công việc giữa Codex và Claude Code, mẫu giao việc:
[docs/PHAN_CONG.md](docs/PHAN_CONG.md).

## Kiểm tra tự động

Cần Node.js 22 trở lên, không cài thêm thư viện:

```
npm test
```

- `test/calc.test.js`: phép quy đổi và bảng tra QĐ 1901 (K1, K2, Bảng 5, PI, độ ẩm), hệ số K sứ, sứ Hitachi, đặc tính từ hóa CPC 100.
- `test/evaluate.test.js`: ảnh chụp toàn bộ kết quả đánh giá MBA (`test/snapshots/evaluate.json`) trên hồ sơ mẫu dựng từ schema
  (`test/mba-fixture.js`, số liệu giả). Sửa phép tính, ngưỡng hay câu chữ đánh giá sẽ làm test này đỏ; nếu thay đổi là cố ý,
  chạy `npm run test:update` rồi xem diff của file ảnh chụp trước khi commit.
- `test/to-rows.test.js`: ảnh chụp các dòng CSDL sinh từ biểu mẫu MBA (`test/snapshots/to-rows.json`) — khóa sơ đồ đo,
  pha, nấc, giá trị quy đổi mà trang Xu hướng dùng để nối các lần đo.
- `test/wa2293.test.js`: đọc file Haefely 2293 (dữ liệu tổng hợp đúng định dạng máy), ánh xạ nấc/pha/mΩ, quy đổi nhiệt độ,
  nén dạng sóng, phụ lục; có thư mục số liệu thật `../MBA/Rdc/Chup song` trên máy thì kiểm tra thêm.
- `npm run test:e2e` (`tools/e2e_export_3p.py`, cần Playwright cho Python và `js/embedded.js` có template 3P; thiếu thì bỏ qua):
  mở app trong trình duyệt, chọn mẫu chung 3 pha, điền số liệu giả, xuất BBTN và kiểm từng ô của file .docx (thông tin chung,
  tổng hợp, số liệu theo máy, hàng nhiệt độ sứ, mΩ, OLTC, phụ lục BCT, chân trang); kiểm thêm mẫu theo pha A vẫn xuất đúng.
- `test/mba-3p.test.js`: bố cục, đánh giá theo từng máy, dòng CSDL, phụ lục BCT, nhiệt độ riêng từng sứ của mẫu chung 3 pha.
- `test/factory-layouts.test.js`: đọc file xuất xưởng bố cục theo pha (số liệu giả), gộp test report sứ Hitachi theo S/N.
- `test/mrct.test.js`: đọc `.pdbxml` Megger MRCT (khối nhị phân đường từ hóa dựng lại) và chữ báo cáo PDF PowerDB (theo tọa độ cột,
  ô trống, mục chữ gộp nhiều số).
- `test/nameplate.test.js`: đọc nameplate từ chữ OCR (giá trị giả): đủ trường, ghép cột theo toạ độ, trường cần kiểm tra / thiếu.
- `test/criteria.test.js`: bộ tiêu chí (mặc định = QĐ 1901, ngưỡng đơn vị dùng khi đánh giá và ghi vào kết luận), hạng mục dùng chung.
- `test/appendix.test.js`: tóm tắt báo cáo SFRA, đánh số phụ lục.
- `test/history.test.js`: khóa số liệu → hạng mục, hoàn tác tách theo hạng mục, xóa rồi hoàn tác.
- `test/types.test.js`: đăng ký loại thiết bị, biên bản cũ không ghi loại → MBA, lưu biên bản qua kho dữ liệu.
- `test/layers.test.js`: ranh giới ba lớp (nghiệp vụ không chạm DOM/mạng; giao diện không truy vấn Supabase trực tiếp;
  `index.html` nạp đủ file theo thứ tự lớp).
- GitHub Actions chạy test cho mỗi pull request, và chạy trước bước triển khai GitHub Pages.

## Cấu trúc mã

Ba lớp, lớp trên chỉ gọi lớp ngay dưới. Mỗi loại thiết bị là một mô-đun đăng ký với `EquipmentTypes.register({ code, label,
classCode, defaultCfg, normalizeCfg, buildSchema, evaluate, autoConclusion, factory, toRows, report, references, workflow })`;
lõi app dùng chung cho mọi loại. Biên bản lưu `state.type`; biên bản cũ không có trường này được coi là MBA.

| Lớp / file | Vai trò |
|---|---|
| **`js/domain/`** — nghiệp vụ, hàm thuần (test bằng Node) | |
| `common.js` | Số, định dạng, xếp hạng kết quả, duyệt biểu mẫu, loại lần thí nghiệm, ngày |
| `qd1901.js`, `bushing-k.js`, `bushing-hitachi.js` | Bảng tra, quy đổi, ngưỡng QĐ 1901; hệ số K sứ; quy đổi sứ RIP Hitachi |
| `equipment-types.js` | Đăng ký và tra loại thiết bị |
| `report.js`, `records.js` | Đọc giá trị mặc định từ template; lưu biên bản / Test report qua kho dữ liệu (`Records.setRepo`) |
| `types/mba/nameplate.js` | Tách thông tin thiết bị từ chữ OCR của ảnh nameplate, độ tin cậy, trạng thái từng trường |
| `appendix.js` | Danh sách và đánh số phụ lục, tóm tắt báo cáo SFRA |
| `edit-history.js` | Lịch sử chỉnh sửa theo hạng mục: hoàn tác, xóa số liệu hạng mục |
| `criteria.js` | Bộ tiêu chí: ngưỡng gốc QĐ 1901 và ngưỡng đơn vị đã chỉnh, câu ghi vào kết luận |
| `test-items.js` | Hạng mục dùng chung cho mọi loại thiết bị: quy đổi về 20 °C / 75 °C, so sánh R một chiều, tỷ số biến, lệch pha, điện dung |
| `oltc-wave.js` | Nén / giải nén dạng sóng điện trở động OLTC, nhận biết bất thường máy đo ghi nhận |
| `types/mba/` | Mô-đun MBA: `schema.js` (biểu mẫu ↔ bảng/hàng/cột template), `evaluate.js`, `factory.js` (đọc file xuất xưởng), `to-rows.js` (dòng CSDL), `report.js` (ghi BBTN, phụ lục chụp sóng), `import-2293.js` (số liệu Haefely 2293 → biểu mẫu), `index.js` (đăng ký) |
| **`js/data/`** — dữ liệu và tích hợp | |
| `db.js` | Kho dữ liệu Supabase: kết nối, đăng nhập, ghi/đọc lần thí nghiệm, thiết bị, tài liệu, danh mục |
| `docx.js` | Đọc/ghi template .docx, giữ nguyên định dạng; nối phụ lục (bảng, ảnh, nội dung file .docx khác) trong section riêng |
| `ocr.js` | Nhận dạng chữ trên ảnh (Tesseract.js, nạp khi dùng), tiền xử lý ảnh |
| `pdf-text.js` | Lấy chữ kèm tọa độ từ PDF (pdf.js, nạp khi dùng) |
| `criteria-repo.js` | Nạp / lưu bộ tiêu chí đơn vị từ CSDL, bản sao offline |
| `file-store.js` | Kho file đính kèm trong trình duyệt (IndexedDB) |
| `bushing-k-repo.js` | Nạp bảng hệ số K sứ từ CSDL, bản sao offline |
| `instruments/cpc100.js` | Bộ đọc file XML OMICRON CPC 100 (đặc tính từ hóa, điểm khuỷu) |
| `instruments/mrct.js` | Bộ đọc Megger MRCT: `.pdbxml` PowerDB và báo cáo PDF "CT TEST REPORT" (tỷ số, sai số, góc pha, cực tính, R, khuỷu, từ hóa) |
| `instruments/wa2293.js` | Bộ đọc file Haefely 2293: `.csv` (UTF-16) điện trở, tỷ số biến, chuyển nấc; `.bin` dạng sóng chụp OLTC |
| **`js/ui/`** — giao diện | |
| `app.js` | Lõi giao diện: vẽ biểu mẫu theo schema, đánh giá tức thời, lưu/mở, xuất .docx/.xlsx, chọn loại thiết bị |
| `workflow.js` | Tiến trình, 4 bước của hạng mục, khung Tài liệu tham khảo |
| `types/mba/ui.js`, `types/mba/cpc-dialog.js`, `types/mba/mrct-dialog.js`, `types/mba/wa2293-dialog.js`, `types/mba/oltc-chart.js`, `types/mba/nameplate-dialog.js` | Giao diện riêng của MBA (chú thích hạng mục, cấu hình mục 0, sứ, CPC 100, Megger MRCT, Haefely 2293, đồ thị chụp sóng, đọc ảnh nameplate) |
| `criteria-ui.js` | Trang Bộ tiêu chí đánh giá |
| `appendix-ui.js` | Trang Phụ lục BBTN: liên kết SFRA Analyzer, nạp báo cáo SFRA |
| `db-ui.js`, `catalog-ui.js`, `kconf-ui.js`, `auth-ui.js` | Trang CSDL & Xu hướng; danh mục Trạm – Ngăn – Thiết bị; hệ số K sứ; đăng nhập |
| `supabase/migrations/` | Lược đồ CSDL, view xu hướng, RLS, Storage |

### Phụ lục DFR sứ đầu vào

Trang Phụ lục cho phép nạp CSV từ OMICRON DIRANA (từng file hoặc cả thư mục), chọn phía/pha và phép đo dùng khi có đo lại. BBTN trình bày tanδ (%) và điện dung C (pF) tại 15 Hz, 400 Hz cùng đồ thị đáp ứng tần số; đây là số liệu tham khảo, không có kết luận đạt/không đạt.
