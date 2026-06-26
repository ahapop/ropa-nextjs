import { neon } from "@neondatabase/serverless";
import { recordComplete } from "./validate";
import { recName } from "./util";
import { companyAggregates } from "./analytics";

// หา connection string จาก env ได้ทุกชื่อ (รองรับ prefix ของ Vercel เช่น STORAGE_URL ฯลฯ)
export function findPgUrl(){
  const preferred = ["POSTGRES_URL","DATABASE_URL","POSTGRES_URL_NON_POOLING","DATABASE_URL_UNPOOLED"];
  for(const k of preferred){ if(process.env[k]) return { key:k, url:process.env[k] }; }
  const cands = [];
  for(const [k,v] of Object.entries(process.env)){
    if(typeof v === "string" && /^postgres(ql)?:\/\//i.test(v)) cands.push({ key:k, url:v });
  }
  if(cands.length){
    return cands.find(c => /pooler/i.test(c.url)) || cands[0];
  }
  return null;
}

// lazy singleton — อ่าน connection string ตอน runtime
let _sql = null;
export function sql(strings, ...vals){
  if(!_sql){
    const f = findPgUrl();
    if(!f) throw new Error("ไม่พบ Postgres connection URL ใน environment");
    _sql = neon(f.url);
  }
  return _sql(strings, ...vals);
}

export async function initSchema(){
  await sql`CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    name          TEXT NOT NULL DEFAULT '',
    title         TEXT NOT NULL DEFAULT '',
    division      TEXT NOT NULL DEFAULT '',
    section       TEXT NOT NULL DEFAULT '',
    role          TEXT NOT NULL DEFAULT 'user',
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS records (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company     TEXT NOT NULL DEFAULT '',
    org         TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'draft',
    updated_ts  BIGINT NOT NULL DEFAULT 0,
    data        JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS records_user_idx ON records(user_id)`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS complete BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS activity TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS activity_other TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS recorder_name TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS updated_at TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE users   ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS due_date DATE`;
  await sql`CREATE INDEX IF NOT EXISTS records_uts_idx ON records(updated_ts DESC)`;
  // ประวัติรายวันเพื่อทำกราฟแนวโน้ม / เทียบช่วงเวลา (1 แถวต่อ บริษัท ต่อ วัน)
  await sql`CREATE TABLE IF NOT EXISTS ropa_snapshots (
    id            BIGSERIAL PRIMARY KEY,
    day           DATE NOT NULL DEFAULT current_date,
    company       TEXT NOT NULL,
    total         INT NOT NULL DEFAULT 0,
    complete      INT NOT NULL DEFAULT 0,
    high_risk     INT NOT NULL DEFAULT 0,
    cross_no_sg   INT NOT NULL DEFAULT 0,
    sens_no_law   INT NOT NULL DEFAULT 0,
    dpa_missing   INT NOT NULL DEFAULT 0,
    stale30       INT NOT NULL DEFAULT 0,
    captured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(day, company)
  )`;
}

/* ---------- users ---------- */
const pubUser = u => u && ({ id:u.id, email:u.email, name:u.name, title:u.title, division:u.division, section:u.section, department:u.department, role:u.role, createdAt:u.created_at });

export async function getUserByEmail(email){
  const r = await sql`SELECT * FROM users WHERE lower(email)=lower(${email}) LIMIT 1`;
  return r[0] || null;
}
export async function getUserById(id){
  const r = await sql`SELECT * FROM users WHERE id=${id} LIMIT 1`;
  return r[0] || null;
}
export async function listUsers(){
  const r = await sql`SELECT * FROM users ORDER BY created_at ASC`;
  return r.map(pubUser);
}
export async function createUser({ id, email, name, title, division, section, department, role, passwordHash }){
  await sql`INSERT INTO users (id,email,name,title,division,section,department,role,password_hash)
            VALUES (${id},${email},${name||''},${title||''},${division||''},${section||''},${department||''},${role||'user'},${passwordHash})`;
  return pubUser(await getUserById(id));
}
export async function updateUser(id, { name, title, division, section, department, role, passwordHash }){
  if(passwordHash){
    await sql`UPDATE users SET name=${name}, title=${title}, division=${division}, section=${section}, department=${department}, role=${role}, password_hash=${passwordHash} WHERE id=${id}`;
  } else {
    await sql`UPDATE users SET name=${name}, title=${title}, division=${division}, section=${section}, department=${department}, role=${role} WHERE id=${id}`;
  }
  return pubUser(await getUserById(id));
}
export async function deleteUser(id){ await sql`DELETE FROM users WHERE id=${id}`; }
export async function countUsers(){ const r = await sql`SELECT count(*)::int AS n FROM users`; return r[0].n; }

/* ---------- records ---------- */
export { pubUser };

function cols(rec){
  return {
    company: rec.company || '',
    org: rec.s1?.org || '',
    status: rec.status || 'draft',
    updated_ts: rec.updatedTs || 0,
    complete: !!recordComplete(rec),
    activity: rec.s1?.activity || '',
    activity_other: rec.s1?.activityOther || '',
    recorder_name: recName(rec) || '',
    updated_at: rec.updatedAt || '',
    department: rec.department || rec.recorder?.department || '',
  };
}

// WHERE clause ตาม scope · จำกัดบริษัท (company) ก่อน แล้วค่อยลำดับชั้น (all / division / division+section / own)
function scopeWhere(scope){
  if(scope.all) return { sql: "", params: [] };
  const conds = [], params = [];
  if(scope.company){ params.push(scope.company); conds.push(`company = $${params.length}`); }
  if(scope.division && scope.section){
    params.push(scope.division); const d = params.length;
    params.push(scope.section);  const s = params.length;
    conds.push(`user_id IN (SELECT id FROM users WHERE division=$${d} AND section=$${s})`);
  } else if(scope.division){
    params.push(scope.division); conds.push(`user_id IN (SELECT id FROM users WHERE division=$${params.length})`);
  } else if(scope.userId){
    params.push(scope.userId); conds.push(`user_id = $${params.length}`);
  }
  return { sql: conds.length ? "WHERE " + conds.join(" AND ") : "", params };
}

// ข้อมูลเต็ม (ใช้ตอน export / dashboard)
export async function listRecordsFull(scope, range){
  const w = scopeWhere(scope);
  let sql = w.sql; const params = [...w.params]; const extra = [];
  // กรองตามช่วงเวลา (updated_ts มี index) — เร็วและลดข้อมูลที่โหลด
  if(range && range.from != null){ params.push(range.from); extra.push(`updated_ts >= $${params.length}`); }
  if(range && range.to   != null){ params.push(range.to);   extra.push(`updated_ts <= $${params.length}`); }
  if(extra.length) sql = (sql ? sql + " AND " : "WHERE ") + extra.join(" AND ");
  const rows = await rawQuery(`SELECT data FROM records ${sql} ORDER BY updated_ts DESC`, params);
  return rows.map(r => r.data);
}
// ข้อมูลย่อ (ใช้แสดง list/จัดกลุ่ม/ค้นหา) — อ่านเฉพาะคอลัมน์ denormalized ไม่แตะ JSONB จึงเร็ว
export async function listSummaries(scope){
  const w = scopeWhere(scope);
  const rows = await rawQuery(
    `SELECT id, company, org, status, complete, updated_ts AS uts, activity, activity_other AS ao, recorder_name AS rn, updated_at AS ua, department AS dept, created_at AS cat
     FROM records ${w.sql} ORDER BY updated_ts DESC`, w.params);
  return rows.map(r => ({
    id: r.id, company: r.company, status: r.status, complete: r.complete, department: r.dept,
    updatedTs: Number(r.uts), updatedAt: r.ua, createdAt: r.cat,
    s1: { org: r.org, activity: r.activity, activityOther: r.ao },
    recorder: { name: r.rn },
  }));
}
export async function getRecord(id){
  const r = await sql`SELECT rc.data, rc.user_id, rc.company, u.division AS owner_division, u.section AS owner_section
                      FROM records rc JOIN users u ON u.id=rc.user_id WHERE rc.id=${id} LIMIT 1`;
  return r[0] ? { data: r[0].data, owner: { id:r[0].user_id, company:r[0].company, division:r[0].owner_division, section:r[0].owner_section } } : null;
}
// ข้อมูลสิทธิ์ของ record (owner + บริษัท + ฝ่าย/ส่วน ของ owner) — ใช้เช็คการเข้าถึงโดยไม่อ่าน JSONB
export async function getRecordAccessInfo(id){
  const r = await sql`SELECT rc.user_id, rc.company, u.division AS owner_division, u.section AS owner_section
                      FROM records rc JOIN users u ON u.id=rc.user_id WHERE rc.id=${id} LIMIT 1`;
  return r[0] ? { id: r[0].user_id, company: r[0].company, division: r[0].owner_division, section: r[0].owner_section } : null;
}
export async function upsertRecord(rec, ownerId){
  const c = cols(rec);
  // completed_at: ตั้งครั้งแรกที่ record สมบูรณ์ และไม่ล้างทีหลัง (ใช้ทำ trend งานเสร็จ)
  await sql`INSERT INTO records (id,user_id,company,org,status,updated_ts,complete,activity,activity_other,recorder_name,updated_at,department,data,completed_at)
            VALUES (${rec.id},${ownerId},${c.company},${c.org},${c.status},${c.updated_ts},${c.complete},${c.activity},${c.activity_other},${c.recorder_name},${c.updated_at},${c.department},${JSON.stringify(rec)}::jsonb,
                    CASE WHEN ${c.complete} THEN now() ELSE NULL END)
            ON CONFLICT (id) DO UPDATE SET
              company=EXCLUDED.company, org=EXCLUDED.org, status=EXCLUDED.status, updated_ts=EXCLUDED.updated_ts,
              complete=EXCLUDED.complete, activity=EXCLUDED.activity, activity_other=EXCLUDED.activity_other,
              recorder_name=EXCLUDED.recorder_name, updated_at=EXCLUDED.updated_at, department=EXCLUDED.department, data=EXCLUDED.data,
              completed_at=COALESCE(records.completed_at, CASE WHEN EXCLUDED.complete THEN now() ELSE NULL END)`;
}
export async function deleteRecord(id){ await sql`DELETE FROM records WHERE id=${id}`; }
export async function clearRecords(scope){
  if(scope.all){ await sql`DELETE FROM records`; return; }
  const w = scopeWhere(scope);
  if(!w.sql) return; // กันลบทั้งหมดโดยไม่ตั้งใจเมื่อ scope ว่าง
  await rawQuery(`DELETE FROM records ${w.sql}`, w.params);
}
// query แบบไม่ใช้ tagged template (สำหรับ multi-row insert)
export async function rawQuery(text, params){
  if(!_sql){ const f = findPgUrl(); if(!f) throw new Error("ไม่พบ Postgres connection URL ใน environment"); _sql = neon(f.url); }
  return _sql.query(text, params);
}

// insert แบบ batch (multi-row) — รับ [{rec, owner}]
export async function insertRecordsWithOwners(pairs){
  const B = 200;
  for(let i=0;i<pairs.length;i+=B){
    const chunk = pairs.slice(i, i+B);
    const ph=[], vals=[];
    chunk.forEach(({rec, owner}, j)=>{
      const c = cols(rec); const b = j*13;
      ph.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13}::jsonb)`);
      vals.push(rec.id, owner, c.company, c.org, c.status, c.updated_ts, c.complete, c.activity, c.activity_other, c.recorder_name, c.updated_at, c.department, JSON.stringify(rec));
    });
    await rawQuery(
      `INSERT INTO records (id,user_id,company,org,status,updated_ts,complete,activity,activity_other,recorder_name,updated_at,department,data) VALUES ${ph.join(',')}
       ON CONFLICT (id) DO UPDATE SET company=EXCLUDED.company,org=EXCLUDED.org,status=EXCLUDED.status,updated_ts=EXCLUDED.updated_ts,complete=EXCLUDED.complete,activity=EXCLUDED.activity,activity_other=EXCLUDED.activity_other,recorder_name=EXCLUDED.recorder_name,updated_at=EXCLUDED.updated_at,department=EXCLUDED.department,data=EXCLUDED.data`,
      vals
    );
  }
  return pairs.length;
}

