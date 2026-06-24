# ข้อกำหนดความต้องการของระบบ (Software Requirements Specification)

ระบบบันทึกกิจกรรมการประมวลผลข้อมูลส่วนบุคคล (RoPA — Record of Processing Activities) ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)

เอกสารฉบับนี้จัดทำเพื่อส่งมอบให้ทีมพัฒนา (Programmer) นำไปพัฒนาระบบขึ้นใหม่ได้ครบถ้วนโดยไม่ต้องคาดเดา ทุกหัวข้ออ้างอิงพฤติกรรมจริงของระบบต้นแบบ

---

## 1. บทนำ

### 1.1 วัตถุประสงค์ของเอกสาร
ระบุความต้องการเชิงฟังก์ชันและไม่ใช่ฟังก์ชันทั้งหมดของระบบ RoPA เพื่อให้ทีมพัฒนาสร้างระบบที่ทำงานเทียบเท่าต้นแบบได้ ครอบคลุมโครงสร้างข้อมูล การยืนยันตัวตน สิทธิ์การเข้าถึง แบบฟอร์ม 7 ขั้นตอน การนำเข้า/ส่งออก แดชบอร์ดผู้ดูแล และรายงานผู้บริหาร

### 1.2 ขอบเขตของระบบ
ระบบเว็บแอปพลิเคชันสำหรับองค์กรที่มีหลายบริษัทในเครือ (BTSC, BID, EBM, NBM) ให้เจ้าหน้าที่แต่ละหน่วยงานบันทึกกิจกรรมการประมวลผลข้อมูลส่วนบุคคล (RoPA) ตามมาตรา 39 แห่ง PDPA โดยแยกการมองเห็นข้อมูลตามบริษัท มีผู้ดูแล (DPO/Admin) ตรวจสอบ ติดตามความครบถ้วนและความเสี่ยง และออกรายงานให้ผู้บริหาร

### 1.3 คำศัพท์และนิยาม
| คำ | ความหมาย |
|---|---|
| RoPA | บันทึกรายการกิจกรรมการประมวลผลข้อมูลส่วนบุคคล (1 รายการ = 1 กิจกรรม) |
| PDPA | พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 |
| Data Controller / Processor | ผู้ควบคุม / ผู้ประมวลผลข้อมูลส่วนบุคคล |
| DPA | Data Processing Agreement สัญญาประมวลผลข้อมูลกับผู้ประมวลผล |
| Sensitive data | ข้อมูลอ่อนไหวตามมาตรา 26 (เชื้อชาติ ศาสนา สุขภาพ ฯลฯ) |
| Lawful basis | ฐานทางกฎหมายในการประมวลผล (ม.24/ม.26) |
| Cross-border transfer | การโอนข้อมูลไปต่างประเทศ (ม.28/29) |
| Company | บริษัทในเครือ 4 บริษัท: BTSC, BID, EBM, NBM |
| ฝ่าย/ส่วน/แผนก | ลำดับชั้นหน่วยงาน (division / section / department) |
| Recorder | ผู้บันทึกรายการ (ชื่อ ตำแหน่ง หน่วยงาน) |

### 1.4 ผู้ใช้และบทบาท (Roles)
| บทบาท | ค่า role | สิทธิ์ |
|---|---|---|
| ผู้ใช้ทั่วไป (เจ้าหน้าที่หน่วยงาน) | `user` | สร้าง/แก้ไข RoPA ของขอบเขตตัวเอง เห็นเฉพาะบริษัทตัวเอง ตามลำดับชั้น ฝ่าย/ส่วน/แผนก |
| ผู้ตรวจเอกสาร / ผู้ดูแล (DPO/Admin) | `admin` | เห็นทุกบริษัท ตรวจ/ตีกลับเอกสาร เข้า Dashboard จัดการผู้ใช้ ออกรายงาน |

---

## 2. สถาปัตยกรรมและเทคโนโลยี

### 2.1 Technology Stack
- **Frontend/Backend:** Next.js (App Router) + React (client components), deploy บน Vercel
- **ฐานข้อมูล:** PostgreSQL (Neon serverless) เข้าถึงผ่าน `@neondatabase/serverless`
- **การยืนยันตัวตน:** HMAC-signed session cookie (ไม่ใช้ library ภายนอก) + `bcryptjs` แฮชรหัสผ่าน
- **การสร้างไฟล์:** Excel (.xlsx) และ PDF เขียน OOXML/PDF เองแบบ offline ไม่พึ่ง library ภายนอก
- **ภาษา UI:** ภาษาไทยทั้งหมด

### 2.2 โครงสร้างโปรเจกต์ (หลัก)
| ส่วน | ไฟล์ |
|---|---|
| หน้า/ออร์เคสเตรชัน | `app/page.js` |
| API routes | `app/api/auth/*`, `app/api/records/*`, `app/api/users/*`, `app/api/snapshot`, `app/api/cron/snapshot` |
| Data + business logic | `lib/db.js` (DB), `lib/access.js` (สิทธิ์), `lib/authz.js` (session), `lib/master.js` (master data), `lib/validate.js` + `lib/stepvalid.js` (ความครบถ้วน), `lib/analytics.js` (เมตริก), `lib/report.js` + `lib/xlsx.js` (รายงาน), `lib/xmlio.js` (XML), `lib/datamap.js` (แผนผัง), `lib/dummy.js` (ข้อมูลตัวอย่าง), `lib/util.js` |
| UI components | `components/Login.js`, `RecordList.js`, `Wizard.js`, `fields.js`, `EditorModals.js`, `RecorderModal.js`, `Dashboard.js`, `UserManagement.js`, `MiscModals.js`, `DataMapModal.js`, `ui.js`, `toast.js` |

