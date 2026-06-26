"use client";
import { useState, useMemo, useEffect } from "react";
import { MASTER, STEPS } from "@/lib/master";
import { recName, actName } from "@/lib/util";
import { recordComplete } from "@/lib/validate";
import { analyze, buildWorklist } from "@/lib/analytics";
import { buildSheetsXlsx } from "@/lib/xlsx";
import { api } from "@/lib/api-client";
import { rangeToEpoch } from "@/lib/daterange";
import RangeFilter from "./RangeFilter";
import { useToast } from "./toast";

/* ---------- helpers ---------- */
function Kpi({ n, t, sub, cls }){
  return <div className={"kpi " + (cls||"")}><div className="n">{n}</div><div className="t">{t}</div>{sub && <div className="sub2">{sub}</div>}</div>;
}
function Bars({ items }){
  if(!items.length) return <div className="muted" style={{ padding:6 }}>ไม่มีข้อมูล</div>;
  const m = Math.max(1, ...items.map(i=>i.n));
  return items.map((i,k)=>(
    <div className="bar-row" key={k}>
      <div className="bar-label" title={i.label}>{i.label}</div>
      <div className="bar-track"><div className="bar-fill" style={{ width:(i.n/m*100)+'%' }} /></div>
      <div className="bar-val">{i.n}</div>
    </div>
  ));
}
function Section({ children, note }){ return <div className="dsection">{children}{note && <small>· {note}</small>}</div>; }
function Pager({ page, pages, total, set }){
  if(pages<=1) return null;
  return (
    <div className="pager">
      <span className="muted">หน้า {page+1}/{pages} · {total} รายการ</span>
      <div style={{ display:"flex", gap:6 }}>
        <button className="btn btn-ghost btn-sm" disabled={page<=0} onClick={()=>set(0)}>« แรก</button>
        <button className="btn btn-ghost btn-sm" disabled={page<=0} onClick={()=>set(page-1)}>‹ ก่อนหน้า</button>
        <button className="btn btn-ghost btn-sm" disabled={page>=pages-1} onClick={()=>set(page+1)}>ถัดไป ›</button>
        <button className="btn btn-ghost btn-sm" disabled={page>=pages-1} onClick={()=>set(pages-1)}>สุด »</button>
      </div>
    </div>
  );
}
// แบ่งหน้า array ในหน่วยความจำ
function paginate(arr, page, per){ const pages=Math.max(1,Math.ceil(arr.length/per)); const p=Math.min(Math.max(0,page),pages-1); return { pages, page:p, slice:arr.slice(p*per, p*per+per) }; }
function dl(bytes, filename){
  const blob = new Blob([bytes], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}
// ไล่เฉดแดงตามความหนาแน่น (heatmap)
function heatBg(v, max){ if(!v) return "transparent"; const t = Math.min(1, v/Math.max(1,max)); return `rgba(217,83,79,${0.10 + t*0.55})`; }

export default function Dashboard({ onBack, onEdit }){
  const toast = useToast();
  const [comp, setComp] = useState("");
  const [now] = useState(()=>Date.now());
  const [snaps, setSnaps] = useState([]);
  const [busy, setBusy] = useState(false);
  const [wlPage, setWlPage] = useState(0);
  const [gapPage, setGapPage] = useState(0);
  const [recPage, setRecPage] = useState(0);
  const [progPage, setProgPage] = useState(0);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [range, setRange] = useState({ preset:"year", from:"", to:"" });   // ค่าเริ่มต้น "ปีนี้"

  useEffect(()=>{ (async()=>{ try{ setSnaps(await api.snapshots(120)); }catch{} })(); }, []);
  useEffect(()=>{ setWlPage(0); setGapPage(0); setRecPage(0); setProgPage(0); }, [comp]); // รีเซ็ตหน้าเมื่อเปลี่ยนบริษัท
  // โหลดข้อมูลตามช่วงเวลา (server-side filter) — Dashboard เปิดทันที แล้วค่อยโหลด
  useEffect(()=>{
    const r = rangeToEpoch(range, now);
    if(r === "skip") return;   // custom ยังไม่เลือกวันที่ — ยังไม่ยิง query (กันโหลดทั้งหมดโดยไม่ตั้งใจ)
    let cancelled=false; (async()=>{
      setLoading(true);
      try { const data = await api.listRecordsFull(r); if(!cancelled) setRecords(data); }
      catch(e){ if(!cancelled) toast(e.message,"err"); }
      finally { if(!cancelled){ setLoading(false); setLoaded(true); } }
    })(); return ()=>{ cancelled=true; };
  }, [range.preset, range.from, range.to]);

  const R = useMemo(()=> records.filter(r=>!comp || r.company===comp), [records, comp]);
  const d = useMemo(()=> analyze(R, { now, company:comp, allRecords:records }), [R, now, comp, records]);
  const byCompany = useMemo(()=> MASTER.companies.map(c=>({ label:c, n:records.filter(r=>r.company===c).length })).filter(x=>!comp||x.label===comp), [records, comp]);

  // trend: รวม %สมบูรณ์ต่อวัน (ทุกบริษัท หรือบริษัทที่กรอง)
  const trend = useMemo(()=>{
    const byDay = {};
    for(const s of snaps){ if(comp && s.company!==comp) continue; const k=s.day?.slice(0,10)||s.day;
      const o = byDay[k] = byDay[k] || { day:k, total:0, complete:0 }; o.total+=s.total; o.complete+=s.complete; }
    return Object.values(byDay).sort((a,b)=>a.day<b.day?-1:1).map(o=>({ ...o, pct: o.total?Math.round(o.complete/o.total*100):0 }));
  }, [snaps, comp]);

  const exportReport = async (period) => {
    try { setBusy(true);
      const { buildReportWorkbook } = await import("@/lib/report");
      dl(buildReportWorkbook(records.filter(r=>!comp||r.company===comp), period, now),
         `ropa-report-${period}${comp?"-"+comp:""}.xlsx`);
    } catch(e){ toast(e.message,"err"); } finally { setBusy(false); }
  };
  const exportWorklist = () => {
    const wl = buildWorklist(R);
    const rows = [["ระดับ","ความเสี่ยง","มาตรา","บริษัท","หน่วยงาน","กิจกรรม","ผู้บันทึก"]];
    for(const w of wl) rows.push([w.level==="critical"?"ร้ายแรง":"เฝ้าระวัง", w.risk, w.matter, w.company, w.org, w.activity, w.recorder]);
    dl(buildSheetsXlsx([{ name:"Worklist ความเสี่ยง", rows }]), `ropa-worklist${comp?"-"+comp:""}.xlsx`);
  };
  const snapshotNow = async () => {
    try { setBusy(true); await api.captureSnapshot(); setSnaps(await api.snapshots(120)); toast("บันทึก snapshot วันนี้แล้ว ✓","ok"); }
    catch(e){ toast(e.message,"err"); } finally { setBusy(false); }
  };

  const riskKeys = Object.keys(d.riskLabels);
  const wl = paginate(d.riskItems, wlPage, 25);
  const gp = paginate(d.orgGap, gapPage, 60);
  const rc = paginate(d.recent, recPage, 12);
  const pr = paginate(d.orgProgress, progPage, 12);

  return (
    <div className="container-fluid">
      <div className="dash-head">
        <h2>📊 Dashboard ผู้ดูแล RoPA</h2>
        <div className="filters">
          <label className="muted">บริษัท:</label>
          <select value={comp} onChange={e=>setComp(e.target.value)}>
            <option value="">ทุกบริษัท</option>
            {MASTER.companies.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <RangeFilter range={range} setRange={setRange} />
          <span className="muted" style={{ minWidth:96 }}>{loading ? "⏳ กำลังโหลด…" : (records.filter(r=>!comp||r.company===comp).length+" รายการ")}</span>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={()=>exportReport("daily")}>📄 รายวัน</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={()=>exportReport("weekly")}>📄 รายสัปดาห์</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={()=>exportReport("monthly")}>📄 รายเดือน</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={snapshotNow} title="บันทึกภาพรวมวันนี้เข้าประวัติ (trend)">📌 Snapshot</button>
          <button className="btn btn-primary btn-sm" onClick={onBack}>← กลับสู่รายการ</button>
        </div>
      </div>

      {!loaded ? <div className="empty">⏳ กำลังโหลดข้อมูล Dashboard…</div> : (<>
      {/* ===== Alerts ===== */}
      {d.alerts.length > 0 && (
        <div className="alert-banner">
          <h3>🔔 การแจ้งเตือนที่ต้องจัดการ ({d.alerts.length})</h3>
          <div className="alert-chips">
            {d.alerts.map((a,i)=>(
              <span className={"alert-chip "+a.level} key={i} title={a.hint||""}>
                <span className="ac-n">{a.n}</span>{a.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ===== Zone A: Executive Scorecard ===== */}
      <Section note={comp?("บริษัท "+comp):"ทุกบริษัท"}>🟦 ภาพรวมผู้บริหาร (Scorecard)</Section>
      <div className="kpis">
        <Kpi n={d.total} t="รายการทั้งหมด" sub={d.done+" สมบูรณ์ · "+d.draft+" ร่าง"} />
        <Kpi n={d.donePct+"%"} t="ความสมบูรณ์รวม" sub={"เฉลี่ย/รายการ "+d.avgPct+"%"} cls={d.donePct<50?"warn":(d.donePct<70?"amber":"green")} />
        <Kpi n={d.criticalCount} t="⚠️ เสี่ยงร้ายแรง (Critical)" sub="ต้องสั่งแก้ทันที" cls={d.criticalCount?"warn":"green"} />
        <Kpi n={d.closedNotCompliant} t="ปิดงานแต่ยังไม่ compliant" sub="ห้ามปิดถ้ายังเสี่ยง" cls={d.closedNotCompliant?"warn":""} />
        <Kpi n={d.staleBuckets.d30} t="งานค้าง > 30 วัน" sub="draft นิ่งนาน" cls={d.staleBuckets.d30?"amber":""} />
        <Kpi n={d.waiting.length+" / "+d.rejected.length} t="รอตรวจ / ตีกลับ" sub="คิวงาน" cls={d.rejected.length?"warn":""} />
      </div>

      {/* trend + by company */}
      <div className="dash-grid">
        <div className="dcard">
          <h3>แนวโน้ม % สมบูรณ์ (จาก snapshot รายวัน)</h3>
          {trend.length ? (<>
            <div className="trend-bars">
              {trend.slice(-40).map((t,i)=><div className="tb" key={i} style={{ height:Math.max(2,t.pct)+"%" }} title={t.day+" : "+t.pct+"%"} />)}
            </div>
            <div className="lblrow"><span>{trend[0].day} → {trend[trend.length-1].day}</span><span>ล่าสุด {trend[trend.length-1].pct}%</span></div>
          </>) : <div className="muted" style={{ padding:8 }}>ยังไม่มีประวัติ — กด “📌 Snapshot” เพื่อเริ่มเก็บ แล้ว cron จะเก็บให้ทุกวัน</div>}
        </div>
        <div className="dcard">
          <h3>จำนวนรายการแยกตามบริษัท</h3>
          <Bars items={byCompany} />
          <h3 style={{ marginTop:16 }}>สถานะความสมบูรณ์</h3>
          <div className="donut-wrap">
            <div className="donut" style={{ background:`conic-gradient(var(--accent) ${d.donePct}%, #e3e9f2 0)` }}>
              <div className="donut-hole"><b>{d.donePct}%</b><small>สมบูรณ์</small></div>
            </div>
            <div className="legend">
              <div><i style={{ background:"var(--accent)" }} /> สมบูรณ์ — {d.done}</div>
              <div><i style={{ background:"#e3e9f2" }} /> ร่าง/ไม่สมบูรณ์ — {d.draft}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Zone C: ความเสี่ยง & Compliance ===== */}
      <Section note="หัวใจของการกำกับ PDPA">🔴 ความเสี่ยง & Compliance</Section>
      <div className="cards5">
        <Kpi n={d.riskCount.c1||0} t="อ่อนไหวไร้ฐานกฎหมาย" sub="ม.26" cls={(d.riskCount.c1||0)?"warn":""} />
        <Kpi n={d.riskCount.c2||0} t="โอนตปท.ไร้ safeguard" sub="ม.28/29" cls={(d.riskCount.c2||0)?"warn":""} />
        <Kpi n={d.riskCount.c3dpa||0} t="เปิดเผยขาด DPA" sub="Data Processor" cls={(d.riskCount.c3dpa||0)?"warn":""} />
        <Kpi n={d.riskCount.c4||0} t="ไม่มีกำหนดลบ" sub="Retention" cls={(d.riskCount.c4||0)?"amber":""} />
        <Kpi n={d.riskCount.c5||0} t="บุคคลพิเศษ Consent=N" sub="ม.20" cls={(d.riskCount.c5||0)?"amber":""} />
        <Kpi n={d.sens} t="มีข้อมูลอ่อนไหว" sub={"เปิดเผยภายนอก "+d.ext+" · โอนตปท. "+d.cross} />
      </div>

      {!comp && d.riskByCompany.length>0 && (
        <div className="dcard" style={{ marginBottom:14, overflowX:"auto" }}>
          <h3>ความเสี่ยงราย บริษัท × ประเภท (heatmap)</h3>
          <div className="dz"><table className="heat-tbl">
            <thead><tr><th>บริษัท</th>{riskKeys.map(k=><th key={k} title={d.riskLabels[k]}>{d.riskLabels[k].split(" (")[0]}</th>)}</tr></thead>
            <tbody>{d.riskByCompany.map(row=>{
              const mx = Math.max(1, ...riskKeys.map(k=>row[k]||0));
              return <tr key={row.company}><td><b>{row.company}</b> <span className="muted">({row.total})</span></td>
                {riskKeys.map(k=><td key={k} style={{ background:heatBg(row[k]||0, mx) }}>{row[k]||0}</td>)}</tr>;
            })}</tbody>
          </table></div>
        </div>
      )}

      <div className="dcard" style={{ marginBottom:14 }}>
        <h3 style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>🛠 Remediation Worklist ({d.riskItems.length})</span>
          {d.riskItems.length>0 && <button className="btn btn-ghost btn-sm" onClick={exportWorklist}>⬇ Export Worklist</button>}
        </h3>
        {d.riskItems.length ? (<>
          <div className="dz"><table>
            <thead><tr><th>กิจกรรม / หน่วยงาน</th><th>ข้อสังเกต</th><th style={{ width:110 }}>จัดการ</th></tr></thead>
            <tbody>{wl.slice.map((x,k)=>(
              <tr key={wl.page+"-"+k}>
                <td><b>{actName(x.r)}</b><div className="muted">{(x.r.company||'-')+' · '+(x.r.s1?.org||'-')+' · '+(recName(x.r)||'-')}</div></td>
                <td>{x.flags.map((z,j)=><span className={"pill "+(z.level==="critical"?"warn":"amber")} key={j} title={z.matter}>{z.label}{z.matter?(" ("+z.matter+")"):""}</span>)}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={()=>onEdit(x.r.id)}>✎ เปิดแก้</button></td>
              </tr>
            ))}</tbody>
          </table></div>
          <Pager page={wl.page} pages={wl.pages} total={d.riskItems.length} set={setWlPage} />
        </>) : <div className="muted" style={{ padding:8 }}>ไม่พบความเสี่ยง 🎉</div>}
      </div>

      {/* ===== Zone D: Coverage ===== */}
      <Section note="จุดบอด PDPA">🗺 ความครอบคลุม (Coverage)</Section>
      <div className="cards5">
        {d.coverageByCompany.filter(c=>!comp||c.company===comp).map(c=>(
          <div className="kpi" key={c.company} style={{ borderLeftColor: c.covered===c.orgs ? "var(--accent)" : (c.covered? "var(--warn)":"var(--danger)") }}>
            <div className="n" style={{ fontSize:20 }}>{c.covered}/{c.orgs}</div>
            <div className="t"><b>{c.company}</b> หน่วยงานที่มี RoPA</div>
            <div className="sub2">สมบูรณ์ {c.completeOrgs} · {c.records} รายการ</div>
          </div>
        ))}
      </div>
      <div className="dash-grid">
        <div className="dcard">
          <h3>หน่วยงานตามสถานะ ({d.denomCount} หน่วยงาน · 🔴 ไม่มี {d.orgGapCounts.none} · 🟡 ร่าง {d.orgGapCounts.draft} · 🟢 สมบูรณ์ {d.orgGapCounts.ok})</h3>
          <div className="gapgrid">
            {gp.slice.map((g,i)=><span className={"gapchip "+g.state} key={i} title={g.division+" · "+g.records+" รายการ"}>{g.org}</span>)}
          </div>
          <Pager page={gp.page} pages={gp.pages} total={d.orgGap.length} set={setGapPage} />
        </div>
        <div className="dcard">
          <h3>ความครอบคลุมกิจกรรม ({d.activityCovered}/{d.activityTotal})</h3>
          <div className="actgrid">
            {d.activityCoverage.map((a,i)=><span className={"actchip "+(a.has?"has":"no")} key={i}>{a.has?"✓":"—"} {a.activity}</span>)}
          </div>
        </div>
      </div>

      {/* ===== Zone B: คุณภาพข้อมูล ===== */}
      <Section>🟩 ความครบถ้วน & คุณภาพข้อมูล</Section>
      <div className="dash-grid">
        <div className="dcard">
          <h3>ช่องที่ยังว่างบ่อยที่สุด (Top {d.missingFields.length})</h3>
          <Bars items={d.missingFields.map(m=>({ label:m.label, n:m.n }))} />
          <div className="muted" style={{ marginTop:8 }}>ผู้บันทึกไม่ระบุชื่อ: {d.noRecorder} รายการ</div>
        </div>
        <div className="dcard" style={{ overflowX:"auto" }}>
          <h3>ความไม่สมบูรณ์ราย ฝ่าย × ขั้นตอน (heatmap จำนวนที่ยังไม่ครบ)</h3>
          {d.stepHeat.length ? (
            <div className="dz"><table className="heat-tbl">
              <thead><tr><th>ฝ่าย</th>{STEPS.map((s,i)=><th key={i} title={s.title}>{i+1}</th>)}</tr></thead>
              <tbody>{d.stepHeat.map(row=>{
                const mx = Math.max(1, ...row.steps);
                return <tr key={row.div}><td title={row.div}>{row.div} <span className="muted">({row.total})</span></td>
                  {row.steps.map((v,i)=><td key={i} style={{ background:heatBg(v, mx) }}>{v||""}</td>)}</tr>;
              })}</tbody>
            </table></div>
          ) : <div className="muted" style={{ padding:8 }}>ไม่มีข้อมูล</div>}
        </div>
      </div>

      {/* ===== Zone E: ติดตามงาน ===== */}
      <Section>🟨 การติดตามงาน & เฝ้าระวัง</Section>
      <div className="cards5">
        <Kpi n={d.staleBuckets.d7} t="ค้าง 7–14 วัน" cls={d.staleBuckets.d7?"amber":""} />
        <Kpi n={d.staleBuckets.d15} t="ค้าง 15–30 วัน" cls={d.staleBuckets.d15?"amber":""} />
        <Kpi n={d.staleBuckets.d30} t="ค้าง > 30 วัน" cls={d.staleBuckets.d30?"warn":""} />
        <Kpi n={d.rejected.length} t="ถูกตีกลับ (rejected)" cls={d.rejected.length?"warn":""} />
        <Kpi n={d.overdue} t="เลยกำหนดส่ง (overdue)" sub="ยังไม่สมบูรณ์" cls={d.overdue?"warn":""} />
        <Kpi n={d.dueSoon} t="ใกล้ครบกำหนด ≤7วัน" cls={d.dueSoon?"amber":""} />
        <Kpi n={d.updatedToday} t="เคลื่อนไหววันนี้" cls="green" />
        <Kpi n={d.updated7d} t="เคลื่อนไหว 7 วัน" />
      </div>
      <div className="dash-grid">
        <div className="dcard">
          <h3>กิจกรรมล่าสุด</h3>
          {d.recent.length ? (<>
            <div className="dz"><table>
              <thead><tr><th>กิจกรรม</th><th>บริษัท</th><th>ผู้บันทึก</th><th>ปรับปรุง</th><th style={{ width:80 }}>สถานะ</th></tr></thead>
              <tbody>{rc.slice.map(r=>{ const rej=r.status==='rejected', done=recordComplete(r);
                return <tr key={r.id}><td><b>{actName(r)}</b></td><td>{r.company||'-'}</td><td>{recName(r)||'-'}</td>
                  <td className="muted">{r.updatedAt||'-'}</td>
                  <td><span className={"badge "+(rej?'rejected':(done?'done':'draft'))}>{rej?'ตีกลับ':(done?'สมบูรณ์':'ร่าง')}</span></td></tr>;
              })}</tbody>
            </table></div>
            <Pager page={rc.page} pages={rc.pages} total={d.recent.length} set={setRecPage} />
          </>) : <div className="muted" style={{ padding:8 }}>ยังไม่มีรายการ</div>}
        </div>
        <div className="dcard">
          <h3>ฝ่ายที่ต้องเร่ง (ความคืบหน้าต่ำ / เงียบนาน)</h3>
          {d.orgProgress.length ? (<>
            <div className="dz"><table>
              <thead><tr><th>ฝ่าย/ส่วน</th><th style={{ width:70 }}>สมบูรณ์</th><th style={{ width:90 }}>นิ่งมา</th></tr></thead>
              <tbody>{pr.slice.map((p,i)=>(
                <tr key={pr.page+"-"+i}><td title={p.division}>{p.org}</td>
                  <td><span className="pill amber">{p.pct}%</span> <span className="muted">{p.complete}/{p.total}</span></td>
                  <td>{p.idleDays==null?"-":(p.idleDays+" วัน")}{p.idleDays>30 && " 🔴"}</td></tr>
              ))}</tbody>
            </table></div>
            <Pager page={pr.page} pages={pr.pages} total={d.orgProgress.length} set={setProgPage} />
          </>) : <div className="muted" style={{ padding:8 }}>ไม่มีข้อมูล</div>}
        </div>
      </div>
      </>)}
    </div>
  );
}
