// ลำดับชั้นการมองเห็นข้อมูล (pure — ใช้ฝั่ง server)
//  admin                         : เห็นทุก record
//  ฝ่าย   (division, ไม่มี section): เห็น record ของทุกคนในฝ่ายเดียวกัน (รวมทุกส่วน/แผนกใต้ฝ่าย)
//  ส่วน   (division+section, ไม่มี department): เห็น record ของทุกคนในส่วนเดียวกัน (รวมทุกแผนกใต้ส่วน)
//  แผนก / อื่น ๆ                  : เห็นเฉพาะ record ของตัวเอง

export function scopeOf(user){
  if(user.role === "admin") return { all: true };
  if(user.division && user.section && !user.department) return { division: user.division, section: user.section };
  if(user.division && !user.section) return { division: user.division };
  return { userId: user.id };
}

// viewer เข้าถึง record (ที่มี owner คนนี้) ได้ไหม · owner = { id, division, section }
export function canAccess(viewer, owner){
  if(viewer.role === "admin") return true;
  if(owner.id === viewer.id) return true;
  if(viewer.division && !viewer.section && owner.division === viewer.division) return true;
  if(viewer.division && viewer.section && !viewer.department
     && owner.division === viewer.division && owner.section === viewer.section) return true;
  return false;
}
