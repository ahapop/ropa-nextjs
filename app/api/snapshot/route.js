import { NextResponse } from "next/server";
import { requireUser, requireAdmin } from "@/lib/authz";
import { listSnapshots, captureSnapshot } from "@/lib/db";
import { companyOf } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — ประวัติ snapshot สำหรับกราฟ trend (admin=ทุกบริษัท, อื่น ๆ=บริษัทตัวเอง)
export async function GET(req){
  try {
    const u = await requireUser();
    const days = Number(new URL(req.url).searchParams.get("days")) || 90;
    const company = u.role === "admin" ? undefined : companyOf(u);
    const snapshots = await listSnapshots(days, company);
    return NextResponse.json({ snapshots });
  } catch(e){ return NextResponse.json({ error: e.message }, { status: e.status || 500 }); }
}

// POST — บันทึก snapshot ทันที (admin)
export async function POST(){
  try {
    await requireAdmin();
    const companies = await captureSnapshot(Date.now());
    return NextResponse.json({ ok: true, companies });
  } catch(e){ return NextResponse.json({ error: e.message }, { status: e.status || 500 }); }
}
