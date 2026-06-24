import { readFileSync } from 'fs';
for(const line of readFileSync(new URL('../.env.local', import.meta.url),'utf8').split('\n')){ const m=line.match(/^([A-Z_]+)=(.*)$/); if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim(); }
const { companyForOrg } = await import('../lib/master.js');
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
  const company = companyForOrg(org);
  for(const r of makeDummyByDept(4, org, dept)){ r.company = company; pairs.push({ rec:r, owner:u.id }); }
}
console.log('inserting', pairs.length, 'records ...');
await insertRecordsWithOwners(pairs);
console.log('--- distribution per company ---');
const dist = await sql`SELECT company, count(*)::int recs, count(distinct org)::int orgs FROM records GROUP BY company ORDER BY company`;
for(const d of dist) console.log(`  ${d.company}: ${d.recs} records · ${d.orgs} หน่วยงาน(org)`);
const bad1 = await sql`SELECT count(*)::int n FROM records WHERE company='BTSC' AND (org LIKE '%สายสีเหลือง%' OR org LIKE '%สายสีชมพู%')`;
const bad2 = await sql`SELECT count(*)::int n FROM records WHERE company<>'BTSC' AND org NOT LIKE '%สายสี%'`;
console.log('ตรวจ: org สีเหลือง/ชมพู ที่หลุดไป BTSC =', bad1[0].n, '(ควร 0)');
console.log('ตรวจ: org ไม่ระบุสี ที่หลุดไปบริษัทอื่น =', bad2[0].n, '(ควร 0)');
