import { readFileSync } from 'fs';
for(const line of readFileSync(new URL('../.env.local', import.meta.url),'utf8').split('\n')){ const m=line.match(/^([A-Z_]+)=(.*)$/); if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim(); }
const { MASTER } = await import('../lib/master.js');
const { listUsers, insertRecordsWithOwners, sql } = await import('../lib/db.js');
const { makeDummyByDept } = await import('../lib/dummy.js');
const pick = a => a[Math.floor(Math.random()*a.length)];
console.log('clearing records...');
await sql`DELETE FROM records`;
const users = await listUsers();
const pairs = [];
let nDiv=0,nSec=0,nDep=0;
for(const u of users){
  if(u.role === 'admin') continue;
  let org='', dept='';
  if(u.department){ org=u.section; dept=u.department; nDep++; }
  else if(u.section){ org=u.section; nSec++; }
  else if(u.division){ org=u.division; nDiv++; }
  else continue;
  if(!org) continue;
  const company = pick(MASTER.companies);
  for(const r of makeDummyByDept(4, org, dept)){ r.company = company; pairs.push({ rec:r, owner:u.id }); }
}
console.log(`users -> ฝ่าย:${nDiv} ส่วน:${nSec} แผนก:${nDep} · records to insert: ${pairs.length}`);
const t0=Date.now();
await insertRecordsWithOwners(pairs);
console.log('insert took', ((Date.now()-t0)/1000).toFixed(1),'s');
const r=await sql`SELECT count(*)::int n FROM records`;
console.log('TOTAL records:', r[0].n);
