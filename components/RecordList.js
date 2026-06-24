"use client";
import { useState, useRef, useMemo, useEffect, Fragment } from "react";
import { recName, actDisplay } from "@/lib/util";
import { MASTER, DIVISION_SECTIONS } from "@/lib/master";

const PAGE_SIZE = 50;
const SEP = "";

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

const COLS = [
  { label:'#', sortable:null },
  { label:'กิจกรรมการประมวลผล', sortable:'activity' },
  { label:'ฝ่าย / ส่วน', sortable:'org' },
  { label:'บริษัท', sortable:'company' },
  { label:'ผู้บันทึก', sortable:'recorder' },
  { label:'ปรับปรุงล่าสุด', sortable:'updated' },
  { label:'สถานะ', sortable:'status' },
  { label:'จัดการ', sortable:null },
];

// แยกระดับ ฝ่าย/ส่วน จากค่า org เดียว
const SEC2DIV = (() => { const m={}; for(const [d,secs] of Object.entries(DIVISION_SECTIONS)) for(const s of secs) m[s]=d; return m; })();
function orgLevels(org){
  org = (org||"").trim();
  if(org.startsWith("ส่วน")) return [ SEC2DIV[org] || "(ไม่ระบุฝ่าย)", org ];
  if(org.startsWith("ฝ่าย")) return [ org, "— (ระดับฝ่าย)" ];
  return [ org || "(ไม่ระบุหน่วยงาน)", "—" ];
}