### 2.3 Environment Variables
| ตัวแปร | ใช้ทำ |
|---|---|
| `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` | connection string ของ Postgres (รองรับ prefix อื่นของ Vercel ด้วย) |
| `AUTH_SECRET` | กุญแจเซ็น session cookie (ค่า default ไม่ปลอดภัย ต้องตั้งใน production) |
| `CRON_SECRET` | (ทางเลือก) ป้องกัน endpoint cron — ถ้าตั้งไว้ cron ต้องส่ง `Authorization: Bearer <CRON_SECRET>` |

---

## 3. โมเดลข้อมูล (Data Model)

### 3.1 ตาราง `users`
| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | TEXT PK | UUID |
| `email` | TEXT UNIQUE NOT NULL | ใช้ล็อกอิน · โดเมนกำหนดบริษัท |
| `name` | TEXT | ชื่อ-นามสกุล |
| `title` | TEXT | ตำแหน่ง |
| `division` | TEXT | ฝ่าย |
| `section` | TEXT | ส่วน |
| `department` | TEXT | แผนก |
| `role` | TEXT default `user` | `user` หรือ `admin` |
| `password_hash` | TEXT NOT NULL | bcrypt |
| `created_at` | TIMESTAMPTZ default now() | |

### 3.2 ตาราง `records`
มีทั้งคอลัมน์ denormalized (อ่านเร็วสำหรับ list/dashboard) และ JSONB เก็บรายละเอียดเต็ม

| คอลัมน์ | ชนิด | ที่มา |
|---|---|---|
| `id` | TEXT PK | |
| `user_id` | TEXT FK → users(id) ON DELETE CASCADE | เจ้าของ (owner) |
| `company` | TEXT | บริษัทของ record |
| `org` | TEXT | = `data.s1.org` |
| `status` | TEXT default `draft` | `draft` / `done` / `rejected` |
| `complete` | BOOLEAN default false | = `recordComplete(data)` |
| `activity` | TEXT | = `data.s1.activity` |
| `activity_other` | TEXT | = `data.s1.activityOther` |
| `recorder_name` | TEXT | ชื่อผู้บันทึก (ประกอบจาก recorder) |
| `updated_ts` | BIGINT | epoch ms ของการแก้ไขล่าสุด (มี index) |
| `updated_at` | TEXT | สตริงวันเวลาแบบไทย (แสดงผล) |
| `department` | TEXT | = `data.department` |
| `completed_at` | TIMESTAMPTZ | ตั้งครั้งแรกที่ record สมบูรณ์ (ไม่ล้างทีหลัง) |
| `due_date` | DATE | กำหนดส่ง (ทางเลือก) |
| `data` | JSONB NOT NULL | record object เต็ม (s1–s7 + recorder + dueDate) |
| `created_at` | TIMESTAMPTZ default now() | |

Index: `records_user_idx(user_id)`, `records_uts_idx(updated_ts DESC)`

### 3.3 ตาราง `ropa_snapshots` (ประวัติรายวันสำหรับกราฟ trend)
| คอลัมน์ | ชนิด |
|---|---|
| `id` | BIGSERIAL PK |
| `day` | DATE default current_date |
| `company` | TEXT |
| `total, complete, high_risk, cross_no_sg, sens_no_law, dpa_missing, stale30` | INT |
| `captured_at` | TIMESTAMPTZ default now() |
| | UNIQUE(day, company) — 1 แถวต่อบริษัทต่อวัน |

### 3.4 โครงสร้าง record object (JSONB `data`)
record เริ่มต้น (blankRecord): `{ id, company:"", status:'draft', recorder:{...}, s1:{}, s2:{}, s3:{share:"",items:[]}, s4:{disclose:"",items:[]}, s5:{transfer:""}, s6:{store:"",items:[]}, s7:{} }`

| ส่วน | ฟิลด์ |
|---|---|
| ระดับบน | `id, company, status, updatedAt, updatedTs, department, dueDate, reviewComment, reviewedAt` |
| `recorder` | `firstName, lastName, position, phone, division, section` |
| `s1` (ทั่วไป) | `org, activity, activityOther, responsible, recordFormat[], recordFormatDetail, dataSubject[], special, consent, frequency` |
| `s2` (เก็บรวบรวม) | `general[], sensitive[], source[], purpose, lawful[], lawfulSens[]` |
| `s3` (ใช้ภายใน) | `share`, `items[]` แต่ละ item: `{org, purpose, general[], sensitive[], lawful[], lawfulSens[]}` |
| `s4` (เปิดเผย) | `disclose`, `items[]` แต่ละ item: `{recipient, recipientDetail, recipientFile, status, purpose, contract, method[], dpa}` |
| `s5` (โอนตปท.) | `transfer, country, company, method, purpose, safeguard[]` |
| `s6` (เก็บรักษา) | `store`, `items[]` แต่ละ item: `{type, trigger, period, reason, legalKeep, physical[], technical[], storeLoc, deleteMethod}` |
| `s7` (เข้าถึง) | `who, condition[], method[], methodDetail` |
| หมายเหตุรายขั้น | `s1.remark` … `s7.remark` |

