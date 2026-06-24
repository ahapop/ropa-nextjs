"use client";
import { useState, useEffect } from "react";
import { Modal, ModalHead, ModalFoot } from "./ui";
import { useToast } from "./toast";
import { DIVISIONS, SECTIONS } from "@/lib/master";

export default function RecorderModal({ open, recorder, onCancel, onSave }){
  const toast = useToast();
  const [r, setR] = useState({ firstName:"", lastName:"", position:"", phone:"", division:"", section:"" });
  useEffect(() => { if(open) setR({ firstName:"", lastName:"", position:"", phone:"", division:"", section:"", ...(recorder||{}) }); }, [open, recorder]);
  if(!open) return null;
  const upd = (k,v) => setR(s => ({ ...s, [k]:v }));
  const save = () => {
    if(!r.firstName.trim() || !r.lastName.trim()){ toast("กรุณากรอก ชื่อ และ นามสกุล ของผู้บันทึก","err"); return; }
    onSave({ firstName:r.firstName.trim(), lastName:r.lastName.trim(), position:r.position.trim(), phone:r.phone.trim(), division:r.division, section:r.section });
  };
  return (
    <Modal z={80} maxWidth={680} onBackdrop={onCancel}>
      <ModalHead title="รายละเอียดผู้บันทึก" sub="ระบุ ชื่อ–นามสกุล ตำแหน่ง เบอร์ติดต่อ และกิจกรรมของหน่วยงาน (ฝ่าย/ส่วน) ของผู้บันทึกรายการนี้" />
      <div style={{ padding:"18px 22px" }}>
        <div className="grid2">
          <div className="field"><label>ชื่อ<span className="req">*</span></label>
            <input type="text" value={r.firstName} autoFocus onChange={e=>upd('firstName', e.target.value)} /></div>
          <div className="field"><label>นามสกุล<span className="req">*</span></label>
            <input type="text" value={r.lastName} onChange={e=>upd('lastName', e.target.value)} /></div>
          <div className="field"><label>ตำแหน่ง</label>
            <input type="text" value={r.position} placeholder="เช่น เจ้าหน้าที่คุ้มครองข้อมูล" onChange={e=>upd('position', e.target.value)} /></div>
          <div className="field"><label>เบอร์</label>
            <input type="text" value={r.phone} placeholder="เบอร์โทร / เบอร์ต่อ" onChange={e=>upd('phone', e.target.value)} /></div>
        </div>

        <div style={{ fontWeight:700, color:"var(--primary-dark)", margin:"6px 0 10px" }}>กิจกรรมของหน่วยงาน</div>
        <div className="grid2">
          <div className="field"><label>ฝ่าย</label>
            <select value={r.division} onChange={e=>upd('division', e.target.value)}>
              <option value="">— เลือกฝ่าย —</option>
              {DIVISIONS.map((o,i)=><option key={i} value={o}>{o}</option>)}
            </select></div>
          <div className="field"><label>ส่วน</label>
            <select value={r.section} onChange={e=>upd('section', e.target.value)}>
              <option value="">— เลือกส่วน —</option>
              {SECTIONS.map((o,i)=><option key={i} value={o}>{o}</option>)}
            </select></div>
        </div>
      </div>
      <ModalFoot>
        <button className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
        <button className="btn btn-primary" onClick={save}>ยืนยัน</button>
      </ModalFoot>
    </Modal>
  );
}
