"use client";
import { useState, useEffect } from "react";
import { useToast } from "./toast";
import { Modal, ModalHead, ModalFoot } from "./ui";
import { DIVISIONS, sectionsFor, SECTIONS } from "@/lib/master";
import { api } from "@/lib/api-client";

const BLANK = { email:"", name:"", title:"", division:"", section:"", department:"", role:"user", password:"" };

function UserModal({ open, editing, onCancel, onSaved }){
  const toast = useToast();
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if(open) setF(editing ? { ...BLANK, ...editing, password:"" } : { ...BLANK }); }, [open, editing]);
  if(!open) return null;
  const upd = (k,v) => setF(s => ({ ...s, [k]:v }));
  const setDivision = (v) => setF(s => ({ ...s, division:v, section: sectionsFor(v).includes(s.section) ? s.section : "" }));
  const sectionOptions = f.division ? sectionsFor(f.division) : SECTIONS;
  const save = async () => {
    if(!editing && !f.email.trim()){ toast("กรุณาระบุอีเมล","err"); return; }
    if(!editing && !f.password.trim()){ toast("กรุณาระบุรหัสผ่าน","err"); return; }
    setBusy(true);
    try {
      if(editing) await api.updateUser(editing.id, { name:f.name, title:f.title, division:f.division, section:f.section, department:f.department, role:f.role, password: f.password.trim() || undefined });
      else await api.createUser({ email:f.email.trim(), name:f.name, title:f.title, division:f.division, section:f.section, department:f.department, role:f.role, password:f.password });
      onSaved();
    } catch(e){ toast(e.message,"err"); }
    setBusy(false);
  };
  return (
    <Modal z={86} maxWidth={680} flex onBackdrop={onCancel}>
      <ModalHead title={editing ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้ใหม่"} sub="กำหนดข้อมูลผู้ใช้ บทบาท และรหัสผ่าน" />
      <div style={{ padding:"18px 22px", overflow:"auto" }}>
        <div className="grid2">
          <div className="field"><label>อีเมล<span className="req">*</span></label>
            <input type="email" value={f.email} disabled={!!editing} placeholder="you@bts.co.th" onChange={e=>upd('email', e.target.value)} /></div>
          <div className="field"><label>บทบาท (Role)</label>
            <select value={f.role} onChange={e=>upd('role', e.target.value)}>
              <option value="user">ผู้ใช้ทั่วไป (user)</option>
              <option value="admin">ผู้ตรวจเอกสาร (admin)</option>
            </select></div>
          <div className="field"><label>ชื่อ–นามสกุล</label>
            <input type="text" value={f.name} onChange={e=>upd('name', e.target.value)} /></div>
          <div className="field"><label>ตำแหน่ง</label>
            <input type="text" value={f.title} placeholder="เช่น Data protection analyst" onChange={e=>upd('title', e.target.value)} /></div>
          <div className="field"><label>ฝ่าย</label>
            <select value={f.division} onChange={e=>setDivision(e.target.value)}>
              <option value="">— เลือกฝ่าย —</option>
              {DIVISIONS.map((o,i)=><option key={i} value={o}>{o}</option>)}
            </select></div>
          <div className="field"><label>ส่วน{f.division && <span className="hint" style={{ display:"inline", marginLeft:6 }}>(เฉพาะในฝ่ายที่เลือก)</span>}</label>
            <select value={f.section} onChange={e=>upd('section', e.target.value)} disabled={!!f.division && sectionOptions.length===0}>
              <option value="">{f.division && sectionOptions.length===0 ? "— ฝ่ายนี้ไม่มีส่วนย่อย —" : "— เลือกส่วน —"}</option>
              {sectionOptions.map((o,i)=><option key={i} value={o}>{o}</option>)}
            </select></div>
          <div className="field"><label>แผนก<div className="hint">ระดับล่างสุด · ถ้าระบุ จะเห็นเฉพาะข้อมูลของตัวเอง</div></label>
            <input type="text" value={f.department} placeholder="เช่น แผนกงาน 1" onChange={e=>upd('department', e.target.value)} /></div>
        </div>
        <div className="field"><label>รหัสผ่าน{!editing && <span className="req">*</span>}
          {editing && <span className="hint" style={{ display:"inline", marginLeft:6 }}>(เว้นว่างหากไม่เปลี่ยน)</span>}</label>
          <input type="text" value={f.password} placeholder={editing ? "เว้นว่างหากไม่เปลี่ยนรหัสผ่าน" : "ตั้งรหัสผ่าน"} onChange={e=>upd('password', e.target.value)} /></div>
      </div>
      <ModalFoot>
        <button className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
      </ModalFoot>
    </Modal>
  );
}

