"""Test đầu-cuối xuất BBTN .docx (chạy trong trình duyệt thật bằng Playwright cho Python, không thêm gói npm).

Mở app, chọn mẫu chung 3 pha (3P), điền số liệu giả, bấm "Xuất BBTN .docx", rồi đọc file tải về và kiểm từng ô:
thông tin chung, bảng tổng hợp, số liệu theo máy A/B/C, hàng nhiệt độ sứ chèn thêm, R một chiều mΩ, tỷ số, ẩm, OLTC,
phụ lục biến dòng chân sứ và chân trang "Page x of y" (PAGEREF tới cuối biên bản). Kiểm thêm mẫu theo pha (A) vẫn xuất được.

Cần: Python 3, `pip install playwright` + `playwright install chromium`, và js/embedded.js có template 3P
(chạy tools/build_embedded.py với bản trống "BBTN MBA 500kV 3 pha chung (trong).docx"). Thiếu thì test bỏ qua (mã thoát 0).
Chạy: npm run test:e2e   (hoặc python tools/e2e_export_3p.py)
"""
import functools
import http.server
import io
import pathlib
import re
import sys
import threading
import zipfile
from xml.etree import ElementTree as ET

sys.stdout.reconfigure(encoding='utf-8')
APP = pathlib.Path(__file__).resolve().parents[1]
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print('BỎ QUA: chưa cài playwright cho Python (pip install playwright && playwright install chromium)')
    sys.exit(0)

emb = APP / 'js' / 'embedded.js'
if not emb.exists() or '"3P"' not in emb.read_text(encoding='utf-8', errors='ignore')[:2000000]:
    print('BỎ QUA: js/embedded.js chưa có template 3P (chạy tools/build_embedded.py)')
    sys.exit(0)

# ---------------------------------------------------------------- số liệu giả (không phải số liệu thật)
PS = {'A': 'TEST-A', 'B': 'TEST-B', 'C': 'TEST-C'}
VALS = {
    'meta.project': 'Dự án kiểm thử', 'meta.site': 'MBA kiểm thử', 'meta.date': '01/01/2026', 'meta.ambT': '30', 'meta.hum': '70',
    'meta.serial': 'TEST-A', 'visual.items.i1.e': 'Đạt/Pass', 'visual.items.i9.e': 'Không đạt/Fail',
    'nl.B.rated.r0.um': '35,2', 'nl.B.rated.r0.ur': '35,0', 'nl.B.rated.r0.ia': '3,1', 'nl.B.rated.r0.pm': '60',
    'ir.A.t': '30', 'ir.A.meas.r0.r15': '16200', 'ir.A.meas.r0.r60': '18300', 'ir.A.meas.r0.r180': '23900', 'ir.A.meas.r0.r360': '30300',
    'ir.A.meas.r0.r600': '37800', 'ir.A.meas.r6.r60': '6290', 'ir.C.t': '32', 'ir.C.meas.r3.r60': '44900',
    'vector.result': 'YNa0d11', 'b.hv.t': '35', 'b.hv.meas.serial.A': 'SU-A', 'b.hv.meas.type.A': 'Kiểu sứ thử',
    'b.hv.meas.t.A': '34', 'b.hv.meas.t.C': '37', 'b.hv.meas.tgd1.A': '0,375', 'b.hv.meas.c1.A': '731,22', 'b.hv.meas.tgd2.C': '0,444',
    'b.n.meas.tgd1.B': '0,315', 'b.lv2.meas.c1.c': '628,53',
    'wtgd.C.t': '36', 'wtgd.C.meas.r4.tgd': '0,233', 'wtgd.C.meas.r4.c': '5700,85',
    'dcr.A.t': '30', 'dcr.B.t': '30', 'dcr.C.t': '26', 'dcr.hv.t17.A': '154,7', 'dcr.hv.t17.B': '154,9', 'dcr.hv.t17.C': '156,9',
    'dcr.lv.r.C': '14,7', 'ratio.hl.t9.B': '8,2506', 'ratio.ml.r.C': '3,7067',
    'moist.r.A': '0,3', 'moist.r.B': '0,3', 'moist.r.C': '0,4',
    'oltc.type': 'OLTC thử', 'oltc.r.dn6.tap': '9B-9A', 'oltc.r.dn6.kC': '22,6', 'oltc.r.dn6.cC': '33', 'oltc.eval': 'Đạt',
    'bct.hv.ratio.w1s2.A': '1598,14', 'bct.hv.dcr.w1s2.A': '10,95', 'bct.polarity': 'Đúng cực tính',
}


