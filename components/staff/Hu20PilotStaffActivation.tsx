"use client";

import { useCallback, useEffect, useState } from "react";

export default function Hu20PilotStaffActivation({employeeId,active}:{
  employeeId:string;active:boolean;
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
  async function toggle(){
    const next=!enabled;
    if(!window.confirm(next
      ?"Authorise this real employee for the isolated TEST fingerprint pilot? This is not production activation."
      :"Disable pilot, revoke encrypted fingerprint records and cancel pending enrolments for this employee?"))return;
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/system/staff-hu20/pilot-staff",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({employeeId,enabled:next})
      });
      const json=await response.json();
      if(!response.ok||json.ok!==true||json.pilotEnabled!==next)
        throw Error(json.error||"Unable to confirm pilot change.");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Pilot activation failed.");}
    finally{setBusy(false);}
  }
  if(mode==="hidden")return null;
  return <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm">
    <h3 className="font-black">Individual HU20 fingerprint pilot authorisation — TEST</h3>
    <p className="mt-1">A Super Admin must activate each real employee separately.
      This step alone does not start fingerprint capture or enable production payroll.</p>
    {mode==="loading"&&<p>Checking approval…</p>}
    {mode==="error"&&<p role="alert">Could not verify pilot status; activation unavailable.</p>}
    {error&&<p role="alert" className="text-red-800">{error}</p>}
    {mode==="ready"&&<>
      <p className="mt-2 font-semibold">Employee pilot: {enabled?"Authorised in TEST":"Not authorised"}</p>
      <button type="button" disabled={busy||(!enabled&&!active)} onClick={()=>void toggle()}
        className="mt-3 rounded-lg border border-indigo-600 bg-white px-3 py-2 font-bold disabled:opacity-40">
        {busy?"Saving…":enabled?"Disable and revoke fingerprint pilot":"Authorise employee for TEST pilot"}
      </button>
    </>}
  </section>;
}
