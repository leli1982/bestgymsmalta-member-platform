"use client";

import { useCallback, useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";

const BRIDGE = "http://127.0.0.1:8765";
const BRIDGE_HEADERS = { "X-BGM-HU20-Bridge": "v1" };
type LocalDevice = { ok: true; testOnly: true; terminalId: string; nonce: string };
type Props = { employeeId: string; employeeName: string; active: boolean; mode?: "fictional" | "real-pilot"; onAuthorize?: () => Promise<void> };

async function readLocalDevice(): Promise<LocalDevice> {
  const response = await fetch(BRIDGE + "/status", {
    method: "GET", headers: BRIDGE_HEADERS, cache: "no-store",
  });
  if (!response.ok) throw new Error("Local HU20 device unavailable.");
  const data = await response.json();
  if (data?.ok !== true || data?.testOnly !== true ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.terminalId || "") ||
      !/^[0-9a-f]{32}$/i.test(data.nonce || "")) {
    throw new Error("Untrusted HU20 TEST device response.");
  }
  return data as LocalDevice;
}

export default function Hu20QuickEnrollment({ employeeId, employeeName, active, mode = "fictional", onAuthorize }: Props) {
  const [deviceName, setDeviceName] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [pendingRequestId, setPendingRequestId] = useState("");
  const [state, setState] = useState<"checking" | "ready" | "pending" | "offline" | "enrolling" | "completed">("checking");
  const [message, setMessage] = useState("");

  const checkDevice = useCallback(async () => {
    if (!active) { setState("offline"); return; }
    setState("checking");
    try {
      const local = await readLocalDevice();
      const response = await fetch("/api/system/staff-hu20/enrollments", { cache: "no-store" });
      if (!response.ok) throw new Error("Super Admin TEST enrollment is unavailable.");
      const body = await response.json();
      const matching = (body.terminals || []).find((t: { id: string; active: boolean; name: string }) =>
        t.active && t.id === local.terminalId);
      if (!matching) throw new Error("This PC's local reader is not an active TEST terminal.");
      setDeviceName(matching.name);
      setTerminalId(local.terminalId);
      const pending = (body.requests || []).find((req: {
        id: string; employee_id: string; status: string; terminal_id: string; expires_at: string;
      }) => req.employee_id === employeeId && req.terminal_id === local.terminalId &&
        req.status === "pending" && Date.parse(req.expires_at) > Date.now());
      setPendingRequestId(pending?.id || "");
      if (pending) {
        setState("pending");
        setMessage("A previous fingerprint enrollment was not finished. Cancel it below to start again.");
      } else {
        setState("ready");
        setMessage("");
      }
    } catch {
      setState("offline");
      setMessage("No configured HU20 reader service was found on this PC. Connect the reader and ask your installer to complete the one-time PC setup. Super Admin never needs scanner codes or passwords.");
    }
  }, [active, employeeId]);

  useEffect(() => { void checkDevice(); }, [checkDevice]);

  async function cancelPendingEnrollment() {
    if (!pendingRequestId || state !== "pending") return;
    setState("checking");
    try {
      const response = await fetch("/api/system/staff-hu20/enrollments", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pendingRequestId, action: "cancel" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not cancel the old TEST enrollment.");
      setPendingRequestId("");
      await checkDevice();
    } catch (caught) {
      setState("pending");
      setMessage(caught instanceof Error ? caught.message : "Could not cancel the old TEST request.");
    }
  }

  async function startEnrollment() {
    if (!terminalId || state !== "ready" || !active) return;
    setState("enrolling");
    setMessage("The Windows progress window will now open. Follow PLACE FINGER and REMOVE FINGER for scans 1, 2 and 3. Keep the kiosk closed.");
    try {
      const device = await readLocalDevice();
      if (device.terminalId !== terminalId) throw new Error("The connected reader is not the one registered to this PC.");
      // The same explicit Super Admin click can individually approve this
      // employee for the isolated TEST pilot before requesting capture.
      // The server still verifies approval independently at every stage.
      if (mode === "real-pilot" && onAuthorize) await onAuthorize();
      const approved = await fetch("/api/system/staff-hu20/enrollments", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ employeeId, terminalId: device.terminalId }),
      });
      const authorization = await approved.json();
      if (!approved.ok) throw new Error(authorization.error || "TEST authorisation failed.");
      const requestId: string = authorization.request?.id;
      if (!requestId || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId)) {
        throw new Error("Invalid TEST enrollment authorisation returned.");
      }
      const nativeResponse = await fetch(BRIDGE + "/enroll", {
        method: "POST", cache: "no-store",
        headers: { ...BRIDGE_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, employeeId, nonce: device.nonce }),
      });
      const native = await nativeResponse.json();
      if (!nativeResponse.ok || native.ok !== true || native.testOnly !== true ||
          native.requestId !== requestId) {
        throw new Error("Fingerprint capture was not confirmed.");
      }
      const verifyResponse = await fetch("/api/system/staff-hu20/enrollments", { cache: "no-store" });
      const verified = await verifyResponse.json();
      const record = (verified.requests || []).find((item: { id: string; employee_id: string; status: string }) =>
        item.id === requestId && item.employee_id === employeeId && item.status === "completed");
      if (!verifyResponse.ok || !record) {
        throw new Error("TEST fingerprint status could not be verified.");
      }
      setState("completed");
      setMessage("PASS: " + employeeName + " enrolled on " + deviceName + " in TEST.");
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "TEST enrollment did not complete.";
      // A failed local capture often leaves a pending server authorisation.
      // Read its status and offer a single-click cancellation, rather than
      // stranding Super Admin with a hidden pending request.
      setMessage(detail + " Check the TEST enrollment status before trying again.");
      await checkDevice();
    }
  }

  return <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm">
    <div className="flex items-center gap-2 font-black text-zinc-900">
      <Fingerprint className="h-5 w-5 text-orange-700" /> {mode === "real-pilot" ? "Fingerprint enrollment — staff TEST pilot" : "Fingerprint enrollment — fictional TEST"}
    </div>
    <p className="mt-1 text-zinc-700">
      This PC selects its registered scanner automatically. Staff members do not enter PINs,
      scanner IDs or technical codes. Ask the employee to be present for three fingerprint placements.
    </p>
    <p className="mt-2 font-semibold text-zinc-900" role="status">
      {state === "checking" ? "Checking local HU20…" :
        state === "ready" ? "Reader service ready on this PC: " + deviceName :
        state === "pending" ? "Previous enrollment needs attention — " + deviceName :
        state === "enrolling" ? "Follow the Windows PLACE/REMOVE FINGER window" :
        state === "completed" ? "Fingerprint enrolled" : "Reader service not configured on this PC"}
    </p>
    {message && <p className="mt-2 text-zinc-800" role="alert">{message}</p>}
    <button type="button" onClick={() => void startEnrollment()} disabled={state !== "ready" || !active}
      className="mt-3 rounded-xl bg-orange-600 px-4 py-2.5 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
      {state === "enrolling" ? "Enrolling…" : "Enrol Fingerprint"}
    </button>
    {state === "pending" && <button type="button"
      onClick={() => void cancelPendingEnrollment()}
      className="ml-3 mt-3 rounded-xl border border-amber-700 bg-white px-4 py-2.5 font-bold text-amber-900">
      Cancel pending TEST request
    </button>}
    {state === "offline" && <button type="button" onClick={() => void checkDevice()}
      className="ml-3 mt-3 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 font-bold">Check reader</button>}
    <p className="mt-3 text-xs text-zinc-600">
      The employee must be present for supervised capture. {mode === "real-pilot"
        ? "Only employees individually authorised by Super Admin for the isolated TEST pilot can enrol."
        : "Only active fictional HU20-TEST employees can enrol."}
      {" "}Fingerprint templates are never shown in this browser.
    </p>
    <a href={"/staff/admin/staff/terminals/enrollment?employeeId=" + encodeURIComponent(employeeId)}
      className="mt-2 inline-block font-bold text-orange-800 underline">
      Advanced enrollment assistance (installer only)
    </a>
  </div>;
}
