/* =========================================================================
   DATA MAPPING DIAGRAM (โครงสร้างตาม DataMapping.vsd) — ported verbatim
   ========================================================================= */
import { esc, actName } from "./util";

function dmArr(v){ return Array.isArray(v)?v.filter(x=>x!=null&&x.toString().trim()):[]; }
function dmTxt(v){ return v==null?'':v.toString().trim(); }
let _segW=null,_segG=null;
function _segments(s,gran){
  try{
    if(typeof Intl!=='undefined' && Intl.Segmenter){
      const seg = gran==='grapheme' ? (_segG||(_segG=new Intl.Segmenter('th',{granularity:'grapheme'})))
                                    : (_segW||(_segW=new Intl.Segmenter('th',{granularity:'word'})));
      return Array.from(seg.segment(s), x=>x.segment);
    }
  }catch(e){}
  return null;
}
function dmWrap(s,n){
  s=dmTxt(s); if(!s) return [''];
  const words=_segments(s,'word') || s.split(/(\s+)/);
  const out=[]; let line='';
  for(let w of words){
    while(w.length>n){
      const gr=_segments(w,'grapheme')||w.split('');
      let part='';
      for(const g of gr){ if((part+g).length>n) break; part+=g; }
      if(!part){ part=w.slice(0,n); }
      if(line){ out.push(line.replace(/\s+$/,'')); line=''; }
      out.push(part); w=w.slice(part.length);
    }
    if((line+w).length>n){ if(line.trim())out.push(line.replace(/\s+$/,'')); line=w.replace(/^\s+/,''); }
    else line+=w;
  }
  if(line.trim()) out.push(line.replace(/\s+$/,''));
  return out.length?out:[''];
}
function dmNode(role,title,items,w){
  w=w||(role==='hub'?210:role==='src'?210:200);
  const tFont=role==='hub'?15:13.5;
  const cMax=Math.max(8,Math.floor((w-22)/7));
  const tMax=Math.max(8,Math.floor((w-22)/(tFont*0.56)));
  const tLines=[]; String(title).split('\n').forEach(seg=> dmWrap(seg,tMax).forEach(l=>tLines.push(l)));
  const cLines=[];
  if(items&&items.length){
    const MAX=12, show=items.slice(0,MAX);
    show.forEach(it=>{ dmWrap(it,Math.max(6,cMax-2)).forEach((l,i)=>cLines.push(i?'   '+l:'• '+l)); });
    if(items.length>MAX) cLines.push('• …และอีก '+(items.length-MAX)+' รายการ');
  }
  const th=tLines.length*19, ch=cLines.length*16;
  const h=10+th+(cLines.length?6+ch:0)+10;
  return {role,w,h,tLines,cLines,tFont,x:0,y:0};
}
function dmDraw(n){
  const x=n.x,y=n.y,w=n.w,h=n.h;
  const fill='#ffffff';
  const stroke=n.role==='hub'?'#222222':'#555555';
  const sw=n.role==='hub'?1.6:1.1;
  const rx=n.role==='src'?12:3;
  const shape='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+rx+'" ry="'+rx+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'"/>';
  const tx=x+w/2; let ty=y+10+n.tFont*0.9;
  let t='<text x="'+tx+'" y="'+ty+'" text-anchor="middle" font-weight="700" font-size="'+n.tFont+'" fill="#111111">';
  n.tLines.forEach((l,i)=> t+='<tspan x="'+tx+'" '+(i?'dy="19"':'')+'>'+esc(l)+'</tspan>');
  t+='</text>';
  let c='';
  if(n.cLines.length){
    const cy=ty+(n.tLines.length-1)*19+18;
    c='<text x="'+(x+12)+'" y="'+cy+'" font-size="12.5" fill="#222222">';
    n.cLines.forEach((l,i)=> c+='<tspan x="'+(x+12)+'" '+(i?'dy="16"':'')+'>'+esc(l)+'</tspan>');
    c+='</text>';
  }
  return shape+t+c;
}
function dmH(a,b){ const x1=a.x+a.w,y1=a.y+a.h/2,x2=b.x,y2=b.y+b.h/2,mx=(x1+x2)/2;
  return '<path d="M '+x1+' '+y1+' H '+mx+' V '+y2+' H '+x2+'" fill="none" stroke="#4677bf" stroke-width="1.6" marker-end="url(#dmArrow)"/>'; }
