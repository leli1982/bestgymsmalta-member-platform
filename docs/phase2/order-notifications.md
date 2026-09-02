# Phase 2 Order Notifications

Operational Sundries and Bar orders use two notification channels:

- Email, with the recipient editable by Super Admin. Initial recipient: `info@bestgymsmalta.com`.
- Standard Web Push notifications to subscribed Super Admin devices.

WhatsApp and SMS are intentionally out of scope.

Push subscriptions are per browser/device. VAPID keys are generated server-side on first subscription and the private key is never exposed to the browser. Stale push subscriptions are disabled when the push service reports that the subscription is gone.

Each operational order keeps separate Email and Push delivery status while preserving the existing overall notification status for compatibility.