### 3.5 Master Data
เก็บใน `lib/master.js` แก้ไขที่เดียว ใช้เป็น dropdown/checkbox ทั่วระบบ รายการหลัก:
- `companies`: BTSC, EBM, NBM, BID
- `orgStructure`: รายชื่อ ผู้อำนวยการ/ฝ่าย/ส่วน/แผนก ทั้งหมด (มีรหัสในวงเล็บ เช่น "ฝ่ายบัญชี (ACD)")
- `activities` (20 กิจกรรม), `recordFormats`, `dataSubjects`, `generalData`, `sensitiveData`, `dataSources`, `lawfulBasis`, `lawfulBasisSensitive`, `externalRecipients`, `recipientStatus`, `disclosureMethods`, `retentionType`, `retentionTrigger`, `deleteMethods`, `physicalMeasures`, `technicalMeasures`, `accessConditions`, `accessMethods`, `transferSafeguard`
- ตัวช่วยที่คำนวณจาก orgStructure: `DIVISIONS` (ขึ้นต้น "ฝ่าย"), `SECTIONS` (ขึ้นต้น "ส่วน"), `DIVISION_SECTIONS` (แผนผังฝ่าย→[ส่วน]), `sectionsFor(division)`, `companiesForOrg(orgName)`

`companiesForOrg(name)`: แม็ปหน่วยงานเข้าบริษัทตามสีสายในชื่อ — มี "สายสีเหลือง" → EBM · "สายสีชมพู" → NBM · ทั้งสอง → [EBM,NBM] · ไม่มีสี → BTSC

---

## 4. การยืนยันตัวตนและการให้สิทธิ์ (Authentication & Authorization)

### 4.1 Session
- Cookie ชื่อ `ropa_session` แบบ httpOnly, sameSite=lax, secure ใน production, อายุ 7 วัน
- โครงสร้าง token: `base64url(payload).hmacSHA256` โดย payload = `{uid, role, exp}` เซ็นด้วย `AUTH_SECRET`
- ตรวจสอบด้วย timing-safe compare และตรวจวันหมดอายุ
- `requireUser()` → ถ้าไม่มี session คืน 401 · `requireAdmin()` → 401 ถ้าไม่ล็อกอิน, 403 ถ้า role ≠ admin

### 4.2 บริษัทจากโดเมนอีเมล (Company Isolation)
| โดเมน | บริษัท |
|---|---|
| `@bts.co.th` | BTSC |
| `@bid.com` | BID |
| `@ebm.com` | EBM |
| `@nbm.com` | NBM |

`companyOf(user)` อ่านโดเมนจาก `user.email` แล้วแม็ปเป็นบริษัท (โดเมนไม่รู้จัก → null = ไม่เห็นอะไร)

### 4.3 ลำดับชั้นการมองเห็น (scopeOf)
| เงื่อนไขผู้ใช้ | ขอบเขตที่เห็น |
|---|---|
| role = admin | ทุก record ทุกบริษัท (`{all:true}`) |
| มี division + section (ไม่มี department) | record ของทุกคนใน **ส่วน** เดียวกัน ภายในบริษัทตัวเอง |
| มี division (ไม่มี section) | record ของทุกคนใน **ฝ่าย** เดียวกัน ภายในบริษัทตัวเอง |
| อื่น ๆ (เช่น มี department) | เฉพาะ record ของตัวเอง ภายในบริษัทตัวเอง |

การ query: `scopeWhere(scope)` ประกอบ WHERE = `company = ?` (ยกเว้น admin) AND เงื่อนไขลำดับชั้น (`user_id IN (SELECT id FROM users WHERE division=? [AND section=?])` หรือ `user_id = ?`)

### 4.4 การเข้าถึงราย record (canAccess)
`canAccess(viewer, owner)` — owner = `{id, company, division, section}` ของ record:
1. admin → ผ่านเสมอ
2. ถ้า `companyOf(viewer) ≠ owner.company` → ปฏิเสธ (จำกัดบริษัท)
3. เจ้าของเอง (`owner.id === viewer.id`) → ผ่าน
4. viewer ระดับฝ่าย และ `owner.division === viewer.division` → ผ่าน
5. viewer ระดับส่วน และ division+section ตรงกัน → ผ่าน
6. นอกนั้นปฏิเสธ

> ข้อกำหนดสำคัญ: ทุก record ต้องถูกเป็นเจ้าของโดย user ที่อยู่ในบริษัทเดียวกับ `records.company` (เพื่อให้ลำดับชั้นทำงานถูกต้องภายในบริษัท)

---

## 5. ความต้องการเชิงฟังก์ชัน (Functional Requirements)

### 5.1 หน้ารายการ RoPA (RecordList)
รับเฉพาะข้อมูลย่อ (summary) จาก `GET /api/records`

**คอลัมน์ (8):** `#` · กิจกรรมการประมวลผล (sort: activity) · ฝ่าย/ส่วน (org) · บริษัท (company) · ผู้บันทึก (recorder) · ปรับปรุงล่าสุด (updated) · สถานะ (status) · จัดการ
- กิจกรรม: แสดง activityOther เมื่อ activity = "อื่นๆ"
- สถานะ: badge 3 แบบ — `ตีกลับ` (status=rejected, แดง) / `สมบูรณ์` (complete=true) / `ร่าง` (อื่น ๆ)

**ค้นหา:** ช่องเดียว ค้นแบบ substring ไม่สนตัวพิมพ์ จาก activity + activityOther + org + company + department + ชื่อผู้บันทึก placeholder `ค้นหา: กิจกรรม / ฝ่าย / ผู้บันทึก ...`

