# ระบบบันทึกกิจกรรมการประมวลผลข้อมูลส่วนบุคคล (RoPA)

Record of Processing Activities ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA) — แปลงจากไฟล์ `ropa_v32.html` (single-file app) มาเป็น **Next.js (App Router) + React**

## คุณสมบัติ
- ระบบ login เลือกบทบาท (ผู้ใช้ทั่วไป / ผู้ตรวจเอกสาร Admin) — ไม่มีรหัสผ่าน (สาธิต)
- Wizard กรอกข้อมูล 7 ขั้นตอน พร้อม validation และตัวบ่งชี้ความสมบูรณ์
- ตัวแก้ไขรายการย่อย (การใช้ภายใน 3.x / การเก็บรักษา 6.x) แบบทีละรายการ
- Dashboard สำหรับ Admin (KPI, กราฟ, รายการเฝ้าระวัง) ป้องกันด้วย PIN (client-side)
- Data Mapping Diagram (SVG) ส่งออกเป็น PNG / PDF / พิมพ์
- ส่งออก Excel (.xlsx) ตามรูปแบบ ROPA, ส่งออก/นำเข้า XML, ส่งออก JSON
- ข้อมูลทั้งหมดเก็บใน `localStorage` ของเบราว์เซอร์ (ฝั่ง client ล้วน — ไม่มี backend)

## โครงสร้าง
- `app/` — layout, หน้าหลัก (root App), globals.css
- `components/` — React components (Login, RecordList, Dashboard, Wizard, modals, fields)
- `lib/` — logic บริสุทธิ์ที่ port มาจากต้นฉบับแบบ verbatim
  - `master.js` ข้อมูลตัวเลือก (MASTER), `xlsx.js` สร้างไฟล์ Excel เอง, `xmlio.js` XML, `datamap.js` SVG/PDF, `validate.js` ความสมบูรณ์, `dummy.js` ข้อมูลตัวอย่าง

## รันในเครื่อง
```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm run start
```

## Deploy (Vercel)
เชื่อม repo นี้กับ Vercel — preset เป็น Next.js อัตโนมัติ ไม่ต้องตั้งค่าเพิ่ม
