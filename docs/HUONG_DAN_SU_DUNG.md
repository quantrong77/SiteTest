# Hướng dẫn sử dụng Site Test Report

Tài liệu hướng dẫn theo tên nút và nội dung đang có trong repo.
Một số chức năng cần Supabase hoặc file template nội bộ của đơn vị.
Luôn dùng số liệu thật trong môi trường được phép; ví dụ trong repo phải là giả.

Mở hướng dẫn này trong app bằng nút ? trên header hoặc phím F1. Khi đang ở một hạng mục, app sẽ đưa bạn tới phần hướng dẫn liên quan; nhấn **Quay lại hạng mục** để trở về.

## Bắt đầu nhanh: 10 bước

1. Mở site trên Chrome hoặc Edge, hoặc chạy `start.bat` để mở local.
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
2. Nếu dùng bản local, chạy `start.bat` tại thư mục dự án.
3. Không mở trực tiếp `index.html` nếu cần Google OAuth.
4. Lần đầu mở, app tạo biên bản MBA mặc định nếu chưa có hồ sơ đang nhập.
5. Dữ liệu nhập dở được tự lưu trên trình duyệt hiện tại.
6. Dùng **Lưu .json** để sao lưu thành file.
7. Dùng **Mở…** để mở file JSON đã lưu.
8. JSON trên một máy không tự đồng bộ sang máy khác.

### Tạo hồ sơ mới

1. Bấm **Mới** trên thanh công cụ.
2. Hộp thoại **Chọn loại thiết bị** hiện ra.
3. Chọn loại đang được hỗ trợ, hiện là **Máy biến áp**.
4. Các loại chưa triển khai được đánh dấu chưa hỗ trợ.
5. Nếu chọn lại cùng loại đang mở, cấu hình của loại có thể được giữ lại.
6. Nếu đổi loại, app dùng cấu hình mặc định của loại mới.
7. Biên bản mới thay state hiện hành; hãy lưu hồ sơ cần giữ trước đó.
8. App đưa người dùng về mục **0. Thông tin chung & cấu hình**.

## 2. Mục 0: Thông tin chung và cấu hình

Tên một số nút trong khu vực có thể thay đổi theo nhánh/tính năng.
Hãy dùng đúng nhãn hiển thị trên phiên bản đang chạy.

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
4. Mẫu theo pha (**A**, **B**, **C**) là mẫu riêng cho từng máy một pha. Mẫu chung **3P** gộp ba MBA một pha A, B, C vào một biên bản.
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

### Test report sứ Hitachi

1. Dùng nút nạp XLSX xuất xưởng/test report sứ đang có trong mục 0.
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
3. Các hạng mục MBA đã hỗ trợ có hướng dẫn đo rút gọn theo *Tài liệu đào tạo thí nghiệm MBA (2026)*; mục nguồn hiện trong khung tài liệu tham khảo.
   Hướng dẫn trong app không thay thế sơ đồ đấu nối, phương án an toàn và quy trình chi tiết được đơn vị phê duyệt; làm theo các tài liệu đó trước khi đo.
4. Nhập số liệu bằng bàn phím hoặc dán bảng từ Excel vào ô đầu.
5. Phím Enter đi xuống hàng trong cùng cột theo bảng.
6. Ô màu xám thường là tự tính.
7. Ô được viền xanh, đỏ hoặc vàng phản ánh kết quả Đạt, Không đạt hoặc Cần xem xét.
8. Rê chuột hoặc mở phần đánh giá để xem căn cứ/chi tiết khi giao diện hỗ trợ.
9. Nút **Hoàn tác** đảo thao tác thuộc hạng mục hiện tại.
10. **Ctrl+Z** hoặc **Cmd+Z** ngoài ô nhập cũng hoàn tác theo hạng mục.
11. Khi con trỏ ở ô nhập, Ctrl+Z/Cmd+Z vẫn hoàn tác nội dung gõ trong ô.
12. **Xóa số liệu hạng mục** xóa số liệu hạng mục hiện tại, không xóa thông tin chung.
13. Cấu hình, nhãn và kết luận được giữ theo hành vi xóa trong mã.
14. Có thể dùng nút **Đọc số** ở hạng mục có ô số hỗ trợ.

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

## 6. Mục 3: Điện trở cách điện

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

## 7. Mục 4: Kiểm tra tổ đấu dây

