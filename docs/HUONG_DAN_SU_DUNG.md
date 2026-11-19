# Hướng dẫn sử dụng Site Test Report

Tài liệu hướng dẫn theo tên nút và nội dung đang có trong repo.
Một số chức năng cần Supabase hoặc file template nội bộ của đơn vị.
Luôn dùng số liệu thật trong môi trường được phép; ví dụ trong repo phải là giả.

Mở hướng dẫn này trong app bằng nút ? trên header hoặc phím F1. Khi đang ở một hạng mục, app sẽ đưa bạn tới phần hướng dẫn liên quan; nhấn **Quay lại hạng mục** để trở về.

## Bắt đầu nhanh: 10 bước

1. Mở site trên Chrome hoặc Edge, hoặc chạy `start.bat` (cần Node.js 22.12+ hoặc 20.19+; lần đầu cần mạng để cài các gói phụ thuộc).
2. Bấm **Mới**, chọn **Máy biến áp** trong hộp chọn loại thiết bị.
3. Mở mục **0. Thông tin chung & cấu hình**, kiểm tra số chế tạo và mẫu.
4. Nạp template DOCX và file xuất xưởng XLSX nếu bản phân phối chưa có.
5. Điền thông tin chung, nhiệt độ môi trường và cấu hình cần thiết.
6. Chọn hạng mục, đọc hướng dẫn đo, nhập hoặc nạp kết quả máy đo.
7. Kiểm tra ô tự tính, cảnh báo và các giá trị so sánh xuất xưởng.
8. Mở **Σ Tổng hợp**, rà phát hiện và bấm **Điền kết luận tự động**.
9. Mở **Phụ lục BBTN** nếu có file OLTC, SFRA, DFR hoặc BBTN dầu cần đính kèm.
10. Bấm **Xuất BBTN .docx**, **Xuất so sánh .xlsx** và **Lưu .json**.

Khi xuất Word, cuối BBTN có phụ lục bảng tra theo từng hạng mục MBA, gồm tiêu chí QĐ EVNNPT và các tiêu chuẩn IEC/IEEE liên quan. Phần QĐ EVNNPT nêu căn cứ đánh giá; IEC/IEEE nêu mã thử, phương pháp hoặc hướng dẫn và không tự tạo giới hạn đạt/không đạt. Khi quy định không nêu ngưỡng chung, đối chiếu Test Report, nhà chế tạo, giá trị gốc và quy trình được duyệt.

## 1. Mở ứng dụng và tạo biên bản

### Mở ứng dụng

1. Mở URL GitHub Pages do đơn vị cung cấp bằng Chrome hoặc Edge.
2. Nếu dùng bản local, cài Node.js 22.12 trở lên (hoặc 20.19 trở lên); chạy `npm ci` lần đầu, sau đó `start.bat` tại thư mục dự án.
3. Không mở trực tiếp `index.html` nếu cần Google OAuth.
4. Lần đầu mở, app tạo biên bản MBA mặc định nếu chưa có hồ sơ đang nhập.
5. Dữ liệu nhập dở được tự lưu trên trình duyệt hiện tại.
6. Dùng **Lưu ▾ → Lưu file .json** để sao lưu thành file.
7. Dùng **Mở ▾ → File .json trên máy** để mở file JSON đã lưu.
8. JSON trên một máy không tự đồng bộ sang máy khác.

### Bố cục màn hình

- **Thanh điều hướng bên trái** chia nhóm:
  - **Biên bản** — thông tin chung & cấu hình, số liệu xuất xưởng, nhập BBTN cũ (dữ liệu đầu vào của biên bản đang lập);
  - **Hạng mục thí nghiệm** — mô hình 3D và các mục 1…12;
  - **Kết quả** — tổng hợp & kết luận, **xu hướng**, phụ lục BBTN;
  - **Cơ sở dữ liệu** — biên bản đã lưu, trạm – ngăn – thiết bị;
  - **Tiêu chuẩn & tra cứu** — bộ tiêu chí, hệ số quy đổi sứ, thư viện tài liệu.
  Hai nhóm cuối bấm vào tên nhóm để đóng / mở.
- Nút **«** (hoặc **Ctrl+B**) thu gọn thanh điều hướng thành dải hẹp chỉ còn số mục và trạng thái; di chuột lên mục để xem tên. Kéo mép phải thanh điều hướng để đổi độ rộng; nhấp đúp mép để về mặc định.
- **Thanh công cụ:** **Mới**; **Mở ▾** (biên bản trong CSDL / file .json); **Lưu ▾** (lưu lên CSDL / lưu file .json); **Xuất BBTN .docx**; **Xuất khác ▾** (bảng so sánh – đánh giá .xlsx).
- Trong mỗi hạng mục, thanh **Chuẩn bị · Hướng dẫn đo · Nhập số liệu · Đánh giá** luôn hiện khi cuộn. Khung **Tài liệu tham khảo** bên phải (màn hình rộng từ 1100 px) kéo thanh chia để đổi độ rộng (Tab tới thanh chia rồi dùng mũi tên trái / phải), bấm **×** để ẩn, nút **Tài liệu tham khảo** để hiện lại.
- App nhớ các lựa chọn bố cục trên từng máy.

### Tạo hồ sơ mới

1. Bấm **Mới** trên thanh công cụ.
2. Hộp thoại **Chọn loại thiết bị** hiện ra.
3. Chọn loại đang được hỗ trợ, hiện là **Máy biến áp**.
4. Các loại chưa triển khai được đánh dấu chưa hỗ trợ.
5. Nếu chọn lại cùng loại đang mở, cấu hình của loại có thể được giữ lại.
6. Nếu đổi loại, app dùng cấu hình mặc định của loại mới.
7. Biên bản mới thay state hiện hành; hãy lưu hồ sơ cần giữ trước đó.
8. App mở **trình khởi tạo biên bản** (Thông tin chung & cấu hình) gồm 4 bước, bấm tên bước để chuyển, nút **Tiếp ›** / **‹ Quay lại** ở cuối trang:
   1. **Thiết bị** — đã đăng nhập: chọn **Trạm → Ngăn (vị trí lắp đặt) → Thiết bị** từ danh mục; ngăn có tổ 3 máy 1 pha rời thì chọn thêm **Pha**
      (BBTN riêng máy pha A / B / C, hoặc **Cả tổ A+B+C** — mẫu chung 3 pha); thiết bị chưa có trong danh mục chọn **＋ Thiết bị mới trong ngăn này** rồi nhập số chế tạo.
      Bấm **Chọn thiết bị này →**: app gắn ngăn (lưu CSDL ghi thiết bị vào ngăn), chọn mẫu BBTN theo pha / cấu hình, điền số chế tạo các máy của tổ.
      Chưa đăng nhập: chọn cấu hình và nhập số chế tạo như trước.
      Khối **Test report xuất xưởng** (bước ① và ②): nút **Nhập Test Report (.xlsx)…** nạp file test report của thiết bị — chưa có số chế tạo thì
      file một máy (hoặc tổ 3 máy pha A / B / C) tự điền số chế tạo; sau đó app tự điền thông số kỹ thuật và chuyển sang bước ②.
   2. **Thông số kỹ thuật** — app tự điền tên trạm, vị trí lắp đặt, hãng, kiểu, năm sản xuất, công suất, điện áp, dòng, tổ đấu dây theo thứ tự:
      thông số đã lưu của thiết bị trong **CSDL** → **test report** (file .xlsx trên máy có số chế tạo này, hoặc file test report gốc lưu trong CSDL — tự tải về) → **BBTN gần nhất** của thiết bị trong CSDL (ô ghi “Tự điền từ BBTN dd/mm/yyyy”) → **nhập tay**. Điện áp, dòng định mức: test report / BBTN (đủ các cuộn) trước CSDL.
      Ô tự điền tô vàng "Tự điền từ … — kiểm tra lại"; ô chưa có nguồn nào tô đỏ "nhập tay" (giá trị mẫu của template được xóa để khỏi ghi nhầm).
      Sửa ô là bỏ tô nền; ô đã nhập tay không bị ghi đè. Nút **Điền lại từ CSDL / test report** chạy lại theo số chế tạo đang nhập; vẫn dùng được **Nhập ảnh nameplate…**.
      Test report đang dùng mà CSDL chưa có số liệu xuất xưởng của máy: bấm **Lưu test report lên CSDL** để lưu làm **giá trị khởi đầu**
      (chỉ lưu máy của biên bản; thiết bị mới gắn vào ngăn đã chọn ở bước ①). Đã có thì app ghi "Đã có số liệu xuất xưởng trong CSDL — FAT ngày …".
   3. **Lần thí nghiệm** — lý do, ngày, nhiệt độ, độ ẩm; giá trị khởi đầu sau sửa chữa; hạng mục thực hiện.
   4. **Mẫu & cấu hình** — template, file xuất xưởng đang dùng, phạm vi xuất BBTN, phụ lục, thông số tính toán. Bấm **Bắt đầu nhập số liệu →** sang hạng mục đầu.
9. **Thiết bị mới, chưa vận hành:** nhập test report trước (mục **XX** hoặc nút trên), lưu lên CSDL làm giá trị khởi đầu. Khi lắp đặt xong, khởi tạo BBTN,
   chọn thiết bị ở bước ①: app tự tải test report đã lưu, lấy thông số kỹ thuật và dùng số liệu xuất xưởng để so sánh, đánh giá xu hướng.
10. Trang này không còn trên thanh điều hướng. Muốn sửa lại thông tin chung, bấm **thanh thông tin biên bản** (Máy biến áp · S/N · ngày · lý do ✎) ở đầu trang.
11. Bảng **Các máy trong file xuất xưởng** (Job No., P0, nhiệt độ đo, độ ẩm DFR) chuyển sang mục **XX** (khối File .xlsx trên máy này).

## 2. Mục 0: Thông tin chung và cấu hình

Mở bằng nút **Mới** (trình khởi tạo 4 bước, xem mục 1) hoặc bấm thanh thông tin biên bản ở đầu trang. Các phần dưới đây nằm trong các bước tương ứng.

Tên một số nút trong khu vực có thể thay đổi theo nhánh/tính năng.
Hãy dùng đúng nhãn hiển thị trên phiên bản đang chạy.

