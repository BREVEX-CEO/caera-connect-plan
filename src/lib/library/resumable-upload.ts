/**
 * RESUMABLE LIBRARY UPLOADS (plan 14E.4.3-4): large files go straight from the browser to the
 * private Library bucket with the TUS protocol Supabase Storage speaks, in 6 MiB chunks, signed in
 * as the person (the bucket's own policies decide where they may write), so no file passes
 * through a short-lived server function. Progress is the bytes the server ACCEPTED; an
 * interrupted upload resumes from the server's own offset, also after a reload, from a resume
 * record kept on this device; cancel stops sending. The server then checks the stored bytes
 * before the file is listed (`finishLibraryUpload`).
 */
export const CHUNK = 6 * 1024 * 1024;

const b64 = (text: string) => btoa(unescape(encodeURIComponent(text)));

/** Same file on this device: name, size and modification time. */
export const fingerprint = (file: File) =>
  `ocade.upload.${file.name}:${file.size}:${file.lastModified}`;

export interface ResumeRecord {
  url: string;
  id: string;
}

function trustedUploadLocation(value: string, endpoint: URL): string | null {
  try {
    const location = new URL(value, endpoint);
    const prefix = `${endpoint.pathname}/`;
    if (
      location.origin !== endpoint.origin ||
      location.username ||
      location.password ||
      !location.pathname.startsWith(prefix) ||
      location.pathname === prefix
    )
      return null;
    return location.href;
  } catch {
    return null;
  }
}

function acknowledgedOffset(response: Response, maximum: number): number {
  const header = response.headers.get("upload-offset");
  const offset = Number(header);
  if (!header || !/^\d+$/.test(header) || !Number.isSafeInteger(offset) || offset > maximum) {
    throw new Error("The server returned invalid upload progress.");
  }
  return offset;
}

export async function uploadResumable(input: {
  file: File;
  endpoint: string;
  apiKey: string;
  accessToken: string;
  objectName: string;
  id: string;
  onProgress?: (accepted: number, total: number) => void;
  signal?: AbortSignal;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}): Promise<void> {
  const { file, signal } = input;
  const store = input.storage ?? window.localStorage;
  const endpoint = new URL(input.endpoint);
  const auth = {
    authorization: `Bearer ${input.accessToken}`,
    apikey: input.apiKey,
    "tus-resumable": "1.0.0",
  };
  const interrupted = "The upload was interrupted. Choose the file again to resume.";
  // Storage credentials and file data belong only on the configured TUS route.
  const request = (url: string, init: RequestInit) =>
    fetch(url, { ...init, signal, redirect: "error" });
  const send = (url: string, init: RequestInit) =>
    request(url, init).catch((error: unknown) => {
      if (signal?.aborted) throw error;
      return null;
    });
  const key = fingerprint(file);
  let record = resumable(file, endpoint, store);
  let offset = 0;
  if (record && record.id === input.id) {
    const head = await send(record.url, { method: "HEAD", headers: auth, cache: "no-store" });
    if (head?.ok) offset = acknowledgedOffset(head, file.size);
    else if (head && [403, 404, 410].includes(head.status)) record = null;
    else throw new Error(interrupted);
  } else record = null;
  if (!record) {
    const created = await request(endpoint.href, {
      method: "POST",
      headers: {
        ...auth,
        "upload-length": String(file.size),
        "x-upsert": "false",
        "upload-metadata": [
          `bucketName ${b64("library")}`,
          `objectName ${b64(input.objectName)}`,
          `contentType ${b64("application/octet-stream")}`,
          `cacheControl ${b64("3600")}`,
        ].join(","),
      },
    });
    const location = created.headers.get("location");
    if (!created.ok || !location) throw new Error("The upload could not start. Try again.");
    const url = trustedUploadLocation(location, endpoint);
    if (!url) throw new Error("Storage returned an unexpected upload location.");
    record = { url, id: input.id };
    store.setItem(key, JSON.stringify(record));
  }
  input.onProgress?.(offset, file.size);
  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(file.size, offset + CHUNK));
    let accepted = offset;
    for (let attempt = 0; attempt < 4 && accepted === offset; attempt += 1) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      const answer = await send(record.url, {
        method: "PATCH",
        headers: {
          ...auth,
          "upload-offset": String(offset),
          "content-type": "application/offset+octet-stream",
        },
        body: chunk,
      });
      if (answer?.ok) {
        accepted = acknowledgedOffset(answer, offset + chunk.size);
        if (accepted <= offset) throw new Error("The server did not accept that part.");
      } else if (!answer || answer.status === 409 || answer.status >= 500) {
        // The chunk may already be stored. Recover the receiver's offset before retrying it.
        const head = await send(record.url, { method: "HEAD", headers: auth, cache: "no-store" });
        if (head?.ok) {
          accepted = acknowledgedOffset(head, offset + chunk.size);
          if (accepted < offset) throw new Error("The server lost part of the upload.");
        }
      }
    }
    if (accepted === offset) throw new Error(interrupted);
    offset = accepted;
    input.onProgress?.(offset, file.size);
  }
  store.removeItem(key);
}

/** The record of an unfinished upload of this file on this device, to resume it. */
export function resumable(
  file: File,
  endpoint: URL,
  storage: Pick<Storage, "getItem"> = window.localStorage,
): ResumeRecord | null {
  try {
    const record = JSON.parse(
      storage.getItem(fingerprint(file)) ?? "null",
    ) as Partial<ResumeRecord> | null;
    if (typeof record?.url !== "string" || typeof record.id !== "string") return null;
    const url = trustedUploadLocation(record.url, endpoint);
    return url ? { url, id: record.id } : null;
  } catch {
    return null;
  }
}
