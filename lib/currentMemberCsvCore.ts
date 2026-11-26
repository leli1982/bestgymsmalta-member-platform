// Current-member update CSV contract. This is intentionally separate from
// the historical legacy migration/import format.
export const CURRENT_CSV_SCHEMA = "BGM-current-v2";
export const CURRENT_CSV_COLUMNS = [
  "ExportSchema","ExportedOn","BGMNumber","MemberId","LegacyPkCustomer","PhysicalCard","LegacyScan3","LegacyCardStatus",
  "FullName","FirstName","LastName","CompanyName","Address1","Address2","Town","PostCode","Country","Gender","DateOfBirth","IDNumber","NextOfKin",
  "Email","Mobile","Phone","TelephoneNo1","TelephoneNo2","Notes","EnrollmentGymId","EnrollmentGym","LegacyGym",
  "Status","StoredStatus","MembershipType","MembershipDuration","MembershipStartDate","MembershipEndDate","MemberExpiryDate","EnrollmentDate","LegacyMembershipPeriod",
  "CurrentMembershipId","MembershipRole","MembershipRecordStatus","CancellationEffectiveDate","CancellationReason","CancellationRecordedAt",
  "AccessScope","AccessGymId","AccessGym","PendingAccessScope","PendingAccessGymId","PendingAccessEffectiveDate",
  "VoucherExtensionMonths","VoucherBaseExpiryDate","VoucherTerms","PhotoPath","PhotoAssigned","AppEnrolled","AppEnrolledAt","Username","LastLoginAt",
  "CreatedAt","UpdatedAt","ArchivedAt","ArchivedReason","ImportBatchId","ImportRowNumber",
  "AllMembershipTermsJSON","AllPhysicalCardsJSON","AllLegacyCardClaimsJSON",
] as const;
export type CurrentCsvColumn = typeof CURRENT_CSV_COLUMNS[number];

