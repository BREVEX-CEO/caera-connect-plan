import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState, type FormEvent } from "react";
import {
  PRESETS,
  STATUS_TEXT,
  changeByok,
  readByok,
  setByokImages,
  readModels,
  type ByokConnection,
  type ByokModel,
  type ByokProtocol,
  type ByokState,
} from "@/lib/byok/connections";
import { Action, Confirm, Pending, Row, describeWhen } from "./rows";

/**
 * BYOK: THE PERSON'S OWN MODEL KEYS (plan 14B.1A.3-5, 14B.1B.4-6; UX-02/10/13/27/32/34).
 *
 * One question first (which source serves Chat, which serves JARVIS), then the connections, then
 * adding one: a provider preset, with the API address and protocol shown only for "Other". Every
 * state shown comes from the server (a test, or a model call); nothing here claims a connection
 * works before its test passed, and the remaining provider quota is shown as unknown because no
 * provider reports it to OCADE.
 */
export function ByokSection() {
  const client = useQueryClient();
  const state = useQuery({ queryKey: ["byok"], queryFn: readByok, staleTime: 0 });
  const refresh = () => client.invalidateQueries({ queryKey: ["byok"] });

  return (
    <div>
      <Pending
        query={state}
        loading="Reading your connections…"
        problem="Your connections could not be read. Nothing was changed."
      />
      {state.data ? (
        <>
          <Sources state={state.data} onChanged={refresh} />
          <p className="border-b border-border/50 py-4 text-[0.8125rem] leading-5 text-muted-foreground">
            With your key, your provider bills you directly for model use, and OCADE does not draw
            its own model allowance for those turns; your OCADE plan's limits still apply. Remaining
            provider quota: unknown (providers do not report it to OCADE). Used with your keys this
            month, as OCADE observed it: {state.data.observed.turns} turns,{" "}
            {state.data.observed.inputTokens.toLocaleString()} input and{" "}
            {state.data.observed.outputTokens.toLocaleString()} output tokens. If your key stops
            working, OCADE stops and tells you; it never switches to its own models on its own.
          </p>
          {state.data.connections.map((connection) => (
            <Connection key={connection.id} connection={connection} onChanged={refresh} />
          ))}
          <AddConnection count={state.data.connections.length} onChanged={refresh} />
        </>
      ) : null}
    </div>
  );
}

function Sources({ state, onChanged }: { state: ByokState; onChanged: () => void }) {
  const [problem, setProblem] = useState<string | null>(null);
  const choose = useMutation({
    mutationFn: (input: { surface: "chat" | "jarvis"; connectionId: string | null }) =>
      changeByok({ action: "choose", ...input }),
    onSuccess: () => {
      setProblem(null);
      onChanged();
    },
    onError: (error) => setProblem(error.message),
  });
  const select = (surface: "chat" | "jarvis") => {
    const usable = state.connections.filter(
      (connection) =>
        connection.enabled &&
        connection.status === "connected" &&
        (surface === "chat" || connection.calls_tools === true),
    );
    const chosen = state.choices[surface];
    const value = !(surface in state.choices) ? "" : (chosen ?? "deleted");
    return (
      <select
        aria-label={surface === "chat" ? "Model source for Chat" : "Model source for JARVIS"}
        className="h-8 max-w-[16rem] rounded-md border border-border bg-background px-2 text-sm"
        value={value}
        disabled={choose.isPending}
        onChange={(event) => choose.mutate({ surface, connectionId: event.target.value || null })}
      >
        <option value="">OCADE-managed</option>
        {value === "deleted" ? (
          <option value="deleted" disabled>
            Deleted connection — choose again
          </option>
        ) : null}
        {state.connections
          .filter((connection) => connection.id === chosen && !usable.includes(connection))
          .map((connection) => (
            <option key={connection.id} value={connection.id} disabled>
              Your key: {connection.alias} (
              {STATUS_TEXT[connection.status]?.label ?? connection.status})
            </option>
          ))}
        {usable.map((connection) => (
          <option key={connection.id} value={connection.id}>
            Your key: {connection.alias}
          </option>
        ))}
      </select>
    );
  };
  return (
    <>
      <Row label="Chat uses" description="Which models answer in Chat.">
        {select("chat")}
      </Row>
      <Row
        label="JARVIS uses"
        description="Which models plan tasks on your computer. A key must pass a tool-call test first."
      >
        {select("jarvis")}
      </Row>
      {problem ? (
        <p role="alert" className="pb-2 text-[0.8125rem] text-destructive">
          {problem}
        </p>
      ) : null}
    </>
  );
}

