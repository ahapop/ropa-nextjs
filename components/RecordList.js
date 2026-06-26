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
          onSaveXML, onImportXML, onExportJSON, onOpenDashboard, onOpenUsers, onSeedByOrg, onClearAll, onOpenExcel } = props;
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState('updated');   // เริ่มต้นเรียงตาม "ปรับปรุงล่าสุด" เสมอ
  const [sortDir, setSortDir] = useState(-1);            // ใหม่สุดอยู่บน
  const [groupBy, setGroupBy] = useState(null);   // null | 'company' | 'division'
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

  // เลขลำดับ "ถาวร" ตามลำดับการสร้าง (เพิ่มก่อน = 1) — ไม่เปลี่ยนเมื่อ sort/filter/แบ่งหน้า
  const seqOf = useMemo(() => {
    const ckey = r => { const t = r.createdAt ? Date.parse(r.createdAt) : NaN; return Number.isFinite(t) ? t : (r.updatedTs || 0); };
    const ordered = [...records].sort((a,b)=> (ckey(a)-ckey(b)) || String(a.id).localeCompare(String(b.id)));
    const m = new Map(); ordered.forEach((r,i)=> m.set(r.id, i+1));
    return m;
  }, [records]);

  // จัดกลุ่มซ้อน 2 ชั้น: 'company' → บริษัท→ฝ่าย · 'division' → ฝ่าย→บริษัท
  const KEYFN = { company: r=>r.company||"", division: r=>orgLevels(r.s1?.org)[0] };
  const sortGroupKeys = (keys, lv) => {
    if(lv==='company'){ const o=[...MASTER.companies];
      return keys.sort((a,b)=> ((o.indexOf(a)+1||99)-(o.indexOf(b)+1||99)) || a.localeCompare(b,'th')); }
    return keys.sort((a,b)=>a.localeCompare(b,'th'));
  };
  const tree = useMemo(() => {
    if(!groupBy) return null;
    const [L0, L1] = groupBy==='company' ? ['company','division'] : ['division','company'];
    const m0 = new Map();
    for(const r of rows){ const k=KEYFN[L0](r); if(!m0.has(k)) m0.set(k,[]); m0.get(k).push(r); }
    return sortGroupKeys([...m0.keys()], L0).map(k0=>{
      const items0 = m0.get(k0), m1 = new Map();
      for(const r of items0){ const k1=KEYFN[L1](r); if(!m1.has(k1)) m1.set(k1,[]); m1.get(k1).push(r); }
      const subs = sortGroupKeys([...m1.keys()], L1).map(k1=>({ key:k0+"@@"+k1, lv:L1, label:k1||"— ไม่ระบุ —", items:m1.get(k1) }));
      return { key:k0, lv:L0, label:k0||"— ไม่ระบุ —", count:items0.length, subs };
    });
  }, [rows, groupBy]);

  useEffect(() => { setPage(0); }, [filter, sortKey, sortDir, groupBy, records.length]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const paged = !groupBy && rows.length > PAGE_SIZE;

  const sort = (key) => { if(draggingRef.current) return; if(sortKey===key) setSortDir(d=>d*-1); else { setSortKey(key); setSortDir(1); } };
  const arrow = (k) => sortKey===k ? (sortDir===1 ? '▲' : '▼') : '';
  const toggle = (k) => setCollapsed(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const setGroup = (mode) => {
    if(groupBy===mode){ setGroupBy(null); return; }
    setGroupBy(mode);
    const [L0, L1] = mode==='company' ? ['company','division'] : ['division','company'];
    const set = new Set();   // เริ่มแบบยุบทุกกลุ่มทั้ง 2 ชั้น — record ไม่กางอัตโนมัติ (คลิกขยายได้)
    for(const r of rows){ const k0=KEYFN[L0](r); set.add(k0); set.add(k0+"@@"+KEYFN[L1](r)); }
    setCollapsed(set);
  };

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
    const num = seqOf.get(r.id) || n;   // เลขลำดับถาวรตามการสร้าง
    return (
      <tr key={r.id} className={indent ? "grec" : undefined}>
        <td>{indent ? "" : num}</td>
        <td title={act} style={indent ? { paddingLeft: indent } : undefined}>
          {indent ? <span style={{ opacity:.6, marginRight:5 }}>📄 {num}.</span> : null}<b>{act}</b></td>
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
        <div className="tb-actions">
          <div className="tb-group">
            <span className="tb-label">มุมมอง</span>
            <div className="tb-row">
              <button className={"btn btn-sm " + (groupBy==='company' ? "btn-primary" : "btn-ghost")}
                      onClick={()=>setGroup('company')} title="จัดกลุ่มตามบริษัท (เริ่มแบบยุบ)">🏢 ตามบริษัท</button>
              <button className={"btn btn-sm " + (groupBy==='division' ? "btn-primary" : "btn-ghost")}
                      onClick={()=>setGroup('division')} title="จัดกลุ่มตามฝ่าย (เริ่มแบบยุบ)">📁 ตามฝ่าย</button>
              {tableLayout==='fixed' && <button className="btn btn-ghost btn-sm" onClick={resetWidths} title="คืนความกว้างคอลัมน์อัตโนมัติ">↔ รีเซ็ตคอลัมน์</button>}
            </div>
          </div>
          <div className="tb-group">
            <span className="tb-label">นำเข้า / ส่งออก</span>
            <div className="tb-row">
              <button className="btn btn-ghost btn-sm" onClick={onSaveXML}>💾 Save XML</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>fileRef.current?.click()}>📂 โหลด XML</button>
              <button className="btn btn-ghost btn-sm" onClick={onExportJSON}>⬇ JSON</button>
              <button className="btn btn-ghost btn-sm" onClick={onOpenExcel} title="ส่งออกเป็น Excel ตามรูปแบบ ROPA — เลือกบริษัท/ฝ่ายได้">⬇ Excel</button>
            </div>
          </div>
          {isAdmin && (
            <div className="tb-group">
              <span className="tb-label">ผู้ดูแล</span>
              <div className="tb-row">
                <button className="btn btn-ghost btn-sm" onClick={onOpenDashboard}>📊 Dashboard</button>
                <button className="btn btn-ghost btn-sm" onClick={onOpenUsers} title="จัดการผู้ใช้ (เฉพาะ Admin)">👥 จัดการผู้ใช้</button>
              </div>
            </div>
          )}
          <div className="tb-group">
            <span className="tb-label">ข้อมูล</span>
            <div className="tb-row">
              <button className="btn btn-ghost btn-sm" onClick={onSeedByOrg} title="สร้างข้อมูลตัวอย่าง 20 รายการต่อ ฝ่าย/ส่วน (~2,400 รายการ) ของบัญชีคุณ">🧪 20/ฝ่าย-ส่วน</button>
              <button className="btn btn-ghost btn-sm" onClick={onClearAll} title="ลบรายการทั้งหมด">🗑 ล้างทั้งหมด</button>
            </div>
          </div>
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
              <tbody>
                {tree.map(g => {
                  const gcol = collapsed.has(g.key);
                  return (
                    <Fragment key={g.key || "__none"}>
                      <tr className="group-head" onClick={()=>toggle(g.key)}>
                        <td colSpan={COLS.length}>
                          <span style={{ display:"inline-block", width:16 }}>{gcol ? "▸" : "▾"}</span>
                          {g.lv==='company' ? "🏢" : "📁"} <b>{g.label}</b> <span className="muted" style={{ fontWeight:400 }}>({g.count} รายการ · {g.subs.length} {g.lv==='company' ? "ฝ่าย" : "บริษัท"})</span>
                        </td>
                      </tr>
                      {!gcol && g.subs.map(s => {
                        const scol = collapsed.has(s.key);
                        return (
                          <Fragment key={s.key}>
                            <tr className="group-sub" onClick={()=>toggle(s.key)}>
                              <td colSpan={COLS.length}>
                                <span style={{ display:"inline-block", width:16, marginLeft:22 }}>{scol ? "▸" : "▾"}</span>
                                {s.lv==='company' ? "🏢" : "📁"} {s.label} <span className="muted" style={{ fontWeight:400 }}>({s.items.length} รายการ)</span>
                              </td>
                            </tr>
                            {!scol && s.items.map((r,i)=>renderRow(r, i+1, 48))}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
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