### Hạng mục thực hiện và lý do thí nghiệm

1. **Lý do thí nghiệm** chọn một trong: Sau lắp đặt, 1 năm sau lắp đặt, Định kỳ 1 năm, Định kỳ 3 năm, Định kỳ 6 năm, Tăng cường, Đột xuất, Sau sửa chữa/đại tu. Biên bản cũ ghi lý do khác vẫn giữ nguyên (hiện là "giá trị cũ").
2. Ngưỡng "MBA mới" của QĐ 1901 áp dụng cho *Sau lắp đặt* và *Sau sửa chữa/đại tu*; *1 năm sau lắp đặt* và các lần định kỳ dùng ngưỡng máy đã vận hành.
3. Khối **Hạng mục thực hiện trong lần thí nghiệm này**: bỏ tích hạng mục không làm (cũng có ô **Thực hiện** ở đầu từng hạng mục). Hạng mục bỏ tích: ẩn vùng nhập liệu, không đánh giá, không ghi CSDL, ô "đã thí nghiệm" ở trang 1 BBTN để trống. Số liệu đã nhập vẫn được giữ, tích lại là hiện.

### Thông tin nhận dạng và điều kiện đo

1. Nhập số chế tạo máy chính vào trường số chế tạo.
2. Với mẫu chung 3 pha, nhập số chế tạo theo từng cột pha A, B, C.
3. Kiểm tra ánh xạ pha A/B/C sang số chế tạo tương ứng.
4. Nhập hãng, kiểu loại, năm sản xuất và thông tin nameplate nếu có.
5. Nhập ngày thí nghiệm.
6. Chọn lý do thí nghiệm như sau lắp đặt, định kỳ hoặc sau sửa chữa khi có trường tương ứng.
7. Nhập nhiệt độ môi trường dùng làm mặc định cho phép đo phụ thuộc nhiệt độ.
8. Kiểm tra thông tin đầu vào trước khi dùng kết quả tự tính.

### Chọn mẫu và template

1. Chọn **Cấu hình thiết bị** trước: tổ 3 MBA một pha, MBA ba pha hoặc MBA một pha độc lập. Điện áp định mức không tự chọn topology.
2. Với tổ 3 MBA một pha (thường là MBA 500 kV), nhập S/N riêng cho pha A, B, C. Các S/N được giữ lại khi đổi file Test Report.
3. Chọn **Một BBTN chung cho cả tổ A+B+C** hoặc **Tách thành BBTN riêng theo pha**. Khi tách, chọn pha cần xuất; một pha tải DOCX, nhiều pha tải ZIP chứa từng DOCX.
4. Mẫu theo pha (**A**, **B**, **C**) là mẫu riêng cho từng máy một pha. Mẫu chung **3P** gộp ba MBA một pha A, B, C vào một biên bản. Với mẫu theo pha, nhập **Số chế tạo máy pha B, C trong tổ**: cột pha B, C của bảng R một chiều và tỷ số biến được so với xuất xưởng và ghi CSDL theo máy đó; máy độc lập thì để trống.
   - Phụ lục *Bảng tra cứu tiêu chuẩn thí nghiệm* (QĐ EVNNPT, IEC, IEEE) mặc định **không kèm** để BBTN đúng mẫu giấy; muốn kèm thì chọn *Kèm phụ lục cuối BBTN* ở mục **Phụ lục BBTN**.
5. Với MBA ba pha 110–220 kV, chọn topology MBA ba pha và nhập một S/N; ứng dụng chỉ xuất một BBTN. Với MBA một pha độc lập, chọn topology tương ứng và nhập một S/N.
6. Số mục khác nhau giữa các mẫu: xem bảng dưới. Các phần 4–14 của hướng dẫn này theo cách đánh số mẫu theo pha / 110.
7. Nếu cần template riêng, dùng nút **Chọn file template…** và chọn DOCX bản trống đúng loại, đúng layout.
8. Đọc cảnh báo nếu số bảng không khớp template chuẩn; mở DOCX vừa tải để kiểm tra bảng, số chế tạo và phụ lục.

| Hạng mục | Mẫu theo pha, mẫu 110 | Mẫu chung 3P |
|---|---:|---:|
| Kiểm tra bên ngoài | 1 | 1 |
| Dòng điện và tổn hao không tải | 2 | 2 |
| Điện trở cách điện | 3 | 3 |
| Tổ đấu dây | 4 | 4 |
| Sứ đầu vào | 5 | 5 |
| Tgδ và điện dung cuộn dây | 6 | 7 |
| Điện trở một chiều | 7 | 8 |
| Tỷ số biến | 8 | 9 |
| OLTC | 9 | 11 |
| Độ ẩm cách điện cứng | 10 | 10 |
| Biến dòng chân sứ | 11 | 13 (phụ lục hoặc trong mục 13, tùy chọn) |

### Cấu hình nhãn nấc và cách đo

1. Kiểm tra danh sách nhãn nấc trong mục cấu hình.
2. Mẫu theo pha mặc định dùng tập nhãn phù hợp template.
3. Mẫu 110 có 19 nhãn nấc, thường đánh số 1…19.
4. Mẫu chung 3P có số nấc riêng theo schema.
5. Nếu sửa nhãn nấc, nhập đủ số lượng được yêu cầu.
6. Cấu hình **Phép đo cuộn cao áp** chọn A-N hoặc A-Am.
7. A-N gồm đấu nối tiếp và chung theo cách mô tả giao diện.
8. A-Am chỉ đo cuộn nối tiếp theo cách mô tả giao diện.
9. Tên cột và mapping xuất DOCX đổi theo lựa chọn.
10. Mẫu 110–220 kV: chọn **Bộ điều áp dưới tải (OLTC) đặt ở cuộn**. Máy 220 kV kiểu Liên Xô cũ có OLTC ở phía 110 kV thì chọn *Cuộn trung áp*: R một chiều cuộn trung áp và tỷ số MV:LV nhập theo nấc, cuộn cao áp và tỷ số HV:LV một giá trị.

### Cấu hình biến dòng chân sứ

1. Chọn số cuộn thứ cấp cho mỗi phía theo thiết bị thực tế.
2. Mã lõi cần khớp nhãn thực tế và sơ đồ báo cáo.
3. Nếu có cuộn 5 hoặc 6, app có thể mở thêm cuộn tương ứng.
4. Kiểm tra ký hiệu cuộn trước khi nhập dữ liệu CPC 100 hoặc MRCT.
5. Không suy diễn ngưỡng cho phép nếu nhà sản xuất chưa nêu.
6. Mẫu 3 pha chung: ô **Số liệu BCT trong BBTN** ở đầu mục 13 chọn *Đính kèm cuối BBTN như phụ lục* (mặc định) hoặc *Đưa vào mục 13 của biên bản*. Biên bản cũ mở lại vẫn xuất phụ lục như trước.

### Nạp file xuất xưởng nhiều file

1. Bấm **Thêm file .xlsx…** trong mục 0.
2. Chọn file xuất xưởng của máy cần lập biên bản.
3. Có thể thêm file cho nhiều máy trong cùng tổ như AT1, AT2.
4. App giữ danh sách file đã thêm và tra cứu số chế tạo trong từng file.
5. Khi nhập số chế tạo máy chính, app tự chọn file chứa số đó nếu tìm thấy.
6. Nếu số chế tạo thuộc file khác, app đổi file xuất xưởng được dùng.
7. Kiểm tra thông báo số chế tạo không có trong file.
8. Nếu cần, chọn thủ công file số liệu xuất xưởng tại trường cấu hình.
9. Nguồn tham chiếu của từng pha cần khớp số chế tạo trong cột pha.
10. File lớn có thể chỉ được giữ trong phiên nếu không lưu được vào local storage.

### Tra cứu và sửa số liệu xuất xưởng (mục XX)

1. Mở **XX Số liệu xuất xưởng** (nhóm Biên bản). Đăng nhập để xem số liệu đã lưu CSDL; chưa đăng nhập chỉ thấy file .xlsx trên máy.
2. Cây bên trái: **Trạm → Ngăn → Thiết bị → Số chế tạo** (máy chính và các sứ) theo **toàn bộ danh mục** — ngăn chưa có thiết bị, thiết bị **chưa có test report** vẫn hiện (chuột phải → **Nhập test report (.xlsx)…**). Thiết bị chưa gắn trạm / ngăn nằm ở nhóm **Chưa gắn trạm / ngăn**;
   máy trong file .xlsx trên máy mà CSDL chưa có nằm ở nhóm **Chưa lưu CSDL**. Bàn phím: ↑ ↓ di chuyển, → mở nhánh, ← đóng nhánh.
3. Bấm một nút trên cây để lọc danh sách bên phải; bấm lại hoặc **Bỏ lọc** để xem tất cả.
4. Ô **Tìm** lọc ngay theo trạm, ngăn, tên thiết bị, số chế tạo (kể cả số chế tạo sứ), số report — không cần gõ dấu.
5. **Chuột phải** vào một dòng (hoặc nút **⋯**, hoặc phím Menu / Shift+F10):
   - **Xem số liệu** — bảng giá trị xuất xưởng theo hạng mục, lọc theo thiết bị / hạng mục;
   - **Sửa giá trị đo (N giá trị)** (quyền ghi) — sửa từng giá trị, ngày thí nghiệm, số report → **Lưu thay đổi** → kiểm tra danh sách thay đổi → **Xác nhận lưu**.
     Nhiệt độ đo chỉ đọc; giá trị quy đổi tính lại theo tỷ lệ; mỗi giá trị sửa được ghi chú ngày và người sửa;
   - **Sửa số chế tạo, tên thiết bị…** (quyền ghi) — sửa thông tin của máy hoặc sứ đang chọn; chỉ sửa số chế tạo khi nhập sai (xu hướng tra theo số chế tạo);
   - **Gán trạm / ngăn…** / **Đổi trạm / ngăn…** (quyền ghi, máy chính) — chọn trạm, ngăn trong danh mục; thiết bị ở nhóm **Chưa gắn trạm / ngăn** chuyển vào đúng ngăn, các sứ đi theo máy chính;
   - **Dùng cho biên bản đang lập** — tải file test report gốc từ CSDL và dùng làm file xuất xưởng của biên bản;
   - **Tải file test report**;
   - **Xóa số liệu xuất xưởng…** (chỉ **admin**) — khung xác nhận ngay dưới bảng; xóa mọi giá trị đo và file test report gốc của lần FAT đó,
     thiết bị vẫn giữ trong danh mục. BBTN sau không còn giá trị khởi đầu để so cho tới khi nhập lại test report. Không hoàn tác được;
   - với máy **Chưa lưu CSDL**: xem sheet gốc, dùng file, **Lưu lên CSDL…**, **Bỏ file khỏi máy này…** (không ảnh hưởng CSDL).
