/* DUMMY DATA — สร้างข้อมูลตัวอย่างที่กรอกครบทุก Block — ported จาก ropa_v32.html
   คืนค่าเป็น array ของ record ใหม่ (เรียงให้รายการแรกใหม่สุด เหมือน unshift เดิม) */
import { MASTER, DIVISIONS, sectionsFor } from "./master";
import { uid, nowStr, isOtherOption } from "./util";

export function makeDummyRecords(n){
  n=n||100;
  const rnd=Math.random;
  const pick=a=>a[Math.floor(rnd()*a.length)];
  const pickN=(a,min,max)=>{ const c=a.slice(),out=[],k=Math.min(c.length,min+Math.floor(rnd()*(max-min+1)));
    for(let i=0;i<k&&c.length;i++) out.push(c.splice(Math.floor(rnd()*c.length),1)[0]); return out; };
  const noOther=a=>a.filter(x=>!isOtherOption(x));
  const firsts=['สมชาย','สมหญิง','วิชัย','นภาพร','ธนกร','ปรียา','อนุชา','กมลรัตน์','ศิริพร','ณัฐพล','พิมพ์ใจ','เอกชัย','จิราพร','ภานุวัฒน์'];
  const lasts=['ใจดี','รักงาน','ศรีสุข','มั่นคง','วงศ์ทอง','พูนผล','แสงทอง','บุญมี','สุขสันต์','ทองดี','เจริญสุข','พัฒนาการ'];
  const positions=['เจ้าหน้าที่','หัวหน้าส่วน','ผู้จัดการฝ่าย','เจ้าหน้าที่อาวุโส','ผู้ช่วยผู้จัดการ'];
  const countries=['สิงคโปร์','ญี่ปุ่น','สหรัฐอเมริกา','เยอรมนี','ฮ่องกง','อินเดีย','ออสเตรเลีย'];
  const cloudCos=['AWS (Singapore Region)','Microsoft Azure (Hong Kong)','Google Cloud (Tokyo)','Oracle Cloud (Frankfurt)','Salesforce Inc. (USA)'];
  const periods=['1 ปี','2 ปี','3 ปี','5 ปี','7 ปี','10 ปี'];
  const storeLocs=['Server ภายในองค์กร (On-premise)','Cloud ผู้ให้บริการ (XXX)','BTSNAS / Shared Drive','ตู้เอกสารสำนักงานใหญ่'];
  const ts=nowStr();
  const nm=()=>'นาย/นาง '+pick(firsts)+' '+pick(lasts);
  const out=[];
  for(let i=0;i<n;i++){
    const company=pick(MASTER.companies), fn=pick(firsts), ln=pick(lasts);
    const activity=pick(MASTER.activities);
    const transfer=rnd()<0.45, sens=rnd()<0.4;
    const division=pick(DIVISIONS), _secs=sectionsFor(division), section=_secs.length?pick(_secs):'';
    out.unshift({
      id:uid(), status:'done', createdAt:ts, updatedAt:ts, updatedTs:Date.now()-i*60000, company,
      recorder:{firstName:fn, lastName:ln, position:pick(positions), phone:'08'+Math.floor(10000000+rnd()*89999999), division, section},
      s1:{org:pick(MASTER.orgStructure), activity,
          responsible:nm(), recordFormat:pickN(MASTER.recordFormats,1,3), dataSubject:pickN(MASTER.dataSubjects,1,3),
          special:pick(['ไม่มี','ไม่มี','ไม่มี','ผู้เยาว์']), frequency:pick(['รายวัน','รายเดือน','รายปี','เกิดขึ้นตามเหตุการณ์'])},
      s2:{general:pickN(MASTER.generalData,2,5), sensitive:sens?pickN(MASTER.sensitiveData,1,2):[],
          source:pickN(MASTER.dataSources,1,3), purpose:'จัดเก็บข้อมูลเพื่อใช้ในกระบวนการ'+activity,
          lawful:pickN(MASTER.lawfulBasis,1,2), lawfulSens:sens?pickN(MASTER.lawfulBasisSensitive,1,1):[]},
      s3:{share:'มีการแบ่งปัน', items:pickN(MASTER.orgStructure,1,3).map(o=>({org:o, purpose:'ใช้ข้อมูลร่วมกันระหว่างหน่วยงานภายในเพื่อ'+activity, general:pickN(MASTER.generalData,1,3), sensitive:[], lawful:pickN(MASTER.lawfulBasis,1,1), lawfulSens:[]}))},
      s4:{disclose:'มีการเปิดเผย', items:pickN(MASTER.externalRecipients,1,3).map(rcp=>({
            recipient:rcp, recipientDetail:'บริษัทผู้ให้บริการภายนอกตามสัญญาจ้าง / หน่วยงานที่เกี่ยวข้อง', recipientFile:null,
            status:pick(MASTER.recipientStatus), purpose:'เปิดเผยเพื่อดำเนินการตามสัญญาและข้อกำหนดทางกฎหมาย',
            contract:pick(['Yes','No']), method:pickN(MASTER.disclosureMethods,1,2), dpa:pick(['Yes','No'])}))},
      s5: transfer
        ? {transfer:'มีการส่งออกนอกประเทศ', country:pick(countries), company:pick(cloudCos), method:'ส่งผ่านระบบ Cloud ที่มีการเข้ารหัส (TLS/Encryption)',
           purpose:'ใช้บริการประมวลผล/จัดเก็บข้อมูลบนคลาวด์ของผู้ให้บริการต่างประเทศ', safeguard:pickN(MASTER.transferSafeguard,1,2)}
        : {transfer:'ไม่มีการส่งออกนอกประเทศ'},
      s6:{store:'มีการจัดเก็บ', items:pickN(MASTER.retentionType,1,3).map(t=>({
            type:t, trigger:pick(MASTER.retentionTrigger), period:pick(periods),
            reason:'เพื่อการอ้างอิงในอนาคตและปฏิบัติตามระยะเวลาที่กฎหมายกำหนด', legalKeep:'',
            physical:pickN(noOther(MASTER.physicalMeasures),1,2), technical:pickN(noOther(MASTER.technicalMeasures),2,3),
            storeLoc:pick(storeLocs), deleteMethod:pick(noOther(MASTER.deleteMethods))}))},
      s7:{who:'เจ้าหน้าที่ที่ได้รับมอบหมายของ'+pick(MASTER.orgStructure), condition:pickN(noOther(MASTER.accessConditions),1,2),
          method:pickN(noOther(MASTER.accessMethods),1,2), methodDetail:''}
    });
  }
  return out;
}
