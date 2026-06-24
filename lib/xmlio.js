/* =========================================================================
   SAVE / LOAD เป็นไฟล์ XML — ported verbatim จาก ropa_v32.html
   ========================================================================= */
import { escXml, nowStr } from "./util";

function objToXml(o,ind){
  ind=ind||'    ';
  let s='';
  for(const k in o){
    const v=o[k];
    if(Array.isArray(v)){
      if(v.length===0){ s+=`\n${ind}<${k} type="array"/>`; }
      else s+=`\n${ind}<${k} type="array">`+v.map(x=>`\n${ind}  <item>${escXml(x)}</item>`).join('')+`\n${ind}</${k}>`;
    } else if(v && typeof v==='object'){
      s+=`\n${ind}<${k}>`+objToXml(v,ind+'  ')+`\n${ind}</${k}>`;
    } else {
      s+=`\n${ind}<${k}>${escXml(v)}</${k}>`;
    }
  }
  return s;
}
export function buildXML(recs){
  const head='<?xml version="1.0" encoding="UTF-8"?>\n';
  const body=recs.map(r=>`  <Record>${objToXml(r,'    ')}\n  </Record>`).join('\n');
  return head+`<RoPARecords count="${recs.length}" exportedAt="${escXml(nowStr())}">\n${body}\n</RoPARecords>\n`;
}

function xmlNodeToObj(node){
  const els=[...node.children];
  if(node.getAttribute('type')==='array' || (els.length && els.every(e=>e.tagName==='item')))
    return els.map(e=> e.children.length? xmlNodeToObj(e): e.textContent);
  if(els.length===0) return node.textContent;
  const o={};
  els.forEach(e=>{ o[e.tagName]=xmlNodeToObj(e); });
  return o;
}
export function parseXML(text){
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.querySelector('parsererror')) throw new Error('parse error');
  return [...doc.querySelectorAll('RoPARecords > Record')].map(xmlNodeToObj);
}