6. **Nhập test report** — theo ngữ cảnh (chuột phải thiết bị → **Nhập test report (.xlsx)…**) hoặc độc lập (nút **Nhập test report (.xlsx)…** trên thanh công cụ).
   Chọn file xong (đã đăng nhập, có quyền ghi) mở khung **Lưu test report lên CSDL**:
   - danh sách máy trong file: đã có trong danh mục (trạm · ngăn) hay **Thiết bị mới**, đã có lần FAT chưa (lưu lại sẽ **ghi đè** lần FAT cũ, kể cả giá trị đã sửa tay);
     mặc định chọn máy chưa có FAT và máy của thiết bị đang chuột phải; bỏ tích máy thuộc ngăn khác;
   - **Trạm / Ngăn** cho thiết bị mới hoặc chưa gắn — mặc định ngăn của thiết bị đang chuột phải, hoặc ngăn của máy đã có trong file; thiết bị đã gắn ngăn giữ nguyên;
   - **Lưu N máy** — mỗi máy một lần FAT kèm file gốc; dùng làm giá trị khởi đầu cho các BBTN sau.
   - **Ngày thí nghiệm**, **Số test report** — lấy từ file; file không ghi / không đọc được ngày thì ô ngày tô đỏ, **nhập tay** để lưu
     (cũng có ở nút **Lưu test report lên CSDL** của trình khởi tạo). Các mục khác không đọc được thì bỏ trống; sửa sau bằng chuột phải → **Sửa giá trị đo**.
   Nhập theo ngữ cảnh mà file không có số chế tạo của thiết bị: app cảnh báo.
7. **Dữ liệu thiết bị (cần migration G2)** — chuột phải trên cây:
   - ngăn → **Khai tổ máy 3 pha…** / **Tổ máy 3 pha: …** — tổ 3 MBA 1 pha rời: chọn máy pha A, B, C (gợi ý theo pha trong ngăn). Thay máy một pha (vd lắp máy dự phòng):
     chọn máy mới cho pha đó, ngày thay, ghi chú → máy cũ rời tổ, xem **Lịch sử thành viên**. Trình khởi tạo BBTN (bước ①) lấy các pha theo tổ này;
   - máy chính → **Lịch sử vị trí lắp đặt…** — các ngăn đã lắp, từ ngày / đến ngày; đổi ngăn (cùng hoặc khác trạm) bằng **Đổi trạm / ngăn…** thì lịch sử tự ghi
     (ngày hôm nay — sửa lại ngày thực tế ở đây). Mỗi lần thí nghiệm ghi ngăn tại thời điểm thí nghiệm;
   - sứ / OLTC / TI chân sứ đang lắp → **Thay sứ này…** — số chế tạo mới, ngày thay, cái cũ thanh lý hay dự phòng. Cái cũ hiện "đã tháo" trên cây (giữ lịch sử);
     cái mới có giá trị khởi đầu riêng;
   - **Nhập test report sứ (.xlsx)…** (thanh công cụ, hoặc chuột phải sứ chưa có số liệu) → khung **Lưu test report sứ lên CSDL**: mỗi sứ đã có trong danh mục
     một lần thí nghiệm xuất xưởng (C1, tanδ1, C2, tanδ2 quy về 20 °C như số đo hiện trường) — giá trị khởi đầu cho xu hướng sứ. File không ghi ngày: nhập tay.
8. Đánh giá "so xuất xưởng" trong biên bản dùng file .xlsx đang dùng; số liệu sửa trong CSDL dùng cho **xu hướng** các lần thí nghiệm sau.

### Test report sứ Hitachi

1. Nạp file test report sứ (.xlsx, sheet TestReport + TraCuu) bằng nút **Thêm file .xlsx…** ở đầu **mục 5** (Tgδ và điện dung các sứ), nút **Nhập test report sứ (.xlsx)…** ở mục **XX**, hoặc bước ④ trình khởi tạo. Nạp được nhiều file, gộp theo S/N sứ.
2. Chọn file report theo định dạng được bộ đọc hỗ trợ.
3. Bộ đọc ghép báo cáo theo số chế tạo sứ.
4. Nếu trùng S/N, dữ liệu nạp sau có thể thay dữ liệu trước.
5. Ở mục 5 nhập số chế tạo sứ để tra đúng báo cáo.
6. Khi không nhập S/N, app có thể tra theo vị trí sứ ứng với cột pha.
7. Kiểm tra cảnh báo thiếu dữ liệu tra cứu.
8. Không đưa file report nội bộ vào repo công khai.

### Đọc ảnh nameplate

1. Bấm **Nhập ảnh nameplate…** ở khối thông tin thiết bị.
2. Hoặc kéo ảnh vào khung, hoặc dán ảnh khi đang ở mục 0.
3. Chờ OCR nhận dạng và mở hộp thoại kết quả.
4. Chọn trường cần điền và sửa nội dung OCR nếu sai.
5. Ô tô vàng là giá trị cần kiểm tra thêm.
6. Ô tô đỏ là không đọc được, cần nhập tay.
7. Đối chiếu hãng, kiểu, S/N, năm, công suất, điện áp và dòng với ảnh gốc.
8. Kiểm tra tổ đấu dây, OLTC và I0 nếu OCR có nhận dạng.
9. Sửa ký tự nhầm như O/0 hoặc dấu thập phân trước khi áp dụng.
10. Sau khi kiểm tra toàn bộ, bấm **Đã kiểm tra hết** nếu nút này hiện.

## 3. Nhập liệu và thao tác dùng chung

1. Chọn mục trên thanh điều hướng.
2. Mỗi mục có các bước **Chuẩn bị**, **Hướng dẫn đo**, **Nhập số liệu**, **Đánh giá**.
3. Bước **Hướng dẫn đo** của từng hạng mục MBA tổng hợp QĐ 1901 Chương V, quy trình QT-KĐMBA và tài liệu đào tạo thí nghiệm MBA (2026): mục đích, điều kiện đo, sơ đồ đấu dây (có hình), trình tự đo, lưu ý. Nguồn từng ý ghi trong ngoặc: QĐ — QĐ 1901; QT — QT-KĐMBA; ĐT — tài liệu đào tạo.
   Hướng dẫn trong app không thay thế sơ đồ đấu nối, phương án an toàn và quy trình chi tiết được đơn vị phê duyệt; làm theo các tài liệu đó trước khi đo.
   Xem mục **Hướng dẫn đo: hình và chỉnh sửa (Admin)** ngay dưới.
4. Nhập số liệu bằng bàn phím hoặc dán bảng từ Excel vào ô đầu.
5. Phím Enter đi xuống hàng trong cùng cột theo bảng.
6. Ô màu xám thường là tự tính.
7. Ô được viền xanh, đỏ hoặc vàng phản ánh kết quả Đạt, Không đạt hoặc Cần xem xét; ô Không đạt có thêm dấu **✕**, Cần xem xét dấu **!** ở góc trên (không chỉ dựa vào màu). Trình đọc màn hình đọc tên ô theo bảng – hàng – cột và báo ô không đạt.
8. Rê chuột hoặc mở phần đánh giá để xem căn cứ/chi tiết khi giao diện hỗ trợ.
9. Nút **Hoàn tác** đảo thao tác thuộc hạng mục hiện tại.
10. **Ctrl+Z** hoặc **Cmd+Z** ngoài ô nhập cũng hoàn tác theo hạng mục.
11. Khi con trỏ ở ô nhập, Ctrl+Z/Cmd+Z vẫn hoàn tác nội dung gõ trong ô.
12. **Xóa số liệu hạng mục** xóa số liệu hạng mục hiện tại, không xóa thông tin chung.
13. Cấu hình, nhãn và kết luận được giữ theo hành vi xóa trong mã.
14. Có thể dùng nút **Đọc số** ở hạng mục có ô số hỗ trợ.

### Hướng dẫn đo: hình và chỉnh sửa (Admin)

Hình trong hướng dẫn (sơ đồ đấu dây, sơ đồ nguyên lý) lấy từ tài liệu nội bộ nên **không nằm trong mã nguồn** (repo công khai) mà lưu trong kho file riêng tư của CSDL. Cần đăng nhập để xem hình.

1. Admin mở một hạng mục, bước **Hướng dẫn đo**, bấm **Nạp hình từ tài liệu…**.
2. Chọn cùng lúc tệp *TaiLieuĐT_TNNhatThu MBA_2026.docx* và *2.Qui trình kiểm định máy biến áp.pdf* (bản scan 51 trang).
3. App tách ảnh nhúng trong .docx và cắt vùng hình trên các trang PDF ngay trong trình duyệt, rồi lưu vào kho file (bucket `library`, thư mục `guide/MBA/`). Chỉ làm một lần cho đơn vị; nạp lại sẽ ghi đè.
4. Ảnh .docx chỉ nhận khi đúng phiên bản tài liệu (đúng dung lượng từng ảnh); tài liệu đã sửa thì hình không khớp bị bỏ qua và báo số lượng. PDF phải đúng 51 trang.
5. Hình chưa nạp hiện khung *Hình chưa nạp vào CSDL*.

Chỉnh nội dung cho đơn vị (Admin):