1. Đo tổ đấu dây bằng thiết bị/phương pháp được đơn vị phê duyệt.
2. Nhập kết quả đo vào trường **Tổ đấu dây đo được**.
3. Đối chiếu với nameplate và hồ sơ xuất xưởng.
4. App hiển thị kết quả để kỹ sư xác nhận.
5. Căn cứ trong mã tham chiếu Điều 32 mục 3.
6. Không có bộ đọc file tự động riêng trong luồng hiện hành.

## 8. Mục 5: Sứ đầu vào

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

## 9. Mục 6: Tgδ và điện dung cuộn dây

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
11. Tiêu chí tgδ và tăng so với xuất xưởng tham chiếu Điều 9 mục 5 và Điều 30.
12. Nhập thủ công từ cầu đo tgδ hoặc nạp file nếu có luồng phù hợp.

## 10. Mục 7: Điện trở một chiều

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

## 11. Mục 8: Tỷ số biến

1. Nhập tỷ số đo cho từng nấc và từng cặp cuộn.
2. Kiểm tra tiêu đề pha A, B, C và các tỷ số HV:MV, HV:LV, MV:LV.
3. Kiểm tra nameplate và tham chiếu số liệu xuất xưởng.
4. App tự tính ΔK theo pha và độ lệch tổng hợp khi có đủ số liệu.
5. Ngưỡng lệch tham chiếu 0,5% theo Điều 9 mục 6 và Điều 33.
6. Haefely 2293 có thể nạp dữ liệu CSV vào các trường hỗ trợ.
7. Chọn pha/nấc trong hộp thoại nếu app không suy ra duy nhất.
8. Kiểm tra đơn vị và chiều tỷ số trước khi lưu.

## 12. Mục 9: OLTC

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

## 13. Mục 10: Độ ẩm cách điện cứng

1. Nhập giá trị độ ẩm theo phần trăm.
2. Nhập phương pháp hoặc thiết bị đo, ví dụ FDS/PDC nếu đúng.
3. Với mẫu 3P, nhập kết quả riêng theo từng máy.
4. App phân loại theo hàm `classifyMoisture` trong QD.
5. Mức dưới 2,2% được phân loại khô trong mã.
6. Khoảng 2,2–3,7% được cảnh báo mức trung bình.
7. Khoảng 3,7–4,8% và trên 4,8% được phân loại không đạt theo mã.
8. Căn cứ tham chiếu Điều 28.
9. Đảm bảo phương pháp và điều kiện đo đúng hướng dẫn thiết bị.

## 14. Mục 11: Biến dòng chân sứ

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

## 15. Khác biệt nhập liệu mẫu chung 3P

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

## 16. Tổng hợp và kết luận

1. Mở **Σ Tổng hợp**.
2. Đọc danh sách giá trị thiếu, cảnh báo và kết quả so sánh.
3. Kiểm tra các ngưỡng đã được admin override nếu tài khoản hiển thị thông tin đó.
4. Bấm **Điền kết luận tự động** để tạo bản nháp kết luận.
5. Đọc lại từng câu và sửa theo kết quả thực tế.
6. Không để kết luận tự động thay thế phán đoán kỹ thuật.
7. Không kết luận Đạt chỉ từ một chỉ số nếu quy trình yêu cầu đánh giá tổng thể.
8. Lưu lại hồ sơ sau khi chỉnh kết luận.

## 17. Phụ lục BBTN

### Thí nghiệm ngắn mạch MBA

