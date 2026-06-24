/* คำนวณ fid ที่ "จำเป็นและมองเห็นอยู่" แต่ยังว่าง — ใช้ทำ red-mark ให้ตรงกับ
   data-req + isHidden ของ builder เดิม (รวมกล่อง "โปรดระบุ" ของตัวเลือก อื่นๆ) */
import { MASTER } from "./master";
import { getDeep, isOtherOption } from "./util";

export function isEmptyVal(v){ return Array.isArray(v) ? v.length===0 : !((v||'').toString().trim()); }

// กล่อง "โปรดระบุ" ที่ถูกแสดง (จึงจำเป็น) สำหรับ field ที่มีตัวเลือก อื่นๆ
function otherFids(fid, options, value, kind){
  const others = options.filter(isOtherOption);
  return others.map((o,i)=>{
    const ofid = fid + 'Other' + (others.length>1?i:'');
    const show = kind==='sel' ? value===o : (Array.isArray(value)&&value.includes(o));
    return show ? ofid : null;
  }).filter(Boolean);
}

// คืน fid ที่จำเป็นทั้งหมด (มองเห็นอยู่) ของ step — ไม่ว่าจะว่างหรือไม่
function requiredFids(stepKey, rec){
  const g = p => getDeep(rec, p);
  const out = [];
  const addOther = (fid, options, kind) => otherFids(fid, options, g(fid), kind).forEach(f=>out.push(f));
  switch(stepKey){
    case 's1': {
      out.push('company','s1.org','s1.activity','s1.responsible','s1.recordFormat','s1.dataSubject','s1.special','s1.frequency');
      addOther('s1.activity', [...MASTER.activities,'อื่นๆ'], 'sel');
      addOther('s1.recordFormat', MASTER.recordFormats, 'chk');
      addOther('s1.dataSubject', MASTER.dataSubjects, 'chk');
      if(g('s1.special') && g('s1.special')!=='ไม่มี') out.push('s1.consent');
      break;
    }
    case 's2': {
      out.push('s2.source','s2.purpose');
      addOther('s2.general', MASTER.generalData, 'chk');
      addOther('s2.sensitive', MASTER.sensitiveData, 'chk');
      addOther('s2.source', MASTER.dataSources, 'chk');
      addOther('s2.lawful', MASTER.lawfulBasis, 'chk');
      addOther('s2.lawfulSens', MASTER.lawfulBasisSensitive, 'chk');
      break;
    }
    case 's3': out.push('s3.share'); break;
    case 's4': out.push('s4.disclose'); break;
    case 's5': {
      out.push('s5.transfer');
      if(g('s5.transfer')==='มีการส่งออกนอกประเทศ'){
        out.push('s5.country','s5.company','s5.method','s5.purpose','s5.safeguard');
        addOther('s5.safeguard', MASTER.transferSafeguard, 'chk');
      }
      break;
    }
    case 's6': out.push('s6.store'); break;
    case 's7': {
      if(g('s6.store')==='มีการจัดเก็บ'){
        out.push('s7.who','s7.condition','s7.method');
        addOther('s7.condition', MASTER.accessConditions, 'chk');
        addOther('s7.method', MASTER.accessMethods, 'chk');
      }
      break;
    }
    default: break;
  }
  return out;
}

export function emptyRequiredFids(stepKey, rec){
  return requiredFids(stepKey, rec).filter(fid => isEmptyVal(getDeep(rec, fid)));
}

// ---- editor (modal) required fids ----
function editorRequiredFids(kind, obj){
  const g = p => getDeep(obj, p);
  const out = [];
  const addOther = (fid, options, k) => otherFids(fid, options, g(fid), k).forEach(f=>out.push(f));
  if(kind==='s3'){
    out.push('s3edit.org','s3edit.purpose','s3edit.lawful');
    addOther('s3edit.general', MASTER.generalData, 'chk');
    addOther('s3edit.sensitive', MASTER.sensitiveData, 'chk');
    addOther('s3edit.lawful', MASTER.lawfulBasis, 'chk');
    addOther('s3edit.lawfulSens', MASTER.lawfulBasisSensitive, 'chk');
  } else if(kind==='s6'){
    out.push('s6edit.type','s6edit.trigger','s6edit.period','s6edit.physical','s6edit.technical','s6edit.storeLoc','s6edit.deleteMethod');
    addOther('s6edit.physical', MASTER.physicalMeasures, 'chk');
    addOther('s6edit.technical', MASTER.technicalMeasures, 'chk');
    addOther('s6edit.deleteMethod', MASTER.deleteMethods, 'sel');
  } else if(kind==='s4'){
    // 4.1 ผู้รับ (single) + 4.2 รายละเอียด + 4.4 วัตถุประสงค์ + 4.5 สัญญา + 4.6 วิธีส่ง + 4.7 DPA (4.3 สถานะไม่บังคับ)
    out.push('s4edit.recipient','s4edit.recipientDetail','s4edit.purpose','s4edit.contract','s4edit.method','s4edit.dpa');
    addOther('s4edit.method', MASTER.disclosureMethods, 'chk');
  }
  return out;
}
export function emptyEditorFids(kind, obj){
  return editorRequiredFids(kind, obj).filter(fid => isEmptyVal(getDeep(obj, fid)));
}