**เรียงลำดับ:** คลิกหัวคอลัมน์ที่ sort ได้ — คลิกแรก = น้อยไปมาก, คลิกซ้ำ = สลับทิศ; ตัวเลขเทียบเชิงเลข, ข้อความใช้ localeCompare ภาษาไทย; status เรียงตามลำดับ draft(0) < rejected(1) < done(2); แสดงลูกศร ▲/▼

**จัดกลุ่ม (ปุ่ม 📑 จัดกลุ่ม):** ซ้อน 4 ระดับ บริษัท → ฝ่าย → ส่วน → แผนก → รายการ
- การหาฝ่าย/ส่วนจาก org: ถ้า org ขึ้นต้น "ส่วน" → ฝ่าย = SEC2DIV[org]; ถ้าขึ้นต้น "ฝ่าย" → ส่วน = "— (ระดับฝ่าย)"
- บริษัทเรียง: master companies ก่อน แล้วอื่น ๆ แล้วว่าง
- เปิดโหมดจัดกลุ่ม = **ยุบทุกกลุ่ม** เริ่มต้น; แสดงทุกแถว (ไม่แบ่งหน้า) แต่ละแถวกลุ่มแสดงจำนวนนับ

**ปรับความกว้างคอลัมน์:** ลากที่ขอบหัวคอลัมน์ (min 50px) สลับ layout auto↔fixed; ปุ่ม `↔ รีเซ็ตคอลัมน์` คืนค่าอัตโนมัติ (โผล่เฉพาะ fixed)

**แบ่งหน้า (ไม่จัดกลุ่ม):** 50 รายการ/หน้า เมื่อ > 50 แถว ปุ่ม « แรก · ‹ ก่อนหน้า · ถัดไป › · สุด » แสดง `ทั้งหมด N รายการ · หน้า p / total`

**แถบเครื่องมือ (ปุ่ม):** จัดกลุ่ม · (รีเซ็ตคอลัมน์) · 💾 Save XML · 📂 โหลด XML · ⬇ JSON · 📊 Dashboard (disabled ถ้าไม่ใช่ admin) · 👥 จัดการผู้ใช้ (เฉพาะ admin) · ⬇ Export Excel · 🧪 20/ฝ่าย-ส่วน (สร้างตัวอย่าง) · 🗑 ล้างทั้งหมด · ＋ เพิ่มรายการใหม่

**Action ต่อแถว:** ✎ แก้ไข · 🗺️ Data Map · ⧉ ทำสำเนา (สร้าง id ใหม่ status=draft) · 🗑 ลบ (ยืนยันก่อน)

### 5.2 ผู้บันทึก (RecorderModal)
เปิดก่อนสร้างรายการใหม่ ฟิลด์: `ชื่อ*`, `นามสกุล*`, `ตำแหน่ง`, `เบอร์`, `ฝ่าย` (จาก DIVISIONS), `ส่วน` (จาก sectionsFor(ฝ่าย) หรือทั้งหมด) — บังคับเฉพาะชื่อและนามสกุล; เลือกฝ่ายแล้วกรองส่วน, ถ้าฝ่ายไม่มีส่วนย่อย select ส่วนจะ disabled

### 5.3 แบบฟอร์ม 7 ขั้น (Wizard)
**เลย์เอาต์:** ซ้าย = การ์ดผู้บันทึก + รายการ 7 ขั้น (มีเครื่องหมาย ✓ เมื่อขั้นนั้นครบ) + แถบความคืบหน้า `กรอกครบ X%` (X = จำนวนขั้นที่ครบ/7) ; ขวา = หัวขั้น + เนื้อหา + แถบล่าง (Back / Reject(admin) / Data Map / 💾 บันทึกร่าง / Next หรือ ✓ บันทึกรายการ)
- คลิกขั้นใดก็ได้เพื่อข้าม (ไม่ตรวจ) ; ปุ่ม Next ตรวจความครบของขั้นปัจจุบัน (visible-required + EXTRA_RULES) ก่อนไป ; แต่ละขั้นมีช่อง `หมายเหตุ (สำหรับการส่งกลับเพื่อแก้ไขข้อมูล)` (ไม่บังคับ)
- ฟิลด์ทุกตัวที่มีตัวเลือก "อื่นๆ/โปรดระบุ" เมื่อเลือกจะโผล่ช่องข้อความ **บังคับ** เพิ่ม (fid + "Other")

**ขั้นที่ 1 — รายละเอียดทั่วไป (s1):**
| ลำดับ | ป้าย | fid | ชนิด | ตัวเลือก | บังคับ |
|---|---|---|---|---|---|
| — | บริษัทต้นสังกัด (Company) | company | select | companies | ใช่ |
| 1.1 | ผู้อำนวยการ/ฝ่าย/ส่วน | s1.org | select | orgStructure | ใช่ |
| 1.2 | กิจกรรมการประมวลผล | s1.activity | select | activities + "อื่นๆ" | ใช่ (เลือกอื่นๆ → activityOther บังคับ) |
| 1.4 | ผู้รับผิดชอบ | s1.responsible | text | — | ใช่ |
| 1.5 | รูปแบบการบันทึก | s1.recordFormat | checkbox | recordFormats | ใช่ (≥1) |
| — | รายละเอียดรูปแบบการบันทึก | s1.recordFormatDetail | textarea | — | ไม่ |
| 1.6 | ประเภทเจ้าของข้อมูล | s1.dataSubject | checkbox | dataSubjects | ใช่ (≥1) |
| 1.7 | บุคคลพิเศษ | s1.special | radio | ไม่มี/ผู้เยาว์/ผู้เสมือนไร้ฯ/ผู้ไร้ฯ | ใช่ |
| — | Consent | s1.consent | radio | Y/N | ใช่เมื่อ special ≠ ไม่มี |
| 1.8 | ความถี่ | s1.frequency | radio | รายวัน/รายเดือน/รายปี/ตามเหตุการณ์ | ใช่ |

