/* =========================================================================
   EXPORT EXCEL (.xlsx) — รูปแบบตาม "Record of Processing Activities (ROPA).xlsx"
   เขียน OOXML/ZIP เองแบบ offline (ไม่พึ่ง library ภายนอก) — ported verbatim
   ========================================================================= */
import { esc } from "./util";

const _enc = new TextEncoder();
function _u8(s){ return _enc.encode(s); }
const _crcTab = (()=>{ const t=[]; for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[n]=c>>>0; } return t; })();
function _crc32(b){ let c=0xFFFFFFFF; for(let i=0;i<b.length;i++) c=_crcTab[(c^b[i])&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
function _zip(files){ // files: [{name, data:Uint8Array}] — STORE (no compression)
  const parts=[],cdir=[]; let off=0; const DT=0,DD=0x21;
  const put=a=>{parts.push(a);off+=a.length;};
  files.forEach(f=>{
    const nm=_u8(f.name),data=f.data,crc=_crc32(data),lo=off;
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0,true);lh.setUint16(8,0,true);
    lh.setUint16(10,DT,true);lh.setUint16(12,DD,true);lh.setUint32(14,crc,true);
    lh.setUint32(18,data.length,true);lh.setUint32(22,data.length,true);
    lh.setUint16(26,nm.length,true);lh.setUint16(28,0,true);
    put(new Uint8Array(lh.buffer));put(nm);put(data);
    const cd=new DataView(new ArrayBuffer(46));
    cd.setUint32(0,0x02014b50,true);cd.setUint16(4,20,true);cd.setUint16(6,20,true);cd.setUint16(8,0,true);
    cd.setUint16(10,0,true);cd.setUint16(12,DT,true);cd.setUint16(14,DD,true);cd.setUint32(16,crc,true);
    cd.setUint32(20,data.length,true);cd.setUint32(24,data.length,true);cd.setUint16(28,nm.length,true);
    cd.setUint16(30,0,true);cd.setUint16(32,0,true);cd.setUint16(34,0,true);cd.setUint16(36,0,true);
    cd.setUint32(38,0,true);cd.setUint32(42,lo,true);
    cdir.push({h:new Uint8Array(cd.buffer),nm});
  });
  const cs=off; let csz=0;
  cdir.forEach(c=>{put(c.h);put(c.nm);csz+=c.h.length+c.nm.length;});
  const eo=new DataView(new ArrayBuffer(22));
  eo.setUint32(0,0x06054b50,true);eo.setUint16(8,files.length,true);eo.setUint16(10,files.length,true);
  eo.setUint32(12,csz,true);eo.setUint32(16,cs,true);put(new Uint8Array(eo.buffer));
  const tot=parts.reduce((a,c)=>a+c.length,0),out=new Uint8Array(tot); let p=0;
  parts.forEach(c=>{out.set(c,p);p+=c.length;}); return out;
}
function _colL(n){ let s=''; n++; while(n>0){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); } return s; }
function _xlJoin(v){ return Array.isArray(v)? v.filter(x=>x!=null&&String(x).trim()!=='').join('\n') : (v==null?'':String(v)); }
function _xlAct(r){ return r.s1?.activity==='อื่นๆ' ? (r.s1?.activityOther||'อื่นๆ') : (r.s1?.activity||''); }
function _xlS6(r,field){
  const it=(r.s6&&Array.isArray(r.s6.items))?r.s6.items:[];
  if(r.s6?.store!=='มีการจัดเก็บ'||!it.length) return '';
  if(field==='period')   return it.map(x=>`${x.type||'-'}: ${x.trigger||'-'} / ${x.period||'-'}`).join('\n');
  if(field==='legalKeep')return it.map(x=>x.legalKeep).filter(Boolean).join('\n');
  if(field==='physical'){const s=new Set();it.forEach(x=>(x.physical||[]).forEach(y=>s.add(y)));return [...s].join('\n');}
  if(field==='technical'){const s=new Set();it.forEach(x=>(x.technical||[]).forEach(y=>s.add(y)));return [...s].join('\n');}
  return '';
}
function _xlS3(r,field){
  const it=(r.s3&&Array.isArray(r.s3.items))?r.s3.items:[];
  if(r.s3?.share!=='มีการแบ่งปัน'||!it.length) return '';
  if(field==='org')     return it.map(x=>x.org).filter(Boolean).join('\n');
  if(field==='purpose') return it.map(x=>x.org?(x.org+': '+(x.purpose||'-')):(x.purpose||'')).filter(Boolean).join('\n');
  if(field==='general'||field==='sensitive'||field==='lawful'||field==='lawfulSens'){const s=new Set();it.forEach(x=>(x[field]||[]).forEach(y=>s.add(y)));return [...s].join('\n');}
  return '';
}
function _xlS4(r,field){
  const it=(r.s4&&Array.isArray(r.s4.items))?r.s4.items:[];
  if(r.s4?.disclose!=='มีการเปิดเผย'||!it.length) return '';
  if(field==='recipient')       return it.map(x=>x.recipient).filter(Boolean).join('\n');
  if(field==='recipientDetail') return it.map(x=>x.recipientDetail).filter(Boolean).join('\n');
  if(field==='status')          return it.map(x=>x.status).filter(Boolean).join('\n');
  if(field==='purpose')         return it.map(x=>x.recipient?(x.recipient+': '+(x.purpose||'-')):(x.purpose||'')).filter(Boolean).join('\n');
  if(field==='contract')        return it.map(x=>x.recipient?(x.recipient+': '+(x.contract||'-')):(x.contract||'')).filter(Boolean).join('\n');
  return '';
}
function _ropaCols(){
  const G0='การระบุกิจกรรมการประมวลผล',G1='การเก็บรวบรวมข้อมูลส่วนบุคคล',G2='การใช้ข้อมูลส่วนบุคคล',
        G3='การเปิดเผยข้อมูลส่วนบุคคล (Disclosure)',G4='การโอนข้อมูลไปต่างประเทศ (Cross-border)',
        G5='การเก็บรักษาข้อมูลส่วนบุคคล (Retention)',G6='สิทธิและวิธีการเข้าถึง (Accessibility)';
  const on5=r=>r.s5?.transfer==='มีการส่งออกนอกประเทศ';
  return [
   {g:G0,h:'หน้าที่ [Business Function]',f:r=>r.s1?.org},
   {g:G0,h:'วัตถุประสงค์หรือกิจกรรมการประมวลผล (Data Processing Purpose / Activities)',f:r=>_xlAct(r)},
   {g:G0,h:'ผู้มีหน้าที่รับผิดชอบประมวลผลข้อมูล (Role responsible)',f:r=>r.s1?.responsible},
   {g:G0,h:'รูปแบบการบันทึก (Types of records)',f:r=>_xlJoin(r.s1?.recordFormat)},
   {g:G0,h:'ประเภทเจ้าของข้อมูลส่วนบุคคล (Types of individuals)',f:r=>_xlJoin(r.s1?.dataSubject)},
   {g:G0,h:'ผู้เยาว์/คนไร้/เสมือนไร้ความสามารถ — ประเภทบุคคล (Type)',f:r=>r.s1?.special},
   {g:G0,h:'Consent (y/n/na)',f:r=>r.s1?.consent},
   {g:G1,h:'ข้อมูลส่วนบุคคล (ม.39(1)) — ทั่วไป (General)',f:r=>_xlJoin(r.s2?.general)},
   {g:G1,h:'ข้อมูลส่วนบุคคล — อ่อนไหว (Sensitive)',f:r=>_xlJoin(r.s2?.sensitive)},
   {g:G1,h:'แหล่งที่มาของข้อมูล (Source)',f:r=>_xlJoin(r.s2?.source)},
   {g:G1,h:'Update of personal data',f:r=>''},
   {g:G1,h:'Existence of automated decision-making / profiling',f:r=>''},
   {g:G1,h:'วัตถุประสงค์ของการเก็บรวบรวม (ม.39(2))',f:r=>r.s2?.purpose},
   {g:G1,h:'ฐานทางกฎหมายสำหรับการประมวลผล (ม.39(6))',f:r=>_xlJoin(r.s2?.lawful)},
   {g:G1,h:'กรณีฐานประโยชน์โดยชอบ มีการประเมิน/เอกสารหรือไม่',f:r=>''},
   {g:G1,h:'ฐานทางกฎหมายสำหรับข้อมูลอ่อนไหว',f:r=>_xlJoin(r.s2?.lawfulSens)},
   {g:G2,h:'แผนก/ส่วนงานที่ใช้ข้อมูล (Internal department)',f:r=>_xlS3(r,'org')},
   {g:G2,h:'วัตถุประสงค์/กิจกรรมของการใช้ข้อมูล (Purpose of Use)',f:r=>_xlS3(r,'purpose')},
   {g:G2,h:'ข้อมูลที่ใช้ — ทั่วไป (General)',f:r=>_xlS3(r,'general')},
   {g:G2,h:'ข้อมูลที่ใช้ — อ่อนไหว (Sensitive)',f:r=>_xlS3(r,'sensitive')},
   {g:G2,h:'Existence of automated decision-making / profiling',f:r=>''},
   {g:G2,h:'ฐานทางกฎหมายสำหรับการประมวลผล (usage)',f:r=>_xlS3(r,'lawful')},
   {g:G2,h:'กรณีฐานประโยชน์โดยชอบ มีการประเมิน/เอกสารหรือไม่',f:r=>''},
   {g:G2,h:'ฐานทางกฎหมายข้อมูลอ่อนไหว (usage)',f:r=>_xlS3(r,'lawfulSens')},
   {g:G3,h:'บุคคลภายนอกผู้รับข้อมูล (Recipients)',f:r=>_xlS4(r,'recipient')},
   {g:G3,h:'รายละเอียดผู้รับข้อมูล (Recipients Details)',f:r=>_xlS4(r,'recipientDetail')},
   {g:G3,h:'สถานะของผู้รับข้อมูล (controller/processor/joint)',f:r=>_xlS4(r,'status')},
   {g:G3,h:'วัตถุประสงค์ของการเปิดเผย — รายละเอียดกิจกรรม',f:r=>_xlS4(r,'purpose')},
   {g:G3,h:'สัญญาที่ทำกับผู้รับข้อมูล [Contractual (y/n/na)]',f:r=>_xlS4(r,'contract')},
   {g:G3,h:'หน้าที่ตามกฎหมายหากผู้รับเป็นหน่วยงานรัฐ (ระบุกฎหมาย)',f:r=>''},
   {g:G4,h:'Third countries / territories / international organisations',f:r=>on5(r)?(r.s5?.country||''):''},
   {g:G4,h:'Details of Company/international organizations',f:r=>on5(r)?(r.s5?.company||''):''},
   {g:G4,h:'Transfer mechanism',f:r=>on5(r)?_xlJoin(r.s5?.safeguard):''},
   {g:G4,h:'Purpose/Activities for Cross-border transfer',f:r=>on5(r)?(r.s5?.purpose||''):''},
   {g:G4,h:'Existence of automated decision-making / profiling',f:r=>''},
   {g:G5,h:'ระยะเวลาเก็บรักษาข้อมูล (Retention period) ม.39(4)',f:r=>_xlS6(r,'period')},
   {g:G5,h:'การเก็บรักษาตามที่กฎหมายกำหนด (ระบุกฎหมาย)',f:r=>_xlS6(r,'legalKeep')},
   {g:G5,h:'มาตรการทางกายภาพในการรักษาความปลอดภัย',f:r=>_xlS6(r,'physical')},
   {g:G5,h:'มาตรการทางเทคนิคและการบริหารจัดการ',f:r=>_xlS6(r,'technical')},
   {g:G6,h:'บุคคลหรือหน่วยงานที่มีสิทธิเข้าถึง (Authorized access)',f:r=>r.s7?.who},
   {g:G6,h:'เงื่อนไขเกี่ยวกับบุคคลที่มีสิทธิเข้าถึง',f:r=>_xlJoin(r.s7?.condition)},
   {g:G6,h:'วิธีการเข้าถึงข้อมูลส่วนบุคคล (Methods of access)',f:r=>_xlJoin(r.s7?.method)},
  ];
}
function _xlCell(ci,row,text,style){
  const ref=_colL(ci)+row;
  if(text==null||text==='') return `<c r="${ref}" s="${style}"/>`;
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
}
function _sheetXml(cols,recs){
  const groups=[]; let i=0;
  while(i<cols.length){ let j=i; while(j+1<cols.length&&cols[j+1].g===cols[i].g) j++; groups.push([i,j]); i=j+1; }
  const merges=groups.filter(([a,b])=>b>a).map(([a,b])=>`${_colL(a)}1:${_colL(b)}1`);
  const starts=new Set(groups.map(([a])=>a));
  let r1='',r2='';
  cols.forEach((c,ci)=>{ r1+=_xlCell(ci,1,starts.has(ci)?c.g:'',1); r2+=_xlCell(ci,2,c.h,2); });
  let body=`<row r="1">${r1}</row><row r="2">${r2}</row>`;
  recs.forEach((r,ri)=>{ let cells=''; cols.forEach((c,ci)=>{ let v=c.f(r); v=(v==null?'':String(v)); cells+=_xlCell(ci,ri+3,v,3); }); body+=`<row r="${ri+3}">${cells}</row>`; });
  const colW='<cols>'+cols.map((c,i)=>`<col min="${i+1}" max="${i+1}" width="28" customWidth="1"/>`).join('')+'</cols>';
  const mc=merges.length?`<mergeCells count="${merges.length}">`+merges.map(m=>`<mergeCell ref="${m}"/>`).join('')+'</mergeCells>':'';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${colW}<sheetData>${body}</sheetData>${mc}</worksheet>`;
}
const _XL_CT='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
const _XL_RELS='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
const _XL_WB='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="ROPA#Department" sheetId="1" r:id="rId1"/></sheets></workbook>';
const _XL_WBR='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
const _XL_STY='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Tahoma"/></font><font><b/><sz val="11"/><name val="Tahoma"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF3FB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFB0B8C4"/></left><right style="thin"><color rgb="FFB0B8C4"/></right><top style="thin"><color rgb="FFB0B8C4"/></top><bottom style="thin"><color rgb="FFB0B8C4"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
export function buildRopaXlsx(recs){
  const sheet=_sheetXml(_ropaCols(),recs);
  return _zip([
    {name:'[Content_Types].xml',data:_u8(_XL_CT)},
    {name:'_rels/.rels',data:_u8(_XL_RELS)},
    {name:'xl/workbook.xml',data:_u8(_XL_WB)},
    {name:'xl/_rels/workbook.xml.rels',data:_u8(_XL_WBR)},
    {name:'xl/styles.xml',data:_u8(_XL_STY)},
    {name:'xl/worksheets/sheet1.xml',data:_u8(sheet)},
  ]);
}
