import { useEffect, useRef, useState } from "react";

const ACCEPT = "image/png,image/jpeg,image/webp";

export function DeviceAvatarEditor({
  storageKey,
  initials,
}: {
  storageKey: string;
  initials: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState("No device avatar selected.");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setImage(saved);
        setStatus("Device avatar loaded.");
      }
    } catch {
      setStatus("Device avatar storage is unavailable.");
    }
  }, [storageKey]);
  function choose(file: File | undefined) {
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type) || file.size > 2_000_000) {
      setStatus("Choose a PNG, JPEG or WebP image up to 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : null;
      if (!value) return;
      try {
        localStorage.setItem(storageKey, value);
      } catch {
        setStatus("The image could not be saved on this device.");
        return;
      }
      setImage(value);
      setStatus("Device avatar updated.");
    };
    reader.onerror = () => setStatus("The image could not be read.");
    reader.readAsDataURL(file);
  }
  function remove() {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* status below */
    }
    setImage(null);
    setStatus("Device avatar removed.");
    if (input.current) input.current.value = "";
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-border/60 bg-secondary/60 text-sm font-semibold">
        {image ? (
          <img src={image} alt="Your device avatar" className="h-full w-full object-cover" />
        ) : (
          <span aria-label="Avatar initials">{initials}</span>
        )}
      </div>
      <div>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          onChange={(event) => choose(event.target.files?.[0])}
          className="sr-only"
          id="device-avatar"
        />
        <div className="flex gap-2">
          <label
            htmlFor="device-avatar"
            className="inline-flex min-h-9 cursor-pointer items-center rounded-md border border-border/70 px-3 text-xs"
          >
            {image ? "Replace avatar" : "Select avatar"}
          </label>
          {image ? (
            <button
              type="button"
              onClick={remove}
              className="min-h-9 rounded-md border border-border/70 px-3 text-xs"
            >
              Remove
            </button>
          ) : null}
        </div>
        <p role="status" className="mt-1 text-[11px] text-muted-foreground">
          {status} PNG, JPEG or WebP · 2 MB max · device only.
        </p>
      </div>
    </div>
  );
}
