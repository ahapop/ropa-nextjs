import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { seedAllCompanies } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// สร้างข้อมูลจำลองครบทุกบริษัท (เฉพาะ admin)
export async function POST(){
  try {
    const u = await requireUser();
    if(u.role !== "admin") return NextResponse.json({ error: "เฉพาะผู้ดูแล (admin)" }, { status: 403 });
    const count = await seedAllCompanies(3);   // ~3,500 รายการ/ครั้ง (เร็วพอไม่ติด timeout) · กดซ้ำเพื่อเพิ่ม
    return NextResponse.json({ ok: true, count });
  } catch(e){ return NextResponse.json({ error: e.message }, { status: e.status || 500 }); }
}
