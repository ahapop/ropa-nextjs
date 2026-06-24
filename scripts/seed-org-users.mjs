// สร้าง user 1 คน ต่อ 1 ฝ่าย/ส่วน (password 123) + 20 records ของหน่วยงานนั้น เป็นของ user นั้น
// Run: node scripts/seed-org-users.mjs   (loads .env.local)
import { readFileSync } from "fs";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

try {
  for(const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")){
    const m = line.match(/^([A-Z_]+)=(.*)$/); if(m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {}

const { DIVISIONS, SECTIONS, DIVISION_SECTIONS } = await import("../lib/master.js");
const { getUserByEmail, createUser, insertRecordsWithOwners, sql } = await import("../lib/db.js");
const { makeDummyByOrg } = await import("../lib/dummy.js");

const PER_ORG = 20;
const orgs = [...DIVISIONS, ...SECTIONS];

// section -> parent division
const sec2div = {};
for(const [div, secs] of Object.entries(DIVISION_SECTIONS)) for(const s of secs) sec2div[s] = div;

const codeOf = (org) => { const m = org.match(/\(([^()]+)\)\s*$/); return (m ? m[1] : org).toLowerCase().replace(/[^a-z0-9]+/g, ""); };

const pwHash = await bcrypt.hash("123", 10);
const usedEmails = new Set();
let created = 0, reused = 0;
const pairs = [];

for(const org of orgs){
  let base = codeOf(org) || "u";
  let email = base + "@bts.co.th", k = 2;
  while(usedEmails.has(email)){ email = base + k + "@bts.co.th"; k++; }
  usedEmails.add(email);

  let u = await getUserByEmail(email);
  if(!u){
    const isDiv = DIVISIONS.includes(org);
    u = await createUser({
      id: crypto.randomUUID(), email, name: org, title: isDiv ? "ผู้ใช้ประจำฝ่าย" : "ผู้ใช้ประจำส่วน",
      division: isDiv ? org : (sec2div[org] || ""), section: isDiv ? "" : org,
      role: "user", passwordHash: pwHash,
    });
    created++;
  } else reused++;

  for(const rec of makeDummyByOrg(PER_ORG, [org])) pairs.push({ rec, owner: u.id });
}

console.log(`users: created ${created}, reused ${reused} (total orgs ${orgs.length})`);
console.log(`inserting ${pairs.length} records ...`);
await insertRecordsWithOwners(pairs);

const tot = await sql`select count(*)::int n from records`;
const utot = await sql`select count(*)::int n from users`;
console.log(`DONE. records in DB: ${tot[0].n} | users in DB: ${utot[0].n}`);
console.log("ตัวอย่าง login (password 123):");
for(const org of orgs.slice(0, 6)) console.log(`  ${codeOf(org)}@bts.co.th  ->  ${org}`);
