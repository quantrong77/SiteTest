# BBTN MBA — Web app nhập liệu thí nghiệm hiện trường

Nhập số liệu thí nghiệm MBA theo template `Template/BBTN_MBA_500_x.docx`, tự so sánh từng hạng mục với
số liệu xuất xưởng (`ThinghiemHientruongMBA/Bao_Cao_Thu_Nghiem_3_MBA_500kV_Di_Linh-v4.xlsx`) theo
**số chế tạo**, đánh giá theo QĐ 1901/QĐ-EVNNPT, rồi xuất lại biên bản Word đúng template.

## Chạy

Mở `index.html` bằng Chrome hoặc Edge. Không cần cài đặt, không cần mạng (thư viện JSZip, SheetJS, supabase-js có sẵn trong `js/vendor/`).

**Số liệu không nằm trong repo.** Template BBTN của đơn vị và file Test report xuất xưởng là dữ liệu nội bộ nên không đưa lên Git
(`js/embedded.js`, `*.docx`, `*.xlsx` nằm trong `.gitignore`). Có hai cách nạp:

- Trong app, mục **0. Thông tin chung & cấu hình** → *Nạp template khác* (.docx) và *Nạp file xuất xưởng khác* (.xlsx). Trình duyệt sẽ nhớ cho các lần sau.
- Hoặc nhúng sẵn cho cả đơn vị: đặt template vào `../Template/` và file xuất xưởng vào `../ThinghiemHientruongMBA/`
  (cạnh thư mục app), rồi chạy `python tools/build_embedded.py` để sinh `js/embedded.js`.
Dữ liệu đang nhập được tự lưu trong trình duyệt; dùng **Lưu .json** để lưu hồ sơ ra file và **Mở…** để mở lại.

## Quy trình

1. **0. Thông tin chung**: kiểm tra số chế tạo máy chính, ngày, lý do thí nghiệm. Template A/B/C tự chọn theo
   pha của số chế tạo. Kiểm tra ánh xạ **cột pha A/B/C ↔ số chế tạo** (mặc định theo file xuất xưởng).
2. **Mục 1–11**: nhập số liệu vào các bảng giống hệt template. Có thể **dán khối từ Excel** (Ctrl+V vào ô đầu),
   Enter để xuống dòng. Ô viền xanh/đỏ/vàng = Đạt / Không đạt / Cần xem xét; rê chuột vào ô để xem chi tiết.
   Ô nền xám là giá trị tự tính (Kht, PI, quy đổi 20 °C, ΔR, ΔK…); ô chữ nghiêng mờ là giá trị tự tính có thể ghi đè.
3. **Σ Tổng hợp**: xem toàn bộ kết quả so sánh, chỉnh đánh giá ghi vào BBTN nếu cần, điền kết luận.
4. **Xuất BBTN .docx** (điền vào template) và **Xuất so sánh .xlsx** (bảng so sánh chi tiết để lưu hồ sơ).

## Tra cứu xuất xưởng theo số chế tạo

| Hạng mục | Khóa tra cứu |
|---|---|
| Không tải, cách điện, tgδ cuộn dây, độ ẩm, OLTC | Số chế tạo máy chính |
| Điện trở một chiều, tỷ số biến | Số chế tạo của từng cột pha + nấc (9a/9b/9c → 9A) |
| Sứ đầu vào | **Số chế tạo sứ** nhập ở bảng; không khớp thì theo vị trí đầu sứ của máy ứng với cột pha |
| Biến dòng chân sứ | Số chế tạo máy (cột pha) + ký hiệu cuộn, vd `2S1-2S3` (mã lõi CT đặt ở mục 0) |

## Tiêu chí áp dụng (QĐ 1901)

- R60 ≥ Bảng 5 tại nhiệt độ đo (file xuất xưởng không có R60 tuyệt đối nên chưa áp được tiêu chí “giảm ≤30%”);
  PI theo Điều 29; lõi/gông > 500 MΩ (mới) / > 100 MΩ (đã vận hành).
