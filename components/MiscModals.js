"use client";
import { useState, useEffect, useMemo } from "react";
import { Modal, ModalHead, ModalFoot } from "./ui";
import { useToast } from "./toast";
import { MASTER, PIN_KEY } from "@/lib/master";
import { buildRopaXlsx } from "@/lib/xlsx";

/* ---- Reject (ตีกลับ) — admin only ---- */
export function RejectModal({ open, initialComment, ownerName, onCancel, onConfirm }){
  const toast = useToast();
  const [c, setC] = useState("");
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { if(open){ setC(initialComment||""); setInvalid(false); } }, [open, initialComment]);
  if(!open) return null;
  const confirm = () => {
    const v = c.trim();
    if(!v){ setInvalid(true); toast("กรุณากรอกหมายเหตุก่อนตีกลับ","err"); return; }
    onConfirm(v);
  };
  return (
    <Modal z={86} maxWidth={620} flex onBackdrop={onCancel}>
      <ModalHead title="⛔ ตีกลับเอกสารเพื่อแก้ไข (Reject)" color="#b3261e"
                 sub="ระบุหมายเหตุจากผู้ตรวจ เพื่อแจ้งให้ผู้กรอกปรับปรุงตามความเห็น" />
      <div style={{ padding:"18px 22px" }}>
        <div className={"field" + (invalid ? " invalid" : "")}>
          <label>หมายเหตุจากผู้ตรวจ (Comment)<span className="req">*</span>
            <div className="hint">ระบุจุดที่ต้องแก้ไข/เหตุผลในการตีกลับ — ข้อความนี้จะถูกส่งให้ผู้กรอก</div></label>
          <textarea value={c} onChange={e=>setC(e.target.value)}
            placeholder="เช่น กรุณาระบุฐานทางกฎหมายในข้อ 2.5 และตรวจสอบระยะเวลาเก็บรักษาในข้อ 6 ให้สอดคล้องกับนโยบาย" />
          <div className="errmsg">กรุณากรอกหมายเหตุก่อนตีกลับ</div>
        </div>
      </div>
      <ModalFoot>
        <button className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
        <button className="btn btn-danger" onClick={confirm}>ยืนยันการตีกลับ &amp; แจ้งผู้กรอก</button>
      </ModalFoot>
    </Modal>
  );
}

/* ---- "email sent" popup ---- */
export function SentModal({ open, owner, onClose }){
  if(!open) return null;
  return (
    <Modal z={90} maxWidth={480} onBackdrop={onClose}>
      <div style={{ textAlign:"center" }}>
        <div style={{ padding:"26px 24px 8px", fontSize:40 }}>📧</div>
        <div style={{ padding:"0 26px 6px", fontSize:16, fontWeight:700, color:"var(--primary-dark)" }}>ส่งอีเมลแจ้งเจ้าของ Record แล้ว</div>
        <div style={{ padding:"0 26px 18px", fontSize:13, color:"#444" }}>
          ระบบได้ส่งอีเมลแจ้ง <b>เจ้าของ Record</b> (ผู้กรอก: <b>{owner}</b>) ให้ปรับปรุงเอกสารตามหมายเหตุของผู้ตรวจแล้ว
          <br /><span style={{ color:"#999", fontSize:12 }}>(ตัวอย่างสาธิต — ไม่ได้ส่งอีเมลจริง)</span>
        </div>
        <div style={{ padding:"14px 22px", borderTop:"1px solid var(--line)", background:"#fbfcfe" }}>
          <button className="btn btn-primary" onClick={onClose}>ตกลง</button>
        </div>
      </div>
    </Modal>
  );
}