export async function bulkInsertRecords(recs, ownerId){
  return insertRecordsWithOwners(recs.map(rec => ({ rec, owner: ownerId })));
}

// สร้างข้อมูลจำลอง "ครบทุกบริษัท" — เจ้าของเป็น user รายฝ่ายของแต่ละบริษัท (แยกบริษัทถูกต้อง)
// company = โดเมนอีเมล owner · org ทุกจุด (s1/s3/s7/recorder) อยู่ในชุดฝ่ายของบริษัทนั้น
export async function seedAllCompanies(perUser = 5){
  const { makeDummyByDept } = await import("./dummy");
  const { orgsForCompany } = await import("./master");
  const DOMAIN_COMPANY = { "bts.co.th":"BTSC", "bid.com":"BID", "ebm.com":"EBM", "nbm.com":"NBM" };
  const companyOfEmail = (email) => DOMAIN_COMPANY[(email.split("@")[1]||"").toLowerCase()] || null;
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const sampleN = (a,n)=>{ const c=a.slice(), o=[]; for(let i=0;i<n&&c.length;i++) o.push(c.splice(Math.floor(Math.random()*c.length),1)[0]); return o; };
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
    for(const r of makeDummyByDept(perUser, org, dept)){
      r.company = company;
      r.recorder = { ...r.recorder, division:u.division||"", section:u.section||"", department:dept };
      const n = Math.min(shareOrgs.length, 1 + Math.floor(Math.random()*3));
      r.s3.items = sampleN(shareOrgs, n).map(o => ({ org:o, purpose:"ใช้ข้อมูลร่วมกันระหว่างหน่วยงานภายในเพื่อการประมวลผล",
        general:r.s3.items[0]?.general || [], sensitive:[], lawful:r.s3.items[0]?.lawful || [], lawfulSens:[] }));
      r.s7.who = "เจ้าหน้าที่ที่ได้รับมอบหมายของ" + pick(companyOrgs);
      pairs.push({ rec:r, owner:u.id });
    }
  }
  for(let i=0;i<pairs.length;i+=200) await insertRecordsWithOwners(pairs.slice(i, i+200));
  return pairs.length;
}

