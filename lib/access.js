// ลำดับชั้นการมองเห็นข้อมูล (pure — ใช้ฝั่ง server)
//  admin                         : เห็นทุก record (ทุกบริษัท)
//  ฝ่าย   (division, ไม่มี section): เห็น record ของทุกคนในฝ่ายเดียวกัน (รวมทุกส่วน/แผนกใต้ฝ่าย)
//  ส่วน   (division+section, ไม่มี department): เห็น record ของทุกคนในส่วนเดียวกัน (รวมทุกแผนกใต้ส่วน)
//  แผนก / อื่น ๆ                  : เห็นเฉพาะ record ของตัวเอง
// ทุกระดับ (ยกเว้น admin) ถูกจำกัดให้เห็นเฉพาะ "บริษัทของตัวเอง" โดยอิงจากโดเมนอีเมล

// โดเมนอีเมล → บริษัท
const DOMAIN_COMPANY = { "bts.co.th": "BTSC", "bid.com": "BID", "ebm.com": "EBM", "nbm.com": "NBM" };
export function companyOf(user){
  const dom = ((user && user.email) || "").split("@")[1]?.toLowerCase() || "";
  return DOMAIN_COMPANY[dom] || null;
}

export function scopeOf(user){
  if(user.role === "admin") return { all: true };
  const company = companyOf(user);
  if(user.division && user.section && !user.department) return { company, division: user.division, section: user.section };
  if(user.division && !user.section) return { company, division: user.division };
  return { company, userId: user.id };
}

// viewer เข้าถึง record ได้ไหม · owner = { id, company, division, section }
export function canAccess(viewer, owner){
  if(viewer.role === "admin") return true;
  if(companyOf(viewer) !== owner.company) return false; // จำกัดตามบริษัท
  if(owner.id === viewer.id) return true;
  if(viewer.division && !viewer.section && owner.division === viewer.division) return true;
  if(viewer.division && viewer.section && !viewer.department
     && owner.division === viewer.division && owner.section === viewer.section) return true;
  return false;
}