1. Bấm **Sửa hướng dẫn**: ô soạn Markdown bên trái, xem trước bên phải.
2. Cú pháp: `### Tiêu đề`, danh sách `1.` / `-`, `**đậm**`, `*nghiêng*`, bảng `| A | B |`, hình `![chú thích](img:khóa)` (mỗi hình một dòng).
3. **Chèn ảnh…**: chọn ảnh trên máy (≤ 5 MB), app lưu vào kho file và chèn dòng hình tại vị trí con trỏ.
4. Ghi **Ghi chú thay đổi** (căn cứ, văn bản), bấm **Lưu** — áp dụng cho mọi người trong đơn vị; hướng dẫn hiện nhãn *Đơn vị đã chỉnh*.
5. **Lấy nội dung mặc định** nạp lại nội dung gốc của app vào ô soạn; **Khôi phục mặc định** xóa nội dung đơn vị đã chỉnh.
6. Cần chạy migration `20261120000100_workflow_guides.sql` trên Supabase trước khi lưu.

### Nhập bằng giọng nói

1. Đặt con trỏ vào ô số cần nhập.
2. Bấm **Đọc số**.
3. Cho phép micro trong quyền trang của trình duyệt.
4. Đọc số bằng tiếng Việt rõ ràng, ví dụ “một trăm hai mươi lăm phẩy ba”.
5. Hệ thống hiểu “phẩy” hoặc “chấm” là dấu thập phân.
6. Có thể đọc số âm bằng từ “âm” trước số.
7. Có thể đọc hàng nghìn, hàng triệu, “lẻ/linh”, “mươi/mười”.
8. Các cách đọc “mốt”, “tư”, “lăm”, “nhăm” được parser hỗ trợ trong ngữ cảnh số.
9. Có thể đọc chữ số thập phân từng chữ số, ví dụ “không phẩy không bốn”.
10. Bật **Liên tục** để sau mỗi kết quả app chuyển xuống ô tiếp theo trong cùng cột.
11. Nói **lùi** hoặc **quay lại** để chuyển lên ô trước.
12. Nói **xóa** hoặc **xóa ô** để xóa nội dung ô đang chọn.
13. Nói **dừng** hoặc **dừng lại** để dừng nhận dạng.
14. Nút đổi thành **Dừng đọc** trong lúc micro đang hoạt động.
15. Web Speech API cần trình duyệt hỗ trợ và thường cần mạng.
16. Nếu quyền micro bị từ chối, cho phép micro trong biểu tượng ổ khóa của thanh địa chỉ.
17. Nếu báo lỗi mạng, kiểm tra kết nối rồi bấm **Đọc số** lại.

## 4. Mục 1: Kiểm tra bên ngoài

1. Kiểm tra ngoại quan máy biến áp theo quy trình đơn vị.
2. Ghi nhận tình trạng rò dầu, sứ, đầu nối, phụ kiện và dấu hiệu bất thường.
3. Nhập mô tả vào trường kết quả kiểm tra.
4. Chọn đánh giá **Đạt** hoặc **Không đạt** theo kết quả kiểm tra thực tế.
5. Không để thông tin phát hiện quan trọng chỉ nằm trong kết luận tự động.
6. Căn cứ QĐ trong giao diện: Điều 9 và Bảng 1 theo mã tham chiếu.

## 5. Mục 2: Dòng điện và tổn hao không tải

1. Chọn đúng bảng đo điện áp thấp hoặc điện áp định mức.
2. Nhập điện áp Uo, dòng Io và công suất Po theo mỗi phép đo.
3. Ghi điều kiện nối tắt tại cột được cung cấp.
4. Ở phép đo định mức, nhập các dòng pha và giá trị công suất tương ứng.
5. Trường I0 (%) và P0 (%) có thể được app tự tính từ đầu vào.
6. Kiểm tra số liệu theo pha trước khi đánh giá.
7. Nguồn so sánh cần đúng số chế tạo máy chính.
8. Ngưỡng không tải trong mã có tham chiếu Điều 34.
9. Mức ±10% áp dụng cho trường hợp MBA một pha từ 110 kV sau lắp đặt/sửa chữa.
10. Mức ±15% được dùng cho đánh giá trong vận hành theo cấu hình hiện tại.
11. Không áp ngưỡng cho phép ở phép đo điện áp thấp nếu QĐ không nêu.
12. Mục này thường nhập tay; không có bộ đọc máy đo phổ quát trong UI.

## 6. Mục 12 (mẫu 3 pha chung: mục 14): Thí nghiệm ngắn mạch MBA


1. Nhập số liệu ở hạng mục **Thí nghiệm ngắn mạch MBA** — mục cuối của biên bản (mục 12; mẫu 3 pha chung: mục 14), các mục khác giữ đúng số của mẫu Word. Hạng mục có các tab Chuẩn bị, Hướng dẫn đo, Nhập số liệu và Đánh giá. Bố cục 1 pha dùng số chế tạo máy chính; mẫu 3 máy 1 pha ghép số chế tạo theo pha; mẫu MBA 3 pha dùng một S/N và các phép đo pha A/B/C.
2. Theo Điều 25–26 QĐ 1387, thực hiện từng cặp cuộn ở tần số định mức, nối ngắn mạch một cuộn và cấp nguồn vào cuộn còn lại; dòng thử không thấp hơn 25% In. Khi hiện trường không có điện áp theo Test Report, dùng 380 V hoặc điện áp không quá 10 kV rồi nội suy.
3. Nhập U thử tùy ý theo đơn vị V hoặc kV (có gợi ý 67, 220, 380 V), f đo/f định mức, Un/In, I/P đo, nhiệt độ, cặp cuộn, nấc và pha. App đổi U về kV rồi quy đổi Uk = U/Un × In/I và Pk theo P × (In/I)².
4. Nếu hiệu chỉnh Pk theo nhiệt độ, nhập PI²R, chọn vật liệu dây dẫn và nhiệt độ Pk trong Test Report. Công thức: Pk₂ = Pcu₁ × (K+t₂)/(K+t₁) + Pstr₁ × (K+t₁)/(K+t₂), Pstr₁ = Pk₁−Pcu₁, K = 235 cho đồng hoặc 225 cho nhôm. Chỉ hiệu chỉnh khi đủ thành phần tổn hao và vật liệu.
5. App đọc Pk/Uk từ sheet tổn hao/trở kháng của Test Report đang dùng, ghép theo cặp cuộn, nấc và số chế tạo. Có thể chọn trường hợp mới, sau đại tu hoặc đang vận hành; với hai trường hợp sau, nhập thêm Uk ban đầu. Với MBA mới, nhập Uk nhãn máy nếu Test Report không có trị số này để đánh giá Điều 27.
6. Bảng hiển thị riêng Điều 27 QĐ 1387 (MBA mới: sai số Uk ≤5% tại nấc chính; sau đại tu/đang vận hành: ≤3% so với Uk ban đầu và giữa các pha; Pk ≤115% số liệu nhà chế tạo) và Điều 35 QĐ 1901 đang dùng (Uk ≤3%, Pk ≤115%, lệch pha MBA 3 pha ≤3%). Kết quả chung Đạt khi tất cả tiêu chí áp dụng đạt.
7. Tần số không khớp, dòng thử dưới 25% In, thiếu Test Report/Uk ban đầu hoặc thiếu dữ liệu quy đổi thì hiện **Cần xem xét**. Khi xuất BBTN, app thêm hàng "12. Thí nghiệm ngắn mạch máy biến áp" vào bảng hạng mục trang 1 và đưa bảng số liệu, so sánh Test Report, đánh giá vào mục 12 (12.1–12.3) ngay trước "THIẾT BỊ THÍ NGHIỆM" — không còn là phụ lục.

## 7. Mục 3: Điện trở cách điện

1. Nhập nhiệt độ đo tại trường **Nhiệt độ đo (°C)**.
2. Nhập R15, R60, R180, R360 và R600 khi máy đo cung cấp.
3. Nhập R cách điện lõi từ và gông từ nếu đo.
4. Dùng đơn vị MΩ theo các nhãn bảng.
5. Kiểm tra trường hợp thiếu mốc thời gian đo.
6. App tự tính Kht, PI và các giá trị quy về 20 °C khi đủ đầu vào.
7. Quy đổi R cách điện dùng K1 theo Bảng 4.
8. So sánh R60@20 °C với mức tương ứng Bảng 5 khi áp dụng.
9. Với MBA từ 110 kV, mã chứa mức 600 MΩ ở 20 °C trong mô tả ứng dụng.
10. Lõi/gông có các mức 500 MΩ mới và 100 MΩ vận hành theo ghi chú Bảng 1.
11. Kht và PI là chỉ báo; đọc kết hợp tình trạng và hướng dẫn áp dụng.
12. Căn cứ gồm Điều 9 mục 4, Bảng 4, Bảng 5 và Điều 29.
13. Mục này nhập thủ công từ máy đo điện trở cách điện.
13b. **Tổ 3 máy 1 pha — lập BBTN riêng từng pha** (mẫu theo pha A / B / C; muốn một BBTN chung cho cả tổ thì chọn **Cả tổ A+B+C** ở bước ①):
    mục 7 (R một chiều) và mục 8 (tỷ số biến) có khung **BBTN riêng máy pha …** — để so sánh giữa các pha (QĐ 1901 Điều 9 mục 6, 7) app tìm trong CSDL
    lần đo **cùng đợt** của 2 máy pha còn lại: cách ngày thí nghiệm của biên bản không quá **N ngày** (ô *Cùng đợt*, mặc định 30, sửa được).
    Bấm **Bổ sung số liệu pha … từ CSDL**: ô trống của pha khác được điền, tô vàng, rê chuột xem nguồn (máy, ngày). R một chiều được quy về nhiệt độ cuộn dây
    của biên bản (235 + t). Ô bổ sung **không ghi** vào lần thí nghiệm này khi lưu CSDL (đã có ở BBTN của máy pha đó); sửa ô thì coi là số đo của lần này.
