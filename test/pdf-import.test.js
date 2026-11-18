'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load, DOMAIN, ROOT } = require('./harness');

test('đọc dữ liệu PDF BM.01 có tiêu đề tách dòng và bỏ trị số quy đổi', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/pdf-import-basic.json'), 'utf8'));
  fixture.pages[0].find(item => item.str.startsWith('Điện áp định mức')).str = 'Điện áp định mức (Rated voltage): 230/121/10,5 kV';
  fixture.pages.push([
    { str: '8.2 Cuộn HV:LV', x: 40, y: 700, w: 140 },
    { str: 'UAB/Uab', x: 200, y: 670, w: 65 }, { str: 'UBC/Ubc', x: 320, y: 670, w: 65 }, { str: 'UCA/Uca', x: 440, y: 670, w: 65 },
    { str: '10.01', x: 220, y: 640, w: 30 }, { str: '10.02', x: 340, y: 640, w: 30 }, { str: '10.03', x: 460, y: 640, w: 30 },
    { str: '8.3 Cuộn MV:LV', x: 40, y: 600, w: 140 }, { str: 'Nấc', x: 80, y: 570, w: 25 },
    { str: 'UAmBm/Uab', x: 200, y: 570, w: 75 }, { str: 'UBmCm/Ubc', x: 320, y: 570, w: 75 }, { str: 'UCmAm/Uca', x: 440, y: 570, w: 75 },
    { str: '1', x: 90, y: 540, w: 8 }, { str: '5.11', x: 220, y: 540, w: 28 }, { str: '5.12', x: 340, y: 540, w: 28 }, { str: '5.13', x: 460, y: 540, w: 28 },
    { str: '9', x: 90, y: 510, w: 8 }, { str: '5.91', x: 220, y: 510, w: 28 }, { str: '5.92', x: 340, y: 510, w: 28 }, { str: '5.93', x: 460, y: 510, w: 28 },
  ]);
  const ctx = load(DOMAIN);
  const result = ctx.MbaPdfImportReport.read(fixture.pages, fixture.file);
  const v = result.state.v;

  assert.equal(v['meta.vector'], 'YNd11');
  assert.equal(v['nl.lv.ab.u'], '10');
  assert.equal(v['nl.lv.ab.i'], '1.25');
  assert.equal(v['nl.lv.ab.p'], '25.5');
  assert.equal(v['nl.lv.ab.s'], 'A-B');
  assert.equal(v['ir.meas.r0.r15'], '20000');
  assert.equal(v['ir.meas.r0.r60'], '30000');
  assert.equal(v['ir.meas.r0.r600'], '45000');
  assert.equal(v['ir.meas.r0.u'], '5000');
  assert.equal(v['ir.meas.r6.r15'], undefined);
  assert.equal(v['ir.meas.r6.r60'], undefined);
  assert.equal(v['ratio.hm.t1.A'], '5.01');
  assert.equal(v['ratio.hm.t1.B'], '5.00');
  assert.equal(v['ratio.hm.t1.C'], '4.99');
  assert.equal(v['ratio.hl.r.A'], '10.01');
  assert.equal(v['ratio.hl.r.B'], '10.02');
  assert.equal(v['ratio.hl.r.C'], '10.03');
  assert.equal(v['ratio.ml.t1.A'], '5.11');
  assert.equal(v['ratio.ml.t9.B'], '5.92');
  assert.equal(v['bct.hv.ir.w1.A'], '1000');
  assert.equal(v['bct.hv.ir.w1.B'], '1001');
  assert.equal(v['bct.hv.ir.w1.C'], '1002');
  assert.equal(v['bct.visual'], 'Bình thường');
  assert.equal(v['moist.val'], '0.35');
  assert.equal(v['moist.method'], 'FDS giả lập');
  assert.equal(v['oltc.type'], 'Loại OLTC giả');
  assert.equal(v['oltc.serial'], 'OLTC-FAKE');
  assert.equal(result.state.sum.ev.visual, 'Đạt');
  assert.equal(result.state.cfg.oltcWinding, 'MV');
  assert.equal(v['dcr.mv.t1.A'], '350');
  assert.equal(v['dcr.mv.t1.B'], '351');
  assert.equal(v['dcr.mv.t1.C'], '352');
  assert.equal(v['dcr.mv.t9.A'], '415.1');
  assert.equal(v['dcr.mv.t9.B'], '415.7');
  assert.equal(v['dcr.mv.t9.C'], '412.6');
  assert.equal(v['dcr.mv.t19.A'], '300');
  assert.equal(v['dcr.mv.t19.B'], '301');
  assert.equal(v['dcr.mv.t19.C'], '302');
  assert.equal(v['dcr.hv.r.A'], '915.3');
  assert.equal(v['dcr.hv.r.B'], '914.6');
  assert.equal(v['dcr.hv.r.C'], '912');
  assert.equal(v['dcr.lv.r.A'], '8.25');
  assert.equal(v['dcr.lv.r.B'], '8.257');
  assert.equal(v['dcr.lv.r.C'], '8.214');
  assert.ok(result.warnings.includes('R một chiều trong PDF ghi ở 75 °C — kiểm tra đây là giá trị đo hay đã quy đổi'));
});

