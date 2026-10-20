import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PublicPage } from "@/components/shell/PublicPage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help — OCADE" },
      {
        name: "description",
        content: "Answers about OCADE Chat, JARVIS, devices, billing and privacy.",
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
 * is the one place in OCADE that has one — `docs/UI_REFERENCE_CHECKLIST.md`
 * allows it on Help and nowhere else.
 */
const CATEGORIES = [
  "Getting started",
  "Chat",
  "JARVIS",
  "Devices",
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
        OCADE by CARCC is an AI product with two places to work: Chat, for conversation, and JARVIS,
        which answers questions and does things on your computer or in your browser when you ask it
        to. Library holds the files and images you upload and the ones OCADE produces.
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
        update does not prepare it again. You can remove it at any time from Settings. JARVIS works
        online only and never starts this download.
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
    question: "What can JARVIS do?",
    words: "task browser computer files apps",
    answer: (
      <p>
        Ask it anything and it answers. Ask it to do something — open a site, fill in a form, write
        a file, open an app — and it works on a computer or browser you connected, one step at a
        time, looking at the result after each step. You see what it is doing, and you can take over
        or stop at any moment.
      </p>
    ),
  },
  {
    category: "JARVIS",
    question: "How do Stop and Take Over work?",
    words: "stop take over pause resume continue",
    answer: (
      <p>
        <strong className="text-foreground">Stop</strong> requests cancellation. Once OCADE records
        the stop, it sends no further steps. A disconnected computer may not receive it immediately.
        JARVIS says “Stopped” once the running step is confirmed stopped; changes already made may
        remain. If the computer is offline, use STOP JARVIS in its tray and check the result before
        retrying. <strong className="text-foreground">Take Over</strong> pauses JARVIS and hands the
        screen to you; press Resume when you are done and it continues from a fresh look at the
        page. Using your own mouse or keyboard also pauses it, unless you turned on Co-work for that
        computer.
      </p>
    ),
  },
  {
    category: "JARVIS",
    question: "When does JARVIS ask me first?",
    words: "confirm permission purchase payment delete",
    answer: (
      <p>
        Before anything hard to undo or sensitive: deleting permanently, changing the system,
        opening an app set to Ask, submitting a payment, legal, medical or security form, or posting
        publicly. JARVIS never completes a purchase, never reads saved passwords, and hands CAPTCHA,
        one-time codes and passkeys to you.
      </p>
    ),
  },
  {
    category: "JARVIS",
    question: "Does JARVIS use my Chat allowance?",
    words: "usage allowance limit uses",
    answer: (
      <p>
        No. JARVIS has its own allowance on the same plan. Each step that produced an answer or an
        action counts once; a step that failed or produced nothing is not charged.
      </p>
    ),
  },
  {
    category: "Devices",
    question: "How do I connect my computer?",
    words: "device agent install connect pair windows mac",
    answer: (
      <p>
        Start the OCADE Device Agent on the computer. It opens OCADE so you can confirm the computer
        with one click — no codes or passwords. Check that the fingerprint OCADE shows matches the
        one the computer shows. Each computer gets its own key, and Remove in Devices ends its
        access at once.
      </p>
    ),
  },
  {
    category: "Devices",
    question: "Why is “Run commands” unavailable?",
    words: "terminal command unavailable windows mac",
    answer: (
      <p>
        JARVIS runs commands only where your computer can keep them inside the one folder you chose.
        Until that is proven on Windows and macOS, JARVIS uses file and app actions there instead,
        and the switch says it is not available rather than pretending.
      </p>
    ),
  },
  {
    category: "Devices",
    question: "Can JARVIS work in my own browser?",
    words: "chrome own browser tabs sign-ins extension add-on",
    answer: (
      <p>
        Yes, with no add-on. On a computer with the OCADE Device Agent, turn on “Use my own browser”
        for it under JARVIS › Devices. The first time, JARVIS opens your browser’s own permission
        page: turn the permission on and choose Allow when your browser asks, then press Continue.
        JARVIS then works with your own sign-ins, only in tabs it opens itself, and leaves your
        other tabs alone. Without it, JARVIS uses a separate browser of its own on that computer.
      </p>
    ),
  },
  {
    category: "Mobile",
    question: "Can I use OCADE on my phone?",
    words: "android iphone ipad home screen pwa bubble floating shortcut siri",
    answer: (
      <>
        <p>
          Yes, in the browser. Add OCADE to your home screen to open it like an app. From your phone
          you can start, watch and stop work on a computer you connected, under Devices. The website
          does not control a phone's own apps; on Android, the OCADE app connects the phone to
          JARVIS as a device of its own, with the bubble over other apps.
        </p>
        <p className="mt-2">
          On a phone, a small JARVIS bubble floats over OCADE's pages. Drag it to either edge, tap
          it for the current task, Stop, or a quick question. It stays inside OCADE, not over other
          apps. Hide it from the bubble; Settings › Appearance brings it back.
        </p>
        <p className="mt-2">
          To open JARVIS from a shortcut, for example with Open URL in the iPhone Shortcuts app
          (which Siri can run by its name), use ocade.in/ocade-jarvis. Add ?voice=1 to start
          listening, or ?ask= followed by your words to have them ready in the box; JARVIS waits for
          you to press Send.
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
        alerts in; your browser asks once. Security alerts always arrive; JARVIS results and
        reminders arrive when that kind is on. On iPhone and iPad, Apple shows them only for OCADE
        opened from the Home Screen. Signing out stops them in that browser.
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
        every device you sign in on. JARVIS has its own allowance on the same plan. One request you
        make counts once, however much work it takes OCADE to answer it.
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
    question: "What does JARVIS send to OCADE?",
    words: "jarvis privacy screenshots page content",
    answer: (
      <p>
        While a task you started runs, what JARVIS needs for it: the page or window it works in, its
        address and title, screenshots for the live view, and each step's result. Detailed activity
        is kept for 90 days. The <Link to="/privacy">Privacy Policy</Link> explains it in full.
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
    category: "Troubleshooting",
    question: "JARVIS says no computer is online",
    words: "no device offline not online",
    answer: (
      <p>
        Start the OCADE Device Agent on your computer and keep it signed in, then ask again. If
        several computers are online, choose one in Devices. A computer shows Ready when it can work
        and Needs permission when every kind of work is turned off for it.
      </p>
    ),
  },
  {
    category: "Troubleshooting",
    question: "“Stop not confirmed”",
    words: "stop confirm computer offline",
    answer: (
      <p>
        OCADE recorded the stop, but could not confirm that the running step ended on your computer.
        It may be asleep or disconnected. No further steps are sent; use STOP JARVIS in the OCADE
        tray on that computer. A change already made may remain, so check the app or file before
        retrying. Reconnecting alone does not prove that the earlier step stopped or was undone.
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
