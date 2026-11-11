"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, ShieldAlert, XCircle } from "lucide-react";
import type { VoucherApprovalStatus } from "@/lib/voucherApprovalCore";

type Props = {
  applicationId: string;
  code: string;
  status: VoucherApprovalStatus;
  onStatusChange: (status: VoucherApprovalStatus) => void;
};

export default function StaffVoucherApprovalStatus({applicationId,code,status,onStatusChange}:Props) {
  const callback = useRef(onStatusChange);
  const [note,setNote] = useState<string|null>(null);
  const [error,setError] = useState("");
  useEffect(()=>{callback.current=onStatusChange;},[onStatusChange]);

  useEffect(()=>{
    let active=true;
    async function check() {
      try {
        const response=await fetch(
          `/api/system/members/applications/${encodeURIComponent(applicationId)}/voucher-approval?code=${encodeURIComponent(code)}`,
          {cache:"no-store",credentials:"same-origin"}
        );
        const payload=await response.json();
        if(!response.ok)throw new Error(payload.error || "Could not check approval.");
        if(!active)return;
        callback.current(payload.status as VoucherApprovalStatus);
        setNote(payload.note || null);
        setError("");
      } catch(caught) {
        if(active)setError(caught instanceof Error?caught.message:"Could not check approval.");
      }
    }
    void check();
    const timer=window.setInterval(()=>void check(),6000);
    return ()=>{active=false;window.clearInterval(timer);};
  },[applicationId,code]);

  return (
    <div role="status" aria-live="polite" className={`mt-2 rounded-xl border px-3 py-3 text-sm font-bold ${
      status==="approved"?"border-emerald-300 bg-emerald-50 text-emerald-800":
      status==="rejected"||status==="stale"?"border-red-300 bg-red-50 text-red-800":
      "border-amber-300 bg-amber-50 text-amber-900"
    }`}>
      {status==="approved" ? (
        <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4"/> Super Admin approved this voucher. You may now accept payment.</p>
      ) : status==="rejected" ? (
        <div><p className="flex items-center gap-2"><XCircle className="h-4 w-4"/> Super Admin rejected this voucher.</p>
          {note?<p className="mt-1 text-xs">Reason: {note}</p>:null}
          <p className="mt-1 text-xs">Choose another voucher or No voucher, or press Apply code to request approval again.</p>
        </div>
      ) : status==="stale"||status==="not_requested" ? (
        <p className="flex items-center gap-2"><ShieldAlert className="h-4 w-4"/> Voucher approval is no longer valid. Press Apply code again before payment.</p>
      ) : (
        <p className="flex items-center gap-2"><Clock3 className="h-4 w-4"/> Awaiting Super Admin approval. Do not take payment yet; this screen updates automatically.</p>
      )}
      {error?<p className="mt-1 text-xs font-semibold">Unable to refresh approval: {error}</p>:null}
    </div>
  );
}