function Connection({
  connection,
  onChanged,
}: {
  connection: ByokConnection;
  onChanged: () => void;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [models, setModels] = useState(false);
  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      changeByok({ connectionId: connection.id, ...body }),
    onSuccess: () => {
      setProblem(null);
      setTesting(false);
      setDeleting(false);
      onChanged();
    },
    onError: (error) => setProblem(error.message),
  });
  // BYOK-07: off means this key's models are treated as unable to see; nothing visual is sent.
  const images = useMutation({
    mutationFn: (allowed: boolean) => setByokImages(connection.id, allowed),
    onSuccess: () => {
      setProblem(null);
      onChanged();
    },
    onError: (error) => setProblem(error.message),
  });
  const status = STATUS_TEXT[connection.status] ?? { label: connection.status };
  const sight =
    connection.sees_images === true
      ? "Sees images"
      : connection.sees_images === false
        ? "Limited model: cannot see images. OCADE will not let it act on what it cannot see."
        : "Image support unknown until tested";
  const tools =
    connection.calls_tools === true
      ? "Calls tools"
      : connection.calls_tools === false
        ? "Cannot call tools: Chat only"
        : null;
  return (
    <div className="border-b border-border/50 py-4">
      <Row
        label={connection.alias}
        description={
          <>
            <span className="block break-all">
              {connection.model} · {new URL(connection.endpoint).host} · key{" "}
              {connection.fingerprint}
            </span>
            <span className="block" aria-live="polite">
              {connection.enabled ? status.label : "Turned off"}
              {connection.checked_at ? ` · checked ${describeWhen(connection.checked_at)}` : ""}
            </span>
            {connection.enabled && status.fix ? <span className="block">{status.fix}</span> : null}
            {connection.status === "connected" ? (
              <span className="block">{[sight, tools].filter(Boolean).join(" · ")}</span>
            ) : null}
          </>
        }
      >
        {/* Five actions wrap into two lines so the key's details keep a readable width. */}
        <div className="flex flex-wrap gap-2 sm:max-w-[17rem] sm:justify-end">
          <Action label="Test" busy={act.isPending} onClick={() => setTesting(true)} />
          <Action
            label={models ? "Hide models & spending" : "Models & spending"}
            onClick={() => setModels((open) => !open)}
          />
          <Action label="Replace key" onClick={() => setReplacing((open) => !open)} />
          <Action
            label={connection.enabled ? "Turn off" : "Turn on"}
            busy={act.isPending}
            onClick={() => act.mutate({ action: "enable", enabled: !connection.enabled })}
          />
          <Action label="Delete" destructive onClick={() => setDeleting(true)} />
        </div>
      </Row>
      <label className="mt-1 flex min-h-8 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={connection.send_images}
          disabled={images.isPending}
          onChange={(event) => images.mutate(event.target.checked)}
          className="h-4 w-4"
        />
        <span>Send pictures (screenshots and images you attach) to this provider</span>
      </label>
      <p className="ml-6 text-xs text-muted-foreground">
        {connection.send_images
          ? "On: the picture leaves your computer for the provider at the address above, under that provider's own terms and retention. OCADE does not control where they keep it."
          : "Off by default: pictures stay on your computer and this key's models are treated as unable to see."}
      </p>
      {testing ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 text-[0.8125rem] text-muted-foreground">
          <span>A test sends two small requests to your provider and may use your quota.</span>
          <div className="flex gap-2">
            <Action
              label={act.isPending ? "Testing…" : "Run test"}
              busy={act.isPending}
              onClick={() => act.mutate({ action: "test" })}
            />
            <Action label="Cancel" onClick={() => setTesting(false)} />
          </div>
        </div>
      ) : null}
      {models ? <ModelsAndSpending connection={connection} onChanged={onChanged} /> : null}
      {deleting ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 text-[0.8125rem] text-muted-foreground">
          <span>
            Deletes the key from OCADE. Anything that used it stops until you choose another source.
          </span>
          <Confirm
            label="Delete key"
            busy={act.isPending}
            onConfirm={() => act.mutate({ action: "delete" })}
            onCancel={() => setDeleting(false)}
          />
        </div>
      ) : null}
      {replacing ? (
        <ConnectionForm
          initial={connection}
          onDone={() => {
            setReplacing(false);
            onChanged();
          }}
        />
      ) : null}
      {problem ? (
        <p role="alert" className="text-[0.8125rem] text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

function AddConnection({ count, onChanged }: { count: number; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  if (count >= 20) {
    return (
      <Row label="Add a connection" description="You have the most connections OCADE keeps (20)." />
    );
  }
  return open ? (
    <ConnectionForm
      onDone={() => {
        setOpen(false);
        onChanged();
      }}
      onCancel={() => setOpen(false)}
    />
  ) : (
    <Row
      label="Add a connection"
      description="Use your own API key from Google, OpenAI, OpenRouter or another compatible provider."
    >
      <Action label="Add" onClick={() => setOpen(true)} />
    </Row>
  );
}

function ConnectionForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: ByokConnection;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const knownPreset = PRESETS.find(
    (preset) => preset.endpoint === initial?.endpoint && preset.protocol === initial.protocol,
  );
  const [preset, setPreset] = useState(initial ? (knownPreset?.id ?? "other") : "google");
  const [alias, setAlias] = useState(initial?.alias ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [endpoint, setEndpoint] = useState(initial?.endpoint ?? "");
  const [protocol, setProtocol] = useState<ByokProtocol>(initial?.protocol ?? "openai");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = PRESETS.find((entry) => entry.id === preset);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const key = (form.elements.namedItem("key") as HTMLInputElement).value;
    setBusy(true);
    setProblem(null);
    try {
      await changeByok({
        action: "save",
        connectionId: initial?.id ?? null,
        alias,
        protocol: chosen?.protocol ?? protocol,
        endpoint: chosen?.endpoint ?? endpoint,
        model,
        key: key || null,
      });
      // The key leaves the page with the request: the field is cleared at once.
      (form.elements.namedItem("key") as HTMLInputElement).value = "";
      onDone();
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = "h-9 w-full rounded-md border border-border bg-background px-2 text-sm";
  return (
    <form onSubmit={submit} className="space-y-3 border-b border-border/50 py-4" autoComplete="off">
      <p className="text-sm text-foreground">
        {initial ? `Change ${initial.alias}` : "Add a connection"}
      </p>
      <label className="block text-[0.8125rem] text-muted-foreground" htmlFor={`${id}-preset`}>
        Provider
        <select
          id={`${id}-preset`}
          className={field}
          value={preset}
          onChange={(event) => setPreset(event.target.value)}
        >
          {PRESETS.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
          <option value="other">Other compatible provider…</option>
        </select>
      </label>
      {preset === "other" ? (
        <>
          <label
            className="block text-[0.8125rem] text-muted-foreground"
            htmlFor={`${id}-protocol`}
          >
            API type
            <select
              id={`${id}-protocol`}
              className={field}
              value={protocol}
              onChange={(event) => setProtocol(event.target.value as ByokProtocol)}
            >
              <option value="openai">OpenAI Chat Completions (…/chat/completions)</option>
              <option value="gemini">Google Gemini (…/models/MODEL:generateContent)</option>
              <option value="anthropic">Anthropic Messages (…/messages)</option>
              <option value="responses">OpenAI Responses (…/responses)</option>
            </select>
          </label>
          <label
            className="block text-[0.8125rem] text-muted-foreground"
            htmlFor={`${id}-endpoint`}
          >
            API base URL (public HTTPS, for example https://api.example.com/v1)
            <input
              id={`${id}-endpoint`}
              className={field}
              type="url"
              inputMode="url"
              required
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
            />
          </label>
        </>
      ) : (
        <p className="text-[0.8125rem] text-muted-foreground">API address: {chosen?.endpoint}</p>
      )}
      <label className="block text-[0.8125rem] text-muted-foreground" htmlFor={`${id}-alias`}>
        Name
        <input
          id={`${id}-alias`}
          className={field}
          required
          maxLength={60}
          value={alias}
          onChange={(event) => setAlias(event.target.value)}
        />
      </label>
      <label className="block text-[0.8125rem] text-muted-foreground" htmlFor={`${id}-model`}>
        Model ID, exactly as your provider names it
        <input
          id={`${id}-model`}
          className={field}
          required
          maxLength={200}
          spellCheck={false}
          value={model}
          onChange={(event) => setModel(event.target.value)}
        />
      </label>
      <label className="block text-[0.8125rem] text-muted-foreground" htmlFor={`${id}-key`}>
        {initial ? "New API key (leave empty to keep the current one)" : "API key"}
        <input
          id={`${id}-key`}
          name="key"
          className={field}
          type="password"
          autoComplete="off"
          spellCheck={false}
          required={!initial}
          maxLength={4096}
        />
      </label>
      <p className="text-[0.8125rem] text-muted-foreground">
        OCADE stores the key encrypted on its server and never shows it again. Test the connection
        after saving.
      </p>
      {problem ? (
        <p role="alert" className="text-[0.8125rem] text-destructive">
          {problem}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="h-8 rounded-md border border-border px-3 text-sm text-foreground hover:bg-accent disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {onCancel ? <Action label="Cancel" onClick={onCancel} /> : null}
      </div>
    </form>
  );
}

const SPEND_TEXT = {
  free_only:
    "Free-only: only models your provider lists as free, or this key if you confirm it has no billing. A paid request is never sent.",
  custom:
    "Custom: OCADE reserves each call's largest cost before sending it and stops at your amounts. Needs each model's price.",
  unlimited:
    "Unlimited: no OCADE limit. Your provider still charges for use and keeps its own limits.",
} as const;

/** One price line for a model, from what is known only. */
function priceText(model: ByokModel): string {
  if (model.free === true) return "Free";
  if (model.input_price !== null && model.output_price !== null)
    return `${model.input_price} in / ${model.output_price} out ${model.price_currency ?? ""} per million tokens`;
  return "Price unknown";
}

/**
 * ALL THE MODELS UNDER ONE KEY, AUTO OR MANUAL, AND A SPENDING POLICY (plan 14D.4A.3-5). The list
 * is the provider's own for this key; a badge says only what the list or a test showed.
 */
function ModelsAndSpending({
  connection,
  onChanged,
}: {
  connection: ByokConnection;
  onChanged: () => void;
}) {
  const id = useId();
  const client = useQueryClient();
  const key = ["byok-models", connection.id];
  const data = useQuery({ queryKey: key, queryFn: () => readModels(connection), staleTime: 0 });
  const [filter, setFilter] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [pricing, setPricing] = useState<string | null>(null);
  const [policy, setPolicy] = useState({
    modelMode: connection.model_mode,
    spendMode: connection.spend_mode,
    freeTier: connection.free_tier,
    currency: connection.budget_currency,
    timeZone:
      connection.budget_time_zone === "UTC"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        : connection.budget_time_zone,
    task: connection.budget_task?.toString() ?? "",
    day: connection.budget_day?.toString() ?? "",
    month: connection.budget_month?.toString() ?? "",
  });
  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      changeByok({ connectionId: connection.id, ...body }),
    onSuccess: () => {
      setProblem(null);
      setPricing(null);
      void client.invalidateQueries({ queryKey: key });
      onChanged();
    },
    onError: (error) => setProblem(error.message),
  });
  const field = "h-8 rounded-md border border-border bg-background px-2 text-sm";
  const shown = (data.data?.models ?? [])
    .filter((model) =>
      `${model.model} ${model.label ?? ""}`.toLowerCase().includes(filter.toLowerCase()),
    )
    .sort((a, b) => Number(Boolean(b.permitted_at)) - Number(Boolean(a.permitted_at)))
    .slice(0, 50);
  const total = data.data?.models.length ?? 0;
  const money = (value: number) => `${value.toFixed(4)} ${connection.budget_currency}`;

  return (
    <div className="space-y-3 pb-4 text-[0.8125rem] text-muted-foreground">
      <Pending
        query={data}
        loading="Reading this key's models…"
        problem="This key's models could not be read. Nothing was changed."
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          {connection.models_listed_at
            ? `${total} models listed for this key · read ${describeWhen(connection.models_listed_at)}`
            : "The model list for this key has not been read yet."}
        </span>
        <Action
          label={act.isPending ? "Reading…" : "Refresh model list"}
          busy={act.isPending}
          onClick={() => act.mutate({ action: "models" })}
        />
      </div>

      <fieldset className="space-y-1">
        <legend className="text-foreground">Which model</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`${id}-mode`}
            checked={policy.modelMode === "manual"}
            onChange={() => setPolicy({ ...policy, modelMode: "manual" })}
          />
          Manual: always {connection.model}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`${id}-mode`}
            checked={policy.modelMode === "auto"}
            onChange={() => setPolicy({ ...policy, modelMode: "auto" })}
          />
          Auto: the first model you permit below that can do the job (JARVIS needs tool calls), in
          the order you permitted them. Never a model you did not permit, and never another key.
        </label>
      </fieldset>

      {total ? (
        <div className="space-y-1">
          <label className="block" htmlFor={`${id}-filter`}>
            Find a model ({total} in the list, permitted first)
            <input
              id={`${id}-filter`}
              className={`${field} w-full`}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </label>
          <ul className="divide-y divide-border/50">
            {shown.map((model) => (
              <li
                key={model.model}
                className="flex flex-wrap items-center justify-between gap-2 py-1.5"
              >
                <span className="min-w-0 break-all">
                  <span className="text-foreground">{model.label ?? model.model}</span>
                  {model.label ? ` · ${model.model}` : ""}
                  <span className="block">
                    {[
                      priceText(model),
                      model.calls_tools === true
                        ? "Calls tools"
                        : model.calls_tools === false
                          ? "No tool calls"
                          : "Tools unknown",
                      model.sees_images === true
                        ? "Sees images"
                        : model.sees_images === false
                          ? "Text only"
                          : "Images unknown",
                      model.listed ? null : "No longer listed by your provider",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={Boolean(model.permitted_at)}
                      disabled={act.isPending || !model.listed}
                      onChange={(event) =>
                        act.mutate({
                          action: "model",
                          model: model.model,
                          permitted: event.target.checked,
                        })
                      }
                    />
                    Permit
                  </label>
                  <Action
                    label="Test"
                    busy={act.isPending}
                    onClick={() => act.mutate({ action: "test", model: model.model })}
                  />
                  <Action
                    label="Price"
                    onClick={() => setPricing(pricing === model.model ? null : model.model)}
                  />
                </span>
                {pricing === model.model ? (
                  <form
                    className="flex w-full flex-wrap items-end gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      act.mutate({
                        action: "model",
                        model: model.model,
                        permitted: Boolean(model.permitted_at),
                        inputPrice: form.get("in"),
                        outputPrice: form.get("out"),
                        currency: connection.budget_currency,
                      });
                    }}
                  >
                    <label>
                      Input, {connection.budget_currency} per million tokens
                      <input
                        name="in"
                        required
                        inputMode="decimal"
                        className={`${field} block w-32`}
                      />
                    </label>
                    <label>
                      Output, {connection.budget_currency} per million tokens
                      <input
                        name="out"
                        required
                        inputMode="decimal"
                        className={`${field} block w-32`}
                      />
                    </label>
                    <button
                      type="submit"
                      className="h-8 rounded-md border border-border px-3 text-foreground"
                    >
                      Save price
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {total > shown.length && !filter ? <p>Type to find the other models.</p> : null}
          <p>A test sends two small requests with that model and may use your quota.</p>
        </div>
      ) : null}

      <fieldset className="space-y-1">
        <legend className="text-foreground">Spending on this key</legend>
        {(Object.keys(SPEND_TEXT) as (keyof typeof SPEND_TEXT)[]).map((mode) => (
          <label key={mode} className="flex items-start gap-2">
            <input
              type="radio"
              name={`${id}-spend`}
              checked={policy.spendMode === mode}
              onChange={() => setPolicy({ ...policy, spendMode: mode })}
            />
            <span>{SPEND_TEXT[mode]}</span>
          </label>
        ))}
        {policy.spendMode === "free_only" ? (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={policy.freeTier}
              onChange={(event) => setPolicy({ ...policy, freeTier: event.target.checked })}
            />
            This key has no billing attached with my provider (a free-tier key)
          </label>
        ) : null}
        {policy.spendMode === "custom" ? (
          <div className="flex flex-wrap gap-2">
            <label>
              Currency
              <input
                className={`${field} block w-20 uppercase`}
                maxLength={3}
                value={policy.currency}
                onChange={(event) =>
                  setPolicy({ ...policy, currency: event.target.value.toUpperCase() })
                }
              />
            </label>
            {(["task", "day", "month"] as const).map((period) => (
              <label key={period}>
                {period === "task" ? "Per task" : period === "day" ? "Per day" : "Per month"}
                <input
                  className={`${field} block w-28`}
                  inputMode="decimal"
                  placeholder="No limit"
                  value={policy[period]}
                  onChange={(event) => setPolicy({ ...policy, [period]: event.target.value })}
                />
              </label>
            ))}
            <label>
              Days reset at midnight in
              <input
                className={`${field} block w-44`}
                value={policy.timeZone}
                onChange={(event) => setPolicy({ ...policy, timeZone: event.target.value })}
              />
            </label>
          </div>
        ) : null}
        <Action
          label={act.isPending ? "Saving…" : "Save model and spending settings"}
          busy={act.isPending}
          onClick={() =>
            act.mutate({
              action: "policy",
              ...policy,
              task: policy.task || null,
              day: policy.day || null,
              month: policy.month || null,
            })
          }
        />
      </fieldset>

      {data.data ? (
        <p aria-live="polite">
          Recorded on this key: today {money(data.data.today)}, this month {money(data.data.month)}
          {data.data.estimated ? " (partly estimated from reservations)" : ""}
          {data.data.unpriced ? "; some calls had no known price and are not counted" : ""}. Your
          provider's bill may differ and may arrive later; OCADE's own models never draw on this
          key.
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
