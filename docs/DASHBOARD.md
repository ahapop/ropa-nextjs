# RoPA — Multi‑company + Dashboard ผู้ดูแล (สรุปการพัฒนา)

เอกสารสรุปสถาปัตยกรรมและฟีเจอร์ที่เพิ่มเข้ามา สำหรับทีมพัฒนา / ส่งต่อผู้ดูแลระบบ RoPA
แอป: `ropa-nextjs` · repo `ahapop/ropa-nextjs` · deploy: https://ropa-nextjs.vercel.app/ · DB: Neon Postgres

---

## 1. การแยกข้อมูลตามบริษัท (Company Isolation)

มี 4 บริษัท: **BTSC, BID, EBM, NBM** — บริษัทของผู้ใช้ระบุจาก **โดเมนอีเมล**

| โดเมน | บริษัท |
|---|---|
| `@bts.co.th` | BTSC |
| `@bid.com` | BID |
| `@ebm.com` | EBM |
| `@nbm.com` | NBM |

- **non‑admin เห็นเฉพาะบริษัทตัวเอง** + คงลำดับชั้นเดิม **ฝ่าย → ส่วน → แผนก** ภายในบริษัท
- **admin** (`Chaloemkwanl@bts.co.th`) เห็นทุกบริษัท
- ทุก record ถูกเป็นเจ้าของ (owner) โดย user ของบริษัทนั้น — ฝ่าย/ส่วน/แผนก จึงทำงานแยกตามบริษัท
- โครงสร้างหน่วยงาน: base (หน่วยงานกลาง ไม่มีสีสาย) มีครบทุกบริษัท · สายสีเหลือง→EBM · สายสีชมพู→NBM · ทั้งคู่→EBM+NBM

**โค้ดที่เกี่ยวข้อง:** `lib/access.js` (`companyOf`, `scopeOf`, `canAccess`), `lib/db.js` (`scopeWhere` เพิ่ม `company` predicate, `getRecord*` คืน company)

**ตัวอย่าง login (รหัสผ่าน `123`):**
`dpd@bts.co.th` (BTSC) · `dpd@bid.com` (BID) · `acd@ebm.com` (EBM) · `acrv1@nbm.com` (NBM, ระดับแผนก) · `Chaloemkwanl@bts.co.th` (admin เห็นทุกบริษัท)

---

## 2. Dashboard ผู้ดูแล RoPA (admin‑only)

โหลด full records (ตาม scope) แล้วคำนวณฝั่ง client ผ่าน `lib/analytics.js` — `analyze(records, {now, company, allRecords})`

| โซน | เนื้อหา | แหล่งข้อมูล (field จริง) |
|---|---|---|
| **A — Executive Scorecard** | %สมบูรณ์ · เสี่ยงร้ายแรง · ปิดงานแต่ยังไม่ compliant · งานค้าง>30วัน · รอตรวจ/ตีกลับ | `complete`, `status`, `updated_ts` |
| **B — คุณภาพข้อมูล** | Top missing fields · heatmap ฝ่าย×ขั้นตอน · ผู้บันทึกไม่ครบ | `emptyRequiredFids`, `isStepComplete`, `recorder_name` |
| **C — ความเสี่ยง & Compliance** | การ์ด C1–C5 · heatmap บริษัท×ความเสี่ยง · **Remediation Worklist** (+ Export) | s2/s3/s4/s5/s6/s1 |
| **D — Coverage** | การ์ดต่อบริษัท · org gap (🔴ไม่มี/🟡ร่าง/🟢สมบูรณ์) · activity grid | `org`, `company`, `activity` vs `MASTER` |
| **E — ติดตามงาน** | stale buckets · review queue · overdue/ใกล้ครบ · recent · ฝ่ายที่ต้องเร่ง | `updated_ts`, `status`, `dueDate` |
| **Alerts + Trend** | banner แจ้งเตือนเชิงรุก · กราฟแนวโน้ม %สมบูรณ์ (จาก snapshot) | รวมทุกเงื่อนไข + `ropa_snapshots` |

**ความเสี่ยง (PDPA):**
- **C1** ข้อมูลอ่อนไหวไม่มีฐานกฎหมาย (ม.26) · **C2** โอนต่างประเทศไม่มี safeguard (ม.28/29) · **C3** เปิดเผยภายนอกขาด DPA (critical) / ขาดสัญญา (warn) · **C4** จัดเก็บแต่ไม่มีกำหนดลบ/ระยะเวลา · **C5** บุคคลพิเศษแต่ Consent=N

**Pagination:** Worklist (25/หน้า), org gap (60), recent (12), org progress (12) — รีเซ็ตหน้าเมื่อเปลี่ยนบริษัท

---

