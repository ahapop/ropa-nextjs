"use client";

export default function Login({ onChoose }){
  return (
    <div className="container">
      <div style={{ maxWidth:560, margin:"8vh auto 0", background:"var(--card)", borderRadius:"var(--radius)", boxShadow:"var(--shadow)", overflow:"hidden" }}>
        <div style={{ padding:"22px 26px", borderBottom:"1px solid var(--line)" }}>
          <h2 style={{ margin:0, fontSize:18, color:"var(--primary-dark)" }}>เข้าสู่ระบบ</h2>
          <p style={{ margin:"6px 0 0", fontSize:13, color:"var(--muted)" }}>เลือกบทบาทการใช้งาน (ตัวอย่างสาธิต — ไม่มีรหัสผ่าน)</p>
        </div>
        <div style={{ padding:"24px 26px", display:"flex", flexDirection:"column", gap:14 }}>
          <button className="btn btn-primary" style={{ padding:16, fontSize:15, justifyContent:"flex-start" }} onClick={()=>onChoose('user')}>
            👤 เข้าใช้งานเป็น “ผู้ใช้ทั่วไป” <span style={{ fontWeight:400, opacity:.85, marginLeft:6 }}>— บันทึก/แก้ไขรายการ RoPA</span>
          </button>
          <button className="btn btn-accent" style={{ padding:16, fontSize:15, justifyContent:"flex-start" }} onClick={()=>onChoose('admin')}>
            🛡️ เข้าใช้งานเป็น “ผู้ตรวจเอกสาร (Admin)” <span style={{ fontWeight:400, opacity:.85, marginLeft:6 }}>— ตรวจและตีกลับเอกสาร</span>
          </button>
        </div>
      </div>
    </div>
  );
}
