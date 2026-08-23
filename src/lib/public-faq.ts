export type Faq = { q: string; a: string };
export type FaqGroup = { title: string; items: Faq[] };

export const FAQ_GROUPS: FaqGroup[] = [
  {
    title: "Account and sign-in",
    items: [
      {
        q: "How do I sign in?",
        a: "OCADE supports Google, phone or email one-time codes, and email with password when the production identity service is connected. If that service is unavailable or misconfigured, sign-in fails closed and says which configuration is missing.",
      },
      {
        q: "I forgot my password. What now?",
        a: "Use “Forgot password?” on the sign-in screen. When production email delivery is configured, the identity service sends a reset link. OCADE never claims that a message was delivered unless the provider accepts the request.",
      },
      {
        q: "Google sign-in failed or I cancelled it. Is something broken?",
        a: "Cancelling the Google window returns you to sign-in without creating a session. A failure can also mean a blocked pop-up, rate limit or incomplete production configuration; OCADE shows the available cause instead of silently treating it as success.",
      },
    ],
  },
  {
    title: "Sync across devices",
    items: [
      {
        q: "Do my chats appear on my phone and my computer?",
        a: "Private Sync is designed to carry conversations across signed-in devices, but only when the verified production data service is connected. Browser Only and PC Vault remain device-local. OCADE does not present an unverified or wrong backend as successful sync.",
      },
      {
        q: "What is Browser Only mode?",
        a: "Browser Only keeps that data class in encrypted storage on the current device and never sends it to the cloud. It is genuinely private, and the trade-off is real: that data does not follow you to another device, and clearing browser storage removes it.",
      },
      {
        q: "How many devices can I use?",
        a: "The current product policy allows two desktop and two mobile device records per account. You can name, approve and revoke them in Settings → Devices when Private Sync is connected; device-local modes do not pretend to update another device.",
      },
      {
        q: "Something is missing on my second device.",
        a: "Check the privacy mode for that data class in Settings → Privacy. Anything marked Browser Only stays on the device that created it, by design.",
      },
    ],
  },
  {
    title: "Billing and plans",
    items: [
      {
        q: "Which payment methods can I use?",
        a: "None are active during free launch. The pricing page shows the planned card, UPI and PayPal pathways for transparency, but checkout remains locked until provider, legal and production-account verification is complete.",
      },
      {
        q: "How do I change or cancel my plan?",
        a: "There is no paid plan to change or cancel during free launch. Settings → Billing shows readiness and planned plan controls, but it cannot create, renew or cancel a paid entitlement while payment authority is locked.",
      },
      {
        q: "My payment succeeded but the plan has not changed yet.",
        a: "OCADE cannot accept a live payment during free launch. If you are seeing a payment claim now, do not retry or send credentials; contact support with the provider receipt. Future entitlement changes must wait for a verified signed provider event rather than trusting the browser redirect.",
      },
    ],
  },
  {
    title: "Technical and privacy",
    items: [
      {
        q: "Who is OCADE?",
        a: "OCADE is the assistant built by CARCC CADANE. It answers as OCADE by CARCC CADANE. If you ask directly which engine is running a request, it tells you truthfully, and the technical detail lives in the model settings.",
      },
      {
        q: "Can OCADE control my computer?",
        a: "Only what you permit, and only what the current environment genuinely allows. In the browser it can act through the OCADE extension you approve. Operating-system control requires the native companion; until that is connected, the app says so rather than pretending an action happened.",
      },
      {
        q: "Can I delete my account and data?",
        a: "Settings → Account provides the deletion control. It removes device-local OCADE data directly and asks the connected production service to delete account-held records and the sign-in identity. OCADE reports completion only after that service returns a verified result; otherwise it tells you what remains.",
      },
    ],
  },
];

export function filterFaqGroups(groups: FaqGroup[], query: string): FaqGroup[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return groups;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${group.title} ${item.q} ${item.a}`.toLocaleLowerCase().includes(needle),
      ),
    }))
    .filter((group) => group.items.length > 0);
}
