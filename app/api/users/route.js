import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireAdmin, hashPassword } from "@/lib/authz";
import { listUsers, getUserByEmail, createUser } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function err(e){ return NextResponse.json({ error: e.message }, { status: e.status || 500 }); }

export async function GET(){
  try {
    await requireAdmin();
    return NextResponse.json({ users: await listUsers() });
  } catch(e){ return err(e); }
}

export async function POST(req){
  try {
    await requireAdmin();
    const { email, name, title, division, section, role, password } = await req.json().catch(()=>({}));
    if(!email || !password) return NextResponse.json({ error: "ต้องระบุอีเมลและรหัสผ่าน" }, { status: 400 });
    if(await getUserByEmail(email)) return NextResponse.json({ error: "อีเมลนี้มีผู้ใช้แล้ว" }, { status: 409 });
    const passwordHash = await hashPassword(password);
    const user = await createUser({
      id: crypto.randomUUID(), email, name, title, division, section,
      role: role === "admin" ? "admin" : "user", passwordHash,
    });
    return NextResponse.json({ user });
  } catch(e){ return err(e); }
}