class Doc:
    """Đọc .docx tải về: bảng cấp thân văn bản, ô theo cột lưới (tính gridSpan), đoạn văn."""

    def __init__(self, data):
        self.zip = zipfile.ZipFile(io.BytesIO(data))
        self.root = ET.fromstring(self.zip.read('word/document.xml'))
        self.body = self.root.find(W + 'body')
        self.tables = [e for e in self.body if e.tag == W + 'tbl']

    @staticmethod
    def text(e):
        return ''.join(t.text or '' for t in e.iter(W + 't')).strip()

    def cell(self, t, r, c):
        tr = self.tables[t].findall(W + 'tr')[r]
        g = 0
        for tc in tr.findall(W + 'tc'):
            gs = tc.find(f'{W}tcPr/{W}gridSpan')
            span = int(gs.get(W + 'val')) if gs is not None else 1
            if g <= c < g + span:
                return self.text(tc)
            g += span
        return None

    def rows(self, t):
        return len(self.tables[t].findall(W + 'tr'))

    def paras(self):
        return [self.text(p) for p in self.body.iter(W + 'p')]

    def part(self, name):
        return self.zip.read(name).decode('utf-8')


fails = []


def check(cond, msg):
    print(('  ✔ ' if cond else '  ✖ ') + msg)
    if not cond:
        fails.append(msg)


def eq(got, want, msg):
    check(got == want, f'{msg}: {got!r}' + ('' if got == want else f' (cần {want!r})'))


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(QuietHandler, directory=str(APP))
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def export(pg, template, vals):
    pg.evaluate("App.go('general')")
    pg.select_option('[data-cfg="template"]', template)
    pg.wait_for_timeout(1500)
    pg.evaluate("([ps, v]) => { Object.assign(App.state.cfg.ps, ps); Object.assign(App.state.v, v); App.rebuild(true); }", [PS, vals])
    pg.wait_for_timeout(500)
    with pg.expect_download(timeout=60000) as dl:
        pg.locator('button', has_text='Xuất BBTN').first.click()
    return Doc(pathlib.Path(dl.value.path()).read_bytes())


