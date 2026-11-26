'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const csv = (decimal='point', name='bushing220_B', date='18/03/2026 08:52:36') => {
  const sep=decimal==='point'?',':';', dec=decimal==='point'?'.':',';
  const num=x=>String(x).replace('.',dec);
  return `[DIRANA CSV]\nVersion,Decimal\n2.1,${decimal}\n\n[Test]\nName${sep}Comment\n${name}${sep}""\n\n[Measurements]\nID${sep}Name${sep}Date${sep}Tester${sep}Test Object Serial${sep}Color\n1${sep}${name}${sep}${date}${sep}PC\\User${sep}FAKE-SERIAL${sep}\n\n[FDSData]\nID${sep}Frequency${sep}Tan Delta${sep}Power Factor${sep}c'${sep}c"\n1${sep}10${sep}${num(.2)}${sep}${num(.2)}${sep}1E-12${sep}0\n1${sep}20${sep}${num(.4)}${sep}${num(.4)}${sep}3E-12${sep}0\n1${sep}222.22${sep}${num(.6)}${sep}${num(.6)}${sep}4E-12${sep}0\n1${sep}446.68${sep}${num(.8)}${sep}${num(.8)}${sep}6E-12${sep}0\n1${sep}1000${sep}${num(.9)}${sep}${num(.9)}${sep}8E-12${sep}0`;
};
test('DIRANA đọc point/comma và nhận dạng pha, phía',()=>{
 const c=load(CORE), a=c.Dirana.parse(csv(),'fake.csv'); assert.equal(a.length,1); assert.equal(a[0].phase,'B');assert.equal(a[0].side,'');assert.equal(a[0].c[0],1);
 const b=c.Dirana.parse(csv('comma','bushing35_1_A'),'fake2.csv');assert.equal(b[0].side,'LV1');assert.equal(b[0].phase,'A');assert.equal(b[0].tan[0],.2);
 const r=c.Dirana.parse(csv('point','bushing500_B_lan2'),'fake3.csv');assert.equal(r[0].side,'');assert.equal(r[0].phase,'B');
 const base=csv(), measure='1,bushing220_B,18/03/2026 08:52:36,PC\\User,FAKE-SERIAL,', prefixMeasure=base.replace(measure,`${measure}\n2,bushing500_A,19/03/2026 08:52:36,PC\\User,FAKE-SERIAL,`);
 const dataAt=prefixMeasure.indexOf('[FDSData]'), prefix=prefixMeasure.slice(0,dataAt), tail=prefixMeasure.slice(dataAt).split('\n');
 const multi=prefix+tail.concat(tail.slice(2).filter(x=>x.startsWith('1,')).map(x=>x.replace(/^1,/, '2,'))).join('\n');
 const parsed=c.Dirana.parse(multi,'multi.csv');assert.equal(parsed.length,2);assert.equal(parsed[1].phase,'A');
 assert.throws(()=>c.Dirana.parse('not dirana'),/không phải CSV DIRANA/);assert.throws(()=>c.Dirana.parse('[DIRANA CSV]\nVersion,Decimal\n2.1,point'),/FDSData/);
});
test('DIRANA đọc phiên bản và dấu phân cách tiêu đề Decimal linh hoạt',()=>{
 const c=load(CORE), src=csv('comma').replace('Version,Decimal\n2.1,comma','Version;Decimal\n2.2;comma');
 assert.equal(c.Dirana.parse(src,'v22.csv')[0].tan[0],.2);
});
test('DIRANA gán phía theo thứ hạng điện áp không phụ thuộc ngưỡng cứng',()=>{
 const c=load(CORE), input=[220,110,22].map(n=>({label:String(n),side:''}));
 assert.deepEqual(Array.from(c.Dirana.assignSides(input),x=>x.side),['HV','MV','LV1']);
});
test('DFR thứ tự A/B/C và giữ điểm 10 mHz',()=>{
 const c=load(CORE.concat(['js/ui/types/mba/dfr-chart.js']));
 // canvas giả: ghi chữ và điểm moveTo đầu tiên của từng đường; mọi lệnh vẽ khác bỏ qua
 const events=[], moves=[]; let style='';
 const legendY=[];
 const g=new Proxy({},{get:(o,k)=>k==='measureText'?t=>({width:t.length*12}):k==='fillText'?(t,x,y)=>{events.push(t);if(/^Pha /.test(t))legendY.push(y);}:k==='moveTo'?(x,y)=>moves.push([style,x,y]):k in o?o[k]:()=>{},set:(o,k,v)=>{if(k==='strokeStyle')style=v;o[k]=v;return true;}});
 const cv={getContext:()=>g};
 const ms=['C','B','A'].map(phase=>({phase,f:[0.00999999977648258,.1],tan:[.2,.3],c:[1,1]}));
 c.DfrChart.draw(cv,ms,true);
 assert.ok(events.includes('10m'));
 // chú giải theo thứ tự A, B, C; điểm 10 mHz (0,0099999998 Hz) nằm ở mép trái khung đồ thị, không bị bỏ
 assert.deepEqual(events.filter(t=>/^Pha /.test(t)),['Pha A','Pha B','Pha C']);
 // chú giải nằm ngoài khung đồ thị (trên mép trên khung, không có tiêu đề: khung bắt đầu ở 22 + 40), không đè lên đường đo
 assert.ok(legendY.length===3&&legendY.every(y=>y<62));
 const first=c.DfrChart.COLORS, starts=moves.filter(([s])=>Object.values(first).includes(s)).map(m=>m[0]);
 assert.equal(starts[0],first.A);
 assert.ok(moves.some(([s,x])=>s===first.A&&Math.abs(x-128)<1e-6));
 assert.deepEqual(Array.from(c.Dfr.table(ms.map(m=>Object.assign(m,{side:'HV',use:true}))),r=>r.phase),['A','B','C']);
});
test('DFR phụ lục ghi nhãn sứ và đánh số liên tục phía có biểu đồ',()=>{
 const c=load(CORE), mk=(side,label)=>({side,label,phase:'A',use:true,date:'19/03/2026'});
 const blocks=c.Dfr.appendix({att:{dfr:{items:[mk('HV','500'),mk('LV1','35.1')]}}},{dfrCharts:{HV:{individual:[],overlay:{}},LV1:{individual:[],overlay:{}}}},x=>x,'PL');
 assert.ok(blocks.some(x=>x.type==='table'&&x.rows.some(r=>r[0]==='500')));
 assert.ok(blocks.some(x=>x.text==='II.1 Sứ HV (500)'));
 assert.ok(blocks.some(x=>x.text==='II.2 Sứ LV1 (35.1)'));
});
test('DFR nội suy theo log và chặn ngoài dải',()=>{
 const c=load(CORE), m=c.Dirana.parse(csv())[0]; const mix=(a,b,hz,f0,f1)=>a+Math.log10(hz/f0)/Math.log10(f1/f0)*(b-a);
 assert.ok(Math.abs(c.Dfr.at(m,15).tan-mix(.2,.4,15,10,20))<1e-12);assert.ok(Math.abs(c.Dfr.at(m,400).c-mix(4,6,400,222.22,446.68))<1e-12);
 assert.equal(c.Dfr.at(m,1),null);assert.equal(c.Dfr.at(m,2000),null);
});
test('DFR ưu tiên lần đo muộn và dựng block có bảng hai hàng',()=>{
 const c=load(CORE), old=c.Dirana.parse(csv('point','bushing220_B','01/01/2026'))[0], latest=c.Dirana.parse(csv('point','bushing220_B_lan2','02/01/2026'))[0];
 Object.assign(old,{side:'MV',phase:'B',use:true});Object.assign(latest,{side:'MV',phase:'B',use:true});assert.equal(c.Dfr.table([old,latest])[0].m,latest);
 const blocks=c.Dfr.appendix({att:{dfr:{items:[latest]}}},{dfrCharts:{MV:{individual:[],overlay:null}}},x=>x,'PHỤ LỤC');
 assert.ok(blocks.some(x=>x.text==='Đáp ứng tần số điện môi của sứ đầu vào'));assert.ok(blocks.some(x=>x.type==='table'&&x.rows.length===2));assert.equal(blocks.filter(x=>x.text&&/^II\.\d+/.test(x.text)).length,1);
 const ctx=load(CORE.concat(['js/data/docx.js'])), table=ctx.Dfr.appendix({att:{dfr:{items:[latest]}}},{},x=>x,'PL').find(x=>x.type==='table');
 const xml=Object.create(ctx.DocxTemplate.prototype).blockXml(table), trs=[...xml.matchAll(/<w:tr>(.*?)<\/w:tr>/g)].map(x=>(x[1].match(/<w:tc>/g)||[]).length);
 assert.match(xml,/<w:gridSpan w:val="2"\/>/);assert.match(xml,/<w:vMerge w:val="restart"\/>/);assert.match(xml,/<w:vMerge w:val="continue"\/>/);assert.deepEqual(trs.slice(0,2),[5,8]);assert.ok(trs.slice(2).every(n=>n===8));
});
test('DFR gộp lần nạp: xếp hạng lại phía cho phép đo đã có, giữ chỉnh tay, tự chọn lần đo muộn',()=>{
 const c=load(CORE); let n=0; const id=()=>`id${++n}`;
 const p=(name,date,file='f.csv')=>c.Dirana.parse(csv('point',name,date),file);
 // nạp sứ 220 trước (chưa đủ nhãn để xếp hạng), rồi nạp sứ 500 → sứ 220 thành MV
 let xs=c.Dirana.merge([],p('bushing220_A','01/01/2026'),id);
 xs=c.Dirana.merge(xs,p('bushing500_A','01/01/2026','g.csv'),id);
 assert.deepEqual(xs.map(x=>[x.name,x.side,x.use]),[['bushing220_A','MV',true],['bushing500_A','HV',true]]);
 // đo lại: lần muộn được chọn; lần nạp sau không coi lần bị loại là chọn tay
 xs=c.Dirana.merge(xs,p('bushing500L2_A','02/01/2026','h.csv'),id);
 assert.deepEqual(xs.filter(x=>x.side==='HV').map(x=>[x.name,x.use]),[['bushing500_A',false],['bushing500L2_A',true]]);
 xs=c.Dirana.merge(xs,p('bushing500_A','03/01/2026','k.csv'),id);
 assert.deepEqual(xs.filter(x=>x.use&&x.side==='HV').map(x=>x.file),['k.csv']);
 // chọn tay giữ nguyên khi nạp thêm; phía chỉnh tay không bị xếp hạng lại
 xs.forEach(x=>{if(x.side==='HV'){x.useManual=true;x.use=x.file==='g.csv';}});
 xs[0].side='N'; xs[0].sideManual=true;
 xs=c.Dirana.merge(xs,p('bushing500_A','04/01/2026','m.csv'),id);
 assert.deepEqual(xs.filter(x=>x.use&&x.side==='HV').map(x=>x.file),['g.csv']);
 assert.equal(xs[0].side,'N');
});
test('mọi nút trên trang phụ lục được chuyển tới AppendixUI.action', () => {
  const fs = require('node:fs'), path = require('node:path'), read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const route = read('js/ui/app.js').match(/else if \(act && (.+?)\) await AppendixUI\.action/)[1];
  const routes = new Function('act', `return ${route};`);
  const acts = [...new Set([...read('js/ui/appendix-ui.js').matchAll(/data-act="([A-Za-z]+)"/g)].map(m => m[1]))];
  assert.ok(acts.includes('dfrFiles') && acts.includes('dfrFolder'));
  acts.forEach(a => assert.ok(routes(a), `nút ${a} không tới AppendixUI.action`));
});