export default function UserManagement({ currentUser, onBack }){
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open:false, editing:null });

  const load = async () => { setLoading(true); try { setUsers(await api.listUsers()); } catch(e){ toast(e.message,"err"); } setLoading(false); };
  useEffect(() => { load(); }, []);

  const onSaved = () => { setModal({ open:false, editing:null }); load(); toast("บันทึกผู้ใช้แล้ว ✓","ok"); };
  const del = async (u) => {
    if(!confirm("ลบผู้ใช้ " + u.email + " ?\n(รายการ RoPA ของผู้ใช้นี้จะถูกลบไปด้วย)")) return;
    try { await api.deleteUser(u.id); load(); toast("ลบผู้ใช้แล้ว","ok"); } catch(e){ toast(e.message,"err"); }
  };
  const fmtDate = (s) => { try { return new Date(s).toLocaleString('th-TH',{ dateStyle:'medium', timeStyle:'short' }); } catch { return "—"; } };

  return (
    <div className="container-fluid">
      <div className="dash-head">
        <h2>👥 จัดการผู้ใช้ (User Management)</h2>
        <div className="filters">
          <button className="btn btn-primary btn-sm" onClick={()=>setModal({ open:true, editing:null })}>＋ เพิ่มผู้ใช้</button>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← กลับสู่รายการ</button>
        </div>
      </div>
      <div className="card">
        <div style={{ overflowX:"auto" }}>
          <table>
            <thead><tr>
              <th style={{ width:46 }}>#</th>
              <th>อีเมล</th><th>ชื่อ–นามสกุล</th><th>ตำแหน่ง</th><th>ฝ่าย / ส่วน</th>
              <th style={{ width:90 }}>บทบาท</th><th>สร้างเมื่อ</th><th style={{ width:150 }}>จัดการ</th>
            </tr></thead>
            <tbody>
              {users.map((u,i)=>(
                <tr key={u.id}>
                  <td>{i+1}</td>
                  <td><b>{u.email}</b>{u.id===currentUser.id && <span className="pill" style={{ marginLeft:6 }}>คุณ</span>}</td>
                  <td>{u.name||"—"}</td>
                  <td>{u.title||"—"}</td>
                  <td style={{ fontSize:12 }}>{[u.division,u.section].filter(Boolean).join(" / ")||"—"}</td>
                  <td><span className={"badge "+(u.role==='admin'?'done':'draft')}>{u.role==='admin'?'admin':'user'}</span></td>
                  <td className="muted">{fmtDate(u.createdAt)}</td>
                  <td><div className="row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={()=>setModal({ open:true, editing:u })}>✎ แก้ไข</button>
                    <button className="btn btn-danger btn-sm" onClick={()=>del(u)} disabled={u.id===currentUser.id}>🗑</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && users.length===0 && <div className="empty">ยังไม่มีผู้ใช้</div>}
          {loading && <div className="empty">กำลังโหลด…</div>}
        </div>
      </div>
      <UserModal open={modal.open} editing={modal.editing} onCancel={()=>setModal({ open:false, editing:null })} onSaved={onSaved} />
    </div>
  );
}