## 3. รายงาน Daily / Weekly / Monthly (Excel)

`lib/report.js` → `buildReportWorkbook(records, 'daily'|'weekly'|'monthly', now)` ใช้ `xlsx.buildSheetsXlsx` (multi‑sheet)
ชีต: สรุปผู้บริหาร · รายบริษัท · แจ้งเตือน · Worklist ความเสี่ยง · หน่วยงานจุดบอด
ปุ่มดาวน์โหลดอยู่บนหัว Dashboard · Worklist มีปุ่ม Export แยก

---

## 4. ประวัติ / แนวโน้ม (Snapshots + Cron)

- ตาราง `ropa_snapshots` (1 แถว/บริษัท/วัน): total, complete, high_risk, cross_no_sg, sens_no_law, dpa_missing, stale30
- `lib/db.js`: `captureSnapshot(now)`, `listSnapshots(days, company)`
- API: `GET /api/snapshot` (trend, scoped) · `POST /api/snapshot` (admin บันทึกทันที) · `GET /api/cron/snapshot` (cron)
- `vercel.json`: cron `0 1 * * *` เรียก `/api/cron/snapshot` ทุกวัน
- คอลัมน์ `completed_at` (ตั้งครั้งแรกที่ record สมบูรณ์) และ `due_date` (มีคอลัมน์)

---

## 5. ข้อมูลตัวอย่างครบทุก Scenario

`scripts/seed-scenarios.mjs` — สร้างข้อมูลให้ทุก widget โชว์: completion ผสม, risk C1–C5, stale 3 ระดับ, rejected, coverage gap (เว้นบางหน่วยงานทุกบริษัทตาม hash ชื่อ org), activity gap, due date overdue/ใกล้ครบ, backfill snapshot 45 วัน

---

## 6. การรัน Scripts (สำคัญ)

`lib/*` ใช้ extensionless import (`./validate`) ซึ่ง **plain `node` รันไม่ได้** — ต้องใช้ ESM resolve hook:

```bash
# สร้าง hook ชั่วคราว 2 ไฟล์
#   scripts/_reg.mjs  -> import {register} from 'node:module'; register('./_hook.mjs', import.meta.url);
#   scripts/_hook.mjs -> export async function resolve(s,c,n){ if((s.startsWith('./')||s.startsWith('../'))&&!/\.[cm]?js$/i.test(s)){try{return await n(s+'.js',c)}catch{}} return n(s,c); }
node --import "file:///D:/Kwan/ropa-nextjs/scripts/_reg.mjs" scripts/seed-scenarios.mjs
```

สคริปต์หลัก: `reseed-4.mjs` (ข้อมูลสมบูรณ์ 100% ตามบริษัท) · `seed-scenarios.mjs` (ข้อมูลครบทุก scenario) · `init-db.mjs` (สร้าง schema + admin)

---

## 7. ยังไม่ได้ทำ (ต้องอินพุต/บริการเพิ่ม)

1. **ส่งรายงานอีเมล/LINE อัตโนมัติ** — ปัจจุบันเป็นดาวน์โหลด/บนจอ + cron เก็บ snapshot; การส่งจริงต้องมี SMTP หรือ LINE token
2. **UI ตั้ง `due_date`** — มีคอลัมน์ + alert พร้อม (อ่าน `rec.dueDate` ใน JSONB) แต่ยังไม่มีช่องกรอกใน Wizard
3. **ตั้ง env `CRON_SECRET` ใน Vercel** — เพื่อกัน cron endpoint (ถ้าไม่ตั้งก็ทำงานได้ แต่ endpoint เปิด — เขียนแค่ snapshot รวม ไม่รั่วข้อมูล)
4. **บังคับ company ตอนสร้าง record** — Wizard ยังเลือกบริษัทอิสระจาก dropdown (ควรล็อกเป็นบริษัทของ user)

---

## 8. แผนผังไฟล์ที่เพิ่ม/แก้

```
lib/access.js        company isolation (companyOf/scopeOf/canAccess)
lib/db.js            scopeWhere+company, completed_at/due_date, ropa_snapshots, captureSnapshot/listSnapshots
lib/analytics.js     แกนคำนวณ metric ทั้งหมด (analyze, riskFlags, companyAggregates, buildWorklist)
lib/report.js        รายงาน Excel daily/weekly/monthly
lib/xlsx.js          + buildSheetsXlsx (multi-sheet)
components/Dashboard.js   หน้า Dashboard ครบทุกโซน + pagination
app/api/snapshot/route.js, app/api/cron/snapshot/route.js   API trend/capture/cron
vercel.json          cron รายวัน
scripts/reseed-4.mjs, scripts/seed-scenarios.mjs   ข้อมูลตัวอย่าง
```