export default function RecordList(props){
  const { records, isAdmin, onNew, onEdit, onDuplicate, onDelete, onOpenDataMap,
          onSaveXML, onImportXML, onExportJSON, onOpenDashboard, onOpenUsers, onSeed, onSeedByOrg, onClearAll, onOpenExcel } = props;
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState(1);
  const [groupBy, setGroupBy] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [colW, setColW] = useState(() => new Array(COLS.length).fill(null));
  const [page, setPage] = useState(0);
  const fileRef = useRef(null);
  const draggingRef = useRef(false);

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    let list = records.filter(r => {
      if(!f) return true;
      const hay = [r.s1?.activity, r.s1?.activityOther, r.s1?.org, r.company, r.department, recName(r)].join(' ').toLowerCase();
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

  // company -> ฝ่าย -> ส่วน -> แผนก -> records
  const nested = useMemo(() => {
    const cmap = new Map();
    for(const r of rows){
      const c = r.company || "";
      const [d, s] = orgLevels(r.s1?.org);
      const p = (r.department || "").trim() || "— (ไม่มีแผนก)";
      if(!cmap.has(c)) cmap.set(c, new Map());
      const dmap = cmap.get(c);
      if(!dmap.has(d)) dmap.set(d, new Map());
      const smap = dmap.get(d);
      if(!smap.has(s)) smap.set(s, new Map());
      const pmap = smap.get(s);
      if(!pmap.has(p)) pmap.set(p, []);
      pmap.get(p).push(r);
    }
    const cOrder = [...MASTER.companies, ...[...cmap.keys()].filter(c=>c&&!MASTER.companies.includes(c)).sort((a,b)=>a.localeCompare(b,'th')), ""];
    const seen = new Set();
    const keys = m => [...m.keys()].sort((a,b)=>a.localeCompare(b,'th'));
    return cOrder.filter(c=>!seen.has(c)&&(seen.add(c),cmap.has(c))).map(c=>{
      const dmap = cmap.get(c); let count=0;
      const divs = keys(dmap).map(d=>{
        const smap = dmap.get(d); let dcount=0;
        const secs = keys(smap).map(s=>{
          const pmap = smap.get(s); let scount=0;
          const depts = keys(pmap).map(p=>{ const items=pmap.get(p); scount+=items.length; return { dept:p, items }; });
          dcount += scount;
          return { sec:s, count:scount, depts };
        });
        count += dcount;
        return { div:d, count:dcount, secs };
      });
      return { company:c, label: c || "— ไม่ระบุบริษัท —", count, divs };
    });
  }, [rows]);

  useEffect(() => { setPage(0); }, [filter, sortKey, sortDir, groupBy, records.length]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const paged = !groupBy && rows.length > PAGE_SIZE;

  const sort = (key) => { if(draggingRef.current) return; if(sortKey===key) setSortDir(d=>d*-1); else { setSortKey(key); setSortDir(1); } };
  const arrow = (k) => sortKey===k ? (sortDir===1 ? '▲' : '▼') : '';
  const toggle = (k) => setCollapsed(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const cK = c => c;
  const dK = (c,d) => c+SEP+d;
  const sK = (c,d,s) => c+SEP+d+SEP+s;
  const pK = (c,d,s,p) => c+SEP+d+SEP+s+SEP+p;
  const toggleGroupBy = () => setGroupBy(v => {
    const next = !v;
    if(next){
      const set = new Set();
      nested.forEach(g => { set.add(cK(g.company)); g.divs.forEach(dv => { set.add(dK(g.company,dv.div)); dv.secs.forEach(sc => { set.add(sK(g.company,dv.div,sc.sec)); sc.depts.forEach(pt => set.add(pK(g.company,dv.div,sc.sec,pt.dept))); }); }); });
      setCollapsed(set);
    }
    return next;
  });

  const startResize = (e, i) => {
    e.preventDefault(); e.stopPropagation();
    draggingRef.current = false;
    const th = e.currentTarget.closest('th');
    const ths = th ? Array.from(th.parentElement.children) : [];
    const startX = e.clientX;
    let base = colW.slice();
    if(base.every(w => w == null)) base = ths.map(t => t.offsetWidth);
    const startW = base[i] || 120;
    setColW(base);
    const move = (ev) => { draggingRef.current = true; const w = Math.max(50, startW + (ev.clientX - startX)); setColW(p => { const n = p.slice(); n[i] = w; return n; }); };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); document.body.style.userSelect = ''; setTimeout(()=>{ draggingRef.current = false; }, 0); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); document.body.style.userSelect = 'none';
  };
  const resetWidths = () => setColW(new Array(COLS.length).fill(null));
  const tableLayout = colW.every(w => w == null) ? 'auto' : 'fixed';
  const tableStyle = tableLayout === 'fixed'
    ? { tableLayout, width: colW.reduce((a,w)=>a+(w||0),0) + 'px' }
    : { tableLayout, width: '100%' };

  const renderRow = (r, n, indent=0) => {
    const act = r.s1?.activity==="อื่นๆ" ? (r.s1?.activityOther||"อื่นๆ") : (r.s1?.activity||"—");
    const rejected = r.status==='rejected';
    const done = !!r.complete;
    return (
      <tr key={r.id} className={indent ? "grec" : undefined}>
        <td>{indent ? "" : n}</td>
        <td title={act} style={indent ? { paddingLeft: indent } : undefined}>
          {indent ? <span style={{ opacity:.6, marginRight:5 }}>📄 {n}.</span> : null}<b>{act}</b></td>
        <td title={r.s1?.org||""}>{r.s1?.org||"—"}</td>
        <td>{r.company||"—"}</td>
        <td title={recName(r)||""}>{recName(r)||"—"}</td>
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
    <div className="container-fluid">
      <div className="toolbar">
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input type="text" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="ค้นหา: กิจกรรม / ฝ่าย / ผู้บันทึก ..." />
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <button className={"btn btn-sm " + (groupBy ? "btn-primary" : "btn-ghost")}
                  onClick={toggleGroupBy} title="จัดกลุ่ม บริษัท → ฝ่าย → ส่วน (เริ่มแบบยุบ)">
            📑 จัดกลุ่ม {groupBy ? "✓" : ""}
          </button>
          {tableLayout==='fixed' && <button className="btn btn-ghost btn-sm" onClick={resetWidths} title="คืนความกว้างคอลัมน์อัตโนมัติ">↔ รีเซ็ตคอลัมน์</button>}
          <button className="btn btn-ghost btn-sm" onClick={onSaveXML}>💾 Save XML (ไฟล์)</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>fileRef.current?.click()}>📂 โหลด XML</button>
          <button className="btn btn-ghost btn-sm" onClick={onExportJSON}>⬇ JSON</button>
          <button className="btn btn-ghost btn-sm" onClick={onOpenDashboard} disabled={!isAdmin}
                  title={isAdmin ? "" : "เฉพาะผู้ตรวจเอกสาร (Admin) เท่านั้น"}>📊 Dashboard</button>
          {isAdmin && <button className="btn btn-ghost btn-sm" onClick={onOpenUsers} title="จัดการผู้ใช้ (เฉพาะ Admin)">👥 จัดการผู้ใช้</button>}
          <button className="btn btn-ghost btn-sm" onClick={onOpenExcel} title="ส่งออกเป็น Excel ตามรูปแบบ ROPA — เลือกบริษัท/ฝ่ายได้">⬇ Export Excel</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>onSeed(100)} title="สร้างข้อมูลตัวอย่าง 100 รายการ (org สุ่ม) ของบัญชีคุณ">🧪 ตัวอย่าง 100</button>
          <button className="btn btn-ghost btn-sm" onClick={onSeedByOrg} title="สร้างข้อมูลตัวอย่าง 20 รายการต่อ ฝ่าย/ส่วน (~2,400 รายการ) ของบัญชีคุณ">🧪 20/ฝ่าย-ส่วน</button>
          <button className="btn btn-ghost btn-sm" onClick={onClearAll} title="ลบรายการทั้งหมด">🗑 ล้างทั้งหมด</button>
          <button className="btn btn-primary" onClick={onNew}>＋ เพิ่มรายการใหม่</button>
          <input type="file" ref={fileRef} accept=".xml,application/xml,text/xml" className="hidden"
                 onChange={e=>{ const f=e.target.files[0]; if(f) onImportXML(f); e.target.value=""; }} />
        </div>
      </div>
      <div className="card">
        <div style={{ overflow:"auto", maxHeight:"calc(100vh - 200px)" }}>
          <table className="rec-table" style={tableStyle}>
            <colgroup>{COLS.map((c,i)=><col key={i} style={colW[i]!=null ? { width:colW[i]+'px' } : undefined} />)}</colgroup>
            <thead><tr>
              {COLS.map((c,i)=>(
                <th key={i} className={c.sortable ? 'sortable' : undefined} onClick={c.sortable ? ()=>sort(c.sortable) : undefined}>
                  {c.label}{c.sortable && <span className="sort-arrow"> {arrow(c.sortable)}</span>}
                  <span className="col-resizer" onMouseDown={e=>startResize(e,i)} onClick={e=>e.stopPropagation()} title="ลากเพื่อปรับความกว้าง" />
                </th>
              ))}
            </tr></thead>
            {groupBy ? (
              nested.map(g => {
                const cCol = collapsed.has(cK(g.company));
                return (
                  <tbody key={g.company || "__none"}>
                    <tr className="group-head" onClick={()=>toggle(cK(g.company))}>
                      <td colSpan={COLS.length}>
                        <span style={{ display:"inline-block", width:16 }}>{cCol ? "▸" : "▾"}</span>
                        🏢 <b>{g.label}</b> <span className="muted" style={{ fontWeight:400 }}>({g.count} รายการ · {g.divs.length} ฝ่าย)</span>
                      </td>
                    </tr>
                    {!cCol && g.divs.map(dv => {
                      const dCol = collapsed.has(dK(g.company, dv.div));
                      return (
                        <Fragment key={dv.div}>
                          <tr className="group-sub" onClick={()=>toggle(dK(g.company, dv.div))}>
                            <td colSpan={COLS.length}>
                              <span style={{ display:"inline-block", width:16, marginLeft:22 }}>{dCol ? "▸" : "▾"}</span>
                              📁 {dv.div} <span className="muted" style={{ fontWeight:400 }}>({dv.count} รายการ · {dv.secs.length} ส่วน)</span>
                            </td>
                          </tr>
                          {!dCol && dv.secs.map(sc => {
                            const sCol = collapsed.has(sK(g.company, dv.div, sc.sec));
                            return (
                              <Fragment key={sc.sec}>
                                <tr className="group-sub2" onClick={()=>toggle(sK(g.company, dv.div, sc.sec))}>
                                  <td colSpan={COLS.length}>
                                    <span style={{ display:"inline-block", width:16, marginLeft:44 }}>{sCol ? "▸" : "▾"}</span>
                                    📂 {sc.sec} <span className="muted" style={{ fontWeight:400 }}>({sc.count} รายการ · {sc.depts.length} แผนก)</span>
                                  </td>
                                </tr>
                                {!sCol && sc.depts.map(pt => {
                                  const pCol = collapsed.has(pK(g.company, dv.div, sc.sec, pt.dept));
                                  return (
                                    <Fragment key={pt.dept}>
                                      <tr className="group-sub3" onClick={()=>toggle(pK(g.company, dv.div, sc.sec, pt.dept))}>
                                        <td colSpan={COLS.length}>
                                          <span style={{ display:"inline-block", width:16, marginLeft:66 }}>{pCol ? "▸" : "▾"}</span>
                                          🗂️ {pt.dept} <span className="muted" style={{ fontWeight:400 }}>({pt.items.length})</span>
                                        </td>
                                      </tr>
                                      {!pCol && pt.items.map((r,i)=>renderRow(r, i+1, 90))}
                                    </Fragment>
                                  );
                                })}
                              </Fragment>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                );
              })
            ) : (
              <tbody>{pageRows.map((r,i)=>renderRow(r, safePage*PAGE_SIZE + i + 1))}</tbody>
            )}
          </table>
        </div>
        {paged && (
          <div className="pager">
            <span className="muted">ทั้งหมด {rows.length} รายการ · หน้า {safePage+1} / {totalPages}</span>
            <div style={{ display:"flex", gap:6 }}>
              <button className="btn btn-ghost btn-sm" disabled={safePage===0} onClick={()=>setPage(0)}>« แรก</button>
              <button className="btn btn-ghost btn-sm" disabled={safePage===0} onClick={()=>setPage(safePage-1)}>‹ ก่อนหน้า</button>
              <button className="btn btn-ghost btn-sm" disabled={safePage>=totalPages-1} onClick={()=>setPage(safePage+1)}>ถัดไป ›</button>
              <button className="btn btn-ghost btn-sm" disabled={safePage>=totalPages-1} onClick={()=>setPage(totalPages-1)}>สุด »</button>
            </div>
          </div>
        )}
        {rows.length===0 && <div className="empty">ยังไม่มีรายการ — กดปุ่ม “เพิ่มรายการใหม่” เพื่อเริ่มบันทึก</div>}
      </div>
    </div>
  );
}
