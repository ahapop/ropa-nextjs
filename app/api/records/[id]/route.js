import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { getRecord, getRecordOwner, deleteRecord } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ดึงข้อมูลเต็มของ 1 รายการ (ตอนแก้ไข / Data Map)
export async function GET(req, { params }){
  try {
    const u = await requireUser();
    const { id } = await params;
    const rec = await getRecord(id);
    if(!rec) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
    if(rec.ownerId !== u.id && u.role !== "admin")
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงรายการนี้" }, { status: 403 });
    return NextResponse.json({ record: rec.data });
  } catch(e){ return NextResponse.json({ error: e.message }, { status: e.status || 500 }); }
}

export async function DELETE(req, { params }){
  try {
    const u = await requireUser();
    const { id } = await params;
    const owner = await getRecordOwner(id);
    if(!owner) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
    if(owner !== u.id && u.role !== "admin")
      return NextResponse.json({ error: "ไม่มีสิทธิ์ลบรายการนี้" }, { status: 403 });
    await deleteRecord(id);
    return NextResponse.json({ ok: true });
  } catch(e){ return NextResponse.json({ error: e.message }, { status: e.status || 500 }); }
}
