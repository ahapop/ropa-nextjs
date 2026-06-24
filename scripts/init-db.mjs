// Run with: node scripts/init-db.mjs   (loads .env.local)
import { readFileSync } from "fs";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { initSchema, getUserByEmail, createUser, countUsers } from "../lib/db.js";

// load .env.local
try {
  for(const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")){
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if(m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {}

await initSchema();
console.log("schema ready");

const email = "Chaloemkwanl@bts.co.th";
const existing = await getUserByEmail(email);
if(existing){
  console.log("admin already exists:", existing.email, "(role:", existing.role + ")");
} else {
  const passwordHash = await bcrypt.hash("123", 10);
  await createUser({
    id: crypto.randomUUID(), email,
    name: "Chaloemkwan Kulapong", title: "Data protection analyst supervisor",
    division: "", section: "", role: "admin", passwordHash,
  });
  console.log("seeded admin:", email);
}
console.log("total users:", await countUsers());
