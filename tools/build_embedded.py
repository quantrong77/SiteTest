"""Nhúng template BBTN (.docx) và file số liệu xuất xưởng (.xlsx) vào js/embedded.js
để web app chạy được khi mở trực tiếp index.html (file://) mà không cần server.

Chạy lại script này mỗi khi template hoặc file số liệu xuất xưởng thay đổi:
    python tools/build_embedded.py
"""
import base64
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
APP = pathlib.Path(__file__).resolve().parents[1]

TEMPLATES = {
    "A": ROOT / "Template" / "BBTN_MBA_500_A.docx",
    "B": ROOT / "Template" / "BBTN_MBA_500_B.docx",
    "C": ROOT / "Template" / "BBTN_MBA_500_C.docx",
}
FACTORY = ROOT / "ThinghiemHientruongMBA" / "Bao_Cao_Thu_Nghiem_3_MBA_500kV_Di_Linh-v4.xlsx"


def b64(path):
    return base64.b64encode(path.read_bytes()).decode("ascii")


def main():
    data = {
        "templates": {k: {"name": p.name, "b64": b64(p)} for k, p in TEMPLATES.items() if p.exists()},
        "factory": {"name": FACTORY.name, "b64": b64(FACTORY)},
    }
    out = APP / "js" / "embedded.js"
    out.write_text(
        "// Tự sinh bởi tools/build_embedded.py — không sửa tay.\n"
        "window.EMBEDDED = " + json.dumps(data) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {out} ({out.stat().st_size // 1024} KB): templates={list(data['templates'])}, factory={FACTORY.name}")


if __name__ == "__main__":
    main()