- tgδ cuộn dây ≤ 1 % ở 20 °C (K2 – Bảng 47), nếu lớn hơn thì xét mức tăng ≤ 30 % so với xuất xưởng cùng nhiệt độ; điện dung ±5 %.
- Sứ RIP Hitachi Energy — theo HD vận hành sứ của hãng mục 19.6–19.8, đúng nghiệp vụ file `SuRIP_Hitachi_QuyDoi20C.xlsx`:
  - T sứ = T môi trường khi **chưa lắp**; = (2·T môi trường + T dầu)/3 khi **đã lắp** (chọn trạng thái ở từng phía sứ).
  - tanδ20 = tanδ/fc (fc nội suy Bảng 13, 0–80 °C); C20 = C·(1 − ΔT·0,0004); sứ đã lắp: C1 relative = C1@20 + ΔC (Bảng 14).
  - So với **test report của hãng theo S/N sứ** (sheet TestReport), dung sai Bảng 15 theo Ur (≤145 kV / >145 kV);
    kết luận "Không đạt – liên hệ Hitachi Energy" / "Đạt" / "Chưa đủ dữ liệu". Hằng số đọc từ sheet TraCuu (sửa ô vàng khi hãng cập nhật).
  - Nạp file ở mục 0 (*Nạp test report sứ*) hoặc nhúng sẵn bằng `tools/build_embedded.py`.
  - Sứ hãng khác: chọn "Nhập hệ số K" và tiêu chí ở mục 0 (tham khảo Bảng 52, Điều 38).
- R một chiều quy về 75 °C: R2 = R1·(235+t2)/(235+t1), lệch ≤ 2 % so với NSX và giữa các pha.
- Tỷ số biến lệch ≤ 0,5 % so với nameplate và giữa các pha.
- P0 (MBA 1 pha ≥ 110 kV) lệch ≤ 10 % sau lắp đặt/sửa chữa, ≤ 15 % vận hành; độ ẩm cách điện cứng theo Điều 28;
  TI chân sứ ≥ 200 MΩ.
- Chỗ QĐ 1901 không nêu ngưỡng (đặc tính V-A, R một chiều TI chân sứ, C2 sứ, đo không tải ở điện áp thấp)
  được ghi “Tham khảo” để lưu làm giá trị khởi đầu, không tự đặt ngưỡng.

Lưu ý: ghi chú cuối Bảng 45 viết R(t2) = R(t1)/K1 khi t2 < t1, ngược với chiều vật lý của điện trở cách điện.
App quy đổi theo chiều vật lý (nhiệt độ giảm thì R tăng) và hiển thị rõ hệ số K1 trong biên bản để người đánh giá kiểm tra.

## Cơ sở dữ liệu Supabase (lưu trữ & xu hướng)

### Cài đặt một lần
1. Tạo project trên supabase.com (hoặc Supabase tự host).
2. Mở **SQL Editor**, chạy lần lượt các file trong `supabase/migrations/` theo thứ tự tên:
   `…000100_field_test_db.sql`, `…000200_substation_bay_hierarchy.sql`, `…000300_auth_profile.sql`
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

- Trong app: mục 0 → **Nạp template khác** / **Nạp file xuất xưởng khác** (file mới phải cùng cấu trúc).
- Hoặc nhúng lại vào bản phân phối: `python tools/build_embedded.py`.

## Cấu trúc mã

| File | Vai trò |
|---|---|
| `js/qd1901.js` | Bảng tra, phép quy đổi và ngưỡng theo QĐ 1901 |
| `js/factory.js` | Đọc file xuất xưởng (dò theo nhãn/tiêu đề), API tra cứu theo số chế tạo |
| `js/schema.js` | Ánh xạ biểu mẫu ↔ bảng/hàng/cột trong template |
| `js/evaluate.js` | Tính toán, so sánh, đánh giá, kết luận gợi ý |
| `js/docx.js` | Điền dữ liệu vào template .docx, giữ nguyên định dạng |
| `js/app.js` | Giao diện, lưu/mở, xuất file |
| `js/db.js` | Chuyển biểu mẫu / Test report thành dòng số liệu; đọc ghi Supabase |
| `js/db-ui.js` | Trang CSDL và trang Xu hướng |
| `js/catalog-ui.js` | Trang danh mục Trạm – Ngăn lộ – Thiết bị (CRUD) |
| `js/auth-ui.js`, `css/auth.css` | Đăng nhập Google/email, trạng thái phiên, thông báo, vạch tiến trình |
| `supabase/migrations/` | Lược đồ CSDL, view xu hướng, RLS, Storage |