**ขั้นที่ 2 — การเก็บรวบรวม (s2):**
| ลำดับ | ป้าย | fid | ชนิด | ตัวเลือก | บังคับ |
|---|---|---|---|---|---|
| 2.1 | ข้อมูลทั่วไป | s2.general | checkbox | generalData | ≥1 ของ 2.1/2.2 |
| 2.2 | ข้อมูลอ่อนไหว | s2.sensitive | checkbox | sensitiveData | ≥1 ของ 2.1/2.2 |
| 2.3 | แหล่งที่มา | s2.source | checkbox | dataSources | ใช่ (≥1) |
| 2.4 | วัตถุประสงค์การเก็บ | s2.purpose | textarea | — | ใช่ |
| 2.5 | ฐานกฎหมาย ม.39(6) | s2.lawful | checkbox | lawfulBasis | ไม่ |
| 2.6 | ฐานกฎหมายข้อมูลอ่อนไหว | s2.lawfulSens | checkbox | lawfulBasisSensitive | ไม่ |

**ขั้นที่ 3 — การใช้ภายใน (s3):** radio `s3.share` = มีการแบ่งปัน/ไม่มีการแบ่งปัน (บังคับ) ; ถ้า "มีการแบ่งปัน" → เพิ่มรายการ item (ดู 5.4) ปุ่ม `➕ เพิ่มฝ่ายงานที่แบ่งปัน`

**ขั้นที่ 4 — การเปิดเผย (s4):** radio `s4.disclose` = มีการเปิดเผย/ไม่มีการเปิดเผย (บังคับ) ; ถ้า "มีการเปิดเผย" → เพิ่ม item ผู้รับ (ดู 5.4)

**ขั้นที่ 5 — โอนต่างประเทศ (s5):**
| ลำดับ | ป้าย | fid | ชนิด | บังคับ |
|---|---|---|---|---|
| 5 | มี/ไม่มีการส่งออกนอกประเทศ | s5.transfer | radio | ใช่ |
| 5.1 | ประเทศปลายทาง | s5.country | text | ใช่ (เมื่อมีการโอน) |
| 5.2 | ข้อมูลบริษัทปลายทาง | s5.company | textarea | ใช่ (เมื่อมีการโอน) |
| 5.3 | วิธีการโอน | s5.method | textarea | ใช่ (เมื่อมีการโอน) |
| 5.4 | วัตถุประสงค์การโอน | s5.purpose | textarea | ใช่ (เมื่อมีการโอน) |
| 5.5 | ฐาน/มาตรการคุ้มครอง (ม.28/29) | s5.safeguard | checkbox (transferSafeguard) | ใช่ ≥1 (เมื่อมีการโอน) |

**ขั้นที่ 6 — การเก็บรักษา (s6):** radio `s6.store` = มีการจัดเก็บ/ไม่มีการจัดเก็บ (บังคับ) ; ถ้า "มีการจัดเก็บ" → เพิ่ม item (ดู 5.4)

**ขั้นที่ 7 — สิทธิและการเข้าถึง (s7):** บังคับเฉพาะเมื่อ s6.store = มีการจัดเก็บ
| ลำดับ | ป้าย | fid | ชนิด | ตัวเลือก |
|---|---|---|---|---|
| 7.1 | ผู้มีสิทธิเข้าถึง | s7.who | textarea | — |
| 7.2 | เงื่อนไขการเข้าถึง | s7.condition | checkbox | accessConditions |
| 7.3 | วิธีการเข้าถึง | s7.method | checkbox | accessMethods |
| — | รายละเอียดเพิ่มเติม | s7.methodDetail | textarea | — |

### 5.4 ตัวแก้ไขรายการย่อย (Item editors — s3/s4/s6)
รายการย่อยเป็น modal แยก เพิ่ม/แก้ไข/ลบได้ มีกฎ **ห้ามซ้ำ (dedupe)** และตรวจความครบก่อนบันทึก เพดานจำนวน item = ความยาวของ master list ที่เกี่ยวข้อง

**s3 item:** `3.1 ฝ่ายงาน*` (orgStructure) · `3.2 วัตถุประสงค์*` · `3.3 ข้อมูลทั่วไป` · `3.4 ข้อมูลอ่อนไหว` · `3.5 ฐานกฎหมาย*` (≥1) · `3.6 ฐานกฎหมายอ่อนไหว` (บังคับเมื่อเลือก 3.4) — ต้องเลือก 3.3 หรือ 3.4 อย่างน้อย 1 · org ห้ามซ้ำ
**s4 item:** `4.1 ผู้รับ*` (externalRecipients) · `4.2 รายละเอียด*` · แนบไฟล์ ≤1MB (base64) · `4.3 สถานะ` (ไม่บังคับ) · `4.4 วัตถุประสงค์*` · `4.5 มีสัญญา* (Yes/No)` · `4.6 วิธีส่ง*` (≥1) · `4.7 มี DPA* (Yes/No)` — recipient ห้ามซ้ำ
**s6 item:** `6.1 ประเภท*` (retentionType) · `6.2 trigger*` · `6.3 ระยะเวลา*` · `6.4 เหตุผล` · `6.5 ตามกฎหมาย` · `6.6 มาตรการกายภาพ*` (≥1) · `6.7 มาตรการเทคนิค*` (≥1) · `6.8 แหล่งจัดเก็บ*` · `6.9 วิธีลบ/ทำลาย*` — type ห้ามซ้ำ

