import { useState } from "react";
import { civilDate } from "@/lib/jarvis/lifeos";
import {
  assessJobListing,
  jobApplicationDraft,
  OPPORTUNITY_TEXT_LIMIT,
  reviewJobListing,
  type JobListing,
} from "@/lib/jarvis/opportunity-engine";
import { taskObjective } from "@/lib/jarvis/objective";

const empty: JobListing = { title: "", url: "", deadline: "", requirements: "" };
const field = "min-h-11 w-full rounded-md border border-border bg-background px-2 text-sm";
const button = "min-h-11 rounded-md border border-border px-3 text-xs hover:bg-accent";

export function OpportunityEngine({ onPick }: { onPick: (draft: string) => void }) {
  const [profile, setProfile] = useState("");
  const [entry, setEntry] = useState(empty);
  const [listings, setListings] = useState<JobListing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const today = civilDate(new Date());

  return (
    <details className="rounded-xl border border-border/60 p-3 sm:col-span-2">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
        Opportunity Engine
      </summary>
      <div className="grid gap-3">
        <p className="text-xs text-muted-foreground">
          Compare jobs you bring. Only exact matches with your notes count. Review the draft in
          JARVIS before sending it.
        </p>
        <label className="grid gap-1 text-xs">
          Your skills or experience, one item per line
          <textarea
            className={field}
            rows={3}
            value={profile}
            maxLength={OPPORTUNITY_TEXT_LIMIT}
            onChange={(event) => setProfile(event.target.value)}
          />
        </label>
        <form
          className="grid gap-3 rounded-lg border border-border/60 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const reviewed = reviewJobListing(entry, new Set(listings.map((item) => item.url)));
            if ("error" in reviewed) {
              setError(reviewed.error ?? null);
              return;
            }
            setListings((previous) => [...previous, reviewed.listing]);
            setEntry(empty);
            setError(null);
            setFeedback(`Added ${reviewed.listing.title}.`);
          }}
        >
          <label className="grid gap-1 text-xs">
            Job title
            <input
              className={field}
              required
              maxLength={120}
              value={entry.title}
              onChange={(event) => setEntry({ ...entry, title: event.target.value })}
            />
          </label>
          <label className="grid gap-1 text-xs">
            Exact link to the listing
            <input
              className={field}
              type="url"
              required
              maxLength={500}
              value={entry.url}
              onChange={(event) => setEntry({ ...entry, url: event.target.value })}
            />
          </label>
          <label className="grid gap-1 text-xs">
            Deadline, if known
            <input
              className={field}
              type="date"
              value={entry.deadline}
              onChange={(event) => setEntry({ ...entry, deadline: event.target.value })}
            />
          </label>
          <label className="grid gap-1 text-xs">
            Requirements from the listing, one per line
            <textarea
              className={field}
              rows={3}
              required
              maxLength={OPPORTUNITY_TEXT_LIMIT}
              value={entry.requirements}
              onChange={(event) => setEntry({ ...entry, requirements: event.target.value })}
            />
          </label>
          <button className={`${button} justify-self-start`} type="submit">
            Compare listing
          </button>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </form>
        <p className="text-xs" role="status">
          {feedback}
        </p>
        {listings.length ? (
          <ul className="grid gap-2">
            {listings.map((listing) => {
              const review = assessJobListing(listing, profile, today);
              const match = review.requirements.some((item) => item.selfReported);
              return (
                <li
                  className="grid gap-2 rounded-lg border border-border p-3 text-xs [overflow-wrap:anywhere]"
                  key={listing.url}
                >
                  <strong className="text-sm">{listing.title}</strong>
                  <p>{listing.url}</p>
                  <p>
                    {listing.deadline ? `Listed deadline ${listing.deadline}` : "Deadline unknown"}
                  </p>
                  {review.expired ? <p>Past the deadline you entered.</p> : null}
                  <ul className="grid gap-1">
                    {review.requirements.map(({ requirement, selfReported }) => (
                      <li key={requirement}>
                        {requirement} —{" "}
                        {selfReported ? "matches your notes" : "no exact match in your notes"}
                      </li>
                    ))}
                    {review.warnings.map(({ sign, evidence }) => (
                      <li key={`${sign}:${evidence}`}>
                        Listing warning: {sign} ({evidence}).
                      </li>
                    ))}
                  </ul>
                  {!match ? (
                    <p>Add matching experience to your notes before preparing a draft.</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {!review.expired && !review.warnings.length && match ? (
                      <button
                        className={button}
                        type="button"
                        onClick={() => {
                          const draft = jobApplicationDraft(listing, profile, today);
                          const checked = taskObjective.safeParse(draft);
                          if (checked.success) onPick(checked.data);
                          else
                            setFeedback(
                              "That draft is too long. Shorten your notes and try again.",
                            );
                        }}
                      >
                        Review application draft
                      </button>
                    ) : null}
                    <button
                      className={button}
                      type="button"
                      aria-label={`Remove ${listing.title}`}
                      onClick={() => {
                        setListings((previous) =>
                          previous.filter((item) => item.url !== listing.url),
                        );
                        setFeedback(`Removed ${listing.title}.`);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </details>
  );
}
