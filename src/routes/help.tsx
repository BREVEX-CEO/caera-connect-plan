import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PublicPage } from "@/components/shell/PublicPage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/help")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://ocade.in/help" }],
    meta: [
      { title: "Help — OCADE" },
      {
        name: "description",
        content: "Answers about OCADE Chat, JARVIS, billing and privacy.",
      },
    ],
  }),
  component: HelpPage,
});

/**
 * Help replaces a support centre of thirty-odd articles, a search index, a
 * feedback widget and an admin publishing pipeline.
 *
 * The product has four destinations. What a person needs from Help is short,
 * fits on one page, and is answered here rather than retrieved. The accordion
 * is the one place in OCADE that has one — `docs/JARVIS_DESIGN_SYSTEM.md`
 * allows it on Help and nowhere else.
 */
const CATEGORIES = [
  "Getting started",
  "Chat",
  "JARVIS",
  "Mobile",
  "Billing",
  "Privacy & security",
  "Troubleshooting",
] as const;
type Category = (typeof CATEGORIES)[number];

/** `words` is what search reads, so an answer is found by what it says. */
const QUESTIONS: {
  category: Category;
  question: string;
  words: string;
  answer: React.ReactNode;
}[] = [
  {
    category: "Getting started",
    question: "What is OCADE?",
    words: "chat jarvis library",
    answer: (
      <p>
        OCADE by CARCC is an AI product for conversation in Chat. JARVIS, its task assistant, is
        being rebuilt. Library holds the files and images you upload and the ones OCADE produces.
      </p>
    ),
  },
  {
    category: "Getting started",
    question: "Do I need an account?",
    words: "sign up look around",
    answer: (
      <p>
        You can look around without one. Sending a message needs an account, because every answer
        counts against your allowance and that allowance belongs to an account rather than to a
        browser.
      </p>
    ),
  },
  {
    category: "Getting started",
    question: "How do I sign in?",
    words: "google email code password",
    answer: (
      <p>
        Continue with Google, or use a six-digit code sent to your email address. There is no
        password to remember unless you choose to add one.
      </p>
    ),
  },
  {
    category: "Chat",
    question: "What do Auto, Online and Offline mean?",
    words: "mode online offline auto",
    answer: (
      <p>
        <strong className="text-foreground">Auto</strong> picks for you.{" "}
        <strong className="text-foreground">Online</strong> answers over the network.{" "}
        <strong className="text-foreground">Offline</strong> works out the answer on your own
        device: your question is not sent to any AI provider. The chat itself is still saved to your
        account like any other, unless you turn on a temporary chat.
      </p>
    ),
  },
  {
    category: "Chat",
    question: "Does an offline chat leave my device?",
    words: "offline privacy temporary",
    answer: (
      <p>
        The thinking does not — an offline answer is produced by the model installed in your
        browser, and nothing about the question is sent to an AI provider. Saving is separate:
        unless the chat is temporary, the question and the answer are stored in your account so you
        can read them on your other devices, and a file you attach goes to your Library. Turn on a
        temporary chat and none of that is written anywhere.
      </p>
    ),
  },
  {
    category: "Chat",
    question: "What is Offline Intelligence?",
    words: "offline install model",
    answer: (
      <p>
        OCADE prepares itself to answer on your device the first time you use Chat on supported
        hardware. It installs once and is reused afterwards — a refresh, a new sign-in or an OCADE
        update does not prepare it again. You can remove it at any time from Settings.
      </p>
    ),
  },
  {
    category: "Chat",
    question: "Are there keyboard shortcuts?",
    words: "keyboard shortcut new chat",
    answer: (
      <p>
        Two. Press <kbd>/</kbd> to put the cursor in the composer, and <kbd>Ctrl</kbd> or{" "}
        <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd> to start a new chat. Typing always wins:
        neither does anything while you are writing in a field.
      </p>
    ),
  },
  {
    category: "JARVIS",
    question: "Where is JARVIS?",
    words: "jarvis task computer device unavailable rebuilt",
    answer: (
      <p>
        OCADE JARVIS is being rebuilt and cannot take requests right now. Your past JARVIS
        conversations stay readable on the JARVIS page, and you can delete them there.
      </p>
    ),
  },
  {
    category: "Mobile",
    question: "Can I use OCADE on my phone?",
    words: "iphone ipad home screen pwa bubble floating shortcut siri",
    answer: (
      <>
        <p>Yes, in the browser. Add OCADE to your home screen to open it like an app.</p>
        <p className="mt-2">
          On a phone, a small JARVIS bubble floats over OCADE's pages. Drag it to either edge or tap
          it to open JARVIS. It stays inside OCADE, not over other apps. Hide it from the bubble;
          Settings › Appearance brings it back.
        </p>
        <p className="mt-2">
          To open JARVIS from a shortcut, for example with Open URL in the iPhone Shortcuts app
          (which Siri can run by its name), use ocade.in/ocade-jarvis. Add ?ask= followed by your
          words to have them ready in the box.
        </p>
      </>
    ),
  },
  {
    category: "Mobile",
    question: "Can OCADE notify me when it is closed?",
    words: "notification push alert reminder phone closed browser",
    answer: (
      <p>
        Yes. Open Settings › Notifications and turn on “On this device” in each browser you want
        alerts in; your browser asks once. Security alerts always arrive; other kinds arrive when
        that kind is on. On iPhone and iPad, Apple shows them only for OCADE opened from the Home
        Screen. Signing out stops them in that browser.
      </p>
    ),
  },
  {
    category: "Billing",
    question: "How many requests do I get?",
    words: "free plan limit 28 reset",
    answer: (
      <p>
        A free account has 28 successful requests in each 6 hour 28 minute window, shared across
        every device you sign in on. One request you make counts once, however much work it takes
        OCADE to answer it.
      </p>
    ),
  },
  {
    category: "Billing",
    question: "Can I buy Pro or Max?",
    words: "pro max upgrade pay price",
    answer: (
      <p>
        Plans and prices are on the <Link to="/pricing">Pricing</Link> page. Paid checkout is not
        open yet, and nothing is ever charged without it.
      </p>
    ),
  },
  {
    category: "Privacy & security",
    question: "What is two-step verification, and what if I lose my phone?",
    words: "two step 2fa authenticator code recovery codes lost phone locked out",
    answer: (
      <p>
        Turn it on in Settings, under Account: signing in then also asks for a code from your
        authenticator app, so a stolen password alone cannot reach your account. When you turn it
        on, OCADE shows ten recovery codes once. Save them somewhere other than your phone. If you
        lose the phone, choose “I lost my authenticator” on the code screen and enter one: it turns
        two-step verification off and signs you out everywhere, then you sign in and set it up
        again. Each code works once, and you can make a new set in Settings at any time.
      </p>
    ),
  },
  {
    category: "Privacy & security",
    question: "Where is my data kept?",
    words: "data storage export delete",
    answer: (
      <p>
        Your chats, files and settings are stored in your account. Only the offline model itself is
        kept in the browser. Data Controls in Settings can delete your conversations, delete your
        uploaded files and images, and export your account data.
      </p>
    ),
  },
  {
    category: "Privacy & security",
    question: "How do I delete my account?",
    words: "delete account close",
    answer: (
      <p>
        Open Settings from your account menu and use Account, where “Delete your account” asks you
        to type the confirmation. Data Controls is next door and deletes your conversations or your
        files without closing the account. Deletion removes your account content; see the{" "}
        <Link to="/privacy">Privacy Policy</Link> for what is kept and for how long.
      </p>
    ),
  },
  {
    category: "Privacy & security",
    question: "How do I contact OCADE?",
    words: "contact support email grievance privacy request ticket",
    answer: (
      <p>
        Dedicated support, privacy, security and grievance email addresses are not published yet:
        OCADE publishes an address only once it is activated and verified, and this answer will name
        it then. Until then, what you can do for your own account is in Settings: download a copy of
        your data, delete conversations, files or the whole account, and sign out every session.
      </p>
    ),
  },
  {
    category: "Troubleshooting",
    question: "Voice does not start",
    words: "voice microphone permission speech",
    answer: (
      <p>
        Allow the microphone for ocade.in in your browser's site settings and press Voice again. If
        your browser cannot recognise speech, you can still type; if it cannot speak, answers stay
        as text.
      </p>
    ),
  },
];