### 5.5 กฎความครบถ้วน (Completeness) และ workflow สถานะ
**isStepComplete ต่อขั้น:**
- s1: company, org, activity (อื่นๆ→activityOther), responsible, recordFormat≥1, dataSubject≥1, special, frequency (consent ไม่นับในความครบ)
- s2: source≥1 และ purpose และ (general≥1 หรือ sensitive≥1)
- s3: share ถูกตั้ง; ถ้าไม่มีการแบ่งปัน=ครบ; ถ้ามี ต้อง ≥1 item ทุก item ผ่าน s3ItemOk และ org ไม่ซ้ำ
- s4: disclose ถูกตั้ง; ถ้าไม่มี=ครบ; ถ้ามี ≥1 item ทุก item ผ่าน s4ItemOk และ recipient ไม่ซ้ำ
- s5: transfer ถูกตั้ง; ถ้าไม่มี=ครบ; ถ้ามี country, company, method, purpose และ safeguard≥1
- s6: store ถูกตั้ง; ถ้าไม่มี=ครบ; ถ้ามี ≥1 item ทุก item ครบ (type, trigger, period, physical≥1, technical≥1, storeLoc, deleteMethod) และ type ไม่ซ้ำ
- s7: ถ้า s6≠จัดเก็บ=ครบ; ไม่งั้น who, condition≥1, method≥1
- `recordComplete` = ครบทั้ง 7 ขั้น

**EXTRA_RULES (ตรวจตอนกด Next):** s2 ต้องเลือก 2.1 หรือ 2.2 ≥1 (ม.39(1)); s3/s4/s6 ตรวจ "ต้องมี item อย่างน้อย 1" และ "ห้ามซ้ำ"

**Workflow สถานะ:**
| การกระทำ | status | ฟิลด์เพิ่ม | เงื่อนไข | บันทึกผ่าน |
|---|---|---|---|---|
| บันทึกร่าง | draft | updatedAt | ไม่มีเงื่อนไข | onUpsert |
| บันทึกสมบูรณ์ (finish) | done | updatedAt | ต้องครบทั้ง 7 ขั้น มิฉะนั้นเด้งไปขั้นแรกที่ไม่ครบ | onFinish |
| ตีกลับ (admin) | rejected | reviewComment, reviewedAt | comment ห้ามว่าง | onUpsert |

เมื่อ record status=rejected และมี reviewComment → แสดงแบนเนอร์แดง "เอกสารถูกตีกลับจากผู้ตรวจ" พร้อมหมายเหตุในหน้าฟอร์ม

### 5.6 นำเข้า/ส่งออก XML
- ส่งออก: `buildXML(records)` → `<RoPARecords count exportedAt><Record>...</Record></RoPARecords>` สะท้อนโครงสร้าง object เต็ม (array ใช้ `type="array"` + `<item>`)
- นำเข้า: `parseXML(text)` ผ่าน DOMParser คืน array ของ record; ผู้ใช้เลือก "รวม (merge ตาม id)" หรือ "แทนที่ทั้งหมด"; record ที่นำเข้าถูก re-own เป็นของผู้นำเข้า

### 5.7 ส่งออก JSON
ดึง full records แล้วดาวน์โหลด `ropa-records.json` (pretty-printed)

### 5.8 ส่งออก Excel (รูปแบบ ROPA)
Modal เลือกบริษัท + ฝ่าย/ส่วน (กรองจาก records จริง) แสดงจำนวนที่จะส่งออก; `buildRopaXlsx(filtered)` สร้างไฟล์ .xlsx (เขียน OOXML/ZIP เอง) ชีต `ROPA#Department` หัวตาราง 2 ชั้น (7 กลุ่ม merge + ~46 คอลัมน์ย่อย) 1 record = 1 แถว ค่าหลายค่าต่อด้วยขึ้นบรรทัด; ตั้งชื่อไฟล์ `ROPA_{บริษัท|ALL}_{ฝ่าย|ALL}.xlsx`

### 5.9 Data Map (แผนผังการไหลข้อมูล)
`buildMapSVG(record)` สร้าง SVG ไดอะแกรมซ้าย→ขวา: แหล่งที่มา (s2.source) → ศูนย์กลาง Entities (s1.org) → รูปแบบบันทึก (s1.recordFormat) → การเก็บรักษา (s6.items) และแขนง Usage (s3) / Disclosure (s4) / Transfer (s5); เตือนช่องที่ขาด (ฝ่าย/กิจกรรม/แหล่งที่มา/รูปแบบ); ปุ่ม ⬇ PNG (2×), ⬇ PDF (สร้าง PDF เอง), 🖨 พิมพ์ (A4 แนวนอน)

### 5.10 จัดการผู้ใช้ (admin)
ตาราง user ทั้งหมด + เพิ่ม/แก้ไข/ลบ ฟิลด์: email(สร้างครั้งเดียว), role(user/admin), ชื่อ, ตำแหน่ง, ฝ่าย, ส่วน, แผนก, รหัสผ่าน; แก้ไขเว้นรหัสผ่านว่าง = ไม่เปลี่ยน; ลบตัวเองไม่ได้ และต้องเหลือ user ≥1

