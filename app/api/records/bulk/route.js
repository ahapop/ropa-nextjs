import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { bulkInsertRecords, clearRecords } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function err(e){ return NextResponse.json({ error: e.message }, { status: e.status || 500 }); }

// bulk insert/upsert (import XML / ข้อมูลตัวอย่าง) — owner = ผู้ใช้ปัจจุบัน
export async function POST(req){
  try {
    const u = await requireUser();
    const { records } = await req.json();
    if(!Array.isArray(records)) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    const n = await bulkInsertRecords(records, u.id);
    return NextResponse.json({ ok: true, count: n });
  } catch(e){ return err(e); }
}

// clear — admin ล้างทั้งหมด, user ล้างของตัวเอง
export async function DELETE(){
  try {
    const u = await requireUser();
    await clearRecords({ all: u.role === "admin", userId: u.id });
    return NextResponse.json({ ok: true });
  } catch(e){ return err(e); }
}
