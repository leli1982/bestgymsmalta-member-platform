import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOrderPushPayload,
  resolveVapidConfig,
} from "../lib/pushNotificationsCore.ts";

test("builds a concise tappable order push notification", () => {
  assert.deepEqual(
    buildOrderPushPayload({
      orderType: "sundries",
      orderId: "order-123",
      gymName: "Birkirkara Fitness",
      staffName: "Maria Borg",
      itemCount: 8,
    }),
    {
      title: "New Sundries Order",
      body: "Birkirkara Fitness · Maria Borg · 8 items",
      url: "/staff/sundries?order=order-123",
      tag: "bgm-order-order-123",
    }
  );
});

test("uses singular item wording and Bar List title", () => {
  const payload = buildOrderPushPayload({
    orderType: "bar",
    orderId: "bar-1",
    gymName: "Sliema Fitness",
    staffName: "John Borg",
    itemCount: 1,
  });

  assert.equal(payload.title, "New Bar List");
  assert.match(payload.body, /1 item$/);
  assert.equal(payload.url, "/staff/bar?order=bar-1");
});

test("resolves VAPID configuration only when all required values exist", () => {
  assert.deepEqual(
    resolveVapidConfig({
      BGM_VAPID_PUBLIC_KEY: "public-key",
      BGM_VAPID_PRIVATE_KEY: "private-key",
      BGM_VAPID_SUBJECT: "mailto:info@bestgymsmalta.com",
    }),
    {
      publicKey: "public-key",
      privateKey: "private-key",
      subject: "mailto:info@bestgymsmalta.com",
    }
  );

  assert.equal(
    resolveVapidConfig({
      BGM_VAPID_PUBLIC_KEY: "public-key",
      BGM_VAPID_PRIVATE_KEY: "",
      BGM_VAPID_SUBJECT: "mailto:info@bestgymsmalta.com",
    }),
    null
  );
});