1. Mở trang **Phụ lục BBTN** và bấm **Thêm phép đo** cho từng cặp cuộn dây, nấc và pha cần ghi. Bố cục 1 pha dùng số chế tạo máy chính; mẫu 3 máy 1 pha ghép số chế tạo theo pha; mẫu MBA 3 pha dùng một S/N và các phép đo pha A/B/C.
2. Theo Điều 25–26 QĐ 1387, thực hiện từng cặp cuộn ở tần số định mức, nối ngắn mạch một cuộn và cấp nguồn vào cuộn còn lại; dòng thử không thấp hơn 25% In. Khi hiện trường không có điện áp theo Test Report, dùng 380 V hoặc điện áp không quá 10 kV rồi nội suy.
3. Nhập U thử tùy ý theo đơn vị V hoặc kV (có gợi ý 67, 220, 380 V), f đo/f định mức, Un/In, I/P đo, nhiệt độ, cặp cuộn, nấc và pha. App đổi U về kV rồi quy đổi Uk = U/Un × In/I và Pk theo P × (In/I)².
4. Nếu hiệu chỉnh Pk theo nhiệt độ, nhập PI²R, chọn vật liệu dây dẫn và nhiệt độ Pk trong Test Report. Công thức: Pk₂ = Pcu₁ × (K+t₂)/(K+t₁) + Pstr₁ × (K+t₁)/(K+t₂), Pstr₁ = Pk₁−Pcu₁, K = 235 cho đồng hoặc 225 cho nhôm. Chỉ hiệu chỉnh khi đủ thành phần tổn hao và vật liệu.
5. App đọc Pk/Uk từ sheet tổn hao/trở kháng của Test Report đang dùng, ghép theo cặp cuộn, nấc và số chế tạo. Có thể chọn trường hợp mới, sau đại tu hoặc đang vận hành; với hai trường hợp sau, nhập thêm Uk ban đầu. Với MBA mới, nhập Uk nhãn máy nếu Test Report không có trị số này để đánh giá Điều 27.
6. Bảng hiển thị riêng Điều 27 QĐ 1387 (MBA mới: sai số Uk ≤5% tại nấc chính; sau đại tu/đang vận hành: ≤3% so với Uk ban đầu và giữa các pha; Pk ≤115% số liệu nhà chế tạo) và Điều 35 QĐ 1901 đang dùng (Uk ≤3%, Pk ≤115%, lệch pha MBA 3 pha ≤3%). Kết quả chung Đạt khi tất cả tiêu chí áp dụng đạt.
7. Tần số không khớp, dòng thử dưới 25% In, thiếu Test Report/Uk ban đầu hoặc thiếu dữ liệu quy đổi thì hiện **Cần xem xét**. Khi xuất BBTN, bảng số liệu, so sánh Test Report và đánh giá được nối thành phụ lục riêng.

### Dầu MBA (DGA và lý hóa dầu)

1. Mở trang **Phụ lục BBTN**, bấm **Mở app DGA** và chọn thiết bị theo số chế tạo. Có thể dùng **Chép số chế tạo** để dán vào app.
2. Nhập/đánh giá kết quả trong app DGA và xuất BBTN dầu dạng `.docx`.
3. Quay lại app BBTN, bấm **Nạp BBTN dầu (.docx)…**; có thể chọn nhiều file DGA và lý hóa dầu.
4. Xem lại loại file, số chế tạo, ngày lấy mẫu và kết luận. Xác nhận cảnh báo nếu file không nhận dạng hoặc số chế tạo không khớp.
5. Chọn **Nối vào BBTN** cho từng file cần đính kèm. File bị thiếu trên máy hiện tại cần nạp lại trước khi xuất.
6. Tệp được lưu kèm file JSON và tải lên Storage cùng phiên CSDL như phụ lục SFRA; app DGA vẫn là ứng dụng riêng, không dùng CSDL Supabase của BBTN.

### Chụp sóng OLTC

1. Nạp dữ liệu Haefely 2293 có dạng sóng tại mục 9.
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

## 18. Xuất DOCX và XLSX

1. Kiểm tra đã chọn đúng template.
2. Mở **Σ Tổng hợp** và xử lý dữ liệu thiếu.
3. Bấm **Xuất BBTN .docx**.
4. Đọc thông báo nếu template thiếu bảng hoặc một số trường không định vị được.
5. Mở DOCX vừa tải và kiểm tra nội dung, bảng, chân trang, phụ lục.
6. Bấm **Xuất so sánh .xlsx** để lưu chi tiết giá trị và kết quả so sánh.
7. Kiểm tra dấu thập phân, đơn vị, số chế tạo và pha trong hai file.
8. Lưu JSON nếu cần mở lại trong trình duyệt.
9. Xuất thành công DOCX không đồng nghĩa dữ liệu đã lưu vào CSDL.

## 19. CSDL: kết nối, đăng nhập và quyền

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
7. FAT được dùng làm điểm khởi đầu nếu có.
8. Xu hướng hỗ trợ theo dõi, không thay đánh giá tổng thể theo Điều 3 QĐ 1901.
9. Nếu không thấy chuỗi, kiểm tra phiên đã lưu và thiết bị đã gắn đúng.

### Xu hướng tại ô nhập

1. Mở biên bản đã gắn thiết bị và có lịch sử.
2. Đăng nhập CSDL để tải lịch sử.
3. Khi có chuỗi phù hợp, vùng dưới ô hiển thị biểu đồ nhỏ và thay đổi phần trăm.
4. So sánh có thể gồm FAT và lần đo trước.
5. Các giá trị được quy đổi chuẩn trước khi so sánh khi có quy tắc.
6. Màu cảnh báo chỉ hỗ trợ tham khảo.
7. Tính năng không thay đổi kết quả evaluate của biên bản.