test('đọc tgδ cuộn dây theo lưới schema và bỏ bảng quy đổi về 20 °C', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/pdf-import-basic.json'), 'utf8'));
  fixture.pages.push([
    { str: '6. Trị số tgδ các cuộn dây (Tgδ of windings)', x: 40, y: 750, w: 360 },
    { str: 'Đo ở nhiệt độ: 30 °C', x: 70, y: 730, w: 180 },
    { str: 'Điện áp đo', x: 420, y: 700, w: 75 },
    { str: 'Đối tượng đo', x: 80, y: 680, w: 150 },
    { str: 'Tgδ (%)', x: 280, y: 680, w: 55 }, { str: 'C (pF)', x: 350, y: 680, w: 55 },
    { str: 'Sơ đồ đo', x: 490, y: 680, w: 65 }, { str: '(kV)', x: 430, y: 665, w: 35 },
    { str: '(Tested terminals)', x: 75, y: 650, w: 150 }, { str: '(%DF)', x: 285, y: 650, w: 50 },
    { str: '(Capacitance)', x: 340, y: 650, w: 75 }, { str: '(Diagram)', x: 485, y: 650, w: 70 },
    { str: '(Test voltage)', x: 415, y: 635, w: 80 },
    { str: 'Cao, Trung ~ Hạ, Vỏ (HV,MV~LV,E)', x: 65, y: 600, w: 200 },
    { str: '0.321', x: 290, y: 600, w: 35 }, { str: '15432.1', x: 355, y: 600, w: 50 },
    { str: '10', x: 435, y: 600, w: 20 }, { str: 'GND', x: 500, y: 600, w: 35 },
    { str: 'Hạ ~ Cao, Trung, Vỏ (LV~HV,MV,E)', x: 65, y: 570, w: 200 },
    { str: 'Hạ ~ Cao, Trung, Vỏ (LV~HV,MV,E)', x: 65, y: 550, w: 200 },
    { str: '0.298', x: 290, y: 550, w: 35 }, { str: '14321.2', x: 355, y: 550, w: 50 },
    { str: '10', x: 435, y: 550, w: 20 }, { str: 'GND', x: 500, y: 550, w: 35 },
    { str: 'Cao, Trung ~ Vỏ (HV,MV~E)', x: 65, y: 530, w: 190 },
    { str: 'Hạ ~ Vỏ (LV~E)', x: 65, y: 510, w: 120 }, { str: '/', x: 290, y: 510, w: 8 },
    { str: 'Trị số tgδ các cuộn dây quy đổi về 20 °C (corrected to 20 °C)', x: 40, y: 480, w: 420 },
    { str: 'Hạ ~ Cao, Trung, Vỏ (LV~HV,MV,E)', x: 65, y: 450, w: 200 },
    { str: '0.111', x: 290, y: 450, w: 35 }, { str: '14321.2', x: 355, y: 450, w: 50 },
    { str: '10', x: 435, y: 450, w: 20 }, { str: 'GND', x: 500, y: 450, w: 35 },
  ]);
  const ctx = load(DOMAIN);
  const result = ctx.MbaPdfImportReport.read(fixture.pages, fixture.file);
  const v = result.state.v;
  assert.equal(v['wtgd.t'], '30');
  assert.equal(v['wtgd.meas.r0.tgd'], '0.321');
  assert.equal(v['wtgd.meas.r0.c'], '15432.1');
  assert.equal(v['wtgd.meas.r0.u'], '10');
  assert.equal(v['wtgd.meas.r0.d'], 'GND');
  assert.equal(v['wtgd.meas.r1.tgd'], '0.298');
  assert.equal(v['wtgd.meas.r1.c'], '14321.2');
  assert.equal(v['wtgd.meas.r1.u'], '10');
  assert.equal(v['wtgd.meas.r1.d'], 'GND');
  assert.equal(v['wtgd.meas.r4.tgd'], undefined);
  assert.equal(v['wtgd.meas.r5.tgd'], undefined);
});

