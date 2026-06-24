"use client";
import { useState } from "react";
import { useToast } from "./toast";

export default function Login({ onLogin }){
  const toast = useToast();
  const [email, setEmail] = useState("Chaloemkwanl@bts.co.th");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    if(!email.trim() || !password.trim()){ toast("กรุณากรอกอีเมลและรหัสผ่าน","err"); return; }
    setBusy(true);
    const err = await onLogin(email.trim(), password);
    setBusy(false);
    if(err) toast(err, "err");
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <img src="/btsc-logo-transparent.png" alt="BTSC" />
        </div>
        <div className="login-sys">ระบบบันทึกกิจกรรมการประมวลผลข้อมูลส่วนบุคคล (RoPA)</div>

        <div className="login-field">
          <label>Email</label>
          <div className="login-input">
            <input type="email" value={email} placeholder="you@bts.co.th" autoComplete="username"
                   onChange={e=>setEmail(e.target.value)}
                   onKeyDown={e=>{ if(e.key==='Enter') signIn(); }} />
          </div>
        </div>

        <div className="login-field">
          <label>Password</label>
          <div className="login-input">
            <input type={showPass ? "text" : "password"} value={password} placeholder="••••••••" autoComplete="current-password"
                   onChange={e=>setPassword(e.target.value)}
                   onKeyDown={e=>{ if(e.key==='Enter') signIn(); }} />
            <button type="button" className="eye" title={showPass ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    onClick={()=>setShowPass(s=>!s)}>{showPass ? "🙈" : "👁"}</button>
          </div>
        </div>

        <button className="login-btn" onClick={signIn} disabled={busy}>{busy ? "กำลังเข้าสู่ระบบ…" : "Sign In"}</button>

        <div className="login-foot">
          Don&apos;t have an account?{" "}
          <a onClick={()=>toast("ติดต่อผู้ดูแลระบบ (Admin) เพื่อสร้างบัญชีผู้ใช้","")}>Sign up</a>
        </div>
      </div>
    </div>
  );
}