### 5.11 ข้อมูลตัวอย่าง (Seed)
`makeDummyByOrg`, `makeDummyByDept` สร้าง record ที่กรอกครบทุก block; ปุ่ม 🧪 20/ฝ่าย-ส่วน สร้าง ~20 รายการต่อหน่วยงาน เป็นของบัญชีผู้กด; scripts `reseed-4.mjs` (ครบทุกบริษัท), `seed-scenarios.mjs` (ครบทุก scenario)

---

## 6. Dashboard ผู้ดูแล & Analytics

### 6.1 ภาพรวม
หน้า admin-only โหลด full records ตาม scope แล้วคำนวณฝั่ง client ผ่าน `analyze(records, {now, company, allRecords})`; กรองบริษัทได้; มีปุ่มรายงาน daily/weekly/monthly + Snapshot

### 6.2 เงื่อนไขความเสี่ยง (riskFlags) — สูตรจริง
| รหัส | ชื่อ | เงื่อนไข | ระดับ | มาตรา |
|---|---|---|---|---|
| C1 | อ่อนไหวไม่มีฐานกฎหมาย | s2.sensitive≥1 และ s2.lawfulSens=ว่าง (หรือใน s3.items มีอ่อนไหวแต่ไม่มี lawfulSens) | critical | ม.26 |
| C2 | โอนตปท.ไม่มี safeguard | s5.transfer=มีการส่งออก และ s5.safeguard=ว่าง | critical | ม.28/29 |
| C3-DPA | เปิดเผยขาด DPA | s4.disclose=มีการเปิดเผย และมี item ที่ dpa≠Yes | critical | DPA |
| C3-con | เปิดเผยขาดสัญญา | มี item ที่ contract≠Yes | warn | — |
| C4 | ไม่มีกำหนดลบ/ระยะเวลา | s6.store=มีการจัดเก็บ และ item ขาด period/trigger/deleteMethod (หรือไม่มี item) | warn | ม.37(3) |
| C5 | บุคคลพิเศษ Consent=N | s1.special≠ไม่มี และ s1.consent=N | warn | ม.20 |

"ปิดงานแต่ยังไม่ compliant" = มี critical และ (status=done หรือ recordComplete)

### 6.3 โซน A–E (widget)
- **A Scorecard:** %สมบูรณ์รวม (เกณฑ์สี <50 แดง, <70 เหลือง) · เสี่ยงร้ายแรง · ปิดงานแต่ยังไม่ compliant · งานค้าง>30วัน · รอตรวจ(done)/ตีกลับ(rejected)
- **B คุณภาพ:** Top 10 ช่องที่ว่างบ่อย (จาก emptyRequiredFids) · heatmap ฝ่าย×ขั้นตอน (นับจำนวนที่ยังไม่ครบ) · ผู้บันทึกไม่ครบ
- **C ความเสี่ยง:** การ์ด C1–C5 · heatmap บริษัท×ความเสี่ยง · Remediation Worklist (กดเปิดแก้ + Export) แบ่งหน้า 25/หน้า
- **D Coverage:** การ์ดต่อบริษัท (หน่วยงานที่มี RoPA / ทั้งหมด) · org gap chips (🔴ไม่มี/🟡ร่าง/🟢สมบูรณ์) แบ่งหน้า 60/หน้า · activity grid (มี/ไม่มี เทียบ 20 กิจกรรม)
- **E ติดตามงาน:** stale 7-14/15-30/>30 วัน · rejected · overdue/ใกล้ครบ (จาก rec.dueDate, เฉพาะที่ยังไม่สมบูรณ์) · เคลื่อนไหววันนี้/7วัน · recent timeline · ฝ่ายที่ต้องเร่ง (แบ่งหน้า 12/หน้า)
- **Alerts banner:** รวมและจัดลำดับเงื่อนไขข้างต้น (critical ก่อน warn) พร้อมจำนวนและคำแนะนำ
- **Trend:** กราฟแท่ง %สมบูรณ์รายวันจาก ropa_snapshots

### 6.4 Coverage logic
ตัวหาร (หน่วยงานที่ "ควรมี RoPA") ต่อบริษัทใช้ `orgCompanies(org)` = base org → ครบ 4 บริษัท (รวม BID) · org มีสีสาย → บริษัทของสายนั้น (สำคัญ: `companiesForOrg` เดิมไม่แม็ป BID จึงต้อง expand)

---

## 7. รายงาน Daily / Weekly / Monthly
`buildReportWorkbook(records, period, now)` สร้าง .xlsx หลายชีต: สรุปผู้บริหาร · รายบริษัท · แจ้งเตือน · Worklist ความเสี่ยง · หน่วยงานจุดบอด; period กำหนดช่วง "เคลื่อนไหวในช่วง" (1/7/30 วัน) ใช้ `buildSheetsXlsx` (multi-sheet builder)

---

## 8. Snapshots & Cron
- `captureSnapshot(now)`: อ่าน records ทั้งหมด → `companyAggregates` → upsert 1 แถว/บริษัท/วัน (ON CONFLICT day,company)
- `listSnapshots(days, company)`: คืนข้อมูลกราฟ trend (admin=ทุกบริษัท, อื่น=บริษัทตัวเอง)
- Vercel Cron (`vercel.json`): `0 1 * * *` เรียก `GET /api/cron/snapshot` ทุกวัน (ตรวจ Bearer ถ้ามี CRON_SECRET)
- `completed_at` ถูกตั้งครั้งแรกที่ record สมบูรณ์ (สำหรับ trend งานเสร็จในอนาคต)

