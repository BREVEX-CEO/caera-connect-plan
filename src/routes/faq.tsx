import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";

/**
 * Public FAQ.
 *
 * Answers only describe behaviour that exists today. Where a capability is
 * still provider- or platform-dependent, the answer says so rather than
 * implying it already works.
 */
type Faq = { q: string; a: string };

const GROUPS: { title: string; items: Faq[] }[] = [
  {
    title: "Account and sign-in",
    items: [
      {
        q: "How do I sign in?",
        a: "You can sign in with Google, with a phone or email one-time code, or with an email and password. All methods lead to the same account, provided they use the same verified email address.",
      },
      {
        q: "I forgot my password. What now?",
        a: "Use “Forgot password?” on the sign-in screen. We send a secure reset link to your email address; the link opens the reset screen, where you choose a new password.",
      },
      {
        q: "Google sign-in failed or I cancelled it. Is something broken?",
        a: "No. Cancelling the Google window simply returns you to the sign-in screen with a plain-language explanation. If sign-in fails repeatedly, the message on screen tells you whether it was a cancellation, a blocked pop-up or a temporary rate limit.",
      },
    ],
  },
  {
    title: "Sync across devices",
    items: [
      {
        q: "Do my chats appear on my phone and my computer?",
        a: "Yes, when the data class is set to Private Sync. Conversations are stored against your account, so signing in on another device brings the same history, projects and settings with you.",
      },
      {
        q: "What is Browser Only mode?",
        a: "Browser Only keeps that data class in encrypted storage on the current device and never sends it to the cloud. It is genuinely private, and the trade-off is real: that data does not follow you to another device, and clearing browser storage removes it.",
      },
      {
        q: "How many devices can I use?",
        a: "A normal account allows two desktop devices and two mobile devices at a time. You can name, approve, revoke and replace devices in Settings → Devices.",
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
        a: "Cards are supported everywhere our payment provider operates. UPI appears at checkout when your region and currency are eligible; if it is hidden, the payment methods panel in Settings → Billing explains exactly why.",
      },
      {
        q: "How do I change or cancel my plan?",
        a: "Open Settings → Billing. Your current plan, renewal state and payment history are shown there, along with the actions to switch plan or cancel. Cancellation keeps access until the end of the paid period.",
      },
      {
        q: "My payment succeeded but the plan has not changed yet.",
        a: "The plan state updates when the provider’s confirmation reaches us, usually within seconds. The post-checkout screen waits for that confirmation instead of guessing; if it times out, your payment is still recorded and the plan updates once the confirmation arrives.",
      },
    ],
  },
  {
    title: "Technical and privacy",
    items: [
      {
        q: "Who is OCADE?",
        a: "OCADE is the assistant built by CAERA CADANE. It answers as OCADE by CAERA CADANE. If you ask directly which engine is running a request, it tells you truthfully, and the technical detail lives in the model settings.",
      },
      {
        q: "Can OCADE control my computer?",
        a: "Only what you permit, and only what the current environment genuinely allows. In the browser it can act on browser features you approve. Operating-system control requires the native companion; until that is connected, the app says so rather than pretending an action happened.",
      },
      {
        q: "Can I delete my account and data?",
        a: "Yes. Settings → Account has a Delete account action. It removes your profile, conversations and messages, support tickets and account records, then deletes the sign-in identity itself. The action cannot be undone.",
      },
    ],
  },
];

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — CAERA CADANE" },
      {
        name: "description",
        content:
          "Answers about accounts, cross-device sync, billing, privacy modes and account deletion in CAERA CADANE.",
      },
      { property: "og:title", content: "FAQ — CAERA CADANE" },
      {
        property: "og:description",
        content: "Common questions about accounts, sync, billing and privacy in CAERA CADANE.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: GROUPS.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    ),
  };

  return (
    <PublicPage
      eyebrow="Help centre"
      title="Frequently asked questions"
      summary="Short answers about accounts, syncing between devices, billing and how your data is handled. If something here does not cover your case, the support form reaches a person."
      structuredData={structuredData}
    >
      {GROUPS.map((group) => (
        <section key={group.title}>
          <h2 className="text-xl font-semibold tracking-tight">{group.title}</h2>
          <div className="mt-3 divide-y divide-white/7 overflow-hidden rounded-2xl border border-white/7 bg-white/[0.018]">
            {group.items.map((item) => (
              <FaqRow key={item.q} item={item} />
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-2xl border border-white/7 bg-white/[0.018] p-5">
        <h2 className="text-lg font-semibold tracking-tight">Still stuck?</h2>
        <p className="mt-2 text-muted-foreground">
          Open a support case and it lands in our queue with your account attached.
        </p>
        <Link
          to="/settings/support"
          className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Contact support
        </Link>
      </section>
    </PublicPage>
  );
}

function FaqRow({ item }: { item: Faq }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-[14px] font-medium text-foreground transition-colors hover:bg-white/[0.03]"
        >
          <span>{item.q}</span>
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h3>
      {open ? <p className="px-4 pb-4 text-muted-foreground">{item.a}</p> : null}
    </div>
  );
}