14. **Xu hướng theo QĐ 1901 so với số liệu quá khứ:** ngay khi gõ số chế tạo, app tải lịch sử đo của máy và sứ (CSDL khi đã đăng nhập; mất mạng thì dùng bản lưu tạm trên máy). Nhập số đến đâu, app so với **giá trị khởi đầu** (theo thứ tự: lần sau sửa chữa được lấy làm khởi đầu mới → xuất xưởng → lần **sau lắp đặt** → lần đo sớm nhất; ô xu hướng ghi KĐ / XX / LĐ / Đầu, rê chuột xem ngày) và **lần thí nghiệm trước** đến đó, mỗi đại lượng một dòng "Xu hướng …" trong mục:
    - **R60@20** (Điều 29 mục 3): giảm quá 30% so với khởi đầu hoặc lần trước → Không đạt. Hướng xử lý: kiểm tra điều kiện đo theo Điều 29 mục 2 rồi đo lại; đo PI (Điều 9 ghi chú d, IEEE C57.152); gợi ý đối chiếu Kht, tgδ/điện dung, ẩm cách điện cứng, BBTN dầu; nếu các hạng mục khác đạt, người có thẩm quyền quyết định đóng điện.
    - **tgδ cuộn dây @20 °C** (Điều 30 mục 3): tăng quá 30% so với khởi đầu → Không đạt; tgδ20 < 1% coi là tốt, không so. Hướng xử lý: loại trừ yếu tố ẩm, ô nhiễm, sứ bẩn, nhiễu (Điều 30 mục 2); đo ở nhiệt độ cao thì để MBA nguội đo lại.
    - **Điện dung cuộn dây** (Điều 9 mục 5): lệch quá ±5% so với khởi đầu → Không đạt.
    - **Sứ đầu vào** (Điều 38 mục 3): C1 thay đổi quá 5% → Không đạt; tgδ C1 trong vận hành tăng 70–100% → Cần xem xét (đo thêm ở 15 Hz và 400 Hz), quá 100% → Không đạt.
    - **Tổn hao không tải P0** (Điều 34 mục 3): sau lắp đặt/sửa chữa ±5% xuất xưởng (MBA 3 pha ≥110 kV) hoặc ±10% khởi đầu (MBA 1 pha ≥110 kV); vận hành ±15% khởi đầu.

    Đại lượng vượt tiêu chí hiện khung cảnh báo đỏ đầu mục kèm hướng xử lý; kết luận tự động liệt kê. Không có lịch sử thì app đánh giá như trước.

    **Sau sửa chữa / đại tu:** chọn lý do "Sau sửa chữa/đại tu" thì trang Thông tin chung hiện ô *Lấy số liệu lần này làm giá trị khởi đầu cho các lần sau*:
    - *Có lọc dầu, sấy chân không* — số liệu cách điện cuộn dây lần này (R cách điện, tgδ, điện dung cuộn dây) là giá trị khởi đầu mới; sứ, tổn hao không tải vẫn so xuất xưởng.
    - *Thay cuộn dây / thay đổi kết cấu cách điện* — mọi số liệu lần này là giá trị khởi đầu mới (QĐ 1901 Điều 2).

    Lần sửa chữa này vẫn được so với giá trị khởi đầu cũ; các lần thí nghiệm sau so với lần này (dòng xu hướng ghi "giá trị khởi đầu sau sửa chữa dd/mm/yyyy"). Cần chạy migration `20261118000100_baseline_reset.sql` trên CSDL.

## 8. Mục 4: Kiểm tra tổ đấu dây

1. Đo tổ đấu dây bằng thiết bị/phương pháp được đơn vị phê duyệt.
2. Nhập kết quả đo vào trường **Tổ đấu dây đo được**.
3. Đối chiếu với nameplate và hồ sơ xuất xưởng.
4. App hiển thị kết quả để kỹ sư xác nhận.
5. Căn cứ trong mã tham chiếu Điều 32 mục 3.
6. Không có bộ đọc file tự động riêng trong luồng hiện hành.

## 9. Mục 5: Sứ đầu vào

1. Chọn phía sứ: cao áp, trung áp/trung tính hoặc hạ áp.
2. Chọn loại cách điện sứ nếu biết: RIP, OIP, RIS, RBP hoặc GIF.
3. Chọn trạng thái **Đã lắp** hoặc **Chưa lắp**.
4. Nhập nhiệt độ dầu hoặc nhiệt độ môi trường tùy trạng thái.
5. Nếu bỏ trống nhiệt độ riêng, giao diện có thể dùng nhiệt độ môi trường mục 0.
6. Nhập điện dung C1/C2 và tgδ theo các ô có trên bảng.
7. Nhập điện áp thử AC và kết quả nếu mục thử AC được thực hiện.
8. Chọn chế độ **Cách quy đổi về 20 °C** phù hợp.
9. Với chế độ K, kiểm tra hệ số hiển thị hoặc nhập tay theo hướng dẫn.
10. Quy đổi theo cấu hình tạo tgδ20; quy tắc dự án đã chốt là tgδ20 = tgδ(t) × K.
11. Hệ số K có thể lấy từ Hitachi, QĐ 1901, bảng hãng hoặc nhập tay.
12. App tính các giá trị chuẩn hóa và so sánh khi đủ dữ liệu.
13. Khi có test report Hitachi, nhập đúng S/N sứ để so với hãng.
14. Căn cứ gồm Điều 38, Bảng 50 và Bảng 52 theo phần đánh giá.
15. Mức tăng tgδ vận hành 70% tạo cảnh báo và 100% tạo không đạt theo cấu hình mã.
16. Điện dung C1 có mức thay đổi 5% khi NSX không quy định.
17. Sứ có thể nhập tay hoặc nạp XLSX test report.
18. Nếu bảng hệ số chưa phù hợp, nhờ admin cấu hình trang **Hệ số quy đổi sứ**.

## 10. Mục 6: Tgδ và điện dung cuộn dây

1. Nhập nhiệt độ cuộn dây/dầu đo được vào trường nhiệt độ.
2. Nhập tgδ, điện dung C, điện áp đo và sơ đồ đo cho từng đối tượng.
3. Dùng đúng nhãn đối tượng và sơ đồ đo UST/GAR/GND khi có lựa chọn.
4. Có thể sửa nhãn dòng hoặc thêm dòng đối tượng theo giao diện.
5. App tự quy tgδ về 20 °C bằng K2.
6. Khi nhiệt độ đo cao hơn 20 °C, mã chia tgδ cho K2.
7. Khi nhiệt độ đo thấp hơn 20 °C, mã nhân tgδ với K2.
8. K2 tại chênh 16 °C là 2,4 theo quyết định dự án.
9. Cột quy đổi là dữ liệu tính, không nhập lại như số đo độc lập.
10. Kiểm tra thay đổi điện dung so với xuất xưởng khi có dữ liệu.
11. Đánh giá tgδ cuộn dây (Điều 9 mục 5, Điều 30 mục 3):
    - tgδ quy về 20 °C **≤ 1 %**: Đạt, coi là tốt, **không cần so với giá trị khởi đầu** (giá trị so XX chỉ ghi tham khảo).
    - Lớn hơn 1 %: so với **giá trị khởi đầu** quy cùng nhiệt độ, không tăng quá 30 % — dùng số liệu XX; CSDL có giá trị khởi đầu thì đánh giá ở dòng **Xu hướng**.
    - Lớn hơn 1 % mà không có giá trị khởi đầu: tham khảo **Bảng 46** (Điều 30) theo cấp điện áp cao áp (lấy từ ô Điện áp định mức; chưa có điện áp thì báo Cần xem xét). tgδ đo được quy về nhiệt độ **cột Bảng 46 gần nhất** (10, 20 … 70 °C) bằng **K2 theo Bảng 47**: tgδ(t2) = K2 × tgδ(t1) khi t2 > t1, tgδ(t2) = tgδ(t1) ÷ K2 khi t2 < t1; ∆t không có trong bảng thì nhân các hệ số. Không nội suy Bảng 46. Cách đều hai cột (vd 15 °C) lấy cột cao hơn; ngoài 10–70 °C lấy cột biên.
    - Lưu ý: ghi chú sau Bảng 47 của QĐ 1901 in "tgδ(t2) = tgδ(t1)/K1" là **nhầm** — đúng là chia cho **K2**. App luôn dùng K2.
12. Nhập thủ công từ cầu đo tgδ hoặc nạp file nếu có luồng phù hợp.

## 11. Mục 7: Điện trở một chiều

1. Chọn/kiểm tra cách đo cuộn cao áp: A-N hoặc A-Am.
2. Nhập nhiệt độ cho cuộn cao áp.
3. Nhập R theo từng nấc và pha được yêu cầu.
4. Nhập nhiệt độ cuộn trung áp trước khi nhập số đo.
5. Nhập Am-N/Bm-N/Cm-N theo bố cục đang hiện.
6. Nhập nhiệt độ cuộn hạ áp.
7. Nhập ab/bc/ca theo bảng.
8. App tự tính ΔR giữa pha và so sánh với xuất xưởng khi có tham chiếu.
9. App chuẩn hóa R theo nhiệt độ về 75 °C cho so sánh lưu/xu hướng.
10. Công thức dùng `R2 = R1·(235+t2)/(235+t1)`.
11. Ngưỡng lệch trong mã là 2% theo Điều 9 mục 7.
12. Haefely 2293 có thể nạp số liệu điện trở từ CSV.
13. CPC 100 không phải bộ đọc mặc định cho phép đo này.
14. Mẫu 110–220 kV có OLTC ở cuộn trung áp: mục 8.1 là cuộn trung áp theo nấc, 8.2 cuộn cao áp một giá trị; BBTN xuất ra ghi bảng nấc cho cuộn trung áp. Đổi lựa chọn giữa chừng không mất số liệu đã nhập (chỉ ẩn khỏi biểu mẫu), đổi lại để xem.

### Nhập Haefely 2293

1. Bấm **Nhập file Haefely 2293…** ở hạng mục liên quan.
2. Chọn file CSV và BIN cùng bộ đo nếu có.
3. Với CSV, kiểm tra dấu phân tách và mã hóa theo file máy.
4. Chọn pha, nấc hoặc cấu hình trong hộp thoại khi được hỏi.
5. Rà nhiệt độ đo được phát hiện.
6. Chọn có quy đổi nhiệt độ R về cùng nhiệt độ hay không nếu hộp thoại đưa lựa chọn.
7. Kiểm tra bảng trước khi xác nhận ghi vào state.
8. Nếu nhận nhầm pha/nấc, hủy hoặc sửa mapping trước khi áp dụng.
9. Dữ liệu nhiều hạng mục có thể được ghi theo từng mục để hỗ trợ hoàn tác riêng.

