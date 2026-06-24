/* Shared pure helpers — ported จาก ropa_v32.html */
import { LS_KEY } from "./master";

export function esc(s){ return (s ?? "").toString().replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
export function escXml(s){ return (s==null?'':s).toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])); }

export function uid(){ return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
export function nowStr(){ return new Date().toLocaleString('th-TH', {dateStyle:'medium', timeStyle:'short'}); }

export function recName(r){
  const rec = r && r.recorder; if(!rec) return "";
  if(rec.firstName || rec.lastName) return `${rec.firstName||''} ${rec.lastName||''}`.trim();
  return rec.name || "";
}
export function actDisplay(r){ return r.s1?.activity === "อื่นๆ" ? (r.s1?.activityOther || "อื่นๆ") : (r.s1?.activity || ""); }
export function actName(r){ const a=r.s1?.activity; return a==='อื่นๆ' ? (r.s1?.activityOther||'อื่นๆ') : (a||'(ไม่ระบุกิจกรรม)'); }

// ตรวจว่าเป็นตัวเลือก “อื่นๆ / อื่น ๆ (โปรดระบุ)” จริง ๆ
export function isOtherOption(o){
  const s = (o||'').toString().replace(/\s+/g,'');
  return /^อื่นๆ?$/.test(s) || /^อื่นๆ?\(?(โปรด)?ระบุ\)?$/.test(s);
}

// immutable deep set by dot-path → returns new object
export function setDeep(obj, path, val){
  const ks = path.split('.');
  const root = Array.isArray(obj) ? obj.slice() : { ...obj };
  let o = root;
  for(let i=0;i<ks.length-1;i++){
    const k = ks[i];
    const child = o[k];
    o[k] = (child && typeof child === 'object') ? (Array.isArray(child) ? child.slice() : { ...child }) : {};
    o = o[k];
  }
  o[ks[ks.length-1]] = val;
  return root;
}
export function getDeep(obj, path){
  const ks = path.split('.'); let o = obj;
  for(const k of ks){ if(o==null) return undefined; o = o[k]; }
  return o;
}

export function clone(x){ return JSON.parse(JSON.stringify(x)); }

export function blankRecord(){
  return {
    id: uid(), company:"", status:'draft',
    recorder:{firstName:"", lastName:"", position:"", phone:"", division:"", section:""},
    s1:{}, s2:{}, s3:{share:"", items:[]}, s4:{disclose:"", items:[]}, s5:{transfer:""}, s6:{store:"", items:[]}, s7:{}
  };
}
export function blankS6Item(){ return {type:"", trigger:"", period:"", reason:"", legalKeep:"", physical:[], technical:[], storeLoc:"", deleteMethod:""}; }
export function blankS3Item(){ return {org:"", purpose:"", general:[], sensitive:[], lawful:[], lawfulSens:[]}; }
export function blankS4Item(){ return {recipient:"", recipientDetail:"", recipientFile:null, status:"", purpose:"", contract:"", method:[], dpa:""}; }

/* ---- localStorage persistence ---- */
export function loadRecords(){
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch(e){ return []; }
}
export function persistRecords(records){
  try { localStorage.setItem(LS_KEY, JSON.stringify(records)); } catch(e){}
}

/* ---- legacy migrations (ตรงกับ ensureS3Items / ensureS6Items เดิม) ---- */
export function migrateS6(rec){
  const s = rec.s6 = rec.s6 || {};
  if(!Array.isArray(s.items)) s.items = [];
  if(s.items.length===0 && (s.trigger||s.period||(Array.isArray(s.retentionType)&&s.retentionType.length)||s.deleteMethod||(Array.isArray(s.physical)&&s.physical.length))){
    const types = (Array.isArray(s.retentionType)&&s.retentionType.length) ? s.retentionType : [''];
    s.items = types.map(t=>({type:t, trigger:s.trigger||'', period:s.period||'', reason:s.reason||'', legalKeep:s.legalKeep||'', physical:Array.isArray(s.physical)?s.physical:[], technical:Array.isArray(s.technical)?s.technical:[], storeLoc:s.storeLoc||'', deleteMethod:s.deleteMethod||''}));
  }
  return rec;
}
export function migrateS4(rec){
  const s = rec.s4 = rec.s4 || {};
  if(!Array.isArray(s.items)) s.items = [];
  const hasFlat = (Array.isArray(s.recipient)&&s.recipient.length) || s.recipientDetail || s.purpose || s.contract || (Array.isArray(s.method)&&s.method.length) || s.dpa || (Array.isArray(s.status)&&s.status.length);
  if(s.items.length===0 && hasFlat){
    s.items = [{
      recipient: Array.isArray(s.recipient) ? (s.recipient[0]||'') : (s.recipient||''),
      recipientDetail: s.recipientDetail||'',
      recipientFile: null,
      status: Array.isArray(s.status) ? (s.status[0]||'') : (s.status||''),
      purpose: s.purpose||'',
      contract: s.contract||'',
      method: Array.isArray(s.method) ? s.method : [],
      dpa: s.dpa||''
    }];
  }
  return rec;
}
export function migrateS3(rec){
  const s = rec.s3 = rec.s3 || {};
  if(!Array.isArray(s.items)) s.items = [];
  if(s.items.length===0 && ((Array.isArray(s.org)&&s.org.length)||s.purpose)){
    const orgs = (Array.isArray(s.org)&&s.org.length) ? s.org : [s.org||''];
    s.items = orgs.filter(o=>o!=null&&String(o).trim()!=='').map(o=>({org:o, purpose:s.purpose||'', general:Array.isArray(s.general)?s.general:[], sensitive:Array.isArray(s.sensitive)?s.sensitive:[], lawful:Array.isArray(s.lawful)?s.lawful:[], lawfulSens:Array.isArray(s.lawfulSens)?s.lawfulSens:[]}));
    if(!s.items.length) s.items = [{org:'', purpose:s.purpose||'', general:[], sensitive:[], lawful:[], lawfulSens:[]}];
  }
  return rec;
}
