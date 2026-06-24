import { readFileSync } from 'fs';
for(const line of readFileSync(new URL('../.env.local', import.meta.url),'utf8').split('\n')){ const m=line.match(/^([A-Z_]+)=(.*)$/); if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim(); }
const { companiesForOrg } = await import('../lib/master.js');
const { listUsers, insertRecordsWithOwners, sql } = await import('../lib/db.js');
const { makeDummyByDept } = await import('../lib/dummy.js');
console.log('clearing records...');
await sql`DELETE FROM records`;
const users = await listUsers();
const pairs = [];
for(const u of users){
  if(u.role === 'admin') continue;
  let org='', dept='';
  if(u.department){ org=u.section; dept=u.department; }
  else if(u.section){ org=u.section; }
  else if(u.division){ org=u.division; }
  else continue;
  if(!org) continue;
  for(const company of companiesForOrg(org)){
    for(const r of makeDummyByDept(4, org, dept)){ r.company = company; pairs.push({ rec:r, owner:u.id }); }
  }
}
console.log('inserting', pairs.length, 'records ...');
await insertRecordsWithOwners(pairs);
console.log('--- distribution per company ---');
for(const d of await sql`SELECT company, count(*)::int recs, count(distinct org)::int orgs FROM records GROUP BY company ORDER BY company`)
  console.log(`  ${d.company}: ${d.recs} records · ${d.orgs} หน่วยงาน`);
const both = await sql`SELECT company, count(*)::int n FROM records WHERE org LIKE '%สายสีชมพูและสายสีเหลือง%' GROUP BY company ORDER BY company`;
console.log('หน่วยงาน "ชมพู+เหลือง" กระจายไป:', both.map(b=>`${b.company}=${b.n}`).join(', '), '(ควรอยู่ EBM และ NBM เท่ากัน)');
const bad = await sql`SELECT count(*)::int n FROM records WHERE company='BTSC' AND org LIKE '%สายสี%'`;
console.log('ตรวจ: org มีสี หลุดไป BTSC =', bad[0].n, '(ควร 0)');