## 12. Mục 8: Tỷ số biến

1. Nhập tỷ số đo cho từng nấc và từng cặp cuộn.
2. Kiểm tra tiêu đề pha A, B, C và các tỷ số HV:MV, HV:LV, MV:LV.
3. Kiểm tra nameplate và tham chiếu số liệu xuất xưởng.
4. App tự tính ΔK theo pha và độ lệch tổng hợp khi có đủ số liệu.
5. Ngưỡng lệch tham chiếu 0,5% theo Điều 9 mục 6 và Điều 33.
6. Haefely 2293 có thể nạp dữ liệu CSV vào các trường hỗ trợ.
7. Chọn pha/nấc trong hộp thoại nếu app không suy ra duy nhất.
8. Kiểm tra đơn vị và chiều tỷ số trước khi lưu.

## 13. Mục 9: OLTC

1. Nhập kiểu OLTC, số chế tạo, hãng và năm sản xuất.
2. Chọn dải nấc chiều 1 và chiều 2.
3. Ghi số vòng quay khi công tắc K tác động và số vòng trong một chu trình.
4. Nạp file Haefely 2293 nếu có dữ liệu chụp sóng.
5. Chọn pha và chiều chuyển nấc trong hộp thoại nếu được hỏi.
6. Kiểm tra nhiệt độ và R nếu app cho tùy chọn quy đổi.
7. App lưu dữ liệu dạng sóng và tạo biểu đồ xem trước.
8. Nhập kết quả chụp công tắc K nếu không nạp được tự động.
9. Chọn đánh giá OLTC theo tiêu chí của nhà sản xuất.
10. Căn cứ chung được tham chiếu Điều 37 mục 3.
11. QĐ không đặt ngưỡng tổng quát cho mọi dạng sóng OLTC.
12. App có thể cảnh báo khi không ghi nhận chuyển mạch hoặc dòng giảm sâu.
13. Không dùng cảnh báo đó thay cho đánh giá hướng dẫn của nhà sản xuất.
14. Dạng sóng có thể được đưa vào phụ lục BBTN.

## 14. Mục 10: Độ ẩm cách điện cứng

1. Nhập giá trị độ ẩm theo phần trăm.
2. Nhập phương pháp hoặc thiết bị đo, ví dụ FDS/PDC nếu đúng.
3. Với mẫu 3P, nhập kết quả riêng theo từng máy.
4. App phân loại theo hàm `classifyMoisture` trong QD.
5. Mức dưới 2,2% được phân loại khô trong mã.
6. Khoảng 2,2–3,7% được cảnh báo mức trung bình.
7. Khoảng 3,7–4,8% và trên 4,8% được phân loại không đạt theo mã.
8. Căn cứ tham chiếu Điều 28.
9. Đảm bảo phương pháp và điều kiện đo đúng hướng dẫn thiết bị.

## 15. Mục 11: Biến dòng chân sứ

1. Kiểm tra cấu hình số cuộn thứ cấp trong mục 0.
2. Nhập kết quả kiểm tra ngoài và nhiệt độ đo cách điện.
3. Nhập kết quả cực tính.
4. Nhập nhiệt độ đo điện trở một chiều.
5. Nhập số liệu IR, tỷ số, R một chiều và đặc tính V-A theo cuộn.
6. Dùng nút **Tải XML CPC 100…** tại bảng từ hóa tương ứng hoặc nút nhập nhiều file.
7. Chọn phía, pha và lõi trong hộp thoại CPC 100 nếu được yêu cầu.
8. Kiểm tra điểm khuỷu và các điểm đặc tính từ hóa được trích.
9. Nếu máy không báo điểm khuỷu, app có thể ước tính và gắn chú thích kiểm tra.
10. Dùng nút **Nhập Megger MRCT (.pdbxml, PDF)…** khi có file tương thích.
11. Chọn `.pdbxml` PowerDB và/hoặc PDF có lớp chữ.
12. Trong hộp thoại MRCT, gán dữ liệu cho phía, pha và lõi phù hợp.
13. Kiểm tra tỷ số, sai số, R, điểm khuỷu và đường từ hóa trước khi xác nhận.
14. Nếu dữ liệu không nhận đúng, không áp dụng và nhập thủ công.
15. Mã có mức IR TI chân sứ 200 MΩ khi NSX không quy định.
16. Các mục không có ngưỡng rõ phải ghi Tham khảo/Cần xem xét.
17. Căn cứ chính tham chiếu Điều 39.
18. Với mẫu 3P, nội dung BCT được đặt ở mục 13 và xuất thành phụ lục.

### Dùng CPC 100

1. Chọn bảng đặc tính từ hóa của đúng phía và pha.
2. Bấm **Tải XML CPC 100…**.
3. Chọn XML tương ứng với lần đo.
4. Đọc thông tin phát hiện, đặc biệt tên file và lõi.
5. Xác nhận phía/pha nếu app không suy ra chắc chắn.
6. Kiểm tra điểm khuỷu do thiết bị báo.
7. Kiểm tra các mốc 25%, 50% và 75% được nội suy.
8. Mốc dựa trên Uk nếu xác định được khuỷu; nếu không, dựa trên U lớn nhất đo.
9. Đối chiếu đường cong với biên bản máy trước khi lưu.

### Dùng MRCT

1. Bấm **Nhập Megger MRCT (.pdbxml, PDF)…**.
2. Chọn file PowerDB `.pdbxml`, báo cáo PDF hoặc cả hai.
3. Chờ hộp thoại trích dữ liệu.
4. Gán từng kết quả cho cuộn/lõi TI phù hợp.
5. Kiểm tra điểm khuỷu và đặc tính V-A.
6. Kiểm tra số đo R và tỷ số so với file gốc.
7. Xác nhận nhập sau khi mapping đúng.

## 16. Khác biệt nhập liệu mẫu chung 3P

1. Chọn topology **Tổ 3 MBA một pha** và mẫu **3P**.
2. Nhập số chế tạo của ba máy theo pha A, B, C.
3. Nhập không tải, cách điện, tgδ cuộn dây và độ ẩm theo từng máy.
4. Mỗi máy có nhiệt độ đo riêng tại các mục hỗ trợ.
5. Sứ có nhiệt độ đo riêng theo từng vị trí.
6. Điện trở một chiều và tỷ số biến dùng các bảng chung theo thiết kế template.
7. OLTC được nhập theo máy/pha ở các trường có mặt.
8. BCT hiển thị số mục 13.
9. Khi xuất, BCT trở thành phụ lục theo cấu hình report.
10. Trước khi xuất BBTN chung, kiểm tra đủ ba S/N; khi xuất riêng, chọn pha và kiểm tra S/N của từng file.

## 17. Tổng hợp và kết luận

1. Mở **Σ Tổng hợp**.
2. Đọc danh sách giá trị thiếu, cảnh báo và kết quả so sánh.
3. Kiểm tra các ngưỡng đã được admin override nếu tài khoản hiển thị thông tin đó.
4. Bấm **Điền kết luận tự động** để tạo bản nháp kết luận.
5. Đọc lại từng câu và sửa theo kết quả thực tế.
6. Không để kết luận tự động thay thế phán đoán kỹ thuật.
7. Không kết luận Đạt chỉ từ một chỉ số nếu quy trình yêu cầu đánh giá tổng thể.
8. Lưu lại hồ sơ sau khi chỉnh kết luận.

## 18. Phụ lục BBTN

Thí nghiệm ngắn mạch không còn là phụ lục: số liệu nằm trong mục cuối của biên bản (xem chương Thí nghiệm ngắn mạch MBA).

### Dầu MBA (DGA và lý hóa dầu)

1. Mở trang **Phụ lục BBTN**, bấm **Mở app DGA** và chọn thiết bị theo số chế tạo. Có thể dùng **Chép số chế tạo** để dán vào app.
2. Nhập/đánh giá kết quả trong app DGA và xuất BBTN dầu dạng `.docx`.
3. Quay lại app BBTN, bấm **Nạp BBTN dầu (.docx)…**; có thể chọn nhiều file DGA và lý hóa dầu.
4. Xem lại loại file, số chế tạo, ngày lấy mẫu và kết luận. Xác nhận cảnh báo nếu file không nhận dạng hoặc số chế tạo không khớp.
5. Chọn **Nối vào BBTN** cho từng file cần đính kèm. File bị thiếu trên máy hiện tại cần nạp lại trước khi xuất.
6. Tệp được lưu kèm file JSON và tải lên Storage cùng phiên CSDL như phụ lục SFRA; app DGA vẫn là ứng dụng riêng, không dùng CSDL Supabase của BBTN.

### Chụp sóng OLTC

1. Nạp dữ liệu Haefely 2293 có dạng sóng ở hạng mục OLTC.
2. Mở **Phụ lục BBTN**.
3. Kiểm tra biểu đồ, chiều chuyển nấc và pha.
4. Chọn chế độ đồ thị OLTC có sẵn trong phần phụ lục.
5. Kiểm tra cách trình bày từng thao tác hoặc gộp theo chiều nếu lựa chọn được cung cấp.
6. Xuất DOCX thử để xác nhận đồ thị nằm sau phần biên bản chính.

### SFRA

1. Mở trang **Phụ lục BBTN**.
2. Bấm **Mở SFRA Analyzer**.
3. Dùng công cụ SFRA theo quy trình bên ngoài.
4. Tải báo cáo Word từ mục báo cáo của SFRA Analyzer.
5. Quay lại app và bấm **Nạp báo cáo SFRA (.docx)…**.
6. Kiểm tra tiêu đề, số phép đo và kết luận được đọc.
7. Xuất BBTN để nối phần nội dung báo cáo vào cuối.
8. Nếu lưu CSDL, app thử lưu file phụ lục cùng phiên.

### DFR sứ từ DIRANA

1. Mở **Phụ lục BBTN**.
2. Chọn chức năng nạp CSV DIRANA.
3. Có thể chọn một file hoặc cả thư mục theo chức năng giao diện.
4. Chọn phía và pha của sứ.
5. Chọn phép đo gốc hoặc phép đo lại khi có dữ liệu tương ứng.
6. Kiểm tra bảng 15 Hz và 400 Hz.
7. Kiểm tra tgδ, điện dung và đồ thị đáp ứng tần số.
8. DFR được trình bày tham khảo, không tạo kết luận đạt/không đạt.

