import { useState } from "react";
import {
  ANSWER_LANGUAGES,
  readAnswerLanguage,
  saveAnswerLanguage,
  type AnswerLanguage as Language,
} from "@/lib/chat/answer-language";
import { useSession } from "@/lib/session";
import { Row } from "./rows";

/** Preferences > Answer language: what Chat answers in. OCADE's screens stay in English. */
export function AnswerLanguage() {
  const { user } = useSession();
  const account = user?.id ?? "";
  return <AnswerLanguageSelect key={account} account={account} />;
}

function AnswerLanguageSelect({ account }: { account: string }) {
  const [language, setLanguage] = useState<Language>(() => readAnswerLanguage(account));
  return (
    <Row
      label="Answer language"
      description="The language Chat answers in. Automatic answers in the language you write. OCADE's own screens are in English."
    >
      <select
        aria-label="Answer language"
        value={language}
        disabled={!account}
        onChange={(event) => {
          const next = event.target.value as Language;
          setLanguage(next);
          saveAnswerLanguage(account, next);
        }}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
      >
        {ANSWER_LANGUAGES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Row>
  );
}