---

## 9. API Specification

| Method | Path | สิทธิ์ | คำอธิบาย |
|---|---|---|---|
| GET | /api/auth/me | — | คืน user ปัจจุบันหรือ null |
| POST | /api/auth/login | — | ตรวจ email+password ตั้ง cookie (400 ขาดข้อมูล, 401 ผิด) |
| POST | /api/auth/logout | — | ล้าง cookie |
| GET | /api/records | user | list summary ตาม scope |
| GET | /api/records?full=1 | user | list full ตาม scope |
| POST | /api/records | user + canAccess | upsert 1 record (400 ไม่มี id, 403 ไม่มีสิทธิ์) |
| GET | /api/records/[id] | user + canAccess | full 1 record (404/403) |
| DELETE | /api/records/[id] | user + canAccess | ลบ 1 record (404/403) |
| POST | /api/records/bulk | user | bulk upsert (re-own เป็นผู้เรียก) |
| DELETE | /api/records/bulk | user | ล้างตาม scope |
| GET | /api/snapshot?days=N | user | trend (admin=ทุกบริษัท) |
| POST | /api/snapshot | admin | capture ทันที |
| GET | /api/users | admin | list users |
| POST | /api/users | admin | สร้าง user (400 ขาด email/password, 409 ซ้ำ) |
| PUT | /api/users/[id] | admin | แก้ไข user (404) |
| DELETE | /api/users/[id] | admin | ลบ user (400 ลบตัวเอง/เหลือคนสุดท้าย) |
| GET | /api/cron/snapshot | bearer (ถ้าตั้ง) | capture รายวัน |

ทุก route: `runtime=nodejs`, `dynamic=force-dynamic`; error = `{error: message}` พร้อม status

---

## 10. ความต้องการที่ไม่ใช่ฟังก์ชัน (Non-functional)
- **ภาษา:** UI ภาษาไทยทั้งหมด รองรับการเรียงลำดับภาษาไทย (localeCompare 'th')
- **ประสิทธิภาพ:** list/dashboard ใช้คอลัมน์ denormalized + index `updated_ts`; รายการมาก (พัน++) ต้องลื่น; dashboard heatmap คำนวณฝั่ง client จาก full records
- **ความปลอดภัย:** รหัสผ่าน bcrypt; session เซ็น HMAC; สิทธิ์บังคับฝั่ง server ทุก endpoint; แยกข้อมูลตามบริษัทเด็ดขาด
- **ความเข้ากันได้:** เบราว์เซอร์สมัยใหม่; ส่งออกไฟล์ทำงาน offline ในเบราว์เซอร์ (ไม่พึ่ง server)
- **การพกพา:** Excel/PDF/XML สร้างเองในฝั่ง client

---

## 11. กฎทางธุรกิจและกรณีขอบ (Edge cases)
- record "สมบูรณ์" (recordComplete) ไม่นับ consent → record อาจสมบูรณ์แต่ยังขาด consent (ปรากฏใน Top missing fields)
- C2/C4 ทำให้ขั้นนั้นไม่สมบูรณ์ (เพราะ safeguard/period เป็นช่องบังคับของความครบ) จึงเป็น draft; C1/C3-DPA/C5 ยังสมบูรณ์ได้ → ใช้นับ "ปิดงานแต่ยังไม่ compliant"
- bulk import re-own เป็นผู้เรียกเสมอ (admin นำเข้า XML ของบริษัทอื่นจะกลายเป็นเจ้าของ)
- coverage gap ต้องใช้ orgCompanies (รวม BID) ไม่ใช่ companiesForOrg
- ทุก record ต้อง owner อยู่บริษัทเดียวกับ records.company

---

## 12. เกณฑ์การยอมรับ (Acceptance Criteria)
1. ผู้ใช้แต่ละบริษัทล็อกอินแล้วเห็นเฉพาะ record บริษัทตัวเอง ตามลำดับชั้น ฝ่าย/ส่วน/แผนก; admin เห็นทุกบริษัท
2. สร้าง RoPA ครบ 7 ขั้น กดบันทึกสมบูรณ์ได้เมื่อครบทุกขั้นเท่านั้น; บันทึกร่างได้ทุกเมื่อ
3. กฎความครบและ EXTRA_RULES ทำงานตรงตามข้อ 5.5; รายการย่อย s3/s4/s6 ห้ามซ้ำ
4. admin ตีกลับพร้อมหมายเหตุ → เจ้าของเห็นแบนเนอร์ตีกลับ
5. ส่งออก/นำเข้า XML, ส่งออก JSON, ส่งออก Excel (รูปแบบ ROPA), Data Map PNG/PDF/พิมพ์ ทำงานครบ
6. Dashboard แสดงครบทุกโซน A–E + alerts + trend + รายงาน; ความเสี่ยง C1–C5 ตรงสูตร; coverage ครอบคลุม BID
7. Snapshot รายวันทำงาน (cron) และกราฟ trend มีข้อมูล

---

## 13. งานที่ยังไม่ทำ / ข้อเสนอแนะอนาคต
- ส่งรายงานอีเมล/LINE อัตโนมัติ (ต้อง SMTP/LINE token)
- UI ตั้ง due_date ในฟอร์ม (ปัจจุบันมีคอลัมน์ + alert แต่ยังไม่มีช่องกรอก)
- ล็อก company ตอนสร้าง record ให้ตรงบริษัทผู้ใช้ (ปัจจุบันเลือกอิสระ)
- ตั้ง env CRON_SECRET ใน production
