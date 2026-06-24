import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { listSummaries, listRecordsFull, getRecordAccessInfo, upsertRecord } from "@/lib/db";
import { scopeOf, canAccess } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function err(e){ return NextResponse.json({ error: e.message }, { status: e.status || 500 }); }

// list — ตามลำดับชั้น: admin=ทุกคน, ฝ่าย=ทั้งฝ่าย, อื่น ๆ=ของตัวเอง · default=ย่อ, ?full=1=เต็ม
export async function GET(req){
  try {
    const u = await requireUser();
    const scope = scopeOf(u);
    const full = new URL(req.url).searchParams.get("full");
    const records = full ? await listRecordsFull(scope) : await listSummaries(scope);
    return NextResponse.json({ records });
  } catch(e){ return err(e); }
}

// upsert record
export async function POST(req){
  try {
    const u = await requireUser();
    const rec = await req.json();
    if(!rec || !rec.id) return NextResponse.json({ error: "invalid record" }, { status: 400 });
    const info = await getRecordAccessInfo(rec.id);
    if(info && !canAccess(u, info.ownerId, info.ownerDivision))
      return NextResponse.json({ error: "ไม่มีสิทธิ์แก้ไขรายการนี้" }, { status: 403 });
    await upsertRecord(rec, info ? info.ownerId : u.id);
    return NextResponse.json({ ok: true, record: rec });
  } catch(e){ return err(e); }
}