def main():
    srv = serve()
    errs = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/index.html')
        pg.wait_for_timeout(1500)

        print('Mẫu chung 3 pha (3P)')
        d = export(pg, '3P', VALS)
        eq(len(d.tables) >= 28, True, 'số bảng ≥ 28 (thân BBTN + phụ lục)')
        # thông tin chung, tổng hợp
        check('Dự án kiểm thử' in d.cell(0, 2, 0), 'tên dự án ghi vào bảng 0')
        check('TEST-A; TEST-B; TEST-C' in d.cell(0, 4, 3), 'số chế tạo cả 3 máy')
        eq(d.cell(0, 11, 6), '✓', 'tổng hợp mục 1 có dấu ✓ (cột lưới 6)')
        eq(d.cell(0, 11, 7), 'Không đạt', 'tổng hợp mục 1 đánh giá (một hạng mục Không đạt)')
        eq((d.cell(0, 13, 6), d.cell(0, 14, 6)), ('✓', '✓'), 'mục 3 và mục 4 (lõi từ) cùng theo cách điện')
        eq(d.cell(0, 22, 6), '', 'mục 12 SFRA trống khi chưa nạp báo cáo SFRA')
        # 1. bên ngoài: tên hạng mục giữ nguyên, đánh giá ở cột 2
        check(d.cell(1, 1, 1).startswith('Sứ xuyên'), 'tên hạng mục 1 giữ nguyên')
        eq((d.cell(1, 1, 2), d.cell(1, 9, 2), d.cell(1, 5, 2)), ('Đạt/Pass', 'Không đạt/Fail', ''), 'đánh giá từng hạng mục')
        # 2. không tải theo máy: pha B → bảng 3
        eq([d.cell(3, 1, c) for c in (1, 2, 3, 5)], ['35,2', '35,0', '3,1', '60'], 'không tải máy B vào bảng pha B')
        check(d.cell(3, 1, 6) != '', 'P0 máy B tự tính')
        eq(d.cell(2, 1, 1), '', 'bảng pha A để trống')
        # 3. cách điện theo máy
        paras = d.paras()
        check(any('N0:' in x and 'TEST-A' in x for x in paras), 'số chế tạo máy A trước bảng cách điện pha A')
        check(any('N0:' in x and 'TEST-C' in x for x in paras), 'số chế tạo máy C trước bảng cách điện pha C')
        eq([d.cell(5, 1, c) for c in range(1, 6)], ['16200', '18300', '23900', '30300', '37800'], 'R15…R600 máy A')
        eq((d.cell(5, 1, 6), d.cell(5, 1, 7)), ('1,13', '2,07'), 'Kht, PI tự tính')
        eq((d.cell(5, 5, 1), d.cell(5, 5, 2), d.cell(5, 5, 8)), ('/', '6290', '2500'), 'lõi từ: giữ "/", R60, điện áp mặc định')
        check(d.cell(6, 1, 2) not in ('', None), 'R60 quy đổi 20 °C máy A')
        eq(d.cell(9, 4, 2), '44900', 'máy C: hàng Cao, trung/Hạ')
        check(any(re.search(r'temperature\)\s*/\s*32\s*oC', x) for x in paras), 'nhiệt độ đo cách điện máy C')
        # 4. tổ đấu dây
        check(any(re.search(r'group\)\s*/\s*YNa0d11', x) for x in paras), 'tổ đấu dây')
        # 5. sứ: hàng nhiệt độ chèn sau "Dòng điện định mức" ở cả 5 bảng
        for t in range(11, 16):
            eq(d.rows(t), 10, f'bảng sứ {t}: 10 hàng (đã chèn hàng nhiệt độ)')
            check(d.cell(t, 5, 0).startswith('Nhiệt độ đo'), f'bảng sứ {t}: hàng 5 là nhiệt độ đo')
        eq([d.cell(11, 0, 2), d.cell(11, 1, 2), d.cell(11, 5, 2), d.cell(11, 5, 4)], ['SU-A', 'Kiểu sứ thử', '34', '37'], 'sứ cao áp: S/N, kiểu, nhiệt độ từng sứ')
        eq([d.cell(11, 6, 2), d.cell(11, 7, 2), d.cell(11, 8, 4)], ['0,375', '731,22', '0,444'], 'sứ cao áp: tgδ C1, C1, tgδ C2 đúng hàng')
        eq((d.cell(11, 6, 5), d.cell(11, 6, 6)), ('10', 'UST'), 'ô gộp U đo / sơ đồ đo giữ nguyên')
        eq(d.cell(13, 6, 3), '0,315', 'sứ trung tính máy B')
        eq(d.cell(15, 7, 4), '628,53', 'sứ hạ áp z (x, y, z)')
        eq(d.cell(12, 3, 2), '', 'không điền Ur cho sứ chưa có số liệu')
        # 7. tgδ cuộn dây máy C
        eq((d.cell(18, 1, 1), d.cell(18, 1, 3)), ('0,233', '5700,85'), 'tgδ, C máy C')
        check(d.cell(18, 1, 2) != '', 'tgδ@20 °C máy C tự tính')
        check('36' in d.cell(18, 0, 1), 'nhiệt độ ở tiêu đề cột bảng máy C')
        check(d.cell(18, 1, 0).startswith('Cao,trung/Vỏ'), 'nhãn đối tượng đo của template giữ nguyên')
        # 8. R một chiều mΩ
        check(any('(mΩ)' in x for x in paras), 'đơn vị mΩ ở tiêu đề mục 8')
        check(any(re.search(r'Pha C:\s*t\s*=\s*26\s*oC', x) for x in paras), 'nhiệt độ đo R một chiều máy C')
        eq([d.cell(19, 17, c) for c in range(1, 4)], ['154,7', '154,9', '156,9'], 'R nấc 17 A/B/C')
        check(d.cell(19, 17, 4) != '', 'ΔRmax nấc 17 tự tính')
        eq(d.cell(21, 1, 2), '14,7', 'R cuộn hạ áp cz')
        # 9. tỷ số
        eq(d.cell(23, 9, 2), '8,2506', 'tỷ số HV:LV nấc 9 pha B')
        eq(d.cell(24, 1, 3), '3,7067', 'tỷ số MV:LV pha C')
        # 10. ẩm, 11. OLTC
        eq([d.cell(25, 1, c) for c in range(3)], ['0,3', '0,3', '0,4'], 'ẩm theo pha')
        check('9B-9A' in d.cell(26, 17, 0) and 'Tap position' in d.cell(26, 17, 0), 'nấc chuyển OLTC, giữ nhãn tiếng Anh')
        eq((d.cell(26, 17, 3), d.cell(26, 17, 6)), ('22,6', '33'), 'số vòng OLTC pha C')
        # phụ lục BCT và chân trang
        check('KẾT QUẢ THÍ NGHIỆM BIẾN DÒNG CHÂN SỨ' in paras, 'phụ lục biến dòng chân sứ')
        check(any('1598,14' in d.text(t) for t in d.tables[28:]), 'tỷ số BCT trong phụ lục')
        doc_xml = d.part('word/document.xml')
        check('_BBTN_END' in doc_xml, 'đánh dấu trang cuối biên bản')
        footers = [n for n in d.zip.namelist() if re.match(r'word/footer\d*\.xml$', n)]
        check(any('PAGEREF _BBTN_END' in d.part(n) for n in footers), 'chân trang biên bản: tổng số trang tới cuối biên bản')
        check('SECTIONPAGES' in d.part('word/footerAppx.xml'), 'chân trang phụ lục: đánh số riêng')

        print('Mẫu theo pha máy chính (A) — hồi quy')
        d1 = export(pg, 'A', {'meta.serial': 'TEST-A', 'ir.t': '30', 'ir.meas.r0.r60': '18300', 'dcr.hv.t1.A': '154,8'})
        check(len(d1.tables) >= 72, f'mẫu A: {len(d1.tables)} bảng')
        eq(d1.cell(4, 1, 2), '18300', 'mẫu A: R60 vào bảng cách điện')
        b.close()
    srv.shutdown()
    check(not errs, 'không có lỗi JavaScript' + (f': {errs}' if errs else ''))
    print(f'\n{"ĐẠT" if not fails else f"KHÔNG ĐẠT: {len(fails)} kiểm tra"}')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
