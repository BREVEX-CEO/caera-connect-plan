export function PrelaunchSubscription() {
  return (
    <aside
      className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-5"
      aria-labelledby="updates-title"
    >
      <h2 id="updates-title" className="text-lg font-semibold text-foreground">
        Product updates
      </h2>
      <p id="subscription-unavailable-reason" className="mt-2 text-sm text-muted-foreground">
        Email subscription is not accepting addresses yet because the correct production data
        project and delivery provider are not verified. No address entered here would be stored or
        sent.
      </p>
      <label className="mt-4 block text-xs text-muted-foreground">
        Email address
        <input
          type="email"
          disabled
          aria-describedby="subscription-unavailable-reason"
          placeholder="Subscriptions open after verification"
          className="mt-1 min-h-10 w-full rounded-lg border border-border/70 bg-background/50 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>
      <button
        type="button"
        disabled
        aria-describedby="subscription-unavailable-reason"
        className="mt-3 min-h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-55"
      >
        Subscribe when available
      </button>
    </aside>
  );
}
