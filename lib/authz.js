import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { getUserById, pubUser } from "./db";

export const SESSION_COOKIE = "ropa_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret(){ return process.env.AUTH_SECRET || "dev-insecure-secret-change-me"; }
const b64u = (buf) => Buffer.from(buf).toString("base64url");

/* ---- password ---- */
export async function hashPassword(pw){ return bcrypt.hash(pw, 10); }
export async function verifyPassword(pw, hash){ try { return await bcrypt.compare(pw, hash); } catch { return false; } }

/* ---- signed session token: payload.signature ---- */
export function signSession(payload){
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now()/1000) + MAX_AGE }));
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return body + "." + sig;
}
export function verifySession(token){
  if(!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expect = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if(sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  let p; try { p = JSON.parse(Buffer.from(body, "base64url").toString()); } catch { return null; }
  if(!p || typeof p.exp !== "number" || p.exp < Math.floor(Date.now()/1000)) return null;
  return p; // { uid, role, exp }
}

/* ---- cookie helpers (route handlers) ---- */
export async function setSessionCookie(user){
  const token = signSession({ uid: user.id, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: MAX_AGE,
  });
}
export async function clearSessionCookie(){
  (await cookies()).set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

// คืน user ปัจจุบัน (public shape) หรือ null
export async function currentUser(){
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const p = verifySession(token);
  if(!p) return null;
  const u = await getUserById(p.uid);
  return u ? pubUser(u) : null;
}
export async function requireUser(){ const u = await currentUser(); if(!u) { const e = new Error("unauthorized"); e.status = 401; throw e; } return u; }
export async function requireAdmin(){ const u = await requireUser(); if(u.role !== "admin"){ const e = new Error("forbidden"); e.status = 403; throw e; } return u; }
