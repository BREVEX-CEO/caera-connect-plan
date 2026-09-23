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
        content: "Answers to the questions people actually ask about OCADE.",
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
const QUESTIONS: { question: string; answer: React.ReactNode }[] = [
  {
    question: "What is OCADE?",
    answer: (
      <p>
        OCADE by CARCC is an AI chat product. Chat is the home, and Library holds the files and
        images you upload and the ones OCADE produces.
      </p>
    ),
  },
  {
    question: "Do I need an account?",
    answer: (
      <p>
        You can look around without one. Sending a message needs an account, because every answer
        counts against your allowance and that allowance belongs to an account rather than to a
        browser.
      </p>
    ),
  },
  {
    question: "How do I sign in?",
    answer: (
      <p>
        Continue with Google, or use a six-digit code sent to your email address. There is no
        password to remember unless you choose to add one.
      </p>
    ),
  },
  {
    question: "What does Auto, OCADE and Offline mean?",
    answer: (
      <p>
        <strong className="text-foreground">Auto</strong> picks for you.{" "}
        <strong className="text-foreground">OCADE</strong> answers over the network.{" "}
        <strong className="text-foreground">Offline</strong> works out the answer on your own
        device: your question is not sent to any AI provider. The chat itself is still saved to your
        account like any other, unless you turn on a temporary chat.
      </p>
    ),
  },
  {
    question: "Does an offline chat leave my device?",
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
    question: "What is Offline Intelligence?",
    answer: (
      <p>
        OCADE prepares itself to answer on your device the first time you visit on supported
        hardware. It installs once and is reused afterwards — a refresh, a new sign-in or an OCADE
        update does not prepare it again. You can remove it at any time from Settings.
      </p>
    ),
  },
  {
    question: "How many requests do I get?",
    answer: (
      <p>
        A free account has 28 successful requests in each 6 hour 28 minute window. The allowance is
        shared across every device you sign in on, and across online and offline answers. One
        request you make counts once, however much work it takes OCADE to answer it.
      </p>
    ),
  },
  {
    question: "Where is my data kept?",
    answer: (
      <p>
        Your chats, files and settings are stored in your account. Only the offline model itself is
        kept in the browser. Data Controls in Settings can delete your conversations, delete your
        uploaded files and images, and export your account data.
      </p>
    ),
  },
  {
    question: "Are there keyboard shortcuts?",
    answer: (
      <p>
        Two. Press <kbd>/</kbd> to put the cursor in the composer, and <kbd>Ctrl</kbd> or{" "}
        <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd> to start a new chat. Typing always wins:
        neither does anything while you are writing in a field.
      </p>
    ),
  },
  {
    question: "How do I delete my account?",
    answer: (
      <p>
        Open Settings from your account menu and use Account, where “Delete your account” asks you
        to type the confirmation. Data Controls is next door and deletes your conversations or your
        files without closing the account. Deletion removes your account content; see the{" "}
        <Link to="/privacy">Privacy Policy</Link> for what is kept and for how long.
      </p>
    ),
  },
];

function HelpPage() {
  return (
    <PublicPage
      title="Help"
      intro="Short answers to the questions people actually ask. Everything else is in Settings."
      backToTop
    >
      <div className="divide-y divide-border/50 border-y border-border/50">
        {QUESTIONS.map((entry) => (
          <Faq key={entry.question} question={entry.question}>
            {entry.answer}
          </Faq>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Still stuck? The <Link to="/terms">Terms &amp; Conditions</Link> and{" "}
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
