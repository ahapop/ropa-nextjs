// Reseed: ทุกบริษัทมีฝ่าย "พื้นฐาน" (base) ของตัวเอง + ฝ่าย "ต่อยอด" (สายสี) ของสายตัวเอง
//  BTSC/BID → base · EBM → base + สายสีเหลือง · NBM → base + สายสีชมพู
//  - สร้าง user ฝ่าย base ของ ebm.com/nbm.com กลับมา (clone จาก bts.co.th — สำเนาแยก ไม่แชร์)
//  - ลบ records แล้วสร้างใหม่ sanitize org ทุกจุด (s1.org/s3.items/s7/recorder) ให้อยู่ในชุดฝ่ายบริษัท
// Run: node --experimental-loader ./scripts/_resolve.mjs scripts/reseed-6.mjs
import { readFileSync } from "fs";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
for(const line of readFileSync(new URL("../.env.local", import.meta.url),"utf8").split("\n")){
  const m = line.match(/^([A-Z_]+)=(.*)$/); if(m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const { orgsForCompany } = await import("../lib/master.js");
const { listUsers, rawQuery, insertRecordsWithOwners, sql } = await import("../lib/db.js");
const { makeDummyByDept } = await import("../lib/dummy.js");

const DOMAIN_COMPANY = { "bts.co.th":"BTSC", "bid.com":"BID", "ebm.com":"EBM", "nbm.com":"NBM" };
const companyOfEmail = (email) => DOMAIN_COMPANY[(email.split("@")[1]||"").toLowerCase()] || null;
const PER_USER = 5;
const rnd = () => Math.random();
const pick = a => a[Math.floor(rnd()*a.length)];
const sampleN = (a, n) => { const c=a.slice(), out=[]; for(let i=0;i<n && c.length;i++) out.push(c.splice(Math.floor(rnd()*c.length),1)[0]); return out; };

// 1) clone bts.co.th base users -> ebm.com & nbm.com (สร้างฝ่ายพื้นฐานของบริษัทแยกกลับมา)
const pwHash = await bcrypt.hash("123", 10);
const all = await listUsers();
const btsBase = all.filter(u => u.role==="user" && u.email.toLowerCase().endsWith("@bts.co.th"));
const existing = new Set(all.map(u => u.email.toLowerCase()));
const newUsers = [];
for(const dom of ["ebm.com","nbm.com"]){
  for(const u of btsBase){
    const email = `${u.email.split("@")[0]}@${dom}`;
    if(existing.has(email.toLowerCase())) continue;
    existing.add(email.toLowerCase());
    newUsers.push({ id:crypto.randomUUID(), email, name:u.name, title:u.title,
      division:u.division||"", section:u.section||"", department:u.department||"", role:"user", passwordHash:pwHash });
  }
}
for(let i=0;i<newUsers.length;i+=200){
  const chunk=newUsers.slice(i,i+200); const ph=[], vals=[];
  chunk.forEach((u,j)=>{ const b=j*9; ph.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9})`);
    vals.push(u.id,u.email,u.name,u.title,u.division,u.section,u.department,u.role,u.passwordHash); });
  await rawQuery(`INSERT INTO users (id,email,name,title,division,section,department,role,password_hash) VALUES ${ph.join(",")} ON CONFLICT (email) DO NOTHING`, vals);
}
console.log(`สร้าง user ฝ่าย base ของ ebm/nbm กลับมา: ${newUsers.length} ราย`);

// 2) ลบ records แล้วสร้างใหม่จาก user ทุกคน (sanitize org ตามชุดฝ่ายของบริษัท)
console.log("ลบ records ทั้งหมด...");
await sql`DELETE FROM records`;
const users = (await listUsers()).filter(u => u.role!=="admin" && companyOfEmail(u.email));
const pairs = [];
for(const u of users){
  const company = companyOfEmail(u.email);
  let org="", dept="";
  if(u.department){ org=u.section; dept=u.department; }
  else if(u.section){ org=u.section; }
  else if(u.division){ org=u.division; }
  if(!org) continue;

  const companyOrgs = orgsForCompany(company);
  const shareOrgs = companyOrgs.filter(o => o !== org);
  for(const r of makeDummyByDept(PER_USER, org, dept)){
    r.company = company;
    r.recorder = { ...r.recorder, division: u.division||"", section: u.section||"", department: dept };
    const n = Math.min(shareOrgs.length, 1 + Math.floor(rnd()*3));
    r.s3.items = sampleN(shareOrgs, n).map(o => ({
      org:o, purpose:"ใช้ข้อมูลร่วมกันระหว่างหน่วยงานภายในเพื่อการประมวลผล",
      general:r.s3.items[0]?.general || [], sensitive:[],
      lawful:r.s3.items[0]?.lawful || [], lawfulSens:[] }));
    r.s7.who = "เจ้าหน้าที่ที่ได้รับมอบหมายของ" + pick(companyOrgs);
    pairs.push({ rec:r, owner:u.id });
  }
}
console.log(`สร้าง ${pairs.length} records จาก ${users.length} users ...`);
for(let i=0;i<pairs.length;i+=200) await insertRecordsWithOwners(pairs.slice(i,i+200));

// 3) ตรวจผล
console.log("\n--- distribution per company ---");
for(const d of await sql`SELECT company, count(*)::int recs, count(distinct org)::int orgs FROM records GROUP BY company ORDER BY company`)
  console.log(`  ${d.company}: ${d.recs} records · ${d.orgs} หน่วยงาน`);
const v = (await sql`SELECT
  (SELECT count(*)::int FROM records WHERE company IN ('BTSC','BID') AND org LIKE '%สายสี%') AS base_color,
  (SELECT count(*)::int FROM records WHERE company='EBM' AND org LIKE '%สายสีชมพู%' AND org NOT LIKE '%สายสีเหลือง%') AS ebm_has_pink,
  (SELECT count(*)::int FROM records WHERE company='NBM' AND org LIKE '%สายสีเหลือง%' AND org NOT LIKE '%สายสีชมพู%') AS nbm_has_yellow,
  (SELECT count(*)::int FROM records WHERE company='EBM' AND org NOT LIKE '%สายสี%') AS ebm_base,
  (SELECT count(*)::int FROM records WHERE company='NBM' AND org NOT LIKE '%สายสี%') AS nbm_base,
  (SELECT count(*)::int FROM records r WHERE EXISTS (
     SELECT 1 FROM jsonb_array_elements(r.data->'s3'->'items') it
     WHERE (r.company IN ('BTSC','BID') AND it->>'org' LIKE '%สายสี%')
        OR (r.company='EBM' AND it->>'org' LIKE '%สายสีชมพู%' AND it->>'org' NOT LIKE '%สายสีเหลือง%')
        OR (r.company='NBM' AND it->>'org' LIKE '%สายสีเหลือง%' AND it->>'org' NOT LIKE '%สายสีชมพู%'))) AS s3_bad`)[0];
console.log("\nตรวจกฎ (ควร 0):");
console.log("  BTSC/BID มี org สายสี:", v.base_color);
console.log("  EBM มี org ชมพูล้วน (ของ NBM):", v.ebm_has_pink);
console.log("  NBM มี org เหลืองล้วน (ของ EBM):", v.nbm_has_yellow);
console.log("  s3.items org ข้ามบริษัท:", v.s3_bad);
console.log("\nยืนยันว่า EBM/NBM มีฝ่าย base แล้ว (ควร > 0):");
console.log("  EBM base records:", v.ebm_base, "· NBM base records:", v.nbm_base);
