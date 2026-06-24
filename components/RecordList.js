"use client";
import { useState, useRef, useMemo } from "react";
import { recName, actDisplay } from "@/lib/util";
import { recordComplete } from "@/lib/validate";
import { MASTER } from "@/lib/master";

const STATUS_RANK = { draft:0, rejected:1, done:2 };
function sortVal(r, key){
  switch(key){
    case 'activity': return actDisplay(r);
    case 'org': return r.s1?.org || '';
    case 'company': return r.company || '';
    case 'recorder': return recName(r) || '';
    case 'updated': return r.updatedTs || 0;
    case 'status': return STATUS_RANK[r.status] ?? -1;
    default: return '';
  }
}

export default function RecordList(props){
  const { records, onNew, onEdit, onDuplicate, onDelete, onOpenDataMap,
          onSaveXML, onImportXML, onExportJSON, onOpenDashboard, onSeed, onClearAll, onOpenExcel } = props;
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState(1);
  const [groupByCompany, setGroupByCompany] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const fileRef = useRef(null);

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    let list = records.filter(r => {
      if(!f) return true;
      const hay = [r.s1?.activity, r.s1?.activityOther, r.s1?.org, r.company, recName(r)].join(' ').toLowerCase();
      return hay.includes(f);
    });
    if(sortKey){
      list = list.slice().sort((a,b)=>{
        const x = sortVal(a, sortKey), y = sortVal(b, sortKey);
        let c = (typeof x==='number' && typeof y==='number') ? x-y : x.toString().localeCompare(y.toString(),'th');
        return c * sortDir;
      });
    }
    return list;
  }, [records, filter, sortKey, sortDir]);

  // จัดกลุ่มตามบริษัท: เรียงตามลำดับ MASTER.companies ก่อน แล้วบริษัทอื่น ๆ แล้ว "ไม่ระบุ"
  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach(r => { const c = r.company || ""; if(!map.has(c)) map.set(c, []); map.get(c).push(r); });
    const order = [...MASTER.companies, ...[...map.keys()].filter(c => c && !MASTER.companies.includes(c)).sort((a,b)=>a.localeCompare(b,'th')), ""];
    const seen = new Set();
    return order.filter(c => !seen.has(c) && (seen.add(c), map.has(c)))
                .map(c => ({ company:c, label: c || "— ไม่ระบุบริษัท —", items: map.get(c) }));
  }, [rows]);

  const sort = (key) => {
    if(sortKey===key) setSortDir(d=>d*-1); else { setSortKey(key); setSortDir(1); }
  };
  const arrow = (k) => sortKey===k ? (sortDir===1 ? '▲' : '▼') : '';
  const toggleCollapse = (c) => setCollapsed(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; });
  // เปิดจัดกลุ่ม → ยุบทุกกลุ่มเป็นค่าเริ่มต้น (โชว์เฉพาะหัวบริษัท)
  const toggleGroupBy = () => setGroupByCompany(v => { const next = !v; if(next) setCollapsed(new Set(groups.map(g => g.company))); return next; });

  const renderRow = (r, n) => {
    const act = r.s1?.activity==="อื่นๆ" ? (r.s1?.activityOther||"อื่นๆ") : (r.s1?.activity||"—");
    const rejected = r.status==='rejected';
    const done = recordComplete(r);
    return (
      <tr key={r.id}>
        <td>{n}</td>
        <td><b>{act}</b></td>
        <td>{r.s1?.org||"—"}</td>
        <td>{r.company||"—"}</td>
        <td>{recName(r)||"—"}</td>
        <td style={{ fontSize:12, color:"var(--muted)" }}>{r.updatedAt||"—"}</td>
        <td><span className={"badge " + (rejected?'rejected':(done?'done':'draft'))}>{rejected?'ตีกลับ':(done?'สมบูรณ์':'ร่าง')}</span></td>
        <td><div className="row-actions">
          <button className="btn btn-ghost btn-sm" onClick={()=>onEdit(r.id)}>✎ แก้ไข</button>
          <button className="btn btn-ghost btn-sm" title="Data Mapping Diagram" onClick={()=>onOpenDataMap(r)}>🗺️</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>onDuplicate(r.id)}>⧉</button>
          <button className="btn btn-danger btn-sm" onClick={()=>onDelete(r.id)}>🗑</button>
        </div></td>
      </tr>
    );
  };

  return (
    <div className="container">
      <div className="toolbar">
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input type="text" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="ค้นหา: กิจกรรม / ฝ่าย / ผู้บันทึก ..." />
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <button className={"btn btn-sm " + (groupByCompany ? "btn-primary" : "btn-ghost")}
                  onClick={toggleGroupBy} title="สลับการแสดงผลแบบแบ่งกลุ่มตามบริษัท (เริ่มแบบยุบ)">
            📑 จัดกลุ่มบริษัท {groupByCompany ? "✓" : ""}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onSaveXML}>💾 Save XML (ไฟล์)</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>fileRef.current?.click()}>📂 โหลด XML</button>
          <button className="btn btn-ghost btn-sm" onClick={onExportJSON}>⬇ JSON</button>
          <button className="btn btn-ghost btn-sm" onClick={onOpenDashboard}>📊 Dashboard</button>
          <button className="btn btn-ghost btn-sm" onClick={onOpenExcel} title="ส่งออกเป็น Excel ตามรูปแบบ ROPA — เลือกบริษัท/ฝ่ายได้">⬇ Export Excel</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>onSeed(100)} title="สร้างข้อมูลตัวอย่างที่กรอกครบทุก Block ของ Data Mapping">🧪 ข้อมูลตัวอย่าง 100</button>
          <button className="btn btn-ghost btn-sm" onClick={onClearAll} title="ลบรายการทั้งหมด">🗑 ล้างทั้งหมด</button>
          <button className="btn btn-primary" onClick={onNew}>＋ เพิ่มรายการใหม่</button>
          <input type="file" ref={fileRef} accept=".xml,application/xml,text/xml" className="hidden"
                 onChange={e=>{ const f=e.target.files[0]; if(f) onImportXML(f); e.target.value=""; }} />
        </div>
      </div>
      <div className="card">
        <table>
          <thead><tr>
            <th style={{ width:46 }}>#</th>
            <th className="sortable" onClick={()=>sort('activity')}>กิจกรรมการประมวลผล <span className="sort-arrow">{arrow('activity')}</span></th>
            <th className="sortable" onClick={()=>sort('org')}>ฝ่าย / ส่วน <span className="sort-arrow">{arrow('org')}</span></th>
            <th className="sortable" onClick={()=>sort('company')}>บริษัท <span className="sort-arrow">{arrow('company')}</span></th>
            <th className="sortable" onClick={()=>sort('recorder')}>ผู้บันทึก <span className="sort-arrow">{arrow('recorder')}</span></th>
            <th className="sortable" onClick={()=>sort('updated')}>ปรับปรุงล่าสุด <span className="sort-arrow">{arrow('updated')}</span></th>
            <th className="sortable" style={{ width:90 }} onClick={()=>sort('status')}>สถานะ <span className="sort-arrow">{arrow('status')}</span></th>
            <th style={{ width:170 }}>จัดการ</th>
          </tr></thead>
          {groupByCompany ? (
            groups.map(g => {
              const isCollapsed = collapsed.has(g.company);
              return (
                <tbody key={g.company || "__none"}>
                  <tr className="group-head" onClick={()=>toggleCollapse(g.company)}>
                    <td colSpan={8}>
                      <span style={{ display:"inline-block", width:16 }}>{isCollapsed ? "▸" : "▾"}</span>
                      🏢 <b>{g.label}</b> <span className="muted" style={{ fontWeight:400 }}>({g.items.length} รายการ)</span>
                    </td>
                  </tr>
                  {!isCollapsed && g.items.map((r,i)=>renderRow(r, i+1))}
                </tbody>
              );
            })
          ) : (
            <tbody>{rows.map((r,i)=>renderRow(r, i+1))}</tbody>
          )}
        </table>
        {rows.length===0 && <div className="empty">ยังไม่มีรายการ — กดปุ่ม “เพิ่มรายการใหม่” เพื่อเริ่มบันทึก</div>}
      </div>
    </div>
  );
}
