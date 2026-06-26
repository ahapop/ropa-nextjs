/* =========================================================================
   ANALYTICS — pure functions สำหรับ Dashboard ผู้ดูแล RoPA + รายงานผู้บริหาร
   ใช้ได้ทั้งฝั่ง client (Dashboard) และฝั่ง server (รายงาน/snapshot)
   ทุกตัวเลขอ้างอิง field จริง · reuse นิยาม "สมบูรณ์" จาก validate.js
   ========================================================================= */
import { MASTER, STEPS, DIVISIONS, SECTIONS, DIVISION_SECTIONS, companiesForOrg } from "./master";
import { recName, actName } from "./util";
import { recordComplete, recCompleteness, isStepComplete } from "./validate";
import { emptyRequiredFids } from "./stepvalid";

export const DAY = 86400000;

// section → division (จาก DIVISION_SECTIONS)
const SEC2DIV = (() => { const m = {}; for(const [d, secs] of Object.entries(DIVISION_SECTIONS)) for(const s of secs) m[s] = d; return m; })();
export function divisionOf(org){ return SEC2DIV[org] || org || "(ไม่ระบุฝ่าย)"; }

// บริษัทที่หน่วยงานนี้ "ควรมี RoPA" — base (ไม่มีสี) อยู่ที่ BTSC และ BID (ชื่อซ้ำกันได้ แต่เป็นคนละฝ่าย)
//  · สายสีเหลือง → EBM · สายสีชมพู → NBM (EBM/NBM ไม่มีฝ่าย base)
function orgCompanies(org){ const c = companiesForOrg(org); return (c.length===1 && c[0]==="BTSC") ? ["BTSC","BID"] : c; }

/* ---- ความเสี่ยง / compliance รายการเดียว (โซน C) ---- */
// คืน array ของ {key, level:'critical'|'warn', label, matter}
export function riskFlags(r){
  const f = [];
  const s2sen = (r.s2?.sensitive||[]).length>0;
  const s2lawS = (r.s2?.lawfulSens||[]).length>0;
  // C1 — อ่อนไหวไม่มีฐานกฎหมายอ่อนไหว (ม.26) · รวมกรณีใน s3.items (การใช้ภายใน)
  const s3senNoLaw = (r.s3?.items||[]).some(it => it && (it.sensitive||[]).length>0 && (it.lawfulSens||[]).length===0);
  if((s2sen && !s2lawS) || s3senNoLaw)
    f.push({ key:"c1", level:"critical", label:"ข้อมูลอ่อนไหวไม่มีฐานกฎหมาย", matter:"ม.26" });
  // C2 — โอนต่างประเทศไม่มี safeguard (ม.28/29)
  if(r.s5?.transfer==="มีการส่งออกนอกประเทศ" && (r.s5?.safeguard||[]).length===0)
    f.push({ key:"c2", level:"critical", label:"โอนต่างประเทศไม่มี safeguard", matter:"ม.28/29" });
  // C3 — เปิดเผยภายนอกขาด DPA (critical) / ขาดสัญญา (warn) — แยกกัน
  if(r.s4?.disclose==="มีการเปิดเผย"){
    const items = r.s4?.items||[];
    if(items.some(it => it && it.dpa!=="Yes")) f.push({ key:"c3dpa", level:"critical", label:"เปิดเผยภายนอกขาด DPA", matter:"DPA" });
    if(items.some(it => it && it.contract!=="Yes")) f.push({ key:"c3con", level:"warn", label:"เปิดเผยภายนอกขาดสัญญา", matter:"" });
  }
  // C4 — จัดเก็บแต่ไม่มีกำหนดลบ/ระยะเวลา
  if(r.s6?.store==="มีการจัดเก็บ"){
    const items = r.s6?.items||[];
    if(!items.length || items.some(it => it && (!(it.period||"").trim() || !(it.trigger||"").trim() || !(it.deleteMethod||"").trim())))
      f.push({ key:"c4", level:"warn", label:"ไม่มีกำหนดลบ/ระยะเวลาเก็บ", matter:"ม.37(3)" });
  }
  // C5 — บุคคลพิเศษ (ผู้เยาว์ ฯลฯ) แต่ Consent = N
  if(r.s1?.special && r.s1.special!=="ไม่มี" && r.s1?.consent==="N")
    f.push({ key:"c5", level:"warn", label:"บุคคลพิเศษแต่ Consent = N", matter:"ม.20" });
  return f;
}