function dmDownArr(a,b){ const x1=a.x+a.w/2,y1=a.y+a.h,x2=b.x+b.w/2,y2=b.y,my=(y1+y2)/2;
  return '<path d="M '+x1+' '+y1+' V '+my+' H '+x2+' V '+y2+'" fill="none" stroke="#4677bf" stroke-width="1.4" marker-end="url(#dmArrow)"/>'; }
function dmRawLine(x1,y1,x2){ return '<path d="M '+x1+' '+y1+' H '+x2+'" fill="none" stroke="#4677bf" stroke-width="1.6"/>'; }
function dmVArr(x,y1,y2){ return '<path d="M '+x+' '+y1+' V '+y2+'" fill="none" stroke="#4677bf" stroke-width="1.4" marker-end="url(#dmArrow)"/>'; }
function dmNoteEl(x,y,text){
  // caption สีแดงเป็น label บรรทัดเดียว — wrap กว้าง (80) กันตัดคำกลางประโยค
  const lines=dmWrap(text,80); let t='<text x="'+x+'" y="'+y+'" font-size="11" fill="#c0392b">';
  lines.forEach((l,i)=> t+='<tspan x="'+x+'" '+(i?'dy="13"':'')+'>'+esc(l)+'</tspan>');
  t+='</text>';
  // ประเมินขอบเขตเพื่อให้เฟรมขยายคลุม (กันข้อความล้นขอบ/ทับกล่อง)
  const tw=Math.max.apply(null, lines.map(l=>l.length))*6.4;
  return { svg:t, r:x+tw, b:y+(lines.length-1)*13+4 };
}
function dmGrid(items,x0,y0,w,maxCols,role){
  const gap=14, ns=items.map(it=>dmNode(role,it,null,w));
  let i=0,y=y0,maxRight=x0,bottom=y0;
  while(i<ns.length){
    const row=ns.slice(i,i+maxCols), rowH=Math.max.apply(null,row.map(n=>n.h));
    row.forEach((n,j)=>{ n.x=x0+j*(w+gap); n.y=y; maxRight=Math.max(maxRight,n.x+n.w); });
    bottom=y+rowH; y=bottom+gap; i+=maxCols;
  }
  return {nodes:ns,bottom:bottom,right:maxRight,cx:(x0+maxRight)/2};
}
export function buildMapSVG(r){
  r=r||{}; const s1=r.s1||{},s2=r.s2||{},s3=r.s3||{},s4=r.s4||{},s5=r.s5||{},s6=r.s6||{};
  const activity=actName(r), owner=dmTxt(s1.org);
  const sources=dmArr(s2.source), formats=dmArr(s1.recordFormat);
  const shareOn=s3.share==='มีการแบ่งปัน', usageOrgs=(Array.isArray(s3.items)?s3.items.map(it=>it&&it.org):[]).filter(o=>o!=null&&String(o).trim()!=='');
  const discloseOn=s4.disclose==='มีการเปิดเผย';
  const recipients=(Array.isArray(s4.items)?s4.items.map(it=>it&&it.recipient):[]).filter(o=>o!=null&&String(o).trim()!=='');
  const transferOn=s5.transfer==='มีการส่งออกนอกประเทศ', country=dmTxt(s5.country), tco=dmTxt(s5.company);
  const storeOn=s6.store==='มีการจัดเก็บ';

  const missing=[];
  if(!owner) missing.push('ฝ่าย/ส่วน (1.1)');
  if(!dmTxt(s1.activity)) missing.push('กิจกรรม (1.2)');
  if(!sources.length) missing.push('แหล่งที่มา (2.3)');
  if(!formats.length) missing.push('รูปแบบการบันทึก (1.5)');

  const N=[],C=[],NOTE=[];
  const PAD=30, TITLEH=92, CW=160, MAXCOL=3;
  const more=(arr,cap)=> arr.length>cap ? arr.slice(0,cap).concat(['…และอีก '+(arr.length-cap)+' รายการ']) : arr.slice();
  const ent=dmNode('hub','Entities\nฝ่าย / ส่วนงาน',[owner||'(ยังไม่ระบุฝ่าย/ส่วน)'],210);
  ent.x=320; ent.y=TITLEH+150; const trunkY=ent.y+ent.h/2;
  if(sources.length){
    const srcNodes=sources.map(s=>dmNode('src',s,null,210));
    const gap=16, totalH=srcNodes.reduce((a,n)=>a+n.h,0)+gap*(srcNodes.length-1);
    let ly=trunkY-totalH/2; if(ly<TITLEH+20) ly=TITLEH+20;
    srcNodes.forEach(n=>{ n.x=PAD; n.y=ly; ly+=n.h+gap; C.push(dmH(n,ent)); N.push(n); });
    NOTE.push(dmNoteEl(PAD, srcNodes[0].y-10, 'เมนู แหล่งที่มาของข้อมูล'));
  }
  N.push(ent);
  NOTE.push(dmNoteEl(ent.x, ent.y-12, 'เมนู ผู้อำนวยการ / ฝ่ายงาน / ส่วนงาน'));
  NOTE.push(dmNoteEl(ent.x, ent.y+ent.h+30, 'เมนู ระยะเวลาในการเก็บรักษาข้อมูล → ประเภทการเก็บรักษา'));
  const fmtItems = formats.length?more(formats,5):['(ยังไม่ระบุ)'];
  const fmtGrid=dmGrid(fmtItems, ent.x, ent.y+ent.h+54, 160, fmtItems.length, 'box');
  fmtGrid.nodes.forEach(n=>{ N.push(n); C.push(dmDownArr(ent,n)); });
  const retY = Math.max.apply(null, fmtGrid.nodes.map(n=>n.y+n.h)) + 50;
  const s6items = (storeOn && Array.isArray(s6.items)) ? s6.items.filter(it=>it&&(dmTxt(it.type)||dmTxt(it.trigger)||dmTxt(it.period))) : [];
  if(s6items.length){
    const gap=14, w=160, shown=s6items.slice(0,5);
    shown.forEach((it,j)=>{
      const ttl='การเก็บรักษา\n'+(dmTxt(it.type)||'(ไม่ระบุประเภท)');
      const rb=dmNode('box',ttl,[(dmTxt(it.trigger)||'(ไม่ระบุ trigger)'),'เก็บ '+(dmTxt(it.period)||'(ไม่ระบุ)')],w);
      rb.x=ent.x+j*(w+gap); rb.y=retY; N.push(rb); C.push(dmDownArr(fmtGrid.nodes[j]||ent,rb));
    });
    if(s6items.length>5){ const mb=dmNode('box','การเก็บรักษา',['…และอีก '+(s6items.length-5)+' ประเภท'],w); mb.x=ent.x+5*(w+gap); mb.y=retY; N.push(mb); C.push(dmDownArr(ent,mb)); }
  } else {
    const rb=dmNode('box','การเก็บรักษา',['ไม่มีการจัดเก็บ'],160); rb.x=ent.x; rb.y=retY; N.push(rb); C.push(dmDownArr(fmtGrid.nodes[0]||ent,rb));
  }
  NOTE.push(dmNoteEl(ent.x, retY-12, '→ แต่ละประเภท: เริ่มนับจากระยะเวลา → ระยะเวลาที่เก็บรักษา'));
  let use=null,dis=null,trx=null;
  const USE_X=Math.max(940, fmtGrid.right+70);
  if(shareOn||usageOrgs.length){
    use=dmNode('hub','Usage\nการใช้ข้อมูล (ภายใน)',null,200); use.x=USE_X; use.y=trunkY+64; N.push(use);
    const g=dmGrid(usageOrgs.length?more(usageOrgs,6):['(ยังไม่ระบุฝ่ายงาน)'], use.x, use.y+use.h+50, CW, MAXCOL, 'child');
    g.nodes.forEach(n=>{ N.push(n); C.push(dmDownArr(use,n)); }); use._g=g;
    NOTE.push(dmNoteEl(use.x, use.y-12, 'เมนู การใช้ข้อมูล → ผู้อำนวยการ / ฝ่ายงาน / ส่วนงาน'));
  }
  const DIS_X=(use?use._g.right:USE_X)+90;
  if(discloseOn||recipients.length){
    dis=dmNode('hub','Disclosure\nการเปิดเผยข้อมูล (ภายนอก)',null,220); dis.x=DIS_X; dis.y=trunkY+84; N.push(dis);
    const g=dmGrid(recipients.length?more(recipients,6):['(ยังไม่ระบุผู้รับ)'], dis.x, dis.y+dis.h+50, 175, MAXCOL, 'child');
    g.nodes.forEach(n=>{ N.push(n); C.push(dmDownArr(dis,n)); });
    NOTE.push(dmNoteEl(dis.x, dis.y-12, 'เมนู การเปิดเผยข้อมูลส่วนบุคคล'));
  }
  if(transferOn){ trx=dmNode('hub','Transfer\nการโอนข้อมูลไปต่างประเทศ',[country?('ประเทศ: '+country):'',tco?('ผู้รับ: '+tco):''].filter(Boolean),220); trx.x=DIS_X; trx.y=TITLEH+18; N.push(trx); }
  if(use||dis||trx){
    const aim=(dis||trx);
    const endX = aim ? (aim.x+aim.w/2) : (use.x+use.w);
    C.push(dmRawLine(ent.x+ent.w, trunkY, endX));
    if(use) C.push(dmVArr(use.x+use.w/2, trunkY, use.y));
    if(dis) C.push(dmVArr(dis.x+dis.w/2, trunkY, dis.y));
    if(trx) C.push(dmVArr(trx.x+trx.w/2, trunkY, trx.y+trx.h));
  }
  let maxB=0,maxR=0; N.forEach(n=>{ maxB=Math.max(maxB,n.y+n.h); maxR=Math.max(maxR,n.x+n.w); });
  NOTE.forEach(o=>{ maxB=Math.max(maxB,o.b); maxR=Math.max(maxR,o.r); });
  const contentW=Math.max(maxR+PAD,1280), contentH=maxB+PAD, RATIO=16/9;
  let frameW,frameH,offX=0;
  if(contentW/contentH>=RATIO){ frameW=contentW; frameH=Math.round(contentW/RATIO); }
  else { frameH=contentH; frameW=Math.round(contentH*RATIO); offX=Math.round((frameW-contentW)/2); }
  const vbX=-offX;
  const defs='<defs><marker id="dmArrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 z" fill="#4677bf"/></marker></defs>';
  const title='<text x="'+PAD+'" y="46" font-size="26" font-weight="800" fill="#111111">Data Mapping</text>'
    +'<text x="'+PAD+'" y="74" font-size="15" fill="#222222">ชื่อกิจกรรม: '+esc(activity||'-')+'   ·   บริษัท: '+esc(r.company||'-')+'</text>';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+frameW+'" height="'+frameH+'" viewBox="'+vbX+' 0 '+frameW+' '+frameH
    +'" font-family="Sarabun, Tahoma, \'Leelawadee UI\', sans-serif">'
    +'<rect x="'+vbX+'" y="0" width="'+frameW+'" height="'+frameH+'" fill="#ffffff"/>'+defs+title
    +C.join('')+N.map(dmDraw).join('')+NOTE.map(o=>o.svg).join('')+'</svg>';
  return {svg,width:frameW,height:frameH,missing};
}