### Nhập Test report xuất xưởng vào CSDL

1. Nạp file xuất xưởng trong mục 0.
2. Tại trang CSDL, chọn Trạm và Ngăn nếu cần gắn thiết bị.
3. Bấm **Nhập Test report vào CSDL**.
4. Kiểm tra danh sách máy được nhận dạng.
5. Xác nhận chỉ nhập dữ liệu đúng file và đúng tổ máy.
6. Dữ liệu được ghi như lần thí nghiệm FAT.
7. Chạy lại có thể cập nhật phiên đã nhập thay vì tạo trùng.
8. FAT tạo mốc xuất xưởng cho xu hướng.

## 20. Nhập BBTN cũ

1. Mở trang **Nhập BBTN cũ** trong nhóm Cơ sở dữ liệu.
2. Chọn một hoặc nhiều file DOCX cũ.
3. Có thể chọn thư mục nếu trình duyệt và giao diện cho phép.
4. Chờ bảng soát hiển thị kết quả đọc.
5. Kiểm tra mẫu được nhận dạng, số chế tạo, ngày và số ô đọc được.
6. Đọc cảnh báo thiếu trường hoặc số ô đọc thấp.
7. Bấm **Mở để soát** để nạp một biên bản vào giao diện.
8. Kiểm tra giá trị đã đọc, sửa sai và lưu theo luồng thông thường.
9. Bấm **Lưu CSDL** trong bảng nhập để nhập thẳng theo cơ chế đó.
10. Xác nhận thiết bị, ngày và nguồn dữ liệu trước khi ghi.
11. Mẫu 3P lưu số chế tạo máy chính ở một trường.
12. Mẫu 3P chỉ hạn chế số chế tạo máy chính theo parser hiện tại.
13. Không dùng lệnh nhập hàng loạt nếu bảng soát chưa đúng.
14. BBTN cũ không đảm bảo đọc được mọi template hoặc bản scan.
15. Chỉ DOCX có cấu trúc bảng phù hợp mới được parser hỗ trợ.

## 21. Thư viện tài liệu

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

## 22. Bộ tiêu chí và hệ số quy đổi sứ

### Bộ tiêu chí

1. Mở trang **Bộ tiêu chí đánh giá**.
2. Đọc giá trị gốc QĐ 1901 và giá trị đang áp dụng.
3. Giá trị override được đánh dấu theo giao diện.
4. Admin có thể sửa ngưỡng và ghi lý do/căn cứ đơn vị.
5. Dùng khôi phục nếu cần trả về bộ mặc định.
6. Kết luận tự động có thể nêu ngưỡng khác giá trị gốc.
7. Không sửa ngưỡng nếu chưa có phê duyệt của đơn vị.

### Hệ số quy đổi sứ

1. Mở **Hệ số quy đổi sứ**.
2. Chọn bảng QĐ 1901 hoặc bảng của hãng phù hợp.
3. Admin có thể thêm/sửa bảng theo quyền.
4. Có thể nhập bảng hệ số từ Excel nếu bố cục đúng.
5. Trong mục 5, chọn chế độ tương ứng ở **Cách quy đổi về 20 °C**.
6. Kiểm tra nhiệt độ sử dụng và chiều quy đổi trước khi đánh giá.
7. Mã hỗ trợ bảng built-in và bảng được lưu trong CSDL.

## 23. Lỗi thường gặp và cách xử lý

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

## 24. Bảo vệ dữ liệu và lưu hồ sơ

1. Không đưa BBTN thật, S/N thật, tên trạm hoặc file máy đo lên repo.
2. Không gửi anon key hoặc thông tin tài khoản trong ảnh chụp công khai.
3. Không dùng `service_role` key trong trình duyệt.
4. Lưu file JSON theo quy trình bảo mật nội bộ.
5. Kiểm tra DOCX/XLSX trước khi phát hành.
6. CSDL và JSON là hai phương thức lưu khác nhau.
7. Sau khi **Lưu & chốt**, xác nhận trạng thái phiên trong danh sách.
8. Nếu đổi máy, mở file JSON hoặc mở phiên từ CSDL.
9. Tài liệu template nội bộ có thể cần được nạp lại trên máy mới.

## 25. Tham chiếu

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
