"use client";
import { useState, useEffect } from "react";
import { Modal, ModalHead, ModalFoot } from "./ui";
import { useToast } from "./toast";

export default function RecorderModal({ open, recorder, onCancel, onSave }){
  const toast = useToast();
  const [r, setR] = useState({ firstName:"", lastName:"", position:"", phone:"" });
  useEffect(() => { if(open) setR({ firstName:"", lastName:"", position:"", phone:"", ...(recorder||{}) }); }, [open, recorder]);
  if(!open) return null;
  const upd = (k,v) => setR(s => ({ ...s, [k]:v }));
  const save = () => {
    if(!r.firstName.trim() || !r.lastName.trim()){ toast("กรุณากรอก ชื่อ และ นามสกุล ของผู้บันทึก","err"); return; }
    onSave({ firstName:r.firstName.trim(), lastName:r.lastName.trim(), position:r.position.trim(), phone:r.phone.trim() });
  };
  return (
    <Modal z={80} maxWidth={680} onBackdrop={onCancel}>
      <ModalHead title="รายละเอียดผู้บันทึก" sub="ระบุ ชื่อ–นามสกุล ตำแหน่ง และเบอร์ติดต่อ ของผู้บันทึกรายการนี้" />
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
      </div>
      <ModalFoot>
        <button className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
        <button className="btn btn-primary" onClick={save}>ยืนยัน</button>
      </ModalFoot>
    </Modal>
  );
}