## 19. Xuất DOCX và XLSX

1. Kiểm tra đã chọn đúng template.
2. Mở **Σ Tổng hợp** và xử lý dữ liệu thiếu.
3. Bấm **Xuất BBTN .docx**.
4. Đọc thông báo nếu template thiếu bảng hoặc một số trường không định vị được.
5. Mở DOCX vừa tải và kiểm tra nội dung, bảng, chân trang, phụ lục.
6. Bấm **Xuất so sánh .xlsx** để lưu chi tiết giá trị và kết quả so sánh.
7. Kiểm tra dấu thập phân, đơn vị, số chế tạo và pha trong hai file.
8. Lưu JSON nếu cần mở lại trong trình duyệt.
9. Xuất thành công DOCX không đồng nghĩa dữ liệu đã lưu vào CSDL.

## 20. CSDL: kết nối, đăng nhập và quyền

### Kết nối và đăng nhập

1. Mở trang **CSDL**.
2. Nhập Supabase URL và anon/publishable key nếu trang chưa cấu hình sẵn.
3. Bấm **Kết nối**.
4. Không nhập `service_role` key vào ứng dụng.
5. Bấm **Đăng nhập** để đăng nhập tài khoản.
6. Có thể chọn **Tạo tài khoản** nếu dự án bật đăng ký.
7. Đăng nhập Google cần cấu hình OAuth trên Supabase và dùng site qua HTTP/HTTPS.
8. Tài khoản mới thường có quyền `viewer`.
9. `viewer` đọc được nhưng không lưu.
10. Nhờ admin cấp `editor` để nhập liệu.
11. `admin` quản trị danh mục và cấu hình được cấp quyền.

### Gắn Trạm – Ngăn – Thiết bị

1. Mở bộ chọn **Trạm – Ngăn – Thiết bị** ở trang CSDL.
2. Chọn trạm đúng với hiện trường.
3. Chọn ngăn lộ tương ứng.
4. Chọn hoặc tạo thiết bị theo quyền tài khoản.
5. Kiểm tra class code và số chế tạo trước khi gắn.
6. Thiết bị con như sứ/OLTC có thể đi theo thiết bị cha.
7. Việc gắn được dùng cho lưu phiên và nhập Test report.

### Ba nút lưu biên bản

1. **Lưu lên CSDL (bản nháp)** lưu phiên ở trạng thái `draft`.
2. Dùng bản nháp khi hồ sơ chưa hoàn tất hoặc còn cần chỉnh sửa.
3. **Lưu & chốt (final)** lưu phiên ở trạng thái `final`.
4. Dùng chốt sau khi đã rà nội dung và sẵn sàng đánh dấu hoàn tất.
5. **Lưu thành biên bản mới** chỉ hiện khi hồ sơ hiện có phiên CSDL.
6. Nút này xóa liên kết phiên hiện tại trước khi lưu.
7. Do đó thao tác tạo phiên mới thay vì cập nhật phiên đã mở.
8. Sau lưu, kiểm tra danh sách và trạng thái phiên.
9. Quyền `editor` hoặc `admin` cần thiết để lưu.

### Mở biên bản đã lưu

1. Trong trang CSDL, tìm bảng **Biên bản đã lưu**.
2. Bấm **Tải lại danh sách** nếu chưa thấy bản ghi.
3. Kiểm tra ngày, loại, thiết bị và trạng thái.
4. Bấm **Mở** ở phiên có form.
5. Kiểm tra nội dung đã mở trước khi chỉnh sửa.
6. Dùng **Xuất BBTN .docx** ở danh sách nếu muốn xuất trực tiếp.
7. Dùng **Tài liệu** để xem file đính kèm của phiên.
8. Dùng **Xóa** chỉ khi được phép và chắc chắn phiên cần xóa.

### Xu hướng

1. Mở trang **Xu hướng**.
2. Chọn thiết bị.
3. Có thể chọn **Gồm sứ / OLTC của MBA**.
4. Chọn chuỗi số liệu theo hạng mục, đại lượng, sơ đồ/cuộn và nấc.
5. Xem biểu đồ, bảng và phần trăm thay đổi.
6. Giá trị chuẩn hóa có thể dùng 20 °C hoặc 75 °C tùy đại lượng.
7. Mốc khởi đầu: lần sau sửa chữa được lấy làm khởi đầu mới → FAT → sau lắp đặt → lần đo sớm nhất.
8. **Dự báo** (ô *Dự báo*: không / 1 / 3 / 5 / 10 năm, mặc định 3 năm) — tham khảo, chuyển từ dga-webapp:
   - chỉ dùng các lần đo **từ mốc khởi đầu** (vd sau lọc sấy dầu thì bỏ các lần trước đó); đường mảnh: đường khớp; nét đứt: dự báo theo **độ dốc Sen**;
     vùng mờ: **khoảng dự báo 95%** (hồi quy tuyến tính); đường đỏ nét đứt: **ngưỡng QĐ 1901** tính từ giá trị khởi đầu
     (R60 giảm 30%, tgδ cuộn dây tăng 30%, tgδ sứ tăng 100%, điện dung cuộn dây / C1 sứ ±5%, R một chiều ±2%, P0 ±15%); vạch nâu: mốc khởi đầu sau sửa chữa;
   - bảng **Dự báo xu hướng**: số lần đo, xu hướng theo kiểm định Mann–Kendall (p), tốc độ Sen / năm và khoảng tin cậy 95%, giá trị dự báo cuối kỳ và khoảng 95%,
     ngày dự kiến chạm ngưỡng, *gần đây nhanh hơn* khi tốc độ 3 năm gần nhất vượt khoảng tin cậy của cả chuỗi;
   - **cảnh báo** chỉ khi xu hướng có ý nghĩa thống kê (p < 0,05) và mốc chạm ngưỡng nằm trong số năm dự báo, hoặc lần đo gần nhất đã vượt ngưỡng;
   - giả định tốc độ thay đổi không đổi; ít điểm (< 4 lần đo) thì chưa kiểm định được xu hướng.
9. Xu hướng, dự báo hỗ trợ theo dõi, không thay đánh giá tổng thể theo Điều 3 QĐ 1901.
10. Nếu không thấy chuỗi, kiểm tra phiên đã lưu và thiết bị đã gắn đúng.

### Xu hướng tại ô nhập

1. Mở biên bản đã gắn thiết bị và có lịch sử.
2. Đăng nhập CSDL để tải lịch sử.
3. Khi có chuỗi phù hợp, vùng dưới ô hiển thị biểu đồ nhỏ và thay đổi phần trăm.
4. So sánh có thể gồm FAT và lần đo trước.
5. Các giá trị được quy đổi chuẩn trước khi so sánh khi có quy tắc.
6. Màu cảnh báo chỉ hỗ trợ tham khảo.
7. Tính năng không thay đổi kết quả evaluate của biên bản.
8. Có ngưỡng QĐ 1901 mà xu hướng (gồm cả giá trị đang nhập) có ý nghĩa thống kê và dự báo chạm ngưỡng trong 3 năm: ô hiện **Dự báo ⚠ tháng/năm**, rê chuột xem chi tiết.

### Nhập Test report xuất xưởng vào CSDL

Cách thường dùng: mục **XX** → **Nhập test report (.xlsx)…** (chọn máy và trạm / ngăn), hoặc nút **Lưu test report lên CSDL** ở bước ② trình khởi tạo.
Cách cũ ở trang CSDL vẫn dùng được (ghi mọi máy trong file vào ngăn của biên bản đang mở):

1. Nạp file xuất xưởng trong mục 0.
2. Tại trang CSDL, chọn Trạm và Ngăn nếu cần gắn thiết bị.
3. Bấm **Nhập Test report vào CSDL**.
4. Kiểm tra danh sách máy được nhận dạng.
5. Xác nhận chỉ nhập dữ liệu đúng file và đúng tổ máy.
6. Dữ liệu được ghi như lần thí nghiệm FAT.
7. Chạy lại có thể cập nhật phiên đã nhập thay vì tạo trùng.
8. FAT tạo mốc xuất xưởng cho xu hướng.

## 21. Nhập BBTN cũ

