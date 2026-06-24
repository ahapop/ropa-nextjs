"use client";

async function jfetch(url, opts){
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  let data = {}; try { data = await res.json(); } catch {}
  if(!res.ok) throw new Error(data.error || ("เกิดข้อผิดพลาด (HTTP " + res.status + ")"));
  return data;
}

export const api = {
  // auth
  me: () => jfetch("/api/auth/me").then(d => d.user),
  login: (email, password) => jfetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }).then(d => d.user),
  logout: () => jfetch("/api/auth/logout", { method: "POST" }),
  // records
  listRecords: () => jfetch("/api/records").then(d => d.records),            // summaries (เบา)
  listRecordsFull: () => jfetch("/api/records?full=1").then(d => d.records),  // full (export/dashboard)
  getRecord: (id) => jfetch("/api/records/" + encodeURIComponent(id)).then(d => d.record),
  saveRecord: (rec) => jfetch("/api/records", { method: "POST", body: JSON.stringify(rec) }),
  deleteRecord: (id) => jfetch("/api/records/" + encodeURIComponent(id), { method: "DELETE" }),
  bulkRecords: (records) => jfetch("/api/records/bulk", { method: "POST", body: JSON.stringify({ records }) }).then(d => d.count),
  clearRecords: () => jfetch("/api/records/bulk", { method: "DELETE" }),
  // users (admin)
  listUsers: () => jfetch("/api/users").then(d => d.users),
  createUser: (u) => jfetch("/api/users", { method: "POST", body: JSON.stringify(u) }).then(d => d.user),
  updateUser: (id, u) => jfetch("/api/users/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(u) }).then(d => d.user),
  deleteUser: (id) => jfetch("/api/users/" + encodeURIComponent(id), { method: "DELETE" }),
};

export function initials(name){
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}
