import { NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { initSchema, getUserByEmail, createUser, countUsers } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ชั่วคราว: สร้างตาราง + seed admin (idempotent — ปลอดภัยถ้าเรียกซ้ำ)
export async function GET(){
  try {
    await initSchema();
    const email = "Chaloemkwanl@bts.co.th";
    let seeded = false;
    if(!(await getUserByEmail(email))){
      const passwordHash = await bcrypt.hash("123", 10);
      await createUser({
        id: crypto.randomUUID(), email,
        name: "Chaloemkwan loetpawnsutthi", title: "Data protection analyst supervisor",
        division: "", section: "", role: "admin", passwordHash,
      });
      seeded = true;
    }
    return NextResponse.json({ ok: true, schema: "ready", adminSeeded: seeded, userCount: await countUsers() });
  } catch(e){
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