1. Mở trang **Nhập BBTN cũ** trong nhóm Cơ sở dữ liệu.
2. Chọn một/nhiều file `.docx`, `.pdf` hoặc chọn cả thư mục.
3. DOCX được đọc theo cấu trúc bảng của mẫu PTC3/BM.01 đã hỗ trợ; PDF có lớp chữ được đọc trực tiếp, PDF scan được OCR bằng [Tesseract.js](https://github.com/naptha/tesseract.js) (`vie+eng`) sau khi PDF.js render từng trang.
4. Kiểm tra mẫu, số chế tạo, ngày thí nghiệm, **lý do** (lần *Sau lắp đặt* ghi nhãn **khởi đầu** — làm giá trị khởi đầu khi không có test report), số biên bản, số ô số liệu và các cảnh báo trong bảng.
4b. **Trùng:** file có cùng số chế tạo và ngày thí nghiệm với lần thí nghiệm đã có trong CSDL hoặc với file khác trong lô thì **không tự lưu**. Chọn **Ghi đè** (thay số liệu
    lần đã có bằng file này) hoặc **Lưu thành lần mới** / **Vẫn lưu** — tránh lần thí nghiệm trùng làm sai xu hướng.
5. Với PDF, bấm **Soát cạnh PDF** để mở bản gốc trong khung trái và biểu mẫu trong khung phải cùng trang.
6. Đối chiếu nội dung bìa, nhập hoặc sửa số liệu đo trong biểu mẫu bên phải. PDF không có trường form nên số liệu bảng đo chưa được tự động trích xuất.
7. Bấm **Đã soát** trên thanh phía trên khung PDF sau khi đã nhập ít nhất một giá trị đo; nếu đã đóng khung song song, mở lại file rồi đánh dấu. Kiểm tra số liệu và ngày trước khi lưu.
8. Bấm **Lưu CSDL** hoặc **Lưu các biên bản đã soát**. Mỗi phiên lưu số liệu đo phục vụ xu hướng và đính kèm file gốc trong Storage.
9. Để xem lại, vào **CSDL** → **Biên bản đã lưu** → **Mở cùng PDF**. PDF và biểu mẫu mở cạnh nhau, không cần tab mới.
10. OCR chạy trên máy này, nhưng lần đầu cần Internet để tải engine và dữ liệu tiếng Việt/tiếng Anh; Tesseract.js lưu cache trong trình duyệt.
11. OCR nhận dạng chữ in; soát lại trường bìa và số liệu theo PDF gốc. Số liệu bảng đo hiện chưa tự động đưa vào biểu mẫu; chữ viết tay có thể nhận sai.
12. Trước khi lưu PDF, quản trị CSDL cần áp dụng migration `20261116000100_bbtn_pdf_import.sql` để cho phép loại tài liệu `BBTN_PDF`.

## 22. Thư viện tài liệu

1. Mở **Thư viện tài liệu**.
2. Lọc danh mục theo loại thiết bị, hạng mục hoặc từ khóa khi có ô lọc.
3. Bấm file để mở/tải qua liên kết tạm thời nếu quyền cho phép.
4. Khung **Tài liệu tham khảo** ở hạng mục hiện tài liệu liên quan.
5. Tài liệu chỉ là nguồn tham khảo, cần đối chiếu phiên bản áp dụng.
6. Tài khoản admin có thể thêm hoặc sửa thông tin tài liệu.
7. Admin có thể nhập danh mục Excel theo mẫu được chấp nhận.
8. File lưu ở bucket riêng tư, danh mục lưu trong DB.
9. Tính năng cần migration thư viện đã được triển khai.
10. Nếu danh sách trống, kiểm tra kết nối, quyền và cấu hình migration.

## 23. Bộ tiêu chí và hệ số quy đổi sứ

### Bộ tiêu chí

1. Mở trang **Bộ tiêu chí đánh giá**.
2. Đọc giá trị gốc QĐ 1901 và giá trị đang áp dụng.
3. Giá trị override được đánh dấu theo giao diện.
4. Admin có thể sửa ngưỡng và ghi lý do/căn cứ đơn vị.
5. Dùng khôi phục nếu cần trả về bộ mặc định.
6. Kết luận tự động có thể nêu ngưỡng khác giá trị gốc.
7. Không sửa ngưỡng nếu chưa có phê duyệt của đơn vị.

### Bảng tra tiêu chuẩn

Ngay dưới bộ tiêu chí là **Bảng tra tiêu chuẩn**: hạng mục → điều khoản QĐ 1901 → tiêu chuẩn IEC/IEEE mà QĐ 1901 dẫn chiếu.

- Dòng ghi **Dẫn chiếu tại Điều …**: QĐ 1901 nêu tiêu chuẩn đó ngay trong điều khoản của hạng mục (vd PI theo IEEE C57.152 — Điều 9 Bảng 1 ghi chú d; tổn hao không tải theo IEC 60076-1, IEC 60076-19 — Điều 34; sứ xuyên IEC 60137, DFR sứ IEEE C57.12.200 — Điều 38).
- Dòng có nhãn **cần xác nhận**: tiêu chuẩn chỉ có trong danh mục tài liệu áp dụng của QĐ 1901 (Phụ lục — III), điều khoản của hạng mục không nêu. Cần người có chuyên môn xác nhận trước khi viện dẫn trong biên bản.
- Mở **Danh mục tiêu chuẩn QĐ 1901 liệt kê** để xem nguyên danh sách mục 17–21 của Phụ lục.
- Bảng chỉ để tra cứu: app **không** lấy ngưỡng từ các tiêu chuẩn này; ngưỡng đánh giá vẫn theo QĐ 1901 và bộ tiêu chí.

Tiêu chuẩn của từng dòng cũng hiện ở cột **Căn cứ** của bảng đánh giá (dòng nhỏ dưới điều khoản), trong khung cảnh báo xu hướng, khung **Tài liệu tham khảo** của hạng mục và cột cuối của file Excel xuất kết quả đánh giá.

### Hệ số quy đổi sứ

1. Mở **Hệ số quy đổi sứ**.
2. Chọn bảng QĐ 1901 hoặc bảng của hãng phù hợp.
3. Admin có thể thêm/sửa bảng theo quyền.
4. Có thể nhập bảng hệ số từ Excel nếu bố cục đúng.
5. Trong mục 5, chọn chế độ tương ứng ở **Cách quy đổi về 20 °C**.
6. Kiểm tra nhiệt độ sử dụng và chiều quy đổi trước khi đánh giá.
7. Mã hỗ trợ bảng built-in và bảng được lưu trong CSDL.

## 24. Lỗi thường gặp và cách xử lý

Thông báo cụ thể có thể khác theo lỗi backend; giữ nguyên thông tin kỹ thuật khi báo admin.

| Thông báo trong app | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `Không tìm thấy template tùy chỉnh — dùng template có sẵn` | Template tùy chỉnh không còn trong local storage | Nạp lại file DOCX ở mục 0 |
| `Cần đúng 19 nhãn nấc ... — tạm dùng mặc định` | Danh sách nhãn nấc không đủ 19 | Nhập đủ 19 nhãn hoặc dùng mặc định |
| `Số chế tạo không có trong file xuất xưởng — các so sánh với máy chính sẽ thiếu tham chiếu` | Không có S/N trong file đang chọn | Chọn file khác hoặc kiểm tra S/N/cột pha |
| `Chưa có template BBTN — nạp file .docx ở mục 0` | Không có template khả dụng | Nạp template DOCX phù hợp |
| `Template có ... bảng ... vị trí điền có thể lệch` | Số bảng template không đúng chuẩn | Xác nhận đúng template và layout trước khi phát hành |
| `Không đọc được file xuất xưởng ...` | File lỗi hoặc bố cục không hỗ trợ | Mở lại XLSX, kiểm tra sheet/cột, hỏi admin |
| `File lớn — chỉ dùng trong phiên này` | Local storage không nhận file lớn | Giữ file trong phiên hoặc nạp lại khi cần |
| `Lỗi đọc file: ...` | Parser không đọc được file hoặc định dạng sai | Kiểm tra phần mở rộng, cấu trúc và thử lại |
| `Trình duyệt chưa cho dùng micro ...` | Quyền micro bị chặn | Cho phép micro trong quyền trang rồi thử lại |
| `Nhận dạng giọng nói cần có mạng.` | Web Speech không kết nối dịch vụ nhận dạng | Kiểm tra mạng và khởi động lại đọc số |
| `Không hiểu “…” — đọc lại.` | Câu đọc không được parser hiểu | Đọc từng từ số rõ hơn, dùng “phẩy” cho thập phân |
| `Đã xuất file nhưng chưa lưu được vào CSDL: ...` | Upload tài liệu lỗi sau khi tải DOCX | File đã tải; kiểm tra mạng/quyền rồi lưu lại |
| `Lỗi tải danh sách: ...` | Lỗi truy vấn phiên CSDL | Kiểm tra URL/key, mạng, đăng nhập và quyền |
| `Đăng nhập để lưu biên bản lên CSDL.` | Chưa đăng nhập | Đăng nhập rồi thực hiện lại |
| `Nhập URL và key Supabase để kết nối CSDL trước.` | Chưa cấu hình kết nối | Nhập URL và anon key, bấm **Kết nối** |
| `Bạn chưa lưu được lên CSDL...` | Vai trò chỉ xem | Nhờ admin cấp quyền nhập liệu |
| `Đã lưu biên bản nhưng chưa lưu được file phụ lục SFRA: ...` | Phiên lưu được nhưng upload phụ lục lỗi | Kiểm tra kết nối, nạp lại file phụ lục và lưu lại |

### Trình tự xử lý lỗi

1. Ghi lại thông báo đầy đủ và thao tác ngay trước đó.
2. Kiểm tra tên file, loại file, sheet và cấu trúc đầu vào.
3. Kiểm tra template và số chế tạo máy/pha.
4. Kiểm tra quyền đăng nhập nếu lỗi liên quan CSDL.
5. Không lặp thao tác xóa hoặc lưu nhiều lần khi chưa biết trạng thái.
6. Nếu có dữ liệu nhập dở, lưu `.json` trước khi tải lại trang.
7. Gửi thông tin lỗi cho admin, không gửi file có dữ liệu nhạy cảm lên repo công khai.

## 25. Bảo vệ dữ liệu và lưu hồ sơ

1. Không đưa BBTN thật, S/N thật, tên trạm hoặc file máy đo lên repo.
2. Không gửi anon key hoặc thông tin tài khoản trong ảnh chụp công khai.
3. Không dùng `service_role` key trong trình duyệt.
4. Lưu file JSON theo quy trình bảo mật nội bộ.
5. Kiểm tra DOCX/XLSX trước khi phát hành.
6. CSDL và JSON là hai phương thức lưu khác nhau.
7. Sau khi **Lưu & chốt**, xác nhận trạng thái phiên trong danh sách.
8. Nếu đổi máy, mở file JSON hoặc mở phiên từ CSDL.
9. Tài liệu template nội bộ có thể cần được nạp lại trên máy mới.

## 26. Tham chiếu

- [README dự án](../README.md)
- [Kiến thức dự án](KIEN_THUC.md)
- [Quy tắc agent](../AGENTS.md)
- [Bảng phân công](PHAN_CONG.md)
- [Mã giao diện chính](../js/ui/app.js)
- [Mã trang CSDL](../js/ui/db-ui.js)
- [Schema MBA](../js/domain/types/mba/schema.js)
- [Quy đổi và ngưỡng](../js/domain/qd1901.js)
## Mô hình 3D MBA

Mở **Mô hình 3D** trên thanh điều hướng. Xoay bằng cách kéo chuột hoặc cảm ứng, thu phóng bằng con lăn hoặc chụm hai ngón. Mỗi bộ phận liệt kê các hạng mục có trong mẫu biên bản hiện tại; bấm bộ phận để mở hạng mục hoặc chọn trong menu nếu có nhiều hạng mục. Nếu thư viện 3D không tải được, danh sách liên kết vẫn hoạt động.
