"use client";
import { RANGE_LABEL } from "@/lib/daterange";

// ตัวเลือกช่วงเวลา (dropdown + วันที่กำหนดเอง) — ใช้ร่วมกัน Dashboard + รายการหน้าหลัก
export default function RangeFilter({ range, setRange }){
  return (
    <>
      <label className="muted">ช่วงเวลา:</label>
      <select value={range.preset} onChange={e=>setRange(s=>({ ...s, preset:e.target.value }))} title="กรองตามวันที่ปรับปรุงล่าสุด">
        {Object.entries(RANGE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
      </select>
      {range.preset==="custom" && (<>
        <input type="date" value={range.from} max={range.to||undefined} onChange={e=>setRange(s=>({ ...s, from:e.target.value }))} />
        <span className="muted">–</span>
        <input type="date" value={range.to} min={range.from||undefined} onChange={e=>setRange(s=>({ ...s, to:e.target.value }))} />
      </>)}
    </>
  );
}
