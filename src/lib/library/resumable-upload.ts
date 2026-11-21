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
  const auth = {
    authorization: `Bearer ${input.accessToken}`,
    apikey: input.apiKey,
    "tus-resumable": "1.0.0",
  };
  const key = fingerprint(file);
  let record: ResumeRecord | null = null;
  try {
    record = JSON.parse(store.getItem(key) ?? "null") as ResumeRecord | null;
  } catch {
    record = null;
  }
  let offset = 0;
  if (record && record.id === input.id) {
    const head = await fetch(record.url, { method: "HEAD", headers: auth, signal });
    if (head.ok) offset = Number(head.headers.get("upload-offset") ?? 0);
    else record = null;
  } else record = null;
  if (!record) {
    const created = await fetch(input.endpoint, {
      method: "POST",
      signal,
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
    record = { url: new URL(location, input.endpoint).toString(), id: input.id };
    store.setItem(key, JSON.stringify(record));
  }
  input.onProgress?.(offset, file.size);
  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(file.size, offset + CHUNK));
    let answer: Response | null = null;
    for (let attempt = 0; attempt < 4 && !answer?.ok; attempt += 1) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      answer = await fetch(record.url, {
        method: "PATCH",
        signal,
        headers: {
          ...auth,
          "upload-offset": String(offset),
          "content-type": "application/offset+octet-stream",
        },
        body: chunk,
      }).catch((error: unknown) => {
        if (signal?.aborted) throw error;
        return null;
      });
    }
    if (!answer?.ok)
      throw new Error("The upload was interrupted. Choose the file again to resume.");
    const accepted = Number(answer.headers.get("upload-offset"));
    if (!Number.isFinite(accepted) || accepted <= offset)
      throw new Error("The server did not accept that part.");
    offset = accepted;
    input.onProgress?.(offset, file.size);
  }
  store.removeItem(key);
}

/** The record of an unfinished upload of this file on this device, to resume it. */
export function resumable(file: File, storage: Pick<Storage, "getItem"> = window.localStorage) {
  try {
    return JSON.parse(storage.getItem(fingerprint(file)) ?? "null") as ResumeRecord | null;
  } catch {
    return null;
  }
}