// A deliberately explicit whitelist. Add a field ONLY with the corresponding
// domain validation + atomic apply implementation. History is never mutable.
export const CURRENT_CSV_EDITABLE = [
  "FullName","FirstName","LastName","CompanyName","Address1","Address2","Town","PostCode","Country","Gender",
  "DateOfBirth","IDNumber","NextOfKin","Email","Mobile","Phone","TelephoneNo1","TelephoneNo2","Notes",
  "EnrollmentGymId","MembershipStartDate","MembershipEndDate","MemberExpiryDate","EnrollmentDate",
] as const;
export type CurrentCsvEditable = typeof CURRENT_CSV_EDITABLE[number];
export const CURRENT_CSV_HEADERS = [...CURRENT_CSV_COLUMNS,"OriginalSnapshot","SnapshotSignature"] as const;
export type CurrentCsvRow = Record<CurrentCsvColumn,string>;
export type CurrentCsvPatch = Partial<Record<CurrentCsvEditable,string>>;
export type CurrentCsvBaseline = {
  schema: typeof CURRENT_CSV_SCHEMA;
  project: string;
  // Original displayed scalar cells, excluding the three potentially long histories.
  values: string[];
  histories: string[];
  termUpdatedAt: string | null;
};
export type CurrentCsvEdit = {
  rowNumber: number;
  baseline: string;
  signature: string;
  patch: CurrentCsvPatch;
};
export const HISTORY_COLUMNS = ["AllMembershipTermsJSON","AllPhysicalCardsJSON","AllLegacyCardClaimsJSON"] as const;
const scalarColumns = CURRENT_CSV_COLUMNS.slice(0,CURRENT_CSV_COLUMNS.length-HISTORY_COLUMNS.length);
export const CURRENT_CSV_SCALAR_COLUMNS = scalarColumns;
const editable = new Set<string>(CURRENT_CSV_EDITABLE);
const dates = new Set<string>(["DateOfBirth","MembershipStartDate","MembershipEndDate","MemberExpiryDate","EnrollmentDate"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function currentCsvDisplay(value: unknown): string {
  let s = value == null ? "" : String(value);
  // CSV quoting alone is not protection against spreadsheet formula evaluation.
  if (/^[\s]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
  return s;
}
export function currentCsvCell(value: unknown): string {
  return '"' + String(value ?? "").replace(/"/g,'""') + '"';
}
export function normalizeCurrentCsvDate(value: string): string {
  const clean = value.trim();
  if (!clean) return "";
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(clean);
  const iso = dmy ? dmy[3]+"-"+dmy[2].padStart(2,"0")+"-"+dmy[1].padStart(2,"0") : clean;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error("Use a full date in YYYY-MM-DD or DD/MM/YYYY format.");
  const d = new Date(iso+"T00:00:00Z");
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==iso) throw new Error("Invalid calendar date.");
  return iso;
}
export function parseCurrentCsvBaseline(raw: string): CurrentCsvBaseline {
  let v: unknown;
  try { v=JSON.parse(raw); } catch { throw new Error("OriginalSnapshot is missing or damaged."); }
  if (!v || typeof v!=="object") throw new Error("Invalid original snapshot.");
  const b=v as CurrentCsvBaseline;
  if (b.schema!==CURRENT_CSV_SCHEMA || typeof b.project!=="string" || !b.project ||
      !Array.isArray(b.values) || b.values.length!==scalarColumns.length || !b.values.every(s=>typeof s==="string") ||
      !Array.isArray(b.histories) || b.histories.length!==HISTORY_COLUMNS.length || !b.histories.every(s=>/^[0-9a-f]{64}$/.test(s)) ||
      !(b.termUpdatedAt===null || typeof b.termUpdatedAt==="string")) throw new Error("Invalid original snapshot format.");
  return b;
}
export function originalCurrentCsvValue(b:CurrentCsvBaseline,column:CurrentCsvColumn):string {
  const i=scalarColumns.indexOf(column);
  if(i<0) throw new Error("Not a scalar field.");
  return b.values[i];
}
export function validateCurrentCsvIdentity(b:CurrentCsvBaseline):void {
  const id=originalCurrentCsvValue(b,"MemberId");
  const number=originalCurrentCsvValue(b,"BGMNumber");
  if (!uuid.test(id) || !/^BGM\d+$/i.test(number) ||
      originalCurrentCsvValue(b,"ExportSchema")!==CURRENT_CSV_SCHEMA ||
      !originalCurrentCsvValue(b,"UpdatedAt")) throw new Error("Invalid permanent member identity or revision.");
}
function rawEditedValue(value:string):string {
  // Undo the exporter-added formula guard, but do not trim ordinary text here.
  return /^'[\s]*[=+@-]/.test(value)||/^'[\t\r\n]/.test(value)?value.slice(1):value;
}
export function getCurrentCsvScalarPatch(row:CurrentCsvRow,b:CurrentCsvBaseline):CurrentCsvPatch {
  validateCurrentCsvIdentity(b);
  const patch:CurrentCsvPatch={};
  for(let i=0;i<scalarColumns.length;i++){
    const field=scalarColumns[i], original=b.values[i], submitted=row[field];
    if(submitted===original) continue;
    if(!editable.has(field)) throw new Error(field+" is protected. Use the existing Super Admin correction workflow.");
    const normalized=dates.has(field)?normalizeCurrentCsvDate(submitted):rawEditedValue(submitted);
    if(normalized===rawEditedValue(original))continue;
    if(normalized.length>500)throw new Error(field+" is too long.");
    patch[field as CurrentCsvEditable]=normalized;
  }
  return patch;
}
// Generic RFC4180 parser, supports BOM, CRLF, embedded newlines and escaped quotes.
// Strict header/row length validation; no fuzzy column matching or inferred deletes.
export function parseCurrentMemberCsv(text:string):Array<{rowNumber:number;row:CurrentCsvRow;baseline:string;signature:string}>{
  const input=text.replace(/^\uFEFF/,"");
  const records:Array<{line:number;cells:string[]}>=[];
  let field="",cells:string[]=[],quoted=false,closed=false,line=1,start=1;
  const push=()=>{cells.push(field);field="";closed=false;};
  const finish=()=>{push();records.push({line:start,cells});cells=[];};
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if(quoted){
      if(ch==='"'){if(input[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}
      else{field+=ch;if(ch==="\n")line++;}
      continue;
    }
    if(ch===","){push();continue;}
    if(ch==="\r"||ch==="\n"){
      finish();if(ch==="\r"&&input[i+1]==="\n")i++;line++;start=line;continue;
    }
    if(closed)throw new Error("Unexpected text after a quoted CSV field at line "+line+".");
    if(ch==='"'){
      if(field!=="")throw new Error("Unexpected quote at line "+line+".");
      quoted=true;continue;
    }
    field+=ch;
  }
  if(quoted)throw new Error("Unterminated quoted CSV field at line "+start+".");
  if(field!==""||cells.length||closed)finish();
  while(records.length&&records[records.length-1].cells.every(s=>s===""))records.pop();
  if(!records.length||records[0].cells.length!==CURRENT_CSV_HEADERS.length||
      !CURRENT_CSV_HEADERS.every((header,i)=>records[0].cells[i]===header))
    throw new Error("This is not a complete BGM current-members update CSV. Download a fresh file; do not remove or rename columns.");
  const seenIds=new Set<string>(),seenNumbers=new Set<string>();
  return records.slice(1).map(record=>{
    if(record.cells.length!==CURRENT_CSV_HEADERS.length)throw new Error("Wrong column count on CSV row "+record.line+".");
    const all=Object.fromEntries(CURRENT_CSV_HEADERS.map((k,i)=>[k,record.cells[i]])) as CurrentCsvRow & {OriginalSnapshot:string;SnapshotSignature:string};
    const b=parseCurrentCsvBaseline(all.OriginalSnapshot);
    validateCurrentCsvIdentity(b);
    const id=all.MemberId.toLowerCase(),num=all.BGMNumber.toUpperCase();
    if(all.MemberId!==originalCurrentCsvValue(b,"MemberId")||all.BGMNumber!==originalCurrentCsvValue(b,"BGMNumber"))
      throw new Error("Permanent member identity changed on row "+record.line+".");
    if(seenIds.has(id)||seenNumbers.has(num))throw new Error("Duplicate member on CSV row "+record.line+".");
    if(!/^[a-f0-9]{64}$/.test(all.SnapshotSignature))throw new Error("Missing snapshot signature on row "+record.line+".");
    seenIds.add(id);seenNumbers.add(num);
    const {OriginalSnapshot,SnapshotSignature,...row}=all;
    return {rowNumber:record.line,row:row as CurrentCsvRow,baseline:OriginalSnapshot,signature:SnapshotSignature};
  });
}