test('nhận diện bảng nấc cao áp và giữ khóa theo schema OLTC cao áp', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/pdf-import-basic.json'), 'utf8'));
  const dcrPage = fixture.pages.find(page => page.some(item => item.str.startsWith('7.1 Cuộn dây Trung thế')));
  const title = dcrPage.find(item => item.str.startsWith('7.1 Cuộn dây Trung thế'));
  title.str = '7.1 Cuộn dây cao thế (H.V Winding)';
  for (const item of dcrPage) {
    if (item.str === 'AmN') item.str = 'AN';
    if (item.str === 'BmN') item.str = 'BN';
    if (item.str === 'CmN') item.str = 'CN';
  }
  const ctx = load(DOMAIN);
  const result = ctx.MbaPdfImportReport.read(fixture.pages, fixture.file);
  assert.equal(result.state.cfg.oltcWinding, 'HV');
  assert.equal(result.state.v['dcr.hv.t9.A'], '415.1');
  assert.equal(result.state.v['dcr.hv.t9.B'], '415.7');
  assert.equal(result.state.v['dcr.hv.t9.C'], '412.6');
});

test('cảnh báo và ưu tiên cột pha khi nhãn Việt/Anh cuộn OLTC mâu thuẫn', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/pdf-import-basic.json'), 'utf8'));
  const dcrPage = fixture.pages.find(page => page.some(item => item.str.startsWith('7.1 Cuộn dây Trung thế')));
  dcrPage.find(item => item.str.startsWith('7.1 Cuộn dây Trung thế')).str = '7.1 Cuộn dây trung áp (H.V Winding)';
  fixture.pages[0].find(item => item.str.startsWith('Điện áp định mức')).str = 'Điện áp định mức (Rated voltage): 230/121/10,5 kV';
  for (const item of dcrPage) {
    if (item.str === 'AmN') item.str = 'AN';
    if (item.str === 'BmN') item.str = 'BN';
    if (item.str === 'CmN') item.str = 'CN';
  }
  const ctx = load(DOMAIN);
  const result = ctx.MbaPdfImportReport.read(fixture.pages, fixture.file);
  assert.equal(result.state.cfg.oltcWinding, 'MV');
  assert.equal(result.state.v['dcr.mv.t1.A'], '350');
  assert.equal(result.state.v['dcr.mv.t9.B'], '415.7');
  assert.equal(result.state.v['dcr.mv.t19.C'], '302');
  assert.equal(result.state.v['dcr.hv.t9.B'], undefined);
  assert.ok(result.warnings.some(w => w.includes('đã nhận là cuộn trung áp; kiểm tra lại')));
});
