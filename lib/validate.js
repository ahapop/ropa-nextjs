/* Validation / completeness — ported จาก ropa_v32.html (ทำให้รับ record เป็นพารามิเตอร์) */
import { STEPS } from "./master";
import { getDeep } from "./util";

// เกณฑ์ความครบของ 1 Record ใน Step 3
export function s3ItemOk(it){
  if(!it) return false;
  const org=(it.org||'').toString().trim(), purpose=(it.purpose||'').toString().trim();
  const gen=Array.isArray(it.general)&&it.general.length>0, sen=Array.isArray(it.sensitive)&&it.sensitive.length>0;
  const law=Array.isArray(it.lawful)&&it.lawful.length>0, lawS=Array.isArray(it.lawfulSens)&&it.lawfulSens.length>0;
  return !!(org && purpose && (gen||sen) && law && (sen?lawS:true));
}

export function isStepComplete(r, i){
  const k = STEPS[i].key;
  const get = p => getDeep(r, p);
  const req = p => !!((get(p)||'').toString().trim());
  const arr = p => Array.isArray(get(p)) && get(p).length>0;
  const reqActivity = () => { const a=get('s1.activity'); if(!a) return false; if(a==='อื่นๆ') return req('s1.activityOther'); return true; };
  const checks = {
    s1: () => req('company')&&req('s1.org')&&reqActivity()&&req('s1.responsible')&&arr('s1.recordFormat')&&arr('s1.dataSubject')&&req('s1.special')&&req('s1.frequency'),
    s2: () => arr('s2.source')&&req('s2.purpose')&&(arr('s2.general')||arr('s2.sensitive')),
    s3: () => { const v=get('s3.share'); if(!v) return false; if(v==='ไม่มีการแบ่งปัน') return true;
      const items=get('s3.items')||[]; if(!items.length) return false;
      const orgs=items.map(it=>it&&it.org).filter(Boolean);
      return items.every(s3ItemOk)&&new Set(orgs).size===orgs.length; },
    s4: () => { const v=get('s4.disclose'); if(!v) return false; if(v==='ไม่มีการเปิดเผย') return true; return arr('s4.recipient')&&req('s4.recipientDetail')&&req('s4.purpose')&&req('s4.contract')&&arr('s4.method')&&req('s4.dpa'); },
    s5: () => { const v=get('s5.transfer'); if(!v) return false; if(v==='ไม่มีการส่งออกนอกประเทศ') return true; return req('s5.country')&&req('s5.company')&&req('s5.method')&&req('s5.purpose')&&arr('s5.safeguard'); },
    s6: () => { const v=get('s6.store'); if(!v) return false; if(v==='ไม่มีการจัดเก็บ') return true;
      const items=get('s6.items')||[]; if(!items.length) return false;
      const itemOk=it=>!!(it&&(it.type||'').toString().trim()&&(it.trigger||'').toString().trim()&&(it.period||'').toString().trim()&&Array.isArray(it.physical)&&it.physical.length&&Array.isArray(it.technical)&&it.technical.length&&(it.storeLoc||'').toString().trim()&&(it.deleteMethod||'').toString().trim());
      const types=items.map(it=>it&&it.type).filter(Boolean);
      return items.every(itemOk)&&new Set(types).size===types.length; },
    s7: () => { if(get('s6.store')!=='มีการจัดเก็บ') return true; return req('s7.who')&&arr('s7.condition')&&arr('s7.method'); }
  };
  return checks[k]();
}

export function recCompleteness(r){
  let n=0;
  for(let i=0;i<STEPS.length;i++){ try{ if(isStepComplete(r,i)) n++; }catch(e){} }
  return n; // 0..7
}
export function recordComplete(r){ return recCompleteness(r)===STEPS.length; }

// กฎข้ามฟิลด์เฉพาะขั้นตอน — คืน null ถ้าผ่าน, หรือ {fid?,msg} ถ้าไม่ผ่าน
export const EXTRA_RULES = {
  s2(r){
    const g=getDeep(r,'s2.general')||[], s=getDeep(r,'s2.sensitive')||[];
    if(g.length===0 && s.length===0) return {fid:'s2.general', msg:'ต้องเลือกประเภทข้อมูลส่วนบุคคล (ข้อ 2.1 หรือ 2.2) อย่างน้อย 1 รายการ ตาม ม.39(1)'};
    return null;
  },
  s3(r){
    if(getDeep(r,'s3.share')!=='มีการแบ่งปัน') return null;
    const items=getDeep(r,'s3.items')||[];
    if(!items.length) return {msg:'ต้องเพิ่มฝ่ายงานที่แบ่งปันข้อมูลอย่างน้อย 1 รายการ'};
    const orgs=items.map(it=>it&&it.org).filter(Boolean);
    if(new Set(orgs).size!==orgs.length) return {msg:'ฝ่ายงาน (3.1) ซ้ำกัน — แต่ละรายการต้องเป็นคนละฝ่ายงาน'};
    const bad=items.findIndex(it=>!s3ItemOk(it));
    if(bad>=0) return {msg:`รายการฝ่ายงานลำดับที่ ${bad+1} กรอกไม่ครบ — ต้องมี 3.2 วัตถุประสงค์, เลือก 3.3 หรือ 3.4 อย่างน้อย 1, 3.5 ฐานกฎหมาย และ 3.6 เมื่อมีข้อมูลอ่อนไหว`};
    return null;
  },
  s6(r){
    if(getDeep(r,'s6.store')!=='มีการจัดเก็บ') return null;
    const items=getDeep(r,'s6.items')||[];
    if(!items.length) return {msg:'ต้องเพิ่มประเภทการเก็บรักษาอย่างน้อย 1 รายการ'};
    const types=items.map(it=>it&&it.type).filter(Boolean);
    if(new Set(types).size!==types.length) return {msg:'ประเภทการเก็บรักษา (6.1) ซ้ำกัน — แต่ละรายการต้องเป็นคนละประเภท'};
    return null;
  }
};
