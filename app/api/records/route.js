import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { listSummaries, listRecordsFull, getRecordOwner, upsertRecord } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function err(e){ return NextResponse.json({ error: e.message }, { status: e.status || 500 }); }

// list — admin เห็นทุกคน, user เห็นของตัวเอง · default = ข้อมูลย่อ, ?full=1 = ข้อมูลเต็ม
export async function GET(req){
  try {
    const u = await requireUser();
    const all = u.role === "admin";
    const full = new URL(req.url).searchParams.get("full");
    const records = full
      ? await listRecordsFull({ all, userId: u.id })
      : await listSummaries({ all, userId: u.id });
    return NextResponse.json({ records });
  } catch(e){ return err(e); }
}

// upsert record
export async function POST(req){
  try {
    const u = await requireUser();
    const rec = await req.json();
    if(!rec || !rec.id) return NextResponse.json({ error: "invalid record" }, { status: 400 });
    const owner = await getRecordOwner(rec.id);
    if(owner && owner !== u.id && u.role !== "admin")
      return NextResponse.json({ error: "ไม่มีสิทธิ์แก้ไขรายการนี้" }, { status: 403 });
    await upsertRecord(rec, owner || u.id);
    return NextResponse.json({ ok: true, record: rec });
  } catch(e){ return err(e); }
}
