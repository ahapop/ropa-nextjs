// ลำดับชั้นการมองเห็นข้อมูล (pure — ใช้ฝั่ง server)
//  admin            : เห็นทุก record
//  ฝ่าย (division)   : ผู้ใช้ที่มี division แต่ไม่มี section → เห็น record ของทุกคนในฝ่ายเดียวกัน (รวมส่วนใต้ฝ่าย)
//  ส่วน / อื่น ๆ      : เห็นเฉพาะ record ของตัวเอง

export function isDivisionUser(user){ return !!(user && user.division && !user.section); }

export function scopeOf(user){
  if(user.role === "admin") return { all: true };
  if(isDivisionUser(user)) return { division: user.division };
  return { userId: user.id };
}

// viewer เข้าถึง record (ที่มี owner คนนี้ + owner อยู่ฝ่ายนี้) ได้ไหม
export function canAccess(viewer, ownerId, ownerDivision){
  if(viewer.role === "admin") return true;
  if(ownerId === viewer.id) return true;
  if(isDivisionUser(viewer) && ownerDivision && ownerDivision === viewer.division) return true;
  return false;
}
