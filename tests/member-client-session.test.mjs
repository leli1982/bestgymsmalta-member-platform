import test from "node:test";
import assert from "node:assert/strict";
import { clearSavedMember, MEMBER_SESSION_KEY } from "../lib/memberSession.ts";

test("clearing the saved member also clears the server session", async () => {
  const removedKeys = [];
  const dispatchedEvents = [];
  const fetchCalls = [];

  globalThis.window = {
    localStorage: {
      removeItem(key) {
        removedKeys.push(key);
      },
    },
    dispatchEvent(event) {
      dispatchedEvents.push(event.type);
    },
  };

  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url, options });
    return { ok: true };
  };

  clearSavedMember();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(removedKeys, [MEMBER_SESSION_KEY]);
  assert.deepEqual(dispatchedEvents, ["bgmMemberChanged"]);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "/api/member/auth/logout");
  assert.equal(fetchCalls[0].options.method, "DELETE");
  assert.equal(fetchCalls[0].options.keepalive, true);

  delete globalThis.window;
  delete globalThis.fetch;
});
