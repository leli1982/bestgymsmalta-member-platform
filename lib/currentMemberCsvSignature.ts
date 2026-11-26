import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { CURRENT_CSV_SCHEMA, CURRENT_CSV_SCALAR_COLUMNS, HISTORY_COLUMNS, parseCurrentCsvBaseline,
  validateCurrentCsvIdentity, type CurrentCsvBaseline, type CurrentCsvRow } from "@/lib/currentMemberCsvCore";

// Reuse server-only authentication key material with domain separation.
// No secret or service-role key is ever included in a CSV.
function context() {
  const project = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.BGM_CURRENT_CSV_SIGNING_KEY || process.env.BGM_ADMIN_SESSION_SECRET || process.env.BGM_SYSTEM_SESSION_SECRET;
  if (!project || !secret) throw new Error("Current-member CSV signing is not configured.");
  const key = createHmac("sha256", secret).update("bgm/current-member-csv/v2").digest();
  return {project,key};
}
export function currentCsvHistoryDigest(value:string) {
  return createHash("sha256").update(value).digest("hex");
}
export function createCurrentCsvSnapshot(row:CurrentCsvRow,termUpdatedAt:string|null) {
  const {project,key}=context();
  const baseline:CurrentCsvBaseline={
    schema:CURRENT_CSV_SCHEMA,project,
    values:CURRENT_CSV_SCALAR_COLUMNS.map(k=>row[k]),
    histories:HISTORY_COLUMNS.map(k=>currentCsvHistoryDigest(row[k])),
    termUpdatedAt,
  };
  validateCurrentCsvIdentity(baseline);
  const original=JSON.stringify(baseline);
  const signature=createHmac("sha256",key).update(original).digest("hex");
  return {original,signature};
}
export function verifyCurrentCsvSnapshot(original:string,signature:string):CurrentCsvBaseline{
  const {project,key}=context();
  if(!/^[a-f0-9]{64}$/.test(signature))throw new Error("Invalid exported row signature.");
  const expected=createHmac("sha256",key).update(original).digest();
  if(!timingSafeEqual(expected,Buffer.from(signature,"hex")))throw new Error("Exported row baseline was changed. Download a fresh CSV.");
  const baseline=parseCurrentCsvBaseline(original);
  if(baseline.project!==project)throw new Error("This CSV belongs to another database environment.");
  validateCurrentCsvIdentity(baseline);
  return baseline;
}
export function assertCurrentCsvHistoryUnedited(row:CurrentCsvRow,b:CurrentCsvBaseline){
  HISTORY_COLUMNS.forEach((column,i)=>{
    if(currentCsvHistoryDigest(row[column])!==b.histories[i])
      throw new Error(column+" is protected history and cannot be overwritten by CSV.");
  });
}
