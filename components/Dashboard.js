"use client";
import { useState, useMemo } from "react";
import { MASTER } from "@/lib/master";
import { recName, actName } from "@/lib/util";
import { recordComplete, recCompleteness } from "@/lib/validate";
import { STEPS } from "@/lib/master";

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
function Kpi({ n, t, sub, cls }){
  return <div className={"kpi " + (cls||"")}><div className="n">{n}</div><div className="t">{t}</div>{sub && <div className="sub2">{sub}</div>}</div>;
}

export default function Dashboard({ records, onBack, onChangePin, onLock, onEdit }){
  const [comp, setComp] = useState("");
  const d = useMemo(() => {
    const R = records.filter(r => !comp || r.company===comp);
    const total = R.length;
    const done = R.filter(r=>recordComplete(r)).length;
    const draft = total - done;
    const donePct = total ? Math.round(done/total*100) : 0;
    const sens = R.filter(r => (r.s2?.sensitive||[]).length>0);
    const cross = R.filter(r => r.s5?.transfer==='มีการส่งออกนอกประเทศ');
    const ext = R.filter(r => r.s4?.disclose==='มีการเปิดเผย');
    const risks = [];
    R.forEach(r => {
      const rs = [];
      if((r.s2?.sensitive||[]).length>0 && (r.s2?.lawfulSens||[]).length===0) rs.push({t:'มีข้อมูลอ่อนไหวแต่ไม่ระบุฐานกฎหมาย (ม.26)',lv:'warn'});
      if(r.s1?.special && r.s1.special!=='ไม่มี' && r.s1?.consent==='N') rs.push({t:'มีบุคคลพิเศษแต่ Consent = N',lv:'warn'});
      if(r.s5?.transfer==='มีการส่งออกนอกประเทศ' && (r.s5?.safeguard||[]).length===0) rs.push({t:'โอนต่างประเทศแต่ไม่มี safeguard (ม.28/29)',lv:'warn'});
      if(r.s4?.disclose==='มีการเปิดเผย' && (r.s4?.items||[]).some(it=> it && it.dpa!=='Yes' && it.contract!=='Yes')) rs.push({t:'เปิดเผยภายนอกแต่ไม่มี DPA/สัญญา',lv:'warn'});
      if(!recordComplete(r)) rs.push({t:'ยังกรอกไม่ครบ (ไม่สมบูรณ์)',lv:'amber'});
      if(rs.length) risks.push({ r, rs });
    });
    const highRisk = risks.filter(x=>x.rs.some(z=>z.lv==='warn')).length;
    const byCompany = MASTER.companies.map(c=>({label:c, n:records.filter(r=>r.company===c).length})).filter(x=>!comp||x.label===comp);
    const orgMap = {}; R.forEach(r=>{ const o=r.s1?.org||'(ไม่ระบุฝ่าย)'; orgMap[o]=(orgMap[o]||0)+1; });
    const byOrg = Object.entries(orgMap).map(([label,n])=>({label,n})).sort((a,b)=>b.n-a.n).slice(0,8);
    const recM = {}; R.forEach(r=>{ const n=recName(r)||'(ไม่ระบุ)'; recM[n]=(recM[n]||0)+1; });
    const byRec = Object.entries(recM).map(([label,n])=>({label,n})).sort((a,b)=>b.n-a.n).slice(0,8);
    const avgPct = total ? Math.round(R.reduce((s,r)=>s+recCompleteness(r),0)/total/STEPS.length*100) : 0;
    const recent = R.slice(0,6);
    return { total, done, draft, donePct, sens, cross, ext, risks, highRisk, byCompany, byOrg, byRec, avgPct, recent };
  }, [records, comp]);

  return (
    <div className="container">
      <div className="dash-head">
        <h2>📊 Dashboard สำหรับ Admin</h2>
        <div className="filters">
          <label className="muted">บริษัท:</label>
          <select value={comp} onChange={e=>setComp(e.target.value)}>
            <option value="">ทุกบริษัท</option>
            {MASTER.companies.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={onChangePin}>🔑 เปลี่ยน PIN</button>
          <button className="btn btn-ghost btn-sm" onClick={onLock}>🔒 ออก/ล็อก</button>
          <button className="btn btn-primary btn-sm" onClick={onBack}>← กลับสู่รายการ</button>
        </div>
      </div>

      <div className="kpis">
        <Kpi n={d.total} t="รายการทั้งหมด" sub={comp?('บริษัท '+comp):'ทุกบริษัท'} />
        <Kpi n={d.done+' / '+d.draft} t="สมบูรณ์ / ร่าง" sub={d.donePct+'% สมบูรณ์'} cls="green" />
        <Kpi n={d.sens.length} t="มีข้อมูลอ่อนไหว" sub="ม.26" cls="amber" />
        <Kpi n={d.cross.length} t="โอนต่างประเทศ" sub="ม.28/29" cls="amber" />
        <Kpi n={d.ext.length} t="เปิดเผยภายนอก" sub="Data Disclosure" />
        <Kpi n={d.highRisk} t="⚠️ ต้องแก้ไขเร่งด่วน" sub={d.risks.length+' รายการมีข้อสังเกต'} cls="warn" />
      </div>

      <div className="dash-grid">
        <div className="dcard">
          <h3>จำนวนรายการแยกตามบริษัท</h3>
          <Bars items={d.byCompany} />
          <h3 style={{ marginTop:18 }}>ฝ่าย / ส่วน (Top 8)</h3>
          <Bars items={d.byOrg} />
        </div>
        <div className="dcard">
          <h3>สถานะความสมบูรณ์</h3>
          <div className="donut-wrap">
            <div className="donut" style={{ background:`conic-gradient(var(--accent) ${d.donePct}%, #e3e9f2 0)` }}>
              <div className="donut-hole"><b>{d.donePct}%</b><small>สมบูรณ์</small></div>
            </div>
            <div className="legend">
              <div><i style={{ background:"var(--accent)" }} /> สมบูรณ์ — {d.done} รายการ</div>
              <div><i style={{ background:"#e3e9f2" }} /> ร่าง — {d.draft} รายการ</div>
              <div style={{ marginTop:10, color:"var(--muted)" }}>ความครบถ้วนเฉลี่ยต่อรายการ</div>
              <div className="bar-track" style={{ height:16 }}><div className="bar-fill" style={{ width:d.avgPct+'%', background:"linear-gradient(90deg,var(--warn),#a87a00)" }} /></div>
              <div style={{ textAlign:"right", fontWeight:700, color:"#a87a00" }}>{d.avgPct}%</div>
            </div>
          </div>
          <h3 style={{ marginTop:18 }}>ผู้บันทึก (Top 8)</h3>
          <Bars items={d.byRec} />
        </div>
      </div>

      <div className="dcard" style={{ marginBottom:18 }}>
        <h3>🔴 รายการเฝ้าระวัง / ต้องแก้ไข ({d.risks.length})</h3>
        {d.risks.length ? (
          <table>
            <thead><tr><th>กิจกรรม / หน่วยงาน</th><th>ข้อสังเกต</th><th style={{ width:120 }}>จัดการ</th></tr></thead>
            <tbody>{d.risks.map((x,k)=>(
              <tr key={k}>
                <td><b>{actName(x.r)}</b><div className="muted">{(x.r.company||'-')+' · '+(x.r.s1?.org||'-')+' · '+(recName(x.r)||'-')}</div></td>
                <td>{x.rs.map((z,j)=><span className={"pill "+z.lv} key={j}>{z.t}</span>)}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={()=>onEdit(x.r.id)}>✎ เปิดแก้</button></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <div className="muted" style={{ padding:8 }}>ไม่พบรายการที่ต้องแก้ไข 🎉</div>}
      </div>

      <div className="dcard">
        <h3>กิจกรรมล่าสุด</h3>
        {d.recent.length ? (
          <table>
            <thead><tr><th>กิจกรรม</th><th>บริษัท</th><th>ผู้บันทึก</th><th>ปรับปรุงล่าสุด</th><th style={{ width:90 }}>สถานะ</th></tr></thead>
            <tbody>{d.recent.map(r=>{
              const rejected=r.status==='rejected', done=recordComplete(r);
              return (
                <tr key={r.id}>
                  <td><b>{actName(r)}</b></td>
                  <td>{r.company||'-'}</td>
                  <td>{recName(r)||'-'}</td>
                  <td className="muted">{r.updatedAt||'-'}</td>
                  <td><span className={"badge "+(rejected?'rejected':(done?'done':'draft'))}>{rejected?'ตีกลับ':(done?'สมบูรณ์':'ร่าง')}</span></td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : <div className="muted" style={{ padding:8 }}>ยังไม่มีรายการ</div>}
      </div>
    </div>
  );
}
