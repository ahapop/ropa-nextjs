"use client";
import { useState, useEffect } from "react";
import { Modal, ModalHead, ModalFoot } from "./ui";
import { useToast } from "./toast";
import { RadioF, SelectF, TextF, ChecksF } from "./fields";
import { MASTER } from "@/lib/master";
import { getDeep, setDeep, clone, blankS3Item, blankS6Item } from "@/lib/util";
import { emptyEditorFids } from "@/lib/stepvalid";

function useEditState(prefix, item, open){
  const [edit, setEdit] = useState(item);
  const [errors, setErrors] = useState(new Set());
  useEffect(() => { if(open){ setEdit(clone(item)); setErrors(new Set()); } }, [open, item]);
  const strip = fid => fid.slice(prefix.length + 1); // remove "s3edit." / "s6edit."
  const get = fid => getDeep(edit, strip(fid));
  const set = (fid, val) => setEdit(prev => setDeep(prev, strip(fid), val));
  return { edit, setEdit, errors, setErrors, get, set };
}

export function S6Editor({ open, item, index, existingItems, onCancel, onSave }){
  const toast = useToast();
  const st = useEditState("s6edit", item || blankS6Item(), open);
  if(!open) return null;
  const { edit, errors, setErrors, get, set } = st;
  const save = () => {
    const empties = emptyEditorFids("s6", { s6edit: edit });
    if(empties.length){ setErrors(new Set(empties)); toast("กรุณากรอกข้อมูลให้ครบทุกช่องที่จำเป็น","err"); return; }
    const t = (edit.type||"").toString().trim();
    const dupe = (existingItems||[]).some((it,i)=> i!==index && (it.type||"").toString().trim()===t);
    if(dupe){ toast("ประเภทการเก็บรักษานี้มีอยู่แล้ว — โปรดเลือกประเภทอื่น","err"); return; }
    onSave(clone(edit));
  };
  const p = { get, set, errors };
  return (
    <Modal z={80} maxWidth={760} flex onBackdrop={onCancel}>
      <ModalHead title={index>=0 ? "แก้ไขประเภทการเก็บรักษา" : "เพิ่มประเภทการเก็บรักษา"}
                 sub="1 ประเภทการเก็บรักษา (6.1) ต่อ 1 รายการ พร้อมรายละเอียด 6.2–6.9 ของประเภทนั้น" />
      <div style={{ padding:"18px 22px", overflow:"auto" }}>
        <RadioF fid="s6edit.type" label="6.1 ประเภทการเก็บรักษา" options={MASTER.retentionType} req hint="เลือก 1 ประเภท (จากชีท “ระยะเวลาในการเก็บรักษาข้อมูล”)" {...p} />
        <SelectF fid="s6edit.trigger" label="6.2 เริ่มนับจากระยะเวลา (Retention Trigger)" options={MASTER.retentionTrigger} req hint="ดึงจากชีท “ระยะเวลาในการเก็บรักษาข้อมูล”" {...p} />
        <TextF fid="s6edit.period" label="6.3 ระยะเวลาเก็บรักษาข้อมูลส่วนบุคคล" req ph="เช่น 10 ปี" {...p} />
        <TextF fid="s6edit.reason" label="6.4 เหตุผล หรือฐานทางกฎหมายในการจัดเก็บข้อมูล" area {...p} />
        <TextF fid="s6edit.legalKeep" label="6.5 การเก็บรักษาข้อมูลตามที่กฎหมายกำหนด" area {...p} />
        <ChecksF fid="s6edit.physical" label="6.6 มาตรการทางกายภาพในการรักษาความปลอดภัย" options={MASTER.physicalMeasures} req hint="ดึงจากชีท “กายภาพ”" {...p} />
        <ChecksF fid="s6edit.technical" label="6.7 มาตรการทางเทคนิคและการบริหารจัดการ" options={MASTER.technicalMeasures} req hint="ดึงจากชีท “เทคนิค”" {...p} />
        <TextF fid="s6edit.storeLoc" label="6.8 โปรดระบุแหล่งที่จัดเก็บข้อมูล" req area ph="เช่น Server ภายใน / Cloud ผู้ให้บริการ XXX" {...p} />
        <SelectF fid="s6edit.deleteMethod" label="6.9 วิธีการลบและการทำลายข้อมูล" options={MASTER.deleteMethods} req hint="ดึงจากชีท “ระยะเวลาในการเก็บรักษาข้อมูล”" {...p} />
      </div>
      <ModalFoot>
        <button className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
        <button className="btn btn-primary" onClick={save}>บันทึกรายการนี้</button>
      </ModalFoot>
    </Modal>
  );
}

