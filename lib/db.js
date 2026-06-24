import { neon } from "@neondatabase/serverless";
import { recordComplete } from "./validate";
import { recName } from "./util";

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
  await sql`CREATE INDEX IF NOT EXISTS records_uts_idx ON records(updated_ts DESC)`;
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

// WHERE clause ตาม scope (all / division / division+section / own)
function scopeWhere(scope){
  if(scope.all) return { sql: "", params: [] };
  if(scope.division && scope.section) return { sql: "WHERE user_id IN (SELECT id FROM users WHERE division=$1 AND section=$2)", params: [scope.division, scope.section] };
  if(scope.division) return { sql: "WHERE user_id IN (SELECT id FROM users WHERE division=$1)", params: [scope.division] };
  return { sql: "WHERE user_id=$1", params: [scope.userId] };
}

// ข้อมูลเต็ม (ใช้ตอน export / dashboard)
export async function listRecordsFull(scope){
  const w = scopeWhere(scope);
  const rows = await rawQuery(`SELECT data FROM records ${w.sql} ORDER BY updated_ts DESC`, w.params);
  return rows.map(r => r.data);
}
// ข้อมูลย่อ (ใช้แสดง list/จัดกลุ่ม/ค้นหา) — อ่านเฉพาะคอลัมน์ denormalized ไม่แตะ JSONB จึงเร็ว
export async function listSummaries(scope){
  const w = scopeWhere(scope);
  const rows = await rawQuery(
    `SELECT id, company, org, status, complete, updated_ts AS uts, activity, activity_other AS ao, recorder_name AS rn, updated_at AS ua, department AS dept
     FROM records ${w.sql} ORDER BY updated_ts DESC`, w.params);
  return rows.map(r => ({
    id: r.id, company: r.company, status: r.status, complete: r.complete, department: r.dept,
    updatedTs: Number(r.uts), updatedAt: r.ua,
    s1: { org: r.org, activity: r.activity, activityOther: r.ao },
    recorder: { name: r.rn },
  }));
}
export async function getRecord(id){
  const r = await sql`SELECT rc.data, rc.user_id, u.division AS owner_division, u.section AS owner_section
                      FROM records rc JOIN users u ON u.id=rc.user_id WHERE rc.id=${id} LIMIT 1`;
  return r[0] ? { data: r[0].data, owner: { id:r[0].user_id, division:r[0].owner_division, section:r[0].owner_section } } : null;
}
// ข้อมูลสิทธิ์ของ record (owner + ฝ่าย/ส่วน ของ owner) — ใช้เช็คการเข้าถึงโดยไม่อ่าน JSONB
export async function getRecordAccessInfo(id){
  const r = await sql`SELECT rc.user_id, u.division AS owner_division, u.section AS owner_section
                      FROM records rc JOIN users u ON u.id=rc.user_id WHERE rc.id=${id} LIMIT 1`;
  return r[0] ? { id: r[0].user_id, division: r[0].owner_division, section: r[0].owner_section } : null;
}
export async function upsertRecord(rec, ownerId){
  const c = cols(rec);
  await sql`INSERT INTO records (id,user_id,company,org,status,updated_ts,complete,activity,activity_other,recorder_name,updated_at,department,data)
            VALUES (${rec.id},${ownerId},${c.company},${c.org},${c.status},${c.updated_ts},${c.complete},${c.activity},${c.activity_other},${c.recorder_name},${c.updated_at},${c.department},${JSON.stringify(rec)}::jsonb)
            ON CONFLICT (id) DO UPDATE SET
              company=EXCLUDED.company, org=EXCLUDED.org, status=EXCLUDED.status, updated_ts=EXCLUDED.updated_ts,
              complete=EXCLUDED.complete, activity=EXCLUDED.activity, activity_other=EXCLUDED.activity_other,
              recorder_name=EXCLUDED.recorder_name, updated_at=EXCLUDED.updated_at, department=EXCLUDED.department, data=EXCLUDED.data`;
}
export async function deleteRecord(id){ await sql`DELETE FROM records WHERE id=${id}`; }
export async function clearRecords(scope){
  if(scope.all) await sql`DELETE FROM records`;
  else if(scope.division) await sql`DELETE FROM records WHERE user_id IN (SELECT id FROM users WHERE division=${scope.division})`;
  else await sql`DELETE FROM records WHERE user_id=${scope.userId}`;
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
