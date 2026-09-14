import test from "node:test";
import assert from "node:assert/strict";
import { cacheVerifiedMember, clearSavedMember, forgetSavedMember, waitForMemberLogout, MEMBER_SESSION_KEY } from "../lib/memberSession.ts";

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

test("discarding stale profile data never logs out a newly created server session", () => {
  let logoutCalls = 0;
  const events = [];
  globalThis.window = {
    localStorage: { removeItem() {} },
    dispatchEvent(event) { events.push(event); },
  };
  globalThis.fetch = async () => { logoutCalls += 1; return { ok: true }; };
  try {
    forgetSavedMember();
    assert.equal(logoutCalls, 0);
    assert.equal(events.length, 1);
    assert.equal(events[0].detail.signedOut, true);
  } finally {
    delete globalThis.window;
    delete globalThis.fetch;
  }
});

test("verified profile caching tolerates disabled local storage and avoids refresh loops", () => {
  let notifications = 0;
  globalThis.window = {
    localStorage: { setItem() { throw new Error("Storage disabled"); } },
    dispatchEvent() { notifications += 1; },
  };
  try {
    assert.doesNotThrow(() => cacheVerifiedMember({ id: "member-id" }));
    assert.equal(notifications, 0);
  } finally {
    delete globalThis.window;
  }
});

test("new authentication requests can wait for an in-flight logout", async () => {
  let finishLogout;
  let requests = 0;
  globalThis.window = {
    localStorage: { removeItem() {} },
    dispatchEvent() {},
  };
  globalThis.fetch = () => {
    requests += 1;
    return new Promise((resolve) => { finishLogout = resolve; });
  };
  try {
    const logout = clearSavedMember();
    assert.equal(waitForMemberLogout(), logout);
    assert.equal(clearSavedMember(), logout);
    assert.equal(requests, 1);
    let completed = false;
    const waiting = Promise.resolve(waitForMemberLogout()).then(() => { completed = true; });
    await Promise.resolve();
    assert.equal(completed, false);
    finishLogout({ ok: true });
    await waiting;
    assert.equal(waitForMemberLogout(), null);
  } finally {
    delete globalThis.window;
    delete globalThis.fetch;
  }
});
