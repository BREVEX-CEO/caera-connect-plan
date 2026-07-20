import { Lock, CloudCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function PrivacyBadge({
  mode,
  className,
}: {
  mode: "device_only" | "private_sync";
  className?: string;
}) {
  const isDevice = mode === "device_only";
  const Icon = isDevice ? Lock : CloudCheck;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        isDevice
          ? "bg-[color:var(--accent-madee)]/15 text-[color:var(--accent-madee)] ring-[color:var(--accent-madee)]/25"
          : "bg-[color:var(--accent-ocade)]/15 text-[color:var(--accent-ocade)] ring-[color:var(--accent-ocade)]/25",
        className,
      )}
      title={
        isDevice
          ? "Device Only — data stays on this device"
          : "Private Sync — encrypted account sync across your approved devices"
      }
    >
      <Icon className="h-3 w-3" aria-hidden />
      {isDevice ? "Device Only" : "Private Sync"}
    </span>
  );
}
