// ตัวเลือกช่วงเวลา (ใช้ร่วมกัน Dashboard + รายการหน้าหลัก) — กรองตาม updated_ts
export const RANGE_LABEL = { "30":"30 วันล่าสุด", "90":"90 วันล่าสุด", "180":"180 วันล่าสุด", year:"ปีนี้", all:"ทั้งหมด", custom:"กำหนดเอง" };

// แปลงตัวเลือก → { from, to } epoch (ms) · null = ทั้งหมด (ไม่กรอง) · "skip" = custom ที่ยังไม่เลือกวันที่ (อย่าเพิ่งยิง query)
export function rangeToEpoch(range, now){
  const DAY = 86400000;
  if(!range || range.preset === "all") return null;
  if(range.preset === "year"){ const y = new Date(now).getFullYear(); return { from: Date.parse(y + "-01-01T00:00:00"), to: null }; }
  if(range.preset === "custom"){
    const f = range.from ? Date.parse(range.from + "T00:00:00")     : null;
    const t = range.to   ? Date.parse(range.to   + "T23:59:59.999") : null;
    const from = (f != null && !isNaN(f)) ? f : null, to = (t != null && !isNaN(t)) ? t : null;
    if(from == null && to == null) return "skip";
    return { from, to };
  }
  return { from: now - Number(range.preset) * DAY, to: null };   // 30 / 90 / 180 วันล่าสุด
}

// บอกว่า updatedTs อยู่ในช่วงไหม (สำหรับกรองฝั่ง client)
export function inRange(updatedTs, rng){
  if(!rng || rng === "skip") return true;
  const t = updatedTs || 0;
  return (rng.from == null || t >= rng.from) && (rng.to == null || t <= rng.to);
}