/* ---- export helpers (PNG / PDF / print) ---- */
function _mapToCanvas(svg,w,h,scale){
  return new Promise((resolve,reject)=>{
    const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
    const url=URL.createObjectURL(blob); const img=new Image();
    img.onload=function(){
      const cv=document.createElement('canvas'); cv.width=Math.round(w*scale); cv.height=Math.round(h*scale);
      const ctx=cv.getContext('2d'); ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,cv.width,cv.height);
      ctx.setTransform(scale,0,0,scale,0,0); ctx.drawImage(img,0,0);
      URL.revokeObjectURL(url); resolve(cv);
    };
    img.onerror=function(){ URL.revokeObjectURL(url); reject(new Error('img error')); };
    img.src=url;
  });
}
function _dl(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},150); }

export async function downloadMapPNG(svg,w,h,name){
  const cv=await _mapToCanvas(svg,w,h,2);
  await new Promise(res=> cv.toBlob(b=>{ _dl(b,name+'.png'); res(); },'image/png'));
}
export async function downloadMapPDF(svg,w,h,name){
  const cv=await _mapToCanvas(svg,w,h,2);
  const jpg=cv.toDataURL('image/jpeg',0.92);
  _dl(_jpegToPdf(jpg,cv.width,cv.height),name+'.pdf');
}
export function printMap(svg,name){
  const w=window.open('','_blank'); if(!w) throw new Error('popup blocked');
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(name)+'</title>'
    +'<style>@page{size:A4 landscape;margin:8mm}body{margin:0}svg{width:100%;height:auto}</style></head><body>'
    +svg+'<scr'+'ipt>window.onload=function(){setTimeout(function(){window.print();},300);}</scr'+'ipt></body></html>');
  w.document.close();
}
function _jpegToPdf(dataURL,iw,ih){
  const bin=atob(dataURL.split(',')[1]); const img=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) img[i]=bin.charCodeAt(i)&0xff;
  const PW=960, PH=Math.round(PW*ih/iw);
  const dw=PW, dh=PH, ox=0, oy=0;
  const chunks=[]; let len=0; const xref=[];
  const enc=s=>{ const u=new Uint8Array(s.length); for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i)&0xff; return u; };
  const push=x=>{ const u=(x instanceof Uint8Array)?x:enc(x); chunks.push(u); len+=u.length; };
  const obj=(n,body)=>{ xref[n]=len; push(n+' 0 obj\n'); push(body); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+PW+' '+PH+'] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  xref[4]=len; push('4 0 obj\n');
  push('<< /Type /XObject /Subtype /Image /Width '+iw+' /Height '+ih+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+img.length+' >>\nstream\n');
  push(img); push('\nendstream\nendobj\n');
  const content='q\n'+dw.toFixed(2)+' 0 0 '+dh.toFixed(2)+' '+ox.toFixed(2)+' '+oy.toFixed(2)+' cm\n/Im0 Do\nQ\n';
  obj(5,'<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream');
  const xrefStart=len;
  let xr='xref\n0 6\n0000000000 65535 f \n';
  for(let i=1;i<=5;i++) xr+=String(xref[i]).padStart(10,'0')+' 00000 n \n';
  push(xr); push('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xrefStart+'\n%%EOF');
  const out=new Uint8Array(len); let p=0; chunks.forEach(c=>{ out.set(c,p); p+=c.length; });
  return new Blob([out],{type:'application/pdf'});
}

export function mapFileName(r){
  return 'DataMapping_'+dmTxt(actName(r)).replace(/[^฀-๿A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);
}
