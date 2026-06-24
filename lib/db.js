import { neon } from "@neondatabase/serverless";

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
}

/* ---------- users ---------- */
const pubUser = u => u && ({ id:u.id, email:u.email, name:u.name, title:u.title, division:u.division, section:u.section, role:u.role, createdAt:u.created_at });

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
export async function createUser({ id, email, name, title, division, section, role, passwordHash }){
  await sql`INSERT INTO users (id,email,name,title,division,section,role,password_hash)
            VALUES (${id},${email},${name||''},${title||''},${division||''},${section||''},${role||'user'},${passwordHash})`;
  return pubUser(await getUserById(id));
}
export async function updateUser(id, { name, title, division, section, role, passwordHash }){
  if(passwordHash){
    await sql`UPDATE users SET name=${name}, title=${title}, division=${division}, section=${section}, role=${role}, password_hash=${passwordHash} WHERE id=${id}`;
  } else {
    await sql`UPDATE users SET name=${name}, title=${title}, division=${division}, section=${section}, role=${role} WHERE id=${id}`;
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
  };
}

export async function listRecords({ all, userId }){
  const rows = all
    ? await sql`SELECT data FROM records ORDER BY updated_ts DESC`
    : await sql`SELECT data FROM records WHERE user_id=${userId} ORDER BY updated_ts DESC`;
  return rows.map(r => r.data);
}
export async function getRecordOwner(id){
  const r = await sql`SELECT user_id FROM records WHERE id=${id} LIMIT 1`;
  return r[0]?.user_id || null;
}
export async function upsertRecord(rec, ownerId){
  const c = cols(rec);
  await sql`INSERT INTO records (id,user_id,company,org,status,updated_ts,data)
            VALUES (${rec.id},${ownerId},${c.company},${c.org},${c.status},${c.updated_ts},${JSON.stringify(rec)}::jsonb)
            ON CONFLICT (id) DO UPDATE SET
              company=EXCLUDED.company, org=EXCLUDED.org, status=EXCLUDED.status,
              updated_ts=EXCLUDED.updated_ts, data=EXCLUDED.data`;
}
export async function deleteRecord(id){ await sql`DELETE FROM records WHERE id=${id}`; }
export async function clearRecords({ all, userId }){
  if(all) await sql`DELETE FROM records`;
  else await sql`DELETE FROM records WHERE user_id=${userId}`;
}
export async function bulkInsertRecords(recs, ownerId){
  for(const rec of recs){ await upsertRecord(rec, ownerId); }
  return recs.length;
}
