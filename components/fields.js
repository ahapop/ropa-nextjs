"use client";
import { isOtherOption } from "@/lib/util";

/* get/set: closures ที่อ่าน/เขียนค่าใน object เป้าหมายผ่าน dot-path
   errors: Set ของ fid ที่ต้อง mark invalid */

function fieldClass(fid, errors){ return "field" + (errors && errors.has(fid) ? " invalid" : ""); }

export function TextF({ fid, label, get, set, req, hint, area, ph, err, errors }){
  const val = get(fid) || "";
  return (
    <div className={fieldClass(fid, errors)}>
      <label>{label}{req && <span className="req">*</span>}{hint && <div className="hint">{hint}</div>}</label>
      {area
        ? <textarea value={val} placeholder={ph||''} onChange={e=>set(fid, e.target.value)} />
        : <input type="text" value={val} placeholder={ph||''} onChange={e=>set(fid, e.target.value)} />}
      <div className="errmsg">{err || 'จำเป็นต้องกรอกข้อมูลนี้'}</div>
    </div>
  );
}

function OtherBoxes({ fid, options, kind, get, set, errors }){
  const others = options.filter(isOtherOption);
  if(!others.length) return null;
  const val = get(fid);
  return others.map((o,i)=>{
    const ofid = fid + 'Other' + (others.length>1 ? i : '');
    const show = kind==='sel' ? (val===o) : (Array.isArray(val) && val.includes(o));
    if(!show) return null;
    return (
      <div className="otherbox" key={ofid}>
        <TextF fid={ofid} label={'โปรดระบุ — '+o} get={get} set={set} req ph="ระบุรายละเอียด" errors={errors} />
      </div>
    );
  });
}

export function SelectF({ fid, label, options, get, set, req, hint, errors }){
  const val = get(fid) || "";
  return (
    <div className={fieldClass(fid, errors)}>
      <label>{label}{req && <span className="req">*</span>}{hint && <div className="hint">{hint}</div>}</label>
      <select value={val} onChange={e=>set(fid, e.target.value)}>
        <option value="">— เลือก —</option>
        {options.map((o,i)=><option key={i} value={o}>{(i+1)+'. '+o}</option>)}
      </select>
      <OtherBoxes fid={fid} options={options} kind="sel" get={get} set={set} errors={errors} />
      <div className="errmsg">กรุณาเลือกข้อมูล</div>
    </div>
  );
}

export function RadioF({ fid, label, options, get, set, req, hint, errors }){
  const val = get(fid) || "";
  return (
    <div className={fieldClass(fid, errors)}>
      <label>{label}{req && <span className="req">*</span>}{hint && <div className="hint">{hint}</div>}</label>
      <div className="radioline">
        {options.map((o,i)=>(
          <label key={i}><input type="radio" name={fid} value={o} checked={o===val} onChange={()=>set(fid, o)} />{o}</label>
        ))}
      </div>
      <div className="errmsg">กรุณาเลือกข้อมูล</div>
    </div>
  );
}

export function ChecksF({ fid, label, options, get, set, req, hint, errors }){
  const vals = get(fid) || [];
  const toggle = (o) => {
    const cur = Array.isArray(get(fid)) ? get(fid).slice() : [];
    const i = cur.indexOf(o);
    if(i>=0) cur.splice(i,1); else cur.push(o);
    set(fid, cur);
  };
  return (
    <div className={fieldClass(fid, errors)}>
      <label>{label}{req && <span className="req">*</span>}<div className="hint">เลือกได้มากกว่า 1 หัวข้อ{hint ? ' · '+hint : ''}</div></label>
      <div className="checkset">
        {options.map((o,i)=>(
          <label className="checkitem" key={i}>
            <input type="checkbox" checked={vals.includes(o)} onChange={()=>toggle(o)} />
            <span className="opt-no">{(i+1)+'.'}</span> {o}
          </label>
        ))}
      </div>
      <OtherBoxes fid={fid} options={options} kind="chk" get={get} set={set} errors={errors} />
      <div className="errmsg">กรุณาเลือกอย่างน้อย 1 หัวข้อ</div>
    </div>
  );
}
