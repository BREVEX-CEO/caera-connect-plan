import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { MapPin } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getCaniaSettings, saveCaniaSettings } from "@/lib/cania.functions";
import { recordAction } from "@/lib/actions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cania/settings")({
  head: () => ({ meta: [{ title: "CANIA · Settings" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cania", "settings"], queryFn: () => getCaniaSettings() });
  const saveFn = useServerFn(saveCaniaSettings);
  type Patch = {
    countryCode?: string | null;
    region?: string | null;
    timezone?: string | null;
    primaryCurrency?: string | null;
    secondaryCurrency?: string | null;
    units?: "metric" | "imperial";
    locationPermission?: "unknown" | "granted" | "denied" | "prompt_pending";
    approxLat?: number | null;
    approxLon?: number | null;
  };
  const save = useMutation({
    mutationFn: (data: Patch) => saveFn({ data }),
    onSuccess: async () => {
      await recordAction({ actionId: "cania.settings.save" });
      qc.invalidateQueries({ queryKey: ["cania", "settings"] });
      toast.success("Saved");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [tz, setTz] = useState("");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [units, setUnits] = useState<"metric" | "imperial">("metric");

  useEffect(() => {
    if (!q.data) return;
    setCountry(q.data.country_code ?? "");
    setRegion(q.data.region ?? "");
    setTz(q.data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
    setPrimary(q.data.primary_currency ?? "");
    setSecondary(q.data.secondary_currency ?? "");
    setUnits((q.data.units as "metric" | "imperial") ?? "metric");
  }, [q.data]);

  async function requestLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation not supported by this browser.");
      return;
    }
    await save.mutateAsync({ locationPermission: "prompt_pending" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await save.mutateAsync({
          locationPermission: "granted",
          approxLat: Math.round(pos.coords.latitude * 100) / 100,
          approxLon: Math.round(pos.coords.longitude * 100) / 100,
        });
        await recordAction({ actionId: "cania.location.grant" });
      },
      async () => {
        await save.mutateAsync({ locationPermission: "denied" });
        toast.error("Location denied. Weather and traffic cards will stay in Setup Required.");
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <GlassPanel className="p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Country (ISO-2)"
            hint="Used by Country news and Government feeds. Example: IN, US, GB."
          >
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="IN"
            />
          </Field>
          <Field label="Region / state" hint="Optional — narrows some feeds.">
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Karnataka"
            />
          </Field>
          <Field label="Timezone" hint="IANA timezone name.">
            <Input value={tz} onChange={(e) => setTz(e.target.value)} placeholder="Asia/Kolkata" />
          </Field>
          <Field label="Primary currency" hint="ISO 4217 code. Example: INR, USD.">
            <Input
              value={primary}
              onChange={(e) => setPrimary(e.target.value.toUpperCase().slice(0, 3))}
              placeholder="INR"
            />
          </Field>
          <Field label="Secondary currency" hint="Optional — used for exchange cards.">
            <Input
              value={secondary}
              onChange={(e) => setSecondary(e.target.value.toUpperCase().slice(0, 3))}
              placeholder="USD"
            />
          </Field>
          <Field label="Units" hint="Metric or imperial.">
            <RadioGroup
              value={units}
              onValueChange={(v) => setUnits(v as "metric" | "imperial")}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="metric" /> Metric
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="imperial" /> Imperial
              </label>
            </RadioGroup>
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() =>
              save.mutate({
                countryCode: country || null,
                region: region || null,
                timezone: tz || null,
                primaryCurrency: primary || null,
                secondaryCurrency: secondary || null,
                units,
              })
            }
            disabled={save.isPending}
          >
            Save settings
          </Button>
        </div>
      </GlassPanel>

      <GlassPanel className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MapPin className="h-4 w-4" /> Location permission
        </div>
        <p className="text-xs text-muted-foreground">
          Weather and Traffic need approximate coordinates. Location is asked only when you press
          the button below. We store rounded coordinates (about 1 km precision), never a live track.
        </p>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            Current status:{" "}
            <span className="text-foreground">{q.data?.location_permission ?? "unknown"}</span>
            {q.data?.approx_lat != null && q.data?.approx_lon != null ? (
              <>
                {" "}
                · approx {q.data.approx_lat}, {q.data.approx_lon}
              </>
            ) : null}
          </span>
          <Button size="sm" variant="outline" onClick={requestLocation}>
            Request location
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      {children}
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
