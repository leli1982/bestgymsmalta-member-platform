"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, CheckCircle2, RefreshCw, XCircle } from "lucide-react";

type VoucherRequest = {
  id:string;applicationId:string;reference:string;applicationStatus:string;
  memberName:string;voucherCode:string;gymName:string;status:string;
  requestedBy:string;requestedAt:string;reviewedBy:string|null;reviewedAt:string|null;note:string|null;
};
type Reply = {pendingCount:number;requests:VoucherRequest[]};

function localDate(value:string|null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB",{
    timeZone:"Europe/Malta",day:"2-digit",month:"2-digit",year:"numeric",
    hour:"2-digit",minute:"2-digit",
  });
}

export default function VoucherApprovalsAdmin() {
  const [data,setData]=useState<Reply>({pendingCount:0,requests:[]});
  const [busy,setBusy]=useState("");
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    try{
      const response=await fetch("/api/system/voucher-approvals",{cache:"no-store",credentials:"same-origin"});
      const json=await response.json();
      if(!response.ok)throw new Error(json.error||"Could not load approvals.");
      setData(json);setError("");
    }catch(caught){setError(caught instanceof Error?caught.message:"Could not load approvals.");}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{
    void load();
    const timer=window.setInterval(()=>void load(),12000);
    return ()=>window.clearInterval(timer);
  },[load]);

  async function decide(item:VoucherRequest,decision:"approved"|"rejected"){
    if(busy)return;
    if(decision==="rejected"&&!window.confirm(`Reject ${item.voucherCode} for ${item.memberName}?`))return;
    setBusy(item.id);setMessage("");setError("");
    try{
      const response=await fetch("/api/system/voucher-approvals",{
        method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({requestId:item.id,decision,note:notes[item.id]||""}),
      });
      const json=await response.json();
      if(!response.ok)throw new Error(json.error||"Could not update approval.");
      setMessage(`${item.voucherCode} ${decision} for ${item.memberName}.`);
      await load();
    }catch(caught){setError(caught instanceof Error?caught.message:"Could not update approval.");}
    finally{setBusy("");}
  }

  const pending=data.requests.filter(item=>item.status==="pending"&&item.applicationStatus!=="activated");
  const recent=data.requests.filter(item=>item.status!=="pending"||item.applicationStatus==="activated").slice(0,30);

  return (
    <main className="min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <a className="text-sm font-black text-orange-700 underline" href="/staff/admin">← Super Admin</a>
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <div className="flex items-center gap-2"><BellRing className="h-6 w-6 text-orange-600"/><h1 className="text-2xl font-black">Voucher Approvals</h1></div>
            <p className="mt-2 text-sm font-semibold text-zinc-600">Requests refresh automatically. Only Super Admin accounts may approve or reject vouchers.</p>
          </div>
          <button type="button" onClick={()=>void load()} className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-black">
            <RefreshCw className="h-4 w-4"/> Refresh
          </button>
        </header>
        {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 font-semibold text-red-800">{error}</p>}
        {message&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-800">{message}</p>}
        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Pending approval <span className="ml-2 rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-800">{data.pendingCount}</span></h2>
          {loading&&<p className="mt-3 text-sm">Loading requests…</p>}
          {!loading&&pending.length===0&&<p className="mt-3 text-sm font-semibold text-zinc-500">No vouchers are awaiting approval.</p>}
          <div className="mt-4 space-y-3">
            {pending.map(item=>(
              <article key={item.id} className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <h3 className="font-black">{item.voucherCode} · {item.memberName}</h3>
                    <p className="mt-1 text-sm font-semibold text-zinc-700">{item.gymName} · {item.reference}</p>
                    <p className="mt-1 text-xs text-zinc-600">Requested by {item.requestedBy} · {localDate(item.requestedAt)}</p>
                  </div>
                  <span className="h-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">AWAITING APPROVAL</span>
                </div>
                <label className="mt-4 block text-xs font-bold text-zinc-700">Optional decision note
                  <input value={notes[item.id]||""} maxLength={500} onChange={e=>setNotes(n=>({...n,[item.id]:e.target.value}))}
                    placeholder="Reason or additional instructions"
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"/>
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={!!busy} onClick={()=>void decide(item,"approved")}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4"/> Approve</button>
                  <button type="button" disabled={!!busy} onClick={()=>void decide(item,"rejected")}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50"><XCircle className="h-4 w-4"/> Reject</button>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Recent decisions and cancelled requests</h2>
          <div className="mt-3 divide-y divide-zinc-100">
            {recent.length===0?<p className="text-sm text-zinc-500">No decisions yet.</p>:recent.map(item=>(
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div><p className="font-black">{item.voucherCode} · {item.memberName}</p><p className="text-xs text-zinc-500">{item.gymName} · {item.reference} · {localDate(item.reviewedAt||item.requestedAt)}</p></div>
                <span className="font-black uppercase text-zinc-700">{item.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