export function S3Editor({ open, item, index, existingItems, onCancel, onSave }){
  const toast = useToast();
  const st = useEditState("s3edit", item || blankS3Item(), open);
  if(!open) return null;
  const { edit, errors, setErrors, get, set } = st;
  const save = () => {
    const empties = emptyEditorFids("s3", { s3edit: edit });
    if(empties.length){ setErrors(new Set(empties)); toast("กรุณากรอกข้อมูลให้ครบทุกช่องที่จำเป็น","err"); return; }
    const gen = edit.general||[], sen = edit.sensitive||[], lawS = edit.lawfulSens||[];
    if(gen.length===0 && sen.length===0){ setErrors(new Set(["s3edit.general"])); toast("ต้องเลือกข้อมูลส่วนบุคคลทั่วไป (3.3) หรืออ่อนไหว (3.4) อย่างน้อย 1 รายการ","err"); return; }
    if(sen.length>0 && lawS.length===0){ setErrors(new Set(["s3edit.lawfulSens"])); toast("เลือกข้อมูลอ่อนไหว (3.4) แล้ว ต้องระบุฐานกฎหมายอ่อนไหว (3.6) ด้วย","err"); return; }
    const o = (edit.org||"").toString().trim();
    const dupe = (existingItems||[]).some((it,i)=> i!==index && (it.org||"").toString().trim()===o);
    if(dupe){ toast("ฝ่ายงานนี้มีอยู่แล้ว — โปรดเลือกฝ่ายงานอื่น","err"); return; }
    onSave(clone(edit));
  };
  const p = { get, set, errors };
  return (
    <Modal z={80} maxWidth={760} flex onBackdrop={onCancel}>
      <ModalHead title={index>=0 ? "แก้ไขฝ่ายงานที่แบ่งปันข้อมูล" : "เพิ่มฝ่ายงานที่แบ่งปันข้อมูล"}
                 sub="1 ฝ่ายงาน (3.1) ต่อ 1 รายการ พร้อมรายละเอียด 3.2–3.6 ของฝ่ายงานนั้น" />
      <div style={{ padding:"18px 22px", overflow:"auto" }}>
        <SelectF fid="s3edit.org" label="3.1 ฝ่ายงาน / ส่วนงาน ที่ใช้ข้อมูลส่วนบุคคล" options={MASTER.orgStructure} req hint="เลือก 1 ฝ่ายงาน (ดึงจากฐานข้อมูลโครงสร้างบริษัทฯ)" {...p} />
        <TextF fid="s3edit.purpose" label="3.2 วัตถุประสงค์ในการประมวลผล" req area hint="หากเลือก 3.1 ต้องกรอก 3.2" {...p} />
        <ChecksF fid="s3edit.general" label="3.3 ข้อมูลส่วนบุคคลทั่วไป" options={MASTER.generalData} hint="ต้องเลือก 3.3 หรือ 3.4 อย่างน้อย 1 รายการ" {...p} />
        <ChecksF fid="s3edit.sensitive" label="3.4 ข้อมูลส่วนบุคคลอ่อนไหว" options={MASTER.sensitiveData} hint="ถ้าเลือกข้อนี้ ต้องระบุฐานกฎหมายอ่อนไหว (3.6) ด้วย" {...p} />
        <ChecksF fid="s3edit.lawful" label="3.5 ฐานทางกฎหมาย ตาม ม.39(6)" options={MASTER.lawfulBasis} req hint="DPD แก้ไขได้" {...p} />
        <ChecksF fid="s3edit.lawfulSens" label="3.6 ฐานทางกฎหมายในการประมวลผลข้อมูลอ่อนไหว" options={MASTER.lawfulBasisSensitive} hint="บังคับกรอกเมื่อเลือกข้อมูลอ่อนไหว (3.4)" {...p} />
      </div>
      <ModalFoot>
        <button className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
        <button className="btn btn-primary" onClick={save}>บันทึกรายการนี้</button>
      </ModalFoot>
    </Modal>
  );
}
