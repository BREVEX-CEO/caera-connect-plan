import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState, type FormEvent } from "react";
import {
  PRESETS,
  STATUS_TEXT,
  changeByok,
  readByok,
  type ByokConnection,
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
        <div className="flex flex-wrap gap-2">
          <Action label="Test" busy={act.isPending} onClick={() => setTesting(true)} />
          <Action label="Replace key" onClick={() => setReplacing((open) => !open)} />
          <Action
            label={connection.enabled ? "Turn off" : "Turn on"}
            busy={act.isPending}
            onClick={() => act.mutate({ action: "enable", enabled: !connection.enabled })}
          />
          <Action label="Delete" destructive onClick={() => setDeleting(true)} />
        </div>
      </Row>
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
