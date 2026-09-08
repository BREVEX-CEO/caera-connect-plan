import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Notice, PublicPage, PublicSection } from "@/components/public/PublicPage";

export const Route = createFileRoute("/data-rights")({
  head: () => ({
    meta: [
      { title: "Data-rights request builder — OCADE" },
      { name: "description", content: "Prepare a privacy or data-rights request for OCADE." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DataRightsPage,
});

function DataRightsPage() {
  const [requestType, setRequestType] = useState("Access my data");
  const [account, setAccount] = useState("");
  const [details, setDetails] = useState("");
  const [copied, setCopied] = useState(false);
  const requestText = useMemo(
    () =>
      [
        "OCADE data-rights request",
        `Request: ${requestType}`,
        `Account reference: ${account.trim() || "[add the email or account ID used with OCADE]"}`,
        `Details: ${details.trim() || "[describe the data, correction, deletion, consent or grievance]"}`,
        "Preferred response channel: [add a safe email address]",
        "Country/region: [add your country or region]",
        "Please explain any identity verification needed before I send sensitive documents.",
      ].join("\n"),
    [account, details, requestType],
  );

  /*
   * A CLIPBOARD WRITE IS A PERMISSION, NOT A CERTAINTY.
   *
   * `writeText` rejects when the document is not focused, when the browser has
   * not granted clipboard-write, and in most browsers when it is called
   * anywhere other than from a real user gesture. The unhandled version turned
   * "Copied" on regardless, so somebody would go and paste an empty clipboard
   * into an email to a regulator. Saying it failed, and leaving the text on
   * screen to select by hand, is the difference.
   */
  const [copyFailed, setCopyFailed] = useState(false);

  async function copyRequest() {
    try {
      await navigator.clipboard.writeText(requestText);
      setCopyFailed(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  return (
    <PublicPage
      eyebrow="Private request preparation"
      title="Data-rights request builder"
      summary="Prepare a request without uploading identity documents or personal data to this website. Nothing entered here is transmitted or saved by this page."
    >
      <Notice>
        This page prepares your request; it does not send it. Nothing you type here leaves your
        browser. Copy the finished text and send it yourself when you are ready.
      </Notice>
      <PublicSection title="Prepare your request">
        <div className="space-y-4 rounded-lg border border-border/60 p-5">
          <label className="block">
            <span className="font-medium text-foreground">Request type</span>
            <select
              value={requestType}
              onChange={(event) => setRequestType(event.target.value)}
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            >
              <option>Access my data</option>
              <option>Correct my data</option>
              <option>Delete my data</option>
              <option>Withdraw consent</option>
              <option>Raise a privacy grievance</option>
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-foreground">Account reference</span>
            <input
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder="Email or OCADE account ID"
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </label>
          <label className="block">
            <span className="font-medium text-foreground">Request details</span>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={5}
              placeholder="Describe what you want OCADE to access, correct, delete or review."
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </label>
          <button
            type="button"
            onClick={copyRequest}
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
          >
            {copied ? "Copied" : "Copy request text"}
          </button>
          {copyFailed ? (
            <p role="alert" className="text-sm text-destructive">
              This browser would not let the page write to your clipboard. Select the text above and
              copy it yourself — nothing has been lost.
            </p>
          ) : null}
        </div>
      </PublicSection>
      <PublicSection title="Before sending">
        <p>
          Do not send Aadhaar, PAN, passwords, payment credentials or one-time codes. The final
          launch process must publish a working privacy/grievance contact, acknowledgement deadline,
          verification method, decision log and appeal/escalation path. Until then, retain the
          copied text safely and do not treat it as submitted.
        </p>
      </PublicSection>
    </PublicPage>
  );
}