const RISK_LABELS = {
  c1:"ข้อมูลอ่อนไหวไม่มีฐานกฎหมาย (ม.26)",
  c2:"โอนต่างประเทศไม่มี safeguard (ม.28/29)",
  c3dpa:"เปิดเผยภายนอกขาด DPA",
  c3con:"เปิดเผยภายนอกขาดสัญญา",
  c4:"จัดเก็บแต่ไม่มีกำหนดลบ/ระยะเวลา",
  c5:"บุคคลพิเศษแต่ Consent = N",
};

/* ---- label ของ field ที่ขาด (โซน B1) ---- */
const FID_LABEL = {
  "company":"บริษัทต้นสังกัด", "s1.org":"หน่วยงาน", "s1.activity":"กิจกรรมการประมวลผล",
  "s1.responsible":"ผู้รับผิดชอบ", "s1.recordFormat":"รูปแบบการบันทึก", "s1.dataSubject":"ประเภทเจ้าของข้อมูล",
  "s1.special":"บุคคลพิเศษ (ผู้เยาว์ฯ)", "s1.frequency":"ความถี่", "s1.consent":"Consent",
  "s2.source":"แหล่งที่มา", "s2.purpose":"วัตถุประสงค์การเก็บ", "s2.general":"ประเภทข้อมูลทั่วไป",
  "s2.sensitive":"ประเภทข้อมูลอ่อนไหว", "s2.lawful":"ฐานกฎหมาย", "s2.lawfulSens":"ฐานกฎหมายข้อมูลอ่อนไหว",
  "s3.share":"การแบ่งปันภายใน", "s4.disclose":"การเปิดเผยภายนอก",
  "s5.transfer":"การโอนต่างประเทศ", "s5.country":"ประเทศปลายทาง", "s5.company":"องค์กรปลายทาง",
  "s5.method":"วิธีการโอน", "s5.purpose":"วัตถุประสงค์การโอน", "s5.safeguard":"มาตรการคุ้มครอง (safeguard)",
  "s6.store":"การเก็บรักษา", "s7.who":"ผู้มีสิทธิเข้าถึง", "s7.condition":"เงื่อนไขการเข้าถึง", "s7.method":"วิธีการเข้าถึง",
};
function fidLabel(fid){
  if(FID_LABEL[fid]) return FID_LABEL[fid];
  const base = fid.replace(/Other\d*$/, "");
  return (FID_LABEL[base] || base) + " (โปรดระบุ)";
}

const topN = (mapObj, n) => Object.entries(mapObj).map(([label,nn])=>({label,n:nn})).sort((a,b)=>b.n-a.n).slice(0,n);

