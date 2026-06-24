"use client";
import { useState, useEffect } from "react";
import { ToastProvider, useToast } from "@/components/toast";
import Login from "@/components/Login";
import RecordList from "@/components/RecordList";
import Dashboard from "@/components/Dashboard";
import Wizard from "@/components/Wizard";
import UserManagement from "@/components/UserManagement";
import RecorderModal from "@/components/RecorderModal";
import DataMapModal from "@/components/DataMapModal";
import { ExcelModal } from "@/components/MiscModals";
import { blankRecord, clone, uid, nowStr, recName, migrateS3, migrateS4, migrateS6 } from "@/lib/util";
import { recordComplete } from "@/lib/validate";
import { buildXML, parseXML } from "@/lib/xmlio";
import { api, initials } from "@/lib/api-client";

function App(){
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);            // authenticated user (or null)
  const [records, setRecords] = useState([]);
  const [view, setView] = useState("login");          // login | list | form | dashboard | users
  const [current, setCurrent] = useState(null);

  const [newRec, setNewRec] = useState({ open:false, base:null });
  const [excel, setExcel] = useState({ open:false, data:[] });
  const [dashRecords, setDashRecords] = useState([]);
  const [listMap, setListMap] = useState({ open:false, rec:null });

  const isAdmin = user?.role === "admin";
  // สร้าง summary (ข้อมูลย่อ) จาก record เต็ม สำหรับเก็บใน list state
  const summarize = (r) => ({ id:r.id, company:r.company, status:r.status, complete: recordComplete(r),
    updatedTs:r.updatedTs, updatedAt:r.updatedAt,
    s1:{ org:r.s1?.org, activity:r.s1?.activity, activityOther:r.s1?.activityOther }, recorder:r.recorder||{} });

  useEffect(() => {
    (async () => {
      try {
        const u = await api.me();
        if(u){ setUser(u); setRecords(await api.listRecords()); setView("list"); }
      } catch {}
      setMounted(true);
    })();
  }, []);

  const reload = async () => { try { setRecords(await api.listRecords()); } catch(e){ toast(e.message, "err"); } };
  const mergeUpsert = (list, rec) => { const copy = clone(rec); const i = list.findIndex(r => r.id===rec.id); if(i>=0){ const n=list.slice(); n[i]=copy; return n; } return [copy, ...list]; };

  // ---- auth ----
  const login = async (email, password) => {
    try {
      const u = await api.login(email, password);
      setUser(u); setRecords(await api.listRecords()); setView("list");
      return null;
    } catch(e){ return e.message; }
  };
  const logout = async () => {
    if(!confirm("ออกจากระบบ?")) return;
    try { await api.logout(); } catch {}
    setUser(null); setRecords([]); setCurrent(null); setView("login");
  };

  // ---- record CRUD (ผ่าน API) ----
  const newRecord = () => { setNewRec({ open:true, base:blankRecord() }); };
  const onNewRecorder = (recorder) => { setCurrent({ ...newRec.base, recorder }); setNewRec({ open:false, base:null }); setView("form"); };
  const editRecord = async (id) => {
    try { const full = await api.getRecord(id); setCurrent(migrateS6(migrateS4(migrateS3(clone(full))))); setView("form"); }
    catch(e){ toast(e.message,"err"); }
  };
  const duplicateRecord = async (id) => {
    try {
      const full = await api.getRecord(id);
      const copy = clone(full); copy.id=uid(); copy.status='draft'; copy.updatedAt=nowStr(); copy.updatedTs=Date.now();
      await api.saveRecord(copy);
      setRecords([summarize(copy), ...records]); toast("ทำสำเนารายการแล้ว","ok");
    } catch(e){ toast(e.message,"err"); }
  };
  const deleteRecord = async (id) => {
    if(!confirm("ยืนยันการลบรายการนี้?")) return;
    try { await api.deleteRecord(id); setRecords(records.filter(r=>r.id!==id)); toast("ลบรายการแล้ว","ok"); }
    catch(e){ toast(e.message,"err"); }
  };
  const clearAll = async () => {
    if(!records.length){ toast('ไม่มีรายการให้ลบ','err'); return; }
    if(!confirm((isAdmin?'ลบรายการทั้งหมดของทุกคน ':'ลบรายการทั้งหมด ')+records.length+' รายการ? การลบนี้ย้อนกลับไม่ได้')) return;
    try { await api.clearRecords(); setRecords([]); toast('ลบรายการทั้งหมดแล้ว','ok'); }
    catch(e){ toast(e.message,"err"); }
  };
  const seed = async (n) => {
    if(records.length && !confirm('เพิ่มข้อมูลตัวอย่าง '+n+' รายการเข้าไป?')) return;
    try {
      const { makeDummyRecords } = await import("@/lib/dummy");
      await api.bulkRecords(makeDummyRecords(n));
      await reload();
      toast('เพิ่มข้อมูลตัวอย่าง '+n+' รายการแล้ว ✓','ok');
    } catch(e){ toast(e.message,"err"); }
  };
  const seedByOrg = async () => {
    if(records.length && !confirm('สร้างข้อมูลตัวอย่าง 20 รายการต่อ ฝ่าย/ส่วน (~2,400 รายการ) เป็นของบัญชีคุณ?\n(อาจใช้เวลาสักครู่)')) return;
    try {
      const { makeDummyByOrg } = await import("@/lib/dummy");
      const all = makeDummyByOrg(20);
      const CH = 200;
      for(let i=0;i<all.length;i+=CH){ await api.bulkRecords(all.slice(i, i+CH)); }
      await reload();
      toast('เพิ่มข้อมูลตัวอย่าง '+all.length+' รายการแล้ว ✓','ok');
    } catch(e){ toast(e.message,"err"); }
  };

  // ---- from wizard ----
  const upsert = async (rec) => {
    const r2 = { ...rec, updatedTs:Date.now() };
    setRecords(prev => mergeUpsert(prev, summarize(r2))); setCurrent(r2);
    try { await api.saveRecord(r2); } catch(e){ toast(e.message,"err"); }
  };
  const finishRecord = async (rec) => {
    const r2 = { ...rec, updatedTs:Date.now() };
    setRecords(prev => mergeUpsert(prev, summarize(r2))); setCurrent(r2);
    try { await api.saveRecord(r2); } catch(e){ toast(e.message,"err"); }
    setTimeout(()=>{ setView("list"); setCurrent(null); }, 600);
  };

  // ---- import / export (ดึงข้อมูลเต็มก่อน) ----
  const exportJSON = async () => {
    try {
      const full = await api.listRecordsFull();
      const blob = new Blob([JSON.stringify(full,null,2)], { type:'application/json' });
      const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ropa-records.json'; a.click();
    } catch(e){ toast(e.message,"err"); }
  };
  const saveXML = async () => {
    if(records.length===0){ toast("ยังไม่มีข้อมูลให้บันทึก","err"); return; }
    let full; try { full = await api.listRecordsFull(); } catch(e){ toast(e.message,"err"); return; }
    const xml = buildXML(full); const blob = new Blob([xml], { type:'application/xml' });
    if(window.showSaveFilePicker){
      try{
        const h = await window.showSaveFilePicker({ suggestedName:'ropa-records.xml', types:[{ description:'XML File', accept:{ 'application/xml':['.xml'] } }] });
        const w = await h.createWritable(); await w.write(blob); await w.close();
        toast("บันทึกไฟล์ XML เรียบร้อย","ok"); return;
      }catch(e){ if(e.name==='AbortError') return; }
    }
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ropa-records.xml'; a.click(); URL.revokeObjectURL(a.href);
    toast("ดาวน์โหลดไฟล์ XML แล้ว","ok");
  };
  const importXML = (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try{
        const imported = parseXML(reader.result);
        if(!imported.length){ toast("ไม่พบรายการในไฟล์ XML","err"); return; }
        const mode = confirm(`พบ ${imported.length} รายการในไฟล์\n\nกด "ตกลง" = รวมกับข้อมูลเดิม (merge ตาม id)\nกด "ยกเลิก" = แทนที่ข้อมูลเดิมทั้งหมด`);
        if(!mode) await api.clearRecords();
        await api.bulkRecords(imported);
        await reload();
        toast(`นำเข้า ${imported.length} รายการสำเร็จ`,"ok");
      }catch(e){ console.error(e); toast(e.message || "อ่านไฟล์ XML ไม่สำเร็จ","err"); }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const openDashboard = async () => {
    if(!isAdmin) return;
    try { setDashRecords(await api.listRecordsFull()); setView("dashboard"); }
    catch(e){ toast(e.message,"err"); }
  };
  const openExcel = async () => {
    try { setExcel({ open:true, data: await api.listRecordsFull() }); }
    catch(e){ toast(e.message,"err"); }
  };
  const openDataMap = async (rec) => {
    try { setListMap({ open:true, rec: await api.getRecord(rec.id) }); }
    catch(e){ toast(e.message,"err"); }
  };
  const openUsers = () => { if(isAdmin) setView("users"); };
  const confirmExit = () => { if(confirm("ออกจากแบบฟอร์ม? ข้อมูลที่ยังไม่กด Save จะไม่ถูกบันทึก")){ setCurrent(null); setView("list"); } };

  return (
    <>
      {mounted && view!=='login' && user && (
        <header className="top">
          <div>
            <h1>📋 ระบบบันทึกกิจกรรมการประมวลผลข้อมูลส่วนบุคคล (RoPA)</h1>
            <div className="sub">Record of Processing Activities — ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)</div>
            <div className="hdr-note">จัดทำขึ้นเพื่อวัตถุประสงค์ในการทำทดสอบเท่านั้น · จัดทำโดย เฉลิมขวัญ กุลพงษ์, Data protection analyst supervisor</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            {view==='form' && <button className="btn btn-ghost btn-sm" onClick={confirmExit}>✕ กลับสู่รายการ</button>}
            <div className="user-chip">
              <div className="uc-text">
                <div className="uc-name">{user.name || user.email}{isAdmin && <span className="uc-badge">Admin</span>}</div>
                <div className="uc-title">{user.title || user.email}</div>
              </div>
              <div className="uc-avatar">{initials(user.name || user.email)}</div>
              <button className="btn btn-sm uc-logout" onClick={logout}>ออกจากระบบ</button>
            </div>
          </div>
        </header>
      )}

      {!mounted ? (
        <div className="container"><div className="muted" style={{ padding:24 }}>กำลังโหลด…</div></div>
      ) : !user || view==='login' ? (
        <Login onLogin={login} />
      ) : view==='list' ? (
        <RecordList
          records={records} isAdmin={isAdmin}
          onNew={newRecord} onEdit={editRecord} onDuplicate={duplicateRecord} onDelete={deleteRecord}
          onOpenDataMap={openDataMap}
          onSaveXML={saveXML} onImportXML={importXML} onExportJSON={exportJSON}
          onOpenDashboard={openDashboard} onOpenUsers={openUsers} onSeed={seed} onSeedByOrg={seedByOrg} onClearAll={clearAll} onOpenExcel={openExcel}
        />
      ) : view==='dashboard' ? (
        <Dashboard records={dashRecords} onBack={()=>setView("list")} onEdit={editRecord} />
      ) : view==='users' ? (
        <UserManagement currentUser={user} onBack={()=>setView("list")} />
      ) : view==='form' && current ? (
        <Wizard current={current} setCurrent={setCurrent} isAdmin={isAdmin}
                onExit={()=>setView("list")} onUpsert={upsert} onFinish={finishRecord} />
      ) : null}

      <RecorderModal open={newRec.open} recorder={newRec.base?.recorder}
                     onCancel={()=>setNewRec({ open:false, base:null })} onSave={onNewRecorder} />
      <ExcelModal open={excel.open} records={excel.data} onCancel={()=>setExcel({ open:false, data:[] })} />
      <DataMapModal open={listMap.open} rec={listMap.rec} onClose={()=>setListMap({ open:false, rec:null })} />
    </>
  );
}

export default function Page(){
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}
