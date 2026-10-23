// Đọc/ghi template BBTN (.docx) bằng JSZip + DOM XML: điền ô theo (bảng, hàng, cột lưới) và
// chèn giá trị vào "khe" trong đoạn văn (regex có nhóm (?<v>…)) mà vẫn giữ định dạng run gốc.
(function () {
  'use strict';
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const XML_NS = 'http://www.w3.org/XML/1998/namespace';

  const kids = (el, name) => Array.from(el.childNodes).filter(n => n.nodeType === 1 && n.localName === name);
  const desc = (el, name) => Array.from(el.getElementsByTagNameNS(W, name));
  const wAttr = (el, name) => el && el.getAttributeNS(W, name);

  class DocxTemplate {
    static async load(data) {
      const t = new DocxTemplate();
      t.zip = await JSZip.loadAsync(data, typeof data === 'string' ? { base64: true } : undefined);
      const xml = await t.zip.file('word/document.xml').async('string');
      t.doc = new DOMParser().parseFromString(xml, 'application/xml');
      t.body = t.doc.getElementsByTagNameNS(W, 'body')[0];
      t.children = Array.from(t.body.childNodes).filter(n => n.nodeType === 1);
      t.tables = t.children.filter(n => n.localName === 'tbl');
      return t;
    }

    // Hàng của nhiều bảng ghép liên tiếp (bảng bị ngắt trang)
    rows(tables) { return tables.flatMap(i => (this.tables[i] ? kids(this.tables[i], 'tr') : [])); }

    cellAt(tr, gridCol) {
      const trPr = kids(tr, 'trPr')[0];
      const gb = trPr && kids(trPr, 'gridBefore')[0];
      let g = gb ? +wAttr(gb, 'val') : 0;
      for (const tc of kids(tr, 'tc')) {
        const pr = kids(tc, 'tcPr')[0];
        const gs = pr && kids(pr, 'gridSpan')[0];
        const span = gs ? +wAttr(gs, 'val') : 1;
        if (gridCol >= g && gridCol < g + span) return tc;
        g += span;
      }
      return null;
    }

    cell(tables, row, col) {
      const tr = this.rows(tables)[row];
      return tr ? this.cellAt(tr, col) : null;
    }

    makeRun(rPrSrc, text) {
      const r = this.doc.createElementNS(W, 'w:r');
      if (rPrSrc) {
        const rPr = this.doc.createElementNS(W, 'w:rPr');
        Array.from(rPrSrc.childNodes).forEach(n => rPr.appendChild(n.cloneNode(true)));
        r.appendChild(rPr);
      }
      String(text).split('\n').forEach((line, i) => {
        if (i) r.appendChild(this.doc.createElementNS(W, 'w:br'));
        const t = this.doc.createElementNS(W, 'w:t');
        t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
        t.textContent = line;
        r.appendChild(t);
      });
      return r;
    }

    // Ghi đè toàn bộ nội dung ô, giữ định dạng run/đoạn đầu tiên
    setCellText(tc, text) {
      if (!tc) return false;
      const ps = kids(tc, 'p');
      const p = ps[0];
      const firstRun = desc(tc, 'r')[0];
      const pPr = kids(p, 'pPr')[0];
      const rPrSrc = (firstRun && kids(firstRun, 'rPr')[0]) || (pPr && kids(pPr, 'rPr')[0]) || null;
      ps.slice(1).forEach(x => tc.removeChild(x));
      Array.from(p.childNodes).forEach(n => { if (!(n.nodeType === 1 && n.localName === 'pPr')) p.removeChild(n); });
      p.appendChild(this.makeRun(rPrSrc, text));
      return true;
    }

    paraText(p) { return desc(p, 't').map(t => t.textContent).join(''); }

    // Thay nhóm (?<v>…) của regex trong đoạn p bằng value, tác động trực tiếp lên các w:t
    setSlot(p, re, value) {
      const nodes = desc(p, 't');
      let pos = 0;
      const map = nodes.map(n => { const s = pos; pos += n.textContent.length; return { n, s, e: pos }; });
      const full = map.map(x => x.n.textContent).join('');
      const rx = new RegExp(re.source, re.flags.replace('d', '') + 'd');
      const m = rx.exec(full);
      if (!m || !m.indices.groups || !m.indices.groups.v) return false;
      const [s, e] = m.indices.groups.v;
      // tự thêm khoảng trắng ngăn cách với nhãn/đơn vị liền kề (vd "t=" … "oC")
      value = String(value).trim();
      if (value) {
        if (s > 0 && !/\s/.test(full[s - 1])) value = ' ' + value;
        if (e < full.length && !/\s/.test(full[e])) value += ' ';
      }
      // Ghi vào run chứa ký tự ngay trước khe (run nhãn) để giữ định dạng chữ thường của nhãn
      let host = (s > 0 && map.find(x => x.s < s && s <= x.e)) || map.find(x => s >= x.s && s < x.e) || map[map.length - 1];
      if (!host) return false;
      for (const x of map) {
        const a = Math.max(s, x.s), b = Math.min(e, x.e);
        const txt = x.n.textContent;
        if (x === host) {
          x.n.textContent = txt.slice(0, s - x.s) + value + txt.slice(Math.max(b, s) - x.s);
          x.n.setAttributeNS(XML_NS, 'xml:space', 'preserve');
        } else if (b > a) {
          x.n.textContent = txt.slice(0, a - x.s) + txt.slice(b - x.s);
        }
      }
      return true;
    }

    getSlot(p, re) {
      const m = re.exec(this.paraText(p));
      return m && m.groups ? m.groups.v.trim() : null;
    }

    // Đoạn văn gần nhất phía trước bảng tblIdx khớp regex
    paraBefore(tblIdx, re) {
      const tbl = this.tables[tblIdx];
      let i = this.children.indexOf(tbl) - 1;
      for (; i >= 0; i--) {
        const el = this.children[i];
        if (el.localName === 'tbl') break;
        if (el.localName === 'p' && re.test(this.paraText(el))) return el;
      }
      return null;
    }

    paraInCell(spec) {
      const tc = this.cell([spec.t], spec.r, spec.c);
      if (!tc) return null;
      return kids(tc, 'p').find(p => spec.re.test(this.paraText(p))) || null;
    }

    locate(spec) { return spec.before !== undefined ? this.paraBefore(spec.before, spec.re) : this.paraInCell(spec); }

    readField(spec) {
      const p = this.locate(spec);
      if (!p) return null;
      let v = this.getSlot(p, spec.re);
      if (spec.joinNext) {
        let n = p.nextSibling;
        while (n && !(n.nodeType === 1 && n.localName === 'p')) n = n.nextSibling;
        if (n) v = [v, this.paraText(n).trim()].filter(Boolean).join(' ');
      }
      return v;
    }

    writeField(spec, value) {
      const p = this.locate(spec);
      if (!p) return false;
      const okSet = this.setSlot(p, spec.re, value);
      if (okSet && spec.joinNext) {
        const tc = p.parentNode;
        kids(tc, 'p').filter(x => x !== p && tc.contains(x) && Array.prototype.indexOf.call(tc.childNodes, x) > Array.prototype.indexOf.call(tc.childNodes, p))
          .forEach(x => desc(x, 't').forEach(t => { t.textContent = ''; }));
      }
      return okSet;
    }

    async toBlob() {
      const xml = new XMLSerializer().serializeToString(this.doc);
      this.zip.file('word/document.xml', xml);
      return this.zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 }, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    }
  }

  window.DocxTemplate = DocxTemplate;
})();
