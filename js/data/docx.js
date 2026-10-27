// Đọc/ghi template BBTN (.docx) bằng JSZip + DOM XML: điền ô theo (bảng, hàng, cột lưới) và
// chèn giá trị vào "khe" trong đoạn văn (regex có nhóm (?<v>…)) mà vẫn giữ định dạng run gốc.
(function () {
  'use strict';
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const XML_NS = 'http://www.w3.org/XML/1998/namespace';

  const kids = (el, name) => Array.from(el.childNodes).filter(n => n.nodeType === 1 && n.localName === name);
  const desc = (el, name) => Array.from(el.getElementsByTagNameNS(W, name));
  const wAttr = (el, name) => el && el.getAttributeNS(W, name);

  // Khai báo không gian tên cho đoạn XML phụ lục (đoạn văn, bảng, ảnh)
  const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const NS_DECL = `xmlns:w="${W}" xmlns:r="${R_NS}" `
    + 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
    + 'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const xesc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Đoạn văn: o = { bold, italic, size (pt), align, after (twip), keepNext }; xuống dòng bằng \n
  function paraXml(text, o = {}) {
    const rPr = `${o.bold ? '<w:b/>' : ''}${o.italic ? '<w:i/>' : ''}${o.size ? `<w:sz w:val="${o.size * 2}"/><w:szCs w:val="${o.size * 2}"/>` : ''}`;
    const runs = String(text ?? '').split('\n').map((line, i) => `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${xesc(line)}</w:t></w:r>`).join('');
    return `<w:p><w:pPr>${o.keepNext ? '<w:keepNext/>' : ''}<w:spacing w:before="0" w:after="${o.after ?? 80}"/>${o.align ? `<w:jc w:val="${o.align}"/>` : ''}${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}</w:pPr>${runs}</w:p>`;
  }

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

    // Thêm cột vào các bảng (giữ độ rộng tổng: cột đầu giữ nguyên, các cột số liệu chia đều phần còn lại)
    ensureColumns(tables, n) {
      tables.forEach(i => {
        const tbl = this.tables[i];
        const grid = tbl && kids(tbl, 'tblGrid')[0];
        if (!grid) return;
        const cols = kids(grid, 'gridCol');
        if (cols.length >= n) return;
        const ws = cols.map(c => +wAttr(c, 'w') || 0);
        const first = ws[0], each = Math.floor(ws.slice(1).reduce((a, b) => a + b, 0) / (n - 1));
        while (kids(grid, 'gridCol').length < n) grid.appendChild(cols[cols.length - 1].cloneNode(true));
        kids(grid, 'gridCol').forEach((c, k) => c.setAttributeNS(W, 'w:w', String(k === 0 ? first : each)));
        kids(tbl, 'tr').forEach(tr => {
          let tcs = kids(tr, 'tc');
          while (tcs.length < n) {
            const clone = tcs[tcs.length - 1].cloneNode(true);
            desc(clone, 't').forEach(t => { t.textContent = ''; });
            tr.appendChild(clone);
            tcs = kids(tr, 'tc');
          }
          tcs.forEach((tc, k) => {
            const pr = kids(tc, 'tcPr')[0], tw = pr && kids(pr, 'tcW')[0];
            if (tw) { tw.setAttributeNS(W, 'w:w', String(k === 0 ? first : each)); tw.setAttributeNS(W, 'w:type', 'dxa'); }
          });
        });
      });
    }

    // Thêm n hàng cuối bảng (sao định dạng hàng cuối, xóa nội dung)
    appendRows(tblIdx, n) {
      const tbl = this.tables[tblIdx];
      const trs = tbl ? kids(tbl, 'tr') : [];
      const last = trs[trs.length - 1];
      if (!last) return;
      for (let i = 0; i < n; i++) {
        const tr = last.cloneNode(true);
        kids(tr, 'tc').forEach(tc => this.setCellText(tc, ''));
        tbl.appendChild(tr);
      }
    }

    // Chèn hàng tiêu đề (sao định dạng hàng đầu tiên) lên đầu bảng
    insertHeaderRow(tblIdx, labels) {
      const tbl = this.tables[tblIdx];
      const first = tbl && kids(tbl, 'tr')[0];
      if (!first) return;
      const tr = first.cloneNode(true);
      kids(tr, 'tc').forEach((tc, k) => this.setCellText(tc, labels[k] || ''));
      let trPr = kids(tr, 'trPr')[0];
      if (!trPr) { trPr = this.doc.createElementNS(W, 'w:trPr'); tr.insertBefore(trPr, tr.firstChild); }
      if (!kids(trPr, 'tblHeader').length) trPr.appendChild(this.doc.createElementNS(W, 'w:tblHeader'));
      tbl.insertBefore(tr, first);
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

    // ---------------------------------------------------------------- phụ lục nối cuối văn bản
    // Ảnh PNG (bytes) → mã quan hệ dùng trong khối { type: 'images' }; file ảnh ghi vào zip khi toBlob()
    addImage(bytes) {
      this.media = this.media || [];
      const n = this.media.length + 1;
      const m = { id: `rIdAppx${n}`, name: `appx_${n}.png`, bytes };
      this.media.push(m);
      return m.id;
    }

    // blocks: { type: 'page' } | { type: 'p', text, bold, size (pt), align, italic } |
    //         { type: 'table', head: [..], rows: [[..]], widths: [twip], size } | { type: 'images', items: [{ png, w, h, caption }], perRow, widthCm }
    // Chèn trước sectPr cuối để giữ khổ giấy, lề của template.
    appendBlocks(blocks) {
      const xml = blocks.map(b => this.blockXml(b)).join('');
      const frag = new DOMParser().parseFromString(`<w:body ${NS_DECL}>${xml}</w:body>`, 'application/xml');
      const sect = kids(this.body, 'sectPr')[0] || null;
      Array.from(frag.documentElement.childNodes).forEach(n => this.body.insertBefore(this.doc.importNode(n, true), sect));
    }

    // Phụ lục trong section riêng: phần biên bản giữ nguyên chân trang của template (vd "Trang x/20" ghi cứng tổng số trang),
    // phụ lục bắt đầu trang mới, đánh số lại từ 1, chân trang sao từ template với tổng số trang của section
    appendSection(blocks) {
      const last = kids(this.body, 'sectPr')[0];
      if (!last) { this.appendBlocks(blocks); return; }
      const p = this.doc.createElementNS(W, 'w:p'), pPr = this.doc.createElementNS(W, 'w:pPr');
      pPr.appendChild(last.cloneNode(true)); p.appendChild(pPr);
      this.body.insertBefore(p, last); // đóng section biên bản
      ['titlePg', 'type', 'pgNumType'].forEach(name => kids(last, name).forEach(n => last.removeChild(n)));
      const pg = this.doc.createElementNS(W, 'w:pgNumType');
      pg.setAttributeNS(W, 'w:start', '1');
      const after = ['cols', 'formProt', 'vAlign', 'noEndnote', 'textDirection', 'bidi', 'rtlGutter', 'docGrid', 'printerSettings'];
      last.insertBefore(pg, Array.from(last.childNodes).find(n => n.nodeType === 1 && after.includes(n.localName)) || null);
      // chân trang mặc định: của section cuối, không khai thì kế thừa từ section gần nhất phía trước có khai
      const defOf = s => kids(s, 'footerReference').find(f => wAttr(f, 'type') === 'default');
      const owner = desc(this.body, 'sectPr').reverse().find(defOf);
      if (owner) {
        this.appxFooter = { from: defOf(owner).getAttributeNS(R_NS, 'id') };
        kids(last, 'footerReference').forEach(f => last.removeChild(f));
        const ref = this.doc.createElementNS(W, 'w:footerReference');
        ref.setAttributeNS(W, 'w:type', 'default');
        ref.setAttributeNS(R_NS, 'r:id', 'rIdAppxFtr');
        const hdrs = kids(last, 'headerReference');
        last.insertBefore(ref, hdrs.length ? hdrs[hdrs.length - 1].nextSibling : last.firstChild);
      }
      this.appendBlocks(blocks[0] && blocks[0].type === 'page' ? blocks.slice(1) : blocks);
    }

    // Chân trang phụ lục: sao chân trang mặc định của template, "/20" ghi cứng → tổng số trang của section
    async writeAppendixFooter() {
      const F = this.appxFooter;
      if (!F) return;
      this.appxFooter = null;
      const relPath = 'word/_rels/document.xml.rels';
      const rels = await this.zip.file(relPath).async('string');
      const m = rels.match(new RegExp(`<Relationship[^>]*Id="${F.from}"[^>]*>`));
      const target = m && (m[0].match(/Target="([^"]+)"/) || [])[1];
      const src = target && this.zip.file('word/' + target.replace(/^\/?word\//, ''));
      if (!src) return;
      const fd = new DOMParser().parseFromString(await src.async('string'), 'application/xml');
      const mk = (rPr, inner) => {
        const r = fd.createElementNS(W, 'w:r');
        if (rPr) r.appendChild(rPr.cloneNode(true));
        r.appendChild(inner);
        return r;
      };
      const fld = (type) => { const e = fd.createElementNS(W, 'w:fldChar'); e.setAttributeNS(W, 'w:fldCharType', type); return e; };
      desc(fd, 't').forEach(t => {
        const run = t.parentNode, rPr = kids(run, 'rPr')[0];
        if (!/^\s*\/\s*\d+\s*$/.test(t.textContent)) return;
        t.textContent = '/';
        const instr = fd.createElementNS(W, 'w:instrText'); instr.setAttributeNS(XML_NS, 'xml:space', 'preserve'); instr.textContent = ' SECTIONPAGES ';
        const val = fd.createElementNS(W, 'w:t'); val.textContent = '1';
        let ref = run.nextSibling;
        [mk(rPr, fld('begin')), mk(rPr, instr), mk(rPr, fld('separate')), mk(rPr, val), mk(rPr, fld('end'))].forEach(r => run.parentNode.insertBefore(r, ref));
      });
      this.zip.file('word/footerAppx.xml', new XMLSerializer().serializeToString(fd));
      const fr = this.zip.file(`word/_rels/${target.split('/').pop()}.rels`);
      if (fr) this.zip.file('word/_rels/footerAppx.xml.rels', await fr.async('string'));
      this.zip.file(relPath, (await this.zip.file(relPath).async('string')).replace('</Relationships>',
        '<Relationship Id="rIdAppxFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footerAppx.xml"/></Relationships>'));
      const ct = await this.zip.file('[Content_Types].xml').async('string');
      this.zip.file('[Content_Types].xml', ct.replace('</Types>', '<Override PartName="/word/footerAppx.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>'));
    }

    blockXml(b) {
      if (b.type === 'page') return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      if (b.type === 'p') return paraXml(b.text, b);
      if (b.type === 'table') {
        const widths = b.widths, sz = (b.size || 10) * 2;
        const cellXml = (t, w, bold) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${paraXml(t, { align: 'center', bold, size: sz / 2, after: 0 })}</w:tc>`;
        const rowXml = (cells, head) => `<w:tr>${head ? '<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>'}${cells.map((t, k) => cellXml(t, widths[k], head)).join('')}</w:tr>`;
        const border = s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`;
        return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a, c) => a + c, 0)}" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="40" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tblCellMar></w:tblPr>`
          + `<w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rowXml(b.head, true)}${b.rows.map(r => rowXml(r, false)).join('')}</w:tbl>${paraXml('', { after: 0 })}`;
      }
      if (b.type === 'images') {
        const per = b.perRow || 1, wCm = b.widthCm || 16, colTw = Math.round(wCm / 2.54 * 1440);
        let out = `<w:tbl><w:tblPr><w:tblW w:w="${colTw * per}" w:type="dxa"/><w:jc w:val="center"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${'<w:gridCol w:w="' + colTw + '"/>'.repeat(per)}</w:tblGrid>`;
        for (let k = 0; k < b.items.length; k += per) {
          const row = b.items.slice(k, k + per);
          while (row.length < per) row.push(null);
          out += `<w:tr><w:trPr><w:cantSplit/></w:trPr>${row.map(it => `<w:tc><w:tcPr><w:tcW w:w="${colTw}" w:type="dxa"/></w:tcPr>${it ? this.imageXml(it, wCm - 0.2) + paraXml(it.caption || '', { align: 'center', size: 10, italic: true, after: 120 }) : paraXml('', {})}</w:tc>`).join('')}</w:tr>`;
        }
        return out + `</w:tbl>${paraXml('', { after: 0 })}`;
      }
      return '';
    }

    imageXml(it, wCm) {
      const rid = this.addImage(it.png);
      this.picId = (this.picId || 5000) + 1;
      const cx = Math.round(wCm * 360000), cy = Math.round(cx * it.h / it.w);
      return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="0"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${this.picId}" name="Phụ lục ${this.picId}"/>`
        + '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        + `<pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="appx.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
        + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    }

    // Ghi ảnh phụ lục: file media, quan hệ, kiểu nội dung png
    async writeMedia() {
      if (!this.media || !this.media.length) return;
      const relPath = 'word/_rels/document.xml.rels';
      const rels = await this.zip.file(relPath).async('string');
      const add = this.media.map(m => `<Relationship Id="${m.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`).join('');
      this.zip.file(relPath, rels.replace('</Relationships>', add + '</Relationships>'));
      this.media.forEach(m => this.zip.file(`word/media/${m.name}`, m.bytes));
      let ct = await this.zip.file('[Content_Types].xml').async('string');
      if (!/Extension="png"/i.test(ct)) ct = ct.replace(/(<Types[^>]*>)/, '$1<Default Extension="png" ContentType="image/png"/>');
      this.zip.file('[Content_Types].xml', ct);
      this.media = [];
    }

    async toBlob() {
      await this.writeMedia();
      await this.writeAppendixFooter();
      const xml = new XMLSerializer().serializeToString(this.doc);
      this.zip.file('word/document.xml', xml);
      return this.zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 }, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    }
  }

  window.DocxTemplate = DocxTemplate;
})();
