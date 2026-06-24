"use client";
import { useState } from "react";
import { MASTER, STEPS, STEP_DESC } from "@/lib/master";
import { getDeep, setDeep, clone, recName, nowStr, blankS3Item, blankS6Item, blankS4Item } from "@/lib/util";
import { isStepComplete, EXTRA_RULES } from "@/lib/validate";
import { emptyRequiredFids } from "@/lib/stepvalid";
import { useToast } from "./toast";
import { TextF, SelectF, RadioF, ChecksF } from "./fields";
import { S3Editor, S4Editor, S6Editor } from "./EditorModals";
import RecorderModal from "./RecorderModal";
import DataMapModal from "./DataMapModal";
import { RejectModal, SentModal } from "./MiscModals";

function ItemGrid({ kind, items, onEdit, onRemove }){
  if(!items.length){
    const txt = kind==='s3'
      ? 'ยังไม่มีฝ่ายงานที่แบ่งปัน — กดปุ่ม “➕ เพิ่มฝ่ายงานที่แบ่งปัน” เพื่อเพิ่มรายการ'
      : kind==='s4'
      ? 'ยังไม่มีผู้รับข้อมูล — กดปุ่ม “➕ เพิ่มผู้รับข้อมูล” เพื่อเพิ่มรายการ'
      : 'ยังไม่มีประเภทการเก็บรักษา — กดปุ่ม “➕ เพิ่มประเภทการเก็บรักษา” เพื่อเพิ่มรายการ';
    return <div className="muted" style={{ padding:16, textAlign:"center", border:"1px dashed var(--line)", borderRadius:8 }}>{txt}</div>;
  }
  const cell = v => (v==null || String(v).trim()==='') ? '—' : v;
  const list = a => (Array.isArray(a)&&a.length) ? a.join(' · ') : '—';
  const head = kind==='s3'
    ? ['#','3.1 ฝ่ายงาน / ส่วนงาน','3.2 วัตถุประสงค์','3.3 ข้อมูลทั่วไป','3.4 ข้อมูลอ่อนไหว','3.5 ฐานกฎหมาย','3.6 ฐานกฎหมาย (อ่อนไหว)','จัดการ']
    : kind==='s4'
    ? ['#','4.1 ผู้รับข้อมูล','4.2 รายละเอียด / ไฟล์','4.3 สถานะ','4.4 วัตถุประสงค์','4.5 สัญญา','4.6 วิธีส่ง','4.7 DPA','จัดการ']
    : ['#','6.1 ประเภทการเก็บรักษา','6.2 เริ่มนับจาก','6.3 ระยะเวลา','6.4 เหตุผล/ฐานกฎหมาย','6.5 เก็บตามกฎหมาย','6.6 มาตรการกายภาพ','6.7 มาตรการเทคนิค','6.8 แหล่งที่จัดเก็บ','6.9 วิธีลบ/ทำลาย','จัดการ'];
  const minW = kind==='s3' ? 1080 : 1180;
  return (
    <div style={{ overflowX:"auto", border:"1px solid var(--line)", borderRadius:8 }}>
      <table style={{ minWidth:minW, fontSize:12, margin:0 }}>
        <thead><tr>{head.map((h,i)=><th key={i}>{h}</th>)}</tr></thead>
        <tbody>
          {items.map((it,i)=>(
            <tr key={i}>
              <td>{i+1}</td>
              {kind==='s3' ? (
                <>
                  <td><b>{cell(it.org)}</b></td><td>{cell(it.purpose)}</td>
                  <td>{list(it.general)}</td><td>{list(it.sensitive)}</td>
                  <td>{list(it.lawful)}</td><td>{list(it.lawfulSens)}</td>
                </>
              ) : kind==='s4' ? (
                <>
                  <td><b>{cell(it.recipient)}</b></td>
                  <td>{cell(it.recipientDetail)}{it.recipientFile ? <span title={it.recipientFile.name}> 📎</span> : null}</td>
                  <td>{cell(it.status)}</td><td>{cell(it.purpose)}</td>
                  <td>{cell(it.contract)}</td><td>{list(it.method)}</td><td>{cell(it.dpa)}</td>
                </>
              ) : (
                <>
                  <td><b>{cell(it.type)}</b></td><td>{cell(it.trigger)}</td><td>{cell(it.period)}</td>
                  <td>{cell(it.reason)}</td><td>{cell(it.legalKeep)}</td>
                  <td>{list(it.physical)}</td><td>{list(it.technical)}</td>
                  <td>{cell(it.storeLoc)}</td><td>{cell(it.deleteMethod)}</td>
                </>
              )}
              <td><div className="row-actions" style={{ flexWrap:"nowrap" }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={()=>onEdit(i)}>✎ แก้ไข</button>
                <button type="button" className="btn btn-danger btn-sm" onClick={()=>onRemove(i)}>🗑</button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Wizard({ current, setCurrent, isAdmin, onExit, onUpsert, onFinish }){
  const toast = useToast();
  const [stepIdx, setStepIdx] = useState(0);
  const [errors, setErrors] = useState(new Set());
  const [s3ed, setS3ed] = useState({ open:false, index:-1, item:null });
  const [s4ed, setS4ed] = useState({ open:false, index:-1, item:null });
  const [s6ed, setS6ed] = useState({ open:false, index:-1, item:null });
  const [recEdit, setRecEdit] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [reject, setReject] = useState(false);
  const [sent, setSent] = useState({ open:false, owner:"" });

  const get = fid => getDeep(current, fid);
  const set = (fid, val) => setCurrent(prev => setDeep(prev, fid, val));
  const p = { get, set, errors };

  const step = STEPS[stepIdx];
  const sk = step.key;

  const validateStep = () => {
    const empties = emptyRequiredFids(sk, current);
    if(empties.length){ setErrors(new Set(empties)); toast("กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบก่อนไปต่อ","err"); return false; }
    const extra = EXTRA_RULES[sk];
    if(extra){ const r = extra(current); if(r){ setErrors(new Set(r.fid ? [r.fid] : [])); toast(r.msg,"err"); return false; } }
    setErrors(new Set());
    return true;
  };

  const finish = () => {
    const miss = [];
    for(let i=0;i<STEPS.length;i++){ if(!isStepComplete(current,i)) miss.push(i); }
    if(miss.length){
      toast('ยังกรอกไม่ครบ: ' + miss.map(i=>(i+1)+'. '+STEPS[i].short).join(' · ') + ' — กรุณากรอกให้ครบก่อนบันทึกเป็นสมบูรณ์','err');
      setStepIdx(miss[0]); return;
    }
    onFinish({ ...current, status:'done', updatedAt:nowStr() });
    toast("เพิ่มรายการสำเร็จ ✓","ok");
  };

  const goNext = () => {
    if(!validateStep()) return;
    if(stepIdx===STEPS.length-1) finish();
    else setStepIdx(stepIdx+1);
  };
  const goBack = () => setStepIdx(i=>Math.max(0,i-1));
  const goStep = (i) => setStepIdx(i);
  const saveDraft = () => { onUpsert({ ...current, status:'draft', updatedAt:nowStr() }); toast("บันทึกร่างเรียบร้อย","ok"); };

  // ---- item ops ----
  const openS3 = (index) => {
    const items = current.s3?.items || [];
    if(index<0 && items.length>=MASTER.orgStructure.length){ toast('เพิ่มครบทุกฝ่ายงานแล้ว','err'); return; }
    setS3ed({ open:true, index, item: index>=0 ? clone(items[index]) : blankS3Item() });
  };
  const saveS3 = (item) => {
    setCurrent(prev => {
      const items = (prev.s3?.items||[]).slice();
      if(s3ed.index>=0) items[s3ed.index]=item; else items.push(item);
      return setDeep(prev,'s3.items',items);
    });
    setS3ed({ open:false, index:-1, item:null });
  };
  const removeS3 = (i) => { if(!confirm('ลบฝ่ายงานที่แบ่งปันนี้?')) return; setCurrent(prev=>{ const items=(prev.s3?.items||[]).slice(); items.splice(i,1); return setDeep(prev,'s3.items',items); }); };

  const openS4 = (index) => {
    const items = current.s4?.items || [];
    if(index<0 && items.length>=MASTER.externalRecipients.length){ toast('เพิ่มครบทุกผู้รับข้อมูลแล้ว','err'); return; }
    setS4ed({ open:true, index, item: index>=0 ? clone(items[index]) : blankS4Item() });
  };
  const saveS4 = (item) => {
    setCurrent(prev => {
      const items = (prev.s4?.items||[]).slice();
      if(s4ed.index>=0) items[s4ed.index]=item; else items.push(item);
      return setDeep(prev,'s4.items',items);
    });
    setS4ed({ open:false, index:-1, item:null });
  };
  const removeS4 = (i) => { if(!confirm('ลบผู้รับข้อมูลนี้?')) return; setCurrent(prev=>{ const items=(prev.s4?.items||[]).slice(); items.splice(i,1); return setDeep(prev,'s4.items',items); }); };

  const openS6 = (index) => {
    const items = current.s6?.items || [];
    if(index<0 && items.length>=MASTER.retentionType.length){ toast('เพิ่มครบทุกประเภทการเก็บรักษาแล้ว','err'); return; }
    setS6ed({ open:true, index, item: index>=0 ? clone(items[index]) : blankS6Item() });
  };
  const saveS6 = (item) => {
    setCurrent(prev => {
      const items = (prev.s6?.items||[]).slice();
      if(s6ed.index>=0) items[s6ed.index]=item; else items.push(item);
      return setDeep(prev,'s6.items',items);
    });
    setS6ed({ open:false, index:-1, item:null });
  };
  const removeS6 = (i) => { if(!confirm('ลบประเภทการเก็บรักษานี้?')) return; setCurrent(prev=>{ const items=(prev.s6?.items||[]).slice(); items.splice(i,1); return setDeep(prev,'s6.items',items); }); };

  const doReject = (comment) => {
    const owner = recName(current) || '(ไม่ระบุชื่อผู้กรอก)';
    onUpsert({ ...current, reviewComment:comment, status:'rejected', reviewedAt:nowStr() });
    setReject(false);
    setSent({ open:true, owner });
  };

  // ---- step body ----
  const special = get('s1.special');
  const s3on = get('s3.share')==='มีการแบ่งปัน';
  const s4on = get('s4.disclose')==='มีการเปิดเผย';
  const s5on = get('s5.transfer')==='มีการส่งออกนอกประเทศ';
  const s6on = get('s6.store')==='มีการจัดเก็บ';
  const s7req = get('s6.store')==='มีการจัดเก็บ';

  let body = null;
  if(sk==='s1') body = (<>
    <div className="sectionbox">
      <div style={{ fontWeight:700, color:"var(--primary-dark)", marginBottom:12 }}>ข้อมูลองค์กร</div>
      <SelectF fid="company" label="บริษัทต้นสังกัด (Company)" options={MASTER.companies} req {...p} />
    </div>
    <SelectF fid="s1.org" label="1.1 ผู้อำนวยการ / ฝ่าย / ส่วน" options={MASTER.orgStructure} req hint="ดึง Auto จากฐานข้อมูลโครงสร้างบริษัทฯ" {...p} />
    <SelectF fid="s1.activity" label="1.2 กิจกรรมการประมวลข้อมูลส่วนบุคคล" options={[...MASTER.activities,'อื่นๆ']} req hint="ดึงจากชีท “กิจกรรมการประมวลข้อมูลส่วนบุคคล”" {...p} />
    <TextF fid="s1.responsible" label="1.4 ผู้ที่มีหน้าที่รับผิดชอบ" req {...p} />
    <ChecksF fid="s1.recordFormat" label="1.5 รูปแบบการบันทึก" options={MASTER.recordFormats} req hint="ดึงจากชีท “รูปแบบการบันทึก”" {...p} />
    <TextF fid="s1.recordFormatDetail" label="รายละเอียดเพิ่มเติมของรูปแบบการบันทึก" area ph="ระบุรายละเอียดในแต่ละรูปแบบเอกสาร" {...p} />
    <ChecksF fid="s1.dataSubject" label="1.6 ประเภทเจ้าของข้อมูล" options={MASTER.dataSubjects} req hint="ดึงจากชีท “ประเภทเจ้าของข้อมูล”" {...p} />
    <RadioF fid="s1.special" label="1.7 บุคคลพิเศษ" options={['ไม่มี','ผู้เยาว์','ผู้เสมือนไร้ความสามารถ','ผู้ไร้ความสามารถ']} req {...p} />
    {special && special!=='ไม่มี' &&
      <div className="otherbox"><RadioF fid="s1.consent" label="Consent (ได้รับความยินยอม)" options={['Y','N']} req {...p} /></div>}
    <RadioF fid="s1.frequency" label="1.8 ความถี่ในการประมวลผลข้อมูลส่วนบุคคล" options={['รายวัน','รายเดือน','รายปี','เกิดขึ้นตามเหตุการณ์']} req {...p} />
  </>);
  else if(sk==='s2') body = (<>
    <ChecksF fid="s2.general" label="2.1 ข้อมูลส่วนบุคคลทั่วไป" options={MASTER.generalData} hint="ดึงจากชีท “ประเภทข้อมูลส่วนบุคคลทั่วไป”" {...p} />
    <ChecksF fid="s2.sensitive" label="2.2 ข้อมูลส่วนบุคคลอ่อนไหว" options={MASTER.sensitiveData} hint="ดึงจากชีท “ประเภทข้อมูลส่วนบุคคลอ่อนไหว”" {...p} />
    <ChecksF fid="s2.source" label="2.3 แหล่งที่มาของข้อมูล" options={MASTER.dataSources} req hint="มีผลต่อ Data Mapping · “ฝ่าย/ส่วน” ดึง Auto, ลำดับ 1-7 Fix ได้" {...p} />
    <TextF fid="s2.purpose" label="2.4 วัตถุประสงค์ในการประมวลผล" req area {...p} />
    <ChecksF fid="s2.lawful" label="2.5 ฐานทางกฎหมาย ตาม ม.39(6) (Lawful Basis)" options={MASTER.lawfulBasis} hint="DPD สามารถแก้ไขได้" {...p} />
    <ChecksF fid="s2.lawfulSens" label="2.6 ฐานทางกฎหมายในการประมวลผลข้อมูลอ่อนไหว" options={MASTER.lawfulBasisSensitive} hint="DPD สามารถแก้ไขได้" {...p} />
  </>);
  else if(sk==='s3') body = (<>
    <RadioF fid="s3.share" label="3. การใช้ข้อมูลส่วนบุคคล (Internal Sharing)" options={['มีการแบ่งปัน','ไม่มีการแบ่งปัน']} req hint="การใช้ข้อมูลภายในบริษัทเท่านั้น · ระหว่างหน่วยงานภายใน" {...p} />
    {s3on &&
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, margin:"2px 2px 10px" }}>
          <div className="hint" style={{ margin:0 }}>แต่ละ “ฝ่ายงาน / ส่วนงาน” (3.1) คือ 1 รายการ มีรายละเอียด 3.2–3.6 ของตัวเอง · เพิ่ม/แก้ไขทีละรายการ (ฝ่ายงานไม่ซ้ำกัน)</div>
          <button type="button" className="btn btn-primary btn-sm" style={{ whiteSpace:"nowrap" }} onClick={()=>openS3(-1)}>➕ เพิ่มฝ่ายงานที่แบ่งปัน</button>
        </div>
        <ItemGrid kind="s3" items={current.s3?.items||[]} onEdit={openS3} onRemove={removeS3} />
      </div>}
  </>);
  else if(sk==='s4') body = (<>
    <RadioF fid="s4.disclose" label="4. การเปิดเผยข้อมูลส่วนบุคคล (External Disclosure)" options={['มีการเปิดเผย','ไม่มีการเปิดเผย']} req hint="การส่งข้อมูลออกไปยังบุคคล/บริษัทภายนอก" {...p} />
    {s4on &&
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, margin:"2px 2px 10px" }}>
          <div className="hint" style={{ margin:0 }}>แต่ละ “ผู้รับข้อมูล” (4.1) คือ 1 รายการ มีรายละเอียด 4.2–4.7 ของตัวเอง · เพิ่ม/แก้ไขทีละรายการ (ผู้รับไม่ซ้ำกัน)</div>
          <button type="button" className="btn btn-primary btn-sm" style={{ whiteSpace:"nowrap" }} onClick={()=>openS4(-1)}>➕ เพิ่มผู้รับข้อมูล</button>
        </div>
        <ItemGrid kind="s4" items={current.s4?.items||[]} onEdit={openS4} onRemove={removeS4} />
      </div>}
  </>);
  else if(sk==='s5') body = (<>
    <RadioF fid="s5.transfer" label="5. การโอนข้อมูลส่วนบุคคลไปต่างประเทศ" options={['มีการส่งออกนอกประเทศ','ไม่มีการส่งออกนอกประเทศ']} req {...p} />
    {s5on &&
      <div className="sectionbox">
        <TextF fid="s5.country" label="5.1 ประเทศปลายทางที่โอนข้อมูลส่วนบุคคล" req {...p} />
        <TextF fid="s5.company" label="5.2 ชื่อ ที่อยู่ และข้อมูลของบริษัทที่โอนข้อมูลให้" req area {...p} />
        <TextF fid="s5.method" label="5.3 วิธีการโอนข้อมูลส่วนบุคคล" req area {...p} />
        <TextF fid="s5.purpose" label="5.4 วัตถุประสงค์ในการโอนข้อมูลส่วนบุคคล" req area {...p} />
        <ChecksF fid="s5.safeguard" label="5.5 ฐาน/มาตรการคุ้มครองในการโอนไปต่างประเทศ" options={MASTER.transferSafeguard} req hint="ตามมาตรา 28/29 — ต้องระบุฐานที่ทำให้โอนได้โดยชอบด้วยกฎหมาย" {...p} />
      </div>}
  </>);
  else if(sk==='s6') body = (<>
    <RadioF fid="s6.store" label="6. การเก็บรักษาข้อมูลส่วนบุคคล" options={['มีการจัดเก็บ','ไม่มีการจัดเก็บ']} req hint="มีการจัดเก็บข้อมูลเพื่อการอ้างอิงในอนาคตหรือไม่" {...p} />
    {s6on &&
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, margin:"2px 2px 10px" }}>
          <div className="hint" style={{ margin:0 }}>แต่ละ “ประเภทการเก็บรักษา” (6.1) คือ 1 รายการ มีรายละเอียด 6.2–6.9 ของตัวเอง · เพิ่ม/แก้ไขทีละรายการ (ประเภทไม่ซ้ำกัน)</div>
          <button type="button" className="btn btn-primary btn-sm" style={{ whiteSpace:"nowrap" }} onClick={()=>openS6(-1)}>➕ เพิ่มประเภทการเก็บรักษา</button>
        </div>
        <ItemGrid kind="s6" items={current.s6?.items||[]} onEdit={openS6} onRemove={removeS6} />
      </div>}
  </>);
  else if(sk==='s7') body = (<>
    <div style={{ background:"var(--primary-light)", padding:"10px 14px", borderRadius:8, marginBottom:18, fontSize:12.5, color:"var(--primary-dark)" }}>
      ℹ️ บังคับกรอกเมื่อมีการกรอกหัวข้อที่ 6 (การเก็บรักษาข้อมูล) {s7req ? <b>— ขณะนี้บังคับกรอก</b> : '— ขณะนี้ไม่บังคับ'}
    </div>
    <TextF fid="s7.who" label="7.1 บุคคลหรือหน่วยงานที่มีสิทธิเข้าถึง" req={s7req} area {...p} />
    <ChecksF fid="s7.condition" label="7.2 เงื่อนไขเกี่ยวกับบุคคลที่มีสิทธิเข้าถึง (จาก 7.1)" options={MASTER.accessConditions} req={s7req} hint="ดึงจากชีท “วิธีการเข้าถึงข้อมูล”" {...p} />
    <ChecksF fid="s7.method" label="7.3 วิธีการเข้าถึงข้อมูลส่วนบุคคล" options={MASTER.accessMethods} req={s7req} hint="ดึงจากชีท “วิธีการเข้าถึงข้อมูล”" {...p} />
    <TextF fid="s7.methodDetail" label="รายละเอียดวิธีการเข้าถึงเพิ่มเติม" area {...p} />
  </>);

  const completeCount = STEPS.filter((_,i)=>isStepComplete(current,i)).length;
  const pct = Math.round(completeCount/STEPS.length*100);
  const isLast = stepIdx===STEPS.length-1;

  return (
    <div className="container-fluid">
      <div className="wizard">
        <aside className="steps">
          <div className="recorder">
            ผู้บันทึก: <b>{recName(current)||'-'}</b><br />
            ตำแหน่ง: {current.recorder?.position||'-'} · เบอร์ {current.recorder?.phone||'-'}<br />
            ฝ่าย: {current.recorder?.division||'-'}<br />
            ส่วน: {current.recorder?.section||'-'}<br />
            บริษัท: <b>{current.company||'-'}</b>
            <button className="btn btn-ghost btn-sm" style={{ marginTop:8, padding:"3px 8px", fontSize:11 }} onClick={()=>setRecEdit(true)}>แก้ไขผู้บันทึก</button>
          </div>
          <div>
            {STEPS.map((s,i)=>{
              const done = isStepComplete(current,i);
              return (
                <div key={s.key} className={"step"+(i===stepIdx?' active':'')+(done?' done':'')} onClick={()=>goStep(i)}>
                  <div className="num">{done?'✓':(i+1)}</div>
                  <div className="lbl">{s.short}<small>{s.title.split('. ')[1]||''}</small></div>
                </div>
              );
            })}
          </div>
          <div className="progressbar"><i style={{ width:pct+'%' }} /></div>
          <div style={{ textAlign:"center", fontSize:11, color:"var(--muted)", marginTop:6 }}>กรอกครบ {pct}%</div>
        </aside>

        <section className="panel">
          <div className="phead">
            <h2>{step.title}</h2>
            <p>{STEP_DESC[sk]}</p>
          </div>
          <div className="pbody">
            {current.status==='rejected' && current.reviewComment &&
              <div style={{ background:"#fde2e2", border:"1px solid #f5b5b5", borderRadius:8, padding:"12px 14px", marginBottom:16, color:"#8a1f1f", fontSize:13 }}>
                ⛔ <b>เอกสารถูกตีกลับจากผู้ตรวจ</b> {current.reviewedAt ? '· '+current.reviewedAt : ''}<br />
                <span style={{ color:"#5a1313" }}>หมายเหตุจากผู้ตรวจ:</span> {current.reviewComment||''}
              </div>}
            {body}
            <hr style={{ border:0, borderTop:"1px dashed var(--line)", margin:"18px 0" }} />
            <TextF fid={sk+'.remark'} label="หมายเหตุ (สำหรับการส่งกลับเพื่อแก้ไขข้อมูล)" area ph="หากตีกลับ ระบุเหตุผล/จุดที่ต้องแก้ไข" {...p} />
          </div>
          <div className="pfoot">
            <button className="btn btn-ghost" style={{ visibility: stepIdx===0 ? 'hidden':'visible' }} onClick={goBack}>◀ Back</button>
            <div className="right">
              {isAdmin &&
                <button className="btn btn-danger" title="ตีกลับเอกสารเพื่อให้ผู้กรอกแก้ไข" onClick={()=>setReject(true)}>⛔ Reject (ตีกลับ)</button>}
              <button className="btn btn-ghost" title="ดู Data Mapping Diagram จากข้อมูลที่กรอก" onClick={()=>setMapOpen(true)}>🗺️ Data Map</button>
              <button className="btn btn-warn" onClick={saveDraft}>💾 Save (บันทึกร่าง)</button>
              <button className={"btn "+(isLast?'btn-accent':'btn-primary')} onClick={goNext}>{isLast ? '✓ บันทึกรายการ (เพิ่มรายการ)' : 'Next ▶'}</button>
            </div>
          </div>
        </section>
      </div>

      <S3Editor open={s3ed.open} item={s3ed.item} index={s3ed.index} existingItems={current.s3?.items||[]}
                onCancel={()=>setS3ed({ open:false, index:-1, item:null })} onSave={saveS3} />
      <S4Editor open={s4ed.open} item={s4ed.item} index={s4ed.index} existingItems={current.s4?.items||[]}
                onCancel={()=>setS4ed({ open:false, index:-1, item:null })} onSave={saveS4} />
      <S6Editor open={s6ed.open} item={s6ed.item} index={s6ed.index} existingItems={current.s6?.items||[]}
                onCancel={()=>setS6ed({ open:false, index:-1, item:null })} onSave={saveS6} />
      <RecorderModal open={recEdit} recorder={current.recorder}
                     onCancel={()=>setRecEdit(false)}
                     onSave={(rec)=>{ setCurrent(prev=>({ ...prev, recorder:rec })); setRecEdit(false); }} />
      <DataMapModal open={mapOpen} rec={current} onClose={()=>setMapOpen(false)} />
      <RejectModal open={reject} initialComment={current.reviewComment} onCancel={()=>setReject(false)} onConfirm={doReject} />
      <SentModal open={sent.open} owner={sent.owner} onClose={()=>setSent({ open:false, owner:"" })} />
    </div>
  );
}