/** The words an answer shows, so search finds guidance by what it actually says. */
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  const props = (node as { props?: { children?: React.ReactNode } }).props;
  return props ? textOf(props.children) : "";
}

const SEARCHED = QUESTIONS.map((entry) =>
  `${entry.question} ${entry.words} ${entry.category} ${textOf(entry.answer)}`.toLowerCase(),
);

function HelpPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const words = query.trim().toLowerCase();
  const shown = QUESTIONS.filter(
    (entry, at) =>
      (!category || entry.category === category) && (!words || SEARCHED[at]!.includes(words)),
  );
  return (
    <PublicPage title="Help" intro="Short answers, in plain words." backToTop>
      <label htmlFor="help-search" className="sr-only">
        Search Help
      </label>
      <input
        id="help-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search Help"
        className="h-11 w-full rounded-xl border border-border/70 bg-transparent px-4 text-sm outline-none focus-visible:border-foreground/40"
      />
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Topics">
        {CATEGORIES.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={category === name}
            onClick={() => setCategory((current) => (current === name ? null : name))}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              category === name
                ? "border-foreground bg-foreground text-background"
                : "border-border/70 text-muted-foreground hover:text-foreground",
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="mt-6 divide-y divide-border/50 border-y border-border/50">
        {shown.map((entry) => (
          <Faq key={entry.question} question={entry.question}>
            {entry.answer}
          </Faq>
        ))}
        {shown.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Nothing matches that. Try fewer words.
          </p>
        ) : null}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Still stuck? &ldquo;How do I contact OCADE?&rdquo; above says what is available today. The{" "}
        <Link to="/terms">Terms &amp; Conditions</Link> and{" "}
        <Link to="/privacy">Privacy Policy</Link> carry the formal answers.
      </p>
    </PublicPage>
  );
}

function Faq({ question, children }: { question: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-3.5 text-left text-sm text-foreground"
      >
        {question}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="pb-4 text-sm leading-6 text-muted-foreground [&_a]:text-foreground [&_a]:underline">
          {children}
        </div>
      ) : null}
    </div>
  );
}
