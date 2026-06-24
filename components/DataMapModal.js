"use client";
import { useMemo } from "react";
import { useToast } from "./toast";
import { actName } from "@/lib/util";
import { buildMapSVG, downloadMapPNG, downloadMapPDF, printMap, mapFileName } from "@/lib/datamap";

export default function DataMapModal({ open, rec, onClose }){
  const toast = useToast();
  const res = useMemo(() => (open && rec ? buildMapSVG(rec) : null), [open, rec]);
  if(!open || !rec || !res) return null;
  const name = mapFileName(rec);
  const png = async () => { try{ await downloadMapPNG(res.svg, res.width, res.height, name); toast("บันทึก PNG แล้ว","ok"); }catch(e){ toast("สร้างรูปไม่สำเร็จ","err"); } };
  const pdf = async () => { try{ await downloadMapPDF(res.svg, res.width, res.height, name); toast("บันทึก PDF แล้ว","ok"); }catch(e){ toast("สร้างรูปไม่สำเร็จ","err"); } };
  const prn = () => { try{ printMap(res.svg, name); }catch(e){ toast("เบราว์เซอร์บล็อกหน้าต่างพิมพ์","err"); } };
  return (
    <div id="mapModal" onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="map-wrap">
        <div className="map-bar">
          <div className="map-title">🗺️ Data Mapping Diagram <span className="muted">· {actName(rec)} ({rec.company||"-"})</span></div>
          <div className="map-tools">
            {res.missing.length > 0 &&
              <span className="map-warn">⚠ ข้อมูลยังไม่ครบ: {res.missing.join(", ")}</span>}
            <button className="btn btn-ghost btn-sm" onClick={png}>⬇ PNG</button>
            <button className="btn btn-ghost btn-sm" onClick={pdf}>⬇ PDF</button>
            <button className="btn btn-ghost btn-sm" onClick={prn}>🖨 พิมพ์</button>
            <button className="btn btn-primary btn-sm" onClick={onClose}>✕ ปิด</button>
          </div>
        </div>
        <div className="map-canvas" dangerouslySetInnerHTML={{ __html: res.svg }} />
      </div>
    </div>
  );
}
