import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, Download, Laptop, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice, PublicPage, PublicSection } from "@/components/public/PublicPage";
import {
  PUBLIC_WINDOWS_RELEASE,
  detectClientPlatform,
  evaluatePublicWindowsRelease,
  type ClientPlatform,
} from "@/lib/packaging/public-download";

export const Route = createFileRoute("/download")({
  /* The availability page is public even though every unverified installer is
     locked. A truthful disabled state is more useful than a silent redirect. */
  head: () => ({
    meta: [
      { title: "Download OCADE — desktop and mobile availability" },
      {
        name: "description",
        content:
          "Official OCADE desktop and mobile availability. Installers are never started automatically and public packages must pass signing and device tests.",
      },
    ],
  }),
  component: DownloadPage,
});

function DownloadPage() {
  const [platform, setPlatform] = useState<ClientPlatform>("other");
  useEffect(() => setPlatform(detectClientPlatform(navigator.userAgent)), []);

  const release = useMemo(() => evaluatePublicWindowsRelease(PUBLIC_WINDOWS_RELEASE), []);

  return (
    <PublicPage
      eyebrow="Official packages"
      title="OCADE on your devices"
      summary="The web app needs no installer. Native packages add the permission-gated local bridge used for computer control, deeper offline storage and operating-system integration. OCADE never installs itself."
    >
      <Notice>
        Downloads are not open yet. OCADE runs in your browser today with no installer, and the
        native packages arrive once they are signed and verified. Nothing on this page will ask you
        to install an unsigned build.
      </Notice>

      <PublicSection title="Windows desktop">
        <PackageRow
          icon={<Laptop className="h-5 w-5" aria-hidden />}
          title={platform === "windows" ? "Recommended for this device" : "OCADE for Windows"}
          description="Tauri desktop shell, local companion bridge and optional on-device runtime. Public packages remain unavailable until signing and clean-device verification are complete."
        />
        {release.ready ? (
          <Button asChild className="mt-4 rounded-full">
            <a href={release.url} download>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              {release.label}
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            disabled
            data-reason="A public Windows package needs publisher signing and a clean-device installation test."
            title="Unavailable until publisher signing and clean-device testing are complete"
            className="mt-4 rounded-full"
          >
            Signing and clean-device test required
          </Button>
        )}
      </PublicSection>

      <PublicSection title="macOS, Android and iOS">
        <PackageRow
          icon={<Smartphone className="h-5 w-5" aria-hidden />}
          title="Packaging foundations are present"
          description="macOS and mobile packages are not public downloads yet. They need production signing, device testing and the relevant store accounts before release."
        />
      </PublicSection>

      <PublicSection title="What every public package must prove">
        <ul className="grid gap-2">
          {[
            "Publisher identity is verified by the operating system.",
            "The downloaded bytes match the published SHA-256 digest and update signature.",
            "Installation, first launch, update and uninstall pass on a clean device.",
            "Computer, camera, microphone and file permissions remain opt-in.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
          Browser OCADE cannot silently gain operating-system control. The signed local companion is
          the security boundary for desktop actions, while mobile control requires a paired and
          revocable device relationship.
        </p>
      </PublicSection>
    </PublicPage>
  );
}

function PackageRow({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 rounded-full border border-primary/30 bg-primary/10 p-2 text-primary">
        {icon}
      </span>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
