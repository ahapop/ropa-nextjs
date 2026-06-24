"use client";
import { useState } from "react";
import { useToast } from "./toast";

export default function Login({ onChoose }){
  const toast = useToast();
  const email = "Chaloemkwanl@bts.co.th";
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const signIn = () => {
    const pw = password.trim();
    if(!pw){ toast("กรุณากรอกรหัสผ่าน","err"); return; }
    if(pw === "123"){ onChoose("user"); return; }
    if(pw === "999"){ onChoose("admin"); return; }
    toast("รหัสผ่านไม่ถูกต้อง","err");
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <img src="/btsc-logo.png" alt="BTSC" />
        </div>

        <div className="login-field">
          <label>Email</label>
          <div className="login-input">
            <input type="email" value={email} readOnly
                   onKeyDown={e=>{ if(e.key==='Enter') signIn(); }} />
          </div>
        </div>

        <div className="login-field">
          <label>Password</label>
          <div className="login-input">
            <input type={showPass ? "text" : "password"} value={password} placeholder="••••••••"
                   onChange={e=>setPassword(e.target.value)}
                   onKeyDown={e=>{ if(e.key==='Enter') signIn(); }} />
            <button type="button" className="eye" title={showPass ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    onClick={()=>setShowPass(s=>!s)}>{showPass ? "🙈" : "👁"}</button>
          </div>
        </div>

        <button className="login-btn" onClick={signIn}>Sign In</button>

        <div className="login-foot">
          Don&apos;t have an account?{" "}
          <a onClick={()=>toast("ระบบสาธิต — ใช้บัญชีที่มีอยู่เพื่อเข้าใช้งาน","")}>Sign up</a>
        </div>
      </div>
    </div>
  );
}
