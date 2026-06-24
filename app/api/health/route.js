import { NextResponse } from "next/server";
import { sql, countUsers } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ชั่วคราว: วินิจฉัยการตั้งค่า env / การเชื่อมต่อ DB บน Vercel (ไม่เปิดเผยค่าลับ)
export async function GET(){
  const out = {
    hasPostgresUrl: !!(process.env.POSTGRES_URL || process.env.DATABASE_URL),
    hasAuthSecret: !!process.env.AUTH_SECRET,
    nodeEnv: process.env.NODE_ENV || null,
  };
  try {
    await sql`select 1 as ok`;
    out.db = "connected";
    try { out.userCount = await countUsers(); }
    catch(e){ out.db = "connected but tables missing: " + e.message; }
  } catch(e){
    out.db = "ERROR: " + (e?.message || String(e));
  }
  return NextResponse.json(out);
}
