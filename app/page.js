"use client";
import { useState, useEffect } from "react";
import { ToastProvider, useToast } from "@/components/toast";
import Login from "@/components/Login";
import RecordList from "@/components/RecordList";
import Dashboard from "@/components/Dashboard";
import Wizard from "@/components/Wizard";
import RecorderModal from "@/components/RecorderModal";
import DataMapModal from "@/components/DataMapModal";
import { ExcelModal } from "@/components/MiscModals";
import { loadRecords, persistRecords, blankRecord, clone, uid, nowStr, recName, migrateS3, migrateS4, migrateS6 } from "@/lib/util";
import { buildXML, parseXML } from "@/lib/xmlio";

function App(){
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  const [records, setRecords] = useState([]);
  const [role, setRole] = useState(null);          // 'user' | 'admin'
  const [view, setView] = useState("login");        // login | list | form | dashboard
  const [current, setCurrent] = useState(null);

  // app-level modals
  const [newRec, setNewRec] = useState({ open:false, base:null });
  const [excel, setExcel] = useState(false);
  const [listMap, setListMap] = useState({ open:false, rec:null });

  useEffect(() => { setRecords(loadRecords()); setMounted(true); }, []);

  const commit = (next) => { setRecords(next); persistRecords(next); };
  const mergeUpsert = (list, rec) => {
    const copy = clone(rec);
    const i = list.findIndex(r => r.id===rec.id);
    if(i>=0){ const n=list.slice(); n[i]=copy; return n; }
    return [copy, ...list];
  };

  // ---- navigation / auth ----
  const chooseRole = (r) => { setRole(r); setView("list"); };
  const logout = () => { if(!confirm('ออกจากระบบ?')) return; setRole(null); setCurrent(null); setView("login"); };
  const isAdmin = role==='admin';

  // ---- record CRUD ----
  const newRecord = () => { setNewRec({ open:true, base:blankRecord() }); };
  const onNewRecorder = (recorder) => {
    setCurrent({ ...newRec.base, recorder });
    setNewRec({ open:false, base:null });
    setView("form");
  };
  const editRecord = (id) => {
    const found = records.find(r => r.id===id); if(!found) return;
    const rec = migrateS6(migrateS4(migrateS3(clone(found))));
    setCurrent(rec); setView("form");
  };
  const duplicateRecord = (id) => {
    const src = records.find(r=>r.id===id); if(!src) return;
    const copy = clone(src); copy.id=uid(); copy.status='draft'; copy.updatedAt=nowStr(); copy.updatedTs=Date.now();
    commit([copy, ...records]); toast("ทำสำเนารายการแล้ว","ok");
  };
  const deleteRecord = (id) => { if(!confirm("ยืนยันการลบรายการนี้?")) return; commit(records.filter(r=>r.id!==id)); toast("ลบรายการแล้ว","ok"); };
  const clearAll = () => {
    if(!records.length){ toast('ไม่มีรายการให้ลบ','err'); return; }
    if(!confirm('ลบรายการทั้งหมด '+records.length+' รายการ? การลบนี้ย้อนกลับไม่ได้')) return;
    commit([]); toast('ลบรายการทั้งหมดแล้ว','ok');
  };
  const seed = (n) => {
    if(records.length && !confirm('เพิ่มข้อมูลตัวอย่าง '+n+' รายการเข้าไป?\n(ข้อมูลเดิม '+records.length+' รายการจะยังอยู่)')) return;
    import("@/lib/dummy").then(({ makeDummyRecords }) => {
      const dummies = makeDummyRecords(n);
      commit([...dummies, ...records]);
      toast('เพิ่มข้อมูลตัวอย่าง '+n+' รายการแล้ว ✓','ok');
    });
  };

  // ---- from wizard ----
  const upsert = (rec) => { const r2 = { ...rec, updatedTs:Date.now() }; commit(mergeUpsert(records, r2)); setCurrent(r2); };
  const finishRecord = (rec) => { const r2 = { ...rec, updatedTs:Date.now() }; commit(mergeUpsert(records, r2)); setCurrent(r2); setTimeout(()=>{ setView("list"); setCurrent(null); }, 600); };

  // ---- import / export ----
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(records,null,2)], { type:'application/json' });
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ropa-records.json'; a.click();
  };
  const saveXML = async () => {
    if(records.length===0){ toast("ยังไม่มีข้อมูลให้บันทึก","err"); return; }
    const xml = buildXML(records);
    const blob = new Blob([xml], { type:'application/xml' });
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
    reader.onload = () => {
      try{
        const imported = parseXML(reader.result);
        if(!imported.length){ toast("ไม่พบรายการในไฟล์ XML","err"); return; }
        const mode = confirm(`พบ ${imported.length} รายการในไฟล์\n\nกด "ตกลง" = รวมกับข้อมูลเดิม (merge ตาม id)\nกด "ยกเลิก" = แทนที่ข้อมูลเดิมทั้งหมด`);
        let next;
        if(mode){ next = records.slice(); imported.forEach(r=>{ const i=next.findIndex(x=>x.id===r.id); if(i>=0) next[i]=r; else next.push(r); }); }
        else next = imported;
        commit(next); toast(`นำเข้า ${imported.length} รายการสำเร็จ`,"ok");
      }catch(e){ console.error(e); toast("อ่านไฟล์ XML ไม่สำเร็จ: รูปแบบไม่ถูกต้อง","err"); }
    };
    reader.readAsText(file, 'UTF-8');
  };

  // ---- dashboard (เฉพาะ Admin · ไม่มี PIN) ----
  const openDashboard = () => { if(isAdmin) setView("dashboard"); };

  const confirmExit = () => { if(confirm("ออกจากแบบฟอร์ม? ข้อมูลที่ยังไม่กด Save จะไม่ถูกบันทึก")){ setCurrent(null); setView("list"); } };

  const USER = { name: "Chaloemkwan loetpawnsutthi", title: "Data protection analyst supervisor", initials: "CL" };

  return (
    <>
      {mounted && view!=='login' && (
        <header className="top">
          <div>
            <h1>📋 ระบบบันทึกกิจกรรมการประมวลผลข้อมูลส่วนบุคคล (RoPA)</h1>
            <div className="sub">Record of Processing Activities — ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            {view==='form' && <button className="btn btn-ghost btn-sm" onClick={confirmExit}>✕ กลับสู่รายการ</button>}
            {role && (
              <div className="user-chip">
                <div className="uc-text">
                  <div className="uc-name">{USER.name}{isAdmin && <span className="uc-badge">Admin</span>}</div>
                  <div className="uc-title">{USER.title}</div>
                </div>
                <div className="uc-avatar">{USER.initials}</div>
                <button className="btn btn-sm uc-logout" onClick={logout}>ออกจากระบบ</button>
              </div>
            )}
          </div>
        </header>
      )}

      {!mounted ? (
        <div className="container"><div className="muted" style={{ padding:24 }}>กำลังโหลด…</div></div>
      ) : view==='login' ? (
        <Login onChoose={chooseRole} />
      ) : view==='list' ? (
        <RecordList
          records={records} isAdmin={isAdmin}
          onNew={newRecord} onEdit={editRecord} onDuplicate={duplicateRecord} onDelete={deleteRecord}
          onOpenDataMap={(rec)=>setListMap({ open:true, rec })}
          onSaveXML={saveXML} onImportXML={importXML} onExportJSON={exportJSON}
          onOpenDashboard={openDashboard} onSeed={seed} onClearAll={clearAll} onOpenExcel={()=>setExcel(true)}
        />
      ) : view==='dashboard' ? (
        <Dashboard records={records} onBack={()=>setView("list")} onEdit={editRecord} />
      ) : view==='form' && current ? (
        <Wizard current={current} setCurrent={setCurrent} isAdmin={isAdmin}
                onExit={()=>setView("list")} onUpsert={upsert} onFinish={finishRecord} />
      ) : null}

      <RecorderModal open={newRec.open} recorder={newRec.base?.recorder}
                     onCancel={()=>setNewRec({ open:false, base:null })} onSave={onNewRecorder} />
      <ExcelModal open={excel} records={records} onCancel={()=>setExcel(false)} />
      <DataMapModal open={listMap.open} rec={listMap.rec} onClose={()=>setListMap({ open:false, rec:null })} />

      {mounted && view!=='login' && (
        <footer className="app-foot">
          จัดทำขึ้นเพื่อวัตถุประสงค์ในการทำทดสอบเท่านั้น · จัดทำโดย Chaloemkwan loetpawnsutthi, Data protection analyst supervisor
        </footer>
      )}
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
