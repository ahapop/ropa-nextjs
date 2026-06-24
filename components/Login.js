"use client";
import { useState } from "react";
import { useToast } from "./toast";

export default function Login({ onChoose }){
  const toast = useToast();
  const [email, setEmail] = useState("Chaloemkwanl@bts.co.th");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [role, setRole] = useState("user");

  const signIn = () => {
    if(!email.trim() || !password.trim()){ toast("กรุณากรอกอีเมลและรหัสผ่าน","err"); return; }
    onChoose(role);
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <img src="/btsc-logo.png" alt="BTSC" />
          <div className="sys">BTSC</div>
          <div className="sub">RoPA · ระบบบันทึกกิจกรรมการประมวลผลข้อมูลส่วนบุคคล</div>
        </div>

        <div className="login-field">
          <label>Email</label>
          <div className="login-input">
            <input type="email" value={email} placeholder="you@bts.co.th"
                   onChange={e=>setEmail(e.target.value)}
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

        <div className="login-roles">
          <div className="rl-lbl">เข้าใช้งานเป็น</div>
          <div className="rl-seg">
            <div className={"rl-opt"+(role==="user"?" active":"")} onClick={()=>setRole("user")}>👤 ผู้ใช้ทั่วไป</div>
            <div className={"rl-opt"+(role==="admin"?" active":"")} onClick={()=>setRole("admin")}>🛡️ ผู้ตรวจเอกสาร (Admin)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
