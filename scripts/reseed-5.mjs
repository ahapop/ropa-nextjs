// Reseed ใหม่ทั้งหมดให้ "ฝ่ายของ record" สอดคล้องกับบริษัท (ตาม orgsForCompany)
//  - BTSC/BID → เฉพาะฝ่าย base (ไม่มีสายสี) · EBM → สายสีเหลือง · NBM → สายสีชมพู
//  - ลบ user ฝ่าย base ที่หลุดไปอยู่ ebm.com/nbm.com + user ขยะ (ไม่มีโดเมน)
//  - sanitize ทุก org ใน record (s1.org, s3.items, s7.who, recorder) ให้อยู่ในชุดฝ่ายของบริษัทนั้น
// Run: node --experimental-loader ./scripts/_resolve.mjs scripts/reseed-5.mjs
import { readFileSync } from "fs";
for(const line of readFileSync(new URL("../.env.local", import.meta.url),"utf8").split("\n")){
  const m = line.match(/^([A-Z_]+)=(.*)$/); if(m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const { orgsForCompany } = await import("../lib/master.js");
const { listUsers, insertRecordsWithOwners, sql } = await import("../lib/db.js");
const { makeDummyByDept } = await import("../lib/dummy.js");

const DOMAIN_COMPANY = { "bts.co.th":"BTSC", "bid.com":"BID", "ebm.com":"EBM", "nbm.com":"NBM" };
const companyOfEmail = (email) => DOMAIN_COMPANY[(email.split("@")[1]||"").toLowerCase()] || null;
const PER_USER = 5;
const rnd = () => Math.random();
const pick = a => a[Math.floor(rnd()*a.length)];
const sampleN = (a, n) => { const c=a.slice(), out=[]; for(let i=0;i<n && c.length;i++) out.push(c.splice(Math.floor(rnd()*c.length),1)[0]); return out; };

const allUsers = await listUsers();

// 1) ลบ user ที่ไม่สอดคล้องโดเมน (records จะ cascade ลบตาม)
const orgStr = (u) => `${u.division||""}${u.section||""}`;
const toDelete = allUsers.filter(u => {
  if(u.role === "admin") return false;
  const c = companyOfEmail(u.email);
  if(!c) return true;                                   // user ขยะ ไม่มีโดเมน
  if(c === "EBM") return !orgStr(u).includes("สายสีเหลือง");
  if(c === "NBM") return !orgStr(u).includes("สายสีชมพู");
  return orgStr(u).includes("สายสี");                   // BTSC/BID ต้องไม่มีสายสี
});
console.log(`ลบ user ที่ไม่สอดคล้อง: ${toDelete.length} ราย`);
for(let i=0;i<toDelete.length;i+=100){
  const ids = toDelete.slice(i,i+100).map(u=>u.id);
  await sql`DELETE FROM users WHERE id = ANY(${ids})`;
}

// 2) ลบ records ทั้งหมด แล้วสร้างใหม่จาก user ที่เหลือ
console.log("ลบ records ทั้งหมด...");
await sql`DELETE FROM records`;

const users = (await listUsers()).filter(u => u.role !== "admin" && companyOfEmail(u.email));
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
  (SELECT count(*)::int FROM records WHERE company IN ('BTSC','BID') AND org LIKE '%สายสี%') AS base_has_color,
  (SELECT count(*)::int FROM records WHERE company='EBM' AND org NOT LIKE '%สายสีเหลือง%') AS ebm_bad,
  (SELECT count(*)::int FROM records WHERE company='NBM' AND org NOT LIKE '%สายสีชมพู%') AS nbm_bad,
  (SELECT count(*)::int FROM records r WHERE EXISTS (
     SELECT 1 FROM jsonb_array_elements(r.data->'s3'->'items') it
     WHERE (r.company IN ('BTSC','BID') AND it->>'org' LIKE '%สายสี%')
        OR (r.company='EBM' AND it->>'org' NOT LIKE '%สายสีเหลือง%')
        OR (r.company='NBM' AND it->>'org' NOT LIKE '%สายสีชมพู%'))) AS s3_bad`)[0];
console.log("\nตรวจ (ทุกค่าควร 0):");
console.log("  BTSC/BID s1.org มีสายสี:", v.base_has_color);
console.log("  EBM s1.org ไม่ใช่เหลือง:", v.ebm_bad);
console.log("  NBM s1.org ไม่ใช่ชมพู:", v.nbm_bad);
console.log("  s3.items org ข้ามบริษัท:", v.s3_bad);
