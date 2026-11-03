/**
 * Shared transactional email footer. Uses the official logo already hosted by the
 * member app; email clients that block images still see the text branding.
 */
export const BGM_CONTACT_EMAIL = "info@bestgymsmalta.com";
export const BGM_LOGO_URL =
  "https://bestgymsmalta-member-platform.vercel.app/email/bgm-logo-horizontal-black.png";

export function bgmEmailFooterText() {
  return [
    "BestGymsMalta - Be the best... Beat the rest.",
    "",
    "This is an automated email. Please do not reply.",
    `For any questions or assistance, contact ${BGM_CONTACT_EMAIL}.`,
  ].join("\n");
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/** Simple email-safe CTA and installation guide, shared across membership emails. */
export function bgmAppAccessHtml(appUrl: string) {
  const url = escapeHtml(appUrl.trim());
  return `<div style="margin:24px 0">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate">
      <tr><td bgcolor="#e87e12" style="border-radius:8px;background-color:#e87e12">
        <a href="${url}" style="display:inline-block;padding:14px 26px;color:#ffffff;background-color:#e87e12;text-decoration:none;font-size:16px;font-weight:700;border-radius:8px">Open Member App</a>
      </td></tr>
    </table>
    <p style="margin:12px 0 0;font-size:12px;color:#52525b">Button not working? <a href="${url}" style="color:#9a3412">Open the app using this link</a>.</p>
    <div style="margin-top:20px;padding:16px;border:1px solid #e4e4e7;border-radius:8px;background-color:#fafafa">
      <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#18181b">Install the app on your phone</p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#3f3f46"><strong>Android:</strong> Open the app in Chrome, tap the menu (&#8942;), then choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.</p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#3f3f46"><strong>iPhone:</strong> Open the app in Safari, tap <strong>Share</strong>, choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</p>
    </div>
  </div>`;
}

export function bgmAppAccessText(appUrl: string) {
  return [
    "Open Member App:",
    appUrl.trim(),
    "",
    "Install the app on your phone:",
    "Android: Open the link in Chrome, tap the menu (three dots), then Add to Home screen or Install app.",
    "iPhone: Open the link in Safari, tap Share, then Add to Home Screen and Add.",
  ].join("\n");
}

export function bgmEmailFooterHtml() {
  return `<footer style="margin-top:32px;border-top:1px solid #e4e4e7;padding-top:24px">
    <div style="background-color:#ffffff;padding:12px 0 18px;text-align:center">
      <img src="${BGM_LOGO_URL}" alt="BestGymsMalta" width="300" height="36" style="display:block;width:300px;max-width:100%;height:auto;margin:0 auto 12px;border:0" />
      <div style="color:#18181b;font-size:13px;font-weight:700">Be the best… Beat the rest.</div>
    </div>
    <p style="margin:12px 0 8px;font-size:13px;font-weight:700;color:#3f3f46">This is an automated email. Please do not reply.</p>
    <p style="margin:0;font-size:13px;color:#52525b">For any questions or assistance, contact <a href="mailto:${BGM_CONTACT_EMAIL}" style="color:#b45309;text-decoration:underline">${BGM_CONTACT_EMAIL}</a>.</p>
  </footer>`;
}
