// สร้าง 3 แผนก ต่อ 1 ส่วน (รหัส 123) + 20 records/แผนก เป็นของ user แผนกนั้น
// Run: node --experimental-loader ./_resolve.mjs scripts/seed-departments.mjs
import { readFileSync } from "fs";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

try {
  for(const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")){
    const m = line.match(/^([A-Z_]+)=(.*)$/); if(m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {}

const { SECTIONS, DIVISION_SECTIONS } = await import("../lib/master.js");
const { initSchema, listUsers, rawQuery, insertRecordsWithOwners, sql } = await import("../lib/db.js");
const { makeDummyByDept } = await import("../lib/dummy.js");

await initSchema();
const PER_DEPT = 20, DEPTS = 3;
const sec2div = {}; for(const [d,secs] of Object.entries(DIVISION_SECTIONS)) for(const s of secs) sec2div[s] = d;
const codeOf = (org) => { const m = org.match(/\(([^()]+)\)\s*$/); return (m ? m[1] : org).toLowerCase().replace(/[^a-z0-9]+/g, ""); };
const pwHash = await bcrypt.hash("123", 10);

// 1) เตรียม user แผนก
const wanted = [];
for(const sec of SECTIONS){
  const code = codeOf(sec), div = sec2div[sec] || "";
  for(let n=1;n<=DEPTS;n++){
    const dept = "แผนกงาน " + n;
    wanted.push({ id: crypto.randomUUID(), email: `${code}${n}@bts.co.th`, name: `${sec} / ${dept}`,
      title: "ผู้ใช้ประจำแผนก", division: div, section: sec, department: dept, role: "user", passwordHash: pwHash });
  }
}
const existing = new Set((await listUsers()).map(u => u.email.toLowerCase()));
const toCreate = wanted.filter(u => !existing.has(u.email.toLowerCase()));
console.log(`แผนก users: total ${wanted.length}, to create ${toCreate.length}`);
// batch insert users
for(let i=0;i<toCreate.length;i+=200){
  const chunk = toCreate.slice(i,i+200); const ph=[], vals=[];
  chunk.forEach((u,j)=>{ const b=j*9; ph.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9})`);
    vals.push(u.id,u.email,u.name,u.title,u.division,u.section,u.department,u.role,u.passwordHash); });
  await rawQuery(`INSERT INTO users (id,email,name,title,division,section,department,role,password_hash) VALUES ${ph.join(",")} ON CONFLICT (email) DO NOTHING`, vals);
}

// 2) map email->id (รวมที่มีอยู่เดิม)
const idByEmail = {}; for(const u of await listUsers()) idByEmail[u.email.toLowerCase()] = u.id;

// 3) records ของแต่ละแผนก
const pairs = [];
for(const sec of SECTIONS){
  const code = codeOf(sec);
  for(let n=1;n<=DEPTS;n++){
    const owner = idByEmail[`${code}${n}@bts.co.th`];
    for(const rec of makeDummyByDept(PER_DEPT, sec, "แผนกงาน " + n)) pairs.push({ rec, owner });
  }
}
console.log(`inserting ${pairs.length} dept records ...`);
const t0 = Date.now();
await insertRecordsWithOwners(pairs);
console.log("insert took", ((Date.now()-t0)/1000).toFixed(1), "s");

const r = await sql`SELECT count(*)::int n FROM records`;
const u = await sql`SELECT count(*)::int n FROM users`;
console.log(`DONE. records: ${r[0].n} | users: ${u[0].n}`);
