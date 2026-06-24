import { NextResponse } from "next/server";
import { captureSnapshot } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel Cron เรียก GET ทุกวัน (ตั้งใน vercel.json) — ถ้าตั้ง CRON_SECRET จะตรวจ Bearer
export async function GET(req){
  try {
    const secret = process.env.CRON_SECRET;
    if(secret){
      const auth = req.headers.get("authorization") || "";
      if(auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const companies = await captureSnapshot(Date.now());
    return NextResponse.json({ ok: true, companies });
  } catch(e){ return NextResponse.json({ error: e.message }, { status: e.status || 500 }); }
}
