/**
 * Shared transactional email footer. Uses the official logo already hosted by the
 * member app; email clients that block images still see the text branding.
 */
export const BGM_CONTACT_EMAIL = "info@bestgymsmalta.com";
export const BGM_LOGO_URL =
  "https://bestgymsmalta-member-platform.vercel.app/brand/bgm-logo-white-horizontal.png";

export function bgmEmailFooterText() {
  return [
    "BestGymsMalta - Be the best... Beat the rest.",
    "",
    "This is an automated email. Please do not reply.",
    `For any questions or assistance, contact ${BGM_CONTACT_EMAIL}.`,
  ].join("\n");
}

export function bgmEmailFooterHtml() {
  return `<footer style="margin-top:32px;border-top:1px solid #e4e4e7;padding-top:24px">
    <div style="background:#18181b;padding:20px;text-align:center;border-radius:8px">
      <img src="${BGM_LOGO_URL}" alt="BestGymsMalta" width="220" style="display:block;max-width:100%;height:auto;margin:0 auto 10px" />
      <div style="color:#ffffff;font-size:13px;font-weight:600">Be the best… Beat the rest.</div>
    </div>
    <p style="margin:20px 0 8px;font-size:13px;font-weight:700;color:#3f3f46">This is an automated email. Please do not reply.</p>
    <p style="margin:0;font-size:13px;color:#52525b">For any questions or assistance, contact <a href="mailto:${BGM_CONTACT_EMAIL}" style="color:#b45309;text-decoration:underline">${BGM_CONTACT_EMAIL}</a>.</p>
  </footer>`;
}
