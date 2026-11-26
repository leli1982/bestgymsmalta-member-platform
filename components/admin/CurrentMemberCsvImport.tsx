"use client";

import { useState } from "react";
import { Download, RefreshCw, Upload } from "lucide-react";
import {
  parseCurrentMemberCsv, parseCurrentCsvBaseline, getCurrentCsvScalarPatch,
  HISTORY_COLUMNS, currentCsvDisplay, currentCsvCell,
  type CurrentCsvEdit,
} from "@/lib/currentMemberCsvCore";

type ReviewRow={rowNumber:number;memberNumber:string;before:Record<string,string>;patch:Record<string,string>;issue:string|null};
type Preview={batchId:string;sourceRows:number;expectedEdits:number;staged:number;issues:number;status:string;rows:ReviewRow[]};
type LocalIssue={rowNumber:number;memberNumber:string;issue:string};
const endpoint="/api/admin/members/current-csv";
const encoder=new TextEncoder();

async function post(body:Record<string,unknown>){
  const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await res.json().catch(()=>({error:"Unexpected server response. No preview approval was recorded."}));
  if(!res.ok)throw new Error(data.error||"CSV operation failed.");
  return data;
}
async function readPreview(batchId:string,offset=0):Promise<Preview>{
  const res=await fetch(endpoint+"?batchId="+encodeURIComponent(batchId)+"&offset="+offset,{cache:"no-store"});
  const data=await res.json();
  if(!res.ok)throw new Error(data.error||"Could not read the preview.");
  return data;
}
async function digest(value:string){
  const hash=await crypto.subtle.digest("SHA-256",encoder.encode(value));
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

export default function CurrentMemberCsvImport({onApplied}:{onApplied?:()=>void|Promise<void>}){
  const [file,setFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState("");
  const [error,setError]=useState("");
  const [preview,setPreview]=useState<Preview|null>(null);
  const [offset,setOffset]=useState(0);
  const [localIssues,setLocalIssues]=useState<LocalIssue[]>([]);
  const [localIssueCount,setLocalIssueCount]=useState(0);
  const [sourceRows,setSourceRows]=useState<number|null>(null);
  const [unchanged,setUnchanged]=useState(false);

  async function validate(){
    if(!file||busy)return;
    setBusy(true);setError("");setPreview(null);setLocalIssues([]);setLocalIssueCount(0);setSourceRows(null);setUnchanged(false);setOffset(0);
    setProgress("Reading current-members CSV…");
    try{
      const records=parseCurrentMemberCsv(await file.text());
      if(records.length>100000)throw new Error("The CSV exceeds the supported member count.");
      setSourceRows(records.length);
      const edits:CurrentCsvEdit[]=[],issues:LocalIssue[]=[];
      let issueCount=0;
      // Hash protected history in bounded groups, keeping large full exports manageable.
      for(let start=0;start<records.length;start+=64){
        const group=records.slice(start,start+64);
        const results=await Promise.all(group.map(async r=>{
          try{
            const baseline=parseCurrentCsvBaseline(r.baseline);
            const patch=getCurrentCsvScalarPatch(r.row,baseline);
            const hashes=await Promise.all(HISTORY_COLUMNS.map(k=>digest(r.row[k])));
            if(hashes.some((h,i)=>h!==baseline.histories[i]))throw new Error("Membership or card history was edited. Historical data is protected.");
            return {r,patch};
          }catch(e){return {r,issue:e instanceof Error?e.message:"Invalid edited row."};}
        }));
        for(const result of results){
          if("issue" in result){
            issueCount++;
            if(issues.length<100)issues.push({rowNumber:result.r.rowNumber,memberNumber:result.r.row.BGMNumber,issue:result.issue||"Invalid row."});
          }else if(Object.keys(result.patch||{}).length){
            edits.push({rowNumber:result.r.rowNumber,baseline:result.r.baseline,signature:result.r.signature,patch:result.patch!});
          }
        }
        if(start%1024===0)setProgress("Checking rows "+Math.min(start+64,records.length).toLocaleString()+" / "+records.length.toLocaleString()+"…");
      }
      setLocalIssues(issues);setLocalIssueCount(issueCount);
      if(issueCount){setProgress("Validation blocked. Correct the listed rows and preview again; no membership data changed.");return;}
      if(!edits.length){setUnchanged(true);setProgress("No edited fields detected. No membership records changed.");return;}
      setProgress("Creating a secure update preview…");
      const {batchId}=await post({action:"start",sourceRows:records.length,expectedEdits:edits.length});
      let staged=0,chunk:CurrentCsvEdit[]=[],bytes=0;
      const flush=async()=>{
        if(!chunk.length)return;
        const result=await post({action:"append",batchId,edits:chunk});
        staged=Number(result.staged);
        setProgress("Validating "+staged.toLocaleString()+" / "+edits.length.toLocaleString()+" edited members against the current database…");
        chunk=[];bytes=0;
      };
      for(const edit of edits){
        const size=encoder.encode(JSON.stringify(edit)).byteLength;
        if(size>700000)throw new Error("An edited row exceeds the preview size limit.");
        if(chunk.length>=50||bytes+size>700000)await flush();
        chunk.push(edit);bytes+=size;
      }
      await flush();
      const p=await readPreview(batchId);
      setPreview(p);
      setProgress(p.issues?"Preview contains blocking issues. Nothing has been applied.":"Preview ready. Review the exact field changes before applying.");
    }catch(e){setError(e instanceof Error?e.message:"Could not validate this CSV.");setProgress("");}
    finally{setBusy(false);}
  }
  async function page(next:number){
    if(!preview||busy)return;
    setBusy(true);setError("");
    try{setPreview(await readPreview(preview.batchId,next));setOffset(next);}
    catch(e){setError(e instanceof Error?e.message:"Could not read this preview page.");}
    finally{setBusy(false);}
  }
  async function downloadReview(){
    if(!preview||busy)return;
    setBusy(true);setError("");
    try{
      const lines=[["Row","BGMNumber","Field","Before","After","Issue"].map(currentCsvCell).join(",")];
      for(let i=0;i<preview.staged;i+=100){
        const data=await readPreview(preview.batchId,i);
        for(const row of data.rows){
          for(const [field,after] of Object.entries(row.patch)){
            lines.push([row.rowNumber,row.memberNumber,field,row.before[field],after,row.issue||""].map(currentCsvDisplay).map(currentCsvCell).join(","));
          }
        }
      }
      const url=URL.createObjectURL(new Blob(["\uFEFF"+lines.join("\r\n")+"\r\n"],{type:"text/csv;charset=utf-8"}));
      const link=document.createElement("a");link.href=url;link.download="bgm-current-csv-update-preview.csv";link.click();URL.revokeObjectURL(url);
    }catch(e){setError(e instanceof Error?e.message:"Could not download review.");}
    finally{setBusy(false);}
  }
  async function apply(){
    if(!preview||busy||preview.issues||preview.staged!==preview.expectedEdits||preview.status!=="preview")return;
    if(!window.confirm("Apply the "+preview.expectedEdits+" reviewed existing-member updates? Every omitted member, payment and membership history will remain in place."))return;
    setBusy(true);setError("");setProgress("Applying the confirmed update in a single transaction…");
    try{
      const result=await post({action:"apply",batchId:preview.batchId,confirmed:true});
      if(!result.applied)throw new Error("Apply was not confirmed. Check the preview status.");
      setPreview(await readPreview(preview.batchId,offset));
      setProgress(result.updated+" existing members updated. No members created or deleted.");
      await onApplied?.();
    }catch(e){
      setError(e instanceof Error?e.message:"Could not apply. Check the preview before retrying.");
      try{setPreview(await readPreview(preview.batchId,offset));}catch{/* Safe idempotent retry remains available. */}
      setProgress("");
    }finally{setBusy(false);}
  }
  return <section className="mt-5 space-y-4 rounded-2xl border border-[#ffb400]/40 bg-black/20 p-5">
    <div>
      <h3 className="text-xl font-black text-[#ffb400]">Current members — edit and re-upload CSV</h3>
      <p className="mt-2 text-sm text-white/70">Download the full current-members CSV above. In Excel, import it as text to preserve identifiers, leading zeroes, phone numbers and protected revision columns. Edit the values, save as UTF-8 CSV without renaming columns, then validate here. Only changed existing BGM records are updated. Rows not included are always retained.</p>
      <p className="mt-2 text-xs text-white/50">Profile details, current enrollment gym, verified membership dates, eligible individual membership type/duration, legacy membership period and effective status can be reviewed here. Card changes, shared memberships, voucher-linked terms, protected account identifiers, photo references, cancellation and historical records require the existing individual correction workflows. These fields are still included in the download and are not overwritten by CSV.</p>
    </div>
    <div className="flex flex-wrap gap-3">
      <input type="file" accept=".csv,text/csv" disabled={busy} onChange={event=>{
        setFile(event.target.files?.[0]||null);setPreview(null);setError("");setProgress("");setLocalIssues([]);setLocalIssueCount(0);setSourceRows(null);setUnchanged(false);
      }} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:p-2 file:text-white"/>
      <button type="button" disabled={!file||busy} onClick={validate} className="inline-flex items-center gap-2 rounded-xl bg-[#ffb400] px-5 py-3 text-sm font-black text-black disabled:opacity-40">
        {busy?<RefreshCw className="animate-spin" size={17}/>:<Upload size={17}/>} Validate edited CSV
      </button>
    </div>
    {sourceRows!==null&&<p className="text-sm font-bold text-white/60">{sourceRows.toLocaleString()} source rows · omitted records retained</p>}
    {progress&&<p role="status" className="rounded-xl bg-white/5 p-3 text-sm font-bold text-white/80">{progress}</p>}
    {error&&<p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-200">{error}</p>}
    {unchanged&&<p className="text-sm font-bold text-emerald-300">0 updates required.</p>}
    {!!localIssueCount&&<div className="rounded-xl border border-red-500/30 p-3 text-sm text-red-200">
      <p className="font-black">{localIssueCount.toLocaleString()} blocking CSV issues (showing first {localIssues.length})</p>
      <div className="mt-3 max-h-80 overflow-auto">{localIssues.map(r=><p key={r.rowNumber} className="border-b border-white/10 py-2">Row {r.rowNumber} · {r.memberNumber}: {r.issue}</p>)}</div>
    </div>}
    {preview&&<div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold text-white">{preview.expectedEdits.toLocaleString()} edited members · {(preview.sourceRows-preview.expectedEdits).toLocaleString()} unchanged rows · {preview.issues.toLocaleString()} blocking issues · 0 deletions</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={downloadReview} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 p-3 text-sm font-bold text-white disabled:opacity-40"><Download size={16}/> Download full review</button>
          <button type="button" disabled={busy||preview.issues>0||preview.staged!==preview.expectedEdits||preview.status!=="preview"} onClick={apply} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-black disabled:opacity-40">{preview.status==="applied"?"Updates applied":"Apply reviewed updates"}</button>
        </div>
      </div>
      <div className="max-h-96 overflow-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-xs text-white/80">
          <thead className="sticky top-0 bg-zinc-900"><tr>{["Member / row","Field","Before","After","Issue"].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead>
          <tbody>{preview.rows.flatMap(r=>Object.entries(r.patch).map(([field,after])=><tr key={r.rowNumber+"-"+field} className="border-t border-white/10 align-top">
            <td className="p-3 font-bold">{r.memberNumber}<span className="block text-white/50">Row {r.rowNumber}</span></td><td className="p-3">{field}</td><td className="p-3 whitespace-pre-wrap break-words">{r.before[field]||"—"}</td><td className="p-3 whitespace-pre-wrap break-words">{after||"—"}</td><td className="p-3 text-red-200">{r.issue||"—"}</td>
          </tr>))}</tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-2 text-sm text-white/60">
        <button type="button" disabled={busy||offset===0} onClick={()=>page(Math.max(0,offset-100))} className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-30">Previous</button>
        <span>{offset+1}–{Math.min(offset+100,preview.staged)} of {preview.staged}</span>
        <button type="button" disabled={busy||offset+100>=preview.staged} onClick={()=>page(offset+100)} className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-30">Next</button>
      </div>
    </div>}
  </section>;
}
