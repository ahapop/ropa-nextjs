"use client";
import { createContext, useContext, useState, useRef, useCallback } from "react";

const Ctx = createContext(() => {});

export function ToastProvider({ children }){
  const [t, setT] = useState({ msg:"", type:"", show:false });
  const timer = useRef();
  const toast = useCallback((msg, type) => {
    setT({ msg, type: type||"", show:true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(s => ({ ...s, show:false })), 2200);
  }, []);
  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className={"toast " + (t.show ? "show " : "") + t.type}>{t.msg}</div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
