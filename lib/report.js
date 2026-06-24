/* รายงาน Daily / Weekly / Monthly (Excel หลายชีต) สำหรับผู้บริหารระดับสูง
   ประกอบจาก analyze() + buildWorklist() แล้วสร้างไฟล์ผ่าน buildSheetsXlsx() */
import { analyze, buildWorklist, companyAggregates, DAY } from "./analytics";
import { buildSheetsXlsx } from "./xlsx";

export const REPORT_PERIODS = {
  daily:   { key:"daily",   label:"รายวัน",     days:1 },
  weekly:  { key:"weekly",  label:"รายสัปดาห์", days:7 },
  monthly: { key:"monthly", label:"รายเดือน",   days:30 },
};

export function buildReportWorkbook(records, period, now){
  const p = REPORT_PERIODS[period] || REPORT_PERIODS.monthly;
  const a = analyze(records, { now });
  const agg = companyAggregates(records, now);
  const worklist = buildWorklist(records);
  const inRange = records.filter(r => now && r.updatedTs && (now - r.updatedTs) < p.days*DAY);

  const summary = [
    ["รายงาน RoPA — "+p.label, ""],
    ["สร้างเมื่อ", new Date(now).toLocaleString("th-TH")],
    ["", ""],
    ["ตัวชี้วัดรวม", "ค่า"],
    ["รายการทั้งหมด", a.total],
    ["สมบูรณ์", a.done],
    ["ร่าง/ไม่สมบูรณ์", a.draft],
    ["% สมบูรณ์", a.donePct+"%"],
    ["ความครบเฉลี่ยต่อรายการ", a.avgPct+"%"],
    ["ความเสี่ยงร้ายแรง (critical)", a.criticalCount],
    ["⚠ ปิดงานแล้วแต่ยังไม่ compliant", a.closedNotCompliant],
    ["งานค้าง > 30 วัน", a.staleBuckets.d30],
    ["ถูกตีกลับ (rejected)", a.rejected.length],
    ["รอตรวจ (done)", a.waiting.length],
    ["หน่วยงานยังไม่มี RoPA", a.orgGapCounts.none],
    ["กิจกรรมที่ครอบคลุม", a.activityCovered+" / "+a.activityTotal],
    ["เคลื่อนไหวในช่วง "+p.label, inRange.length],
  ];

  const byco = [["บริษัท","ทั้งหมด","สมบูรณ์","% สมบูรณ์","เสี่ยงร้ายแรง","โอนตปท.ไร้ safeguard","อ่อนไหวไร้ฐานกม.","ขาด DPA","ค้าง>30วัน"]];
  for(const c of agg) byco.push([c.company, c.total, c.complete, c.donePct+"%", c.highRisk, c.crossNoSafeguard, c.sensitiveNoLawful, c.dpaMissing, c.stale30]);

  const alerts = [["ระดับ","การแจ้งเตือน","จำนวน","คำแนะนำ"]];
  for(const al of a.alerts) alerts.push([al.level==="critical"?"🔴 ร้ายแรง":"🟠 เฝ้าระวัง", al.label, al.n, al.hint||""]);

  const wl = [["ระดับ","ความเสี่ยง","มาตรา","บริษัท","หน่วยงาน","กิจกรรม","ผู้บันทึก"]];
  for(const w of worklist) wl.push([w.level==="critical"?"ร้ายแรง":"เฝ้าระวัง", w.risk, w.matter, w.company, w.org, w.activity, w.recorder]);

  const gaps = [["หน่วยงานที่ยังไม่มี RoPA (จุดบอด)","ฝ่าย"]];
  for(const g of a.orgGap.filter(x=>x.state==="none")) gaps.push([g.org, g.division]);

  return buildSheetsXlsx([
    { name:"สรุปผู้บริหาร", rows: summary },
    { name:"รายบริษัท", rows: byco },
    { name:"แจ้งเตือน", rows: alerts },
    { name:"Worklist ความเสี่ยง", rows: wl },
    { name:"หน่วยงานจุดบอด", rows: gaps },
  ]);
}