/* ---- หลัก: คำนวณทุกอย่างของ dashboard จากชุด records (กรอง company แล้ว) ---- */
// opts: { now:Date.now(), company:'' , allRecords:[] }
export function analyze(records, opts={}){
  const now = opts.now || 0;
  const company = opts.company || "";
  const R = records;
  const total = R.length;

  // ----- A: scorecard / completeness -----
  let done=0, sumSteps=0;
  const statusCount = { draft:0, done:0, rejected:0 };
  for(const r of R){
    if(recordComplete(r)) done++;
    sumSteps += recCompleteness(r);
    const st = r.status==="rejected" ? "rejected" : (r.status==="done" ? "done" : "draft");
    statusCount[st]++;
  }
  const draft = total - done;
  const donePct = total ? Math.round(done/total*100) : 0;
  const avgPct = total ? Math.round(sumSteps/total/STEPS.length*100) : 0;

  // ----- C: ความเสี่ยงรายตัว -----
  const riskItems = [];          // {r, flags}
  const riskCount = {};          // key → count
  let criticalCount=0, warnCount=0, closedNotCompliant=0;
  for(const r of R){
    const flags = riskFlags(r);
    if(!flags.length) continue;
    riskItems.push({ r, flags });
    const hasCritical = flags.some(x=>x.level==="critical");
    if(hasCritical) criticalCount++; else warnCount++;
    for(const x of flags) riskCount[x.key] = (riskCount[x.key]||0)+1;
    // ปิดงานแล้ว (done/สมบูรณ์) แต่ยังติด critical
    if(hasCritical && (r.status==="done" || recordComplete(r))) closedNotCompliant++;
  }
  const sens = R.filter(r=>(r.s2?.sensitive||[]).length>0).length;
  const cross = R.filter(r=>r.s5?.transfer==="มีการส่งออกนอกประเทศ").length;
  const ext  = R.filter(r=>r.s4?.disclose==="มีการเปิดเผย").length;

  // company × risk heatmap (C6) — เฉพาะตอนดู "ทุกบริษัท"
  const riskByCompany = MASTER.companies.map(c=>{
    const rc = R.filter(r=>r.company===c);
    const row = { company:c, total:rc.length };
    for(const k of Object.keys(RISK_LABELS)) row[k] = 0;
    for(const r of rc) for(const x of riskFlags(r)) row[x.key] = (row[x.key]||0)+1;
    return row;
  }).filter(x=>x.total>0);

  // ----- B: คุณภาพ/ความครบ -----
  // B1 top missing fields
  const missMap = {};
  for(const r of R) for(const k of ["s1","s2","s3","s4","s5","s6","s7"])
    for(const fid of emptyRequiredFids(k, r)) missMap[fid] = (missMap[fid]||0)+1;
  const missingFields = Object.entries(missMap).map(([fid,n])=>({ fid, label:fidLabel(fid), n }))
    .sort((a,b)=>b.n-a.n).slice(0,10);
  // B2 step heatmap (division × step incomplete count)
  const heatDivs = {};
  for(const r of R){
    const d = divisionOf(r.s1?.org);
    if(!heatDivs[d]) heatDivs[d] = { div:d, total:0, steps:STEPS.map(()=>0) };
    heatDivs[d].total++;
    for(let i=0;i<STEPS.length;i++){ try{ if(!isStepComplete(r,i)) heatDivs[d].steps[i]++; }catch(e){ heatDivs[d].steps[i]++; } }
  }
  const stepHeat = Object.values(heatDivs).sort((a,b)=>b.total-a.total).slice(0,12);
  // B3 ผู้บันทึกไม่ครบ
  const noRecorder = R.filter(r=>!recName(r)).length;

  // ----- D: coverage -----
  // denominator: orgs ที่ "ควรมี" ในมุมที่ดู (ระดับ ฝ่าย+ส่วน)
  const allOrgs = [...DIVISIONS, ...SECTIONS];
  const denomOrgs = company ? allOrgs.filter(o=>orgCompanies(o).includes(company)) : allOrgs;
  const orgStat = {}; // org → {records, complete}
  for(const r of R){ const o=r.s1?.org||"(ไม่ระบุ)"; (orgStat[o] = orgStat[o]||{records:0,complete:0}).records++; if(recordComplete(r)) orgStat[o].complete++; }
  const orgGap = denomOrgs.map(o=>{
    const s = orgStat[o] || { records:0, complete:0 };
    const state = s.records===0 ? "none" : (s.complete>0 ? "ok" : "draft");
    return { org:o, division:divisionOf(o), records:s.records, complete:s.complete, state };
  });
  const orgGapCounts = { none:0, draft:0, ok:0 };
  for(const g of orgGap) orgGapCounts[g.state]++;
  // D2 coverage rate per company
  const coverageByCompany = MASTER.companies.map(c=>{
    const orgsC = allOrgs.filter(o=>orgCompanies(o).includes(c));
    const rc = (opts.allRecords||R).filter(r=>r.company===c);
    const have = new Set(rc.map(r=>r.s1?.org).filter(Boolean));
    const haveComplete = new Set(rc.filter(r=>recordComplete(r)).map(r=>r.s1?.org).filter(Boolean));
    return { company:c, orgs:orgsC.length, covered:[...have].filter(o=>orgsC.includes(o)).length,
             completeOrgs:[...haveComplete].filter(o=>orgsC.includes(o)).length, records:rc.length };
  });
  // D3 activity coverage
  const actSet = new Set(R.map(r=>r.s1?.activity).filter(Boolean));
  const activityCoverage = MASTER.activities.map(a=>({ activity:a, has:actSet.has(a) }));
  const activityCovered = activityCoverage.filter(a=>a.has).length;

  // ----- E: ติดตามงาน -----
  // E1 stale drafts (ไม่สมบูรณ์ + นิ่งนาน)
  const staleBuckets = { d7:0, d15:0, d30:0 };
  const staleList = [];
  for(const r of R){
    if(recordComplete(r)) continue;
    const age = now && r.updatedTs ? Math.floor((now - r.updatedTs)/DAY) : 0;
    if(age>=30){ staleBuckets.d30++; staleList.push({ r, age }); }
    else if(age>=15){ staleBuckets.d15++; staleList.push({ r, age }); }
    else if(age>=7){ staleBuckets.d7++; staleList.push({ r, age }); }
  }
  staleList.sort((a,b)=>b.age-a.age);
  // E2 review queue
  const rejected = R.filter(r=>r.status==="rejected");
  const waiting  = R.filter(r=>r.status==="done");
  // E3 recent (เรียงใหม่สุดก่อน — เต็มชุด ให้หน้า Dashboard แบ่งหน้าเอง)
  const recent = [...R].sort((a,b)=>(b.updatedTs||0)-(a.updatedTs||0));
  const updatedToday = now ? R.filter(r=>r.updatedTs && (now-r.updatedTs)<DAY).length : 0;
  const updated7d = now ? R.filter(r=>r.updatedTs && (now-r.updatedTs)<7*DAY).length : 0;
  // E4 org progress matrix
  const orgProg = {};
  for(const r of R){
    const o = r.s1?.org||"(ไม่ระบุ)";
    if(!orgProg[o]) orgProg[o] = { org:o, division:divisionOf(o), total:0, complete:0, lastTs:0 };
    const p = orgProg[o]; p.total++; if(recordComplete(r)) p.complete++; if((r.updatedTs||0)>p.lastTs) p.lastTs=r.updatedTs;
  }
  const orgProgress = Object.values(orgProg).map(p=>({ ...p,
    pct: p.total ? Math.round(p.complete/p.total*100) : 0,
    idleDays: now && p.lastTs ? Math.floor((now-p.lastTs)/DAY) : null,
  })).sort((a,b)=>a.pct-b.pct);

  // ----- due date (เก็บใน JSONB rec.dueDate = 'YYYY-MM-DD') เฉพาะงานที่ยังไม่สมบูรณ์ -----
  let overdue=0, dueSoon=0;
  for(const r of R){
    if(!r.dueDate || recordComplete(r)) continue;
    const dd = Date.parse(r.dueDate); if(!dd) continue;
    const days = (dd - now)/DAY;
    if(days < 0) overdue++; else if(days <= 7) dueSoon++;
  }

  // ----- charts เดิม -----
  const orgMap={}; for(const r of R){ const o=r.s1?.org||"(ไม่ระบุฝ่าย)"; orgMap[o]=(orgMap[o]||0)+1; }
  const byOrg = topN(orgMap, 8);
  const recMap={}; for(const r of R){ const n=recName(r)||"(ไม่ระบุ)"; recMap[n]=(recMap[n]||0)+1; }
  const byRec = topN(recMap, 8);

  // ----- Alerts (รวม + จัดลำดับ) -----
  const alerts = [];
  const push = (level, label, n, hint) => { if(n>0) alerts.push({ level, label, n, hint }); };
  push("critical", "โอนต่างประเทศไม่มี safeguard (ม.28/29)", riskCount.c2||0, "ต้องจัดทำ SCCs/BCRs หรือกลไกตาม ม.28/29");
  push("critical", "ข้อมูลอ่อนไหวไม่มีฐานกฎหมาย (ม.26)", riskCount.c1||0, "ระบุฐานตาม ม.26 หรือขอความยินยอมโดยชัดแจ้ง");
  push("critical", "เปิดเผยภายนอกขาด DPA", riskCount.c3dpa||0, "จัดทำ DPA กับ Data Processor ทุกราย");
  push("critical", "ปิดงานแล้วแต่ยังไม่ compliant", closedNotCompliant, "ห้ามปิดงานหากยังติดความเสี่ยงร้ายแรง");
  push("warn", "จัดเก็บแต่ไม่มีกำหนดลบ/ระยะเวลา", riskCount.c4||0, "กำหนดระยะเวลาเก็บและวิธีลบ");
  push("warn", "เปิดเผยภายนอกขาดสัญญา", riskCount.c3con||0, "");
  push("warn", "บุคคลพิเศษแต่ Consent = N", riskCount.c5||0, "");
  push("warn", "งานค้างเรื้อรัง (>30 วัน)", staleBuckets.d30, "ทวงหน่วยงานที่ยังไม่ปิดงาน");
  push("warn", "รายการถูกตีกลับ (rejected)", rejected.length, "หน่วยงานต้องแก้ตามความเห็นแล้วส่งใหม่");
  push("critical", "เลยกำหนดส่ง (overdue)", overdue, "งานที่ยังไม่สมบูรณ์และเลย due date");
  push("warn", "ใกล้ครบกำหนด (≤ 7 วัน)", dueSoon, "เร่งปิดงานก่อนถึงกำหนด");
  push("warn", "หน่วยงานยังไม่มี RoPA เลย", orgGapCounts.none, "เริ่มจัดทำให้ครบทุกหน่วยงาน");

  return {
    total, done, draft, donePct, avgPct, statusCount,
    sens, cross, ext, criticalCount, warnCount, closedNotCompliant,
    riskItems, riskCount, riskByCompany, riskLabels: RISK_LABELS,
    missingFields, stepHeat, noRecorder,
    denomCount: denomOrgs.length, orgGap, orgGapCounts, coverageByCompany,
    activityCoverage, activityCovered, activityTotal: MASTER.activities.length,
    staleBuckets, staleList, rejected, waiting, recent, updatedToday, updated7d, orgProgress,
    overdue, dueSoon, byOrg, byRec, alerts,
  };
}