/* ---- Export Excel ---- */
export function ExcelModal({ open, records, onCancel }){
  const toast = useToast();
  const [comp, setComp] = useState("");
  const [dep, setDep] = useState("");
  useEffect(() => { if(open){ setComp(""); setDep(""); } }, [open]);
  const depts = useMemo(() => {
    const set = new Set();
    records.forEach(r => { if((!comp || r.company===comp) && r.s1?.org) set.add(r.s1.org); });
    return [...set].sort((a,b)=>a.localeCompare(b,'th'));
  }, [records, comp]);
  const filtered = useMemo(() => records.filter(r => (!comp || r.company===comp) && (!dep || r.s1?.org===dep)), [records, comp, dep]);
  if(!open) return null;
  const doExport = () => {
    if(!filtered.length){ toast("ไม่มีรายการตามเงื่อนไขที่เลือก","err"); return; }
    const bytes = buildRopaXlsx(filtered);
    const blob = new Blob([bytes], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const name = ("ROPA_" + (comp||"ALL") + "_" + (dep||"ALL") + ".xlsx").replace(/[\\/:*?"<>|#\s]+/g,"_").replace("_.xlsx",".xlsx");
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    onCancel(); toast("ส่งออก Excel " + filtered.length + " รายการแล้ว ✓","ok");
  };
  return (
    <Modal z={86} maxWidth={520} onBackdrop={onCancel}>
      <ModalHead title="⬇ ส่งออก Excel (รูปแบบ ROPA)"
                 sub="เลือกบริษัทและฝ่าย/ส่วน เพื่อกรองรายการที่จะส่งออก (แต่ละรายการ = 1 แถวในชีต ROPA#Department)" />
      <div style={{ padding:"18px 22px" }}>
        <div className="field"><label>บริษัท (Company)</label>
          <select value={comp} onChange={e=>{ setComp(e.target.value); setDep(""); }}>
            <option value="">— ทั้งหมด —</option>
            {MASTER.companies.map(c=><option key={c} value={c}>{c}</option>)}
          </select></div>
        <div className="field"><label>ฝ่าย / ส่วน (Business Function)</label>
          <select value={dep} onChange={e=>setDep(e.target.value)}>
            <option value="">— ทั้งหมด —</option>
            {depts.map(o=><option key={o} value={o}>{o}</option>)}
          </select></div>
        <div style={{ fontSize:13, color:"var(--primary-dark)", background:"var(--primary-light)", padding:"10px 12px", borderRadius:8 }}>
          จำนวนรายการที่จะส่งออก: <b>{filtered.length}</b> รายการ
        </div>
      </div>
      <ModalFoot>
        <button className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
        <button className="btn btn-primary" onClick={doExport}>⬇ ดาวน์โหลด .xlsx</button>
      </ModalFoot>
    </Modal>
  );
}

/* ---- PIN gate (client-side) ---- */
export function PinModal({ open, onCancel, onUnlock }){
  const toast = useToast();
  const [v, setV] = useState("");
  const isSet = typeof window !== "undefined" && !!localStorage.getItem(PIN_KEY);
  useEffect(() => { if(open) setV(""); }, [open]);
  if(!open) return null;
  const submit = () => {
    const val = v.trim();
    const stored = localStorage.getItem(PIN_KEY);
    if(!stored){
      if(!/^\d{4,6}$/.test(val)){ toast("PIN ต้องเป็นตัวเลข 4–6 หลัก","err"); return; }
      localStorage.setItem(PIN_KEY, val); toast("ตั้งรหัส PIN เรียบร้อย","ok"); onUnlock(); return;
    }
    if(val !== stored){ toast("PIN ไม่ถูกต้อง","err"); return; }
    onUnlock();
  };
  return (
    <Modal z={85} maxWidth={360} onBackdrop={onCancel}>
      <ModalHead title={isSet ? "กรอกรหัส PIN สำหรับ Admin" : "ตั้งรหัส PIN สำหรับ Admin (ครั้งแรก)"}
                 sub={isSet ? "กรอก PIN เพื่อเข้าหน้า Dashboard" : "ตั้ง PIN 4–6 หลัก เพื่อป้องกันการเข้าหน้า Dashboard"} />
      <div style={{ padding:"20px 22px" }}>
        <input id="pinInput" type="password" inputMode="numeric" maxLength={6} autoComplete="off" autoFocus
               value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') submit(); }} />
        <p className="muted" style={{ margin:"10px 0 0" }}>หมายเหตุ: PIN นี้เป็นการป้องกันเบื้องต้นฝั่งผู้ใช้ (client-side) ไม่ใช่ระบบความปลอดภัยจริง</p>
      </div>
      <ModalFoot>
        <button className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
        <button className="btn btn-primary" onClick={submit}>ยืนยัน</button>
      </ModalFoot>
    </Modal>
  );
}
