"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import Hu20QuickEnrollment from "@/components/staff/Hu20QuickEnrollment";

export default function Hu20PilotStaffActivation({employeeId,active,employeeName}:{
  employeeId:string;active:boolean;employeeName:string;
}) {
  const [enabled,setEnabled]=useState(false);
  const [mode,setMode]=useState<"loading"|"hidden"|"ready"|"error">("loading");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    const response=await fetch("/api/system/staff-hu20/pilot-staff?employeeId="+encodeURIComponent(employeeId),
      {cache:"no-store"});
    if(response.status===404){setMode("hidden");return;}
    const json=await response.json();
    if(!response.ok || json.ok!==true)throw Error(json.error||"Pilot status unavailable.");
    setEnabled(json.pilotEnabled===true);setMode("ready");
  },[employeeId]);
  useEffect(()=>{void load().catch(()=>setMode("error"));},[load]);

  // Called only by the explicit Enrol Fingerprint click. Individual Super Admin
  // pilot authorisation remains a separate server-side, audited permission.
  // An unapproved employee can never bypass the enrollment or capture gates.
  const authoriseBeforeCapture=async()=>{
    if(enabled)return;
    if(!active)throw Error("Activate this employee before fingerprint enrollment.");
    if(!window.confirm(
      "Authorise "+employeeName+" for supervised biometric enrollment in the isolated TEST pilot? "+
      "Only proceed after the required employment privacy review and employee information. "+
      "This does not activate Production attendance."
    ))throw Error("Enrollment cancelled. No fingerprint was taken.");
    setError("");
    const response=await fetch("/api/system/staff-hu20/pilot-staff",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({employeeId,enabled:true}),cache:"no-store"
    });
    const json=await response.json();
    if(!response.ok||json.ok!==true||json.pilotEnabled!==true){
      throw Error(json.error||"Super Admin pilot authorisation was not confirmed.");
    }
    setEnabled(true);
  };

  async function revoke(){
    if(!window.confirm("Disable this employee's TEST fingerprint pilot and revoke enrolled fingerprints? Attendance history is retained."))return;
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/system/staff-hu20/pilot-staff",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({employeeId,enabled:false}),cache:"no-store"
      });
      const json=await response.json();
      if(!response.ok||json.ok!==true||json.pilotEnabled!==false)throw Error(json.error||"Revocation could not be confirmed.");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Pilot revocation failed.");}
    finally{setBusy(false);}
  }

  if(mode==="hidden")return null;
  return <section data-testid="hu20-one-click-staff-enrollment" className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center gap-3">
      <ShieldCheck className="h-6 w-6 text-orange-700" aria-hidden="true"/>
      <div>
        <h3 className="text-lg font-black text-zinc-900">Step 2 — Enrol Fingerprint</h3>
        <p className="text-sm text-zinc-600">The PC finds its already configured HU20 scanner. No codes or technical details to enter.</p>
      </div>
    </div>
    <p className="mt-3 text-sm text-zinc-700">
      A Super Admin must activate each real employee separately. In this isolated TEST pilot,
      the Enrol Fingerprint button requests that approval with a clear confirmation before capture.
      Production attendance is not enabled here.
    </p>
    {mode==="loading"&&<p role="status" className="mt-3 text-sm">Checking permission…</p>}
    {mode==="error"&&<p role="alert" className="mt-3 text-sm text-red-800">Cannot verify TEST permission. Fingerprint enrollment is unavailable.</p>}
    {error&&<p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    {mode==="ready"&&<>
      <p className="mt-3 text-sm font-bold text-zinc-700">TEST employee permission: {enabled?"Approved":"Requires confirmation when enrolling"}</p>
      <div className="mt-4">
        <Hu20QuickEnrollment employeeId={employeeId} employeeName={employeeName}
          active={active&&!busy} mode="real-pilot" onAuthorize={authoriseBeforeCapture}/>
      </div>
      {enabled&&<button type="button" onClick={()=>void revoke()} disabled={busy}
        className="mt-4 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-800 disabled:opacity-50">
        {busy?"Disabling…":"Disable fingerprint and revoke"}
      </button>}
    </>}
  </section>;
}