/* ---- per-company aggregate ย่อ (ใช้ทำ snapshot / KPI เปรียบเทียบบริษัท) ---- */
export function companyAggregates(records, now){
  return MASTER.companies.map(c=>{
    const R = records.filter(r=>r.company===c);
    let done=0, critical=0, crossNoSg=0, sensNoLaw=0, dpaMiss=0, stale30=0;
    for(const r of R){
      if(recordComplete(r)) done++;
      const f = riskFlags(r);
      if(f.some(x=>x.level==="critical")) critical++;
      if(f.some(x=>x.key==="c2")) crossNoSg++;
      if(f.some(x=>x.key==="c1")) sensNoLaw++;
      if(f.some(x=>x.key==="c3dpa")) dpaMiss++;
      if(!recordComplete(r) && now && r.updatedTs && (now-r.updatedTs)>=30*DAY) stale30++;
    }
    return { company:c, total:R.length, complete:done, draft:R.length-done,
             donePct: R.length?Math.round(done/R.length*100):0,
             highRisk:critical, crossNoSafeguard:crossNoSg, sensitiveNoLawful:sensNoLaw, dpaMissing:dpaMiss, stale30 };
  });
}

/* ---- worklist (โซน C7 / รายงาน) — แบนเป็นแถวต่อ 1 ความเสี่ยง ---- */
export function buildWorklist(records){
  const rows = [];
  for(const r of records){
    for(const f of riskFlags(r)){
      rows.push({
        level: f.level, risk: f.label, matter: f.matter,
        company: r.company||"-", org: r.s1?.org||"-", activity: actName(r),
        recorder: recName(r)||"-", id: r.id,
      });
    }
  }
  const order = { critical:0, warn:1 };
  rows.sort((a,b)=>(order[a.level]-order[b.level]) || a.company.localeCompare(b.company,"th"));
  return rows;
}
