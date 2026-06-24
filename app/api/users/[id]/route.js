import { NextResponse } from "next/server";
import { requireAdmin, hashPassword } from "@/lib/authz";
import { getUserById, updateUser, deleteUser, countUsers } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function err(e){ return NextResponse.json({ error: e.message }, { status: e.status || 500 }); }

export async function PUT(req, { params }){
  try {
    await requireAdmin();
    const { id } = await params;
    const cur = await getUserById(id);
    if(!cur) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
    const { name, title, division, section, role, password } = await req.json().catch(()=>({}));
    const passwordHash = password ? await hashPassword(password) : null;
    const user = await updateUser(id, {
      name: name ?? cur.name, title: title ?? cur.title,
      division: division ?? cur.division, section: section ?? cur.section,
      role: role === "admin" ? "admin" : "user", passwordHash,
    });
    return NextResponse.json({ user });
  } catch(e){ return err(e); }
}

export async function DELETE(req, { params }){
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    if(id === admin.id) return NextResponse.json({ error: "ลบบัญชีตัวเองไม่ได้" }, { status: 400 });
    if(await countUsers() <= 1) return NextResponse.json({ error: "ต้องมีผู้ใช้อย่างน้อย 1 บัญชี" }, { status: 400 });
    await deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch(e){ return err(e); }
}
