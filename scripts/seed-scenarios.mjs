// สร้างข้อมูลตัวอย่าง "ครบทุก scenario" เพื่อให้ Dashboard โชว์ครบทุก widget
//  - ความสมบูรณ์ผสม (complete/draft) · status done/draft/rejected
//  - ความเสี่ยงครบ C1(ม.26) C2(ม.28/29) C3(DPA/สัญญา) C4(retention) C5(consent)
//  - งานค้าง 7-14 / 15-30 / >30 วัน · due date overdue/ใกล้ครบ
//  - coverage gap (หน่วยงานไม่มี record / มีแต่ draft) · activity gap
//  - backfill ropa_snapshots 45 วัน ให้กราฟ trend มีเส้น
// รันผ่าน loader hook (lib ใช้ extensionless import):
//   node --import file:///<abs>/scripts/_reg.mjs scripts/seed-scenarios.mjs
import { readFileSync } from "fs";
for(const line of readFileSync(new URL("../.env.local", import.meta.url),"utf8").split("\n")){ const m=line.match(/^([A-Z_]+)=(.*)$/); if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim(); }
const { listUsers, insertRecordsWithOwners, captureSnapshot, sql } = await import("../lib/db.js");
const { makeDummyByDept } = await import("../lib/dummy.js");
const { MASTER } = await import("../lib/master.js");
const { recordComplete } = await import("../lib/validate.js");
const { companyAggregates } = await import("../lib/analytics.js");

const DAY = 86400000, NOW = Date.now();
const DOMAIN_COMPANY = { "bts.co.th":"BTSC", "bid.com":"BID", "ebm.com":"EBM", "nbm.com":"NBM" };
const companyOfEmail = (e) => DOMAIN_COMPANY[(e.split("@")[1]||"").toLowerCase()] || null;
const pick = a => a[Math.floor(Math.random()*a.length)];
const thai = ts => new Date(ts).toLocaleString("th-TH", { dateStyle:"medium", timeStyle:"short" });
// เหลือ 3 กิจกรรมท้ายไว้ "ยังไม่ครอบคลุม" (activity gap)
const ACT = MASTER.activities.slice(0, MASTER.activities.length - 3);

// บั๊กเก็ตของหน่วยงาน (อิงชื่อ org เพื่อให้ทุกบริษัทเหมือนกัน → coverage gap ปรากฏในมุมมองรวม)
function orgBucket(org){ let h=0; for(const ch of org) h=(h*31 + ch.charCodeAt(0))>>>0; const m=h%9; return m===0?"skip":(m===1?"draftonly":"normal"); }
const setAge = (r,days) => { r.updatedTs = NOW - days*DAY; r.updatedAt = thai(r.updatedTs); };
const setDue = (r,days) => { r.dueDate = new Date(NOW + days*DAY).toISOString().slice(0,10); };
function makeClean(r){ (r.s4?.items||[]).forEach(it=>{ it.dpa="Yes"; it.contract="Yes"; }); } // baseline สะอาด
function makeDraft(r){ r.status="draft"; r.s2.purpose=""; r.s5={ transfer:"" }; }              // ไม่สมบูรณ์
function riskC1(r){ r.s2.sensitive=[pick(MASTER.sensitiveData)]; r.s2.lawfulSens=[]; makeClean(r); } // อ่อนไหวไร้ฐานกม. (ยัง complete)
function riskC2(r){ r.s5={ transfer:"มีการส่งออกนอกประเทศ", country:pick(["สิงคโปร์","ญี่ปุ่น","สหรัฐอเมริกา"]), company:"AWS (Singapore Region)", method:"ส่งผ่านระบบ Cloud", purpose:"ใช้บริการคลาวด์ต่างประเทศ", safeguard:[] }; } // ไร้ safeguard (incomplete)
function riskC4(r){ r.s6={ store:"มีการจัดเก็บ", items:[{ type:"ไฟล์ PDF", trigger:"", period:"", reason:"", legalKeep:"", physical:[], technical:[], storeLoc:"", deleteMethod:"" }] }; } // ไม่มีกำหนดลบ (incomplete)
function riskC5(r){ r.s1.special="ผู้เยาว์"; r.s1.consent="N"; makeClean(r); }                  // บุคคลพิเศษ consent=N (ยัง complete)
function riskC3(r){
  const mk = () => ({ recipient:pick(MASTER.externalRecipients), recipientDetail:"ผู้ให้บริการภายนอกตามสัญญา", recipientFile:null,
    status:pick(MASTER.recipientStatus), purpose:"ดำเนินการตามสัญญา", contract:"No", method:[pick(MASTER.disclosureMethods)], dpa:"No" });
  r.s4 = { disclose:"มีการเปิดเผย", items: (r.s4?.items?.length ? r.s4.items.map(it=>({ ...it, dpa:"No", contract:"No" })) : [mk()]) };
} // ขาด DPA+สัญญา (ยัง complete เพราะ field ถูกกรอก)
function setRejected(r){ r.status="rejected"; r.reviewComment="โปรดเพิ่มฐานกฎหมายและมาตรการรักษาความปลอดภัยให้ครบ"; r.reviewedAt=thai(NOW); }
function maybeDue(r,n){ if(recordComplete(r)) return; if(n%17===0) setDue(r, -(2+n%10)); else if(n%17===3) setDue(r, 2+n%5); }