/* ---------- snapshots (ประวัติรายวันเพื่อ trend / รายงานผู้บริหาร) ---------- */
// เก็บ aggregate รายบริษัท 1 แถว/บริษัท/วัน (re-run วันเดิม = อัปเดตทับ)
export async function captureSnapshot(now){
  const rows = await sql`SELECT data FROM records`;
  const agg = companyAggregates(rows.map(r=>r.data), now || Date.now());
  for(const a of agg){
    await sql`INSERT INTO ropa_snapshots (company,total,complete,high_risk,cross_no_sg,sens_no_law,dpa_missing,stale30)
              VALUES (${a.company},${a.total},${a.complete},${a.highRisk},${a.crossNoSafeguard},${a.sensitiveNoLawful},${a.dpaMissing},${a.stale30})
              ON CONFLICT (day, company) DO UPDATE SET
                total=EXCLUDED.total, complete=EXCLUDED.complete, high_risk=EXCLUDED.high_risk,
                cross_no_sg=EXCLUDED.cross_no_sg, sens_no_law=EXCLUDED.sens_no_law,
                dpa_missing=EXCLUDED.dpa_missing, stale30=EXCLUDED.stale30, captured_at=now()`;
  }
  return agg.length;
}
export async function listSnapshots(days=90, company){
  if(company) return sql`SELECT day,company,total,complete,high_risk,cross_no_sg,sens_no_law,dpa_missing,stale30
                         FROM ropa_snapshots WHERE company=${company} AND day >= current_date - ${days}::int ORDER BY day ASC`;
  return sql`SELECT day,company,total,complete,high_risk,cross_no_sg,sens_no_law,dpa_missing,stale30
             FROM ropa_snapshots WHERE day >= current_date - ${days}::int ORDER BY day ASC, company ASC`;
}
