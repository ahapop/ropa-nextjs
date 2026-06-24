"use client";
/* Modal: overlay + กล่องการ์ดสีขาว (เลียนแบบ inline-style ของต้นฉบับ) */
export function Modal({ z=80, maxWidth=680, children, onBackdrop, flex }){
  return (
    <div className="overlay" style={{ background:"rgba(20,30,50,.45)", zIndex:z }}
         onMouseDown={e=>{ if(e.target===e.currentTarget && onBackdrop) onBackdrop(); }}>
      <div style={{ background:"#fff", borderRadius:12, maxWidth, width:"100%", maxHeight:"92vh",
                    display: flex?"flex":"block", flexDirection:"column",
                    overflow: flex?"hidden":"auto", boxShadow:"0 12px 40px rgba(0,0,0,.3)" }}>
        {children}
      </div>
    </div>
  );
}
export function ModalHead({ title, sub, color }){
  return (
    <div style={{ padding:"16px 22px", borderBottom:"1px solid var(--line)" }}>
      <h2 style={{ margin:0, fontSize:16, color: color || "var(--primary-dark)" }}>{title}</h2>
      {sub && <p style={{ margin:"4px 0 0", fontSize:12, color:"var(--muted)" }}>{sub}</p>}
    </div>
  );
}
export function ModalFoot({ children }){
  return (
    <div style={{ padding:"14px 22px", borderTop:"1px solid var(--line)", display:"flex",
                  justifyContent:"flex-end", gap:10, background:"#fbfcfe" }}>
      {children}
    </div>
  );
}
