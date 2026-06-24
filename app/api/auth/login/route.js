import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req){
  try {
    const { email, password } = await req.json().catch(()=>({}));
    if(!email || !password) return NextResponse.json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" }, { status: 400 });
    const u = await getUserByEmail(email);
    if(!u || !(await verifyPassword(password, u.password_hash)))
      return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    await setSessionCookie(u);
    return NextResponse.json({ user: { id:u.id, email:u.email, name:u.name, title:u.title, division:u.division, section:u.section, role:u.role } });
  } catch(e){
    return NextResponse.json({ error: "เข้าสู่ระบบไม่สำเร็จ" }, { status: 500 });
  }
}