function applyScenario(r, n, draftOnly){
  if(draftOnly){ makeDraft(r); setAge(r, 3+n%22); maybeDue(r,n); return; }
  const k = n % 100;
  if(k<44){ makeClean(r); r.status="done"; setAge(r, n%5); }
  else if(k<54){ riskC3(r);  r.status="done";  setAge(r, n%6); }   // critical (complete) → closedNotCompliant
  else if(k<60){ riskC1(r);  r.status="done";  setAge(r, n%6); }   // critical (complete)
  else if(k<66){ riskC5(r);  r.status="done";  setAge(r, n%6); }   // warn (complete)
  else if(k<72){ makeDraft(r); setAge(r, 2+n%4); }                 // draft recent
  else if(k<78){ makeDraft(r); setAge(r, 8+n%6); }                 // stale 7-14
  else if(k<83){ makeDraft(r); setAge(r, 16+n%12); }              // stale 15-30
  else if(k<88){ makeDraft(r); setAge(r, 32+n%25); }              // stale >30
  else if(k<92){ riskC2(r); r.status="draft"; setAge(r, n%12); }  // cross no safeguard (critical, incomplete)
  else if(k<95){ riskC4(r); r.status="draft"; setAge(r, n%12); }  // retention missing (warn, incomplete)
  else { setRejected(r); setAge(r, 3+n%12); }                     // rejected
  maybeDue(r, n);
}

console.log("clearing records ...");
await sql`DELETE FROM records`;
const users = (await listUsers()).filter(u=>u.role!=="admin");
const pairs = [];
let ui = 0;
for(const u of users){
  const company = companyOfEmail(u.email); if(!company) continue;
  let org="", dept="";
  if(u.department){ org=u.section; dept=u.department; }
  else if(u.section){ org=u.section; }
  else if(u.division){ org=u.division; }
  if(!org) continue;
  ui++;
  const cov = orgBucket(org); // ~11% red (ทุกบริษัทว่าง), ~11% yellow (มีแต่ draft)
  if(cov === "skip") continue;
  const recs = makeDummyByDept(5, org, dept);
  recs.forEach((r,i)=>{
    r.s1.activity = ACT[(ui+i) % ACT.length];
    applyScenario(r, ui*5+i, cov === "draftonly");
    pairs.push({ rec:r, owner:u.id });
  });
}
console.log("inserting", pairs.length, "records ...");
await insertRecordsWithOwners(pairs);
await sql`UPDATE records SET completed_at = now() WHERE complete = true AND completed_at IS NULL`;

// ---- distribution summary ----
console.log("--- per company ---");
for(const d of await sql`SELECT company, count(*)::int n, sum(CASE WHEN complete THEN 1 ELSE 0 END)::int done,
  sum(CASE WHEN status='rejected' THEN 1 ELSE 0 END)::int rej FROM records GROUP BY company ORDER BY company`)
  console.log(`  ${d.company}: ${d.n} (สมบูรณ์ ${d.done}, ตีกลับ ${d.rej})`);

// ---- backfill snapshot history 45 วัน (ramp up) + วันนี้ ----
console.log("backfilling snapshot history (45 days) ...");
const finalAgg = companyAggregates((await sql`SELECT data FROM records`).map(r=>r.data), NOW);
await sql`DELETE FROM ropa_snapshots`;
for(let d=45; d>=1; d--){
  const g = (45-d)/45;                       // 0 → 1
  const fc = 0.45 + 0.55*g;                   // complete factor 0.45 → 1.0
  const fr = 1.5 - 0.5*g;                     // risk factor 1.5 → 1.0 (ดีขึ้นตามเวลา)
  for(const a of finalAgg){
    const complete = Math.min(a.total, Math.round(a.complete*fc));
    const high = Math.round(a.highRisk*fr);
    await sql`INSERT INTO ropa_snapshots (day,company,total,complete,high_risk,cross_no_sg,sens_no_law,dpa_missing,stale30)
              VALUES (current_date - ${d}::int, ${a.company}, ${a.total}, ${complete}, ${high}, ${a.crossNoSafeguard}, ${a.sensitiveNoLawful}, ${a.dpaMissing}, ${a.stale30})
              ON CONFLICT (day,company) DO UPDATE SET total=EXCLUDED.total, complete=EXCLUDED.complete, high_risk=EXCLUDED.high_risk`;
  }
}
await captureSnapshot(NOW);
console.log("snapshot days:", (await sql`SELECT count(DISTINCT day)::int n FROM ropa_snapshots`)[0].n);
console.log("DONE");
